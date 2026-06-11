import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  SimpleChanges,
  inject,
  signal,
  computed,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { TranslocoModule } from "@jsverse/transloco";
import {
  AvailabilityService,
  WeekDay,
  CalendarDay,
} from "../../services/availability.service";
import { TimeSlot } from "./time-slot.component";
import { BusyPeriod } from "../../services/booking-public.service";

@Component({
  selector: "app-weekly-calendar",
  standalone: true,
  imports: [CommonModule, TranslocoModule],
  template: `
    <div class="calendar-container">
      <!-- Navigation -->
      <div class="calendar-nav">
        <button
          class="nav-btn"
          (click)="previousWeek()"
          [attr.aria-label]="'calendar.previousWeek' | transloco"
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:1.25rem;height:1.25rem">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <span class="week-label">{{ weekLabel() }}</span>
        <button
          class="nav-btn"
          (click)="nextWeek()"
          [attr.aria-label]="'calendar.nextWeek' | transloco"
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:1.25rem;height:1.25rem">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </div>

      <!-- Day selector tabs -->
      <div class="day-tabs">
        @for (day of weekDays(); track day.date; let i = $index) {
          <button
            class="day-tab"
            [class.day-tab--active]="selectedDayIndex() === i"
            [class.day-tab--today]="day.isToday"
            [class.day-tab--no-slots]="getAvailableSlotsForDay(i).length === 0"
            (click)="selectDay(i)"
          >
            <span class="day-tab-name">{{ day.dayName }}</span>
            <span class="day-tab-number" [class.day-tab-number--today]="day.isToday">
              {{ day.dayNumber }}
            </span>
            <span class="day-tab-count">
              {{ getAvailableSlotsForDay(i).length }}
            </span>
          </button>
        }
      </div>

      <!-- Time slots for selected day -->
      <div class="slots-section">
        @if (getAvailableSlotsForDay(selectedDayIndex()).length === 0) {
          <div class="no-slots-message">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:2rem;height:2rem;opacity:0.3">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <p>{{ "calendar.noSlots" | transloco }}</p>
          </div>
        } @else {
          <div class="slots-grid">
            @for (slot of getAvailableSlotsForDay(selectedDayIndex()); track slot.id) {
              <button
                class="slot-btn"
                [class.slot-btn--selected]="selectedSlot()?.id === slot.id"
                (click)="onSlotSelect(slot)"
              >
                {{ slot.startTime }}
              </button>
            }
          </div>
        }
      </div>

      <!-- Selected Slot Display -->
      @if (selectedSlot()) {
        <div class="selected-slot">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:1.25rem;height:1.25rem">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
          <span class="slot-time">
            {{ selectedSlot()?.startTime }} - {{ selectedSlot()?.endTime }}
          </span>
          <span class="slot-date">{{ formatSelectedDate() }}</span>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .calendar-container {
        background: var(--color-surface);
        border-radius: var(--radius-lg);
        padding: var(--space-6);
        border: 1px solid var(--color-border);
      }

      /* Navigation */
      .calendar-nav {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--space-5);
        padding-bottom: var(--space-4);
        border-bottom: 1px solid var(--color-border);
      }

      .nav-btn {
        padding: var(--space-2);
        background: var(--color-surface-hover);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        cursor: pointer;
        color: var(--color-text-secondary);
        transition: all var(--transition-fast);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .nav-btn:hover {
        background: var(--color-primary);
        color: var(--color-primary-text);
        border-color: var(--color-primary);
      }

      .week-label {
        font-weight: var(--font-weight-bold);
        color: var(--color-text-primary);
        font-size: var(--font-size-lg);
        letter-spacing: 0.01em;
        text-align: center;
        flex: 1;
        padding: 0 var(--space-3);
      }

      /* Day tabs */
      .day-tabs {
        display: flex;
        gap: var(--space-2);
        margin-bottom: var(--space-5);
        overflow-x: auto;
        padding-bottom: var(--space-2);
      }

      .day-tab {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-1);
        padding: var(--space-3) var(--space-2);
        background: var(--color-surface);
        border: 2px solid var(--color-border);
        border-radius: var(--radius-lg);
        cursor: pointer;
        transition: all var(--transition-fast);
      }

      .day-tab:hover:not(.day-tab--no-slots) {
        border-color: var(--color-primary);
      }

      .day-tab--active {
        background: var(--color-primary);
        border-color: var(--color-primary);
      }

      .day-tab--active .day-tab-name,
      .day-tab--active .day-tab-number,
      .day-tab--active .day-tab-count {
        color: var(--color-primary-text);
      }

      .day-tab--today {
        border-color: var(--color-primary);
      }

      .day-tab--no-slots {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .day-tab-name {
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-secondary);
        text-transform: uppercase;
      }

      .day-tab-number {
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-bold);
        color: var(--color-text-primary);
        line-height: 1;
      }

      .day-tab-number--today {
        background: var(--color-primary);
        color: var(--color-primary-text);
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .day-tab-count {
        font-size: var(--font-size-xs);
        color: var(--color-text-disabled);
      }

      /* Slots section */
      .slots-section {
        min-height: 200px;
        margin-bottom: var(--space-5);
      }

      .slots-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
        gap: var(--space-3);
      }

      .slot-btn {
        padding: var(--space-4) var(--space-3);
        background: var(--color-surface);
        border: 2px solid var(--color-border);
        border-radius: var(--radius-lg);
        cursor: pointer;
        font-size: var(--font-size-base);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text);
        transition: all var(--transition-fast);
        text-align: center;
      }

      .slot-btn:hover {
        border-color: var(--color-primary);
        background: var(--color-primary-light);
        transform: translateY(-1px);
      }

      .slot-btn--selected {
        background: var(--color-primary);
        border-color: var(--color-primary);
        color: var(--color-primary-text);
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      }

      .no-slots-message {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--space-8);
        color: var(--color-text-disabled);
        gap: var(--space-3);
      }

      .no-slots-message p {
        margin: 0;
        font-size: var(--font-size-sm);
      }

      /* Selected slot display */
      .selected-slot {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-4);
        background: var(--color-primary-light);
        border-radius: var(--radius-md);
        border: 1px solid var(--color-primary);
      }

      .selected-slot svg {
        color: var(--color-primary);
        flex-shrink: 0;
      }

      .selected-slot .slot-time {
        font-weight: var(--font-weight-bold);
        color: var(--color-primary);
        font-size: var(--font-size-lg);
      }

      .selected-slot .slot-date {
        color: var(--color-text-secondary);
        font-size: var(--font-size-sm);
        margin-left: auto;
      }

      @media (max-width: 480px) {
        .day-tabs {
          gap: var(--space-1);
        }
        
        .day-tab {
          padding: var(--space-2) var(--space-1);
        }

        .slots-grid {
          grid-template-columns: repeat(3, 1fr);
        }
      }
    `,
  ],
})
export class WeeklyCalendarComponent implements OnInit, OnChanges {
  @Input() busyPeriods: BusyPeriod[] = [];
  @Input() serviceDuration: number = 30;
  @Input() initialDate?: Date;
  @Output() slotSelected = new EventEmitter<TimeSlot>();
  @Output() weekChanged = new EventEmitter<Date>();

