import { Component, OnInit, inject, signal, computed } from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { CommonModule } from "@angular/common";
import { TranslocoModule } from "@jsverse/transloco";
import {
  BookingPublicService,
  resolvePortalFeatures,
  PortalFeatures,
  Company,
  Service,
  Product,
  ServiceVariant,
  VariantPricing,
} from "../../services/booking-public.service";
import { applyBrandingColors } from "../../shared/branding.utils";
import { StripHtmlPipe } from "../../shared/pipes/strip-html.pipe";

/**
 * Combined portal view: when the owner enables multiple portal
 * capabilities (booking + catalog + shop), the dispatcher renders ALL
 * of them on the same page as distinct sections, separated by
 * horizontal rules. The customer can:
 *
 *   1. Browse bookable services and click "Reservar" (booking flow).
 *   2. Browse the catalog of services and plans and click "Contratar"
 *      (lead flow).
 *   3. Browse the product grid and click "Añadir al carrito"
 *      (shop flow stub).
 *
 * Order is fixed: booking → catalog → shop. This mirrors the typical
 * funnel: the highest-commitment action first.
 *
 * Sections with no data are hidden automatically (zero products → no
 * shop section rendered, no services → no booking section rendered, etc.).
 *
 * The previous dispatcher picked ONE mode and hid the rest; that was
 * too restrictive for owners who want their full offering visible.
 */
