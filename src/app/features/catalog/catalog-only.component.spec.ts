import { TestBed, ComponentFixture, waitForAsync } from "@angular/core/testing";
import { ActivatedRoute, convertToParamMap } from "@angular/router";
import { of } from "rxjs";
import { CatalogOnlyComponent } from "./catalog-only.component";
import { BookingPublicService } from "../../services/booking-public.service";

const bookingMock = {
    getServices: jasmine.createSpy("getServices").and.returnValue(
        of({
            company: {
                id: "c1",
                name: "Acme",
                portal_features: {
                    show_booking: false,
                    show_catalog: true,
                    show_shop: false,
                    show_professionals: false,
                    show_availability: false,
                },
            },
            services: [],
            products: [],
            professionals: [],
        }),
    ),
};

const activatedRouteStub = {
    parent: { snapshot: { paramMap: convertToParamMap({ slug: "acme" }) } },
    snapshot: { paramMap: convertToParamMap({ slug: "acme" }) },
};

describe("CatalogOnlyComponent empty state", () => {
    let fixture: ComponentFixture<CatalogOnlyComponent>;

    beforeEach(waitForAsync(async () => {
        await TestBed.configureTestingModule({
            imports: [CatalogOnlyComponent],
            providers: [
                { provide: ActivatedRoute, useValue: activatedRouteStub },
                { provide: BookingPublicService, useValue: bookingMock },
            ],
        }).compileComponents();
        fixture = TestBed.createComponent(CatalogOnlyComponent);
        fixture.detectChanges();
    }));

    it("renders the empty-state when there are no services", () => {
        expect(fixture.nativeElement.querySelector("app-empty-state")).not.toBeNull();
        expect(fixture.nativeElement.textContent).toContain("Aún no hay servicios disponibles.");
    });
});