import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ProductDTO } from "@/lib/printify.functions";
import { useCart, type CartItem } from "@/hooks/use-cart";

export const Route = createFileRoute("/products/$productId")({
  head: ({ params }) => ({
    meta: [
      { title: "Rudra — Product" },
      { name: "description", content: "Sacred streetwear product details" },
    ],
  }),
  component: ProductDetailPage,
});

function ProductDetailPage() {
  const { productId } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["product", productId],
    queryFn: async () => {
      const res = await fetch(
        `/api/public/printify-products?id=${encodeURIComponent(productId)}&t=${Date.now()}`,
        { headers: { Accept: "application/json" } },
      );
      if (!res.ok) throw new Error("Product failed to load");
      return (await res.json()) as { product: ProductDTO | null };
    },
  });
  const product = data?.product;

  const { add } = useCart();
  const [selectedImage, setSelectedImage] = useState(0);
  const [variantId, setVariantId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground pt-24 px-6">
        <div className="max-w-6xl mx-auto animate-pulse">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="aspect-[4/5] bg-secondary" />
            <div className="space-y-4 pt-8">
              <div className="h-8 bg-secondary w-2/3" />
              <div className="h-6 bg-secondary w-1/4" />
              <div className="h-24 bg-secondary w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background text-foreground pt-24 px-6 text-center">
        <p className="font-display text-2xl text-bone">Product not found.</p>
        <Link to="/" className="text-amber mt-4 inline-block text-sm uppercase tracking-[0.2em] hover:underline">
          ← Back to Collection
        </Link>
      </div>
    );
  }

  const enabled = product.variants.filter((v) => v.is_enabled);
  const activeVariant = enabled.find((v) => v.id === variantId) ?? enabled[0];
  const images = product.images;

  return (
    <div className="min-h-screen bg-background text-foreground pt-24 pb-16 px-6">
      <div className="max-w-6xl mx-auto">
        <Link
          to="/"
          className="text-xs uppercase tracking-[0.25em] text-muted-foreground hover:text-amber transition-colors mb-8 inline-block"
        >
          ← Back to Collection
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
          {/* Images */}
          <div>
            <div className="relative aspect-[4/5] overflow-hidden bg-secondary">
              {images[selectedImage] ? (
                <img
                  src={images[selectedImage].src}
                  alt={product.title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground font-display text-3xl">
                  ॐ
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-3 mt-4 overflow-x-auto pb-2">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`relative w-20 h-20 flex-shrink-0 overflow-hidden bg-secondary border-2 transition-colors ${
                      i === selectedImage
                        ? "border-amber"
                        : "border-transparent hover:border-border"
                    }`}
                  >
                    <img
                      src={img.src}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="lg:pt-8">
            <h1 className="font-display text-3xl md:text-4xl text-bone">
              {product.title}
            </h1>
            {activeVariant && (
              <p className="mt-4 text-2xl text-amber font-display">
                ${(activeVariant.price / 100).toFixed(2)}
              </p>
            )}
            {product.description && (
              <p className="mt-6 text-muted-foreground leading-loose">
                {product.description}
              </p>
            )}

            {enabled.length > 0 && (
              <div className="mt-8">
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-3">
                  Variant
                </p>
                <div className="flex flex-wrap gap-2">
                  {enabled.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setVariantId(v.id)}
                      className={`text-[11px] uppercase tracking-[0.2em] border px-4 py-2 transition-colors ${
                        (variantId ?? enabled[0]?.id) === v.id
                          ? "border-amber text-amber"
                          : "border-border text-muted-foreground hover:border-bone hover:text-bone"
                      }`}
                    >
                      {v.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              disabled={!activeVariant}
              onClick={() => {
                if (!activeVariant || !images[0]) return;
                const item: CartItem = {
                  product_id: product.id,
                  variant_id: activeVariant.id,
                  quantity: 1,
                  title: `${product.title} — ${activeVariant.title}`,
                  price: activeVariant.price,
                  image: images[0].src,
                };
                add(item);
              }}
              className="mt-10 w-full border border-amber text-amber uppercase tracking-[0.3em] text-xs py-4 hover:bg-amber hover:text-primary-foreground transition-colors disabled:opacity-30"
            >
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
