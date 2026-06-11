import { Component, OnInit, signal, computed, inject } from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { TranslocoModule } from "@jsverse/transloco";
import { CommonModule } from "@angular/common";
import {
  BookingPublicService,
  Service,
  Professional,
  BusyPeriod,
} from "../../services/booking-public.service";
import { AvailabilityService } from "../../services/availability.service";
import { TurnstileService } from "../../services/turnstile.service";
import { WeeklyCalendarComponent } from "../calendar/weekly-calendar.component";
import { TimeSlot } from "../calendar/time-slot.component";
import { applyBrandingColors } from "../../shared/branding.utils";

@Component({
  selector: "app-booking-wizard",
  standalone: true,
  imports: [FormsModule, TranslocoModule, CommonModule, RouterLink, WeeklyCalendarComponent],
  template: `
    <div class="wizard-page">
      <!-- Back link -->
      <a [routerLink]="['/', slug(), 'servicios']" class="back-link">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:1rem;height:1rem">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
        </svg>
        Volver a servicios
      </a>

      @if (loadingService()) {
        <div class="service-summary-skeleton skeleton"></div>
      } @else if (service()) {
        <!-- Service summary bar -->
        <div class="service-summary">
          <span class="service-dot" [style.background]="service()!.color || '#94a3b8'"></span>
          <div class="service-summary-info">
            <strong>{{ service()!.name }}</strong>
            <span class="service-summary-meta">{{ service()!.duration_minutes }} min</span>
            @if (service()!.price != null) {
              <span class="service-summary-price">{{ service()!.price }}€</span>
            }
          </div>
        </div>
      }

      @if (step() === 4) {
        <!-- ── SUCCESS ────────────────────────────────── -->
        <div class="success-card">
          <div class="success-icon">✓</div>
          <h2 class="success-title">¡Reserva confirmada!</h2>
          @if (bookingId()) {
            <p class="success-id">Ref: {{ bookingId() }}</p>
          }
          @if (selectedSlot()) {
            <p class="success-detail">
              {{ service()?.name }} · {{ formatSlotDate(selectedSlot()!) }}
            </p>
          }
          <a [routerLink]="['/', slug(), 'servicios']" class="btn btn-primary">
            Volver al inicio
          </a>
        </div>
      } @else {
        <!-- ── PROGRESS BAR ────────────────────────────── -->
        <div class="progress-bar">
          @for (n of [1,2,3]; track n) {
            <div class="progress-step" [class.active]="step() >= n" [class.done]="step() > n">
              <div class="ps-circle">{{ step() > n ? '✓' : n }}</div>
              <span class="ps-label">
                @switch (n) {
                  @case (1) { Tus datos }
                  @case (2) { Cuándo }
                  @case (3) { Confirmar }
                }
              </span>
            </div>
            @if (n < 3) { <div class="progress-line" [class.done]="step() > n"></div> }
          }
        </div>

        <!-- ── STEP 1: Client info + pro select ────────── -->
        @if (step() === 1) {
          <div class="step-card">
            <h2 class="step-title">Tus datos de contacto</h2>

            @if (professionals().length > 0) {
              <div class="form-group">
                <label>Profesional</label>
                <div class="prof-selector">
                  <!-- Sin preferencia -->
                  <button type="button"
                    class="prof-option"
                    [class.prof-option--selected]="formProfessionalId === ''"
                    (click)="formProfessionalId = ''">
                    <div class="prof-option-avatar prof-option-avatar--any">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z"/>
                      </svg>
                    </div>
                    <div class="prof-option-info">
                      <span class="prof-option-name">Sin preferencia</span>
                      <span class="prof-option-title">Cualquier profesional</span>
                    </div>
                    @if (formProfessionalId === '') {
                      <svg class="prof-option-check" viewBox="0 0 24 24" fill="currentColor">
                        <path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clip-rule="evenodd"/>
                      </svg>
                    }
                  </button>
                  <!-- Profesionales -->
                  @for (p of professionals(); track p.id) {
                    <button type="button"
                      class="prof-option"
                      [class.prof-option--selected]="formProfessionalId === p.id"
                      (click)="formProfessionalId = p.id">
                      @if (p.avatar_url && !failedAvatarIds().has(p.id)) {
                        <img class="prof-option-avatar" [src]="p.avatar_url" [alt]="p.display_name" (error)="onAvatarError(p.id)" />
                      } @else {
                        <div class="prof-option-avatar prof-option-avatar--initials"
                          [style.background]="getAvatarColor(p.display_name).bg"
                          [style.color]="getAvatarColor(p.display_name).fg">
                          {{ getInitials(p.display_name) }}
                        </div>
                      }
                      <div class="prof-option-info">
                        <span class="prof-option-name">{{ p.display_name }}</span>
                        @if (p.title) {
                          <span class="prof-option-title">{{ p.title }}</span>
                        }
                      </div>
                      @if (formProfessionalId === p.id) {
                        <svg class="prof-option-check" viewBox="0 0 24 24" fill="currentColor">
                          <path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clip-rule="evenodd"/>
                        </svg>
                      }
                    </button>
                  }
                </div>
              </div>
            }

            <div class="form-group">
              <label for="clientName">Nombre *</label>
              <input id="clientName" type="text" class="form-control"
                [(ngModel)]="formName" placeholder="Tu nombre completo"
                [class.invalid]="errors()['name']" />
              @if (errors()['name']) {
                <span class="error-msg">{{ errors()['name'] }}</span>
              }
            </div>

            <div class="form-group">
              <label for="clientPhone">Teléfono *</label>
              <input id="clientPhone" type="tel" class="form-control"
                [(ngModel)]="formPhone" placeholder="Tu número de teléfono"
                [class.invalid]="errors()['phone']" />
              @if (errors()['phone']) {
                <span class="error-msg">{{ errors()['phone'] }}</span>
              }
            </div>

            <div class="form-group">
              <label for="clientEmail">Email *</label>
              <input id="clientEmail" type="email" class="form-control"
                [(ngModel)]="formEmail" placeholder="tu@correo.com"
                [class.invalid]="errors()['email']" />
              @if (errors()['email']) {
                <span class="error-msg">{{ errors()['email'] }}</span>
              }
            </div>

            <div class="step-actions">
              <button class="btn btn-primary btn-full" (click)="goStep2()">
                Continuar
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:1rem;height:1rem">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                </svg>
              </button>
            </div>
          </div>
        }

        <!-- ── STEP 2: Method selection ─────────────────── -->
        @if (step() === 2) {
          <div class="step-card">
            <h2 class="step-title">¿Cuándo quieres tu cita?</h2>

            @if (autoSearching()) {
              <div class="auto-searching">
                <div class="spinner"></div>
                <p>Buscando la primera disponibilidad...</p>
              </div>
            } @else if (autoError()) {
              <div class="auto-error">
                <p>{{ autoError() }}</p>
                <button class="btn btn-outline" (click)="clearAutoError()">Intentar de nuevo</button>
              </div>
            } @else {
              <div class="method-cards">
                <button class="method-card" (click)="selectMethodAuto()">
                  <div class="method-icon">⚡</div>
                  <div class="method-info">
                    <strong>Primera disponible</strong>
                    <p>Te buscamos el primer hueco libre</p>
                  </div>
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:1.25rem;height:1.25rem;opacity:0.4">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                  </svg>
                </button>
                <button class="method-card" (click)="selectMethodManual()">
                  <div class="method-icon">📅</div>
                  <div class="method-info">
                    <strong>Elegir día y hora</strong>
                    <p>Selecciona tú mismo cuándo quieres venir</p>
                  </div>
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:1.25rem;height:1.25rem;opacity:0.4">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                  </svg>
                </button>
              </div>
            }

            <div class="step-actions step-actions-back">
              <button class="btn btn-ghost" (click)="step.set(1)">← Atrás</button>
            </div>
          </div>
        }

        <!-- ── STEP 3: Calendar or Auto-confirm ───────────── -->
        @if (step() === 3) {
          <div class="step-card step-card-wide">
            @if (isAutoMode()) {
              <!-- Auto mode: show confirmation summary -->
              <h2 class="step-title">Confirma tu reserva</h2>
              
              @if (selectedSlot()) {
                <div class="auto-confirm-summary">
                  <div class="summary-card">
                    <div class="summary-icon">📅</div>
                    <div class="summary-details">
                      <span class="summary-label">Fecha y hora</span>
                      <span class="summary-value">{{ formatSlotDate(selectedSlot()!) }}</span>
                    </div>
                  </div>
                  <div class="summary-card">
                    <div class="summary-icon">⏱️</div>
                    <div class="summary-details">
                      <span class="summary-label">Duración</span>
                      <span class="summary-value">{{ service()?.duration_minutes }} minutos</span>
                    </div>
                  </div>
                  @if (formProfessionalId) {
                    <div class="summary-card">
                      <div class="summary-icon"></div>
                      <div class="summary-details">
                        <span class="summary-label">Profesional</span>
                        <span class="summary-value">{{ getProfessionalName() }}</span>
                      </div>
                    </div>
                  }
                </div>
              } @else if (autoSearching()) {
                <div class="auto-searching">
                  <div class="spinner"></div>
                  <p>Buscando la primera disponibilidad...</p>
                </div>
              }

              <div id="cf-turnstile"></div>

              <div class="step-actions">
                <button class="btn btn-ghost" (click)="goBackToMethodSelection()">← Cambiar método</button>
                <button
                  class="btn btn-primary"
                  [disabled]="!selectedSlot() || submitting()"
                  (click)="confirmBooking()"
                >
                  @if (submitting()) {
                    <div class="spinner spinner-sm"></div>
                    Enviando...
                  } @else if (selectedSlot()) {
                    Confirmar reserva
                  } @else {
                    Buscando disponibilidad...
                  }
                </button>
              </div>
            } @else {
              <!-- Manual mode: show calendar -->
              <h2 class="step-title">Selecciona tu horario</h2>

              @if (loadingAvailability()) {
                <div class="availability-loading">
                  <div class="spinner"></div>
                  <p>Cargando disponibilidad...</p>
                </div>
              } @else {
                <app-weekly-calendar
                  [busyPeriods]="busyPeriods()"
                  [serviceDuration]="service()?.duration_minutes ?? 30"
                  [initialDate]="calendarInitialDate()"
                  (slotSelected)="onSlotSelected($event)"
                  (weekChanged)="onWeekChanged($event)"
                />
              }

              <div id="cf-turnstile"></div>

              <div class="step-actions">
                <button class="btn btn-ghost" (click)="step.set(2)">← Atrás</button>
                <button
                  class="btn btn-primary"
                  [disabled]="!selectedSlot() || submitting()"
                  (click)="confirmBooking()"
                >
                  @if (submitting()) {
                    <div class="spinner spinner-sm"></div>
                    Enviando...
                  } @else if (selectedSlot()) {
                    Reservar {{ formatSlotDate(selectedSlot()!) }}
                  } @else {
                    Selecciona una hora
                  }
                </button>
              </div>
            }

            @if (submitError()) {
              <div class="submit-error">{{ submitError() }}</div>
            }
          </div>
        }
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; }

      .wizard-page {
        @apply max-w-[680px] mx-auto px-6 pt-6 pb-16;
      }

      /* ── Back link ── */
      .back-link {
        @apply inline-flex items-center gap-2 text-sm no-underline mb-6 transition-colors duration-150;
        color: var(--color-text-secondary);
        &:hover { color: var(--color-text); }
      }

      /* ── Service summary ── */
      .service-summary-skeleton {
        @apply h-14 rounded-xl mb-6;
        background: linear-gradient(90deg, var(--color-border) 25%, var(--color-surface-hover) 50%, var(--color-border) 75%);
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
      }
      @keyframes shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      .service-summary {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        @apply flex items-center gap-3 rounded-xl px-4 py-3 mb-6;
      }
      .service-dot { @apply w-2.5 h-2.5 rounded-full flex-shrink-0; }
      .service-summary-info {
        @apply flex items-center gap-3 flex-wrap;
        strong { @apply text-sm; color: var(--color-text); }
      }
      .service-summary-meta {
        @apply text-xs rounded-full px-2 py-0.5;
        background: var(--color-surface-hover);
        border: 1px solid var(--color-border);
        color: var(--color-text-secondary);
      }
      .service-summary-price { @apply text-sm font-bold; color: var(--color-text-secondary); }

      /* ── Progress bar ── */
      .progress-bar { @apply flex items-center justify-center gap-0 mb-8; }
      .progress-step {
        @apply flex flex-col items-center gap-1;
        .ps-circle {
          @apply w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-150;
          background: var(--color-surface-hover);
          border: 2px solid var(--color-border);
          color: var(--color-text-disabled);
        }
        .ps-label { @apply text-[0.65rem] whitespace-nowrap; color: var(--color-text-disabled); }
        &.active .ps-circle { background: var(--color-primary); border-color: var(--color-primary); color: var(--color-primary-text); }
        &.active .ps-label { color: var(--color-primary); font-weight: 500; }
        &.done .ps-circle { background: var(--color-primary); border-color: var(--color-primary); color: var(--color-primary-text); }
      }
      .progress-line {
        @apply w-8 h-0.5 mb-5 flex-shrink-0 transition-colors duration-150;
        background: var(--color-border);
        &.done { background: var(--color-primary); }
      }

      /* ── Step card ── */
      .step-card {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        @apply rounded-xl p-6;
      }
      .step-card-wide { @apply max-w-full w-full; }
      .step-title { @apply text-xl font-bold m-0 mb-6; color: var(--color-text); }

      /* ── Form ── */
      .form-group {
        @apply mb-4;
        label {
          @apply block text-sm font-medium mb-1;
          color: var(--color-text);
        }
      }
      .form-control {
        @apply block w-full px-3 py-2 rounded-md text-sm transition-colors duration-150;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        color: var(--color-text);
        &:focus { outline: none; border-color: var(--color-primary); }
        &.invalid { border-color: var(--color-error); }
      }
      .error-msg { @apply text-xs mt-1 block; color: var(--color-error); }

      /* ── Step actions ── */
      .step-actions {
        @apply flex justify-end gap-3 mt-6 pt-4;
        border-top: 1px solid var(--color-border);
      }
      .step-actions-back { @apply justify-start; }

      /* ── Method cards ── */
      .method-cards { @apply grid gap-3; }
      .method-card {
        background: var(--color-surface);
        border: 2px solid var(--color-border);
        @apply flex items-center gap-4 px-5 py-4 rounded-xl cursor-pointer text-left w-full transition-all duration-150;
        &:hover { border-color: var(--color-primary); }
      }
      .method-icon { @apply text-2xl flex-shrink-0; }
      .method-info {
        @apply flex-1 min-w-0;
        strong { @apply block text-sm mb-0.5; color: var(--color-text); }
        p { @apply text-xs m-0; color: var(--color-text-disabled); }
      }

      /* ── Auto searching ── */
      .auto-searching, .availability-loading {
        @apply flex flex-col items-center gap-4 py-10 text-sm;
        color: var(--color-text-secondary);
      }
      .auto-error {
        @apply px-4 py-4 border rounded-md text-sm text-center mb-4;
        border-color: var(--color-error);
        color: var(--color-error);
      }

      /* ── Auto confirm summary ── */
      .auto-confirm-summary {
        @apply flex flex-col gap-3 mb-6;
      }
      .summary-card {
        background: var(--color-surface-hover);
        border: 1px solid var(--color-border);
        @apply flex items-center gap-4 px-5 py-4 rounded-xl;
      }
      .summary-icon {
        @apply text-2xl flex-shrink-0 w-10 h-10 flex items-center justify-center;
        background: var(--color-primary-light);
        border-radius: var(--radius-md);
      }
      .summary-details {
        @apply flex flex-col gap-0.5 flex-1;
      }
      .summary-label {
        @apply text-xs font-medium;
        color: var(--color-text-secondary);
      }
      .summary-value {
        @apply text-sm font-semibold;
        color: var(--color-text);
      }

      /* ── Submit error ── */
      .submit-error {
        @apply mt-3 px-4 py-3 rounded-md text-sm text-center;
        background: #fef2f2;
        border: 1px solid #fecaca;
        color: var(--color-error);
      }

      /* ── Success ── */
      .success-card {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        @apply flex flex-col items-center gap-3 px-6 py-12 rounded-xl text-center;
      }
      .success-icon {
        @apply w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold;
        background: #dcfce7;
        color: #16a34a;
      }
      .success-title { @apply text-2xl font-bold m-0; color: var(--color-text); }
      .success-id { @apply text-sm m-0; color: var(--color-text-disabled); }
      .success-detail { @apply text-base m-0; color: var(--color-text-secondary); }

      /* ── Spinner ── */
      .spinner {
        @apply w-8 h-8 border-[3px] rounded-full animate-spin;
        border-color: var(--color-border);
        border-top-color: var(--color-primary);
      }
      .spinner-sm { @apply w-4 h-4 border-2; }

      /* ── Buttons ── */
      .btn {
        @apply inline-flex items-center justify-center gap-2 px-5 py-2 border-none rounded-lg text-sm font-semibold cursor-pointer no-underline transition-all duration-150;
        &:disabled { @apply opacity-50 cursor-not-allowed; }
      }
      .btn-primary {
        background: var(--color-primary);
        color: var(--color-primary-text);
        &:hover:not(:disabled) { background: var(--color-primary-hover); }
      }
      .btn-ghost {
        background: transparent;
        color: var(--color-text-secondary);
        &:hover { color: var(--color-text); }
      }
      .btn-outline {
        background: transparent;
        border: 1px solid var(--color-border);
        color: var(--color-text);
        &:hover { border-color: var(--color-primary); color: var(--color-primary); }
      }
      .btn-full { @apply w-full; }

      /* ── Professional selector ── */
      .prof-selector { @apply flex flex-col gap-2; }
      .prof-option {
        background: var(--color-surface);
        border: 2px solid var(--color-border);
        @apply flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer text-left w-full transition-all duration-150;
        &:hover { border-color: var(--color-primary); }
        &.prof-option--selected { border-color: var(--color-primary); }
      }
      .prof-option-avatar { @apply w-10 h-10 rounded-full object-cover flex-shrink-0; }
      .prof-option-avatar--initials { @apply flex items-center justify-center text-sm font-bold; }
      .prof-option-avatar--any {
        @apply flex items-center justify-center;
        background: var(--color-surface-hover);
        svg { @apply w-5 h-5; color: var(--color-text-disabled); }
      }
      .prof-option-info { @apply flex-1 min-w-0 flex flex-col gap-0.5; }
      .prof-option-name { @apply text-sm font-semibold whitespace-nowrap overflow-hidden text-ellipsis; color: var(--color-text); }
      .prof-option-title { @apply text-xs whitespace-nowrap overflow-hidden text-ellipsis; color: var(--color-text-disabled); }
      .prof-option-check { @apply w-5 h-5 flex-shrink-0; color: var(--color-primary); }
    `,
  ],
})
export class BookingWizardComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private bookingService = inject(BookingPublicService);
  private availabilityService = inject(AvailabilityService);
  private turnstileService = inject(TurnstileService);

  // Route state
  slug = signal<string>("");
  serviceId = signal<string>("");

  // Data
  service = signal<Service | null>(null);
  professionals = signal<Professional[]>([]);
  loadingService = signal(true);

  // Form fields (step 1)
  formName = "";
  formPhone = "";
  formEmail = "";
  formProfessionalId = "";
  errors = signal<Record<string, string>>({});

  // Wizard state
  step = signal(1);

  // Availability / calendar
  busyPeriods = signal<BusyPeriod[]>([]);
  calendarInitialDate = signal<Date | undefined>(undefined);
  loadingAvailability = signal(false);
  selectedSlot = signal<TimeSlot | null>(null);

  // Auto-booking search
  autoSearching = signal(false);
  autoError = signal<string | null>(null);
  isAutoMode = signal(false); // true when user selected "Primera disponible"

  // Submission
  submitting = signal(false);
  submitError = signal<string | null>(null);
  bookingId = signal<string | null>(null);
  failedAvatarIds = signal<Set<string>>(new Set());

  // Pending professional slug (for deep-link with slug instead of UUID)
  private _pendingProfessionalSlug: string | null = null;

  ngOnInit() {
    // Slug from parent route (:slug)
    const parentParams = this.route.parent?.snapshot.paramMap;
    const slugVal = parentParams?.get("slug") ?? this.route.snapshot.paramMap.get("slug") ?? "";
    this.slug.set(slugVal);

    // serviceId from current route
    const svcId = this.route.snapshot.paramMap.get("serviceId") ?? "";
    this.serviceId.set(svcId);

    // Professional pre-selected from query param (supports slug or UUID)
    this.route.queryParams.subscribe((qp) => {
      if (qp["professional"]) {
        const profIdentifier = qp["professional"];
        // If it looks like a slug (contains hyphen and not a UUID), resolve to id after professionals load
        // Otherwise treat as UUID directly
        if (profIdentifier.includes('-') && !this.isUuid(profIdentifier)) {
          this._pendingProfessionalSlug = profIdentifier;
        } else {
          this.formProfessionalId = profIdentifier;
        }
      }
    });

    // Load service data
    if (slugVal) {
      this.bookingService.getServices(slugVal).subscribe({
        next: (res) => {
          const svc = res.services.find((s) => s.id === svcId) ?? null;
          this.service.set(svc);
          // Filtrar solo los profesionales que ofrecen este servicio
          const serviceProfs = (svc?.professionals ?? []).filter(p => !!p.display_name);
          this.professionals.set(serviceProfs);
          applyBrandingColors(res.company?.primary_color, res.company?.secondary_color);

          // Resolve pending professional slug to UUID if needed
          if (this._pendingProfessionalSlug) {
            const target = serviceProfs.find(p => p.slug === this._pendingProfessionalSlug);
            if (target) {
              this.formProfessionalId = target.id;
            }
            this._pendingProfessionalSlug = null;
          }

          this.loadingService.set(false);
        },
        error: () => this.loadingService.set(false),
      });
    }
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  }

  // ── Step 1 ────────────────────────────────────────────────
  goStep2() {
    const errs: Record<string, string> = {};
    if (!this.formName.trim()) errs["name"] = "El nombre es obligatorio";
    if (!this.formPhone.trim()) errs["phone"] = "El teléfono es obligatorio";
    if (!this.formEmail.trim()) errs["email"] = "El email es obligatorio";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.formEmail))
      errs["email"] = "Email no válido";
    this.errors.set(errs);
    if (Object.keys(errs).length === 0) this.step.set(2);
  }

  // ── Step 2 ────────────────────────────────────────────────
  selectMethodAuto() {
    this.autoError.set(null);
    this.autoSearching.set(true);
    this.isAutoMode.set(true);
    const weekStart = this.availabilityService.getWeekStart(new Date());
    this.searchAutoSlot(weekStart, 0);
  }

  private searchAutoSlot(weekStart: Date, weeksChecked: number) {
    if (weeksChecked >= 4) {
      this.autoError.set("No hay disponibilidad en las próximas 4 semanas");
      this.autoSearching.set(false);
      return;
    }
    const weekStr = this.formatDateParam(weekStart);
    const profId = this.formProfessionalId || undefined;
    this.bookingService.getAvailability(this.slug(), weekStr, profId).subscribe({
      next: (res) => {
        const days = this.availabilityService.generateWeekDays(weekStart);
        for (const day of days) {
          const slot = this.availabilityService.getFirstAvailableSlot(
            day,
            res.busy_periods,
            this.service()?.duration_minutes ?? 30,
          );
          if (slot) {
            this.busyPeriods.set(res.busy_periods);
            this.calendarInitialDate.set(slot.datetime);
            this.selectedSlot.set(slot);
            this.autoSearching.set(false);
            this.step.set(3);
            return;
          }
        }
        const next = this.availabilityService.getNextWeek(weekStart);
        this.searchAutoSlot(next, weeksChecked + 1);
      },
      error: () => {
        this.autoError.set("Error al buscar disponibilidad");
        this.autoSearching.set(false);
      },
    });
  }

  clearAutoError() {
    this.autoError.set(null);
  }

  selectMethodManual() {
    // Start at the current week — user wants to see HOY's available slots,
    // and can navigate forward if today's slots are taken.
    const currentWeekStart = this.availabilityService.getWeekStart(new Date());
    this.calendarInitialDate.set(currentWeekStart);
    this.loadAvailability(currentWeekStart);
    this.step.set(3);
  }

  // ── Step 3 ────────────────────────────────────────────────
  private loadAvailability(weekStart: Date) {
    this.loadingAvailability.set(true);
    const profId = this.formProfessionalId || undefined;
    this.bookingService
      .getAvailability(this.slug(), this.formatDateParam(weekStart), profId)
      .subscribe({
        next: (res) => {
          this.busyPeriods.set(res.busy_periods);
          this.loadingAvailability.set(false);
        },
        error: () => this.loadingAvailability.set(false),
      });
  }

  onWeekChanged(weekStart: Date) {
    this.selectedSlot.set(null);
    this.loadAvailability(weekStart);
  }

  onSlotSelected(slot: TimeSlot) {
    this.selectedSlot.set(slot);
    this.submitError.set(null);
  }

  async confirmBooking() {
    const slot = this.selectedSlot();
    const svc = this.service();
    if (!slot || !svc) return;

    this.submitting.set(true);
    this.submitError.set(null);

    let turnstile_token: string;
    try {
      await this.turnstileService.loadScript();
      turnstile_token = await this.turnstileService.renderAndExecute();
    } catch (err) {
      this.submitting.set(false);
      const msg = err instanceof Error ? err.message : String(err);
      this.submitError.set('Error en la verificación de seguridad: ' + msg);
      console.error('Turnstile error:', err);
      return;
    }

    const datetime = this.buildDatetime(slot);
    const [datePart, timePart] = datetime.split('T');
    const finalTime = timePart.substring(0, 5);
    this.bookingService
      .createBooking({
        action: 'create-booking',
        company_slug: this.slug(),
        booking_type_id: svc.id,
        professional_id: this.formProfessionalId || undefined,
        client_name: this.formName,
        client_email: this.formEmail,
        client_phone: this.formPhone || undefined,
        requested_date: datePart,
        requested_time: finalTime,
        turnstile_token,
      })
      .subscribe({
        next: (res) => {
          this.submitting.set(false);
          if (res.success) {
            this.bookingId.set(res.booking_id ?? null);
            this.step.set(4);
          } else {
            this.submitError.set(res.message ?? "Error al crear la reserva");
          }
        },
        error: () => {
          this.submitting.set(false);
          this.submitError.set("No se pudo crear la reserva. Inténtalo de nuevo.");
        },
      });
  }

  // ── Helpers ───────────────────────────────────────────────
  getProfessionalName(): string {
    if (!this.formProfessionalId) return '';
    const prof = this.professionals().find(p => p.id === this.formProfessionalId);
    return prof?.display_name ?? '';
  }

  goBackToMethodSelection() {
    this.isAutoMode.set(false);
    this.selectedSlot.set(null);
    this.step.set(2);
  }

  onAvatarError(id: string): void {
    this.failedAvatarIds.update(s => new Set([...s, id]));
  }

  getInitials(name: string): string {
    if (!name) return '';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  getAvatarColor(name: string): { bg: string; fg: string } {
    const palette = [
      { bg: '#dbeafe', fg: '#1d4ed8' },
      { bg: '#dcfce7', fg: '#15803d' },
      { bg: '#fce7f3', fg: '#9d174d' },
      { bg: '#fef3c7', fg: '#b45309' },
      { bg: '#ede9fe', fg: '#6d28d9' },
    ];
    if (!name) return palette[0];
    const idx = (name.charCodeAt(0) || 0) % palette.length;
    return palette[idx];
  }

  formatSlotDate(slot: TimeSlot): string {
    return slot.datetime.toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }) + " a las " + slot.startTime;
  }

  private formatDateParam(date: Date): string {
    return date.toISOString().split("T")[0];
  }

  private buildDatetime(slot: TimeSlot): string {
    const [hour, minute] = slot.startTime.split(":").map(Number);
    const d = new Date(slot.datetime);
    // Set hours in local time (NOT converting to UTC via toISOString)
    d.setHours(hour, minute, 0, 0);
    // Format as ISO string with timezone offset: "2026-05-11T09:30:00.000+02:00"
    const offset = d.getTimezoneOffset();
    const sign = offset <= 0 ? "+" : "-";
    const absOffset = Math.abs(offset);
    const pad = (n: number) => n.toString().padStart(2, "0");
    const tzStr = `${sign}${pad(Math.floor(absOffset / 60))}:${pad(absOffset % 60)}`;
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.000${tzStr}`;
  }
}

