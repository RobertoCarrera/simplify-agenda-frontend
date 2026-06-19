import { inject } from "@angular/core";
import { ResolveFn, Router } from "@angular/router";
import { Observable, map, catchError, of, tap } from "rxjs";
import {
  BookingPublicService,
  Company,
} from "../services/booking-public.service";

export const companyResolver: ResolveFn<Company | null> = (route) => {
  const bookingService = inject(BookingPublicService);
  const router = inject(Router);
  const slug = route.paramMap.get("slug");

  if (!slug) {
    router.navigate(["/404"]);
    return of(null);
  }

  // Use getServices which returns { company, services, professionals }
  return bookingService.getServices(slug).pipe(
    tap((response) => {
      // Cache the active company so the root <app-header> can read branding
      // (companyName, logoUrl) without re-fetching on every navigation.
      try {
        if (response?.company) {
          localStorage.setItem(
            "currentCompany",
            JSON.stringify(response.company),
          );
        }
      } catch {
        // localStorage may be unavailable (SSR / private mode) — ignore.
      }
    }),
    map((response) => response.company),
    catchError((err) => {
      console.error("Error resolving company:", err);
      router.navigate(["/404"]);
      return of(null);
    }),
  );
};

export const currentCompanyKey = "currentCompany";
