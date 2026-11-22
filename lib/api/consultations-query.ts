import type { SupabaseClient } from "@supabase/supabase-js";
import type {
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
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
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
  const { data, error } = await supabase.rpc(
    "get_consultation_summary",
    userId ? { p_user_id: userId } : {},
  );

  if (error) throw error;

  const row = data?.[0];
  return {
    total: Number(row?.total ?? 0),
    scheduled: Number(row?.scheduled ?? 0),
    completed: Number(row?.completed ?? 0),
    cancelled: Number(row?.cancelled ?? 0),
  };
}
