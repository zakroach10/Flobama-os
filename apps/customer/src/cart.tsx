import { createContext, useContext, useMemo, useState } from "react";
import type { Merch } from "./api";

export type CartLine = { product: Merch; quantity: number };

type CartValue = {
  lines: CartLine[];
  count: number;
  totalCents: number;
  add: (product: Merch) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const value = useMemo<CartValue>(() => {
    const count = lines.reduce((sum, line) => sum + line.quantity, 0);
    const totalCents = lines.reduce((sum, line) => sum + line.product.priceCents * line.quantity, 0);
    return {
      lines,
      count,
      totalCents,
      add(product) {
        setLines((current) => {
          const existing = current.find((line) => line.product.id === product.id);
          if (!existing) return [...current, { product, quantity: 1 }];
          return current.map((line) =>
            line.product.id === product.id ? { ...line, quantity: Math.min(8, line.quantity + 1) } : line,
          );
        });
      },
      setQuantity(productId, quantity) {
        setLines((current) =>
          current
            .map((line) => (line.product.id === productId ? { ...line, quantity } : line))
            .filter((line) => line.quantity > 0),
        );
      },
      clear() {
        setLines([]);
      },
    };
  }, [lines]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("Cart is unavailable.");
  return value;
}
