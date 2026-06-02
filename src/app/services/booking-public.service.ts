import { Injectable, inject } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable, catchError, throwError, of } from "rxjs";
import { map } from "rxjs/operators";
import { environment } from "../../environments/environment";

// ============================================================================
// Interfaces
// ============================================================================

export interface Company {
  id: string;
  name: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  enabled_filters?: ('services' | 'professionals' | 'duration')[];
}

export interface Service {
  id: string;
  name: string;
  description?: string;
  duration_minutes: number;
  price: number;
  color?: string;
  professionals?: Professional[];
  company?: Company;
}

export interface Professional {
  id: string;
  display_name: string;
  title?: string;
  bio?: string;
  avatar_url?: string;
  slug?: string;
  services?: Service[];
  company?: Company;
}

export interface CompanyServicesResponse {
  company: Company;
  services: Service[];
  professionals: Professional[];
}

export interface BusyPeriod {
  start: string;
  end: string;
}

export interface AvailabilityResponse {
  busy_periods: BusyPeriod[];
}

export interface CreateBookingPayload {
  action: 'create-booking';
  company_slug: string;
  booking_type_id: string;
  professional_id?: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  requested_date: string; // YYYY-MM-DD
  requested_time: string; // HH:MM
  turnstile_token: string;
}

export interface BookingResponse {
  success: boolean;
  booking_id?: string;
  message?: string;
}

export interface FilterVisibilityItem {
  id: string;
  label: string;
  icon: string;
  sort_order: number;
  visible: boolean;
}

export interface FilterVisibilityResponse {
  filters: FilterVisibilityItem[];
}

// ============================================================================
// Service
// ============================================================================

@Injectable({ providedIn: "root" })
export class BookingPublicService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.bffBaseUrl;

  /**
   * Fetch company services and professionals by slug
   * GET /services?slug={slug}
   */
  getServices(slug: string): Observable<CompanyServicesResponse> {
    const params = new HttpParams().set("slug", slug);
    return this.http
      .get<CompanyServicesResponse>(`${this.baseUrl}/services`, { params })
      .pipe(
        map((res) => ({
          ...res,
          services: (res.services ?? []).map((s) => ({
            ...s,
            professionals: (s.professionals ?? []).map((p: any) => ({
              ...p,
              display_name: p.display_name || p.name,
              slug: p.slug || null,
            })),
          })),
          professionals: (res.professionals ?? []).map((p: any) => ({
            ...p,
            display_name: p.display_name || p.name,
            slug: p.slug || null,
          })),
        })),
        catchError((err) => {
          console.error("Error fetching services:", err);
          return throwError(
            () => new Error(err.message || "Error fetching services"),
          );
        }),
      );
  }

  /**
   * Fetch availability for a professional in a given week
   * GET /availability?slug={slug}&week_start={date}&professional_id={id}
   */
  getAvailability(
    slug: string,
    weekStart: string,
    professionalId?: string,
  ): Observable<AvailabilityResponse> {
    let params = new HttpParams()
      .set("slug", slug)
      .set("week_start", weekStart);

    if (professionalId) {
      params = params.set("professional_id", professionalId);
    }

    return this.http
      .get<AvailabilityResponse>(`${this.baseUrl}/availability`, { params })
      .pipe(
        catchError((err) => {
          console.error("Error fetching availability:", err);
          return throwError(
            () => new Error(err.message || "Error fetching availability"),
          );
        }),
      );
  }

  /**
   * Create a new booking
   * POST /create-booking
   */
  createBooking(payload: CreateBookingPayload): Observable<BookingResponse> {
    return this.http
      .post<BookingResponse>(`${this.baseUrl}/create-booking`, payload)
      .pipe(
        catchError((err) => {
          console.error("Error creating booking:", err);
          return throwError(
            () => new Error(err.message || "Error creating booking"),
          );
        }),
      );
  }

  /**
   * Fetch a single service by ID
   * GET /services/:id from BFF
   */
  getService(id: string): Observable<Service> {
    return this.http.get<Service>(`${this.baseUrl}/services/${id}`).pipe(
      map((s: any) => ({
        ...s,
        professionals: (s.professionals ?? []).map((p: any) => ({
          ...p,
          display_name: p.display_name || p.name,
        })),
      })),
      catchError((err) => {
        console.error("Error fetching service:", err);
        return throwError(() => new Error("Failed to load service"));
      }),
    );
  }

  /**
   * Fetch a single professional by ID
   * GET /professionals/:id from BFF
   */
  getProfessional(id: string): Observable<Professional> {
    return this.http
      .get<Professional>(`${this.baseUrl}/professionals/${id}`)
      .pipe(
        map((p: any) => ({
          ...p,
          display_name: p.display_name || p.name,
        })),
        catchError((err) => {
          console.error("Error fetching professional:", err);
          return throwError(() => new Error("Failed to load professional"));
        }),
      );
  }

  /**
   * Fetch all services (cached from initial load or fresh)
   * This is used when we need to filter services by professional
   */
  getAllServices(): Observable<Service[]> {
    // TODO: This should ideally use cached data from getServices call
    // For now, returns empty - component should handle this case
    return new Observable((subscriber) => {
      subscriber.next([]);
      subscriber.complete();
    });
  }

  /**
   * Fetch services for a specific professional
   * Filters all services to return only those that include the professional_id
   * This requires the slug to fetch the full catalog first
   */
  getServicesForProfessional(
    slug: string,
    professionalId: string,
  ): Observable<Service[]> {
    return this.getServices(slug).pipe(
      map((response) =>
        response.services.filter((s) =>
          s.professionals?.some((p) => p.id === professionalId),
        ),
      ),
      catchError((err) => {
        console.error("Error fetching services for professional:", err);
        return throwError(() => new Error("Failed to load services"));
      }),
    );
  }

  /**
   * Fetch company filter visibility settings
   * Calls the Supabase edge function get-company-filter-visibility
   * in unauthenticated mode with company_id query param.
   *
   * Returns an empty array on error or when no config exists —
   * empty array signals "show all filters" (current behavior).
   */
  getFilterVisibility(
    companyId: string,
  ): Observable<FilterVisibilityItem[]> {
    const url = `${environment.supabaseFunctionsUrl}/get-company-filter-visibility?company_id=${companyId}`;

    return this.http
      .get<FilterVisibilityResponse>(url, {
        headers: {
          apikey: environment.supabaseAnonKey,
          Authorization: `Bearer ${environment.supabaseAnonKey}`,
        },
      })
      .pipe(
        map((res) => res.filters || []),
        catchError((err) => {
          console.error(
            "[FilterVisibility] Error fetching, showing all filters:",
            err,
          );
          return of([]); // Empty → show all filters (default behavior)
        }),
      );
  }
}
