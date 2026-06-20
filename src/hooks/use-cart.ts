import { useState, useEffect } from "react";

export type CartItem = {
  product_id: string;
  variant_id: number;
  quantity: number;
  title: string;
  price: number;
  image: string;
};

const CART_KEY = "rudra_cart_v1";

export function useCart() {
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
