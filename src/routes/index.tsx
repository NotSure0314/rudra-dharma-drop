import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  getProducts,
  createOrder,
  joinWaitlist,
  type ProductDTO,
} from "@/lib/printify.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rudra — Sacred Streetwear from the Cremation Ground" },
      {
        name: "description",
        content:
          "Dark Hindu-inspired streetwear rooted in Shiva, the Bhagavad Gita, and Sanskrit scripture. Heavyweight tees, ritual essentials.",
      },
      { property: "og:title", content: "Rudra — Sacred Streetwear" },
      {
        property: "og:description",
        content:
          "Devotion as defiance. Heavyweight garments inscribed with Sanskrit fire.",
      },
      { property: "og:type", content: "website" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;700&display=swap",
      },
    ],
  }),
  component: RudraStorefront,
});

type CartItem = {
  product_id: string;
  variant_id: number;
  quantity: number;
  title: string;
  price: number;
  image: string;
};

const CART_KEY = "rudra_cart_v1";

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
}

function useCart() {
  const [cart, setCart] = useState<CartItem[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (raw) setCart(JSON.parse(raw));
    } catch {}
  }, []);
  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart]);
  return {
    cart,
    add: (item: CartItem) =>
      setCart((c) => {
        const i = c.findIndex(
          (x) => x.product_id === item.product_id && x.variant_id === item.variant_id
        );
        if (i >= 0) {
          const next = [...c];
          next[i] = { ...next[i], quantity: next[i].quantity + item.quantity };
          return next;
        }
        return [...c, item];
      }),
    remove: (idx: number) => setCart((c) => c.filter((_, i) => i !== idx)),
    clear: () => setCart([]),
  };
}

function RudraStorefront() {
  useReveal();
  const fetchProducts = useServerFn(getProducts);
  const { data, isLoading } = useQuery({
    queryKey: ["printify-products", "27806604"],
    queryFn: () => fetchProducts(),
    staleTime: 0,
    refetchOnMount: "always",
  });
  const products = data?.products ?? [];

  const { cart, add, remove, clear } = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);

  const subtotal = useMemo(
    () => cart.reduce((s, i) => s + i.price * i.quantity, 0),
    [cart]
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav cartCount={cart.length} onCart={() => setCartOpen(true)} />
      <Hero />
      <Manifesto />
      <Collection products={products} isLoading={isLoading} onAdd={add} />
      <Lore />
      <InnerCircle />
      <Footer />

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        subtotal={subtotal}
        onRemove={remove}
        onCheckout={() => {
          setCartOpen(false);
          setCheckout(true);
        }}
      />
      {checkout && (
        <CheckoutModal
          cart={cart}
          subtotal={subtotal}
          onClose={() => setCheckout(false)}
          onComplete={() => {
            clear();
            setCheckout(false);
          }}
        />
      )}
    </div>
  );
}

function Nav({ cartCount, onCart }: { cartCount: number; onCart: () => void }) {
  return (
    <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-md bg-background/70 border-b border-border">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
        <a href="#top" className="font-display text-xl tracking-[0.3em] text-bone">
          ॐ RUDRA
        </a>
        <nav className="hidden md:flex gap-10 text-xs uppercase tracking-[0.25em] text-muted-foreground">
          <a href="#collection" className="hover:text-amber transition-colors">Collection</a>
          <a href="#lore" className="hover:text-amber transition-colors">Lore</a>
          <a href="#circle" className="hover:text-amber transition-colors">Inner Circle</a>
        </nav>
        <button
          onClick={onCart}
          className="text-xs uppercase tracking-[0.25em] text-bone hover:text-amber transition-colors"
        >
          Cart [{cartCount}]
        </button>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="relative min-h-screen flex items-center justify-center overflow-hidden pt-24">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(200,98,26,0.18),transparent_60%)]" />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-background to-transparent" />
      </div>
      <div className="relative z-10 text-center px-6 max-w-4xl">
        <p className="text-amber text-xs uppercase tracking-[0.5em] mb-8 reveal">
          ॥ नमः शिवाय ॥
        </p>
        <h1 className="font-display text-5xl md:text-7xl lg:text-8xl leading-[1.05] text-bone reveal text-balance">
          Devotion <span className="italic text-amber">as</span> Defiance
        </h1>
        <p className="mt-8 text-base md:text-lg text-muted-foreground max-w-xl mx-auto reveal text-balance">
          Sacred streetwear from the cremation ground. Heavyweight garments
          inscribed with Sanskrit fire, worn by those who burn through illusion.
        </p>
        <div className="mt-12 flex justify-center reveal">
          <a
            href="#collection"
            className="group relative inline-flex items-center gap-3 px-10 py-4 border border-amber text-amber uppercase tracking-[0.3em] text-xs hover:bg-amber hover:text-primary-foreground transition-all"
          >
            Enter the Collection
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </a>
        </div>
      </div>
    </section>
  );
}

