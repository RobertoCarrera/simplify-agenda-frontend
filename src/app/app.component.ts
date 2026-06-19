import { Component, inject, OnInit } from "@angular/core";
import { RouterOutlet, Router, NavigationEnd } from "@angular/router";
import { FooterComponent } from "./shared/ui/footer.component";
import { HeaderComponent } from "./shared/ui/header.component";
import { TranslocoService } from "@jsverse/transloco";
import { filter } from "rxjs/operators";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet, FooterComponent, HeaderComponent],
  template: `
    <div class="app-layout">
      <app-header [companyName]="companyName" [logoUrl]="logoUrl" />
      <main class="app-container">
        <router-outlet></router-outlet>
      </main>
      <app-footer />
    </div>
  `,
  styles: [
    `
      .app-layout {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
      }

      .app-container {
        flex: 1;
        padding: 0 24px;
        font-family:
          "Inter",
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          Roboto,
          sans-serif;
      }
    `,
  ],
})
export class AppComponent implements OnInit {
  // Branding defaults until the company resolver hydrates a value.
  // The header keeps these as fallback; we update them when the active route resolves a company.
  companyName = "Simplifica";
  logoUrl: string | undefined;

  ngOnInit() {
    // Detect and react to browser dark mode preference — applies class to <html>
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    document.documentElement.classList.toggle("dark", mq?.matches ?? false);
    mq?.addEventListener("change", (e) => {
      document.documentElement.classList.toggle("dark", e.matches);
    });

    // Language
    const transloco = inject(TranslocoService);
    const available = ["es", "ca"];
    const browserLang = (navigator.languages?.[0] ?? navigator.language ?? "es")
      .slice(0, 2)
      .toLowerCase();
    transloco.setActiveLang(available.includes(browserLang) ? browserLang : "es");

    // Hydrate header branding from the cached company, if any.
    // The company resolver (in app.routes.ts) caches the active company under
    // the 'currentCompany' localStorage key after the first navigation.
    try {
      const cached = localStorage.getItem("currentCompany");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.name) this.companyName = parsed.name;
        if (parsed?.logo_url) this.logoUrl = parsed.logo_url;
      }
    } catch {
      // ignore — defaults stay in place
    }
  }
}
