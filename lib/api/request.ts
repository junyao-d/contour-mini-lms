import { type NextRequest } from "next/server";
import { ApiError } from "@/lib/api/response";

/**
 * Validates same-origin (when Origin header is present) and strict JSON Content-Type
 * for mutating Route Handlers, then parses the JSON body.
 */
export async function parseJsonBody(request: NextRequest): Promise<unknown> {
  const origin = request.headers.get("origin");
  if (origin) {
    const expectedHost =
      request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
      request.headers.get("host") ||
      request.nextUrl.host;

    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      throw new ApiError(403, "FORBIDDEN", "Invalid request origin.");
    }

    if (originHost !== expectedHost) {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Cross-origin requests are not allowed.",
      );
    }
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    throw new ApiError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Content-Type must be application/json.",
    );
  }

  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
}
