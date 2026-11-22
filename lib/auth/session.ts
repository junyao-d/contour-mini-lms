import { cache } from "react";
import { connection } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/database";

export interface CurrentSession {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User;
  profile: Profile;
}

/**
 * Loads the server-verified Supabase user and matching public.profiles row.
 * Returns null if unauthenticated or if the profile row is missing.
 */
export async function loadCurrentSession(): Promise<CurrentSession | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return null;
  }

  return { supabase, user, profile };
}

/**
 * Per-request deduplicated session loader for Server Components (layouts & pages).
 * Calls `connection()` first so Next.js 16 Cache Components never prerender through
 * `@supabase/auth-js` (which reads `Date.now()` internally).
 */
export const getCurrentSession = cache(async () => {
  await connection();
  return loadCurrentSession();
});
