import { Component, Input, Output, EventEmitter } from "@angular/core";
import { TranslocoModule } from "@jsverse/transloco";

@Component({
  selector: "app-calendar-navigation",
  standalone: true,
  imports: [TranslocoModule],
  template: `
    <div class="calendar-nav">
      <button
        class="nav-btn nav-prev"
        (click)="onPrevious()"
        [attr.aria-label]="'calendar.previousWeek' | transloco"
      >
        ← {{ "calendar.previous" | transloco }}
      </button>

      <div class="nav-info">
        <span class="week-range">{{ weekLabel }}</span>
        <button *ngIf="canGoToToday" class="today-btn" (click)="onToday()">
          {{ "calendar.today" | transloco }}
        </button>
      </div>

      <button
        class="nav-btn nav-next"
        (click)="onNext()"
        [attr.aria-label]="'calendar.nextWeek' | transloco"
      >
        {{ "calendar.next" | transloco }} →
      </button>
    </div>
  `,
  styles: [
    `
      .calendar-nav {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--space-4) var(--space-6);
        background: var(--color-surface);
        border-radius: var(--radius-lg);
        border: 1px solid var(--color-border);
      }

      .nav-btn {
        padding: var(--space-3) var(--space-5);
        background: var(--color-surface-hover);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        cursor: pointer;
        font-weight: var(--font-weight-medium);
        color: var(--color-text);
        transition: all var(--transition-fast);
      }

      .nav-btn:hover {
        background: var(--color-primary);
        color: var(--color-primary-text);
        border-color: var(--color-primary);
      }

      .nav-info {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-2);
      }

      .week-range {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text);
      }

      .today-btn {
        padding: var(--space-1) var(--space-3);
        background: transparent;
        border: 1px solid var(--color-primary);
        color: var(--color-primary);
        border-radius: var(--radius-full);
        font-size: var(--font-size-xs);
        cursor: pointer;
        transition: all var(--transition-fast);
      }

      .today-btn:hover {
        background: var(--color-primary);
        color: var(--color-primary-text);
      }

      @media (max-width: 480px) {
        .calendar-nav {
          flex-direction: column;
          gap: var(--space-3);
        }

        .nav-btn {
          width: 100%;
        }
      }
    `,
  ],
})
export class CalendarNavigationComponent {
  @Input() weekLabel: string = "";
  @Input() canGoToToday: boolean = false;
  @Output() previous = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();
  @Output() today = new EventEmitter<void>();

  onPrevious() {
    this.previous.emit();
  }

  onNext() {
    this.next.emit();
  }

  onToday() {
    this.today.emit();
  }
}
