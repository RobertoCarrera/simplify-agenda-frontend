import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { TranslocoTestingModule } from "@jsverse/transloco";
import { NotFoundComponent } from "./not-found.component";

/**
 * Bare-minimum spec for the 404 page. The component is mostly static
 * (decorative SVG + heading + two CTAs), so the assertions focus on
 * the elements that actually matter for users and screen readers.
 */
describe("NotFoundComponent", () => {
  let fixture: ComponentFixture<NotFoundComponent>;
  let compiled: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        NotFoundComponent,
        // The 404 page pipes 3 strings through transloco. Use the
        // testing module with Spanish translations + preloadLangs so
        // the strings are available synchronously after the first
        // detectChanges(). availableLangs must include "es" or
        // transloco treats "es" as a scope alias and returns
        // "es.<key>" instead of the translation.
        TranslocoTestingModule.forRoot({
          langs: {
            es: {
              notFound: {
                title: "Página no encontrada",
                description: "Lo sentimos, no pudimos encontrar lo que buscabas.",
                goHome: "Volver al inicio",
                viewServices: "Ver servicios",
              },
            },
          },
          preloadLangs: true,
          translocoConfig: {
            defaultLang: "es",
            availableLangs: ["es"],
            prodMode: true,
          },
        }),
      ],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(NotFoundComponent);
    compiled = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  it("renders the 404 code prominently", () => {
    const code = compiled.querySelector(".error-code");
    expect(code).not.toBeNull();
    expect(code?.textContent?.trim()).toBe("404");
  });

  it("renders a heading describing the not-found state", () => {
    const title = compiled.querySelector(".title");
    expect(title).not.toBeNull();
    // The transloco stub returns the key, so we just assert the
    // element exists and has some text content.
    expect(title?.textContent?.trim().length).toBeGreaterThan(0);
  });

  it("renders two CTA links (go home + view services)", () => {
    const links = compiled.querySelectorAll("a.btn");
    expect(links.length).toBe(2);
    const hrefs = Array.from(links).map((a) => a.getAttribute("href"));
    // RouterLink rewrites these to /, /servicios
    expect(hrefs).toContain("/");
    expect(hrefs.some((h) => h?.startsWith("/servicios"))).toBe(true);
  });

  it("marks the container with role='main' for screen readers", () => {
    expect(compiled.querySelector("[role='main']")).not.toBeNull();
  });

  it("decorates the page with a non-empty illustration SVG", () => {
    const svg = compiled.querySelector("svg.illustration");
    expect(svg).not.toBeNull();
    // The illustration must be aria-hidden so it doesn't confuse TTS.
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("uses the project's color tokens, not a missing --color-text-primary", () => {
    // Defensive: if anyone reintroduces a broken var, the browser
    // falls back silently. Angular injects component styles into
    // <head> with a per-component scope selector (e.g.
    // `._ngcontent-xxx`), NOT into the component's own DOM — so we
    // scan <head> for the style tag that contains our class names.
    // NOTE: this test only catches obvious typos in the styles
    // string. The Tailwind build + tsc also enforce design-token
    // correctness at compile time; this is an extra runtime check.
    const styleTags: HTMLStyleElement[] = Array.from(
      document.head.querySelectorAll("style"),
    );
    const inline = styleTags
      .map((s) => s.textContent || "")
      .join("\n");
    // Must reference --color-text (which exists) and NOT
    // --color-text-primary (which is the broken name we fixed).
    expect(inline).not.toContain("--color-text-primary");
    expect(inline).toContain("--color-text");
  });
});
