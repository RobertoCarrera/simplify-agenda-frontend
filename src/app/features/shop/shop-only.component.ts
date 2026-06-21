import { Component, OnInit, inject, signal } from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { CommonModule } from "@angular/common";
import { TranslocoModule } from "@jsverse/transloco";
import {
  BookingPublicService,
  Product,
} from "../../services/booking-public.service";
import { applyBrandingColors } from "../../shared/branding.utils";

/**
 * Shop-only view for companies whose portal_features.show_shop = true.
 * Renders a grid of products with name, price, and an "Añadir al
 * carrito" stub. The cart itself is out of scope for this initial
 * ticket — the button logs a console message and is ready to be wired
 * up to a real cart service.
 *
 * Activated by the dispatcher (PortalCatalogDispatcherComponent) when
 * show_shop is true. Multiple modes can coexist: e.g. a company with
 * show_catalog + show_shop will see both views; the dispatcher is
 * responsible for picking the right one (today it picks the first
 * truthy flag and ignores the rest — this is intentional for the
 * initial ticket).
 */
@Component({
  selector: "app-shop-only",
  standalone: true,
  imports: [RouterLink, CommonModule, TranslocoModule],
  template: `
    @if (loading()) {
      <div class="shop-loading">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton-grid">
          <div class="skeleton skeleton-card"></div>
          <div class="skeleton skeleton-card"></div>
          <div class="skeleton skeleton-card"></div>
        </div>
      </div>
    } @else if (error()) {
      <div class="error-state">
        <div class="error-icon">⚠</div>
        <p>{{ error() }}</p>
      </div>
    } @else {
      <div class="shop-page">
        <header class="page-header">
          @if (logoUrl()) {
            <img class="company-logo" [src]="logoUrl()!" [alt]="companyName()" />
          } @else {
            <div class="company-logo-placeholder">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
            </div>
          }
          <div>
            <h1>{{ companyName() }}</h1>
            <p class="page-subtitle">Explora nuestros productos</p>
          </div>
        </header>

        <p class="count-label">
          {{ products().length }} producto{{ products().length !== 1 ? 's' : '' }} disponible{{ products().length !== 1 ? 's' : '' }}
        </p>

        @if (products().length === 0) {
          <div class="empty-state">
            <div class="empty-icon">🛍️</div>
            <p>Próximamente publicaremos nuevos productos.</p>
          </div>
        } @else {
          <div class="products-grid">
            @for (product of products(); track product.id) {
              <div class="product-card">
                <div class="product-card-top">
                  <h3 class="product-name">{{ product.name }}</h3>
                  @if (product.price != null) {
                    <span class="product-price">{{ product.price }}€</span>
                  }
                </div>
                @if (product.description) {
                  <p class="product-desc">{{ product.description }}</p>
                }
                @if (product.stock_quantity != null) {
                  <p class="product-stock" [class.low-stock]="isLowStock(product)">
                    {{ isLowStock(product) ? '¡Pocas unidades!' : 'En stock' }} ({{ product.stock_quantity }})
                  </p>
                }
                <div class="product-card-bottom">
                  <button type="button" class="btn-add" (click)="addToCart(product)">
                    Añadir al carrito
                  </button>
                </div>
              </div>
            }
          </div>
        }
      </div>
    }
  `,
  styles: [
    `
      :host { display: block; }

      .shop-loading {
        max-width: 1100px;
        margin: 0 auto;
        padding: 2rem 1rem;
      }
      .skeleton {
        background: linear-gradient(90deg, var(--color-border) 25%, var(--color-surface-hover) 50%, var(--color-border) 75%);
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
        border-radius: 0.375rem;
      }
      @keyframes shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      .skeleton-title { height: 2rem; width: 12rem; margin-bottom: 1.5rem; }
      .skeleton-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 1.5rem;
      }
      .skeleton-card { height: 12rem; border-radius: 0.75rem; }

      .error-state {
        max-width: 720px;
        margin: 0 auto;
        padding: 3rem 1rem;
        text-align: center;
        color: var(--color-text-secondary);
      }
      .error-icon { font-size: 2rem; opacity: 0.5; margin-bottom: 0.5rem; }

      .shop-page {
        max-width: 1100px;
        margin: 0 auto;
        padding: 2rem 1rem 4rem;
      }
      .page-header {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 2rem;
      }
      .page-header h1 {
        font-size: 1.75rem;
        font-weight: 700;
        margin: 0;
        color: var(--color-text);
      }
      .page-subtitle {
        font-size: 0.95rem;
        color: var(--color-text-secondary);
        margin: 0.25rem 0 0;
      }
      .company-logo {
        width: 3.5rem;
        height: 3.5rem;
        border-radius: 0.625rem;
        object-fit: contain;
        background: var(--color-surface);
        padding: 0.25rem;
        box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
        flex-shrink: 0;
      }
      .company-logo-placeholder {
        width: 3.5rem;
        height: 3.5rem;
        border-radius: 0.625rem;
        background: var(--color-surface-hover);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .company-logo-placeholder svg {
        width: 1.75rem;
        height: 1.75rem;
        color: var(--color-primary);
        opacity: 0.7;
      }
      .count-label {
        font-size: 0.875rem;
        color: var(--color-text-secondary);
        margin: 0 0 1rem;
      }

      .empty-state {
        text-align: center;
        padding: 3rem 1rem;
        color: var(--color-text-secondary);
      }
      .empty-icon { font-size: 2.5rem; margin-bottom: 0.5rem; opacity: 0.5; }

      .products-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 1.5rem;
      }

      .product-card {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 0.75rem;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        transition: all 150ms ease;
      }
      .product-card:hover {
        border-color: var(--color-primary);
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(0,0,0,0.12);
      }
      .product-card-top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.5rem;
      }
      .product-name {
        font-size: 1.1rem;
        font-weight: 600;
        margin: 0;
        color: var(--color-text);
        flex: 1;
        min-width: 0;
      }
      .product-price {
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--color-text);
        flex-shrink: 0;
      }
      .product-desc {
        font-size: 0.875rem;
        margin: 0;
        color: var(--color-text-secondary);
        line-height: 1.45;
      }
      .product-stock {
        font-size: 0.75rem;
        margin: 0;
        color: var(--color-text-secondary);
      }
      .product-stock.low-stock {
        color: #d97706;
        font-weight: 600;
      }
      .product-card-bottom {
        margin-top: auto;
        padding-top: 0.5rem;
      }
      .btn-add {
        width: 100%;
        background: var(--color-primary, #10B981);
        color: white;
        border: none;
        border-radius: 0.5rem;
        padding: 0.625rem 1rem;
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        transition: background 150ms ease;
      }
      .btn-add:hover { filter: brightness(1.1); }

      @media (max-width: 640px) {
        .shop-page { padding: 1rem 0.75rem 3rem; }
        .page-header h1 { font-size: 1.35rem; }
        .products-grid { grid-template-columns: 1fr; gap: 0.875rem; }
        .product-card { padding: 1rem; }
      }
    `,
  ],
})
export class ShopOnlyComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private bookingService = inject(BookingPublicService);

  loading = signal(true);
  error = signal<string | null>(null);

  products = signal<Product[]>([]);
  companyName = signal<string>("");
  logoUrl = signal<string | null>(null);

  ngOnInit() {
    const parentParams = this.route.parent?.snapshot.paramMap;
    const slug = parentParams?.get("slug") ?? this.route.snapshot.paramMap.get("slug") ?? "";
    if (!slug) {
      this.error.set("Falta el slug de la empresa");
      this.loading.set(false);
      return;
    }
    this.bookingService.getServices(slug).subscribe({
      next: (res) => {
        applyBrandingColors(res.company?.primary_color, res.company?.secondary_color);
        this.companyName.set(res.company?.name ?? "");
        this.logoUrl.set(res.company?.logo_url ?? null);
        this.products.set(res.products ?? []);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error || err.message || "Error al cargar los productos");
        this.loading.set(false);
      },
    });
  }

  isLowStock(product: Product): boolean {
    return (product.stock_quantity ?? 0) <= 5;
  }

  addToCart(product: Product) {
    // Stub: real cart is a future ticket. For now, log and visually confirm
    // the click so the operator can see the button is wired.
    // eslint-disable-next-line no-console
    console.log("[shop] add to cart:", product.id, product.name);
    // A real implementation would push to a CartService, update a cart
    // counter in the header, and persist to localStorage. None of that
    // exists yet.
  }
}
