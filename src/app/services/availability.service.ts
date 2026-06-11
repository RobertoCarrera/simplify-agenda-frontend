import { Injectable, signal, computed } from "@angular/core";
import { BusyPeriod } from "./booking-public.service";
import { TimeSlot } from "../features/calendar/time-slot.component";

export interface WeekDay {
  date: Date;
  dayName: string;
  dayNumber: number;
  isToday: boolean;
  isPast: boolean;
}

export interface CalendarDay {
  day: WeekDay;
  slots: TimeSlot[];
}

@Injectable({ providedIn: "root" })
export class AvailabilityService {
  private readonly WORKING_HOURS = { start: 9, end: 19 };
  private readonly SLOT_DURATION_MINUTES = 30;

  /**
   * Generate week days for a given week start date
   */
  generateWeekDays(weekStart: Date): WeekDay[] {
    const days: WeekDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 5; i++) {
      // Monday to Friday (L-V)
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      date.setHours(0, 0, 0, 0);

      const dayName = this.getDayName(date.getDay());
      const isToday = date.getTime() === today.getTime();
      const isPast = date < today;

      days.push({
        date,
        dayName,
        dayNumber: date.getDate(),
        isToday,
        isPast,
      });
    }

    return days;
  }

  /**
   * Generate time slots for a given day.
   *
   * Step between consecutive slot start times equals the service duration,
   * so a 60-min service shows 9:00 → 10:00, 10:00 → 11:00, … and a 30-min
   * service shows 9:00 → 9:30, 9:30 → 10:00, …
   */
  generateTimeSlots(
    day: WeekDay,
    busyPeriods: BusyPeriod[],
    serviceDuration: number = 30,
    selectedSlotId?: string,
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const now = new Date();
    const isToday = day.date.toDateString() === now.toDateString();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Step between starts = service duration. Each slot ends at start + serviceDuration.
    const step = serviceDuration > 0 ? serviceDuration : 30;
    const startOfDay = this.WORKING_HOURS.start * 60; // minutes from midnight
    const endOfDay = this.WORKING_HOURS.end * 60;

    for (let mins = startOfDay; mins + step <= endOfDay; mins += step) {
      const hour = Math.floor(mins / 60);
      const minute = mins % 60;

      const slotDate = new Date(day.date);
      slotDate.setHours(hour, minute, 0, 0);

      const startTime = this.formatTime(hour, minute);
      const endTime = this.formatTime(hour, minute + step);

      // Check if slot is in the past (for today)
      let isPast = day.isPast;
      if (isToday) {
        const slotTime = hour * 60 + minute;
        const currentTime = currentHour * 60 + currentMinute;
        isPast = slotTime <= currentTime;
      }

      // Check if slot is available (not in busy periods)
      const isAvailable = !this.isSlotOccupied(
        slotDate,
        busyPeriods,
        step,
      );

      // Check if this is the selected slot
      const slotId = this.generateSlotId(day.date, hour, minute);
      const isSelected = slotId === selectedSlotId;

      slots.push({
        id: slotId,
        datetime: slotDate,
        startTime,
        endTime,
        isAvailable,
        isPast,
        isSelected,
      });
    }

    return slots;
  }

  /**
   * Check if a slot is occupied by any busy period
   */
  private isSlotOccupied(
    slotStart: Date,
    busyPeriods: BusyPeriod[],
    serviceDuration: number,
  ): boolean {
    const slotEnd = new Date(slotStart.getTime() + serviceDuration * 60 * 1000);

    for (const period of busyPeriods) {
      const periodStart = new Date(period.start);
      const periodEnd = new Date(period.end);

      // Check if slot overlaps with busy period
      if (slotStart < periodEnd && slotEnd > periodStart) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get the first available slot for a given day and busy periods
   */
  getFirstAvailableSlot(
    day: WeekDay,
    busyPeriods: BusyPeriod[],
    serviceDuration: number = 30,
  ): TimeSlot | null {
    const slots = this.generateTimeSlots(day, busyPeriods, serviceDuration);
    return slots.find((s) => s.isAvailable && !s.isPast) || null;
  }

  /**
   * Generate slot ID from date and time
   */
  private generateSlotId(date: Date, hour: number, minute: number): string {
    return `${date.toISOString().split("T")[0]}-${hour.toString().padStart(2, "0")}-${minute.toString().padStart(2, "0")}`;
  }

  /**
   * Format hour and minute to time string
   */
  private formatTime(hour: number, minute: number): string {
    // Normalize: if minute >= 60, roll into the hour. This avoids
    // formatting "09:60" when a slot's end time crosses the hour mark.
    const total = hour * 60 + minute;
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  }

  /**
   * Get day name from day number
   */
  private getDayName(day: number): string {
    const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    return days[day];
  }

  /**
   * Get week start date (Monday) for a given date
   */
  getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  /**
   * Navigate to previous week
   */
  getPreviousWeek(weekStart: Date): Date {
    const prev = new Date(weekStart);
    prev.setDate(prev.getDate() - 7);
    return prev;
  }

  /**
   * Navigate to next week
   */
  getNextWeek(weekStart: Date): Date {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + 7);
    return next;
  }

  /**
   * Format date for display
   */
  formatDate(date: Date): string {
    return date.toLocaleDateString("es-ES", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }
}
