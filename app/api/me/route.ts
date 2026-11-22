import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { parseJsonBody } from "@/lib/api/request";
import { ApiError, handleApiError, jsonSuccess } from "@/lib/api/response";
import { updateProfileSchema } from "@/lib/validators/profile";

const ME_COLUMNS = "id, email, first_name, last_name, role";

export async function GET() {
  try {
    const { profile } = await requireAuth();

    return jsonSuccess({
      id: profile.id,
      email: profile.email,
      first_name: profile.first_name,
      last_name: profile.last_name,
      role: profile.role,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { supabase, user } = await requireAuth();
    const body = await parseJsonBody(request);
    const input = updateProfileSchema.parse(body);

    // RLS (profiles_update_own) and column grants limit this to the caller's own names.
    const { data, error } = await supabase
      .from("profiles")
      .update({ first_name: input.first_name, last_name: input.last_name })
      .eq("id", user.id)
      .select(ME_COLUMNS)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      throw new ApiError(404, "NOT_FOUND", "Profile not found.");
    }

    return jsonSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
