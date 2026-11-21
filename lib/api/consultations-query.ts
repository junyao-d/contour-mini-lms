import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ConsultationStatus,
  ConsultationSummary,
  Database,
  PaginationMeta,
} from "@/lib/types/database";
import {
  listConsultationsQuerySchema,
  type ConsultationSortOption,
  type ListConsultationsQuery,
} from "@/lib/validators/consultation";

export function parseListQuery(requestUrl: string): ListConsultationsQuery {
  const { searchParams } = new URL(requestUrl);
  return listConsultationsQuerySchema.parse({
    status: searchParams.get("status") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
  });
}

export function getSortConfig(sort: ConsultationSortOption): {
  column: "scheduled_at" | "created_at";
  ascending: boolean;
} {
  switch (sort) {
    case "scheduled_at_asc":
      return { column: "scheduled_at", ascending: true };
    case "created_at_desc":
      return { column: "created_at", ascending: false };
    case "scheduled_at_desc":
    default:
      return { column: "scheduled_at", ascending: false };
  }
}

/**
 * Strips characters that could alter a PostgREST `.or()` filter expression.
 */
export function sanitizeSearchTerm(raw: string): string {
  return raw.replace(/[,()\\*%_]/g, " ").trim();
}

export function buildPaginationMeta(
  page: number,
  pageSize: number,
  totalItems: number,
): PaginationMeta {
  return {
    page,
    pageSize,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
  };
}

export async function fetchConsultationSummary(
  supabase: SupabaseClient<Database>,
  userId?: string,
): Promise<ConsultationSummary> {
  const statuses: ConsultationStatus[] = ["scheduled", "completed", "cancelled"];

  const counts = await Promise.all(
    statuses.map(async (status) => {
      let query = supabase
        .from("consultations")
        .select("id", { count: "exact", head: true })
        .eq("status", status);

      if (userId) {
        query = query.eq("user_id", userId);
      }

      const { count, error } = await query;
      if (error) throw error;
      return count ?? 0;
    }),
  );

  const [scheduled, completed, cancelled] = counts;
  return {
    total: scheduled + completed + cancelled,
    scheduled,
    completed,
    cancelled,
  };
}
