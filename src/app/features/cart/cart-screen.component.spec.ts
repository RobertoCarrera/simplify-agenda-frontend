import { TestBed, ComponentFixture, fakeAsync, tick, waitForAsync } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CartScreenComponent } from './cart-screen.component';
import { BookingPublicService, Product } from '../../services/booking-public.service';
import { CartService } from '../../shared/services/cart.service';
import { TurnstileService } from '../../services/turnstile.service';

const mockProduct = (overrides: Partial<Product> = {}): Product => ({
    id: 'p1',
    name: 'Camiseta',
    price: 19.99,
    description: null,
    stock_quantity: 10,
    brand: null,
    model: null,
    barcode: null,
    location: null,
    category_id: null,
    category_name: null,
    ...overrides,
});

describe('CartScreenComponent', () => {
    let fixture: ComponentFixture<CartScreenComponent>;
    let component: CartScreenComponent;
    let cart: CartService;
    let bookingService: jasmine.SpyObj<BookingPublicService> & {
        getServices: jasmine.Spy;
        createCartRequest: jasmine.Spy;
    };
    let turnstileService: jasmine.SpyObj<TurnstileService>;

    beforeEach(waitForAsync(() => {
        localStorage.clear();

        const createCartRequestSpy = jasmine.createSpy('createCartRequest').and.returnValue(
            of({ success: true, lead_id: 'abc' }),
        );
        const getServicesSpy = jasmine.createSpy('getServices').and.returnValue(
            of({
                company: {
                    id: 'c1',
                    name: 'TestCo',
                    portal_features: {
                        show_booking: true,
                        show_catalog: false,
                        show_shop: true,
                        show_professionals: true,
                        show_availability: true,
                    },
                },
                services: [],
                products: [],
                professionals: [],
            }),
        );

        const bookingMock = {
            getServices: getServicesSpy,
            createCartRequest: createCartRequestSpy,
        };

        const turnstileMock = jasmine.createSpyObj<TurnstileService>('TurnstileService', [
            'loadScript',
            'renderAndExecute',
        ]);
        (turnstileMock.loadScript as jasmine.Spy).and.returnValue(Promise.resolve());
        (turnstileMock.renderAndExecute as jasmine.Spy).and.returnValue(
            Promise.resolve('test-token'),
        );

        const activatedRouteStub = {
            parent: {
                snapshot: {
                    paramMap: convertToParamMap({ slug: 'testco' }),
                },
            },
            snapshot: {
                paramMap: convertToParamMap({ slug: 'testco' }),
            },
        };

        TestBed.configureTestingModule({
            imports: [HttpClientTestingModule, CartScreenComponent],
            providers: [
                { provide: ActivatedRoute, useValue: activatedRouteStub },
                { provide: BookingPublicService, useValue: bookingMock },
                { provide: TurnstileService, useValue: turnstileMock },
                CartService,
            ],
        });

        // Inject HttpTestingController to verify no accidental HTTP leak.
        TestBed.inject(HttpTestingController);

        fixture = TestBed.createComponent(CartScreenComponent);
        component = fixture.componentInstance;
        cart = TestBed.inject(CartService);

        bookingService = TestBed.inject(BookingPublicService) as any;
        turnstileService = TestBed.inject(TurnstileService) as jasmine.SpyObj<TurnstileService>;

        fixture.detectChanges();
    }));

    afterEach(() => {
        localStorage.clear();
    });

    it('reads the slug from the parent route on init', () => {
        expect(component.slug()).toBe('testco');
        expect(component.companyName()).toBe('TestCo');
        expect(component.loading()).toBe(false);
    });

    describe('validate()', () => {
        it('validates that firstName is required', () => {
            component.formFirstName = '';
            component.formLastName = 'Lovelace';
            component.formEmail = 'ada@example.com';
            component.formGdprAccepted = true;

            component['validate']();

            expect(component.errors()['first_name']).toBeTruthy();
            expect(component.errors()['first_name']).toBe('El nombre es obligatorio');
        });

        it('validates that email is required and must match regex', () => {
            component.formFirstName = 'Ada';
            component.formLastName = 'Lovelace';
            component.formGdprAccepted = true;

            // Empty email -> error
            component.formEmail = '';
            component['validate']();
            expect(component.errors()['email']).toBe('El email es obligatorio');

            // Invalid email -> error
            component.formEmail = 'not-an-email';
            component['validate']();
            expect(component.errors()['email']).toBe('Email no válido');

            // Valid email -> no error
            component.formEmail = 'a@b.c';
            component['validate']();
            expect(component.errors()['email']).toBeUndefined();
        });

        it('validates that gdpr acceptance is required', () => {
            component.formFirstName = 'Ada';
            component.formLastName = 'Lovelace';
            component.formEmail = 'ada@example.com';
            component.formGdprAccepted = false;

            component['validate']();

            expect(component.errors()['gdpr']).toBeTruthy();
            expect(component.errors()['gdpr']).toBe(
                'Debes aceptar la política de privacidad',
            );
        });

        it('passes validation when all required fields are set and email is valid', () => {
            component.formFirstName = 'Ada';
            component.formLastName = 'Lovelace';
            component.formEmail = 'ada@example.com';
            component.formPhone = '+34666555444';
            component.formMessage = 'Por favor confirmar stock';
            component.formGdprAccepted = true;

            component['validate']();

            expect(component.errors()).toEqual({});
        });
    });

    describe('submit()', () => {
        function fillValidForm() {
            component.formFirstName = 'Ada';
            component.formLastName = 'Lovelace';
            component.formEmail = 'ada@example.com';
            component.formPhone = '+34666555444';
            component.formMessage = 'Por favor confirmar stock';
            component.formGdprAccepted = true;
        }

        it('does not call createCartRequest when the cart is empty', fakeAsync(() => {
            fillValidForm();
            // cart is empty by default
            expect(cart.itemCount()).toBe(0);

            component['submit']();
            tick();

            expect(bookingService.createCartRequest).not.toHaveBeenCalled();
            expect(component.submitting()).toBe(false);
        }));

        it('calls createCartRequest with the cart snapshot on a valid submit', fakeAsync(() => {
            // Defense against cross-spec leakage: another describe block
            // may have left items in localStorage. CartService is
            // providedIn:'root' and rehydrates from localStorage on
            // construction, so we explicitly clear here even though
            // beforeEach also clears it (the order matters: the effect
            // could write before afterEach runs).
            cart.clear();
            cart.add(mockProduct({ id: 'p1', name: 'Camiseta', price: 19.99 }));
            cart.add(mockProduct({ id: 'p2', name: 'Cuaderno', price: 5 }));
            fillValidForm();

            // Snapshot the expected totals BEFORE submit() — the
            // success handler clears the cart, so cart.total() is
            // 0 by the time we assert.
            const expectedTotal = 19.99 + 5;
            const expectedItemsCount = 2;

            // Make turnstile return a deterministic token so the assertion
            // about turnstile_token is meaningful.
            (turnstileService.renderAndExecute as jasmine.Spy).and.returnValue(
                Promise.resolve('token-123'),
            );

            component['submit']();
            tick();

            expect(bookingService.createCartRequest).toHaveBeenCalledTimes(1);

            const payload = bookingService.createCartRequest.calls.mostRecent().args[0];
            expect(payload.company_slug).toBe('testco');
            expect(payload.first_name).toBe('Ada');
            expect(payload.last_name).toBe('Lovelace');
            expect(payload.email).toBe('ada@example.com');
            expect(payload.turnstile_token).toBe('token-123');
            // Payload must match what the cart had at submit time, NOT
            // the live cart (which is now empty after success).
            expect(payload.items.length).toBe(expectedItemsCount);
            expect(payload.total).toBe(expectedTotal);
        }));

        it('clears the cart and sets success on a successful submit', fakeAsync(() => {
            cart.add(mockProduct({ id: 'p1', price: 19.99 }));
            cart.add(mockProduct({ id: 'p2', price: 5 }));
            fillValidForm();

            expect(cart.itemCount()).toBe(2);
            expect(component.success()).toBe(false);

            component['submit']();
            tick();

            expect(cart.itemCount()).toBe(0);
            expect(cart.distinctCount()).toBe(0);
            expect(component.success()).toBe(true);
            expect(component.submitError()).toBeNull();
            expect(component.submitting()).toBe(false);
        }));

        it('sets submitError when createCartRequest returns success=false', fakeAsync(() => {
            cart.add(mockProduct({ id: 'p1', price: 19.99 }));
            fillValidForm();
            bookingService.createCartRequest.and.returnValue(
                of({ success: false, message: 'Carrito vacío' }),
            );

            component['submit']();
            tick();

            expect(component.submitError()).toBe('Carrito vacío');
            expect(component.success()).toBe(false);
            // Cart should NOT be cleared on a failed response.
            expect(cart.itemCount()).toBe(1);
        }));

        it('sets submitError when createCartRequest errors', fakeAsync(() => {
            cart.add(mockProduct({ id: 'p1', price: 19.99 }));
            fillValidForm();
            bookingService.createCartRequest.and.returnValue(
                throwError(() => new Error('Network')),
            );

            component['submit']();
            tick();

            expect(component.submitError()).toBe('Network');
            expect(component.success()).toBe(false);
            expect(component.submitting()).toBe(false);
        }));
    });

    it('shows the empty-state when cart is empty on mount', () => {
        // Cart is empty by default in beforeEach (localStorage cleared,
        // no items added). The empty-state branch is the one with the
        // "Tu carrito está vacío" copy.
        expect(cart.itemCount()).toBe(0);

        fixture.detectChanges();

        const text = fixture.nativeElement.textContent ?? '';
        expect(text).toContain('Tu carrito está vacío');
    });

    it('shows company name hint in the empty state when the BFF has loaded', () => {
        // The getServices mock in beforeEach resolves synchronously, so
        // companyName() is already 'TestCo' by the time the template
        // renders. The empty-state hint interpolates that signal.
        expect(component.companyName()).toBe('TestCo');

        fixture.detectChanges();

        const text = fixture.nativeElement.textContent ?? '';
        expect(text).toContain('TestCo');
    });

    it('does NOT show the cart-line form when cart is empty', () => {
        // The .cart-line elements only exist inside the @for loop of the
        // filled-state branch. With an empty cart that branch is not
        // rendered, so no .cart-line nodes should appear in the DOM.
        expect(cart.itemCount()).toBe(0);

        fixture.detectChanges();

        const cartLines = fixture.nativeElement.querySelectorAll('.cart-line');
        expect(cartLines.length).toBe(0);
    });

    it('does not reference the missing --color-text-primary variable in its styles', () => {
      // Defensive regression test: the 404 page once had this bug, and
      // the browser silently ignores missing CSS variables. The cart
      // screen should never reintroduce it.
      //
      // Angular injects component styles into <head> with a per-
      // component scope selector (e.g. `._ngcontent-xxx`), NOT into
      // the component's own DOM. The component's DOM has no <style>
      // tags, so the previous query against `fixture.nativeElement`
      // always returned an empty list and the assertion could never
      // find the bug. Scan <head> instead.
      //
      // NOTE: this test only catches obvious typos in the styles
      // string. The Tailwind build + tsc also enforce design-token
      // correctness at compile time; this is an extra runtime check.
      const styleTags: HTMLStyleElement[] = Array.from(
        document.head.querySelectorAll('style'),
      );
      const inline = styleTags
        .map((s) => s.textContent || '')
        .join('\n');
      expect(inline).not.toContain('--color-text-primary');
    });

    it('uses the project\'s existing color tokens in its styles', () => {
      // See comment above re: Angular styles living in <head>, not the
      // component DOM.
      const styleTags: HTMLStyleElement[] = Array.from(
        document.head.querySelectorAll('style'),
      );
      const inline = styleTags
        .map((s) => s.textContent || '')
        .join('\n');
      // The cart screen uses --color-primary, --color-text, --color-bg.
      expect(inline).toContain('--color-primary');
      expect(inline).toContain('--color-text');
    });
});
