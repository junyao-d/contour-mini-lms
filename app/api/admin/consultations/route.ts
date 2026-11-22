import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api/auth";
import {
  buildPaginationMeta,
  fetchConsultationSummary,
  getSortConfig,
  parseListQuery,
  sanitizeSearchTerm,
} from "@/lib/api/consultations-query";
import { handleApiError, jsonSuccess } from "@/lib/api/response";
import type { AdminConsultation } from "@/lib/types/database";

export async function GET(request: NextRequest) {
  try {
    const { supabase } = await requireAdmin();
    const { status, search, sort, page, pageSize } = parseListQuery(request.url);
    const { column, ascending } = getSortConfig(sort);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("consultations_with_student")
      .select("*", { count: "exact" });

    if (status === "upcoming") {
      query = query
        .eq("status", "scheduled")
        .gt("scheduled_at", new Date().toISOString());
    } else if (status !== "all") {
      query = query.eq("status", status);
    }

    const safeSearch = sanitizeSearchTerm(search);
    if (safeSearch) {
      query = query.or(
        `first_name.ilike.%${safeSearch}%,last_name.ilike.%${safeSearch}%,reason.ilike.%${safeSearch}%,student_email.ilike.%${safeSearch}%`,
      );
    }

    const [{ data, count, error }, summary] = await Promise.all([
      // Tiebreak on id so equal timestamps paginate deterministically.
      query.order(column, { ascending }).order("id").range(from, to),
      fetchConsultationSummary(supabase),
    ]);

    if (error) throw error;

    const rows: AdminConsultation[] = (data ?? []).map(
      ({ student_email, student_first_name, student_last_name, ...rest }) => ({
        ...rest,
        student: {
          id: rest.user_id,
          email: student_email,
          first_name: student_first_name,
          last_name: student_last_name,
        },
      }),
    );

    return jsonSuccess(rows, 200, {
      pagination: buildPaginationMeta(page, pageSize, count ?? 0),
      summary,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
