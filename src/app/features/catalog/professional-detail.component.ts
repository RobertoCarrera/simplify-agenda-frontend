import { Component, OnInit, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { TranslocoModule } from "@jsverse/transloco";
import {
  BookingPublicService,
  Professional,
  Service,
} from "../../services/booking-public.service";

@Component({
  selector: "app-professional-detail",
  standalone: true,
  imports: [CommonModule, RouterLink, TranslocoModule],
  template: `
    <div class="professional-detail-page" *ngIf="professional(); else loading">
      <header class="detail-header">
        <a [routerLink]="['/', slug(), 'profesionales']" class="back-link">
          ← {{ "common.back" | transloco }}
        </a>

        <div class="professional-profile">
          <div class="prof-avatar-large">
            <img
              *ngIf="professional()?.avatar_url; else initials"
              [src]="professional()?.avatar_url"
              [alt]="professional()?.display_name"
            />
            <ng-template #initials>
              <span class="initials">{{
                getInitials(professional()?.display_name || "")
              }}</span>
            </ng-template>
          </div>

          <div class="prof-details">
            <h1 class="professional-name">
              {{ professional()?.display_name }}
            </h1>
            <p class="professional-title" *ngIf="professional()?.title">
              {{ professional()?.title }}
            </p>
          </div>
        </div>
      </header>

      <section class="services-section">
        <h2>{{ "professional.services" | transloco }}</h2>
        <div class="services-grid">
          <div
            class="service-item"
            *ngFor="let service of servicesForProfessional()"
            (click)="bookService(service)"
          >
            <div class="service-info">
              <span class="service-name">{{ service.name }}</span>
              <span class="service-duration"
                >{{ service.duration_minutes }} min</span
              >
            </div>
            <span class="service-price">{{ service.price }}€</span>
          </div>
        </div>
      </section>

      <div class="actions">
        <a
          [routerLink]="['/', slug(), 'reservar']"
          [queryParams]="{ professional: professional()?.id }"
          class="btn btn-primary btn-lg"
        >
          {{ "professional.bookAppointment" | transloco }}
        </a>
      </div>
    </div>

    <ng-template #loading>
      <div class="loading-state">
        <p>{{ "common.loading" | transloco }}</p>
      </div>
    </ng-template>
  `,
  styles: [
    `
      .professional-detail-page {
        max-width: 800px;
        margin: 0 auto;
        padding: var(--space-8) var(--space-4);
      }

      .detail-header {
        margin-bottom: var(--space-8);
      }

      .back-link {
        display: inline-block;
        color: var(--color-text-secondary);
        text-decoration: none;
        margin-bottom: var(--space-6);
        transition: color var(--transition-fast);
      }

      .back-link:hover {
        color: var(--color-text);
      }

      .professional-profile {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: var(--space-6);
      }

      .prof-avatar-large {
        width: 120px;
        height: 120px;
        border-radius: 50%;
        overflow: hidden;
        background: var(--color-primary);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .prof-avatar-large img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .initials {
        font-size: 2.25rem;
        font-weight: var(--font-weight-bold);
        color: var(--color-primary-text);
      }

      .prof-details {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }

      .professional-name {
        font-size: var(--font-size-3xl);
        font-weight: var(--font-weight-bold);
        color: var(--color-text);
        margin: 0;
      }

      .professional-title {
        font-size: var(--font-size-lg);
        color: var(--color-text-secondary);
        margin: 0;
      }

      .services-section {
        margin-bottom: var(--space-8);
      }

      .services-section h2 {
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-semibold);
        margin: 0 0 var(--space-4) 0;
      }

      .services-grid {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }

      .service-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--space-4) var(--space-6);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        cursor: pointer;
        transition: all var(--transition-fast);
      }

      .service-item:hover {
        border-color: var(--color-primary);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }

      .service-info {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }

      .service-name {
        font-weight: var(--font-weight-medium);
        color: var(--color-text);
      }

      .service-duration {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
      }

      .service-price {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-bold);
        color: var(--color-primary);
      }

      .actions {
        display: flex;
        justify-content: center;
      }

      .btn-lg {
        padding: var(--space-4) var(--space-8);
        font-size: var(--font-size-lg);
      }

      .btn {
        border-radius: var(--radius-md);
        font-weight: var(--font-weight-medium);
        text-align: center;
        text-decoration: none;
        transition: all var(--transition-fast);
      }

      .btn-primary {
        background: var(--color-primary);
        border: 1px solid var(--color-primary);
        color: var(--color-primary-text);
      }

      .btn-primary:hover {
        filter: brightness(1.1);
      }

      .loading-state {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 300px;
      }
    `,
  ],
})
export class ProfessionalDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private bookingService = inject(BookingPublicService);

  professional = signal<Professional | null>(null);
  services = signal<Service[]>([]);
  slug = signal<string>("");

  ngOnInit() {
    // Get slug from route
    this.route.paramMap.subscribe((params) => {
      const slugParam = params.get("slug");
      if (slugParam) {
        this.slug.set(slugParam);
      }
    });

    // Get resolved professional data
    this.route.data.subscribe((data) => {
      if (data["professional"]) {
        this.professional.set(data["professional"] as Professional);
        this.services.set(data["professional"]["services"] || []);
      }
    });

    // Also check route param for professional ID (fallback)
    const professionalId = this.route.snapshot.paramMap.get("id");
    if (professionalId && !this.professional()) {
      this.loadProfessional(professionalId);
    }
  }

  private loadProfessional(id: string) {
    this.bookingService.getProfessional(id).subscribe({
      next: (professional) => {
        this.professional.set(professional);
        this.services.set(professional.services || []);
      },
      error: (err) => {
        console.error("Error loading professional:", err);
      },
    });
  }

  servicesForProfessional(): Service[] {
    const prof = this.professional();
    if (!prof) return [];
    return prof.services || [];
  }

  getInitials(name: string): string {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  bookService(service: Service) {
    const currentSlug = this.slug();
    this.router.navigate(["/", currentSlug, "reservar", service.id], {
      queryParams: { professional: this.professional()?.id },
    });
  }
}
