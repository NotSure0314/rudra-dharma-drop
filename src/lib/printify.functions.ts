import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const PRINTIFY_BASE = "https://api.printify.com/v1";

async function printifyFetch(path: string, init?: RequestInit) {
  const key = process.env.PRINTIFY_API_KEY;
  if (!key) throw new Error("Printify not configured");
  const res = await fetch(`${PRINTIFY_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "User-Agent": "Rudra/1.0",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Printify ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

export type ProductDTO = {
  id: string;
  title: string;
  description: string;
  images: { src: string }[];
  variants: { id: number; title: string; price: number; is_enabled: boolean }[];
};

export const getProducts = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ products: ProductDTO[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Try cache first
    const { data: cached } = await supabaseAdmin
      .from("products")
      .select("*")
      .order("updated_at", { ascending: false });

    const fresh =
      cached &&
      cached.length > 0 &&
      Date.now() - new Date(cached[0].cached_at).getTime() < CACHE_TTL_MS;

    if (fresh) {
      return {
        products: cached.map((r: any) => ({
          id: r.printify_id,
          title: r.title,
          description: r.description ?? "",
          images: r.images,
          variants: r.variants,
        })),
      };
    }

    // Refresh from Printify
    const shopId = process.env.PRINTIFY_SHOP_ID;
    if (!shopId) throw new Error("Printify shop not configured");
    let products: ProductDTO[] = [];
    try {
      const json = await printifyFetch(`/shops/${shopId}/products.json`);
      const list = Array.isArray(json?.data) ? json.data : [];
      products = list.map((p: any) => ({
        id: String(p.id),
        title: p.title,
        description: (p.description || "").replace(/<[^>]+>/g, "").trim(),
        images: (p.images || []).map((i: any) => ({ src: i.src })),
        variants: (p.variants || [])
          .filter((v: any) => v.is_enabled)
          .map((v: any) => ({
            id: v.id,
            title: v.title,
            price: v.price,
            is_enabled: v.is_enabled,
          })),
      }));
    } catch (e) {
      console.error("Printify fetch failed", e);
      // Fall back to stale cache if we have it
      if (cached && cached.length > 0) {
        return {
          products: cached.map((r: any) => ({
            id: r.printify_id,
            title: r.title,
            description: r.description ?? "",
            images: r.images,
            variants: r.variants,
          })),
        };
      }
      return { products: [] };
    }

    // Persist cache
    if (products.length > 0) {
      const rows = products.map((p) => ({
        printify_id: p.id,
        title: p.title,
        description: p.description,
        images: p.images,
        variants: p.variants,
        cached_at: new Date().toISOString(),
      }));
      await supabaseAdmin
        .from("products")
        .upsert(rows, { onConflict: "printify_id" });
    }

    return { products };
  }
);

const orderSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(1).max(120),
  address: z.object({
    line1: z.string().min(1).max(200),
    line2: z.string().max(200).optional().default(""),
    city: z.string().min(1).max(100),
    region: z.string().max(100).optional().default(""),
    postal_code: z.string().min(1).max(20),
    country: z.string().min(2).max(2),
    phone: z.string().max(40).optional().default(""),
  }),
  items: z
    .array(
      z.object({
        product_id: z.string().min(1),
        variant_id: z.number().int().positive(),
        quantity: z.number().int().min(1).max(10),
        title: z.string().max(200),
        price: z.number().int().nonnegative(),
      })
    )
    .min(1)
    .max(20),
});

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => orderSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const subtotal = data.items.reduce((s, i) => s + i.price * i.quantity, 0);

    const { data: row, error } = await supabaseAdmin
      .from("orders")
      .insert({
        customer_email: data.email,
        customer_name: data.name,
        shipping_address: data.address,
        line_items: data.items,
        subtotal_cents: subtotal,
        status: "pending",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    const shopId = process.env.PRINTIFY_SHOP_ID;
    let printifyOrderId: string | null = null;
    if (shopId) {
      try {
        const body = {
          external_id: row.id,
          label: `Rudra-${row.id.slice(0, 8)}`,
          line_items: data.items.map((i) => ({
            product_id: i.product_id,
            variant_id: i.variant_id,
            quantity: i.quantity,
          })),
          shipping_method: 1,
          send_shipping_notification: true,
          address_to: {
            first_name: data.name.split(" ")[0] || data.name,
            last_name: data.name.split(" ").slice(1).join(" ") || ".",
            email: data.email,
            phone: data.address.phone,
            country: data.address.country,
            region: data.address.region,
            address1: data.address.line1,
            address2: data.address.line2,
            city: data.address.city,
            zip: data.address.postal_code,
          },
        };
        const res = await printifyFetch(`/shops/${shopId}/orders.json`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        printifyOrderId = String(res?.id ?? "") || null;
        await supabaseAdmin
          .from("orders")
          .update({ printify_order_id: printifyOrderId, status: "submitted" })
          .eq("id", row.id);
      } catch (e) {
        console.error("Printify order failed", e);
        await supabaseAdmin
          .from("orders")
          .update({ status: "queued_local" })
          .eq("id", row.id);
      }
    }

    return { orderId: row.id, printifyOrderId, subtotal };
  });

const waitlistSchema = z.object({
  email: z.string().email().max(255),
  source: z.string().max(60).optional().default("inner_circle"),
});

export const joinWaitlist = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => waitlistSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("waitlist")
      .upsert({ email: data.email, source: data.source }, { onConflict: "email" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
