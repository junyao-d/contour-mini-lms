import {
  MAX_BOOKING_HORIZON_DAYS,
  PICKER_DAY_END_HOUR,
  PICKER_DAY_START_HOUR,
  SLOT_GRANULARITY_MINUTES,
} from "@/lib/domain/consultation-constants";

const MINUTE_MS = 60 * 1000;

export interface BusySession {
  scheduled_at: string;
  duration_minutes: number;
}

export interface DaySlot {
  start: Date;
  disabled: boolean;
}

/**
 * Start times shown for one local calendar day, every SLOT_GRANULARITY_MINUTES between
 * PICKER_DAY_START_HOUR and PICKER_DAY_END_HOUR. A slot is disabled when it has already
 * started, is beyond the booking horizon, would end after the picker window, or would
 * overlap one of the student's scheduled sessions. The DB constraint is still the
 * authority; this only avoids offering times that would be rejected.
 */
export function buildDaySlots(
  day: Date,
  durationMinutes: number,
  busy: BusySession[],
  now: Date = new Date(),
): DaySlot[] {
  const windowStart = new Date(day);
  windowStart.setHours(PICKER_DAY_START_HOUR, 0, 0, 0);
  const windowEnd = new Date(day);
  windowEnd.setHours(PICKER_DAY_END_HOUR, 0, 0, 0);

  const horizon = now.getTime() + MAX_BOOKING_HORIZON_DAYS * 24 * 60 * MINUTE_MS;
  const busyRanges = busy.map((b) => {
    const start = new Date(b.scheduled_at).getTime();
    return [start, start + b.duration_minutes * MINUTE_MS] as const;
  });

  const slots: DaySlot[] = [];
  for (
    let t = windowStart.getTime();
    t < windowEnd.getTime();
    t += SLOT_GRANULARITY_MINUTES * MINUTE_MS
  ) {
    const end = t + durationMinutes * MINUTE_MS;
    const disabled =
      t <= now.getTime() ||
      t > horizon ||
      end > windowEnd.getTime() ||
      busyRanges.some(([bStart, bEnd]) => t < bEnd && bStart < end);
    slots.push({ start: new Date(t), disabled });
  }
  return slots;
}
