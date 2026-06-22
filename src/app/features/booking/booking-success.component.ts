import { Component, OnInit, signal, inject } from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { TranslocoModule } from "@jsverse/transloco";

@Component({
  selector: "app-booking-success",
  standalone: true,
  imports: [RouterLink, TranslocoModule],
  template: `
    <div class="booking-success" role="main">
      <div class="success-card" role="status" aria-live="assertive">
        <div class="success-icon" aria-hidden="true">✓</div>
        <h1>{{ "booking.success.title" | transloco }}</h1>
        <p>{{ "booking.success.message" | transloco }}</p>

        <div class="booking-details">
          <div class="detail-row">
            <span class="label"
              >{{ "booking.success.bookingId" | transloco }}:</span
            >
            <span class="value" aria-label="Código de reserva: {{ bookingId() }}">{{ bookingId() }}</span>
          </div>
        </div>

        <div class="success-actions">
          <button class="btn btn-primary">
            {{ "booking.success.addToCalendar" | transloco }}
          </button>
          <a
            [routerLink]="['/', slug(), 'servicios']"
            class="btn btn-secondary"
          >
            {{ "booking.success.backToHome" | transloco }}
          </a>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .booking-success {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--space-4);
        background: var(--color-surface);
      }

      .success-card {
        background: var(--color-bg);
        border-radius: var(--radius-xl);
        padding: var(--space-8);
        text-align: center;
        max-width: 400px;
        width: 100%;
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
      }

      .success-icon {
        width: 64px;
        height: 64px;
        background: var(--color-success);
        color: white;
        font-size: var(--font-size-3xl);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto var(--space-6);
      }

      h1 {
        font-size: var(--font-size-2xl);
        margin-bottom: var(--space-2);
      }

      p {
        color: var(--color-text-secondary);
        margin-bottom: var(--space-6);
      }

      .booking-details {
        background: var(--color-surface);
        border-radius: var(--radius-md);
        padding: var(--space-4);
        margin-bottom: var(--space-6);

        .detail-row {
          display: flex;
          justify-content: space-between;

          .label {
            color: var(--color-text-secondary);
          }

          .value {
            font-weight: var(--font-weight-semibold);
          }
        }
      }

      .success-actions {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);

        .btn {
          width: 100%;
        }
      }
    `,
  ],
})
export class BookingSuccessComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  bookingId = signal<string>("");
  slug = signal<string>("");

  ngOnInit() {
    // Get slug from parent route
    const parentSnapshot = this.route.parent?.snapshot;
    if (parentSnapshot) {
      const slugParam = parentSnapshot.paramMap.get("slug");
      if (slugParam) {
        this.slug.set(slugParam);
      }
    }

    // Get bookingId from route params
    const bookingIdParam = this.route.snapshot.paramMap.get("bookingId");
    if (bookingIdParam) {
      this.bookingId.set(bookingIdParam);
    } else {
      this.bookingId.set("N/A");
    }
  }
}
