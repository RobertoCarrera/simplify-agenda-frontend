import { Component, OnInit, inject, signal, computed } from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { TranslocoModule } from "@jsverse/transloco";
import { CommonModule } from "@angular/common";
import {
  BookingPublicService,
  Company,
  Service,
  ServiceVariant,
  VariantPricing,
} from "../../services/booking-public.service";
import { applyBrandingColors } from "../../shared/branding.utils";
import { StripHtmlPipe } from "../../shared/pipes/strip-html.pipe";
import { EmptyStateComponent } from "../../shared/ui/empty-state.component";

/**
 * Catalog-only view for companies whose portal_features.show_catalog = true
 * AND show_booking = false. This is the agency / shop mode: the customer
 * browses services and tiers, picks one, and "Contrata" — they do NOT book
 * a slot, do NOT choose a professional, and do NOT see a calendar.
 *
 * The component is a slimmer cousin of CatalogComponent: it deliberately
 * drops the professionals tab, the duration tab, the sort dropdown, the
 * per-professional filtering, and the availability fetch. The goal is
 * "browse → request" in as few clicks as possible.
 *
 * The contract screen is intentionally NOT implemented here — that is the
 * next ticket. For now, "Contratar" navigates to a placeholder /contratar
 * route that the future checkout/tienda work will own.
 */
@Component({
  selector: "app-catalog-only",
  standalone: true,
  imports: [RouterLink, TranslocoModule, CommonModule, StripHtmlPipe, EmptyStateComponent],
  template: `
    @if (loading()) {
      <div class="catalog-loading">
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
        <h2>{{ "errors.companyNotFound" | transloco }}</h2>
        <p>{{ error() }}</p>
      </div>
    } @else {
      <div class="catalog-page">
        <header class="page-header">
          @if (company()?.logo_url) {
            <img class="company-logo" [src]="company()!.logo_url" [alt]="company()?.name" />
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
            <p class="page-subtitle">Descubre nuestros servicios y planes</p>
          </div>
        </header>

        <p class="count-label">
          {{ services().length }} servicio{{ services().length !== 1 ? 's' : '' }} disponible{{ services().length !== 1 ? 's' : '' }}
        </p>

        @if (services().length === 0) {
          <app-empty-state
            variant="shop"
            title="Aún no hay servicios disponibles."
            [description]="company()?.name ? 'Vuelve pronto a ver el catálogo de ' + company()!.name + '.' : undefined"
          />
        } @else {
          <div class="services-grid">
            @for (svc of services(); track svc.id) {
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
        }
      </div>
    }
  `,
  styles: [
    `
      :host { display: block; }

      /* ── Loading skeleton ── */
      .catalog-loading {
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
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 1.5rem;
      }
      .skeleton-card { height: 12rem; border-radius: 0.75rem; }

      /* ── Error ── */
      .error-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 50vh;
        text-align: center;
        padding: 2rem;
        gap: 1rem;
      }
      .error-icon { font-size: 3rem; opacity: 0.5; }

      /* ── Page ── */
      .catalog-page {
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

      /* ── Grid ── */
      .services-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 1.5rem;
      }

      /* ── Card ── */
      .service-card {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 0.75rem;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
        transition: all 150ms ease;
      }
      .service-card:hover {
        border-color: var(--color-primary);
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(0,0,0,0.12);
      }
      .service-card-top { display: flex; align-items: flex-start; gap: 1rem; }
      .service-dot { width: 1rem; height: 1rem; border-radius: 50%; flex-shrink: 0; margin-top: 0.3rem; }
      .service-card-info { flex: 1; min-width: 0; }
      .service-name { font-size: 1.25rem; font-weight: 600; margin: 0 0 0.4rem; line-height: 1.2; color: var(--color-text); }
      .service-desc {
        font-size: 0.875rem;
        margin: 0;
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        color: var(--color-text-secondary);
      }
      .service-price {
        font-size: 1.5rem;
        font-weight: 700;
        flex-shrink: 0;
        white-space: nowrap;
        color: var(--color-text-secondary);
      }

      /* ── Tier list ── */
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

      /* ── Bottom row ── */
      .service-card-bottom {
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
      .btn-contratar {
        font-size: 0.875rem;
        font-weight: 600;
        padding: 0.5rem 1rem;
        border-radius: 0.5rem;
        text-decoration: none;
        white-space: nowrap;
        transition: background-color 150ms ease;
        background: var(--color-primary);
        color: var(--color-primary-text);
      }
      .btn-contratar:hover { background: var(--color-primary-hover); }

      /* ── Mobile ── */
      @media (max-width: 640px) {
        .catalog-page { padding: 1rem 0.75rem 3rem; }
        .page-header h1 { font-size: 1.35rem; }
        .services-grid { grid-template-columns: 1fr; gap: 0.875rem; }
        .service-card { width: 100%; padding: 1rem; }
        .service-card-bottom { flex-wrap: wrap; gap: 0.5rem; }
        .service-card-info { min-width: 0; }
      }
    `,
  ],
})
export class CatalogOnlyComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private bookingService = inject(BookingPublicService);

  slug = signal<string>("");
  company = signal<Company | null>(null);
  services = signal<Service[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  ngOnInit() {
    const parentParams = this.route.parent?.snapshot.paramMap;
    const slug = parentParams?.get("slug") ?? this.route.snapshot.paramMap.get("slug") ?? "";
    if (!slug) {
      this.error.set("No se ha especificado una empresa");
      this.loading.set(false);
      return;
    }
    this.slug.set(slug);
    this.loadData(slug);
  }

  private loadData(slug: string) {
    this.loading.set(true);
    this.error.set(null);
    this.bookingService.getServices(slug).subscribe({
      next: (res) => {
        this.company.set(res.company);
        applyBrandingColors(res.company?.primary_color, res.company?.secondary_color);
        this.services.set(res.services);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || "Error al cargar los servicios");
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

  periodLabel(period: VariantPricing["billing_period"]): string {
    const labels: Record<VariantPricing["billing_period"], string> = {
      monthly: "mes",
      annual: "año",
      one_time: "pago único",
      session: "sesión",
      custom: "",
    };
    return labels[period] || period;
  }

  /**
   * Click handler for a tier row. For now it just navigates to the placeholder
   * /contratar route with the variant pre-selected. The future checkout work
   * (a.k.a. the "tienda" / contract flow) will own that screen.
   */
  requestService(
    svc: Service,
    tier: { variantId: string; pricing: VariantPricing },
  ) {
    this.router.navigate(["/", this.slug(), "contratar", svc.id], {
      queryParams: {
        variant_id: tier.variantId,
        variant_billing_period: tier.pricing.billing_period,
        variant_base_price: String(tier.pricing.base_price),
      },
    });
  }
}
