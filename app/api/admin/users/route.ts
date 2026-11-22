import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api/auth";
import { buildPaginationMeta } from "@/lib/api/consultations-query";
import { handleApiError, jsonSuccess } from "@/lib/api/response";
import { listUsersQuerySchema } from "@/lib/validators/user";

export async function GET(request: NextRequest) {
  try {
    const { supabase } = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const { role, sort, page, pageSize } = listUsersQuerySchema.parse({
      role: searchParams.get("role") ?? undefined,
      sort: searchParams.get("sort") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
    });
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // security_invoker view: RLS still limits this to admins (profiles_select_own_or_admin).
    let query = supabase
      .from("profiles_with_consultation_count")
      .select("id, email, first_name, last_name, role, total_consultations", {
        count: "exact",
      });

    if (role !== "all") {
      query = query.eq("role", role);
    }

    if (sort !== "created_at_desc") {
      query = query.order("total_consultations", {
        ascending: sort === "consultations_asc",
      });
    }

    // Newest sign-ups first, then id, as the default order and as tiebreakers.
    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to);

    if (error) throw error;

    return jsonSuccess(data ?? [], 200, {
      pagination: buildPaginationMeta(page, pageSize, count ?? 0),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
