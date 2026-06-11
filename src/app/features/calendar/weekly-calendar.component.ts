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
      <!-- Header -->
      <div class="calendar-header">
        <div class="calendar-header-text">
          <h3 class="calendar-title">Selecciona día y hora</h3>
          <p class="calendar-subtitle">Toca un día para ver los huecos disponibles</p>
        </div>
        <div class="calendar-nav">
          <button
            class="nav-btn"
            type="button"
            (click)="previousWeek()"
            [disabled]="!canGoPrevious()"
            [attr.aria-label]="'calendar.previousWeek' | transloco"
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <span class="week-label">{{ weekLabel() }}</span>
          <button
            class="nav-btn"
            type="button"
            (click)="nextWeek()"
            [attr.aria-label]="'calendar.nextWeek' | transloco"
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Day selector tabs -->
      <div class="day-tabs">
        @for (day of weekDays(); track day.date; let i = $index) {
          <button
            class="day-tab"
            type="button"
            [class.day-tab--active]="selectedDayIndex() === i"
            [class.day-tab--today]="day.isToday"
            [class.day-tab--no-slots]="getAvailableSlotsForDay(i).length === 0"
            (click)="selectDay(i)"
          >
            <span class="day-tab-name">{{ day.dayName }}</span>
            <span class="day-tab-number" [class.day-tab-number--today]="day.isToday">
              {{ day.dayNumber }}
            </span>
            <span class="day-tab-count" [class.day-tab-count--empty]="getAvailableSlotsForDay(i).length === 0">
              @if (getAvailableSlotsForDay(i).length === 0) {
                Sin hueco
              } @else {
                {{ getAvailableSlotsForDay(i).length }} huecos
              }
            </span>
          </button>
        }
      </div>

      <!-- Time slots for selected day -->
      <div class="slots-section">
        @if (loading) {
          <div class="loading-slots">
            <div class="loading-spinner"></div>
            <p>Cargando disponibilidad...</p>
          </div>
        } @else if (getAvailableSlotsForDay(selectedDayIndex()).length === 0) {
          <div class="no-slots-message">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:3rem;height:3rem;opacity:0.25">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <p class="no-slots-title">No hay huecos este día</p>
            <p class="no-slots-hint">Prueba con otro día o revisa la semana siguiente →</p>
          </div>
        } @else {
          <div class="slots-list">
            @for (slot of getAvailableSlotsForDay(selectedDayIndex()); track slot.id) {
              <button
                class="slot-btn"
                type="button"
                [class.slot-btn--selected]="selectedSlot()?.id === slot.id"
                (click)="onSlotSelect(slot)"
              >
                <span class="slot-time-text">{{ slot.startTime }}</span>
                <span class="slot-time-end">– {{ slot.endTime }}</span>
              </button>
            }
          </div>
        }
      </div>

      <!-- Selected Slot Display -->
      @if (selectedSlot()) {
        <div class="selected-slot">
          <div class="selected-slot-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <div class="selected-slot-info">
            <span class="selected-slot-time">{{ selectedSlot()?.startTime }} – {{ selectedSlot()?.endTime }}</span>
            <span class="selected-slot-date">{{ formatSelectedDate() }}</span>
          </div>
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

      /* ── Header ──────────────────────────────────────── */
      .calendar-header {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        margin-bottom: var(--space-5);
        padding-bottom: var(--space-5);
        border-bottom: 1px solid var(--color-border);
      }
      .calendar-header-text { text-align: center; }
      .calendar-title {
        margin: 0 0 0.25rem;
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-bold);
        color: var(--color-text-primary);
      }
      .calendar-subtitle {
        margin: 0;
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
      }

      /* ── Week navigation ─────────────────────────────── */
      .calendar-nav {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--space-3);
      }

      .nav-btn {
        flex-shrink: 0;
        width: 2.5rem;
        height: 2.5rem;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        cursor: pointer;
        color: var(--color-text);
        transition: all var(--transition-fast);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .nav-btn svg { width: 1.25rem; height: 1.25rem; }
      .nav-btn:hover:not(:disabled) {
        background: var(--color-primary);
        color: var(--color-primary-text);
        border-color: var(--color-primary);
        transform: translateY(-1px);
      }
      .nav-btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
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

      /* ── Day tabs ────────────────────────────────────── */
      .day-tabs {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: var(--space-2);
        margin-bottom: var(--space-5);
      }
      .day-tab {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.25rem;
        padding: var(--space-3) var(--space-2);
        background: var(--color-surface);
        border: 2px solid var(--color-border);
        border-radius: var(--radius-lg);
        cursor: pointer;
        transition: all var(--transition-fast);
        min-height: 5.5rem;
      }
      .day-tab:hover:not(.day-tab--no-slots):not(.day-tab--active) {
        border-color: var(--color-primary);
        background: var(--color-primary-light);
      }
      .day-tab--active {
        background: var(--color-primary);
        border-color: var(--color-primary);
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      }
      .day-tab--active .day-tab-name,
      .day-tab--active .day-tab-number,
      .day-tab--active .day-tab-count { color: var(--color-primary-text); }
      .day-tab--today:not(.day-tab--active) {
        border-color: var(--color-primary);
      }
      .day-tab--no-slots {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .day-tab-name {
        font-size: 0.7rem;
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .day-tab-number {
        font-size: 1.5rem;
        font-weight: var(--font-weight-bold);
        color: var(--color-text-primary);
        line-height: 1;
      }
      .day-tab-number--today {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--color-primary);
        color: var(--color-primary-text);
        width: 1.75rem;
        height: 1.75rem;
        border-radius: 50%;
        font-size: 1rem;
      }
      .day-tab--active .day-tab-number--today {
        background: var(--color-primary-text);
        color: var(--color-primary);
      }
      .day-tab-count {
        font-size: 0.7rem;
        font-weight: var(--font-weight-medium);
        color: var(--color-text-disabled);
        white-space: nowrap;
      }
      .day-tab-count--empty { font-style: italic; }

      /* ── Slots list ──────────────────────────────────── */
      .slots-section { min-height: 200px; margin-bottom: var(--space-5); }

      .slots-list {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: var(--space-3);
      }

      .slot-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.25rem;
        padding: 1rem 0.75rem;
        background: var(--color-surface);
        border: 2px solid var(--color-border);
        border-radius: var(--radius-lg);
        cursor: pointer;
        transition: all var(--transition-fast);
        text-align: center;
        min-height: 4rem;
      }
      .slot-btn:hover:not(.slot-btn--selected) {
        border-color: var(--color-primary);
        background: var(--color-primary-light);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      }
      .slot-btn--selected {
        background: var(--color-primary);
        border-color: var(--color-primary);
        box-shadow: 0 4px 16px rgba(0,0,0,0.2);
        transform: scale(1.02);
      }
      .slot-time-text {
        font-size: 1.125rem;
        font-weight: var(--font-weight-bold);
        color: var(--color-text);
        line-height: 1;
        font-variant-numeric: tabular-nums;
      }
      .slot-time-end {
        font-size: 0.75rem;
        color: var(--color-text-secondary);
        font-variant-numeric: tabular-nums;
      }
      .slot-btn--selected .slot-time-text { color: var(--color-primary-text); }
      .slot-btn--selected .slot-time-end { color: var(--color-primary-text); opacity: 0.8; }

      /* ── Empty / loading ─────────────────────────────── */
      .no-slots-message,
      .loading-slots {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--space-10) var(--space-4);
        color: var(--color-text-disabled);
        gap: var(--space-3);
        text-align: center;
      }
      .no-slots-title {
        margin: 0;
        font-size: var(--font-size-base);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-secondary);
      }
      .no-slots-hint {
        margin: 0;
        font-size: var(--font-size-sm);
        color: var(--color-text-disabled);
      }
      .loading-spinner {
        width: 2rem;
        height: 2rem;
        border: 3px solid var(--color-border);
        border-top-color: var(--color-primary);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }

      /* ── Selected slot display ───────────────────────── */
      .selected-slot {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-4) var(--space-5);
        background: var(--color-primary-light);
        border-radius: var(--radius-md);
        border: 1.5px solid var(--color-primary);
      }
      .selected-slot-icon {
        width: 2.25rem;
        height: 2.25rem;
        background: var(--color-primary);
        color: var(--color-primary-text);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .selected-slot-icon svg { width: 1.25rem; height: 1.25rem; }
      .selected-slot-info {
        display: flex;
        flex-direction: column;
        gap: 0.125rem;
        min-width: 0;
      }
      .selected-slot-time {
        font-weight: var(--font-weight-bold);
        color: var(--color-text);
        font-size: var(--font-size-lg);
        font-variant-numeric: tabular-nums;
      }
      .selected-slot-date {
        color: var(--color-text-secondary);
        font-size: var(--font-size-sm);
      }

      /* ── Mobile ──────────────────────────────────────── */
      @media (max-width: 640px) {
        .calendar-container { padding: var(--space-4); }
        .day-tabs {
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 0.4rem;
        }
        .day-tab {
          padding: var(--space-2) 0.25rem;
          min-height: 4.5rem;
        }
        .day-tab-number { font-size: 1.1rem; }
        .day-tab-count { font-size: 0.6rem; }
        .slots-list {
          grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          gap: 0.6rem;
        }
        .slot-btn { padding: 0.75rem 0.5rem; min-height: 3.5rem; }
        .slot-time-text { font-size: 1rem; }
      }
    `,
  ],
})
export class WeeklyCalendarComponent implements OnInit, OnChanges {
  @Input() busyPeriods: BusyPeriod[] = [];
  @Input() serviceDuration: number = 30;
  @Input() initialDate?: Date;
  @Input() loading = false;
  @Output() slotSelected = new EventEmitter<TimeSlot>();
  @Output() weekChanged = new EventEmitter<Date>();

  private availabilityService = inject(AvailabilityService);

  weekStart = signal<Date>(new Date());
  selectedSlot = signal<TimeSlot | null>(null);
  selectedDayIndex = signal(0);

  weekDays = signal<WeekDay[]>([]);
  calendarDays = signal<CalendarDay[]>([]);

  /** True when current week is the user's current week — disables "previous" nav. */
  canGoPrevious = computed(() => {
    const currentWeekStart = this.availabilityService.getWeekStart(new Date());
    return this.weekStart().getTime() > currentWeekStart.getTime();
  });

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
