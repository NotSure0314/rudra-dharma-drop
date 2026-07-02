import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ProductDTO } from "./printify.server";

export type { ProductDTO } from "./printify.server";

export const getProducts = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ products: ProductDTO[] }> => {
    try {
      const { fetchPrintifyProducts } = await import("./printify.server");
      return { products: await fetchPrintifyProducts() };
    } catch (e) {
      console.error("Printify fetch failed", e);
      return { products: [] };
    }
  },
);

export const getProductById = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }): Promise<{ product: ProductDTO | null }> => {
    try {
      const { fetchPrintifyProductById } = await import("./printify.server");
      return { product: await fetchPrintifyProductById(data.id) };
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
      }),
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
        const { createPrintifyOrder } = await import("./printify.server");
        const res = await createPrintifyOrder({
          orderId: row.id,
          items: data.items,
          name: data.name,
          email: data.email,
          address: data.address,
        });
        printifyOrderId = String(res?.id ?? "") || null;
        await supabaseAdmin
          .from("orders")
          .update({ printify_order_id: printifyOrderId, status: "submitted" })
          .eq("id", row.id);
      } catch (e) {
        console.error("Printify order failed", e);
        await supabaseAdmin.from("orders").update({ status: "queued_local" }).eq("id", row.id);
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
