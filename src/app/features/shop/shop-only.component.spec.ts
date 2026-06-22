import { TestBed, ComponentFixture, waitForAsync } from "@angular/core/testing";
import { ActivatedRoute, convertToParamMap } from "@angular/router";
import { of } from "rxjs";
import { ShopOnlyComponent } from "./shop-only.component";
import { BookingPublicService } from "../../services/booking-public.service";
import { CartService } from "../../shared/services/cart.service";
import { EmptyStateComponent } from "../../shared/ui/empty-state.component";

const makeBookingMock = (products: any[]) => ({
    getServices: jasmine.createSpy("getServices").and.returnValue(
        of({
            company: {
                id: "c1",
                name: "Acme",
                portal_features: {
                    show_booking: true,
                    show_catalog: false,
                    show_shop: true,
                    show_professionals: true,
                    show_availability: true,
                },
            },
            services: [],
            products,
            professionals: [],
        }),
    ),
});

const activatedRouteStub = {
    parent: { snapshot: { paramMap: convertToParamMap({ slug: "acme" }) } },
    snapshot: { paramMap: convertToParamMap({ slug: "acme" }) },
};

async function setup(products: any[]) {
    await TestBed.configureTestingModule({
        imports: [ShopOnlyComponent, EmptyStateComponent],
        providers: [
            { provide: ActivatedRoute, useValue: activatedRouteStub },
            { provide: BookingPublicService, useValue: makeBookingMock(products) },
            CartService,
        ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ShopOnlyComponent);
    fixture.detectChanges();
    return fixture;
}

describe("ShopOnlyComponent empty states", () => {
    let fixture: ComponentFixture<ShopOnlyComponent>;

    beforeEach(waitForAsync(() => {
        localStorage.clear();
    }));

    afterEach(() => {
        localStorage.clear();
    });

    it("renders the shop empty-state when there are no products", waitForAsync(async () => {
        fixture = await setup([]);
        expect(fixture.nativeElement.querySelector("app-empty-state")).not.toBeNull();
        expect(fixture.nativeElement.textContent).toContain("Próximamente publicaremos nuevos productos.");
    }));

    it("renders the no-results empty-state with a clear-filters button when products exist but none match the search", waitForAsync(async () => {
        // `searchQuery` and `selectedCategory` are signals (WritableSignal<string>),
        // so we use `.set()` and `()` to read them. Setting a value on a
        // signal triggers the `filteredProducts` computed to re-evaluate.
        fixture = await setup([{ id: "p1", name: "Camiseta", price: 19.99 }]);
        const comp = fixture.componentInstance as any;
        comp.searchQuery.set("nada");
        comp.selectedCategory.set("");
        fixture.detectChanges();
        const empty = fixture.nativeElement.querySelector("app-empty-state");
        expect(empty).not.toBeNull();
        const text = fixture.nativeElement.textContent ?? "";
        expect(text).toContain("No hay productos que coincidan con tu búsqueda.");
        const btn = Array.from(fixture.nativeElement.querySelectorAll("button"))
            .find((b: any) => (b.textContent ?? "").includes("Limpiar filtros"));
        expect(btn).toBeTruthy();
        (btn as HTMLButtonElement).click();
        fixture.detectChanges();
        expect(comp.searchQuery()).toBe("");
    }));
});