const DUMMY_ORIGIN = "http://localhost";

/**
 * Ensures redirect paths stay strictly relative to this origin (prevents open redirects
 * such as //evil.com, /\evil.com, or external schemes).
 */
export function getSafeRedirectPath(
  rawPath: string | null,
  fallback = "/dashboard",
): string {
  if (!rawPath || !rawPath.startsWith("/") || rawPath.includes("\\")) {
    return fallback;
  }

  try {
    const parsed = new URL(rawPath, DUMMY_ORIGIN);
    if (parsed.origin !== DUMMY_ORIGIN) {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
