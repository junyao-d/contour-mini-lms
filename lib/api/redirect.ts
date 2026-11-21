/**
 * Ensures redirect paths stay strictly relative to this origin (prevents open redirects).
 */
export function getSafeRedirectPath(
  rawPath: string | null,
  fallback = "/dashboard",
): string {
  if (!rawPath || !rawPath.startsWith("/") || rawPath.startsWith("//")) {
    return fallback;
  }
  return rawPath;
}
