import { requireAuth } from "@/lib/api/auth";
import { handleApiError, jsonSuccess } from "@/lib/api/response";

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
