import type { Consultation, Database } from "@/lib/types/database";
import type { UpdateConsultationInput } from "@/lib/validators/consultation";

export type ConsultationPatch =
  Database["public"]["Tables"]["consultations"]["Update"];

export type TransitionResult =
  | { ok: true; patch: ConsultationPatch }
  | { ok: false; message: string };

/** A consultation can be marked complete only once its start time has passed. */
export function hasStarted(scheduledAt: string, now: Date = new Date()): boolean {
  return new Date(scheduledAt).getTime() <= now.getTime();
}

export function buildConsultationUpdate(
  current: Pick<Consultation, "status" | "scheduled_at" | "duration_minutes">,
  input: UpdateConsultationInput,
  now: Date = new Date(),
): TransitionResult {
  if (current.status === "cancelled") {
    return { ok: false, message: "Cancelled consultations cannot be modified." };
  }

  const nowIso = now.toISOString();

  switch (input.action) {
    case "cancel": {
      if (current.status === "completed") {
        return {
          ok: false,
          message: "Completed consultations cannot be cancelled.",
        };
      }
      return {
        ok: true,
        patch: { status: "cancelled", cancelled_at: nowIso },
      };
    }

    case "toggle_complete": {
      if (input.completed) {
        if (current.status === "completed") {
          return { ok: true, patch: {} };
        }
        if (!hasStarted(current.scheduled_at, now)) {
          return {
            ok: false,
            message:
              "This consultation hasn't started yet, so it can't be marked complete.",
          };
        }
        return {
          ok: true,
          patch: { status: "completed", completed_at: nowIso },
        };
      }

      if (current.status === "scheduled") {
        return { ok: true, patch: {} };
      }
      return {
        ok: true,
        patch: { status: "scheduled", completed_at: null },
      };
    }

    case "reschedule": {
      if (current.status !== "scheduled") {
        return {
          ok: false,
          message: "Only scheduled consultations can be rescheduled.",
        };
      }

      const patch: ConsultationPatch = {};
      const timeChanged =
        new Date(input.scheduled_at).getTime() !==
        new Date(current.scheduled_at).getTime();

      const durationChanged =
        input.duration_minutes !== undefined &&
        input.duration_minutes !== current.duration_minutes;

      if (timeChanged) {
        patch.scheduled_at = input.scheduled_at;
      }
      if (durationChanged) {
        patch.duration_minutes = input.duration_minutes;
      }
      if (timeChanged || durationChanged) {
        patch.rescheduled_at = nowIso;
      }

      if (input.reason !== undefined) {
        patch.reason = input.reason;
      }

      return { ok: true, patch };
    }
  }
}
