/**
 * Formats an ISO timestamp in the user's local timezone.
 * `withWeekday` adds the short weekday, e.g. "Sun, 22 Nov 2026, 6:45 pm".
 */
export function formatDateTime(
  isoString: string,
  { withWeekday = false }: { withWeekday?: boolean } = {},
): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;

  // dateStyle cannot be combined with weekday, so spell the parts out instead.
  const options: Intl.DateTimeFormatOptions = withWeekday
    ? {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }
    : { dateStyle: "medium", timeStyle: "short" };

  return new Intl.DateTimeFormat(undefined, options).format(date);
}

/**
 * End of a session that starts at `startIso` and lasts `durationMinutes`.
 */
export function getSessionEnd(startIso: string, durationMinutes: number): Date {
  return new Date(new Date(startIso).getTime() + durationMinutes * 60 * 1000);
}

/**
 * Formats a session as a time range in the viewer's timezone, e.g.
 * "Sun, 22 Nov 2026, 6:45 – 7:45 pm". Ranges crossing midnight show both dates.
 */
export function formatSessionRange(
  startIso: string,
  durationMinutes: number,
): string {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return startIso;

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).formatRange(start, getSessionEnd(startIso, durationMinutes));
}

/**
 * Formats just the time of day, e.g. "6:45 pm".
 */
export function formatTimeOfDay(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
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
