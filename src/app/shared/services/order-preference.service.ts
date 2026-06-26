import { Injectable } from "@angular/core";

/**
 * Persists the customer's preferred display order for the items shown
 * in the agenda portal. Per-device (localStorage), per-company, and
 * per-section (booking services, catalog services, products). The
 * order is stored as an array of item ids; the agenda renders items
 * in the saved order, falling back to the backend's natural order
 * for any new items.
 *
 * When the customer later wants to make this a real CMS, this
 * service is the single swap point — replace the localStorage calls
 * with HTTP calls to the BFF, and the UI code stays the same.
 *
 * Storage key shape: `simplifica:order:{slug}:{section}` where
 * section is one of "booking" | "catalog" | "shop".
 */
export type OrderSection = "booking" | "catalog" | "shop";

const STORAGE_PREFIX = "simplifica:order:";

/**
 * Apply a saved order to a list of items. Items whose ids are in
 * `savedOrder` come first in that order. Items NOT in `savedOrder`
 * keep their natural position (the order they came from the backend),
 * appended after the saved ones. Items in `savedOrder` but missing
 * from `items` are silently ignored.
 *
 * Stable, O(n). Pure function.
 */
export function applySavedOrder<T extends { id: string }>(
  items: readonly T[],
  savedOrder: readonly string[] | null,
): T[] {
  if (!savedOrder || savedOrder.length === 0) {
    return items.slice();
  }
  const byId = new Map<string, T>(items.map((it) => [it.id, it]));
  const result: T[] = [];
  const seen = new Set<string>();
  for (const id of savedOrder) {
    const it = byId.get(id);
    if (it && !seen.has(id)) {
      result.push(it);
      seen.add(id);
    }
  }
  // Append items not in the saved order, in their original order.
  for (const it of items) {
    if (!seen.has(it.id)) {
      result.push(it);
      seen.add(it.id);
    }
  }
  return result;
}

@Injectable({ providedIn: "root" })
export class OrderPreferenceService {
  /**
   * Read the saved order for a (slug, section) pair. Returns null
   * if nothing is saved or if localStorage is unavailable
   * (SSR, private browsing with quota exceeded, etc.).
   */
  getOrder(slug: string, section: OrderSection): string[] | null {
    if (typeof localStorage === "undefined") return null;
    try {
      const raw = localStorage.getItem(this.key(slug, section));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      // Sanitize: only strings, no nulls, no numbers, etc.
      return parsed.filter((x): x is string => typeof x === "string");
    } catch {
      return null;
    }
  }

  /**
   * Save the order for a (slug, section) pair. The order is just an
   * array of item ids — the caller (typically the drag-and-drop UI)
   * decides what the new order should be.
   */
  setOrder(slug: string, section: OrderSection, ids: readonly string[]): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(this.key(slug, section), JSON.stringify(ids));
    } catch {
      // Quota exceeded or storage disabled — silently ignore. The
      // drag-and-drop UX still works for the current session.
    }
  }

  /**
   * Clear the saved order for a (slug, section) pair, returning the
   * agenda to the backend's natural ordering.
   */
  reset(slug: string, section: OrderSection): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.removeItem(this.key(slug, section));
    } catch {
      // ignore
    }
  }

  private key(slug: string, section: OrderSection): string {
    return `${STORAGE_PREFIX}${slug}:${section}`;
  }
}
