import { describe, expect, it } from "vitest";
import { buildConsultationUpdate } from "@/lib/domain/consultation-transitions";

const NOW = new Date("2026-11-22T10:00:00.000Z");
const SLOT_A = "2026-11-25T10:00:00.000Z";
const SLOT_B = "2026-11-26T14:00:00.000Z";
const PAST_SLOT = "2026-11-21T10:00:00.000Z";

describe("buildConsultationUpdate state machine", () => {
  it("transitions scheduled -> completed with completed_at once started", () => {
    const result = buildConsultationUpdate(
      { status: "scheduled", scheduled_at: PAST_SLOT, duration_minutes: 60 },
      { action: "toggle_complete", completed: true },
      NOW,
    );

    expect(result).toEqual({
      ok: true,
      patch: { status: "completed", completed_at: NOW.toISOString() },
    });
  });

  it("rejects completing a consultation that has not started yet", () => {
    const result = buildConsultationUpdate(
      { status: "scheduled", scheduled_at: SLOT_A, duration_minutes: 60 },
      { action: "toggle_complete", completed: true },
      NOW,
    );

    expect(result.ok).toBe(false);
  });

  it("transitions completed -> scheduled (mark incomplete) clearing completed_at", () => {
    const result = buildConsultationUpdate(
      { status: "completed", scheduled_at: SLOT_A, duration_minutes: 60 },
      { action: "toggle_complete", completed: false },
      NOW,
    );

    expect(result).toEqual({
      ok: true,
      patch: { status: "scheduled", completed_at: null },
    });
  });

  it("transitions scheduled -> cancelled with cancelled_at", () => {
    const result = buildConsultationUpdate(
      { status: "scheduled", scheduled_at: SLOT_A, duration_minutes: 60 },
      { action: "cancel" },
      NOW,
    );

    expect(result).toEqual({
      ok: true,
      patch: { status: "cancelled", cancelled_at: NOW.toISOString() },
    });
  });

  it("rejects cancelling a completed consultation", () => {
    const result = buildConsultationUpdate(
      { status: "completed", scheduled_at: SLOT_A, duration_minutes: 60 },
      { action: "cancel" },
      NOW,
    );

    expect(result.ok).toBe(false);
  });

  it("rejects all modifications on a cancelled consultation", () => {
    expect(
      buildConsultationUpdate(
        { status: "cancelled", scheduled_at: SLOT_A, duration_minutes: 60 },
        { action: "toggle_complete", completed: false },
        NOW,
      ).ok,
    ).toBe(false);

    expect(
      buildConsultationUpdate(
        { status: "cancelled", scheduled_at: SLOT_A, duration_minutes: 60 },
        { action: "reschedule", scheduled_at: SLOT_B },
        NOW,
      ).ok,
    ).toBe(false);
  });

  it("stamps rescheduled_at only when scheduled_at actually changes", () => {
    const timeChanged = buildConsultationUpdate(
      { status: "scheduled", scheduled_at: SLOT_A, duration_minutes: 60 },
      { action: "reschedule", scheduled_at: SLOT_B, reason: "New reason" },
      NOW,
    );
    expect(timeChanged).toEqual({
      ok: true,
      patch: {
        scheduled_at: SLOT_B,
        rescheduled_at: NOW.toISOString(),
        reason: "New reason",
      },
    });

    const reasonOnly = buildConsultationUpdate(
      { status: "scheduled", scheduled_at: SLOT_A, duration_minutes: 60 },
      { action: "reschedule", scheduled_at: SLOT_A, reason: "Edited reason" },
      NOW,
    );
    expect(reasonOnly).toEqual({
      ok: true,
      patch: { reason: "Edited reason" },
    });
  });

  it("treats a length change as a reschedule", () => {
    const result = buildConsultationUpdate(
      { status: "scheduled", scheduled_at: SLOT_A, duration_minutes: 15 },
      { action: "reschedule", scheduled_at: SLOT_A, duration_minutes: 45 },
      NOW,
    );
    expect(result).toEqual({
      ok: true,
      patch: { duration_minutes: 45, rescheduled_at: NOW.toISOString() },
    });

    const unchanged = buildConsultationUpdate(
      { status: "scheduled", scheduled_at: SLOT_A, duration_minutes: 45 },
      { action: "reschedule", scheduled_at: SLOT_A, duration_minutes: 45 },
      NOW,
    );
    expect(unchanged).toEqual({ ok: true, patch: {} });
  });
});
