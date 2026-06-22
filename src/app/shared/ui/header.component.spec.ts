import { ComponentFixture, TestBed, fakeAsync, tick } from "@angular/core/testing";
import { provideRouter, Router, NavigationEnd } from "@angular/router";
import { Location } from "@angular/common";
import { Subject } from "rxjs";
import { HeaderComponent } from "./header.component";
import { LanguageSwitcherComponent } from "./language-switcher.component";
import { CartService } from "../services/cart.service";
import { TranslocoTestingModule } from "@jsverse/transloco";
import { Component, Input } from "@angular/core";
import { CommonModule } from "@angular/common";

/**
 * Minimal stub for the language switcher (the header imports it).
 * The real component pulls from Transloco and registers a route
 * listener; we don't need any of that here.
 */
@Component({
  selector: "app-language-switcher",
  standalone: true,
  template: `<span class="lang-stub">lang</span>`,
  imports: [CommonModule],
})
class LanguageSwitcherStub {}

const mockProduct = (overrides: Partial<{ id: string; name: string; price: number | null }> = {}) => ({
  id: "p1",
  name: "Test Product",
  price: 10,
  description: null,
  stock_quantity: null,
  brand: null,
  model: null,
  barcode: null,
  location: null,
  category_id: null,
  category_name: null,
  ...overrides,
});

