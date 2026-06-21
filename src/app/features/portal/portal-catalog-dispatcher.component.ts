import { Component, OnInit, inject, signal, computed } from "@angular/core";
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

/**
 * Dispatches between the catalog-only and the full catalog (with booking
 * tabs) at render time. The decision is driven by the resolved
 * portal_features for the active company.
 *
 * Resolution strategy (in order):
 *   1. The BFF call (`getServices`) returns company.portal_features. This is
 *      the canonical source and the dispatcher uses it when available.
 *   2. Fallback: the `companyResolver` (parent route) writes the company
 *      payload to `localStorage` under the `currentCompany` key. We read
 *      it synchronously on init so the dispatcher has a value to render
 *      even if the BFF call is slow or fails.
 *   3. Conservative default: full CatalogComponent. Safe because the full
 *      component handles its own errors.
 *
 * The BFF call also writes the result back to the signal, so a successful
 * fetch always wins over the cached version.
 */
@Component({
  selector: "app-portal-catalog-dispatcher",
  standalone: true,
  imports: [CommonModule, CatalogOnlyComponent, CatalogComponent],
  template: `
    @if (mode() === 'catalog-only') {
      <app-catalog-only />
    } @else {
      <app-catalog />
    }
  `,
})
export class PortalCatalogDispatcherComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private bookingService = inject(BookingPublicService);

  mode = signal<"catalog-only" | "full">("full");

  ngOnInit() {
    const slug =
      this.route.parent?.snapshot.paramMap.get("slug") ??
      this.route.snapshot.paramMap.get("slug") ??
      "";

    // 1. Try the localStorage cache written by the parent companyResolver.
    //    This is synchronous and gives us a value before the BFF even
    //    returns. If the cache is stale or missing, the BFF call below
    //    overrides it.
    try {
      const cached = localStorage.getItem("currentCompany");
      if (cached) {
        const parsed = JSON.parse(cached) as Company;
        const features = resolvePortalFeatures(parsed);
        this.mode.set(features.show_catalog ? "catalog-only" : "full");
      }
    } catch {
      // localStorage may be unavailable (SSR / private mode) — ignore.
    }

    // 2. Re-fetch the BFF. The BFF call may or may not be cached by
    //    Angular's HttpClient, but the BookingPublicService doesn't
    //    currently cache it, so this is a real network call. We do it
    //    anyway because it is the canonical source and overrides any
    //    stale localStorage value.
    if (slug) {
      this.bookingService.getServices(slug).subscribe({
        next: (res) => {
          const features = resolvePortalFeatures(res.company ?? null);
          this.mode.set(features.show_catalog ? "catalog-only" : "full");
        },
        error: () => {
          // Keep whatever mode was set in step 1 (or the default "full").
        },
      });
    }
  }
}
