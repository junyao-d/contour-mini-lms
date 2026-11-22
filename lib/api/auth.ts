import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/database";
import { ApiError } from "@/lib/api/response";

export interface AuthContext {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User;
  profile: Profile;
}

export async function requireAuth(): Promise<AuthContext> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new ApiError(401, "UNAUTHORIZED", "Authentication required.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    throw new ApiError(401, "UNAUTHORIZED", "User profile not found.");
  }

  return { supabase, user, profile };
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
