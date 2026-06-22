import { Component, OnInit, inject, signal } from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { TranslocoModule } from "@jsverse/transloco";
import {
  BookingPublicService,
} from "../../services/booking-public.service";
import { CartService } from "../../shared/services/cart.service";
import { applyBrandingColors } from "../../shared/branding.utils";
import { TurnstileService } from "../../services/turnstile.service";
import { EmptyStateComponent } from "../../shared/ui/empty-state.component";

/**
 * Cart screen for the shop view. Shows the contents of CartService,
 * lets the customer adjust quantities or remove lines, and submits a
 * single "cart_request" lead to the BFF. The BFF treats a cart
 * request as a special lead with the cart line items embedded in the
 * metadata, so the company owner sees the whole bundle in the CRM
 * rather than one lead per product.
 *
 * Three states: empty (the customer is here by accident), filled (the
 * common case), and submitting-result (success / error).
 */
@Component({
  selector: "app-cart-screen",
  standalone: true,
  imports: [RouterLink, CommonModule, FormsModule, TranslocoModule, EmptyStateComponent],
  template: `
    <div class="cart-page">
      <a [routerLink]="['/', slug(), 'servicios']" class="back-link">
        ← Seguir comprando
      </a>

      <header class="page-header">
        <h1>Tu carrito</h1>
        @if (cart.itemCount() > 0) {
          <p class="page-subtitle">{{ cart.distinctCount() }} producto{{ cart.distinctCount() !== 1 ? 's' : '' }} · {{ cart.itemCount() }} unidades</p>
        } @else {
          <p class="page-subtitle">Aún no has añadido nada.</p>
        }
      </header>

      @if (loading()) {
        <div class="cart-skeleton" role="status" aria-live="polite" aria-label="Cargando tu carrito">
          <div class="cart-layout">
            <div class="skeleton-lines">
              @for (i of [1, 2, 3]; track i) {
                <div class="skeleton-line">
                  <div class="skeleton-block skeleton-block--name"></div>
                  <div class="skeleton-block skeleton-block--qty"></div>
                </div>
              }
              <div class="skeleton-line skeleton-line--summary">
                <div class="skeleton-block skeleton-block--label"></div>
                <div class="skeleton-block skeleton-block--total"></div>
              </div>
            </div>
            <div class="skeleton-form">
              <div class="skeleton-block skeleton-block--heading"></div>
              <div class="skeleton-block skeleton-block--input"></div>
              <div class="skeleton-block skeleton-block--input"></div>
              <div class="skeleton-block skeleton-block--input"></div>
              <div class="skeleton-block skeleton-block--button"></div>
            </div>
          </div>
        </div>
      } @else if (loadError()) {
        <div class="error-card" role="alert">{{ loadError() }}</div>
      } @else if (success()) {
        <div class="success-card" role="status" aria-live="assertive">
          <div class="success-icon" aria-hidden="true">✓</div>
          <h2>¡Solicitud enviada!</h2>
          <p>
            Hemos registrado tu pedido de <strong>{{ cart.itemCount() }} unidades</strong>
            en <strong>{{ cart.distinctCount() }} producto{{ cart.distinctCount() !== 1 ? 's' : '' }}</strong>.
          </p>
          <p>
            El equipo de <strong>{{ companyName() }}</strong> te contactará en menos
            de 24 horas con el presupuesto y los detalles de envío.
          </p>
          <a [routerLink]="['/', slug(), 'servicios']" class="btn btn-primary">
            Volver al catálogo
          </a>
        </div>
      } @else if (cart.itemCount() === 0) {
        <app-empty-state
          variant="cart"
          title="Tu carrito está vacío."
          [description]="companyName() ? 'Explora el catálogo de ' + companyName() + ' y añade los productos que te interesen.' : undefined"
        >
          <a [routerLink]="['/', slug(), 'servicios']" class="btn btn-primary">
            Ver productos
          </a>
        </app-empty-state>
      } @else {
        <div class="cart-layout">
          <!-- Lines table -->
          <div class="cart-lines">
            @for (item of cart.snapshot().items; track item.productId) {
              <div class="cart-line">
                <div class="line-info">
                  <h3 class="line-name">{{ item.name }}</h3>
                  @if (item.price != null) {
                    <p class="line-price">{{ item.price }}€ / unidad</p>
                  }
                </div>
                <div class="line-actions">
                  <div class="qty-stepper">
                    <button
                      type="button"
                      class="qty-btn"
                      (click)="decreaseQty(item.productId, item.quantity)"
                      aria-label="Quitar uno"
                    >
                      <svg class="qty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                    </button>
                    <span class="qty-value">{{ item.quantity }}</span>
                    <button
                      type="button"
                      class="qty-btn"
                      (click)="increaseQty(item.productId, item.quantity)"
                      aria-label="Añadir uno más"
                    >
                      <svg class="qty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                    </button>
                  </div>
                  <div class="line-subtotal">
                    @if (item.price != null) {
                      {{ (item.price * item.quantity) | number:'1.2-2' }}€
                    } @else {
                      —
                    }
                  </div>
                  <button
                    type="button"
                    class="line-remove"
                    (click)="cart.remove(item.productId)"
                    aria-label="Eliminar del carrito"
                    title="Eliminar"
                  >
                    <svg class="remove-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"></path>
                      <path d="M10 11v6"></path>
                      <path d="M14 11v6"></path>
                      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              </div>
            }
            <div class="cart-summary" role="group" [attr.aria-label]="'Resumen del carrito'">
              <span class="summary-label">Total</span>
              <span class="summary-total" aria-live="polite">
                <span aria-hidden="true">{{ cart.total() | number:'1.2-2' }}€</span>
                <span class="sr-only">
                  Total del carrito: {{ cart.total() | number:'1.2-2' }} euros
                </span>
              </span>
            </div>
            <button type="button" class="btn-clear" (click)="cart.clear()">
              <svg class="remove-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"></path>
                <path d="M10 11v6"></path>
                <path d="M14 11v6"></path>
                <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>
              </svg>
              Vaciar carrito
            </button>
          </div>

          <!-- Contact form -->
          <form class="contact-form" (ngSubmit)="submit()" novalidate>
            <h2>Datos de contacto</h2>
            <p class="form-hint">Te enviaremos el presupuesto y los detalles de envío a este email.</p>

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
              <label for="message">Notas (opcional)</label>
              <textarea id="message" class="form-control" rows="3"
                [(ngModel)]="formMessage" name="message"
                placeholder="¿Algún detalle sobre el envío, los plazos, la personalización?"></textarea>
            </div>

            <div class="form-group gdpr">
              <label class="checkbox-label">
                <input type="checkbox" [(ngModel)]="formGdprAccepted" name="gdpr" />
                <span>
                  Acepto la política de privacidad y el tratamiento de mis datos
                  para recibir el presupuesto de este pedido.
                </span>
              </label>
              @if (errors()['gdpr']) {
                <span class="error-msg">{{ errors()['gdpr'] }}</span>
              }
            </div>

            <div id="cf-turnstile"></div>

            @if (submitError()) {
              <div class="submit-error" role="alert">{{ submitError() }}</div>
            }

            <div class="form-actions">
              <button type="button" class="btn btn-ghost" (click)="back()">← Seguir comprando</button>
              <button type="submit" class="btn btn-primary"
                [disabled]="submitting()">
                @if (submitting()) {
                  <div class="spinner spinner-sm"></div>
                  Enviando…
                } @else {
                  Enviar solicitud ({{ cart.itemCount() }} unidades)
                }
              </button>
            </div>
          </form>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .cart-page {
        max-width: 1080px;
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
      .page-header { margin-bottom: 1.5rem; }
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
      .error-card {
        text-align: center;
        padding: 3rem 1rem;
        color: var(--color-text-secondary);
      }

      /* ── Skeleton loading ────────────────────────────────────────
         Mimics the cart layout so the page doesn't jump when the
         real data arrives. Uses a subtle pulse animation; respects
         prefers-reduced-motion. */
      .cart-skeleton {
        max-width: 1080px;
        margin: 0 auto;
        padding: 1rem 1rem 4rem;
      }
      .skeleton-lines { display: flex; flex-direction: column; gap: 0.75rem; }
      .skeleton-line {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 0.625rem;
        padding: 1rem 1.25rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
      }
      .skeleton-line--summary { margin-top: 0.5rem; padding: 1rem 1.25rem; }
      .skeleton-form {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 0.75rem;
        padding: 1.75rem;
        display: flex;
        flex-direction: column;
        gap: 0.875rem;
      }
      .skeleton-block {
        background: linear-gradient(
          90deg,
          var(--color-surface-hover) 0%,
          var(--color-border) 50%,
          var(--color-surface-hover) 100%
        );
        background-size: 200% 100%;
        border-radius: 0.375rem;
        animation: skeleton-pulse 1.4s ease-in-out infinite;
      }
      .skeleton-block--name { width: 40%; height: 1rem; }
      .skeleton-block--qty { width: 5rem; height: 2rem; }
      .skeleton-block--label { width: 4rem; height: 0.875rem; }
      .skeleton-block--total { width: 6rem; height: 1.5rem; }
      .skeleton-block--heading { width: 30%; height: 1.1rem; margin-bottom: 0.5rem; }
      .skeleton-block--input { width: 100%; height: 2.5rem; }
      .skeleton-block--button { width: 100%; height: 2.75rem; margin-top: 0.5rem; }
      @keyframes skeleton-pulse {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      @media (prefers-reduced-motion: reduce) {
        .skeleton-block { animation: none; }
      }
      .error-card { color: var(--color-error, #dc2626); }

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
      .success-card .btn-primary { margin-top: 1.5rem; display: inline-flex; }

      .cart-layout {
        display: grid;
        grid-template-columns: 1fr;
        gap: 2rem;
      }
      @media (min-width: 880px) {
        .cart-layout { grid-template-columns: 1.4fr 1fr; }
      }

      /* Lines column */
      .cart-lines {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .cart-line {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 0.625rem;
        padding: 1rem 1.25rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
      }
      .line-info { flex: 1; min-width: 200px; }
      .line-name {
        font-size: 1rem;
        font-weight: 600;
        margin: 0;
        color: var(--color-text);
      }
      .line-price {
        font-size: 0.8125rem;
        color: var(--color-text-secondary);
        margin: 0.125rem 0 0;
      }
      .line-actions {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      .qty-stepper {
        display: flex;
        align-items: center;
        border: 1px solid var(--color-border);
        border-radius: 0.5rem;
        overflow: hidden;
      }
      .qty-btn {
        background: transparent;
        border: none;
        color: var(--color-text-secondary);
        padding: 0.4rem 0.7rem;
        font-size: 0.8125rem;
        cursor: pointer;
        font-family: inherit;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .qty-btn .qty-icon { width: 0.875rem; height: 0.875rem; display: block; }
      .qty-btn:hover {
        background: var(--color-surface-hover);
        color: var(--color-text);
      }
      .qty-value {
        font-size: 0.9375rem;
        font-weight: 600;
        color: var(--color-text);
        padding: 0 0.5rem;
        min-width: 1.75rem;
        text-align: center;
      }
      .line-subtotal {
        font-size: 1rem;
        font-weight: 700;
        color: var(--color-text);
        min-width: 4rem;
        text-align: right;
      }
      .line-remove {
        background: transparent;
        border: none;
        color: var(--color-text-secondary);
        cursor: pointer;
        padding: 0.4rem 0.6rem;
        border-radius: 0.375rem;
        font-family: inherit;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .line-remove .remove-icon { width: 0.9375rem; height: 0.9375rem; display: block; }
      .line-remove:hover {
        color: var(--color-error, #dc2626);
        background: rgba(220, 38, 38, 0.08);
      }
      .cart-summary {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 1.25rem;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 0.625rem;
        margin-top: 0.5rem;
      }
      .summary-label {
        font-size: 0.9375rem;
        font-weight: 500;
        color: var(--color-text-secondary);
      }
      .summary-total {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--color-text);
      }
      .btn-clear {
        align-self: flex-start;
        background: transparent;
        border: none;
        color: var(--color-error, #dc2626);
        font-size: 0.8125rem;
        cursor: pointer;
        padding: 0.5rem 0;
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        font-family: inherit;
      }
      .btn-clear .remove-icon { width: 0.875rem; height: 0.875rem; display: block; }
      .btn-clear:hover { text-decoration: underline; }

      /* Contact form column */
      .contact-form {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 0.75rem;
        padding: 1.75rem;
        display: flex;
        flex-direction: column;
        gap: 0.875rem;
        align-self: start;
        position: sticky;
        top: 1rem;
      }
      .contact-form h2 {
        font-size: 1.1rem;
        font-weight: 600;
        margin: 0;
        color: var(--color-text);
      }
      .form-hint {
        font-size: 0.8125rem;
        color: var(--color-text-secondary);
        margin: 0;
        line-height: 1.4;
      }
      .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
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
      .form-control:disabled { opacity: 0.6; cursor: not-allowed; }
      textarea.form-control { resize: vertical; }
      .error-msg { font-size: 0.75rem; color: var(--color-error, #dc2626); }
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
      .gdpr input[type="checkbox"] { margin-top: 0.15rem; flex-shrink: 0; }

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
        font-family: inherit;
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

      @media (max-width: 640px) {
        .cart-page { padding: 1rem 0.75rem 3rem; }
        .page-header h1 { font-size: 1.35rem; }
        .cart-line { padding: 0.875rem 1rem; }
        .line-actions { width: 100%; justify-content: space-between; }
        .contact-form { padding: 1.25rem; }
      }

      /* Visually hidden but readable by screen readers — used for
         explicit prices and statuses that the visual label is ambiguous
         about (e.g. "30,50€" is read as "30 euros 50" by some TTS, so
         we provide a spelled-out version). */
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
export class CartScreenComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private bookingService = inject(BookingPublicService);
  private turnstileService = inject(TurnstileService);
  cart = inject(CartService);

  // ── State ───────────────────────────────────────────────────────
  slug = signal<string>("");
  companyName = signal<string>("");
  loading = signal(true);
  loadError = signal<string | null>(null);

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

    if (!slug) {
      this.loadError.set("Falta el slug de la empresa");
      this.loading.set(false);
      return;
    }
    this.bookingService.getServices(slug).subscribe({
      next: (res) => {
        applyBrandingColors(res.company?.primary_color, res.company?.secondary_color);
        this.companyName.set(res.company?.name ?? "");
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(err?.error?.error || err.message || "Error al cargar la empresa");
        this.loading.set(false);
      },
    });
  }

  increaseQty(productId: string, current: number) {
    this.cart.setQuantity(productId, current + 1);
  }

  decreaseQty(productId: string, current: number) {
    if (current <= 1) {
      this.cart.remove(productId);
    } else {
      this.cart.setQuantity(productId, current - 1);
    }
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
    if (this.cart.itemCount() === 0) return;

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

    const snapshot = this.cart.snapshot();
    this.bookingService.createCartRequest({
      company_slug: this.slug(),
      first_name: this.formFirstName.trim(),
      last_name: this.formLastName.trim(),
      email: this.formEmail.trim().toLowerCase(),
      phone: this.formPhone.trim() || undefined,
      message: this.formMessage.trim() || undefined,
      items: snapshot.items,
      total: snapshot.total,
      turnstile_token,
    }).subscribe({
      next: (res) => {
        this.submitting.set(false);
        if (res.success) {
          // Clear the cart on success — the customer is done.
          this.cart.clear();
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
