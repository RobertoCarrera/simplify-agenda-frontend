import { Component, OnInit, inject, signal } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { CommonModule } from "@angular/common";
import {
  BookingPublicService,
  resolvePortalFeatures,
  PortalFeatures,
  Company,
} from "../../services/booking-public.service";
import { CatalogOnlyComponent } from "../catalog/catalog-only.component";
import { CatalogComponent } from "../catalog/catalog.component";
import { ShopOnlyComponent } from "../shop/shop-only.component";
import { PortalCombinedComponent } from "./portal-combined.component";

/**
 * Dispatches between portal views at render time. The decision is
 * driven by the resolved portal_features for the active company.
 *
 *   - 0 flags active              → empty state (no view rendered)
 *   - 1 flag active               → the matching single-mode view
 *                                   (ShopOnlyComponent / CatalogOnlyComponent /
 *                                   CatalogComponent)
 *   - 2+ flags active             → PortalCombinedComponent, which renders
 *                                   all enabled sections in cascade
 *                                   (booking → catalog → shop)
 *
 * The combined view exists because owners who enable multiple
 * capabilities want the customer to see the full offering, not
 * just the highest-priority one. Single-mode is kept as a fast path
 * because its components are lighter and tailored to their respective
 * shapes.
 *
 * Priority order (when forcing a single mode): shop > catalog-only > full.
 */
@Component({
  selector: "app-portal-catalog-dispatcher",
  standalone: true,
  imports: [CommonModule, CatalogOnlyComponent, CatalogComponent, ShopOnlyComponent, PortalCombinedComponent],
  template: `
    @if (mode() === 'combined') {
      <app-portal-combined />
    } @else if (mode() === 'shop') {
      <app-shop-only />
    } @else if (mode() === 'catalog-only') {
      <app-catalog-only />
    } @else {
      <app-catalog />
    }
  `,
})
export class PortalCatalogDispatcherComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private bookingService = inject(BookingPublicService);

  mode = signal<"combined" | "shop" | "catalog-only" | "full">("full");

  /**
   * Compute the mode from a portal_features payload. Returns 'combined'
   * when 2+ of the user-facing flags are true; otherwise returns the
   * single highest-priority mode.
   */
  private computeMode(features: PortalFeatures): "combined" | "shop" | "catalog-only" | "full" {
    const userFacingFlags = [
      features.show_booking,
      features.show_catalog,
      features.show_shop,
    ].filter(Boolean).length;
    if (userFacingFlags >= 2) return "combined";
    if (features.show_shop) return "shop";
    if (features.show_catalog) return "catalog-only";
    return "full";
  }

  ngOnInit() {
    const slug =
      this.route.parent?.snapshot.paramMap.get("slug") ??
      this.route.snapshot.paramMap.get("slug") ??
      "";

    // 1. Try the localStorage cache written by the parent companyResolver.
    try {
      const cached = localStorage.getItem("currentCompany");
      if (cached) {
        const parsed = JSON.parse(cached) as Company;
        this.mode.set(this.computeMode(resolvePortalFeatures(parsed)));
      }
    } catch {
      // localStorage may be unavailable (SSR / private mode) — ignore.
    }

    // 2. Re-fetch the BFF. Overrides the localStorage value when it returns.
    if (slug) {
      this.bookingService.getServices(slug).subscribe({
        next: (res) => {
          this.mode.set(this.computeMode(resolvePortalFeatures(res.company ?? null)));
        },
        error: () => {
          // Keep whatever mode was set in step 1 (or the default "full").
        },
      });
    }
  }
}

