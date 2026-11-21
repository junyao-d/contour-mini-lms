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

export async function GET(request: NextRequest) {
  try {
    const { supabase } = await requireAdmin();
    const { status, search, sort, page, pageSize } = parseListQuery(request.url);
    const { column, ascending } = getSortConfig(sort);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("consultations")
      .select(
        "*, student:profiles!consultations_user_id_fkey(id, email, first_name, last_name)",
        { count: "exact" },
      );

    if (status !== "all") {
      query = query.eq("status", status);
    }

    const safeSearch = sanitizeSearchTerm(search);
    if (safeSearch) {
      // Also match consultations whose student account email matches the search term.
      const { data: matchingProfiles, error: profileSearchError } =
        await supabase
          .from("profiles")
          .select("id")
          .ilike("email", `%${safeSearch}%`)
          .limit(100);

      if (profileSearchError) throw profileSearchError;

      const filters = [
        `first_name.ilike.%${safeSearch}%`,
        `last_name.ilike.%${safeSearch}%`,
        `reason.ilike.%${safeSearch}%`,
      ];

      const matchingUserIds = (matchingProfiles ?? []).map((p) => p.id);
      if (matchingUserIds.length > 0) {
        filters.push(`user_id.in.(${matchingUserIds.join(",")})`);
      }

      query = query.or(filters.join(","));
    }

    const [{ data, count, error }, summary] = await Promise.all([
      query.order(column, { ascending }).range(from, to),
      fetchConsultationSummary(supabase),
    ]);

    if (error) throw error;

    return jsonSuccess(data ?? [], 200, {
      pagination: buildPaginationMeta(page, pageSize, count ?? 0),
      summary,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
