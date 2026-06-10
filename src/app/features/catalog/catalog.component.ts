import { Component, OnInit, inject, signal, computed } from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { TranslocoModule } from "@jsverse/transloco";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import {
  BookingPublicService,
  Company,
  Service,
  Professional,
  FilterVisibilityItem,
} from "../../services/booking-public.service";
import { applyBrandingColors } from "../../shared/branding.utils";
import { StripHtmlPipe } from "../../shared/pipes/strip-html.pipe";

type Journey = "services" | "professionals" | "duration";
type SortOrder = "default" | "price-asc" | "price-desc" | "duration-asc" | "name";

interface DurationGroup {
  label: string;
  desc: string;
  icon: string;
  min: number;
  max: number;
  color: string;
}

interface JourneyTabDef {
  id: Journey;
  label: string;
  svgPaths: string;
}

@Component({
  selector: "app-catalog",
  standalone: true,
  imports: [RouterLink, TranslocoModule, CommonModule, FormsModule, StripHtmlPipe],
  template: `
    @if (loading()) {
      <div class="catalog-loading">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton-tabs">
          <div class="skeleton skeleton-tab"></div>
          <div class="skeleton skeleton-tab"></div>
          <div class="skeleton skeleton-tab"></div>
        </div>
        <div class="skeleton-grid">
          <div class="skeleton skeleton-card"></div>
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
        <button class="btn btn-primary" (click)="reload()">
          {{ "errors.tryAgain" | transloco }}
        </button>
      </div>
    } @else {
      <div class="catalog-page">
        <div class="catalog-hero">
          <header class="page-header">
            <div class="page-header-identity">
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
              <h1>{{ company()?.name }}</h1>
            </div>
            <p class="page-subtitle">Reserva tu cita online en pocos pasos</p>
          </header>

          <!-- Journey tabs -->
          <div class="journey-tabs">
          @for (tab of visibleTabs(); track tab.id) {
          <button
            class="journey-tab"
            [class.active]="activeTab() === tab.id"
            (click)="setTab(tab.id)"
          >
            <svg class="tab-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="tab.svgPaths"/>
            </svg>
            {{ tab.label }}
          </button>
          }
          </div>
        </div>

        <!-- ── VIEW: Por Servicio ─────────────────────────────────────── -->
        @if (activeTab() === 'services') {
          <div class="view-services">
            <div class="sort-row">
              <span class="count-label">
                {{ services().length }} servicio{{ services().length !== 1 ? 's' : '' }} disponible{{ services().length !== 1 ? 's' : '' }}
              </span>
              <select class="sort-select" [(ngModel)]="sortOrderValue" (ngModelChange)="sortOrder.set($any($event))">
                <option value="default">Orden por defecto</option>
                <option value="price-asc">Precio: menor a mayor</option>
                <option value="price-desc">Precio: mayor a menor</option>
                <option value="duration-asc">Duración: menor a mayor</option>
                <option value="name">Nombre A–Z</option>
              </select>
            </div>
            <div class="services-grid">
              @for (svc of sortedServices(); track svc.id) {
                <ng-container *ngTemplateOutlet="serviceCard; context: { $implicit: svc, profId: null }"></ng-container>
              }
            </div>
          </div>
        }

        <!-- ── VIEW: Por Profesional ─────────────────────────────────── -->
        @if (activeTab() === 'professionals') {
          @if (selectedProfessional()) {
            <!-- Professional detail -->
            <div class="view-prof-detail">
              <button class="back-btn" (click)="backToProfList()">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:1rem;height:1rem">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                </svg>
                Volver al equipo
              </button>
              <div class="prof-detail-header">
                @if (selectedProfessional()?.avatar_url && !failedAvatarIds().has(selectedProfessional()!.id)) {
                  <img [src]="selectedProfessional()!.avatar_url" [alt]="selectedProfessional()!.display_name" class="prof-detail-avatar" (error)="onAvatarError(selectedProfessional()!.id)" />
                } @else {
                  <div class="prof-detail-avatar-placeholder"
                    [style.background]="getAvatarColor(selectedProfessional()!.display_name).bg"
                    [style.color]="getAvatarColor(selectedProfessional()!.display_name).fg">
                    {{ getInitials(selectedProfessional()!.display_name) }}
                  </div>
                }
                <div>
                  <h2 class="prof-detail-name">{{ selectedProfessional()!.display_name }}</h2>
                  <p class="prof-detail-cta">Reserva directamente con este profesional</p>
                </div>
              </div>
              <h3 class="section-label">Servicios disponibles</h3>
              <div class="services-grid">
                @for (svc of (selectedProfessional()!.services ?? []); track svc.id) {
                  <ng-container *ngTemplateOutlet="serviceCard; context: { $implicit: svc, profId: selectedProfessional()!.id }"></ng-container>
                }
              </div>
            </div>
          } @else {
            <!-- Professionals grid -->
            <div class="professionals-view">
              <p class="count-label">
                {{ professionals().length }} profesional{{ professionals().length !== 1 ? 'es' : '' }} disponible{{ professionals().length !== 1 ? 's' : '' }}
              </p>
              <div class="professionals-grid">
                @for (prof of professionals(); track prof.id) {
                  <div class="prof-card" (click)="showProfessionalDetail(prof)">
                    <div class="prof-card-avatar-wrap">
                      @if (prof.avatar_url && !failedAvatarIds().has(prof.id)) {
                        <img [src]="prof.avatar_url" [alt]="prof.display_name" class="prof-card-avatar-img" (error)="onAvatarError(prof.id)" />
                      } @else {
                        <div class="prof-card-avatar-initials"
                          [style.background]="getAvatarColor(prof.display_name).bg"
                          [style.color]="getAvatarColor(prof.display_name).fg">
                          {{ getInitials(prof.display_name) }}
                        </div>
                      }
                    </div>
                    <div class="prof-card-info">
                      <p class="prof-card-name">{{ prof.display_name }}</p>
                      <div class="prof-card-tags">
                        @for (svc of (prof.services ?? []).slice(0, 2); track svc.id) {
                          <span class="prof-tag">{{ svc.name }}</span>
                        }
                      </div>
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        }

        <!-- ── VIEW: Por Duración ─────────────────────────────────────── -->
        @if (activeTab() === 'duration') {
          <div class="view-duration">
            @for (group of durationGroups; track group.label) {
              @if (getGroupServices(group).length > 0) {
                <div class="duration-group">
                  <div class="duration-group-header">
                    <div class="duration-group-icon" [style.background]="group.color + '1a'">{{ group.icon }}</div>
                    <div>
                      <h3 class="duration-group-title">{{ group.label }}</h3>
                      <p class="duration-group-desc">{{ group.desc }}</p>
                    </div>
                    <span class="duration-group-count ml-auto">
                      {{ getGroupServices(group).length }} servicio{{ getGroupServices(group).length !== 1 ? 's' : '' }}
                    </span>
                  </div>
                  <div class="services-grid">
                    @for (svc of getGroupServices(group); track svc.id) {
                      <ng-container *ngTemplateOutlet="serviceCard; context: { $implicit: svc, profId: null }"></ng-container>
                    }
                  </div>
                </div>
              }
            }
          </div>
        }
      </div>
    }

    <!-- Service card template -->
    <ng-template #serviceCard let-svc let-profId="profId">
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
          <div class="service-meta">
            <span class="duration-badge">{{ svc.duration_minutes }} min</span>
            <div class="prof-chips">
              @for (p of (svc.professionals ?? []).filter(p => !!p?.display_name).slice(0, 3); track p.id) {
                <div class="prof-chip"
                  [style.background]="p.avatar_url && !failedAvatarIds().has(p.id) ? 'transparent' : getAvatarColor(p.display_name).bg"
                  [style.color]="getAvatarColor(p.display_name).fg"
                  [title]="p.display_name">
                  @if (p.avatar_url && !failedAvatarIds().has(p.id)) {
                    <img [src]="p.avatar_url" [alt]="p.display_name" class="prof-chip-img" (error)="onAvatarError(p.id)" />
                  } @else {
                    {{ getInitials(p.display_name) }}
                  }
                </div>
              }
            </div>
          </div>
          <a
            class="btn btn-reservar"
            [routerLink]="['/', slug(), 'reservar', svc.id]"
            [queryParams]="profId ? { professional: profId } : {}"
          >Reservar</a>
        </div>
      </div>
    </ng-template>
  `,
  styles: [
    `
      :host { display: block; }

      .page-header-identity {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 0.25rem;
      }
      .page-header-identity h1 { margin: 0; }
      .company-logo {
        width: 3rem;
        height: 3rem;
        border-radius: 0.5rem;
        object-fit: contain;
        background: var(--color-surface);
        padding: 0.25rem;
        box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
        flex-shrink: 0;
      }
      .company-logo-placeholder {
        width: 3rem;
        height: 3rem;
        border-radius: 0.5rem;
        background: var(--color-surface-hover);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .company-logo-placeholder svg { width: 1.5rem; height: 1.5rem; color: var(--color-primary); opacity: 0.7; }

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
      .skeleton-tabs { display: flex; gap: 0.5rem; margin-bottom: 2rem; }
      .skeleton-tab { height: 2.5rem; width: 8rem; border-radius: 9999px; }
      .skeleton-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 1rem;
      }
      .skeleton-card { height: 10rem; border-radius: 0.75rem; }

      /* ── Error state ── */
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

      /* ── Main layout ── */
      .catalog-page {
        max-width: 1100px;
        margin: 0 auto;
        padding: 0 1.5rem 4rem;
      }

      .catalog-hero {
        border-radius: 1rem;
        padding: 2rem 2rem 0 2rem;
        margin-bottom: 1rem;
        background: linear-gradient(135deg, var(--color-surface) 0%, transparent 80%);
      }

      .page-header {
        margin-bottom: 1.5rem;
        padding-top: 1rem;
      }
      .page-header h1 {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--color-text);
        margin: 0 0 0.25rem;
      }
      .page-subtitle { font-size: 0.875rem; color: var(--color-text-secondary); margin: 0; }

      /* ── Journey tabs ── */
      .journey-tabs {
        display: flex;
        gap: 0.25rem;
        overflow-x: auto;
      }
      .journey-tab {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 1.25rem;
        border-radius: 0.5rem;
        border: 1px solid transparent;
        background: transparent;
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--color-text-secondary);
        cursor: pointer;
        white-space: nowrap;
        transition: all 150ms ease;
      }
      .journey-tab:hover { color: var(--color-text); background: var(--color-surface-hover); }
      .journey-tab.active {
        background: var(--color-primary);
        border-color: var(--color-primary);
        color: var(--color-primary-text);
        box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
      }
      .tab-icon { width: 1rem; height: 1rem; flex-shrink: 0; }

      /* ── Sort row ── */
      .sort-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1rem;
      }
      .count-label { font-size: 0.875rem; color: var(--color-text-secondary); }
      .sort-select {
        font-size: 0.875rem;
        border: 1px solid var(--color-border);
        border-radius: 0.375rem;
        padding: 0.25rem 0.75rem;
        background: var(--color-surface);
        color: var(--color-text);
        cursor: pointer;
      }

      /* ── Services grid ── */
      .services-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 1rem;
      }

      /* ── Service card ── */
      .service-card {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 0.75rem;
        padding: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        transition: all 150ms ease;
      }
      .service-card:hover {
        border-color: var(--color-primary);
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(0,0,0,0.12);
      }
      .service-card-top { display: flex; align-items: flex-start; gap: 0.75rem; }
      .service-dot { width: 0.75rem; height: 0.75rem; border-radius: 50%; flex-shrink: 0; margin-top: 0.25rem; }
      .service-card-info { flex: 1; min-width: 0; }
      .service-name { font-size: 1rem; font-weight: 600; margin: 0 0 0.25rem; line-height: 1.2; color: var(--color-text); }
      .service-desc { font-size: 0.75rem; margin: 0; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; color: var(--color-text-secondary); }
      .service-price { font-size: 1.25rem; font-weight: 700; flex-shrink: 0; white-space: nowrap; color: var(--color-text-secondary); }
      .service-card-bottom {
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-top: 1px solid var(--color-border);
        padding-top: 1rem;
      }
      .service-meta { display: flex; align-items: center; gap: 0.5rem; }
      .duration-badge {
        font-size: 0.75rem;
        font-weight: 500;
        padding: 0.125rem 0.5rem;
        border-radius: 9999px;
        background: var(--color-surface-hover);
        border: 1px solid var(--color-border);
        color: var(--color-text-secondary);
      }
      .prof-chips { display: flex; gap: 0.25rem; }
      .prof-chip {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.5rem;
        height: 1.5rem;
        border-radius: 50%;
        overflow: hidden;
        font-size: 0.6rem;
        font-weight: 700;
        flex-shrink: 0;
      }
      .prof-chip-img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .btn-reservar {
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
      .btn-reservar:hover { background: var(--color-primary-hover); }

      /* ── Professionals grid ── */
      .professionals-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 1rem;
        margin-top: 1rem;
      }
      .prof-card {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 0.75rem;
        padding: 1rem;
        cursor: pointer;
        text-align: center;
        transition: all 150ms ease;
      }
      .prof-card:hover {
        border-color: var(--color-primary);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      }
      .prof-card-avatar-wrap {
        aspect-ratio: 1;
        border-radius: 0.5rem;
        overflow: hidden;
        margin-bottom: 0.75rem;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--color-surface-hover);
      }
      .prof-card-avatar-img { width: 100%; height: 100%; object-fit: cover; }
      .prof-card-avatar-initials {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.5rem;
        font-weight: 700;
      }
      .prof-card-info { text-align: center; }
      .prof-card-name {
        font-weight: 700;
        font-size: 0.875rem;
        margin: 0 0 0.25rem;
        color: var(--color-text);
      }
      .prof-card-tags { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.25rem; }
      .prof-tag {
        font-size: 0.6rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        padding: 0.125rem 0.5rem;
        border-radius: 0.125rem;
        background: var(--color-surface-hover);
        border: 1px solid var(--color-border);
        color: var(--color-text-secondary);
      }

      /* ── Professional detail ── */
      .back-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 0;
        margin-bottom: 1.5rem;
        transition: color 150ms ease;
        color: var(--color-text-secondary);
      }
      .back-btn:hover { color: var(--color-text); }
      .prof-detail-header {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        display: flex;
        align-items: center;
        gap: 1.25rem;
        padding: 1.25rem;
        border-radius: 0.75rem;
        margin-bottom: 2rem;
      }
      .prof-detail-avatar {
        width: 4rem;
        height: 4rem;
        border-radius: 50%;
        object-fit: cover;
        flex-shrink: 0;
      }
      .prof-detail-avatar-placeholder {
        width: 4rem;
        height: 4rem;
        border-radius: 50%;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.25rem;
        font-weight: 700;
      }
      .prof-detail-name {
        font-size: 1.25rem;
        font-weight: 700;
        margin: 0 0 0.25rem;
        color: var(--color-text);
      }
      .prof-detail-cta {
        font-size: 0.75rem;
        font-weight: 500;
        margin: 0.25rem 0;
        color: var(--color-primary);
      }
      .section-label {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin: 0 0 1rem;
        color: var(--color-text-disabled);
      }

      /* ── Duration view ── */
      .duration-group { margin-bottom: 2.5rem; }
      .duration-group-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
      .duration-group-icon {
        width: 2.25rem;
        height: 2.25rem;
        border-radius: 0.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.125rem;
        flex-shrink: 0;
      }
      .duration-group-title { font-size: 1rem; font-weight: 600; margin: 0; color: var(--color-text); }
      .duration-group-desc { font-size: 0.75rem; margin: 0; color: var(--color-text-disabled); }
      .duration-group-count { font-size: 0.875rem; margin: 0; margin-left: auto; color: var(--color-text-secondary); }
      .ml-auto { margin-left: auto; }

      /* ── Shared btn ── */
      .btn {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 0.375rem;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        text-decoration: none;
        transition: all 150ms ease;
      }
      .btn-primary { background: var(--color-primary); color: var(--color-primary-text); }
      .btn-primary:hover { background: var(--color-primary-hover); }

      /* ── Mobile: full-width single column ── */
      @media (max-width: 640px) {
        .catalog-page {
          padding: 0 0.75rem 4rem;
        }
        .catalog-hero {
          padding: 1.25rem 0.75rem 0 0.75rem;
          border-radius: 0.75rem;
        }
        .page-header { padding-top: 0.5rem; }
        .page-header h1 { font-size: 1.25rem; }

        .services-grid {
          grid-template-columns: 1fr;
          gap: 0.75rem;
        }
        .service-card {
          width: 100%;
          padding: 1rem;
        }

        .professionals-grid {
          grid-template-columns: 1fr;
          gap: 0.75rem;
        }
        .prof-card {
          width: 100%;
          display: flex;
          align-items: center;
          text-align: left;
          padding: 0.75rem;
          gap: 0.75rem;
        }
        .prof-card-avatar-wrap {
          width: 3rem;
          height: 3rem;
          aspect-ratio: auto;
          flex-shrink: 0;
          margin-bottom: 0;
        }
        .prof-card-info { text-align: left; flex: 1; min-width: 0; }
        .prof-card-tags { justify-content: flex-start; }

        .prof-detail-header {
          padding: 1rem;
          gap: 0.75rem;
        }
        .prof-detail-avatar,
        .prof-detail-avatar-placeholder {
          width: 3rem;
          height: 3rem;
        }
        .prof-detail-name { font-size: 1.05rem; }

        .sort-row {
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .sort-select {
          flex: 1;
          min-width: 0;
        }

        .service-card-bottom {
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .service-card-info { min-width: 0; }
      }
    `,
  ],
})
export class CatalogComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private bookingService = inject(BookingPublicService);

  slug = signal<string>("");
  company = signal<Company | null>(null);
  services = signal<Service[]>([]);
  professionals = signal<Professional[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  activeTab = signal<Journey>("services");
  // Tabs enabled by the CRM (Reservas > Configuración > General > "Filtros Visibles en el Portal").
  // Populated from BFF response `company.enabled_filters`. Defaults to all three
  // tabs visible until the BFF tells us otherwise, so a missing field is safe.
  enabledTabs = signal<Set<Journey>>(
    new Set<Journey>(["services", "professionals", "duration"]),
  );

  isTabEnabled(tab: Journey): boolean {
    return this.enabledTabs().has(tab);
  }
  sortOrder = signal<SortOrder>("default");
  sortOrderValue: SortOrder = "default";
  selectedProfessional = signal<Professional | null>(null);
  failedAvatarIds = signal<Set<string>>(new Set());
  private deepLinkProfessionalId: string | null = null;
  private deepLinkProfessionalSlug: string | null = null;

  /** Visibility filter IDs from Supabase. Empty Set = no config loaded yet or "show all". */
  visibleFilterIds = signal<Set<string>>(new Set());

  /** All available journey tab definitions. */
  private readonly allJourneyTabs: JourneyTabDef[] = [
    {
      id: "services",
      label: "Por Servicio",
      svgPaths:
        "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
    },
    {
      id: "professionals",
      label: "Por Profesional",
      svgPaths:
        "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
    },
    {
      id: "duration",
      label: "Por Duración",
      svgPaths: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    },
  ];

  /** Journey tabs filtered by visibility config. Empty config → show all. */
  visibleTabs = computed(() => {
    const visIds = this.visibleFilterIds();
    // Empty Set means: not yet loaded OR error OR no visibility rows → show all
    if (visIds.size === 0) return this.allJourneyTabs;
    return this.allJourneyTabs.filter((t) => visIds.has(t.id));
  });

  readonly durationGroups: DurationGroup[] = [
    { label: "Sesiones rápidas",  desc: "30 min o menos",  icon: "⚡", min: 0,  max: 30,       color: "#10B981" },
    { label: "Sesiones estándar", desc: "31 a 60 min",     icon: "⏱", min: 31, max: 60,       color: "#3B82F6" },
    { label: "Sesiones largas",   desc: "Más de 60 min",   icon: "✨", min: 61, max: Infinity, color: "#8B5CF6" },
  ];

  sortedServices = computed(() => {
    const list = [...this.services()];
    switch (this.sortOrder()) {
      case "price-asc":    return list.sort((a, b) => (a.price ?? 9999) - (b.price ?? 9999));
      case "price-desc":   return list.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
      case "duration-asc": return list.sort((a, b) => a.duration_minutes - b.duration_minutes);
      case "name":         return list.sort((a, b) => a.name.localeCompare(b.name, "es"));
      default:             return list;
    }
  });

  getGroupServices(group: DurationGroup): Service[] {
    return this.services().filter(
      (s) => s.duration_minutes >= group.min && s.duration_minutes <= group.max,
    );
  }

  onAvatarError(id: string): void {
    this.failedAvatarIds.update(s => new Set([...s, id]));
  }

  getInitials(name: string): string {
    if (!name) return '';
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  getAvatarColor(name: string): { bg: string; fg: string } {
    const palette = [
      { bg: "#dbeafe", fg: "#1d4ed8" },
      { bg: "#dcfce7", fg: "#15803d" },
      { bg: "#fce7f3", fg: "#9d174d" },
      { bg: "#fef3c7", fg: "#b45309" },
      { bg: "#ede9fe", fg: "#6d28d9" },
    ];
    if (!name) return palette[0];
    const idx = (name.charCodeAt(0) || 0) % palette.length;
    return palette[idx];
  }

  setTab(tab: Journey) {
    // Guard: don't allow switching to a hidden tab
    const visible = this.visibleTabs();
    if (!visible.some((t) => t.id === tab)) return;
    this.activeTab.set(tab);
    this.selectedProfessional.set(null);
  }

  showProfessionalDetail(prof: Professional) {
    this.selectedProfessional.set(prof);
  }

  backToProfList() {
    this.selectedProfessional.set(null);
  }

  reload() {
    const slug = this.slug();
    if (slug) this.loadData(slug);
  }

  ngOnInit() {
    // Capture professional deep-link query params (slug or UUID) before data load
    this.deepLinkProfessionalSlug =
      this.route.snapshot.queryParamMap.get("professional") ??
      this.route.parent?.snapshot.queryParamMap.get("professional") ??
      null;
    this.deepLinkProfessionalId =
      this.route.snapshot.queryParamMap.get("professional_id") ??
      this.route.parent?.snapshot.queryParamMap.get("professional_id") ??
      null;

    // Try parent route first (nested under /:slug)
    const parentParams = this.route.parent?.snapshot.paramMap;
    const slugFromParent = parentParams?.get("slug");
    if (slugFromParent) {
      this.slug.set(slugFromParent);
      this.loadData(slugFromParent);
      return;
    }
    // Fallback: own params
    this.route.paramMap.subscribe((params) => {
      const s = params.get("slug");
      if (s) {
        this.slug.set(s);
        this.loadData(s);
      }
    });
  }

  private loadData(slug: string) {
    this.loading.set(true);
    this.error.set(null);
    this.bookingService.getServices(slug).subscribe({
      next: (res) => {
        this.company.set(res.company);
        applyBrandingColors(res.company?.primary_color, res.company?.secondary_color);
        this.services.set(res.services);

        // Sync tab visibility from CRM (Reservas > Configuración > General).
        // If the BFF returns enabled_filters, use it. Otherwise keep the
        // default (all three visible) — matches the BFF fallback.
        const enabled = res.company?.enabled_filters;
        if (Array.isArray(enabled)) {
          this.enabledTabs.set(new Set<Journey>(enabled));
          // If the current active tab is no longer enabled, fall back to the
          // first enabled tab so the user always lands on a visible view.
          if (!this.isTabEnabled(this.activeTab())) {
            const fallback = (["services", "professionals", "duration"] as Journey[])
              .find((t) => this.isTabEnabled(t));
            if (fallback) this.activeTab.set(fallback);
          }
        }

        // Build professionals enriched with their services.
        const topLevel = res.professionals ?? [];
        const profMap = new Map<string, Professional>();
        for (const svc of (res.services ?? [])) {
          for (const p of (svc.professionals ?? []).filter((p: Professional) => p?.id && p?.display_name)) {
            if (!profMap.has(p.id)) {
              const full = topLevel.find((fp) => fp.id === p.id);
              profMap.set(p.id, { ...(full ?? p), services: [] });
            }
            profMap.get(p.id)!.services!.push(svc);
          }
        }
        const professionals = profMap.size > 0
          ? Array.from(profMap.values())
          : topLevel;
        this.professionals.set(professionals);

        // Deep-link: if a professional slug or id was in the URL, auto-select them
        if (this.deepLinkProfessionalSlug) {
          const target = professionals.find(p => p.slug === this.deepLinkProfessionalSlug);
          if (target) {
            this.activeTab.set('professionals');
            this.selectedProfessional.set(target);
          }
          this.deepLinkProfessionalSlug = null;
          this.deepLinkProfessionalId = null;
        } else if (this.deepLinkProfessionalId) {
          const target = professionals.find(p => p.id === this.deepLinkProfessionalId);
          if (target) {
            this.activeTab.set('professionals');
            this.selectedProfessional.set(target);
          }
          this.deepLinkProfessionalId = null;
        }

        // Fetch filter visibility config for this company
        this.fetchFilterVisibility(res.company.id);

        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || "Error al cargar los servicios");
        this.loading.set(false);
      },
    });
  }

  /**
   * Fetch company filter visibility from Supabase edge function.
   * On success: populates visibleFilterIds with only the IDs marked visible.
   * On error / no config: keeps visibleFilterIds empty → show all.
   * If the currently active tab becomes hidden, auto-switch to first visible.
   */
  private fetchFilterVisibility(companyId: string): void {
    this.bookingService.getFilterVisibility(companyId).subscribe({
      next: (filters) => {
        const visibleIds = new Set<string>(
          filters.filter((f) => f.visible).map((f) => f.id),
        );
        this.visibleFilterIds.set(visibleIds);

        // If active tab is now hidden, switch to first visible
        if (visibleIds.size > 0 && !visibleIds.has(this.activeTab())) {
          const firstVisible = this.allJourneyTabs.find((t) =>
            visibleIds.has(t.id),
          );
          if (firstVisible) {
            this.activeTab.set(firstVisible.id);
          }
        }
      },
      error: () => {
        // Error → keep empty Set → show all tabs (default behavior)
        // visibleFilterIds already defaults to empty Set, no action needed
      },
    });
  }
}
