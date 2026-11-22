import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  MAX_BOOKING_HORIZON_DAYS,
  MIN_CONSULTATION_GAP_MINUTES,
  SLOT_GRANULARITY_MINUTES,
} from "@/lib/domain/consultation-constants";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function jsonSuccess<T>(data: T, status = 200, meta?: unknown) {
  const body = meta !== undefined ? { data, meta } : { data };
  return NextResponse.json(body, { status });
}

function getPgErrorField(error: unknown, field: "code" | "hint"): string | null {
  if (typeof error === "object" && error !== null && field in error) {
    const value = (error as Record<string, unknown>)[field];
    return typeof value === "string" ? value : null;
  }
  return null;
}

type RuleError = { status: number; code: string; message: string };

const VALIDATION = (message: string): RuleError => ({
  status: 400,
  code: "VALIDATION_ERROR",
  message,
});
const TRANSITION = (message: string): RuleError => ({
  status: 409,
  code: "INVALID_STATUS_TRANSITION",
  message,
});

/**
 * Stable codes raised by DB triggers via `using hint = '<CODE>'`.
 * Statuses mirror the TS layer: datetime rules -> 400 (as Zod), status rules -> 409 (as the state machine).
 */
const DB_RULE_ERRORS: Record<string, RuleError> = {
  PAST_DATETIME: VALIDATION("Consultation datetime must be in the future."),
  OUTSIDE_HORIZON: VALIDATION(
    `Consultations can be booked at most ${MAX_BOOKING_HORIZON_DAYS} days ahead.`,
  ),
  NOT_ON_SLOT: VALIDATION(
    `Consultation time must start on a ${SLOT_GRANULARITY_MINUTES}-minute boundary (e.g. 10:00, 10:15).`,
  ),
  CANCELLED_IMMUTABLE: TRANSITION("Cancelled consultations cannot be modified."),
  COMPLETED_NOT_CANCELLABLE: TRANSITION(
    "Completed consultations cannot be cancelled. Mark it incomplete first.",
  ),
  COMPLETED_NOT_EDITABLE: TRANSITION(
    "Completed consultations cannot be rescheduled or edited.",
  ),
  MIXED_UPDATE: TRANSITION(
    "Change the status or the schedule in separate requests, not both at once.",
  ),
  NOT_STARTED: TRANSITION(
    "This consultation hasn't started yet, so it can't be marked complete.",
  ),
  IMMUTABLE_FIELD: {
    status: 403,
    code: "FORBIDDEN",
    message: "These consultation fields cannot be changed.",
  },
  ROLE_CHANGE_FORBIDDEN: {
    status: 403,
    code: "FORBIDDEN",
    message: "Changing user roles is not permitted.",
  },
};

function formatZodIssues(error: ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_root";
    if (!details[key]) details[key] = [];
    details[key].push(issue.message);
  }
  return details;
}

export function handleApiError(error: unknown) {
  unstable_rethrow(error);

  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: error.issues[0]?.message ?? "Invalid request input.",
          details: formatZodIssues(error),
        },
      },
      { status: 400 },
    );
  }

  const hint = getPgErrorField(error, "hint");
  if (hint && Object.hasOwn(DB_RULE_ERRORS, hint)) {
    const ruleError = DB_RULE_ERRORS[hint];
    return NextResponse.json(
      { error: { code: ruleError.code, message: ruleError.message } },
      { status: ruleError.status },
    );
  }

  const pgCode = getPgErrorField(error, "code");
  if (pgCode === "23P01") {
    return NextResponse.json(
      {
        error: {
          code: "TIME_SLOT_CONFLICT",
          message: `You already have a scheduled consultation within ${MIN_CONSULTATION_GAP_MINUTES} minutes of this time.`,
        },
      },
      { status: 409 },
    );
  }

  if (pgCode === "23505") {
    return NextResponse.json(
      {
        error: {
          code: "CONFLICT",
          message: "A conflicting record already exists.",
        },
      },
      { status: 409 },
    );
  }

  if (pgCode === "22023") {
    return NextResponse.json(
      {
        error: {
          code: "UNPROCESSABLE_ENTITY",
          message:
            "The requested consultation change violates a scheduling or status rule.",
        },
      },
      { status: 422 },
    );
  }

  if (pgCode === "42501") {
    return NextResponse.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission to perform this action.",
        },
      },
      { status: 403 },
    );
  }

  console.error("[API Error]", error);
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
      },
    },
    { status: 500 },
  );
}