describe("HeaderComponent", () => {
  let fixture: ComponentFixture<HeaderComponent>;
  let compiled: HTMLElement;
  let cart: CartService;
  let router: Router;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [
        HeaderComponent,
        LanguageSwitcherStub,
        // TranslocoModule is imported by HeaderComponent. Provide the
        // real Spanish translations for the nav keys so the link text
        // assertions can match "Servicios" / "Inicio" / etc.
        // preloadLangs: true so the translations are loaded eagerly
        // during the APP_INITIALIZER, before the component renders.
        TranslocoTestingModule.forRoot({
          langs: {
            es: {
              nav: {
                home: "Inicio",
                services: "Servicios",
                professionals: "Profesionales",
              },
              notFound: {
                title: "Página no encontrada",
                description: "Lo sentimos, no pudimos encontrar lo que buscabas.",
                goHome: "Volver al inicio",
                viewServices: "Ver servicios",
              },
            },
            en: {
              nav: {
                home: "Home",
                services: "Services",
                professionals: "Professionals",
              },
            },
          },
          preloadLangs: true,
          translocoConfig: {
            defaultLang: "es",
            availableLangs: ["es", "en"],
            prodMode: true,
          },
        }),
      ],
      providers: [
        provideRouter([]),
        // Stub the Location service to return a controllable path.
        // The real Location reads from window.location which is harder
        // to control in tests; this stub is enough because the header
        // only reads `path()`.
        { provide: Location, useValue: { path: () => "" } },
      ],
    })
      // The real header imports the language switcher by class name.
      // We replace it with the stub here so we don't need a real
      // language switcher. The remove list is required to avoid a
      // NG0300 "multiple components match" error (both classes share
      // the same selector).
      .overrideComponent(HeaderComponent, {
        remove: { imports: [LanguageSwitcherComponent] },
        add: { imports: [LanguageSwitcherStub] },
      })
      .compileComponents();
    fixture = TestBed.createComponent(HeaderComponent);
    cart = TestBed.inject(CartService);
    router = TestBed.inject(Router);
    compiled = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    // Clear the cart so items from one spec don't leak into the
    // next. cart is guaranteed to be set because beforeEach always
    // assigns it (TestBed throws if the component can't compile,
    // which would prevent afterEach from running).
    localStorage.clear();
    cart.clear();
  });

  it("renders the company name when provided", () => {
    fixture.componentInstance.companyName = "Acme Co";
    fixture.detectChanges();
    expect(compiled.querySelector(".logo-text")?.textContent).toContain("Acme Co");
  });

  it("renders the logo image when logoUrl is provided", () => {
    fixture.componentInstance.logoUrl = "https://example.com/logo.png";
    fixture.componentInstance.companyName = "Acme Co";
    fixture.detectChanges();
    const img = compiled.querySelector("img.logo-img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("https://example.com/logo.png");
  });

  describe("cart badge", () => {
    it("does NOT render the cart link when there is no slug in the URL", () => {
      // Default state: router.url is '/', so slug() is '' and the
      // *ngIf guards the button out.
      const link = compiled.querySelector(".cart-button");
      expect(link).toBeNull();
    });

    it("renders the cart link after the queueMicrotask initial read settles", async () => {
      // Regression test for the production bug where the cart icon
      // never appeared because router.url was '/' at ngOnInit time
      // and the NavigationEnd subscription fired before the test
      // (or the user) could observe the change.
      //
      // The fix: the header re-reads router.url on a queueMicrotask
      // after ngOnInit. We simulate the navigation through the test
      // helper (which dispatches NavigationEnd) and then flush the
      // microtask queue so the re-read fires.
      simulateNavigation(router, "/acme/servicios");
      // Flush the microtask queueMicrotask uses inside HeaderComponent.
      await Promise.resolve();
      fixture.detectChanges();
      const link = compiled.querySelector(".cart-button");
      expect(link).not.toBeNull();
      expect(link?.getAttribute("href")).toBe("/acme/cart");
    });

    it("renders the cart link with the correct href when a slug is in the URL", () => {
      // Force the slug to update by navigating.
      simulateNavigation(router, "/acme/servicios");
      fixture.detectChanges();
      const link = compiled.querySelector(".cart-button");
      expect(link).not.toBeNull();
      expect(link?.getAttribute("href")).toBe("/acme/cart");
    });

    it("does NOT show a badge when the cart is empty", () => {
      simulateNavigation(router, "/acme/servicios");
      fixture.detectChanges();
      const badge = compiled.querySelector(".cart-badge");
      expect(badge).toBeNull();
    });

    it("shows a badge with the cart count when the cart is non-empty", () => {
      simulateNavigation(router, "/acme/servicios");
      cart.add(mockProduct({ id: "a", price: 10 }));
      cart.add(mockProduct({ id: "a", price: 10 })); // qty 2
      cart.add(mockProduct({ id: "b", price: 5 }));  // qty 1
      fixture.detectChanges();
      const badge = compiled.querySelector(".cart-badge");
      expect(badge).not.toBeNull();
      expect(badge?.textContent?.trim()).toBe("3");
    });

    it("updates aria-label to include the live cart count", () => {
      simulateNavigation(router, "/acme/servicios");
      cart.add(mockProduct({ id: "a" }));
      fixture.detectChanges();
      const link = compiled.querySelector(".cart-button");
      expect(link?.getAttribute("aria-label")).toBe("Carrito (1)");
    });

    it("marks the cart button as 'empty' (lower opacity) when count is zero", () => {
      simulateNavigation(router, "/acme/servicios");
      fixture.detectChanges();
      const link = compiled.querySelector(".cart-button");
      expect(link?.classList.contains("cart-empty")).toBe(true);
    });
  });

  describe("slug extraction", () => {
    it("treats /<slug>/servicios as a company route", () => {
      simulateNavigation(router, "/acme/servicios");
      fixture.detectChanges();
      expect(fixture.componentInstance.slug()).toBe("acme");
    });

    it("treats /<slug>/cart as a company route", () => {
      simulateNavigation(router, "/acme/cart");
      fixture.detectChanges();
      expect(fixture.componentInstance.slug()).toBe("acme");
    });

    it("rejects /<slug>/<unknown> as a company route (no cart shown)", () => {
      simulateNavigation(router, "/acme/dashboard");
      fixture.detectChanges();
      expect(fixture.componentInstance.slug()).toBe("");
    });

    it("rejects /<something> as a slug (no second segment)", () => {
      simulateNavigation(router, "/acme");
      fixture.detectChanges();
      expect(fixture.componentInstance.slug()).toBe("");
    });

    it("rejects /404 as a company route", () => {
      simulateNavigation(router, "/404");
      fixture.detectChanges();
      expect(fixture.componentInstance.slug()).toBe("");
    });
  });

  describe("nav links", () => {
    it("points logo link at /<slug> when a slug is set", () => {
      simulateNavigation(router, "/acme/servicios");
      fixture.detectChanges();
      const logo = compiled.querySelector("a.logo");
      expect(logo?.getAttribute("href")).toBe("/acme");
    });

    it("points servicios link at /<slug>/servicios", () => {
      simulateNavigation(router, "/acme/servicios");
      fixture.detectChanges();
      const links = Array.from(compiled.querySelectorAll(".main-nav a"));
      const servicios = links.find((a) => a.textContent?.includes("Servicios"));
      expect(servicios?.getAttribute("href")).toBe("/acme/servicios");
    });

    it("falls back to /servicios when there is no slug", () => {
      // No navigation — default state.
      const links = Array.from(compiled.querySelectorAll(".main-nav a"));
      const servicios = links.find((a) => a.textContent?.includes("Servicios"));
      expect(servicios?.getAttribute("href")).toBe("/servicios");
    });
  });

  it("has an aria-label on the nav element", () => {
    const nav = compiled.querySelector("nav");
    expect(nav?.getAttribute("aria-label")).toBeTruthy();
  });
});

/**
 * Helper: dispatch a fake NavigationEnd on the router and update the
 * Location stub. Real router navigation in a test is racy with
 * `provideRouter([])` (no routes registered). The header reads from
 * Location.path() and subscribes to NavigationEnd, so both must be
 * simulated here.
 */
function simulateNavigation(router: Router, url: string) {
  // Update the Location stub so the header reads the new path on the
  // next read. The stub is a plain object, so we mutate it.
  const locationStub = TestBed.inject(Location) as unknown as { path: () => string };
  locationStub.path = () => url;
  // Reach into the router's events subject and dispatch a NavigationEnd.
  void router.navigateByUrl(url);
  (router as unknown as { events: Subject<unknown> }).events.next(
    new NavigationEnd(0, url, url),
  );
}
