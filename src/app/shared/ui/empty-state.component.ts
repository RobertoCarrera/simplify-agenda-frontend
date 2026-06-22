import { Component, Input } from "@angular/core";
import { CommonModule } from "@angular/common";

/**
 * Reusable empty-state block. Used wherever a screen can render with
 * no items: the cart (cart-screen), the shop when a company has no
 * products, the booking flow when there are no professionals, etc.
 *
 * Variants:
 *   - 'cart'     — shopping cart icon, copy about adding products.
 *   - 'shop'     — store icon, copy about no products available.
 *   - 'generic'  — no icon, generic message. Use when the meaning
 *                  doesn't fit the other two.
 *
 * Optional `cta` block: a primary call-to-action (link or button) that
 * gives the customer a way out of the empty state. Without a CTA the
 * empty state is a dead end, which is bad UX.
 *
 * The CTA is projected via `<ng-content>`. The consumer provides the
 * `<a routerLink=...>` or `<button (click)=...>` element directly, so
 * this component does not need to import RouterLink itself.
 */
@Component({
  selector: "app-empty-state",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="empty-state" role="status" aria-live="polite">
      @if (variant !== 'generic') {
        <div class="empty-icon" aria-hidden="true">
          @switch (variant) {
            @case ('cart') {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="9" cy="21" r="1"></circle>
                <circle cx="20" cy="21" r="1"></circle>
                <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"></path>
              </svg>
            }
            @case ('shop') {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <path d="M16 10a4 4 0 0 1-8 0"></path>
              </svg>
            }
          }
        </div>
      }
      <p class="empty-title">{{ title }}</p>
      @if (description) {
        <p class="empty-description">{{ description }}</p>
      }
      <ng-content></ng-content>
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .empty-state {
        text-align: center;
        padding: 3rem 1rem;
        color: var(--color-text-secondary);
      }
      .empty-icon {
        margin: 0 auto 0.5rem;
        width: 3.5rem;
        height: 3.5rem;
        opacity: 0.4;
        color: var(--color-text-secondary);
      }
      .empty-icon svg { width: 100%; height: 100%; display: block; }
      .empty-title {
        font-size: 1rem;
        font-weight: 500;
        margin: 0.5rem 0 0;
        color: var(--color-text);
      }
      .empty-description {
        font-size: 0.9375rem;
        max-width: 28rem;
        margin: 0.5rem auto 0;
        line-height: 1.5;
      }
      @media (max-width: 640px) {
        .empty-state { padding: 2rem 0.75rem; }
        .empty-icon { width: 2.75rem; height: 2.75rem; }
      }
    `,
  ],
})
export class EmptyStateComponent {
  /** Visual variant. 'generic' hides the icon. */
  @Input() variant: "cart" | "shop" | "generic" = "generic";
  /** Main message. Required. */
  @Input() title = "";
  /** Optional secondary line. */
  @Input() description?: string;
}
