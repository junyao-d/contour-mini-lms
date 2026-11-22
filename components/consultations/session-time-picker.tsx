"use client";

import { useEffect, useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { Button } from "@/components/ui/button";
import { buildDaySlots, type BusySession } from "@/lib/domain/booking-slots";
import {
  MAX_BOOKING_HORIZON_DAYS,
  SESSION_DURATION_OPTIONS,
  type SessionDuration,
} from "@/lib/domain/consultation-constants";
import { formatSessionRange, formatTimeOfDay } from "@/lib/format";
import type { Consultation } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { consultationStartSchema } from "@/lib/validators/consultation";

export interface SessionTimeValue {
  start: string | null;
  duration: SessionDuration;
}

interface SessionTimePickerProps {
  value: SessionTimeValue;
  onChange: (value: SessionTimeValue) => void;
  /** Consultation being rescheduled; its own slot is not treated as busy. */
  excludeId?: string;
  errorId?: string;
  error?: string | null;
}

/** Client-side pre-check using the same Zod rules as the API. Returns an error message or null. */
export function validateSessionTime(value: SessionTimeValue): string | null {
  if (!value.start) return "Pick a time for your session.";
  const result = consultationStartSchema.safeParse(value.start);
  return result.success ? null : (result.error.issues[0]?.message ?? "Invalid time.");
}

const MAX_DURATION_MS =
  SESSION_DURATION_OPTIONS[SESSION_DURATION_OPTIONS.length - 1] * 60 * 1000;

const GROUPS = [
  { label: "Morning", test: (h: number) => h < 12 },
  { label: "Afternoon", test: (h: number) => h >= 12 && h < 17 },
  { label: "Evening", test: (h: number) => h >= 17 },
];

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function SessionTimePicker({
  value,
  onChange,
  excludeId,
  errorId,
  error,
}: SessionTimePickerProps) {
  const [day, setDay] = useState(() =>
    startOfDay(value.start ? new Date(value.start) : new Date()),
  );
  const [busy, setBusy] = useState<BusySession[]>([]);

  // Load the student's scheduled sessions around the selected day so clashing
  // times can be greyed out. The server's 409 remains the real guard.
  useEffect(() => {
    const controller = new AbortController();
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);
    const params = new URLSearchParams({
      status: "scheduled",
      sort: "scheduled_at_asc",
      pageSize: "50",
      // A session that starts before midnight can run into this day.
      from: new Date(day.getTime() - MAX_DURATION_MS).toISOString(),
      to: nextDay.toISOString(),
    });

    fetch(`/api/consultations?${params.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((json: { data: Consultation[] }) => {
        setBusy(json.data.filter((c) => c.id !== excludeId));
      })
      .catch(() => {
        // Aborted or offline: show every slot; the API still rejects clashes.
      });

    return () => controller.abort();
  }, [day, excludeId]);

  const slots = useMemo(
    () => buildDaySlots(day, value.duration, busy),
    [day, value.duration, busy],
  );

  const today = startOfDay(new Date());
  const lastDay = new Date(today);
  lastDay.setDate(lastDay.getDate() + MAX_BOOKING_HORIZON_DAYS);

  const selectDuration = (duration: SessionDuration) => {
    // Drop the chosen time if it no longer fits with the new length.
    const stillFits = buildDaySlots(day, duration, busy).some(
      (slot) => !slot.disabled && slot.start.toISOString() === value.start,
    );
    onChange({ duration, start: stillFits ? value.start : null });
  };

  return (
    <div
      role="group"
      aria-label="Session time"
      aria-describedby={error ? errorId : undefined}
      className="space-y-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Length</span>
        {SESSION_DURATION_OPTIONS.map((minutes) => (
          <Button
            key={minutes}
            type="button"
            size="sm"
            variant={value.duration === minutes ? "default" : "outline"}
            aria-pressed={value.duration === minutes}
            onClick={() => selectDuration(minutes)}
          >
            {minutes} min
          </Button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <DayPicker
          mode="single"
          required
          selected={day}
          onSelect={(next) => {
            setDay(startOfDay(next));
            onChange({ ...value, start: null });
          }}
          disabled={[{ before: today }, { after: lastDay }]}
          startMonth={today}
          endMonth={lastDay}
          weekStartsOn={1}
          className="session-calendar shrink-0"
        />

        <div className="max-h-72 flex-1 space-y-3 overflow-y-auto pr-1">
          {GROUPS.map((group) => {
            const groupSlots = slots.filter((slot) =>
              group.test(slot.start.getHours()),
            );
            if (groupSlots.length === 0) return null;
            return (
              <div key={group.label} className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  {group.label}
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {groupSlots.map((slot) => {
                    const iso = slot.start.toISOString();
                    const selected = value.start === iso;
                    return (
                      <Button
                        key={iso}
                        type="button"
                        size="sm"
                        variant={selected ? "default" : "outline"}
                        disabled={slot.disabled}
                        aria-pressed={selected}
                        className="px-1"
                        onClick={() => onChange({ ...value, start: iso })}
                      >
                        {formatTimeOfDay(slot.start)}
                      </Button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {slots.every((slot) => slot.disabled) && (
            <p className="text-sm text-muted-foreground">
              No times left on this day. Pick another date.
            </p>
          )}
        </div>
      </div>

      <p className={cn("text-sm", value.start ? "font-medium" : "text-muted-foreground")}>
        {value.start
          ? `${formatSessionRange(value.start, value.duration)} (${value.duration} min)`
          : "No time selected yet."}
      </p>
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
