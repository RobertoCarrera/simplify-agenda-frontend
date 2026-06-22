import { Injectable, inject } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable, catchError, throwError } from "rxjs";
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
  portal_features?: PortalFeatures;
}

/**
 * Per-company portal capability flags. The backend (booking-public BFF)
 * always returns a fully-resolved object (it fills in defaults if the DB
 * column is NULL), so the frontend can rely on every field being defined.
 *
 * Multiple flags can be true at once: e.g. a clinic that sells bono packs
 * as catalog AND takes appointments as booking will have both
 * show_booking and show_catalog = true.
 */
export interface PortalFeatures {
  show_booking: boolean;
  show_catalog: boolean;
  show_shop: boolean;
  show_professionals: boolean;
  show_availability: boolean;
  /**
   * Which section the customer sees first when the portal has
   * multiple modes active. Owners set this from CRM Settings →
   * Reservas → "Portal público — modos disponibles". If missing
   * or pointing to a disabled mode, the shell falls back to the
   * first active mode in order: booking > catalog > shop.
   */
  default_mode?: "booking" | "catalog" | "shop";
}

export interface VariantPricing {
  base_price: number;
  billing_period: "monthly" | "annual" | "one_time" | "session" | "custom";
  estimated_hours?: number;
  discount_percentage?: number;
  cost_price?: number | null;
  profit_margin?: number;
}

export interface ServiceVariant {
  id: string;
  name: string;
  pricing: VariantPricing[];
  display_config?: { color?: string; badge?: string } | null;
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
  variants?: ServiceVariant[];
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

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  price: number | null;
  stock_quantity?: number | null;
  brand?: string | null;
  model?: string | null;
  barcode?: string | null;
  location?: string | null;
  category_id?: string | null;
  category_name?: string | null;
}

export interface CompanyServicesResponse {
  company: Company;
  services: Service[];
  products: Product[];
  professionals: Professional[];
}

export interface BusyPeriod {
  start: string;
  end: string;
}

export interface ScheduleEntry {
  professional_id: string;
  day_of_week: number; // 1=Mon..7=Sun (ISO)
  start_time: string;  // "HH:MM:SS"
  end_time: string;
  break_start: string | null;
  break_end: string | null;
}

export interface BlockedDate {
  professional_id?: string;
  service_id?: string;
  start_date: string;  // YYYY-MM-DD
  end_date: string;    // YYYY-MM-DD
  all_day: boolean;
  start_time: string | null;
  end_time: string | null;
}

export interface ResourceBusyPeriod {
  resource_id: string;
  start: string;
  end: string;
}

export interface AvailabilityResponse {
  busy_periods: BusyPeriod[];
  schedule: ScheduleEntry[];
  professional_blocked_dates: BlockedDate[];
  service_blocked_dates: BlockedDate[];
  resource_busy_periods: ResourceBusyPeriod[];
}

export interface CreateBookingPayload {
  slug: string;
  service_id: string;
  professional_id?: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  datetime: string; // ISO 8601: "YYYY-MM-DDTHH:MM:SSZ" or with offset
  turnstile_token: string;
  variant_id?: string;
  variant_pricing_snapshot?: VariantPricing;
}

/**
 * Resolve a Company against the canonical portal_features defaults. Use this
 * when you need to know if a capability is on but you don't want to repeat
 * the fallback chain in every component. The backend already returns a
 * fully-resolved object, so this is mostly a safety net for cached or
 * partially-loaded states.
 */
export function resolvePortalFeatures(company: Company | null | undefined): PortalFeatures {
  const pf = company?.portal_features;
  return {
    show_booking: pf?.show_booking ?? true,
    show_catalog: pf?.show_catalog ?? false,
    show_shop: pf?.show_shop ?? false,
    show_professionals: pf?.show_professionals ?? true,
    show_availability: pf?.show_availability ?? true,
  };
}

export interface BookingResponse {
  success: boolean;
  booking_id?: string;
  message?: string;
}

export interface CreateLeadPayload {
  company_slug: string;
  service_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  message?: string;
  variant_id?: string;
  variant_pricing_snapshot?: VariantPricing;
  turnstile_token: string;
}

export interface LeadResponse {
  success: boolean;
  lead_id?: string;
  message?: string;
}

/**
 * Single cart line. Mirrors the shape the BFF expects for the
 * cart-request action — every line must have a productId, name, and
 * positive integer quantity. Price can be null (some products are
 * "consult price" and the BFF keeps the null through the pipeline).
 */
export interface CartLineItem {
  productId: string;
  name: string;
  price: number | null;
  quantity: number;
}

export interface CreateCartRequestPayload {
  company_slug: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  message?: string;
  items: CartLineItem[];
  total: number;
  turnstile_token: string;
}

export interface CartRequestResponse {
  success: boolean;
  lead_id?: string;
  message?: string;
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
    serviceId?: string,
  ): Observable<AvailabilityResponse> {
    let params = new HttpParams()
      .set("slug", slug)
      .set("week_start", weekStart);

    if (professionalId) {
      params = params.set("professional_id", professionalId);
    }
    if (serviceId) {
      params = params.set("service_id", serviceId);
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
   * Create a new lead (catalog mode: customer wants to "Contratar" a service
   * tier from the catalog). The BFF inserts a row into the CRM's leads
   * table so the company owner can follow up.
   * POST /create-lead
   */
  createLead(payload: CreateLeadPayload): Observable<LeadResponse> {
    return this.http
      .post<LeadResponse>(`${this.baseUrl}/create-lead`, {
        ...payload,
        // The BFF expects `action: 'create-lead'` to dispatch to the lead
        // pipeline. The action discriminator lives in the BFF request body,
        // not in the URL.
        action: "create-lead",
      })
      .pipe(
        catchError((err) => {
          console.error("Error creating lead:", err);
          return throwError(
            () => new Error(err?.error?.error || err.message || "Error creating lead"),
          );
        }),
      );
  }

  /**
   * Submit a cart request (shop mode: customer added several products to
   * the cart from the portal shop view and clicked "Enviar solicitud").
   * The BFF inserts ONE lead row with the line items embedded in the
   * metadata, instead of one lead per product, so the owner sees the full
   * cart in the CRM.
   * POST /create-cart-request
   */
  createCartRequest(payload: CreateCartRequestPayload): Observable<CartRequestResponse> {
    return this.http
      .post<CartRequestResponse>(`${this.baseUrl}/create-cart-request`, {
        ...payload,
        // Same convention as createLead: the BFF dispatches on `action`
        // before its strict BookingSchema check, because the cart shape
        // (items[], total) isn't in the shared schema.
        action: "cart-request",
      })
      .pipe(
        catchError((err) => {
          console.error("Error creating cart request:", err);
          return throwError(
            () =>
              new Error(
                err?.error?.error || err.message || "Error creating cart request",
              ),
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
}
