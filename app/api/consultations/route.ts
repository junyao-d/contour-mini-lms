import { type NextRequest } from "next/server";
import { requireStudent } from "@/lib/api/auth";
import {
  buildPaginationMeta,
  fetchConsultationSummary,
  getSortConfig,
  parseListQuery,
  sanitizeSearchTerm,
} from "@/lib/api/consultations-query";
import { parseJsonBody } from "@/lib/api/request";
import { handleApiError, jsonSuccess } from "@/lib/api/response";
import { createConsultationSchema } from "@/lib/validators/consultation";

export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await requireStudent();
    const { status, search, sort, page, pageSize } = parseListQuery(request.url);
    const { column, ascending } = getSortConfig(sort);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("consultations")
      .select("*", { count: "exact" })
      .eq("user_id", user.id);

    if (status !== "all") {
      query = query.eq("status", status);
    }

    const safeSearch = sanitizeSearchTerm(search);
    if (safeSearch) {
      query = query.or(
        `first_name.ilike.%${safeSearch}%,last_name.ilike.%${safeSearch}%,reason.ilike.%${safeSearch}%`,
      );
    }

    const [{ data, count, error }, summary] = await Promise.all([
      query.order(column, { ascending }).range(from, to),
      fetchConsultationSummary(supabase, user.id),
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

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await requireStudent();
    const body = await parseJsonBody(request);
    const input = createConsultationSchema.parse(body);

    const { data, error } = await supabase
      .from("consultations")
      .insert({
        user_id: user.id,
        first_name: input.first_name,
        last_name: input.last_name,
        reason: input.reason,
        scheduled_at: input.scheduled_at,
        status: "scheduled",
      })
      .select("*")
      .single();

    if (error) throw error;

    return jsonSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
