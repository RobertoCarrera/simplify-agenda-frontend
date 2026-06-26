import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ElementRef,
} from "@angular/core";
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
import { CartService } from "../../shared/services/cart.service";
import { FlyToCartService } from "../../shared/services/fly-to-cart.service";
import {
  applySavedOrder,
  OrderPreferenceService,
} from "../../shared/services/order-preference.service";

/**
 * Tabbed portal shell. When a company has 2+ portal modes active
 * (booking + catalog + shop), this renders a top tab strip and shows
 * only the active section — so the customer doesn't have to scroll
 * through everything. When only one mode is active, the tab strip
 * is hidden and the corresponding section renders directly.
 *
 * The active tab defaults to `portal_features.default_mode` if set,
 * otherwise the first active mode in order booking > catalog > shop.
 * The owner can change the default from CRM Settings.
 *
 * Accessibility:
 *   - The tab strip is `role="tablist"` with `aria-label`.
 *   - Each tab is a `<button role="tab" aria-selected aria-controls>`.
 *   - The section is `role="tabpanel"` with `aria-labelledby` pointing
 *     to the active tab.
 *   - Left/Right arrow keys move focus between tabs and activate them.
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
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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

        @if (activeModeCount() >= 2) {
          <nav class="portal-tabs" role="tablist" aria-label="Secciones del portal">
            @if (bookingVisible()) {
              <button
                type="button"
                role="tab"
                class="portal-tab"
                [id]="tabId('booking')"
                [attr.aria-selected]="activeTab() === 'booking'"
                [attr.aria-controls]="panelId('booking')"
                [attr.tabindex]="activeTab() === 'booking' ? 0 : -1"
                (click)="setTab('booking')"
                (keydown)="onTabKeydown($event, 'booking')"
              >
                <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                  <polyline points="9 16 11 18 15 14"></polyline>
                </svg>
                Reservar cita
              </button>
            }
            @if (catalogVisible()) {
              <button
                type="button"
                role="tab"
                class="portal-tab"
                [id]="tabId('catalog')"
                [attr.aria-selected]="activeTab() === 'catalog'"
                [attr.aria-controls]="panelId('catalog')"
                [attr.tabindex]="activeTab() === 'catalog' ? 0 : -1"
                (click)="setTab('catalog')"
                (keydown)="onTabKeydown($event, 'catalog')"
              >
                <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <line x1="8" y1="6" x2="21" y2="6"></line>
                  <line x1="8" y1="12" x2="21" y2="12"></line>
                  <line x1="8" y1="18" x2="21" y2="18"></line>
                  <line x1="3" y1="6" x2="3.01" y2="6"></line>
                  <line x1="3" y1="12" x2="3.01" y2="12"></line>
                  <line x1="3" y1="18" x2="3.01" y2="18"></line>
                </svg>
                Servicios y planes
              </button>
            }
            @if (shopVisible()) {
              <button
                type="button"
                role="tab"
                class="portal-tab"
                [id]="tabId('shop')"
                [attr.aria-selected]="activeTab() === 'shop'"
                [attr.aria-controls]="panelId('shop')"
                [attr.tabindex]="activeTab() === 'shop' ? 0 : -1"
                (click)="setTab('shop')"
                (keydown)="onTabKeydown($event, 'shop')"
              >
                <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <path d="M16 10a4 4 0 0 1-8 0"></path>
                </svg>
                Tienda
              </button>
            }
          </nav>
        }

        @switch (activeTab()) {
          @case ('booking') {
            <section
              [id]="panelId('booking')"
              role="tabpanel"
              [attr.aria-labelledby]="tabId('booking')"
              class="portal-section"
            >
              <h2 class="section-title">
                <svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                  <polyline points="9 16 11 18 15 14"></polyline>
                </svg>
                Reservar cita
              </h2>
              <p class="section-subtitle">
                <span>Elige un servicio y un horario disponible.</span>
                @if (hasCustomBookingOrder()) {
                  <button
                    type="button"
                    class="reset-order-btn"
                    (click)="resetOrder('booking', $event)"
                    title="Volver al orden por defecto"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <polyline points="1 4 1 10 7 10"></polyline>
                      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                    </svg>
                    Restablecer orden
                  </button>
                }
              </p>
              @if (bookingVisible()) {
                <div class="services-grid">
                  @for (svc of bookableServices(); track svc.id) {
                    <div
                      class="service-card"
                      [class.is-dragging]="isDragging(svc.id)"
                      [class.is-drop-target-before]="isDropTarget(svc.id) && dropIndicatorSide() === 'before'"
                      [class.is-drop-target-after]="isDropTarget(svc.id) && dropIndicatorSide() === 'after'"
                      draggable="true"
                      (dragstart)="onDragStart($event, svc.id)"
                      (dragover)="onDragOver($event, svc.id)"
                      (drop)="onDrop($event, svc.id)"
                      (dragend)="onDragEnd()"
                    >
                      <button
                        type="button"
                        class="drag-handle"
                        aria-label="Reordenar este servicio"
                        title="Arrastra para reordenar"
                        tabindex="-1"
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <circle cx="9" cy="6" r="1.5"></circle>
                          <circle cx="15" cy="6" r="1.5"></circle>
                          <circle cx="9" cy="12" r="1.5"></circle>
                          <circle cx="15" cy="12" r="1.5"></circle>
                          <circle cx="9" cy="18" r="1.5"></circle>
                          <circle cx="15" cy="18" r="1.5"></circle>
                        </svg>
                      </button>
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
              } @else {
                <div class="section-empty">No hay servicios disponibles para reservar.</div>
              }
            </section>
          }
          @case ('catalog') {
            <section
              [id]="panelId('catalog')"
              role="tabpanel"
              [attr.aria-labelledby]="tabId('catalog')"
              class="portal-section"
            >
              <h2 class="section-title">
                <svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <line x1="8" y1="6" x2="21" y2="6"></line>
                  <line x1="8" y1="12" x2="21" y2="12"></line>
                  <line x1="8" y1="18" x2="21" y2="18"></line>
                  <line x1="3" y1="6" x2="3.01" y2="6"></line>
                  <line x1="3" y1="12" x2="3.01" y2="12"></line>
                  <line x1="3" y1="18" x2="3.01" y2="18"></line>
                </svg>
                Servicios y planes
              </h2>
              <p class="section-subtitle">
                <span>Contrata un servicio o un plan sin elegir horario.</span>
                @if (hasCustomCatalogOrder()) {
                  <button
                    type="button"
                    class="reset-order-btn"
                    (click)="resetOrder('catalog', $event)"
                    title="Volver al orden por defecto"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <polyline points="1 4 1 10 7 10"></polyline>
                      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                    </svg>
                    Restablecer orden
                  </button>
                }
              </p>
              @if (catalogVisible()) {
                <div class="services-grid">
                  @for (svc of catalogServices(); track svc.id) {
                    <div
                      class="service-card"
                      [class.is-dragging]="isDragging(svc.id)"
                      [class.is-drop-target-before]="isDropTarget(svc.id) && dropIndicatorSide() === 'before'"
                      [class.is-drop-target-after]="isDropTarget(svc.id) && dropIndicatorSide() === 'after'"
                      draggable="true"
                      (dragstart)="onDragStart($event, svc.id)"
                      (dragover)="onDragOver($event, svc.id)"
                      (drop)="onDrop($event, svc.id)"
                      (dragend)="onDragEnd()"
                    >
                      <button
                        type="button"
                        class="drag-handle"
                        aria-label="Reordenar este servicio"
                        title="Arrastra para reordenar"
                        tabindex="-1"
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <circle cx="9" cy="6" r="1.5"></circle>
                          <circle cx="15" cy="6" r="1.5"></circle>
                          <circle cx="9" cy="12" r="1.5"></circle>
                          <circle cx="15" cy="12" r="1.5"></circle>
                          <circle cx="9" cy="18" r="1.5"></circle>
                          <circle cx="15" cy="18" r="1.5"></circle>
                        </svg>
                      </button>
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
              } @else {
                <div class="section-empty">No hay servicios en el catálogo.</div>
              }
            </section>
          }
          @case ('shop') {
            <section
              [id]="panelId('shop')"
              role="tabpanel"
              [attr.aria-labelledby]="tabId('shop')"
              class="portal-section"
            >
              <h2 class="section-title">
                <svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <path d="M16 10a4 4 0 0 1-8 0"></path>
                </svg>
                Productos
              </h2>
              <p class="section-subtitle">
                <span>Explora nuestros productos.</span>
                @if (hasCustomShopOrder()) {
                  <button
                    type="button"
                    class="reset-order-btn"
                    (click)="resetOrder('shop', $event)"
                    title="Volver al orden por defecto"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <polyline points="1 4 1 10 7 10"></polyline>
                      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                    </svg>
                    Restablecer orden
                  </button>
                }
              </p>
              @if (shopVisible()) {
                <div class="products-grid">
                  @for (product of productsForView(); track product.id) {
                    <div
                      class="product-card"
                      [class.is-dragging]="isDragging(product.id)"
                      [class.is-drop-target-before]="isDropTarget(product.id) && dropIndicatorSide() === 'before'"
                      [class.is-drop-target-after]="isDropTarget(product.id) && dropIndicatorSide() === 'after'"
                      draggable="true"
                      (dragstart)="onDragStart($event, product.id)"
                      (dragover)="onDragOver($event, product.id)"
                      (drop)="onDrop($event, product.id)"
                      (dragend)="onDragEnd()"
                    >
                      <button
                        type="button"
                        class="drag-handle"
                        aria-label="Reordenar este producto"
                        title="Arrastra para reordenar"
                        tabindex="-1"
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <circle cx="9" cy="6" r="1.5"></circle>
                          <circle cx="15" cy="6" r="1.5"></circle>
                          <circle cx="9" cy="12" r="1.5"></circle>
                          <circle cx="15" cy="12" r="1.5"></circle>
                          <circle cx="9" cy="18" r="1.5"></circle>
                          <circle cx="15" cy="18" r="1.5"></circle>
                        </svg>
                      </button>
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
                        <button type="button" class="btn-add" (click)="addToCart($event, product)">
                          Añadir al carrito
                        </button>
                      </div>
                    </div>
                  }
                </div>
              } @else {
                <div class="section-empty">No hay productos en la tienda.</div>
              }
            </section>
          }
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

      /* ── Tab strip ── */
      .portal-tabs {
        display: flex;
        gap: 0.125rem;
        border-bottom: 1px solid var(--color-border);
        margin-bottom: 2rem;
        scrollbar-width: thin;
      }
      .portal-tab {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1.25rem;
        background: transparent;
        border: none;
        border-bottom: 2px solid transparent;
        margin-bottom: -1px;
        font-size: 0.9375rem;
        font-weight: 500;
        font-family: inherit;
        color: var(--color-text-secondary);
        cursor: pointer;
        white-space: nowrap;
        transition: color 150ms ease, border-color 150ms ease;
      }
      .portal-tab:hover { color: var(--color-text); }
      .portal-tab[aria-selected="true"] {
        color: var(--color-primary);
        border-bottom-color: var(--color-primary);
      }
      .portal-tab:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: -2px;
        border-radius: 0.25rem 0.25rem 0 0;
      }
      .portal-tab .tab-icon {
        width: 1.125rem;
        height: 1.125rem;
        flex-shrink: 0;
      }

      .portal-section {
        margin-bottom: 2rem;
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
      .section-title .section-icon {
        color: var(--color-primary);
        width: 1.375rem;
        height: 1.375rem;
        flex-shrink: 0;
      }
      .section-subtitle {
        font-size: 0.875rem;
        color: var(--color-text-secondary);
        margin: 0 0 1.25rem;
      }
      .section-empty {
        text-align: center;
        padding: 2.5rem 1rem;
        color: var(--color-text-secondary);
        background: var(--color-surface);
        border: 1px dashed var(--color-border);
        border-radius: 0.625rem;
        font-size: 0.9375rem;
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
        padding: 1.5rem 1.5rem 1.5rem 1.5rem;
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
        font-family: inherit;
      }
      .btn-contratar:hover, .btn-add:hover { filter: brightness(1.1); }

      @media (max-width: 640px) {
        .portal-page { padding: 1rem 0.75rem 3rem; }
        .portal-header h1 { font-size: 1.35rem; }
        .portal-tab { padding: 0.625rem 0.875rem; font-size: 0.875rem; }
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
  private cartService = inject(CartService);
  private flyToCart = inject(FlyToCartService);
  private orderPref = inject(OrderPreferenceService);
  private hostEl = inject(ElementRef<HTMLElement>);

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

  /** Which tab is currently active. One of "booking" | "catalog" | "shop". */
  activeTab = signal<"booking" | "catalog" | "shop">("booking");

  /**
   * Whether each section is actually renderable (mode active AND has data).
   * Drives both the tab strip and the empty-state inside each panel.
   */
  bookingVisible = computed(
    () => this.features().show_booking && this.bookableServices().length > 0,
  );
  catalogVisible = computed(
    () => this.features().show_catalog && this.catalogServices().length > 0,
  );
  shopVisible = computed(
    () => this.features().show_shop && this.products().length > 0,
  );

  /**
   * How many sections are renderable. Drives whether the tab strip
   * shows at all (1 section = no tabs, go straight to it).
   */
  activeModeCount = computed(
    () =>
      (this.bookingVisible() ? 1 : 0) +
      (this.catalogVisible() ? 1 : 0) +
      (this.shopVisible() ? 1 : 0),
  );

  /** Services visible in the booking section. */
  /**
   * Services visible in the booking section. The customer's saved
   * display order (per company, per section, in localStorage) is
   * applied on top of the backend's natural order.
   */
  bookableServices = computed<Service[]>(() =>
    applySavedOrder(this.services(), this.bookingOrder()),
  );
  /** Services visible in the catalog section. */
  catalogServices = computed<Service[]>(() =>
    applySavedOrder(this.services(), this.catalogOrder()),
  );
  /**
   * Products are shown in their saved display order if the customer
   * has reordered them, otherwise in the backend's natural order.
   */
  productsForView = computed<Product[]>(() =>
    applySavedOrder(this.products(), this.shopOrder()),
  );

  /**
   * Per-section saved orders, loaded from localStorage on init and
   * kept in sync with the user's drag-and-drop. Each is a record
   * keyed by item id. The three signals are independent because the
   * user can reorder each tab separately.
   */
  private bookingOrder = signal<string[] | null>(null);
  private catalogOrder = signal<string[] | null>(null);
  private shopOrder = signal<string[] | null>(null);

  /**
   * Whether each section currently has a saved custom order. Used to
   * show or hide the "Reset order" button per tab.
   */
  hasCustomBookingOrder = computed(() => this.bookingOrder() !== null);
  hasCustomCatalogOrder = computed(() => this.catalogOrder() !== null);
  hasCustomShopOrder = computed(() => this.shopOrder() !== null);

  /**
   * Id of the item currently being dragged. Used to apply the
   * "dragging" CSS class to the source card and the "drop-target"
   * class to the hovered card. Empty string = no drag in progress.
   */
  private draggedId = signal<string>("");

  /**
   * Id of the item that the dragged card is hovering over. The card
   * shows a visual placeholder (a colored line) on the side where
   * the drop would land (before or after the hovered item).
   */
  private dropTargetId = signal<string>("");
  /** "before" | "after" — which side of the target the drop lands on. */
  private dropSide = signal<"before" | "after">("after");

  ngOnInit() {
    const parentParams = this.route.parent?.snapshot.paramMap;
    const slug = parentParams?.get("slug") ?? this.route.snapshot.paramMap.get("slug") ?? "";
    this.slug.set(slug);
    if (!slug) {
      this.loadError.set("Falta el slug de la empresa");
      this.loading.set(false);
      return;
    }
    // Load any saved custom orders BEFORE the data lands, so the
    // computed signals can apply them as soon as services/products
    // are populated.
    this.bookingOrder.set(this.orderPref.getOrder(slug, "booking"));
    this.catalogOrder.set(this.orderPref.getOrder(slug, "catalog"));
    this.shopOrder.set(this.orderPref.getOrder(slug, "shop"));

    this.bookingService.getServices(slug).subscribe({
      next: (res) => {
        applyBrandingColors(res.company?.primary_color, res.company?.secondary_color);
        this.company.set(res.company ?? null);
        this.services.set(res.services ?? []);
        this.products.set(res.products ?? []);
        this.features.set(resolvePortalFeatures(res.company ?? null));
        this.loading.set(false);
        // Pick the initial active tab once the data is loaded.
        this.activeTab.set(this.pickInitialTab());
      },
      error: (err) => {
        this.loadError.set(err?.error?.error || err.message || "Error al cargar el portal");
        this.loading.set(false);
      },
    });
  }

  /**
   * Choose which tab to show first:
   *   1. portal_features.default_mode, if that mode is active and has data.
   *   2. Otherwise, the first active mode in order: booking > catalog > shop.
   *   3. If no mode is renderable, fall back to "booking" so the @switch
   *      always lands on a valid branch.
   */
  private pickInitialTab(): "booking" | "catalog" | "shop" {
    const wanted = this.features().default_mode;
    if (wanted === "booking" && this.bookingVisible()) return "booking";
    if (wanted === "catalog" && this.catalogVisible()) return "catalog";
    if (wanted === "shop" && this.shopVisible()) return "shop";
    if (this.bookingVisible()) return "booking";
    if (this.catalogVisible()) return "catalog";
    if (this.shopVisible()) return "shop";
    return "booking";
  }

  /** Switch to a tab and move focus to its button. */
  setTab(tab: "booking" | "catalog" | "shop") {
    if (this.activeTab() === tab) return;
    this.activeTab.set(tab);
    // Move DOM focus to the newly-active tab so screen readers
    // announce the change and keyboard users keep a consistent
    // focus origin.
    queueMicrotask(() => {
      const el = this.hostEl.nativeElement.querySelector(
        `#${this.tabId(tab)}`,
      );
      if (el instanceof HTMLElement) {
        el.focus();
      }
    });
  }

  /**
   * Keyboard navigation for the tab strip:
   *   ArrowRight / ArrowDown → next tab
   *   ArrowLeft / ArrowUp   → previous tab
   *   Home                   → first tab
   *   End                    → last tab
   * Standard ARIA Authoring Practices for tabs.
   */
  onTabKeydown(event: KeyboardEvent, current: "booking" | "catalog" | "shop") {
    const order: Array<"booking" | "catalog" | "shop"> = ["booking", "catalog", "shop"];
    // Only consider tabs that are actually visible.
    const visible = order.filter((t) => this.tabVisible(t));
    if (visible.length === 0) return;

    const idx = visible.indexOf(current);
    let next: "booking" | "catalog" | "shop" | null = null;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = visible[(idx + 1) % visible.length];
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = visible[(idx - 1 + visible.length) % visible.length];
        break;
      case "Home":
        next = visible[0];
        break;
      case "End":
        next = visible[visible.length - 1];
        break;
      default:
        return;
    }

    if (next && next !== current) {
      event.preventDefault();
      this.setTab(next);
    }
  }

  // ─── Drag-and-drop reordering ──────────────────────────────────
  // The customer can drag any service or product card to a new
  // position within the same section. Order is persisted to
  // localStorage via OrderPreferenceService. When the customer later
  // wants a real CMS, this service is the only swap point.

  /**
   * Which list an item belongs to. Used by the drag handlers so they
   * know which signal to read and which to write.
   */
  private sectionOfId(id: string): "booking" | "catalog" | "shop" | null {
    if (this.bookableServices().some((s) => s.id === id)) return "booking";
    if (this.catalogServices().some((s) => s.id === id)) return "catalog";
    if (this.productsForView().some((p) => p.id === id)) return "shop";
    return null;
  }

  /**
   * True if this card is currently the drag source. Used to apply
   * the .dragging CSS class.
   */
  isDragging(id: string): boolean {
    return this.draggedId() === id;
  }

  /**
   * True if this card is the hover target for the current drag.
   * Used to apply the .drop-target CSS class.
   */
  isDropTarget(id: string): boolean {
    return this.dropTargetId() === id;
  }

  /**
   * Which side of the drop target the drop will land on. "before"
   * means the dragged item will end up just before the target;
   * "after" means just after. The template uses this to show a
   * visual line on the appropriate edge.
   */
  dropIndicatorSide(): "before" | "after" {
    return this.dropSide();
  }

  /** Beginning of a drag — record the source id and set drag data. */
  onDragStart(event: DragEvent, id: string) {
    this.draggedId.set(id);
    if (event.dataTransfer) {
      // Required for Firefox to actually start the drag.
      event.dataTransfer.setData("text/plain", id);
      // Move the ghost image slightly so the cursor doesn't hide it.
      event.dataTransfer.effectAllowed = "move";
    }
  }

  /**
   * Allow drop by preventing default. We use the cursor's Y position
   * within the hovered card to decide whether the drop should land
   * before or after it.
   */
  onDragOver(event: DragEvent, hoveredId: string) {
    if (!this.draggedId()) return;
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
    if (this.dropTargetId() !== hoveredId) {
      this.dropTargetId.set(hoveredId);
    }
    // Decide before/after based on which half of the card the cursor
    // is over. The threshold is the vertical midpoint of the card.
    const target = event.currentTarget;
    if (target instanceof HTMLElement) {
      const rect = target.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      this.dropSide.set(event.clientY < midpoint ? "before" : "after");
    }
  }

  /** Drop handler — reorder the items in the section. */
  onDrop(event: DragEvent, targetId: string) {
    if (!this.draggedId()) return;
    event.preventDefault();
    const draggedId = this.draggedId();

    // Don't allow dropping onto itself.
    if (draggedId === targetId) {
      this.resetDragState();
      return;
    }

    const section = this.sectionOfId(draggedId);
    if (!section) {
      this.resetDragState();
      return;
    }

    // Reorder within the right section.
    if (section === "booking") {
      this.reorder(this.bookableServices(), this.bookingOrder, "booking", draggedId, targetId);
    } else if (section === "catalog") {
      this.reorder(this.catalogServices(), this.catalogOrder, "catalog", draggedId, targetId);
    } else {
      this.reorder(this.productsForView(), this.shopOrder, "shop", draggedId, targetId);
    }
    this.resetDragState();
  }

  /**
   * Reorder `items` by moving `draggedId` to the position adjacent
   * to `targetId` (the side determined by the last dragover). Persist
   * the new order via the supplied order signal AND localStorage.
   */
  private reorder<T extends { id: string }>(
    items: readonly T[],
    orderSignal: { set: (ids: string[] | null) => void; (): string[] | null },
    section: "booking" | "catalog" | "shop",
    draggedId: string,
    targetId: string,
  ) {
    const currentOrder =
      orderSignal() ?? items.map((it) => it.id);
    // Filter out the dragged id and reinsert at the target position.
    const without = currentOrder.filter((id) => id !== draggedId);
    const targetIdx = without.indexOf(targetId);
    if (targetIdx < 0) {
      // Target not in the order — fall back to appending at the end.
      without.push(draggedId);
    } else {
      const insertAt = this.dropSide() === "before" ? targetIdx : targetIdx + 1;
      without.splice(insertAt, 0, draggedId);
    }
    orderSignal.set(without);
    if (this.slug()) {
      this.orderPref.setOrder(this.slug(), section, without);
    }
  }

  /** Clear drag state. Called on dragend regardless of outcome. */
  onDragEnd() {
    this.resetDragState();
  }

  private resetDragState() {
    this.draggedId.set("");
    this.dropTargetId.set("");
    this.dropSide.set("after");
  }

  /**
   * Clear the saved custom order for a section, returning the agenda
   * to the backend's natural ordering on next render.
   */
  resetOrder(section: "booking" | "catalog" | "shop", event: Event) {
    event.preventDefault();
    event.stopPropagation();
    if (!this.slug()) return;
    this.orderPref.reset(this.slug(), section);
    if (section === "booking") this.bookingOrder.set(null);
    else if (section === "catalog") this.catalogOrder.set(null);
    else this.shopOrder.set(null);
  }
  private tabVisible(tab: "booking" | "catalog" | "shop"): boolean {
    if (tab === "booking") return this.bookingVisible();
    if (tab === "catalog") return this.catalogVisible();
    return this.shopVisible();
  }

  tabId(tab: "booking" | "catalog" | "shop"): string {
    return `portal-tab-${tab}`;
  }

  panelId(tab: "booking" | "catalog" | "shop"): string {
    return `portal-panel-${tab}`;
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

  /**
   * Add a product to the customer's cart and animate the product card
   * flying toward the cart icon in the header. The animation is purely
   * visual — the actual cart addition happens synchronously via
   * CartService so the badge updates immediately, even before the
   * animation completes.
   *
   * @param event The click event, used to locate the source element
   *   for the flying clone. Falls back to the product card if the
   *   event target is not the button itself.
   */
  addToCart(event: Event, product: Product) {
    this.cartService.add(product);
    const source =
      event.currentTarget instanceof HTMLElement
        ? event.currentTarget
        : (event.target as HTMLElement | null);
    if (source) {
      this.flyToCart.flyTo(source);
    }
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
