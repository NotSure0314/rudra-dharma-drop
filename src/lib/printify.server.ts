const PRINTIFY_BASE = "https://api.printify.com/v1";
const PRINTIFY_SHOP_ID = "27806604";

export type ProductDTO = {
  id: string;
  title: string;
  description: string;
  images: { src: string }[];
  variants: { id: number; title: string; price: number; is_enabled: boolean }[];
};

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
    throw new Error(`Printify ${res.status}: ${txt.slice(0, 300)}`);
  }

  return res.json();
}

function cleanDescription(description: string | null | undefined) {
  return (description || "").replace(/<[^>]+>/g, "").trim();
}

function normalizeProduct(p: any): ProductDTO {
  return {
    id: String(p.id),
    title: p.title,
    description: cleanDescription(p.description),
    images: (p.images || [])
      .map((i: any) => ({ src: i.src }))
      .filter((i: { src?: string }) => Boolean(i.src)),
    variants: (p.variants || [])
      .filter((v: any) => v.is_enabled !== false)
      .map((v: any) => ({
        id: v.id,
        title: v.title,
        price: v.price,
        is_enabled: v.is_enabled !== false,
      })),
  };
}

export async function markPublished(productId: string, handle = productId) {
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
      },
    );
  } catch (e) {
    console.warn("publishing_succeeded failed", productId, e);
  }
}

export async function fetchPrintifyProducts() {
  const json = await printifyFetch(`/shops/${PRINTIFY_SHOP_ID}/products.json`);
  const list = Array.isArray(json?.data) ? json.data : [];
  const products: ProductDTO[] = list.map((p: any) => normalizeProduct(p));

  await Promise.allSettled(products.map((p) => markPublished(p.id)));

  return products;
}

export async function fetchPrintifyProductById(id: string) {
  const json = await printifyFetch(`/shops/${PRINTIFY_SHOP_ID}/products/${id}.json`);
  const product = normalizeProduct(json);
  await markPublished(product.id);
  return product;
}

export async function createPrintifyOrder({
  orderId,
  items,
  name,
  email,
  address,
}: {
  orderId: string;
  items: Array<{ product_id: string; variant_id: number; quantity: number }>;
  name: string;
  email: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    region?: string;
    postal_code: string;
    country: string;
    phone?: string;
  };
}) {
  return printifyFetch(`/shops/${PRINTIFY_SHOP_ID}/orders.json`, {
    method: "POST",
    body: JSON.stringify({
      external_id: orderId,
      label: `Rudra-${orderId.slice(0, 8)}`,
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
        phone: address.phone ?? "",
        country: address.country,
        region: address.region ?? "",
        address1: address.line1,
        address2: address.line2 ?? "",
        city: address.city,
        zip: address.postal_code,
      },
    }),
  });
}