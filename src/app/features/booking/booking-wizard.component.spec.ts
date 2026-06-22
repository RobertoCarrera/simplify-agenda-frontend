import { TestBed, ComponentFixture, fakeAsync, tick, waitForAsync } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { of } from 'rxjs';
import { BookingWizardComponent } from './booking-wizard.component';
import {
    BookingPublicService,
    CompanyServicesResponse,
    Service,
} from '../../services/booking-public.service';
import { TurnstileService } from '../../services/turnstile.service';
import { AvailabilityService } from '../../services/availability.service';
import { TimeSlot } from '../calendar/time-slot.component';

/**
 * Stub of WeeklyCalendarComponent — the booking wizard imports it as a real
 * component but we never interact with the calendar in these tests (we set
 * the selectedSlot signal directly). The stub captures the inputs/outputs
 * so the wizard's template bindings resolve at render time.
 */
@Component({
    selector: 'app-weekly-calendar',
    standalone: true,
    template: '',
})
class StubWeeklyCalendarComponent {
    @Input() busyPeriods: any[] = [];
    @Input() schedule: any[] = [];
    @Input() blockedDates: any[] = [];
    @Input() professionalId: string | undefined;
    @Input() serviceDuration = 30;
    @Input() initialDate: Date | undefined;
    @Input() loading = false;
    @Output() slotSelected = new EventEmitter<TimeSlot>();
    @Output() weekChanged = new EventEmitter<Date>();
}

describe('BookingWizardComponent', () => {
    let fixture: ComponentFixture<BookingWizardComponent>;
    let component: BookingWizardComponent;
    let bookingService: jasmine.SpyObj<BookingPublicService> & {
        getServices: jasmine.Spy;
        getAvailability: jasmine.Spy;
        createBooking: jasmine.Spy;
    };
    let turnstileService: jasmine.SpyObj<TurnstileService>;

    const mockService: Service = {
        id: 'svc-1',
        name: 'Test Service',
        duration_minutes: 60,
        price: 100,
        professionals: [],
        variants: [],
    };

    const mockResponse: CompanyServicesResponse = {
        company: {
            id: 'c1',
            name: 'TestCo',
            portal_features: {
                show_booking: true,
                show_catalog: false,
                show_shop: false,
                show_professionals: true,
                show_availability: true,
            },
        },
        services: [mockService],
        products: [],
        professionals: [],
    };

    // A deterministic slot for June 22 2026 at 09:30 local time.
    const mockSlot: TimeSlot = {
        id: '2026-06-22-09-30',
        datetime: new Date(2026, 5, 22, 9, 30, 0, 0),
        startTime: '09:30',
        endTime: '10:30',
        isAvailable: true,
        isPast: false,
        isSelected: false,
    };

    beforeEach(waitForAsync(() => {
        const getServicesSpy = jasmine.createSpy('getServices').and.returnValue(
            of(mockResponse),
        );
        const getAvailabilitySpy = jasmine.createSpy(
            'getAvailability',
        ).and.returnValue(
            of({
                busy_periods: [],
                schedule: [],
                professional_blocked_dates: [],
                service_blocked_dates: [],
                resource_busy_periods: [],
            }),
        );
        const createBookingSpy = jasmine.createSpy('createBooking').and.returnValue(
            of({ success: true, booking_id: 'b-1' }),
        );

        const bookingMock = {
            getServices: getServicesSpy,
            getAvailability: getAvailabilitySpy,
            createBooking: createBookingSpy,
        };

        const turnstileMock = jasmine.createSpyObj<TurnstileService>(
            'TurnstileService',
            ['loadScript', 'renderAndExecute'],
        );
        (turnstileMock.loadScript as jasmine.Spy).and.returnValue(
            Promise.resolve(),
        );
        (turnstileMock.renderAndExecute as jasmine.Spy).and.returnValue(
            Promise.resolve('tok-1'),
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
            },
            // queryParams is subscribed to (not snapshot read) in ngOnInit,
            // so we need an Observable here. Empty object = no professional
            // pre-select, no variant snapshot.
            queryParams: of({}),
        };

        TestBed.configureTestingModule({
            imports: [HttpClientTestingModule, BookingWizardComponent],
            providers: [
                { provide: ActivatedRoute, useValue: activatedRouteStub },
                { provide: BookingPublicService, useValue: bookingMock },
                { provide: TurnstileService, useValue: turnstileMock },
                // Real AvailabilityService — it has no DI deps and is
                // stateless. The wizard only calls its methods inside
                // search/load flows we don't exercise here.
                AvailabilityService,
            ],
        })
            .overrideComponent(BookingWizardComponent, {
                remove: { imports: [] },
                add: { imports: [StubWeeklyCalendarComponent] },
            });

        // Inject HttpTestingController to verify no accidental HTTP leak.
        TestBed.inject(HttpTestingController);

        fixture = TestBed.createComponent(BookingWizardComponent);
        component = fixture.componentInstance;

        bookingService = TestBed.inject(BookingPublicService) as any;
        turnstileService = TestBed.inject(
            TurnstileService,
        ) as jasmine.SpyObj<TurnstileService>;

        fixture.detectChanges();
    }));

    function fillContactForm() {
        component.formName = 'Ada';
        component.formPhone = '+34666555444';
        component.formEmail = 'ada@example.com';
    }

    describe('confirmBooking()', () => {
        it('does not call createBooking when no slot is selected', fakeAsync(() => {
            // Sanity: nothing selected and no step-1 form either — we want
            // the early-return on missing slot to be the reason, not a
            // missing service.
            expect(component.selectedSlot()).toBeNull();
            expect(component.service()).not.toBeNull();
            fillContactForm();

            component['confirmBooking']();
            tick();

            expect(bookingService.createBooking).not.toHaveBeenCalled();
            expect(component.submitting()).toBe(false);
            expect(component.step()).toBe(1);
        }));

        it('calls createBooking with the full payload on a valid submit', fakeAsync(() => {
            fillContactForm();
            component.selectedSlot.set(mockSlot);

            component['confirmBooking']();
            tick();

            expect(bookingService.createBooking).toHaveBeenCalledTimes(1);
            const payload = bookingService.createBooking.calls.mostRecent()
                .args[0];
            expect(payload.slug).toBe('testco');
            expect(payload.service_id).toBe('svc-1');
            expect(payload.client_name).toBe('Ada');
            expect(payload.client_email).toBe('ada@example.com');
            expect(payload.client_phone).toBe('+34666555444');
            expect(payload.turnstile_token).toBe('tok-1');
            expect(typeof payload.datetime).toBe('string');
            expect(payload.datetime).toContain('2026-06-22');
            expect(payload.datetime).toContain('09:30');
        }));

        it('shows the success state when createBooking returns success', fakeAsync(() => {
            fillContactForm();
            component.selectedSlot.set(mockSlot);

            // Sanity: not on the success step yet, and no booking id.
            expect(component.step()).toBe(1);
            expect(component.bookingId()).toBeNull();

            component['confirmBooking']();
            tick();
            fixture.detectChanges();

            // Wizard jumps to step 4 on success and renders the success
            // card. The booking_id from the response is also stored.
            expect(component.step()).toBe(4);
            expect(component.bookingId()).toBe('b-1');
            expect(component.submitting()).toBe(false);
            expect(component.submitError()).toBeNull();

            const text = fixture.nativeElement.textContent ?? '';
            expect(text).toContain('Reserva confirmada');
        }));
    });
});
