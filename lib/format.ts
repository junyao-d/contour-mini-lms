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
 * Date part of a session, e.g. "Fri, 1 Jan 2027" (for two-line layouts).
 */
export function formatSessionDate(startIso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(startIso));
}

/**
 * Time part of a session, e.g. "9:00 – 9:45 pm". A session that ends after midnight is
 * marked "(next day)" rather than letting Intl add an ambiguous numeric date.
 */
export function formatSessionTimes(
  startIso: string,
  durationMinutes: number,
): string {
  const start = new Date(startIso);
  const end = getSessionEnd(startIso, durationMinutes);
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  if (start.toDateString() === end.toDateString()) {
    return time.formatRange(start, end);
  }
  return `${time.format(start)} – ${time.format(end)} (next day)`;
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