function Manifesto() {
  return (
    <section className="py-32 px-6">
      <div className="max-w-3xl mx-auto text-center reveal">
        <div className="flex items-center justify-center gap-6 mb-10 divider-om">
          <span className="text-amber font-display text-2xl">त्र्यम्बकम्</span>
        </div>
        <p className="font-display text-2xl md:text-3xl leading-relaxed text-bone text-balance">
          "I am become Death, the destroyer of worlds."
        </p>
        <p className="mt-6 text-sm uppercase tracking-[0.3em] text-muted-foreground">
          — Bhagavad Gita 11.32
        </p>
        <p className="mt-12 text-muted-foreground leading-loose text-balance">
          Rudra is not fashion. It is iconography — Shiva's third eye opened on
          heavyweight cotton. Each piece a mantra, each thread a sacred ash mark.
          For those who do not seek comfort, but consciousness.
        </p>
      </div>
    </section>
  );
}

function Collection({
  products,
  isLoading,
  onAdd,
}: {
  products: ProductDTO[];
  isLoading: boolean;
  onAdd: (i: CartItem) => void;
}) {
  return (
    <section id="collection" className="py-24 px-6 border-t border-border">
      <div className="max-w-7xl mx-auto">
        <div className="mb-16 reveal">
          <p className="text-amber text-xs uppercase tracking-[0.4em] mb-4">
            The Collection
          </p>
          <h2 className="font-display text-4xl md:text-5xl text-bone">
            Garments of the Ash
          </h2>
        </div>

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[4/5] bg-secondary" />
                <div className="h-4 bg-secondary mt-6 w-2/3" />
                <div className="h-3 bg-secondary mt-3 w-1/3" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && products.length === 0 && (
          <div className="text-center py-24 border border-dashed border-border text-muted-foreground reveal">
            <p className="font-display text-2xl text-bone mb-3">
              The forge is cooling.
            </p>
            <p className="text-sm">
              No products were returned by the Printify API for this shop yet.
            </p>
          </div>
        )}

        {!isLoading && products.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} onAdd={onAdd} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ProductCard({
  product,
  onAdd,
}: {
  product: ProductDTO;
  onAdd: (i: CartItem) => void;
}) {
  const enabled = product.variants.filter((v) => v.is_enabled);
  const [variantId, setVariantId] = useState<number | null>(enabled[0]?.id ?? null);
  const variant = enabled.find((v) => v.id === variantId) ?? enabled[0];
  const img = product.images[0]?.src;

  return (
    <article className="group">
      <div className="relative aspect-[4/5] overflow-hidden bg-secondary">
        {img ? (
          <img
            src={img}
            alt={product.title}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground font-display text-3xl">
            ॐ
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
      </div>
      <div className="mt-6 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-lg text-bone">{product.title}</h3>
          {variant && (
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mt-2">
              ${(variant.price / 100).toFixed(2)}
            </p>
          )}
        </div>
      </div>
      {enabled.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {enabled.slice(0, 6).map((v) => (
            <button
              key={v.id}
              onClick={() => setVariantId(v.id)}
              className={`text-[10px] uppercase tracking-[0.2em] border px-3 py-1.5 transition-colors ${
                variantId === v.id
                  ? "border-amber text-amber"
                  : "border-border text-muted-foreground hover:border-bone hover:text-bone"
              }`}
            >
              {v.title}
            </button>
          ))}
        </div>
      )}
      <button
        disabled={!variant}
        onClick={() =>
          variant &&
          onAdd({
            product_id: product.id,
            variant_id: variant.id,
            quantity: 1,
            title: `${product.title} — ${variant.title}`,
            price: variant.price,
            image: img ?? "",
          })
        }
        className="mt-6 w-full border border-border text-xs uppercase tracking-[0.3em] py-3 text-bone hover:border-amber hover:text-amber transition-colors disabled:opacity-30"
      >
        Add to Cart
      </button>
    </article>
  );
}

function Lore() {
  const blocks = [
    {
      sanskrit: "त्र्यम्बकम्",
      title: "Third Eye",
      body: "Shiva's gaze burns through the veil of Maya. To wear Rudra is to refuse the comfortable lie.",
    },
    {
      sanskrit: "तांडव",
      title: "Tandava",
      body: "The cosmic dance of dissolution. Every thread we weave acknowledges that all forms return to ash.",
    },
    {
      sanskrit: "श्मशान",
      title: "Shmashana",
      body: "The cremation ground is the aghori's temple. Sacred is not the opposite of dark — it is born of it.",
    },
  ];
  return (
    <section id="lore" className="py-32 px-6 border-t border-border">
      <div className="max-w-6xl mx-auto">
        <div className="mb-20 reveal text-center">
          <p className="text-amber text-xs uppercase tracking-[0.4em] mb-4">
            The Lore
          </p>
          <h2 className="font-display text-4xl md:text-5xl text-bone text-balance">
            Scripture in Heavyweight Cotton
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-16">
          {blocks.map((b) => (
            <div key={b.title} className="reveal">
              <p className="font-display text-3xl text-amber mb-6">{b.sanskrit}</p>
              <h3 className="text-bone uppercase tracking-[0.25em] text-sm mb-4">
                {b.title}
              </h3>
              <p className="text-muted-foreground leading-loose text-sm">{b.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function InnerCircle() {
  const join = useServerFn(joinWaitlist);
  const m = useMutation({
    mutationFn: (email: string) => join({ data: { email, source: "inner_circle" } }),
  });
  const [email, setEmail] = useState("");
  return (
    <section id="circle" className="py-32 px-6 border-t border-border">
      <div className="max-w-2xl mx-auto text-center reveal">
        <p className="text-amber text-xs uppercase tracking-[0.4em] mb-4">
          Inner Circle
        </p>
        <h2 className="font-display text-4xl md:text-5xl text-bone mb-6 text-balance">
          First call. Sacred drops.
        </h2>
        <p className="text-muted-foreground mb-10">
          New mantras, limited editions, and ritual essentials reach the circle
          before the world.
        </p>
        {m.isSuccess ? (
          <p className="text-amber font-display text-2xl">
            ॥ Welcome to the circle ॥
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (email) m.mutate(email);
            }}
            className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.name@temple.com"
              className="flex-1 bg-transparent border border-border focus:border-amber outline-none px-4 py-3 text-bone text-sm placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={m.isPending}
              className="border border-amber text-amber px-8 py-3 text-xs uppercase tracking-[0.3em] hover:bg-amber hover:text-primary-foreground transition-colors disabled:opacity-50"
            >
              {m.isPending ? "..." : "Join"}
            </button>
          </form>
        )}
        {m.isError && (
          <p className="text-destructive text-xs mt-4">Something went wrong.</p>
        )}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border py-16 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-8 items-center">
        <p className="font-display text-amber tracking-[0.3em]">ॐ RUDRA</p>
        <p className="text-xs text-muted-foreground uppercase tracking-[0.2em]">
          ॥ Made with reverence ॥ Printed on demand
        </p>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Rudra
        </p>
      </div>
    </footer>
  );
}

function CartDrawer({
  open,
  onClose,
  cart,
  subtotal,
  onRemove,
  onCheckout,
}: {
  open: boolean;
  onClose: () => void;
  cart: CartItem[];
  subtotal: number;
  onRemove: (i: number) => void;
  onCheckout: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex">
      <div className="flex-1 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <aside className="w-full max-w-md bg-card border-l border-border flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <h3 className="font-display text-xl text-bone tracking-[0.2em]">CART</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-bone">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {cart.length === 0 && (
            <p className="text-muted-foreground text-sm py-12 text-center">
              The vessel is empty.
            </p>
          )}
          {cart.map((it, i) => (
            <div key={i} className="flex gap-4 border-b border-border pb-4">
              {it.image && (
                <img src={it.image} alt="" className="w-16 h-20 object-cover" />
              )}
              <div className="flex-1">
                <p className="text-sm text-bone">{it.title}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Qty {it.quantity} · ${((it.price * it.quantity) / 100).toFixed(2)}
                </p>
              </div>
              <button
                onClick={() => onRemove(i)}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <div className="border-t border-border px-6 py-5 space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground uppercase tracking-[0.2em]">
              Subtotal
            </span>
            <span className="text-bone">${(subtotal / 100).toFixed(2)}</span>
          </div>
          <button
            disabled={cart.length === 0}
            onClick={onCheckout}
            className="w-full bg-amber text-primary-foreground py-3 uppercase tracking-[0.3em] text-xs hover:bg-amber/90 disabled:opacity-30 transition-colors"
          >
            Checkout
          </button>
        </div>
      </aside>
    </div>
  );
}

function CheckoutModal({
  cart,
  subtotal,
  onClose,
  onComplete,
}: {
  cart: CartItem[];
  subtotal: number;
  onClose: () => void;
  onComplete: () => void;
}) {
  const submit = useServerFn(createOrder);
  const m = useMutation({
    mutationFn: (payload: any) => submit({ data: payload }),
  });
  const [form, setForm] = useState({
    email: "",
    name: "",
    line1: "",
    line2: "",
    city: "",
    region: "",
    postal_code: "",
    country: "US",
    phone: "",
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    m.mutate(
      {
        email: form.email,
        name: form.name,
        address: {
          line1: form.line1,
          line2: form.line2,
          city: form.city,
          region: form.region,
          postal_code: form.postal_code,
          country: form.country,
          phone: form.phone,
        },
        items: cart.map((i) => ({
          product_id: i.product_id,
          variant_id: i.variant_id,
          quantity: i.quantity,
          title: i.title,
          price: i.price,
        })),
      },
      { onSuccess: () => setTimeout(onComplete, 2400) }
    );
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-background/90 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-card border border-border max-w-lg w-full p-8 my-8">
        <div className="flex justify-between items-start mb-8">
          <div>
            <p className="text-amber text-xs uppercase tracking-[0.3em] mb-2">
              Final Rite
            </p>
            <h3 className="font-display text-2xl text-bone">Complete your offering</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-bone">
            ✕
          </button>
        </div>

        {m.isSuccess ? (
          <div className="text-center py-12">
            <p className="font-display text-4xl text-amber mb-4">॥ ॐ ॥</p>
            <p className="text-bone">Your order has been received.</p>
            <p className="text-muted-foreground text-xs mt-2">
              Order #{((m.data as any)?.orderId ?? "").slice(0, 8)}
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            {[
              ["name", "Name"],
              ["email", "Email"],
              ["line1", "Address"],
              ["line2", "Address line 2 (optional)"],
              ["city", "City"],
              ["region", "State / Region"],
              ["postal_code", "Postal code"],
              ["country", "Country (2-letter)"],
              ["phone", "Phone (optional)"],
            ].map(([k, label]) => (
              <input
                key={k}
                required={!["line2", "phone", "region"].includes(k)}
                type={k === "email" ? "email" : "text"}
                placeholder={label}
                value={(form as any)[k]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                className="w-full bg-input/40 border border-border focus:border-amber outline-none px-4 py-3 text-bone text-sm placeholder:text-muted-foreground"
              />
            ))}
            <div className="flex justify-between text-sm pt-4 border-t border-border">
              <span className="text-muted-foreground uppercase tracking-[0.2em]">
                Total
              </span>
              <span className="text-bone">${(subtotal / 100).toFixed(2)}</span>
            </div>
            {m.isError && (
              <p className="text-destructive text-xs">
                {(m.error as Error)?.message ?? "Order failed"}
              </p>
            )}
            <button
              type="submit"
              disabled={m.isPending}
              className="w-full bg-amber text-primary-foreground py-3 uppercase tracking-[0.3em] text-xs hover:bg-amber/90 disabled:opacity-50 transition-colors"
            >
              {m.isPending ? "Sealing..." : "Place Order"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
