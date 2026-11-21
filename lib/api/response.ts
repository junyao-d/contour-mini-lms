import { NextResponse } from "next/server";
import { ZodError } from "zod";

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

function getPgErrorCode(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : null;
  }
  return null;
}

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

  const pgCode = getPgErrorCode(error);
  if (pgCode === "23P01") {
    return NextResponse.json(
      {
        error: {
          code: "TIME_SLOT_CONFLICT",
          message:
            "You already have a scheduled consultation within 30 minutes of this time.",
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