@Component({
  selector: "app-portal-combined",
  standalone: true,
  imports: [RouterLink, CommonModule, TranslocoModule, StripHtmlPipe],
  template: `
    @if (loading()) {
      <div class="portal-loading">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton-grid">
          <div class="skeleton skeleton-card"></div>
          <div class="skeleton skeleton-card"></div>
          <div class="skeleton skeleton-card"></div>
        </div>
      </div>
    } @else if (loadError()) {
      <div class="error-state">
        <div class="error-icon">⚠</div>
        <p>{{ loadError() }}</p>
      </div>
    } @else {
      <div class="portal-page">
        <header class="portal-header">
          @if (company()?.logo_url) {
            <img class="company-logo" [src]="company()!.logo_url" [alt]="company()!.name" />
          } @else {
            <div class="company-logo-placeholder">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
            </div>
          }
          <div>
            <h1>{{ company()?.name }}</h1>
            <p class="portal-subtitle">{{ company()?.name }} — reserva, contrata o compra</p>
          </div>
        </header>

        @if (features().show_booking && bookableServices().length > 0) {
          <section class="portal-section">
            <h2 class="section-title">
              <i class="fas fa-calendar-check"></i>
              Reservar cita
            </h2>
            <p class="section-subtitle">Elige un servicio y un horario disponible.</p>
            <div class="services-grid">
              @for (svc of bookableServices(); track svc.id) {
                <div class="service-card">
                  <div class="service-card-top">
                    <span class="service-dot" [style.background]="svc.color || '#94a3b8'"></span>
                    <div class="service-card-info">
                      <h3 class="service-name">{{ svc.name }}</h3>
                      @if (svc.description) {
                        <p class="service-desc">{{ svc.description | stripHtml }}</p>
                      }
                    </div>
                    @if (svc.price != null) {
                      <span class="service-price">{{ svc.price }}€</span>
                    }
                  </div>
                  <div class="service-card-bottom">
                    <span class="duration-badge">{{ svc.duration_minutes }} min</span>
                    <a
                      class="btn btn-contratar"
                      [routerLink]="['/', slug(), 'reservar', svc.id]"
                    >Reservar</a>
                  </div>
                </div>
              }
            </div>
          </section>
        }

        @if (features().show_catalog && catalogServices().length > 0) {
          <section class="portal-section">
            <h2 class="section-title">
              <i class="fas fa-list-ul"></i>
              Servicios y planes
            </h2>
            <p class="section-subtitle">Contrata un servicio o un plan sin elegir horario.</p>
            <div class="services-grid">
              @for (svc of catalogServices(); track svc.id) {
                <div class="service-card">
                  <div class="service-card-top">
                    <span class="service-dot" [style.background]="svc.color || '#94a3b8'"></span>
                    <div class="service-card-info">
                      <h3 class="service-name">{{ svc.name }}</h3>
                      @if (svc.description) {
                        <p class="service-desc">{{ svc.description | stripHtml }}</p>
                      }
                    </div>
                    @if (variantOptionsFor(svc).length === 0 && svc.price != null) {
                      <span class="service-price">{{ svc.price }}€</span>
                    }
                  </div>

                  @if (variantOptionsFor(svc).length > 0) {
                    <div class="tier-list">
                      @for (tier of variantOptionsFor(svc); track tier.variantId + '::' + tier.pricing.billing_period) {
                        <button
                          type="button"
                          class="tier-row"
                          [style.border-left-color]="tier.variant.display_config?.color || 'var(--color-primary)'"
                          (click)="requestService(svc, tier)"
                        >
                          <span class="tier-name">{{ tier.variant.name }}</span>
                          <span class="tier-price">
                            <span class="tier-amount">{{ tier.pricing.base_price }}€</span>
                            <span class="tier-period" *ngIf="tier.pricing.billing_period">/ {{ periodLabel(tier.pricing.billing_period) }}</span>
                          </span>
                        </button>
                      }
                    </div>
                  }

                  <div class="service-card-bottom">
                    <span class="duration-badge">{{ svc.duration_minutes }} min · entrega estimada</span>
                    @if (variantOptionsFor(svc).length === 0) {
                      <a
                        class="btn btn-contratar"
                        [routerLink]="['/', slug(), 'contratar', svc.id]"
                      >Contratar</a>
                    }
                  </div>
                </div>
              }
            </div>
          </section>
        }

        @if (features().show_shop && products().length > 0) {
          <section class="portal-section">
            <h2 class="section-title">
              <i class="fas fa-shopping-bag"></i>
              Productos
            </h2>
            <p class="section-subtitle">Explora nuestros productos.</p>
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
          </section>
        }
      </div>
    }
  `,
  styles: [
    `
      :host { display: block; }
      .portal-loading {
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
      .skeleton-title { height: 2rem; width: 14rem; margin-bottom: 1.5rem; }
      .skeleton-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 1.5rem;
      }
      .skeleton-card { height: 10rem; border-radius: 0.75rem; }

      .error-state {
        max-width: 720px;
        margin: 0 auto;
        padding: 3rem 1rem;
        text-align: center;
        color: var(--color-text-secondary);
      }
      .error-icon { font-size: 2rem; opacity: 0.5; margin-bottom: 0.5rem; }

      .portal-page {
        max-width: 1100px;
        margin: 0 auto;
        padding: 2rem 1rem 4rem;
      }
      .portal-header {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 2rem;
      }
      .portal-header h1 {
        font-size: 1.75rem;
        font-weight: 700;
        margin: 0;
        color: var(--color-text);
      }
      .portal-subtitle {
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

      .portal-section {
        margin-bottom: 3rem;
        padding-bottom: 2rem;
        border-bottom: 1px solid var(--color-border);
      }
      .portal-section:last-child {
        border-bottom: none;
      }
      .section-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 1.25rem;
        font-weight: 700;
        margin: 0 0 0.25rem;
        color: var(--color-text);
      }
      .section-title i {
        color: var(--color-primary);
      }
      .section-subtitle {
        font-size: 0.875rem;
        color: var(--color-text-secondary);
        margin: 0 0 1.25rem;
      }

      .services-grid, .products-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 1.5rem;
      }

      .service-card, .product-card {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 0.75rem;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
        transition: all 150ms ease;
      }
      .service-card:hover, .product-card:hover {
        border-color: var(--color-primary);
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(0,0,0,0.12);
      }
      .service-card-top, .product-card-top {
        display: flex;
        align-items: flex-start;
        gap: 1rem;
      }
      .service-dot {
        width: 1rem;
        height: 1rem;
        border-radius: 50%;
        flex-shrink: 0;
        margin-top: 0.3rem;
      }
      .service-card-info, .product-card-info {
        flex: 1;
        min-width: 0;
      }
      .service-name, .product-name {
        font-size: 1.25rem;
        font-weight: 600;
        margin: 0 0 0.4rem;
        line-height: 1.2;
        color: var(--color-text);
      }
      .product-name { font-size: 1.1rem; }
      .service-desc, .product-desc {
        font-size: 0.875rem;
        margin: 0;
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        color: var(--color-text-secondary);
      }
      .product-desc {
        display: block;
        -webkit-line-clamp: 3;
      }
      .service-price, .product-price {
        font-size: 1.5rem;
        font-weight: 700;
        flex-shrink: 0;
        white-space: nowrap;
        color: var(--color-text-secondary);
      }
      .product-price { font-size: 1.25rem; }

      .tier-list {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
      }
      .tier-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.6rem 0.75rem 0.6rem 0.875rem;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-left-width: 3px;
        border-radius: 0.5rem;
        cursor: pointer;
        text-align: left;
        font: inherit;
        color: inherit;
        transition: all 150ms ease;
        width: 100%;
      }
      .tier-row:hover {
        border-color: var(--color-primary);
        background: var(--color-surface-hover);
        transform: translateX(2px);
      }
      .tier-name {
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--color-text);
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .tier-price {
        display: inline-flex;
        align-items: baseline;
        gap: 0.25rem;
        flex-shrink: 0;
      }
      .tier-amount {
        font-size: 0.95rem;
        font-weight: 700;
        color: var(--color-text);
      }
      .tier-period {
        font-size: 0.7rem;
        color: var(--color-text-secondary);
      }

      .service-card-bottom, .product-card-bottom {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        border-top: 1px solid var(--color-border);
        padding-top: 1rem;
      }
      .duration-badge {
        font-size: 0.75rem;
        font-weight: 500;
        padding: 0.125rem 0.5rem;
        border-radius: 9999px;
        background: var(--color-surface-hover);
        border: 1px solid var(--color-border);
        color: var(--color-text-secondary);
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
      .btn-contratar, .btn-add {
        font-size: 0.875rem;
        font-weight: 600;
        padding: 0.5rem 1rem;
        border-radius: 0.5rem;
        text-decoration: none;
        white-space: nowrap;
        transition: background 150ms ease;
        background: var(--color-primary, #10B981);
        color: white;
        border: none;
        cursor: pointer;
      }
      .btn-contratar:hover, .btn-add:hover { filter: brightness(1.1); }

      @media (max-width: 640px) {
        .portal-page { padding: 1rem 0.75rem 3rem; }
        .portal-header h1 { font-size: 1.35rem; }
        .services-grid, .products-grid { grid-template-columns: 1fr; gap: 0.875rem; }
        .service-card, .product-card { padding: 1rem; }
      }
    `,
  ],
})
export class PortalCombinedComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private bookingService = inject(BookingPublicService);

  loading = signal(true);
  loadError = signal<string | null>(null);

  company = signal<Company | null>(null);
  services = signal<Service[]>([]);
  products = signal<Product[]>([]);
  features = signal<PortalFeatures>({
    show_booking: true,
    show_catalog: false,
    show_shop: false,
    show_professionals: true,
    show_availability: true,
  });

  slug = signal<string>("");

  /**
   * Services visible in the booking section: only those with variants
   * OR a base_price. The BFF already returns only services with
   * is_public + is_bookable + is_active = true, so this is the
   * same set the booking wizard would see.
   */
  bookableServices = computed<Service[]>(() => this.services());

  /**
   * Services visible in the catalog section: any service (the catalog
   * is for display; tiers, if present, drive the CTA). When a service
   * has variants, the tier list is rendered and the price pill is
   * hidden (the price is shown per tier).
   */
  catalogServices = computed<Service[]>(() => this.services());

  ngOnInit() {
    const parentParams = this.route.parent?.snapshot.paramMap;
    const slug = parentParams?.get("slug") ?? this.route.snapshot.paramMap.get("slug") ?? "";
    this.slug.set(slug);
    if (!slug) {
      this.loadError.set("Falta el slug de la empresa");
      this.loading.set(false);
      return;
    }
    this.bookingService.getServices(slug).subscribe({
      next: (res) => {
        applyBrandingColors(res.company?.primary_color, res.company?.secondary_color);
        this.company.set(res.company ?? null);
        this.services.set(res.services ?? []);
        this.products.set(res.products ?? []);
        this.features.set(resolvePortalFeatures(res.company ?? null));
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(err?.error?.error || err.message || "Error al cargar el portal");
        this.loading.set(false);
      },
    });
  }

  variantOptionsFor(svc: Service): Array<{ variant: ServiceVariant; variantId: string; pricing: VariantPricing }> {
    if (!svc.variants) return [];
    const opts: Array<{ variant: ServiceVariant; variantId: string; pricing: VariantPricing }> = [];
    for (const v of svc.variants) {
      if (!v.pricing || v.pricing.length === 0) continue;
      for (const p of v.pricing) {
        opts.push({ variant: v, variantId: v.id, pricing: p });
      }
    }
    return opts;
  }

  periodLabel(period: string): string {
    const labels: Record<string, string> = {
      monthly: "mes",
      annual: "año",
      one_time: "pago único",
      session: "sesión",
      custom: "",
    };
    return labels[period] || period;
  }

  isLowStock(product: Product): boolean {
    return (product.stock_quantity ?? 0) <= 5;
  }

  addToCart(product: Product) {
    // eslint-disable-next-line no-console
    console.log("[portal-combined] add to cart:", product.id, product.name);
  }

  requestService(svc: Service, tier: { variantId: string; pricing: VariantPricing }) {
    this.router.navigate(["/", this.slug(), "contratar", svc.id], {
      queryParams: {
        variant_id: tier.variantId,
        variant_billing_period: tier.pricing.billing_period,
        variant_base_price: String(tier.pricing.base_price),
      },
    });
  }
}
