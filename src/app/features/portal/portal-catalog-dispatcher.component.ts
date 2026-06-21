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

/**
 * Dispatches between three portal views at render time:
 *   - 'shop'         → ShopOnlyComponent (products grid)
 *   - 'catalog-only' → CatalogOnlyComponent (services + tier rows)
 *   - 'full'         → CatalogComponent (booking tabs + professionals)
 *
 * The decision is driven by the resolved portal_features for the
 * active company. Multiple flags can be true; for the initial ticket
 * we pick the first one in priority order: shop > catalog > full.
 * Future iteration can render multiple views side-by-side.
 */
@Component({
  selector: "app-portal-catalog-dispatcher",
  standalone: true,
  imports: [CommonModule, CatalogOnlyComponent, CatalogComponent, ShopOnlyComponent],
  template: `
    @switch (mode()) {
      @case ('shop') {
        <app-shop-only />
      }
      @case ('catalog-only') {
        <app-catalog-only />
      }
      @default {
        <app-catalog />
      }
    }
  `,
})
export class PortalCatalogDispatcherComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private bookingService = inject(BookingPublicService);

  mode = signal<"shop" | "catalog-only" | "full">("full");

  /**
   * Compute the mode from a portal_features payload. Priority: shop >
   * catalog-only > full (booking). This is the single source of truth for
   * the decision — both the localStorage fast-path and the BFF
   * response go through this function so the logic stays in one place.
   */
  private computeMode(features: PortalFeatures): "shop" | "catalog-only" | "full" {
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

