import { describe, expect, it } from "vitest";
import {
  createConsultationSchema,
  listConsultationsQuerySchema,
  updateConsultationSchema,
  uuidParamSchema,
} from "@/lib/validators/consultation";

const SLOT_MS = 15 * 60 * 1000;
// Next 15-minute boundary at least 2 hours ahead
const futureIso = () =>
  new Date(
    Math.ceil((Date.now() + 2 * 60 * 60 * 1000) / SLOT_MS) * SLOT_MS,
  ).toISOString();
const pastIso = () => new Date(Date.now() - 60 * 60 * 1000).toISOString();

describe("consultation validators", () => {
  it("accepts a valid future consultation booking and trims whitespace", () => {
    const result = createConsultationSchema.parse({
      first_name: "  Alice ",
      last_name: " Chen ",
      reason: "  Review integration by parts ",
      scheduled_at: futureIso(),
    });

    expect(result.first_name).toBe("Alice");
    expect(result.last_name).toBe("Chen");
    expect(result.reason).toBe("Review integration by parts");
  });

  it("rejects past booking datetimes and blank fields", () => {
    expect(
      createConsultationSchema.safeParse({
        first_name: "Alice",
        last_name: "Chen",
        reason: "Homework help",
        scheduled_at: pastIso(),
      }).success,
    ).toBe(false);

    expect(
      createConsultationSchema.safeParse({
        first_name: "   ",
        last_name: "Chen",
        reason: "Homework help",
        scheduled_at: futureIso(),
      }).success,
    ).toBe(false);
  });

  it("rejects bookings beyond the 90-day horizon or off the 15-minute grid", () => {
    const base = {
      first_name: "Alice",
      last_name: "Chen",
      reason: "Homework help",
    };
    const aligned = new Date(futureIso());

    expect(
      createConsultationSchema.safeParse({
        ...base,
        scheduled_at: "2099-01-01T10:00:00.000Z",
      }).success,
    ).toBe(false);

    const offGrid = new Date(aligned.getTime() + 7 * 60 * 1000); // e.g. 03:07
    expect(
      createConsultationSchema.safeParse({
        ...base,
        scheduled_at: offGrid.toISOString(),
      }).success,
    ).toBe(false);

    const withSeconds = new Date(aligned.getTime() + 30 * 1000);
    expect(
      createConsultationSchema.safeParse({
        ...base,
        scheduled_at: withSeconds.toISOString(),
      }).success,
    ).toBe(false);

    expect(
      createConsultationSchema.safeParse({ ...base, scheduled_at: futureIso() })
        .success,
    ).toBe(true);
  });

  it("validates discriminated PATCH actions cleanly", () => {
    expect(
      updateConsultationSchema.safeParse({
        action: "reschedule",
        scheduled_at: futureIso(),
        reason: "Updated topic",
      }).success,
    ).toBe(true);

    expect(
      updateConsultationSchema.safeParse({
        action: "reschedule",
        scheduled_at: pastIso(),
      }).success,
    ).toBe(false);

    expect(
      updateConsultationSchema.safeParse({
        action: "toggle_complete",
        completed: true,
      }).success,
    ).toBe(true);

    expect(
      updateConsultationSchema.safeParse({ action: "cancel" }).success,
    ).toBe(true);

    expect(
      updateConsultationSchema.safeParse({ action: "unknown" }).success,
    ).toBe(false);
  });

  it("validates UUID route params", () => {
    expect(
      uuidParamSchema.safeParse("aaaaaaaa-aaaa-4aaa-8aaa-000000000001").success,
    ).toBe(true);
    expect(uuidParamSchema.safeParse("not-a-uuid").success).toBe(false);
  });

  it("applies default list query values and enforces pageSize bounds", () => {
    const defaults = listConsultationsQuerySchema.parse({});
    expect(defaults).toEqual({
      status: "all",
      search: "",
      sort: "scheduled_at_desc",
      page: 1,
      pageSize: 10,
    });

    expect(
      listConsultationsQuerySchema.safeParse({ pageSize: 100 }).success,
    ).toBe(false);
    expect(listConsultationsQuerySchema.safeParse({ page: 0 }).success).toBe(
      false,
    );
  });
});
