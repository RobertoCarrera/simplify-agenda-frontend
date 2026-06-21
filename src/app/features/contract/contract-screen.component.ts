import { Component, OnInit, inject, signal } from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { TranslocoModule } from "@jsverse/transloco";
import {
  BookingPublicService,
  Service,
  ServiceVariant,
  VariantPricing,
} from "../../services/booking-public.service";
import { applyBrandingColors } from "../../shared/branding.utils";
import { StripHtmlPipe } from "../../shared/pipes/strip-html.pipe";
import { TurnstileService } from "../../services/turnstile.service";

/**
 * Catalog-mode "Contratar" screen. The customer picked a service tier
 * from the catalog and now fills in their contact details. On submit,
 * the BFF creates a Lead in the CRM (table: `leads`) and the company
 * owner follows up within 24h.
 *
 * Compared to the previous placeholder, this version:
 *   - Has a real contact form (name, email, phone, message, GDPR)
 *   - Calls the new POST /create-lead endpoint
 *   - Includes the chosen variant + pricing snapshot
 *   - Renders a success state on the same screen (no separate page)
 *   - Validates client-side before calling the BFF
 *   - Runs the same Turnstile bot-check that booking uses
 */
@Component({
  selector: "app-contract-screen",
  standalone: true,
  imports: [RouterLink, CommonModule, FormsModule, TranslocoModule, StripHtmlPipe],
  template: `
    <div class="contract-page">
      <a [routerLink]="['/', slug(), 'servicios']" class="back-link">
        ← Volver al catálogo
      </a>

      @if (loading()) {
        <div class="loading">Cargando servicio…</div>
      } @else if (loadError()) {
        <div class="error-card">{{ loadError() }}</div>
      } @else if (success()) {
        <div class="success-card">
          <div class="success-icon">✓</div>
          <h2>¡Solicitud enviada!</h2>
          <p>
            Hemos registrado tu interés en
            <strong>{{ service()?.name }} — {{ selectedTier()?.variantName }}</strong>.
          </p>
          <p>
            El equipo de <strong>{{ companyName() }}</strong> te contactará en
            menos de 24 horas para confirmar los detalles y enviarte el contrato.
          </p>
          <a [routerLink]="['/', slug(), 'servicios']" class="btn btn-primary">
            Volver al catálogo
          </a>
        </div>
      } @else if (service()) {
        <header class="service-header">
          <span class="service-dot" [style.background]="service()!.color || '#94a3b8'"></span>
          <div>
            <h1>{{ service()!.name }}</h1>
            @if (selectedTier(); as t) {
              <p class="tier-line">
                <span class="tier-pill">{{ t.variantName }}</span>
                <span class="tier-price">{{ t.basePrice }}€<span *ngIf="t.period"> / {{ periodLabel(t.period) }}</span></span>
              </p>
            }
          </div>
        </header>

        @if (service()!.description) {
          <details class="description">
            <summary>Descripción del servicio</summary>
            <p>{{ service()!.description | stripHtml }}</p>
          </details>
        }

        <form class="contract-form" (ngSubmit)="submit()" novalidate>
          <h2>Tus datos de contacto</h2>

          <div class="form-row">
            <div class="form-group">
              <label for="firstName">Nombre *</label>
              <input id="firstName" type="text" class="form-control"
                [(ngModel)]="formFirstName" name="firstName"
                placeholder="Tu nombre"
                [class.invalid]="errors()['first_name']" />
              @if (errors()['first_name']) {
                <span class="error-msg">{{ errors()['first_name'] }}</span>
              }
            </div>
            <div class="form-group">
              <label for="lastName">Apellidos *</label>
              <input id="lastName" type="text" class="form-control"
                [(ngModel)]="formLastName" name="lastName"
                placeholder="Tus apellidos"
                [class.invalid]="errors()['last_name']" />
              @if (errors()['last_name']) {
                <span class="error-msg">{{ errors()['last_name'] }}</span>
              }
            </div>
          </div>

          <div class="form-group">
            <label for="email">Email *</label>
            <input id="email" type="email" class="form-control"
              [(ngModel)]="formEmail" name="email"
              placeholder="tu@correo.com"
              [class.invalid]="errors()['email']" />
            @if (errors()['email']) {
              <span class="error-msg">{{ errors()['email'] }}</span>
            }
          </div>

          <div class="form-group">
            <label for="phone">Teléfono</label>
            <input id="phone" type="tel" class="form-control"
              [(ngModel)]="formPhone" name="phone"
              placeholder="+34 600 000 000" />
          </div>

          <div class="form-group">
            <label for="message">Mensaje (opcional)</label>
            <textarea id="message" class="form-control" rows="4"
              [(ngModel)]="formMessage" name="message"
              placeholder="Cuéntanos brevemente qué necesitas o si tienes dudas"></textarea>
          </div>

          <div class="form-group gdpr">
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="formGdprAccepted" name="gdpr" />
              <span>
                Acepto la política de privacidad y el tratamiento de mis datos
                para recibir información comercial sobre este servicio.
              </span>
            </label>
            @if (errors()['gdpr']) {
              <span class="error-msg">{{ errors()['gdpr'] }}</span>
            }
          </div>

          <div id="cf-turnstile"></div>

          @if (submitError()) {
            <div class="submit-error">{{ submitError() }}</div>
          }

          <div class="form-actions">
            <button type="button" class="btn btn-ghost" (click)="back()">← Atrás</button>
            <button type="submit" class="btn btn-primary"
              [disabled]="submitting()">
              @if (submitting()) {
                <div class="spinner spinner-sm"></div>
                Enviando…
              } @else {
                Enviar solicitud
              }
            </button>
          </div>
        </form>
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .contract-page {
        max-width: 720px;
        margin: 0 auto;
        padding: 2rem 1rem 4rem;
      }
      .back-link {
        display: inline-block;
        color: var(--color-text-secondary);
        text-decoration: none;
        margin-bottom: 1.5rem;
        font-size: 0.875rem;
      }
      .back-link:hover { color: var(--color-text); }
      .loading, .error-card {
        text-align: center;
        padding: 3rem 1rem;
        color: var(--color-text-secondary);
      }
      .error-card { color: var(--color-error, #dc2626); }

      .service-header {
        display: flex;
        align-items: flex-start;
        gap: 1rem;
        margin-bottom: 1.5rem;
      }
      .service-dot {
        width: 1rem;
        height: 1rem;
        border-radius: 50%;
        flex-shrink: 0;
        margin-top: 0.5rem;
      }
      .service-header h1 {
        font-size: 1.75rem;
        font-weight: 700;
        margin: 0;
        color: var(--color-text);
      }
      .tier-line {
        margin: 0.5rem 0 0;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .tier-pill {
        background: var(--color-primary, #10B981);
        color: white;
        font-size: 0.75rem;
        font-weight: 600;
        padding: 0.125rem 0.625rem;
        border-radius: 999px;
      }
      .tier-price {
        color: var(--color-text);
        font-weight: 700;
      }

      .description {
        margin-bottom: 1.5rem;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 0.625rem;
        padding: 0.75rem 1rem;
      }
      .description summary {
        cursor: pointer;
        font-size: 0.875rem;
        color: var(--color-text-secondary);
        font-weight: 500;
      }
      .description p {
        margin: 0.5rem 0 0;
        font-size: 0.875rem;
        color: var(--color-text-secondary);
        line-height: 1.5;
      }

      .contract-form {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 0.75rem;
        padding: 1.75rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .contract-form h2 {
        font-size: 1.1rem;
        font-weight: 600;
        margin: 0 0 0.5rem;
        color: var(--color-text);
      }
      .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }
      @media (max-width: 540px) {
        .form-row { grid-template-columns: 1fr; }
      }
      .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .form-group label {
        font-size: 0.8125rem;
        font-weight: 500;
        color: var(--color-text);
      }
      .form-control {
        font-size: 0.95rem;
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--color-border);
        border-radius: 0.5rem;
        background: var(--color-bg, white);
        color: var(--color-text);
        font-family: inherit;
        transition: border-color 150ms ease;
      }
      .form-control:focus {
        outline: none;
        border-color: var(--color-primary, #10B981);
        box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
      }
      .form-control.invalid {
        border-color: var(--color-error, #dc2626);
      }
      .form-control:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      textarea.form-control { resize: vertical; }
      .error-msg {
        font-size: 0.75rem;
        color: var(--color-error, #dc2626);
      }
      .gdpr .checkbox-label {
        flex-direction: row;
        align-items: flex-start;
        gap: 0.5rem;
        font-weight: 400;
        font-size: 0.8125rem;
        color: var(--color-text-secondary);
        line-height: 1.45;
        cursor: pointer;
      }
      .gdpr input[type="checkbox"] {
        margin-top: 0.15rem;
        flex-shrink: 0;
      }

      .form-actions {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        margin-top: 0.5rem;
        flex-wrap: wrap;
      }
      .btn {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.625rem 1.25rem;
        border: 1px solid transparent;
        border-radius: 0.5rem;
        font-size: 0.9375rem;
        font-weight: 500;
        cursor: pointer;
        text-decoration: none;
        transition: all 150ms ease;
      }
      .btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .btn-primary { background: var(--color-primary, #10B981); color: white; }
      .btn-primary:hover:not(:disabled) { filter: brightness(1.1); }
      .btn-ghost { background: transparent; color: var(--color-text-secondary); }
      .btn-ghost:hover { color: var(--color-text); }
      .spinner-sm {
        width: 1rem;
        height: 1rem;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.7s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }

      .submit-error {
        background: rgba(220, 38, 38, 0.08);
        color: var(--color-error, #dc2626);
        padding: 0.75rem 1rem;
        border-radius: 0.5rem;
        font-size: 0.875rem;
      }

      .success-card {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 0.75rem;
        padding: 2.5rem 1.75rem;
        text-align: center;
      }
      .success-icon {
        width: 3.5rem;
        height: 3.5rem;
        border-radius: 50%;
        background: var(--color-success, #16a34a);
        color: white;
        font-size: 1.75rem;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 1rem;
      }
      .success-card h2 {
        font-size: 1.5rem;
        font-weight: 700;
        margin: 0 0 0.75rem;
        color: var(--color-text);
      }
      .success-card p {
        margin: 0.5rem 0;
        color: var(--color-text-secondary);
        line-height: 1.5;
      }
      .success-card .btn-primary {
        margin-top: 1.5rem;
      }
    `,
  ],
})
export class ContractScreenComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private bookingService = inject(BookingPublicService);
  private turnstileService = inject(TurnstileService);

  // ── State ───────────────────────────────────────────────────────
  slug = signal<string>("");
  service = signal<Service | null>(null);
  companyName = signal<string>("");
  loading = signal(true);
  loadError = signal<string | null>(null);

  selectedTier = signal<{ variantId: string; variantName: string; basePrice: number; period: VariantPricing["billing_period"] | null } | null>(null);

  submitting = signal(false);
  submitError = signal<string | null>(null);
  success = signal(false);

  // ── Form ────────────────────────────────────────────────────────
  formFirstName = "";
  formLastName = "";
  formEmail = "";
  formPhone = "";
  formMessage = "";
  formGdprAccepted = false;
  errors = signal<Record<string, string>>({});

  ngOnInit() {
    const parentParams = this.route.parent?.snapshot.paramMap;
    const slug = parentParams?.get("slug") ?? this.route.snapshot.paramMap.get("slug") ?? "";
    this.slug.set(slug);

    const qp = this.route.snapshot.queryParamMap;
    const variantId = qp.get("variant_id");
    const billingPeriod = qp.get("variant_billing_period") as VariantPricing["billing_period"] | null;
    const basePrice = qp.get("variant_base_price");

    if (!slug) {
      this.loadError.set("Falta el slug de la empresa");
      this.loading.set(false);
      return;
    }

    this.bookingService.getServices(slug).subscribe({
      next: (res) => {
        applyBrandingColors(res.company?.primary_color, res.company?.secondary_color);
        this.companyName.set(res.company?.name ?? "");
        const serviceId = this.route.snapshot.paramMap.get("serviceId");
        const svc = res.services.find((s) => s.id === serviceId) ?? null;
        this.service.set(svc);

        if (svc && variantId && billingPeriod && basePrice) {
          const variant: ServiceVariant | undefined = svc.variants?.find((v) => v.id === variantId);
          this.selectedTier.set({
            variantId,
            variantName: variant?.name ?? "(plan seleccionado)",
            basePrice: Number(basePrice),
            period: billingPeriod,
          });
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(err?.error?.error || err.message || "Error al cargar el servicio");
        this.loading.set(false);
      },
    });
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

  back() {
    this.router.navigate(["/", this.slug(), "servicios"]);
  }

  private validate(): boolean {
    const errs: Record<string, string> = {};
    if (!this.formFirstName.trim()) errs["first_name"] = "El nombre es obligatorio";
    if (!this.formLastName.trim()) errs["last_name"] = "Los apellidos son obligatorios";
    const email = this.formEmail.trim();
    if (!email) {
      errs["email"] = "El email es obligatorio";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs["email"] = "Email no válido";
    }
    if (!this.formGdprAccepted) errs["gdpr"] = "Debes aceptar la política de privacidad";
    this.errors.set(errs);
    return Object.keys(errs).length === 0;
  }

  async submit() {
    if (!this.validate()) return;

    const svc = this.service();
    const tier = this.selectedTier();
    if (!svc || !tier) return;

    this.submitting.set(true);
    this.submitError.set(null);

    let turnstile_token: string;
    try {
      await this.turnstileService.loadScript();
      turnstile_token = await this.turnstileService.renderAndExecute();
    } catch (err) {
      this.submitting.set(false);
      const msg = err instanceof Error ? err.message : String(err);
      this.submitError.set("Error en la verificación de seguridad: " + msg);
      return;
    }

    const payload = {
      company_slug: this.slug(),
      service_id: svc.id,
      first_name: this.formFirstName.trim(),
      last_name: this.formLastName.trim(),
      email: this.formEmail.trim().toLowerCase(),
      phone: this.formPhone.trim() || undefined,
      message: this.formMessage.trim() || undefined,
      variant_id: tier.variantId,
      variant_pricing_snapshot: {
        base_price: tier.basePrice,
        billing_period: tier.period ?? "one_time",
      } as VariantPricing,
      turnstile_token,
    };

    this.bookingService.createLead(payload).subscribe({
      next: (res) => {
        this.submitting.set(false);
        if (res.success) {
          this.success.set(true);
        } else {
          this.submitError.set(res.message || "No se pudo enviar la solicitud");
        }
      },
      error: (err) => {
        this.submitting.set(false);
        this.submitError.set(err.message || "No se pudo enviar la solicitud. Inténtalo de nuevo.");
      },
    });
  }
}
