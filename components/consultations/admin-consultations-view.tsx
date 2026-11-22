"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/consultations/status-badge";
import { SummaryCards } from "@/components/consultations/summary-cards";
import { formatDateTime, readApiErrorMessage } from "@/lib/format";
import type {
  AdminConsultation,
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

export function AdminConsultationsView() {
  const [consultations, setConsultations] = useState<AdminConsultation[]>([]);
  const [summary, setSummary] = useState<ConsultationSummary>(EMPTY_SUMMARY);
  const [status, setStatus] = useState<ConsultationStatusFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<ConsultationSortOption>("scheduled_at_desc");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchAllConsultations = useCallback(async () => {
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

      const response = await fetch(
        `/api/admin/consultations?${params.toString()}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        setError(
          await readApiErrorMessage(
            response,
            "Failed to load system consultations.",
          ),
        );
        return;
      }

      const json = (await response.json()) as {
        data: AdminConsultation[];
        meta: ConsultationListMeta;
      };

      setConsultations(json.data);
      setSummary(json.meta.summary);
      setTotalPages(json.meta.pagination.totalPages);
      setTotalItems(json.meta.pagination.totalItems);
    } catch {
      setError("Network error while loading system consultations.");
    } finally {
      setIsLoading(false);
    }
  }, [status, searchQuery, sort, page]);

  useEffect(() => {
    void fetchAllConsultations();
  }, [fetchAllConsultations]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">
              Admin Console &mdash; All Consultations
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Read-only overview of consultations booked by all students across
            the system.
          </p>
        </div>
      </div>

      <SummaryCards summary={summary} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={status}
          onValueChange={(value) => {
            setStatus(value as ConsultationStatusFilter);
            setPage(1);
          }}
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search student, email, or reason..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-8"
            />
          </div>

          <Select
            value={sort}
            onValueChange={(value) => {
              setSort(value as ConsultationSortOption);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="scheduled_at_desc">
                Latest scheduled
              </SelectItem>
              <SelectItem value="scheduled_at_asc">
                Soonest scheduled
              </SelectItem>
              <SelectItem value="created_at_desc">Recently booked</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-16 animate-pulse rounded-lg border bg-muted/40"
            />
          ))}
        </div>
      ) : consultations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {searchQuery || status !== "all"
              ? "No consultations match your current filters."
              : "No consultations have been booked yet."}
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 font-medium">Scheduled For</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Booked On</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {consultations.map((item) => (
                <tr
                  key={item.id}
                  className="transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium">
                      {item.first_name} {item.last_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.student?.email ?? "Unknown account"}
                    </div>
                  </td>

                  <td className="max-w-xs px-4 py-3 align-top text-foreground/90">
                    <p className="line-clamp-3">{item.reason}</p>
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 align-top">
                    <div>{formatDateTime(item.scheduled_at)}</div>
                    {item.rescheduled_at && (
                      <div className="text-xs text-muted-foreground">
                        Rescheduled {formatDateTime(item.rescheduled_at)}
                      </div>
                    )}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 align-top">
                    <StatusBadge status={item.status} />
                    {item.completed_at && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatDateTime(item.completed_at)}
                      </div>
                    )}
                    {item.cancelled_at && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatDateTime(item.cancelled_at)}
                      </div>
                    )}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 align-top text-xs text-muted-foreground">
                    {formatDateTime(item.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages} ({totalItems} total)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
