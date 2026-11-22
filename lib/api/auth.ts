import { loadCurrentSession, type CurrentSession } from "@/lib/auth/session";
import { ApiError } from "@/lib/api/response";

export type AuthContext = CurrentSession;

export async function requireAuth(): Promise<AuthContext> {
  const session = await loadCurrentSession();

  if (!session) {
    throw new ApiError(401, "UNAUTHORIZED", "Authentication required.");
  }

  return session;
}

export async function requireStudent(): Promise<AuthContext> {
  const context = await requireAuth();

  if (context.profile.role !== "student") {
    throw new ApiError(403, "FORBIDDEN", "Student access is required.");
  }

  return context;
}

export async function requireAdmin(): Promise<AuthContext> {
  const context = await requireAuth();

  if (context.profile.role !== "admin") {
    throw new ApiError(403, "FORBIDDEN", "Admin access is required.");
  }

  return context;
}
