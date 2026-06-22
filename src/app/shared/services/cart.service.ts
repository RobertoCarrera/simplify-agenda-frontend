import { Injectable, signal, computed, effect } from "@angular/core";
import { Product } from "../../services/booking-public.service";

/**
 * Single-line item as stored in the cart. We persist enough to render
 * the cart page (name, price, image) without re-querying the BFF, but
 * we keep the live product id so the checkout step can validate.
 */
export interface CartItem {
  productId: string;
  name: string;
  price: number | null;
  quantity: number;
  addedAt: number; // epoch ms, used for LRU eviction if the cart grows huge
}

const STORAGE_KEY = "simplifica_cart_v1";
const MAX_ITEMS = 50; // hard cap to prevent runaway localStorage

@Injectable({ providedIn: "root" })
export class CartService {
  private items = signal<CartItem[]>(this.loadFromStorage());

  /** Total number of items across all lines (sum of quantities). */
  itemCount = computed(() =>
    this.items().reduce((sum, item) => sum + item.quantity, 0),
  );

  /** Number of distinct product lines. */
  distinctCount = computed(() => this.items().length);

  /** Sum of (price * quantity) across the cart, in euros. */
  total = computed(() =>
    this.items().reduce((sum, item) => {
      if (item.price == null) return sum;
      return sum + item.price * item.quantity;
    }, 0),
  );

  constructor() {
    // Persist on every change. Effect is local to the service (no
    // zone traversal needed because signals are reactive).
    effect(() => {
      const data = this.items();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {
        // localStorage may be unavailable (private mode, quota exceeded).
        // The cart still works in memory for the current session.
      }
    });
  }

  private loadFromStorage(): CartItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      // Defensive: drop items that don't look right (legacy data, manual
      // edits, etc.). Real validation happens at checkout.
      return parsed.filter(
        (it: any) =>
          it &&
          typeof it.productId === "string" &&
          typeof it.name === "string" &&
          typeof it.quantity === "number" &&
          it.quantity > 0,
      );
    } catch {
      return [];
    }
  }

  /** Add one unit of a product. No-op if it's already at MAX_ITEMS lines. */
  add(product: Product): void {
    if (this.items().length >= MAX_ITEMS && !this.has(product.id)) {
      // Soft cap: don't add new lines past MAX, but bumping an existing
      // line is always allowed.
      return;
    }
    this.items.update((current) => {
      const existing = current.find((it) => it.productId === product.id);
      if (existing) {
        return current.map((it) =>
          it.productId === product.id
            ? { ...it, quantity: it.quantity + 1 }
            : it,
        );
      }
      return [
        ...current,
        {
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          addedAt: Date.now(),
        },
      ];
    });
  }

  has(productId: string): boolean {
    return this.items().some((it) => it.productId === productId);
  }

  quantityOf(productId: string): number {
    return (
      this.items().find((it) => it.productId === productId)?.quantity ?? 0
    );
  }

  setQuantity(productId: string, quantity: number): void {
    if (quantity <= 0) {
      this.remove(productId);
      return;
    }
    this.items.update((current) =>
      current.map((it) =>
        it.productId === productId ? { ...it, quantity } : it,
      ),
    );
  }

  remove(productId: string): void {
    this.items.update((current) =>
      current.filter((it) => it.productId !== productId),
    );
  }

  clear(): void {
    this.items.set([]);
  }

  /** Snapshot for the future checkout endpoint. */
  snapshot(): { items: CartItem[]; total: number; itemCount: number } {
    return {
      items: this.items(),
      total: this.total(),
      itemCount: this.itemCount(),
    };
  }
}
