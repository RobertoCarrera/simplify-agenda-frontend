import { Injectable } from "@angular/core";
import { BusyPeriod, ScheduleEntry, BlockedDate } from "./booking-public.service";
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
   * Derive the working window (start, end in minutes from midnight) for a day
   * from the BFF `schedule` array. Uses the UNION of windows when no professional
   * is selected (so any professional working that day is shown). When a
   * professional is selected, uses only that professional's window. Returns
   * null when no professional is scheduled that day (the day is fully closed).
   */
  private getWorkingWindow(
    day: WeekDay,
    schedule: ScheduleEntry[],
    professionalId?: string,
  ): { start: number; end: number; breakStart: number | null; breakEnd: number | null } | null {
    // JS getDay(): 0=Sun..6=Sat. ISO day_of_week: 1=Mon..7=Sun.
    const isoDow = day.date.getDay() === 0 ? 7 : day.date.getDay();

    const relevant = schedule.filter((s) => {
      if (s.day_of_week !== isoDow) return false;
      if (professionalId) return s.professional_id === professionalId;
      return true;
    });

    if (relevant.length === 0) return null;

    const toMins = (hms: string): number => {
      const [h, m] = hms.split(":").map((n) => parseInt(n, 10));
      return h * 60 + m;
    };

    let minStart = Number.POSITIVE_INFINITY;
    let maxEnd = 0;
    let breakStart: number | null = null;
    let breakEnd: number | null = null;
    for (const s of relevant) {
      const sStart = toMins(s.start_time);
      const sEnd = toMins(s.end_time);
      if (sStart < minStart) minStart = sStart;
      if (sEnd > maxEnd) maxEnd = sEnd;
      // Pick the first non-null break window; if multiple professionals have
      // breaks, we just take the earliest (good enough for visualization)
      if (s.break_start && s.break_end) {
        const bStart = toMins(s.break_start);
        const bEnd = toMins(s.break_end);
        if (breakStart === null || bStart < breakStart) {
          breakStart = bStart;
          breakEnd = bEnd;
        }
      }
    }
    if (maxEnd <= minStart) return null;
    return { start: minStart, end: maxEnd, breakStart, breakEnd };
  }

  /**
   * Check if a date string (YYYY-MM-DD) is within a blocked-date range.
   */
  private isDateBlocked(
    dateStr: string,
    blocks: BlockedDate[],
  ): BlockedDate | null {
    for (const b of blocks) {
      if (dateStr >= b.start_date && dateStr <= b.end_date) {
        return b;
      }
    }
    return null;
  }

  /**
   * Generate time slots for a given day.
   *
   * Step between consecutive slot start times equals the service duration,
   * so a 60-min service shows 9:00 → 10:00, 10:00 → 11:00, … and a 30-min
   * service shows 9:30 → 10:00, 10:00 → 10:30, …
   *
   * `schedule` and `blockedDates` come from the BFF /availability response
   * and replace the previous hardcoded WORKING_HOURS window.
   */
  generateTimeSlots(
    day: WeekDay,
    busyPeriods: BusyPeriod[],
    serviceDuration: number = 30,
    selectedSlotId?: string,
    schedule: ScheduleEntry[] = [],
    blockedDates: BlockedDate[] = [],
    professionalId?: string,
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const now = new Date();
    const isToday = day.date.toDateString() === now.toDateString();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Derive the working window from the schedule (replaces WORKING_HOURS).
    const window = this.getWorkingWindow(day, schedule, professionalId);
    if (!window) {
      return slots; // No professional works that day → no slots.
    }
    const startOfDay = window.start;
    const endOfDay = window.end;
    const breakStart = window.breakStart;
    const breakEnd = window.breakEnd;

    // Check if the day is fully blocked (all_day=true).
    // IMPORTANT: use LOCAL date components, not toISOString() which is UTC.
    // Otherwise a date in CEST (UTC+2) before 02:00 local would shift to
    // the previous day in UTC and the blocked-date filter would mismatch.
    const dayStr = this.toLocalDateString(day.date);
    const dayBlock = this.isDateBlocked(dayStr, blockedDates);
    if (dayBlock && dayBlock.all_day) {
      return slots; // Day is fully blocked.
    }

    // Step between starts = service duration. Each slot ends at start + serviceDuration.
    const step = serviceDuration > 0 ? serviceDuration : 30;

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

      // Block if slot falls within the professional's break window
      let isInBreak = false;
      if (breakStart !== null && breakEnd !== null) {
        const slotEndMins = mins + step;
        // A slot that overlaps the break is invalid
        if (mins < breakEnd && slotEndMins > breakStart) {
          isInBreak = true;
        }
      }

      // Block if slot is within a time-of-day block (all_day=false)
      let isInTimeBlock = false;
      if (dayBlock && !dayBlock.all_day && dayBlock.start_time && dayBlock.end_time) {
        const t = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}:00`;
        if (t >= dayBlock.start_time && t < dayBlock.end_time) {
          isInTimeBlock = true;
        }
      }

      // Check if slot is available (not in busy periods)
      const isAvailable = !isInBreak && !isInTimeBlock && !this.isSlotOccupied(
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
    schedule: ScheduleEntry[] = [],
    blockedDates: BlockedDate[] = [],
    professionalId?: string,
  ): TimeSlot | null {
    const slots = this.generateTimeSlots(
      day,
      busyPeriods,
      serviceDuration,
      undefined,
      schedule,
      blockedDates,
      professionalId,
    );
    return slots.find((s) => s.isAvailable && !s.isPast) || null;
  }

  /**
   * Generate slot ID from date and time
   */
  private generateSlotId(date: Date, hour: number, minute: number): string {
    return `${this.toLocalDateString(date)}-${hour.toString().padStart(2, "0")}-${minute.toString().padStart(2, "0")}`;
  }

  /**
   * Format a Date as YYYY-MM-DD using LOCAL time components.
   * Avoids the UTC-shift bug of toISOString().split("T")[0] in non-UTC zones.
   */
  private toLocalDateString(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, "0");
    const d = date.getDate().toString().padStart(2, "0");
    return `${y}-${m}-${d}`;
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
