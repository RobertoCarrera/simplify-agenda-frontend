import { TestBed, ComponentFixture, fakeAsync, tick, waitForAsync } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ContractScreenComponent } from './contract-screen.component';
import {
    BookingPublicService,
    CompanyServicesResponse,
    Service,
} from '../../services/booking-public.service';
import { TurnstileService } from '../../services/turnstile.service';

describe('ContractScreenComponent', () => {
    let fixture: ComponentFixture<ContractScreenComponent>;
    let component: ContractScreenComponent;
    let bookingService: jasmine.SpyObj<BookingPublicService> & {
        getServices: jasmine.Spy;
        createLead: jasmine.Spy;
    };
    let turnstileService: jasmine.SpyObj<TurnstileService>;

    const mockService: Service = {
        id: 'svc-1',
        name: 'Test Service',
        duration_minutes: 60,
        price: 100,
        professionals: [],
        variants: [
            {
                id: 'var-1',
                name: 'Pro Plan',
                pricing: [{ base_price: 99, billing_period: 'monthly' }],
            },
        ],
    };

    const mockResponse: CompanyServicesResponse = {
        company: {
            id: 'c1',
            name: 'TestCo',
            portal_features: {
                show_booking: false,
                show_catalog: true,
                show_shop: false,
                show_professionals: true,
                show_availability: true,
            },
        },
        services: [mockService],
        products: [],
        professionals: [],
    };

    beforeEach(waitForAsync(() => {
        const getServicesSpy = jasmine.createSpy('getServices').and.returnValue(
            of(mockResponse),
        );
        const createLeadSpy = jasmine.createSpy('createLead').and.returnValue(
            of({ success: true, lead_id: 'lead-1' }),
        );

        const bookingMock = {
            getServices: getServicesSpy,
            createLead: createLeadSpy,
        };

        const turnstileMock = jasmine.createSpyObj<TurnstileService>(
            'TurnstileService',
            ['loadScript', 'renderAndExecute'],
        );
        (turnstileMock.loadScript as jasmine.Spy).and.returnValue(
            Promise.resolve(),
        );
        (turnstileMock.renderAndExecute as jasmine.Spy).and.returnValue(
            Promise.resolve('test-token'),
        );

        const activatedRouteStub = {
            parent: {
                snapshot: {
                    paramMap: convertToParamMap({
                        slug: 'testco',
                        serviceId: 'svc-1',
                    }),
                },
            },
            snapshot: {
                paramMap: convertToParamMap({
                    slug: 'testco',
                    serviceId: 'svc-1',
                }),
                queryParamMap: convertToParamMap({
                    variant_id: 'var-1',
                    variant_billing_period: 'monthly',
                    variant_base_price: '99',
                }),
            },
        };

        TestBed.configureTestingModule({
            imports: [HttpClientTestingModule, ContractScreenComponent],
            providers: [
                { provide: ActivatedRoute, useValue: activatedRouteStub },
                { provide: BookingPublicService, useValue: bookingMock },
                { provide: TurnstileService, useValue: turnstileMock },
            ],
        });

        // Inject HttpTestingController to verify no accidental HTTP leak.
        TestBed.inject(HttpTestingController);

        fixture = TestBed.createComponent(ContractScreenComponent);
        component = fixture.componentInstance;

        bookingService = TestBed.inject(BookingPublicService) as any;
        turnstileService = TestBed.inject(
            TurnstileService,
        ) as jasmine.SpyObj<TurnstileService>;

        fixture.detectChanges();
    }));

    describe('validate()', () => {
        function fillValidBase() {
            component.formFirstName = 'Ada';
            component.formLastName = 'Lovelace';
            component.formEmail = 'ada@example.com';
            component.formGdprAccepted = true;
        }

        it('validates that firstName is required', () => {
            fillValidBase();
            component.formFirstName = '';

            component['validate']();

            expect(component.errors()['first_name']).toBeTruthy();
            expect(component.errors()['first_name']).toBe(
                'El nombre es obligatorio',
            );
        });

        it('validates that lastName is required', () => {
            fillValidBase();
            component.formLastName = '';

            component['validate']();

            expect(component.errors()['last_name']).toBeTruthy();
            expect(component.errors()['last_name']).toBe(
                'Los apellidos son obligatorios',
            );
        });

        it('validates that email is required and must match regex', () => {
            fillValidBase();

            // Empty email -> error
            component.formEmail = '';
            component['validate']();
            expect(component.errors()['email']).toBe('El email es obligatorio');

            // Invalid email -> error
            component.formEmail = 'not-an-email';
            component['validate']();
            expect(component.errors()['email']).toBe('Email no válido');

            // Valid email -> no error
            component.formEmail = 'ada@example.com';
            component['validate']();
            expect(component.errors()['email']).toBeUndefined();
        });

        it('validates that gdpr acceptance is required', () => {
            fillValidBase();
            component.formGdprAccepted = false;

            component['validate']();

            expect(component.errors()['gdpr']).toBeTruthy();
            expect(component.errors()['gdpr']).toBe(
                'Debes aceptar la política de privacidad',
            );
        });

        it('passes validation when all required fields are set and email is valid', () => {
            fillValidBase();
            component.formPhone = '+34666555444';
            component.formMessage = 'Por favor confirmar detalles';

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
            component.formMessage = 'Por favor confirmar detalles';
            component.formGdprAccepted = true;
        }

        it('calls createLead with the form payload + variant on valid submit', fakeAsync(() => {
            fillValidForm();

            // Sanity: the BFF call hasn't happened yet.
            expect(bookingService.createLead).not.toHaveBeenCalled();

            component['submit']();
            tick();

            expect(bookingService.createLead).toHaveBeenCalledTimes(1);
            const payload = bookingService.createLead.calls.mostRecent()
                .args[0];
            expect(payload.company_slug).toBe('testco');
            expect(payload.service_id).toBe('svc-1');
            expect(payload.first_name).toBe('Ada');
            expect(payload.last_name).toBe('Lovelace');
            expect(payload.email).toBe('ada@example.com');
            expect(payload.phone).toBe('+34666555444');
            expect(payload.variant_id).toBe('var-1');
            expect(payload.variant_pricing_snapshot).toEqual({
                base_price: 99,
                billing_period: 'monthly',
            });
            expect(payload.turnstile_token).toBe('test-token');
        }));

        it('shows the success state when createLead returns success', fakeAsync(() => {
            fillValidForm();

            expect(component.success()).toBe(false);

            component['submit']();
            tick();

            expect(component.success()).toBe(true);
            expect(component.submitError()).toBeNull();
            expect(component.submitting()).toBe(false);
        }));

        it('sets submitError when createLead returns success=false', fakeAsync(() => {
            fillValidForm();
            bookingService.createLead.and.returnValue(
                of({ success: false, message: 'Servicio no disponible' }),
            );

            component['submit']();
            tick();

            expect(component.submitError()).toBe('Servicio no disponible');
            expect(component.success()).toBe(false);
            expect(component.submitting()).toBe(false);
        }));

        it('sets submitError when createLead errors', fakeAsync(() => {
            fillValidForm();
            bookingService.createLead.and.returnValue(
                throwError(() => new Error('Network')),
            );

            component['submit']();
            tick();

            expect(component.submitError()).toBe('Network');
            expect(component.success()).toBe(false);
            expect(component.submitting()).toBe(false);
        }));
    });
});
