import { Component, OnInit, inject, signal } from "@angular/core";
import { ActivatedRoute, RouterLink, RouterLinkActive } from "@angular/router";
import { TranslocoModule } from "@jsverse/transloco";
import { CommonModule } from "@angular/common";
import {
  BookingPublicService,
  Professional,
} from "../../services/booking-public.service";

@Component({
  selector: "app-professionals",
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslocoModule, CommonModule],
  template: `
    <div class="professionals-page">
      <header class="page-header">
        <h1>{{ "professionals.title" | transloco }}</h1>
        <p>{{ "professionals.subtitle" | transloco }}</p>
      </header>

      <nav class="catalog-nav">
        <a [routerLink]="['/', slug(), 'servicios']" routerLinkActive="active">
          {{ "nav.services" | transloco }}
        </a>
        <a
          [routerLink]="['/', slug(), 'profesionales']"
          routerLinkActive="active"
        >
          {{ "nav.professionals" | transloco }}
        </a>
      </nav>

      <div class="professionals-content">
        @if (loading()) {
          <div class="loading-state">
            <p>{{ "common.loading" | transloco }}</p>
          </div>
        } @else if (error()) {
          <div class="error-state">
            <p>{{ error() }}</p>
          </div>
        } @else if (professionals().length === 0) {
          <p class="text-muted text-center">
            {{ "professionals.noProfessionals" | transloco }}
          </p>
        } @else {
          <div class="professionals-grid">
            @for (prof of professionals(); track prof.id) {
              <div class="professional-card">
                <div class="prof-avatar">
                  <img
                    *ngIf="prof.avatar_url; else initials"
                    [src]="prof.avatar_url"
                    [alt]="prof.display_name"
                  />
                  <ng-template #initials>
                    <span class="initials">{{
                      getInitials(prof.display_name)
                    }}</span>
                  </ng-template>
                </div>
                <div class="prof-info">
                  <h3>{{ prof.display_name }}</h3>
                  <p class="title" *ngIf="prof.title">{{ prof.title }}</p>
                  <p class="bio" *ngIf="prof.bio">{{ prof.bio }}</p>
                </div>
                <div class="prof-actions">
                  <a
                    [routerLink]="['/', slug(), 'profesionales', prof.id]"
                    class="btn btn-outline"
                  >
                    {{ "common.viewProfile" | transloco }}
                  </a>
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .professionals-page {
        max-width: 1200px;
        margin: 0 auto;
        padding: var(--space-8) var(--space-4);
      }

      .page-header {
        text-align: center;
        margin-bottom: var(--space-8);

        h1 {
          font-size: var(--font-size-3xl);
          margin-bottom: var(--space-2);
        }

        p {
          color: var(--color-text-secondary);
          font-size: var(--font-size-lg);
        }
      }

      .catalog-nav {
        display: flex;
        justify-content: center;
        gap: var(--space-4);
        margin-bottom: var(--space-8);

        a {
          padding: var(--space-3) var(--space-6);
          border-radius: var(--radius-full);
          color: var(--color-text-secondary);
          font-weight: var(--font-weight-medium);
          transition: all var(--transition-fast);

          &:hover {
            background: var(--color-surface);
            color: var(--color-text);
          }

          &.active {
            background: var(--color-primary);
            color: var(--color-primary-text);
          }
        }
      }

      .professionals-content {
        min-height: 300px;
      }

      .professionals-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: var(--space-6);
      }

      .professional-card {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        padding: var(--space-6);
        text-align: center;
        transition: all var(--transition-fast);

        &:hover {
          border-color: var(--color-primary);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
      }

      .prof-avatar {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        overflow: hidden;
        background: var(--color-primary);
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto var(--space-4);
      }

      .prof-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .initials {
        font-size: var(--font-size-2xl);
        font-weight: var(--font-weight-bold);
        color: var(--color-primary-text);
      }

      .prof-info {
        h3 {
          font-size: var(--font-size-lg);
          font-weight: var(--font-weight-semibold);
          margin: 0 0 var(--space-2) 0;
          color: var(--color-text);
        }

        .title {
          font-size: var(--font-size-sm);
          color: var(--color-text-secondary);
          margin-bottom: var(--space-2);
        }

        .bio {
          font-size: var(--font-size-sm);
          color: var(--color-text-secondary);
          margin-bottom: var(--space-4);
          line-height: 1.5;
        }
      }

      .prof-actions {
        margin-top: var(--space-4);
      }

      .btn {
        padding: var(--space-2) var(--space-4);
        border-radius: var(--radius-md);
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        text-decoration: none;
        transition: all var(--transition-fast);
      }

      .btn-outline {
        background: transparent;
        border: 1px solid var(--color-border);
        color: var(--color-text);

        &:hover {
          border-color: var(--color-primary);
          color: var(--color-primary);
        }
      }

      .loading-state,
      .error-state {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 300px;
      }

      .error-state {
        color: var(--color-error);
      }
    `,
  ],
})
export class ProfessionalsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private bookingService = inject(BookingPublicService);

  professionals = signal<Professional[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  slug = signal<string>("");

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      const slugParam = params.get("slug");
      if (slugParam) {
        this.slug.set(slugParam);
        this.loadProfessionals(slugParam);
      }
    });
  }

  private loadProfessionals(slug: string) {
    this.loading.set(true);
    this.error.set(null);

    this.bookingService.getServices(slug).subscribe({
      next: (response) => {
        this.professionals.set(response.professionals ?? []);
        this.loading.set(false);
      },
      error: (err) => {
        console.error("Error loading professionals:", err);
        this.error.set("Error loading professionals");
        this.loading.set(false);
      },
    });
  }

  getInitials(name: string): string {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
}
