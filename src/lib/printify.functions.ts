import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PRINTIFY_BASE = "https://api.printify.com/v1";
const PRINTIFY_SHOP_ID = "27806604";

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

async function markPublished(productId: string, handle: string) {
  // Clear Printify's "publishing" lock for custom/API stores.
  try {
    await printifyFetch(
      `/shops/${PRINTIFY_SHOP_ID}/products/${productId}/publishing_succeeded.json`,
      {
        method: "POST",
        body: JSON.stringify({
          external: {
            id: productId,
            handle: `https://rudrastyle.lovable.app/products/${handle}`,
          },
        }),
      }
    );
  } catch (e) {
    console.warn("publishing_succeeded failed", productId, e);
  }
}

export const getProducts = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ products: ProductDTO[] }> => {
    try {
      const json = await printifyFetch(`/shops/${PRINTIFY_SHOP_ID}/products.json`);
      const list = Array.isArray(json?.data) ? json.data : [];
      const products = list.map((p: any) => {
        const variants = (p.variants || [])
          .filter((v: any) => v.is_enabled !== false)
          .map((v: any) => ({
            id: v.id,
            title: v.title,
            price: v.price,
            is_enabled: v.is_enabled !== false,
          }));

        return {
          id: String(p.id),
          title: p.title,
          description: (p.description || "").replace(/<[^>]+>/g, "").trim(),
          images: (p.images || [])
            .map((i: any) => ({ src: i.src }))
            .filter((i: { src?: string }) => Boolean(i.src)),
          variants,
          _locked: Boolean(p?.is_locked),
        };
      });

      // Explicitly mark every product as published so newly-added products
      // don't stay stuck in Printify's publishing state.
      await Promise.allSettled(products.map((p: any) => markPublished(p.id, p.id)));

      return { products: products.map(({ _locked, ...rest }: any) => rest) };
    } catch (e) {
      console.error("Printify fetch failed", e);
      return { products: [] };
    }
  }
);

export const getProductById = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }): Promise<{ product: ProductDTO | null }> => {
    try {
      const json = await printifyFetch(`/shops/${PRINTIFY_SHOP_ID}/products/${data.id}.json`);
      const variants = (json.variants || [])
        .filter((v: any) => v.is_enabled !== false)
        .map((v: any) => ({
          id: v.id,
          title: v.title,
          price: v.price,
          is_enabled: v.is_enabled !== false,
        }));
      await markPublished(String(json.id), String(json.id));
      return {
        product: {
          id: String(json.id),
          title: json.title,
          description: (json.description || "").replace(/<[^>]+>/g, "").trim(),
          images: (json.images || [])
            .map((i: any) => ({ src: i.src }))
            .filter((i: { src?: string }) => Boolean(i.src)),
          variants,
        },
      };
    } catch (e) {
      console.error("Printify product fetch failed", e);
      return { product: null };
    }
  });

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

    let printifyOrderId: string | null = null;
    {
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
        const res = await printifyFetch(`/shops/${PRINTIFY_SHOP_ID}/orders.json`, {
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
