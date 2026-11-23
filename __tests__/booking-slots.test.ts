import { describe, expect, it } from "vitest";
import { buildDaySlots } from "@/lib/domain/booking-slots";
import {
  formatSessionDate,
  formatSessionRange,
  formatSessionTimes,
  getSessionEnd,
} from "@/lib/format";

// Local-time dates keep these tests independent of the machine's timezone.
const day = new Date(2026, 11, 1); // 1 Dec 2026
const at = (h: number, m = 0) => new Date(2026, 11, 1, h, m);
const enabledTimes = (slots: ReturnType<typeof buildDaySlots>) =>
  slots.filter((s) => !s.disabled).map((s) => `${s.start.getHours()}:${s.start.getMinutes()}`);

describe("buildDaySlots", () => {
  it("offers 15-minute starts from 8:00 until the session would pass 20:00", () => {
    const slots = buildDaySlots(day, 60, [], new Date(2026, 10, 30));
    expect(slots).toHaveLength(48);
    expect(enabledTimes(slots)[0]).toBe("8:0");
    expect(enabledTimes(slots).at(-1)).toBe("19:0"); // 19:00 + 60 min ends at 20:00
  });

  it("disables starts at or before now (now exactly on a slot boundary)", () => {
    const slots = buildDaySlots(day, 15, [], at(10, 0));
    expect(enabledTimes(slots)[0]).toBe("10:15");
  });

  it("disables starts before now when now is between slots", () => {
    const slots = buildDaySlots(day, 15, [], at(10, 7));
    expect(enabledTimes(slots)[0]).toBe("10:15");
  });

  it("disables starts that would overlap a booked session, but allows back-to-back", () => {
    const busy = [{ scheduled_at: at(10, 0).toISOString(), duration_minutes: 30 }];
    const slots = buildDaySlots(day, 30, busy, new Date(2026, 10, 30));
    const times = enabledTimes(slots);
    expect(times).toContain("9:30"); // ends exactly when the booking starts
    expect(times).not.toContain("9:45"); // would run into it
    expect(times).not.toContain("10:0");
    expect(times).not.toContain("10:15");
    expect(times).toContain("10:30"); // starts exactly when it ends
  });

  it("treats a session from the previous evening as busy only while it lasts", () => {
    const lateBooking = new Date(2026, 10, 30, 23, 30).toISOString();
    const slots = buildDaySlots(day, 15, [{ scheduled_at: lateBooking, duration_minutes: 60 }], new Date(2026, 10, 30));
    expect(enabledTimes(slots)[0]).toBe("8:0");
  });
});

describe("session range formatting", () => {
  it("computes the end from the session length", () => {
    expect(getSessionEnd("2026-12-01T10:00:00.000Z", 45).toISOString()).toBe(
      "2026-12-01T10:45:00.000Z",
    );
  });

  it("shows both dates when a session crosses midnight", () => {
    const start = new Date(2026, 11, 1, 23, 30).toISOString();
    const text = formatSessionRange(start, 60);
    expect(text).toMatch(/11:30/);
    expect(text).toMatch(/12:30/);
    expect(text).toMatch(/\b1\b/);
    expect(text).toMatch(/\b2\b/);
  });

  it("shows a single date for a same-day session", () => {
    const start = new Date(2026, 11, 1, 18, 45).toISOString();
    const text = formatSessionRange(start, 60);
    expect(text).toMatch(/6:45/);
    expect(text).toMatch(/7:45/);
    expect(text.match(/2026/g)).toHaveLength(1);
  });
});

describe("two-line session formatting (admin table)", () => {
  it("splits a same-day session into a date and a time range", () => {
    const start = new Date(2027, 0, 1, 21, 0).toISOString();
    expect(formatSessionDate(start)).toMatch(/2027/);
    const times = formatSessionTimes(start, 45);
    expect(times).toMatch(/9:00/);
    expect(times).toMatch(/9:45/);
    expect(times).not.toMatch(/2027/);
  });

  it("marks a session that ends after midnight instead of adding a numeric date", () => {
    const start = new Date(2026, 11, 1, 23, 30).toISOString();
    const times = formatSessionTimes(start, 60);
    expect(times).toMatch(/11:30/);
    expect(times).toMatch(/12:30/);
    expect(times).toMatch(/\(next day\)/);
    expect(times).not.toMatch(/\//);
  });
});