  private availabilityService = inject(AvailabilityService);

  weekStart = signal<Date>(new Date());
  selectedSlot = signal<TimeSlot | null>(null);
  selectedDayIndex = signal(0);

  weekDays = signal<WeekDay[]>([]);
  calendarDays = signal<CalendarDay[]>([]);

  weekLabel = computed(() => {
    const start = this.weekStart();
    const end = new Date(start);
    end.setDate(start.getDate() + 4); // Friday

    // When the week spans two months or two years, show the second one
    // on the end date. Otherwise just the day.
    const sameMonth = start.getMonth() === end.getMonth();
    const sameYear = start.getFullYear() === end.getFullYear();

    const monthFmt: Intl.DateTimeFormatOptions = sameMonth
      ? { day: "numeric" }
      : { day: "numeric", month: "short" };

    const endFmt: Intl.DateTimeFormatOptions = sameYear
      ? monthFmt
      : { day: "numeric", month: "short", year: "numeric" };

    const startStr = start.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
    });
    const endStr = end.toLocaleDateString("es-ES", endFmt);
    const yearStr = end.getFullYear();

    // "Lun 15 – Vie 19 jun · 2026"
    const startDow = start.toLocaleDateString("es-ES", { weekday: "short" });
    const endDow = end.toLocaleDateString("es-ES", { weekday: "short" });
    return `${capitalize(startDow)} ${start.getDate()} – ${capitalize(endDow)} ${end.getDate()} ${end.toLocaleDateString("es-ES", { month: "short" })} · ${yearStr}`;
  });

  ngOnInit() {
    if (this.initialDate) {
      this.weekStart.set(
        this.availabilityService.getWeekStart(this.initialDate),
      );
    }
    this.generateCalendar();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['busyPeriods'] && !changes['busyPeriods'].firstChange) {
      this.generateCalendar();
    }
  }

  private generateCalendar() {
    const days = this.availabilityService.generateWeekDays(this.weekStart());
    this.weekDays.set(days);

    const calendarDays: CalendarDay[] = days.map((day) => ({
      day,
      slots: this.availabilityService.generateTimeSlots(
        day,
        this.busyPeriods,
        this.serviceDuration,
        this.selectedSlot()?.id,
      ),
    }));

    this.calendarDays.set(calendarDays);
    
    // Select first day with available slots
    const firstDayWithSlots = calendarDays.findIndex(
      (cd) => cd.slots.some((s) => s.isAvailable && !s.isPast)
    );
    if (firstDayWithSlots >= 0) {
      this.selectedDayIndex.set(firstDayWithSlots);
    }
  }

  getAvailableSlotsForDay(dayIndex: number): TimeSlot[] {
    const slots = this.calendarDays()[dayIndex]?.slots || [];
    return slots.filter((s) => s.isAvailable && !s.isPast);
  }

  selectDay(index: number) {
    const slots = this.getAvailableSlotsForDay(index);
    if (slots.length === 0) return;
    
    this.selectedDayIndex.set(index);
    this.selectedSlot.set(null);
  }

  onSlotSelect(slot: TimeSlot) {
    this.selectedSlot.set(slot);
    this.slotSelected.emit(slot);
  }

  previousWeek() {
    const prev = this.availabilityService.getPreviousWeek(this.weekStart());
    this.weekStart.set(prev);
    this.selectedSlot.set(null);
    this.selectedDayIndex.set(0);
    this.generateCalendar();
    this.weekChanged.emit(prev);
  }

  nextWeek() {
    const next = this.availabilityService.getNextWeek(this.weekStart());
    this.weekStart.set(next);
    this.selectedSlot.set(null);
    this.selectedDayIndex.set(0);
    this.generateCalendar();
    this.weekChanged.emit(next);
  }

  formatSelectedDate(): string {
    const slot = this.selectedSlot();
    if (!slot) return "";
    return slot.datetime.toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }
}

/** Capitalize first letter (Spanish day names come lowercase from toLocaleDateString) */
function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
