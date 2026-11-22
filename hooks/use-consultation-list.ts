"use client";

import { useCallback, useEffect, useState } from "react";
import { readApiErrorMessage } from "@/lib/format";
import type {
  ConsultationListMeta,
  ConsultationSummary,
} from "@/lib/types/database";
import type {
  ConsultationSortOption,
  ConsultationStatusFilter,
} from "@/lib/validators/consultation";

const EMPTY_SUMMARY: ConsultationSummary = {
  total: 0,
  scheduled: 0,
  completed: 0,
  cancelled: 0,
};

export function useConsultationList<T>(
  endpoint: string,
  fallbackError = "Failed to load consultations.",
) {
  const [items, setItems] = useState<T[]>([]);
  const [summary, setSummary] = useState<ConsultationSummary>(EMPTY_SUMMARY);
  const [status, setStatusState] = useState<ConsultationStatusFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSortState] =
    useState<ConsultationSortOption>("scheduled_at_desc");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  // Debounce search input before issuing a new request
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          status,
          sort,
          page: String(page),
          pageSize: "10",
        });
        if (searchQuery) {
          params.set("search", searchQuery);
        }

        const response = await fetch(`${endpoint}?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          if (!controller.signal.aborted) {
            setError(await readApiErrorMessage(response, fallbackError));
          }
          return;
        }

        const json = (await response.json()) as {
          data: T[];
          meta: ConsultationListMeta;
        };

        if (!controller.signal.aborted) {
          setItems(json.data);
          setSummary(json.meta.summary);
          setTotalPages(json.meta.pagination.totalPages);
          setTotalItems(json.meta.pagination.totalItems);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        if (!controller.signal.aborted) {
          setError("Network error while loading consultations.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => controller.abort();
  }, [endpoint, fallbackError, status, searchQuery, sort, page, reloadTick]);

  const setStatus = useCallback((next: ConsultationStatusFilter) => {
    setStatusState(next);
    setPage(1);
  }, []);

  const setSort = useCallback((next: ConsultationSortOption) => {
    setSortState(next);
    setPage(1);
  }, []);

  const refresh = useCallback((resetPage = false) => {
    if (resetPage) setPage(1);
    setReloadTick((t) => t + 1);
  }, []);

  return {
    items,
    summary,
    status,
    setStatus,
    searchInput,
    setSearchInput,
    searchQuery,
    sort,
    setSort,
    page,
    setPage,
    totalPages,
    totalItems,
    isLoading,
    error,
    setError,
    refresh,
  };
}
