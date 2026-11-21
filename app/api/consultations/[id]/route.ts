import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { ApiError, handleApiError, jsonSuccess } from "@/lib/api/response";
import { buildConsultationUpdate } from "@/lib/domain/consultation-transitions";
import {
  updateConsultationSchema,
  uuidParamSchema,
} from "@/lib/validators/consultation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { supabase } = await requireAuth();
    const { id } = await context.params;
    const consultationId = uuidParamSchema.parse(id);

    // RLS allows owner or admin; returns null when missing or unauthorized.
    const { data, error } = await supabase
      .from("consultations")
      .select("*")
      .eq("id", consultationId)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      throw new ApiError(404, "NOT_FOUND", "Consultation not found.");
    }

    return jsonSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { supabase, user } = await requireAuth();
    const { id } = await context.params;
    const consultationId = uuidParamSchema.parse(id);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }

    const input = updateConsultationSchema.parse(body);

    // Explicitly scope to caller's own row (defense-in-depth alongside RLS).
    const { data: existing, error: fetchError } = await supabase
      .from("consultations")
      .select("*")
      .eq("id", consultationId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existing) {
      throw new ApiError(404, "NOT_FOUND", "Consultation not found.");
    }

    const transition = buildConsultationUpdate(existing, input);
    if (!transition.ok) {
      throw new ApiError(409, "INVALID_STATUS_TRANSITION", transition.message);
    }

    // No-op update (e.g., already in requested status) — return existing row.
    if (Object.keys(transition.patch).length === 0) {
      return jsonSuccess(existing);
    }

    const { data: updated, error: updateError } = await supabase
      .from("consultations")
      .update(transition.patch)
      .eq("id", consultationId)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (updateError) throw updateError;

    return jsonSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
