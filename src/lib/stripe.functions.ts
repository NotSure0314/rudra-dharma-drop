import { createServerFn } from "@tanstack/react-start";
import { getRequestHost, getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const cartItemSchema = z.object({
  product_id: z.string().min(1),
  variant_id: z.number().int().positive(),
  quantity: z.number().int().min(1).max(10),
  title: z.string().max(200),
  price: z.number().int().nonnegative(), // cents
  image: z.string().url().optional().or(z.literal("")),
});

const createSessionSchema = z.object({
  items: z.array(cartItemSchema).min(1).max(20),
});

function getOrigin() {
  const host = getRequestHost();
  const proto = getRequestHeader("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

async function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe not configured");
  const { default: Stripe } = await import("stripe");
  return new Stripe(key);
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => createSessionSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const subtotal = data.items.reduce((s, i) => s + i.price * i.quantity, 0);

    // 1. Insert a draft order so we can match it to the checkout session later.
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert({
        line_items: data.items,
        subtotal_cents: subtotal,
        status: "awaiting_payment",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    // 2. Create the Stripe Checkout session.
    const stripe = await getStripe();
    const origin = getOrigin();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: data.items.map((i) => ({
        quantity: i.quantity,
        price_data: {
          currency: "usd",
          unit_amount: i.price,
          product_data: {
            name: i.title,
            images: i.image ? [i.image] : undefined,
            metadata: {
              printify_product_id: i.product_id,
              printify_variant_id: String(i.variant_id),
            },
          },
        },
      })),
      shipping_address_collection: {
        allowed_countries: [
          "US", "CA", "GB", "AU", "DE", "FR", "ES", "IT", "NL", "BE",
          "IE", "SE", "NO", "DK", "FI", "AT", "CH", "PT", "PL", "NZ",
          "JP", "SG", "IN", "MX", "BR", "AE",
        ],
      },
      phone_number_collection: { enabled: true },
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancelled`,
      metadata: { order_id: order.id },
    });

    await supabaseAdmin
      .from("orders")
      .update({ stripe_session_id: session.id })
      .eq("id", order.id);

    return { url: session.url, sessionId: session.id };
  });

const fulfillSchema = z.object({ session_id: z.string().min(1).max(200) });

export const fulfillCheckout = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => fulfillSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const stripe = await getStripe();

    const session = await stripe.checkout.sessions.retrieve(data.session_id, {
      expand: ["customer_details", "shipping_details"],
    });

    if (session.payment_status !== "paid") {
      return { ok: false, status: session.payment_status };
    }

    // Look up the matching draft order.
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("stripe_session_id", data.session_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Order not found for session");

    // Idempotent: if already submitted, just return.
    if (order.status === "submitted" || order.status === "queued_local") {
      return { ok: true, orderId: order.id, alreadyFulfilled: true };
    }

    const customer = session.customer_details;
    const shipping = (session as any).shipping_details ?? session.shipping_details;
    const addr = shipping?.address ?? customer?.address;
    const email = customer?.email ?? "";
    const name = shipping?.name ?? customer?.name ?? "";
    const phone = customer?.phone ?? "";

    const shippingAddress = {
      line1: addr?.line1 ?? "",
      line2: addr?.line2 ?? "",
      city: addr?.city ?? "",
      region: addr?.state ?? "",
      postal_code: addr?.postal_code ?? "",
      country: addr?.country ?? "",
      phone,
    };

    await supabaseAdmin
      .from("orders")
      .update({
        customer_email: email,
        customer_name: name,
        shipping_address: shippingAddress,
        stripe_payment_intent:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id ?? null,
        status: "paid",
      })
      .eq("id", order.id);

    // Submit the order to Printify.
    const items = order.line_items as Array<{
      product_id: string;
      variant_id: number;
      quantity: number;
    }>;

    const PRINTIFY_BASE = "https://api.printify.com/v1";
    const PRINTIFY_SHOP_ID = "27806604";
    const printifyKey = process.env.PRINTIFY_API_KEY;

    let printifyOrderId: string | null = null;
    try {
      if (!printifyKey) throw new Error("Printify not configured");
      const res = await fetch(`${PRINTIFY_BASE}/shops/${PRINTIFY_SHOP_ID}/orders.json`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${printifyKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          external_id: order.id,
          label: `Rudra-${order.id.slice(0, 8)}`,
          line_items: items.map((i) => ({
            product_id: i.product_id,
            variant_id: i.variant_id,
            quantity: i.quantity,
          })),
          shipping_method: 1,
          send_shipping_notification: true,
          address_to: {
            first_name: name.split(" ")[0] || name || "Customer",
            last_name: name.split(" ").slice(1).join(" ") || ".",
            email,
            phone,
            country: shippingAddress.country,
            region: shippingAddress.region,
            address1: shippingAddress.line1,
            address2: shippingAddress.line2,
            city: shippingAddress.city,
            zip: shippingAddress.postal_code,
          },
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Printify ${res.status}: ${txt.slice(0, 300)}`);
      }
      const json = await res.json();
      printifyOrderId = String(json?.id ?? "") || null;

      await supabaseAdmin
        .from("orders")
        .update({ printify_order_id: printifyOrderId, status: "submitted" })
        .eq("id", order.id);
    } catch (e) {
      console.error("Printify submission failed", e);
      await supabaseAdmin
        .from("orders")
        .update({ status: "queued_local" })
        .eq("id", order.id);
    }

    return { ok: true, orderId: order.id, printifyOrderId };
  });
