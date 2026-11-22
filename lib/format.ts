/**
 * Formats an ISO timestamp in the user's local timezone.
 */
export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/**
 * Converts an ISO timestamp (or Date) into the `YYYY-MM-DDTHH:mm` string expected
 * by `<input type="datetime-local">`.
 */
export function toDateTimeLocalValue(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Suggests a default upcoming booking time (next clean hour, at least 1 hour from now).
 */
export function getDefaultBookingDateTime(): string {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + 1);
  return toDateTimeLocalValue(date);
}

/**
 * Extracts a human-readable message from our standardized API error response.
 */
export async function readApiErrorMessage(
  response: Response,
  fallback = "Something went wrong. Please try again.",
): Promise<string> {
  try {
    const json = (await response.json()) as {
      error?: { message?: string };
    };
    return json.error?.message || fallback;
  } catch {
    return fallback;
  }
}
