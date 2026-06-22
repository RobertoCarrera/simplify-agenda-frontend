import { Component, Input, OnInit, inject, signal } from "@angular/core";
import { CommonModule, Location } from "@angular/common";
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from "@angular/router";
import { TranslocoModule } from "@jsverse/transloco";
import { filter } from "rxjs/operators";
import { LanguageSwitcherComponent } from "./language-switcher.component";
import { CartService } from "../services/cart.service";

@Component({
  selector: "app-header",
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    TranslocoModule,
    LanguageSwitcherComponent,
  ],
  template: `
    <header class="site-header">
      <div class="header-container">
        <a [routerLink]="logoLink()" class="logo">
          <img
            *ngIf="logoUrl"
            [src]="logoUrl"
            [alt]="companyName"
            class="logo-img"
          />
          <span *ngIf="!logoUrl" class="logo-text">{{ companyName }}</span>
        </a>

        <nav class="main-nav" aria-label="Navegación principal">
          <a
            [routerLink]="logoLink()"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: true }"
            ariaCurrentWhenActive="page"
          >
            {{ "nav.home" | transloco }}
          </a>
          <a
            [routerLink]="serviciosLink()"
            routerLinkActive="active"
            ariaCurrentWhenActive="page"
          >
            {{ "nav.services" | transloco }}
          </a>
          <a
            [routerLink]="profesionalesLink()"
            routerLinkActive="active"
            ariaCurrentWhenActive="page"
          >
            {{ "nav.professionals" | transloco }}
          </a>
        </nav>

        <div class="header-actions">
          <a
            *ngIf="slug()"
            [routerLink]="['/', slug(), 'cart']"
            class="cart-button"
            [class.cart-empty]="cart.itemCount() === 0"
            [attr.aria-label]="'Carrito (' + cart.itemCount() + ')'"
            title="Ver carrito"
          >
            <svg class="cart-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"></path>
            </svg>
            @if (cart.itemCount() > 0) {
              <span class="cart-badge">{{ cart.itemCount() }}</span>
            }
          </a>
          <app-language-switcher />
        </div>
      </div>
    </header>
  `,
  styles: [`
    :host { display: block; }

    .site-header {
      background: var(--color-surface);
      border-bottom: 1px solid var(--color-border);
      position: sticky;
      top: 0;
      z-index: 50;
    }

    .header-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 1.5rem 1.5rem;
      display: flex;
      align-items: center;
      gap: 1.5rem;
    }

    .logo {
      display: flex;
      align-items: center;
      text-decoration: none;
      flex-shrink: 0;
    }

    .logo-img {
      height: 2.5rem;
      width: auto;
      object-fit: contain;
    }

    .logo-text {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--color-primary);
    }

    .main-nav {
      display: flex;
      gap: 1.5rem;
      flex: 1;
      justify-content: center;
    }

    .main-nav a {
      font-weight: 500;
      text-decoration: none;
      padding: 0.5rem 0.75rem;
      border-radius: 0.375rem;
      transition: all 150ms ease;
      color: var(--color-text-secondary);
    }
    .main-nav a:hover {
      background: var(--color-surface-hover);
      color: var(--color-text);
    }
    .main-nav a.active {
      color: var(--color-primary);
      background: var(--color-primary-light);
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    /* Cart button — visible only on shop-mode pages (i.e. when there's a
       company slug in the URL). On booking-only or catalog-only pages the
       shop is disabled, so the cart link would be useless. */
    .cart-button {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 0.5rem;
      color: var(--color-text-secondary);
      text-decoration: none;
      transition: all 150ms ease;
      background: transparent;
    }
    .cart-button:hover {
      background: var(--color-surface-hover);
      color: var(--color-text);
    }
    .cart-button.cart-empty {
      opacity: 0.55;
    }
    .cart-button.cart-empty:hover { opacity: 0.9; }

    .cart-button .cart-icon {
      width: 1.25rem;
      height: 1.25rem;
      display: block;
    }

    .cart-badge {
      position: absolute;
      top: -0.125rem;
      right: -0.125rem;
      min-width: 1.125rem;
      height: 1.125rem;
      padding: 0 0.3rem;
      border-radius: 0.625rem;
      background: var(--color-primary, #10B981);
      color: white;
      font-size: 0.6875rem;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      box-shadow: 0 0 0 2px var(--color-surface);
    }

    @media (max-width: 768px) {
      .header-container { flex-wrap: wrap; }
      .main-nav {
        order: 3;
        width: 100%;
        justify-content: flex-start;
        gap: 0.5rem;
      }
      .main-nav a { font-size: 0.875rem; padding: 0.5rem; }
      .cart-button { width: 2.25rem; height: 2.25rem; }
    }
  `],
})
export class HeaderComponent implements OnInit {
  @Input() companyName: string = "Simplifica CRM";
  @Input() logoUrl?: string;

  private router = inject(Router);
  private location = inject(Location);
  cart = inject(CartService);

  /** Active company slug, derived from the URL. Empty when on a route that
   *  doesn't have a slug segment (root, 404, etc.). The cart link is only
   *  rendered when this is truthy. */
  slug = signal<string>("");

  ngOnInit() {
    // Initial read. `router.url` is unreliable during initial bootstrap
    // (returns "/" until the router processes the URL). `Location.path()`
    // reads the current browser URL synchronously, but in some production
    // scenarios it can also be stale during the very first tick. To be
    // robust, we read three times: synchronously, on the next microtask,
    // and on every NavigationEnd. Each read falls back to
    // `window.location.pathname` if Location returns an empty value.
    this.refreshSlug();
    queueMicrotask(() => this.refreshSlug());
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.refreshSlug());
  }

  /**
   * Reads the current path from Location and updates the slug signal.
   * Uses Location.path() because it returns the actual browser path
   * synchronously, unlike router.url which is "/" until the router
   * processes the URL.
   */
  private refreshSlug() {
    // Location.path() returns the current path WITHOUT the base href.
    // For https://example.com/simplifica/servicios it returns
    // "/simplifica/servicios". Fall back to window.location.pathname
    // just in case Location isn't available (SSR or unusual setups).
    const path = this.location.path() || window.location.pathname || "";
    this.updateSlug(path);
  }

  /**
   * Extract the first path segment. Routes are either:
   *   /<slug>/...        -> slug is the first segment
   *   /                  -> no slug
   *   /caibs/servicios   -> slug is 'caibs' (default company's short code)
   *   /404               -> no slug
   *
   * We only treat it as a company slug if the second segment is one of
   * the known company routes (servicios, profesionales, contratar,
   * reservar, cart). That keeps the cart link from appearing on
   * unrelated top-level routes.
   */
  private updateSlug(url: string) {
    const segments = url.split("?")[0].split("/").filter(Boolean);
    if (segments.length < 2) {
      this.slug.set("");
      return;
    }
    const KNOWN = new Set(["servicios", "profesionales", "contratar", "reservar", "cart"]);
    if (KNOWN.has(segments[1])) {
      this.slug.set(segments[0]);
    } else {
      this.slug.set("");
    }
  }

  logoLink()         { return this.slug() ? ["/", this.slug()] : "/"; }
  serviciosLink()    { return this.slug() ? ["/", this.slug(), "servicios"] : "/servicios"; }
  profesionalesLink(){ return this.slug() ? ["/", this.slug(), "profesionales"] : "/profesionales"; }
}
