import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";
import { TranslocoModule } from "@jsverse/transloco";

/**
 * 404 page. Reached via:
 *   - direct visit to a route the router doesn't recognise
 *   - the wildcard route in app.routes.ts
 *   - explicit `router.navigate(['/404'])` from any resolver (e.g. when
 *     a company slug is not found)
 *
 * The page is intentionally minimal: the goal is to unblock the
 * customer and route them back to the catalog. We don't render the
 * active company here because by the time we land on this page, the
 * route is broken — there is no active company to render.
 */
@Component({
  selector: "app-not-found",
  standalone: true,
  imports: [RouterLink, TranslocoModule],
  template: `
    <main class="not-found-page" role="main">
      <div class="content">
        <svg
          class="illustration"
          viewBox="0 0 200 200"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="100" cy="100" r="80" opacity="0.18"></circle>
          <circle cx="100" cy="100" r="60" opacity="0.30"></circle>
          <line x1="65" y1="80" x2="135" y2="120"></line>
          <line x1="65" y1="120" x2="135" y2="80"></line>
        </svg>
        <h1 class="error-code">404</h1>
        <h2 class="title">{{ "notFound.title" | transloco }}</h2>
        <p class="description">{{ "notFound.description" | transloco }}</p>

        <div class="actions">
          <a routerLink="/" class="btn btn-primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            {{ "notFound.goHome" | transloco }}
          </a>
          <a routerLink="/servicios" class="btn btn-outline">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            {{ "notFound.viewServices" | transloco }}
          </a>
        </div>
      </div>
    </main>
  `,
  styles: [
    `
      .not-found-page {
        min-height: calc(100vh - 200px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem 1rem;
      }

      .content {
        text-align: center;
        max-width: 32rem;
      }

      .illustration {
        width: 7rem;
        height: 7rem;
        color: var(--color-primary);
        margin: 0 auto 1.5rem;
        display: block;
      }

      .error-code {
        font-size: 5rem;
        font-weight: 700;
        color: var(--color-primary);
        margin: 0;
        line-height: 1;
        letter-spacing: -0.02em;
      }

      .title {
        font-size: 1.5rem;
        font-weight: 600;
        color: var(--color-text);
        margin: 1rem 0 0.5rem;
      }

      .description {
        color: var(--color-text-secondary);
        font-size: 1rem;
        line-height: 1.5;
        margin: 0 0 2rem;
      }

      .actions {
        display: flex;
        gap: 0.75rem;
        justify-content: center;
        flex-wrap: wrap;
      }

      .btn {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.625rem 1.25rem;
        border-radius: 0.5rem;
        font-size: 0.9375rem;
        font-weight: 500;
        text-decoration: none;
        transition: all 150ms ease;
        font-family: inherit;
        border: 1px solid transparent;
      }

      .btn svg {
        width: 1rem;
        height: 1rem;
        display: block;
        flex-shrink: 0;
      }

      .btn-primary {
        background: var(--color-primary);
        color: var(--color-primary-text, white);
        border-color: var(--color-primary);
      }

      .btn-primary:hover { filter: brightness(1.1); }

      .btn-outline {
        background: transparent;
        border-color: var(--color-border);
        color: var(--color-text);
      }

      .btn-outline:hover {
        background: var(--color-surface-hover);
      }

      @media (max-width: 480px) {
        .error-code { font-size: 4rem; }
        .illustration { width: 5.5rem; height: 5.5rem; }
        .actions { flex-direction: column; align-items: stretch; }
        .btn { justify-content: center; }
      }
    `,
  ],
})
export class NotFoundComponent {}
