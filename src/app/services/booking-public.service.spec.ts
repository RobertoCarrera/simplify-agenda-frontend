import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import {
  BookingPublicService,
  CreateCartRequestPayload,
  resolvePortalFeatures,
  Company,
} from './booking-public.service';
import { environment } from '../../environments/environment';

const makeCompany = (pf: any): Company =>
  ({
    id: 'test-company-id',
    name: 'Test Co',
    logo_url: undefined,
    primary_color: undefined,
    secondary_color: undefined,
    enabled_filters: [],
    portal_features: pf,
  }) as Company;

describe('resolvePortalFeatures', () => {
  it('returns booking-only defaults when the company is null', () => {
    const result = resolvePortalFeatures(null);
    expect(result).toEqual({
      show_booking: true,
      show_catalog: false,
      show_shop: false,
      show_professionals: true,
      show_availability: true,
    });
  });

  it('returns booking-only defaults when the company is undefined', () => {
    const result = resolvePortalFeatures(undefined);
    expect(result.show_booking).toBe(true);
    expect(result.show_catalog).toBe(false);
  });

  it('returns booking-only defaults when portal_features is null', () => {
    const result = resolvePortalFeatures(makeCompany(null));
    expect(result.show_booking).toBe(true);
    expect(result.show_catalog).toBe(false);
  });

  it('returns the company value when fully set', () => {
    const result = resolvePortalFeatures(
      makeCompany({
        show_booking: false,
        show_catalog: true,
        show_shop: true,
        show_professionals: false,
        show_availability: false,
      }),
    );
    expect(result).toEqual({
      show_booking: false,
      show_catalog: true,
      show_shop: true,
      show_professionals: false,
      show_availability: false,
    });
  });

  it('falls back per-field when only some are set', () => {
    // Defensive: if a single field is missing, fill it with the default
    // rather than the whole object being undefined.
    const result = resolvePortalFeatures(
      makeCompany({ show_catalog: true }), // everything else missing
    );
    expect(result.show_booking).toBe(true); // default
    expect(result.show_catalog).toBe(true); // explicit
    expect(result.show_shop).toBe(false); // default
  });

  it('priority for the dispatcher: shop wins over catalog over booking', () => {
    // The dispatcher logic in PortalCatalogDispatcherComponent uses
    // computeMode(): if show_shop → 'shop'; else if show_catalog →
    // 'catalog-only'; else 'full'. This test documents the contract.
    const c1 = resolvePortalFeatures(
      makeCompany({ show_booking: true, show_catalog: true, show_shop: true }),
    );
    expect(c1.show_shop).toBe(true); // dispatcher would pick 'shop'
  });
});

describe('createCartRequest', () => {
  let service: BookingPublicService;
  let http: HttpTestingController;

  const makePayload = (): CreateCartRequestPayload => ({
    company_slug: 'acme',
    first_name: 'Ada',
    last_name: 'Lovelace',
    email: 'ada@example.com',
    phone: '+34666555444',
    message: 'Por favor confirmar stock',
    items: [
      { productId: 'p-1', name: 'Taza', price: 12.5, quantity: 2 },
      { productId: 'p-2', name: 'Cuaderno', price: null, quantity: 1 },
    ],
    total: 25,
    turnstile_token: 'turnstile-fake-token',
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(BookingPublicService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('posts to /create-cart-request with action discriminator', () => {
    const payload = makePayload();
    service.createCartRequest(payload).subscribe();
    const req = http.expectOne(`${environment.bffBaseUrl}/create-cart-request`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.action).toBe('cart-request');
    expect(req.request.body.company_slug).toBe('acme');
    expect(req.request.body.first_name).toBe('Ada');
    expect(req.request.body.items).toEqual(payload.items);
    expect(req.request.body.total).toBe(25);
    req.flush({ success: true, lead_id: 'lead-1', message: 'OK' });
  });

  it('returns success response shape on 200', (done) => {
    service.createCartRequest(makePayload()).subscribe((res) => {
      expect(res).toEqual({
        success: true,
        lead_id: 'abc',
        message: 'OK',
      });
      done();
    });
    http.expectOne(`${environment.bffBaseUrl}/create-cart-request`).flush({
      success: true,
      lead_id: 'abc',
      message: 'OK',
    });
  });

  it('unwraps server error message on 4xx', (done) => {
    service.createCartRequest(makePayload()).subscribe({
      next: () => done.fail('expected error'),
      error: (err: Error) => {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('Carrito vacío');
        done();
      },
    });
    http.expectOne(`${environment.bffBaseUrl}/create-cart-request`).flush(
      { error: 'Carrito vacío' },
      { status: 400, statusText: 'Bad Request' },
    );
  });

  it('falls back to err.message when server has no body', (done) => {
    service.createCartRequest(makePayload()).subscribe({
      next: () => done.fail('expected error'),
      error: (err: Error) => {
        expect(err).toBeInstanceOf(Error);
        // HttpErrorResponse.message follows the pattern
        // "Http failure response for <url>: <status> <statusText>".
        // The service falls back to that when err.error.error is absent.
        expect(err.message).toContain('Network down');
        done();
      },
    });
    // status 0 + ProgressEvent simulates a client-side network failure
    // where the server never returned a body, so err.error.error is
    // undefined and the catchError falls back to err.message.
    http
      .expectOne(`${environment.bffBaseUrl}/create-cart-request`)
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Network down' });
  });
});
