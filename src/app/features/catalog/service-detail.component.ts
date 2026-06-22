import { Component, OnInit, inject, signal, computed } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { TranslocoModule } from "@jsverse/transloco";
import {
  BookingPublicService,
  Service,
  ServiceVariant,
  VariantPricing,
  Professional,
  Company,
} from "../../services/booking-public.service";

@Component({
  selector: "app-service-detail",
  standalone: true,
  imports: [CommonModule, RouterLink, TranslocoModule],
  template: `
    <div class="service-detail-page" *ngIf="service(); else loading">
      <header class="detail-header">
        <a [routerLink]="['/', slug(), 'servicios']" class="back-link">
          ← {{ "common.back" | transloco }}
        </a>

        <div class="service-header-content">
          <h1 class="service-title">{{ service()?.name }}</h1>
          <div class="service-price-duration">
            <span class="price">{{ service()?.price }}€</span>
            <span class="duration">{{ service()?.duration_minutes }} min</span>
          </div>
        </div>
      </header>

      <section class="service-description" *ngIf="service()?.description">
        <p>{{ service()?.description }}</p>
      </section>

      <!-- Variant selector — only shown if the service has variants.
           Each variant is a card; user picks one variant AND one pricing row
           (monthly/annual/one_time) before continuing. -->
      <section
        class="variants-section"
        *ngIf="effectiveVariantOptions().length > 1"
      >
        <h2>{{ "service.choosePlan" | transloco }}</h2>
        <div class="variants-grid" role="radiogroup" [attr.aria-label]="'Selecciona un plan'">
          <div
            class="variant-option"
            *ngFor="let opt of effectiveVariantOptions()"
            [class.variant-option--selected]="
              selectedVariantId() === opt.variantId &&
              selectedBillingPeriod() === opt.pricing.billing_period
            "
            [style.border-left-color]="
              opt.variant.display_config?.color || '#94a3b8'
            "
            role="radio"
            tabindex="0"
            [attr.aria-checked]="
              selectedVariantId() === opt.variantId &&
              selectedBillingPeriod() === opt.pricing.billing_period
            "
            [attr.aria-label]="
              opt.variant.name + ', ' + opt.pricing.base_price + ' euros ' +
              (opt.pricing.billing_period ? 'por ' + periodLabel(opt.pricing.billing_period) : '')
            "
            (click)="selectVariant(opt.variantId, opt.pricing)"
            (keydown.enter)="selectVariant(opt.variantId, opt.pricing); $event.preventDefault()"
            (keydown.space)="selectVariant(opt.variantId, opt.pricing); $event.preventDefault()"
          >
            <div class="variant-option-header">
              <span class="variant-name">{{ opt.variant.name }}</span>
              <span
                class="variant-badge"
                *ngIf="opt.variant.display_config?.badge"
                [style.background-color]="
                  opt.variant.display_config?.color || '#94a3b8'
                "
                >{{ opt.variant.display_config?.badge }}</span
              >
            </div>
            <div class="variant-price">
              <span class="price-amount" aria-hidden="true">{{ opt.pricing.base_price }}€</span>
              <span class="sr-only">{{ opt.pricing.base_price }} euros</span>
              <span class="price-period" *ngIf="opt.pricing.billing_period">
                / {{ periodLabel(opt.pricing.billing_period) }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section class="professionals-section">
        <h2>{{ "service.availableWith" | transloco }}</h2>
        <div class="professionals-grid" role="list">
          <div
            class="professional-item"
            *ngFor="let prof of professionalsForService()"
            role="listitem"
            tabindex="0"
            [attr.aria-label]="'Reservar cita con ' + prof.display_name"
            (click)="bookWithProfessional(prof)"
            (keydown.enter)="bookWithProfessional(prof); $event.preventDefault()"
            (keydown.space)="bookWithProfessional(prof); $event.preventDefault()"
          >
            <div class="prof-avatar">
              <img
                *ngIf="prof.avatar_url; else initials"
                [src]="prof.avatar_url"
                [alt]="prof.display_name"
              />
              <ng-template #initials>
                <span class="initials">{{
                  getInitials(prof.display_name)
                }}</span>
              </ng-template>
            </div>
            <div class="prof-info">
              <span class="prof-name">{{ prof.display_name }}</span>
              <span class="book-link"
                >{{ "service.bookWith" | transloco }} →</span
              >
            </div>
          </div>
        </div>
      </section>

      <div class="actions">
        <a
          [routerLink]="['/', slug(), 'reservar', service()?.id]"
          [queryParams]="reservationQueryParams()"
          class="btn btn-primary btn-lg"
        >
          {{ "service.bookNow" | transloco }}
        </a>
      </div>
    </div>

    <ng-template #loading>
      <div class="loading-state">
        <p>{{ "common.loading" | transloco }}</p>
      </div>
    </ng-template>

    <div class="error-state" *ngIf="error()">
      <p>{{ error() }}</p>
      <a [routerLink]="['/', slug(), 'servicios']" class="btn btn-outline">
        {{ "common.backToServices" | transloco }}
      </a>
    </div>
  `,
  styles: [
    `
      .service-detail-page {
        max-width: 800px;
        margin: 0 auto;
        padding: var(--space-8) var(--space-4);
      }

      .detail-header {
        margin-bottom: var(--space-8);
      }

      .back-link {
        display: inline-block;
        color: var(--color-text-secondary);
        text-decoration: none;
        margin-bottom: var(--space-6);
        transition: color var(--transition-fast);
      }

      .back-link:hover {
        color: var(--color-text);
      }

      .service-header-content {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: var(--space-4);
      }

      .service-title {
        font-size: var(--font-size-3xl);
        font-weight: var(--font-weight-bold);
        color: var(--color-text);
        margin: 0;
      }

      .service-price-duration {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: var(--space-1);
      }

      .price {
        font-size: var(--font-size-2xl);
        font-weight: var(--font-weight-bold);
        color: var(--color-primary);
      }

      .duration {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
      }

      .service-description {
        margin-bottom: var(--space-8);
        padding: var(--space-6);
        background: var(--color-surface);
        border-radius: var(--radius-lg);
        border: 1px solid var(--color-border);
      }

      .service-description p {
        margin: 0;
        color: var(--color-text-secondary);
        line-height: 1.6;
      }

      .variants-section {
        margin-bottom: var(--space-8);
      }

      .variants-section h2 {
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-semibold);
        margin: 0 0 var(--space-4) 0;
      }

      .variants-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: var(--space-3);
      }

      .variant-option {
        background: var(--color-surface);
        border: 2px solid var(--color-border);
        border-left-width: 4px;
        border-radius: var(--radius-md);
        padding: var(--space-4);
        cursor: pointer;
        transition: all var(--transition-fast);
      }

      .variant-option:hover {
        border-color: var(--color-primary);
        transform: translateY(-1px);
      }

      .variant-option:focus-visible {
        outline: 3px solid var(--color-primary);
        outline-offset: 2px;
      }

      .variant-option--selected {
        border-color: var(--color-primary);
        background: var(--color-surface-elevated, var(--color-surface));
        box-shadow: 0 0 0 1px var(--color-primary);
      }

      .variant-option-header {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin-bottom: var(--space-2);
      }

      .variant-name {
        font-weight: var(--font-weight-semibold);
        color: var(--color-text);
      }

      .variant-badge {
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-bold);
        color: white;
        padding: 2px 8px;
        border-radius: 999px;
        text-transform: uppercase;
      }

      .variant-price {
        display: flex;
        align-items: baseline;
        gap: var(--space-1);
      }

      .price-amount {
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-bold);
        color: var(--color-primary);
      }

      .price-period {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
      }

      .professionals-section {
        margin-bottom: var(--space-8);
      }

      .professionals-section h2 {
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-semibold);
        margin: 0 0 var(--space-4) 0;
      }

      .professionals-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: var(--space-4);
      }

      .professional-item {
        display: flex;
        align-items: center;
        gap: var(--space-4);
        padding: var(--space-4);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        cursor: pointer;
        transition: all var(--transition-fast);
      }

      .professional-item:hover {
        border-color: var(--color-primary);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }

      .professional-item:focus-visible {
        outline: 3px solid var(--color-primary);
        outline-offset: 2px;
      }

      .prof-avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        overflow: hidden;
        background: var(--color-primary);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .prof-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .initials {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-bold);
        color: var(--color-primary-text);
      }

      .prof-info {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }

      .prof-name {
        font-weight: var(--font-weight-medium);
        color: var(--color-text);
      }

      .book-link {
        font-size: var(--font-size-sm);
        color: var(--color-primary);
      }

      .actions {
        display: flex;
        justify-content: center;
      }

      .btn-lg {
        padding: var(--space-4) var(--space-8);
        font-size: var(--font-size-lg);
      }

      .btn {
        border-radius: var(--radius-md);
        font-weight: var(--font-weight-medium);
        text-align: center;
        text-decoration: none;
        transition: all var(--transition-fast);
      }

      .btn-primary {
        background: var(--color-primary);
        border: 1px solid var(--color-primary);
        color: var(--color-primary-text);
      }

      .btn-primary:hover {
        filter: brightness(1.1);
      }

      .btn-outline {
        background: transparent;
        border: 1px solid var(--color-border);
        color: var(--color-text);
      }

      .loading-state,
      .error-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 300px;
        gap: var(--space-4);
      }

      .error-state {
        color: var(--color-error);
      }

      /* Visually hidden but readable by screen readers — used to spell
         out prices and statuses that the visual label is ambiguous
         about (e.g. "30,50€" can be read as "30 euros 50" by TTS). */
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
    `,
  ],
})
export class ServiceDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private bookingService = inject(BookingPublicService);

  service = signal<Service | null>(null);
  professionals = signal<Professional[]>([]);
  company = signal<Company | null>(null);
  error = signal<string | null>(null);
  slug = signal<string>("");

  // Variant selection state. Defaults to null; once the user picks one,
  // these are sent as queryParams to the reservation wizard.
  selectedVariantId = signal<string | null>(null);
  selectedPricing = signal<VariantPricing | null>(null);
  selectedBillingPeriod = computed(() => this.selectedPricing()?.billing_period ?? null);

  /**
   * Flatten the service's variants into one card per (variant, pricing) row.
   * Empty arrays (variant without pricing rows) are skipped. If there's only
   * 1 effective option overall, the section is hidden — there's nothing to
   * choose between.
   */
  effectiveVariantOptions = computed<Array<{ variant: ServiceVariant; variantId: string; pricing: VariantPricing }>>(() => {
    const svc = this.service();
    if (!svc?.variants) return [];
    const opts: Array<{ variant: ServiceVariant; variantId: string; pricing: VariantPricing }> = [];
    for (const v of svc.variants) {
      if (!v.pricing || v.pricing.length === 0) continue;
      for (const p of v.pricing) {
        opts.push({ variant: v, variantId: v.id, pricing: p });
      }
    }
    return opts;
  });

  /**
   * Query params to attach to the "Reservar ahora" link. Only sets the variant
   * fields if a selection exists — otherwise the wizard proceeds with the
   * service base price (backwards-compatible).
   */
  reservationQueryParams = computed(() => {
    const params: Record<string, string> = {};
    const vid = this.selectedVariantId();
    const price = this.selectedPricing();
    if (vid) params["variant_id"] = vid;
    if (price) {
      params["variant_billing_period"] = price.billing_period;
      params["variant_base_price"] = String(price.base_price);
    }
    return params;
  });

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

  selectVariant(variantId: string, pricing: VariantPricing) {
    this.selectedVariantId.set(variantId);
    this.selectedPricing.set(pricing);
  }

  ngOnInit() {
    // Get slug from route
    this.route.paramMap.subscribe((params) => {
      const slugParam = params.get("slug");
      if (slugParam) {
        this.slug.set(slugParam);
      }
    });

    // Get resolved service data
    this.route.data.subscribe((data) => {
      if (data["service"]) {
        this.service.set(data["service"] as Service);
        this.professionals.set(data["service"]["professionals"] || []);
      }
    });

    // Also check route param for service ID (fallback)
    const serviceId = this.route.snapshot.paramMap.get("id");
    if (serviceId && !this.service()) {
      this.loadService(serviceId);
    }
  }

  private loadService(id: string) {
    this.error.set(null);

    this.bookingService.getService(id).subscribe({
      next: (service) => {
        this.service.set(service);
        this.professionals.set(service.professionals || []);
      },
      error: (err) => {
        console.error("Error loading service:", err);
        this.error.set("Service not found");
      },
    });
  }

  professionalsForService(): Professional[] {
    const service = this.service();
    if (!service) return [];
    return service.professionals || [];
  }

  getInitials(name: string): string {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  bookWithProfessional(professional: Professional) {
    const currentSlug = this.slug();
    this.router.navigate(["/", currentSlug, "reservar", this.service()?.id], {
      queryParams: {
        professional: professional.id,
        ...this.reservationQueryParams(),
      },
    });
  }
}
