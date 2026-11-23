"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  UserRound,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookConsultationDialog } from "@/components/consultations/book-consultation-dialog";
import { CancelConsultationDialog } from "@/components/consultations/cancel-consultation-dialog";
import { RescheduleConsultationDialog } from "@/components/consultations/reschedule-consultation-dialog";
import { StatusBadge } from "@/components/consultations/status-badge";
import { SummaryCards } from "@/components/consultations/summary-cards";
import { ProfileDialog } from "@/components/profile/profile-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useConsultationList } from "@/hooks/use-consultation-list";
import { hasStarted } from "@/lib/domain/consultation-transitions";
import {
  formatDateTime,
  formatSessionRange,
  readApiErrorMessage,
} from "@/lib/format";
import type { Consultation } from "@/lib/types/database";
import type {
  ConsultationSortOption,
  ConsultationStatusFilter,
} from "@/lib/validators/consultation";

interface StudentDashboardProps {
  profileEmail: string;
  profileFirstName: string | null;
  profileLastName: string | null;
}

export function StudentDashboard({
  profileEmail,
  profileFirstName,
  profileLastName,
}: StudentDashboardProps) {
  const {
    items: consultations,
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
  } = useConsultationList<Consultation>("/api/consultations");

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const router = useRouter();
  const [bookOpen, setBookOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<Consultation | null>(
    null,
  );
  const [cancelTarget, setCancelTarget] = useState<Consultation | null>(null);

  const handleToggleComplete = async (
    consultation: Consultation,
    completed: boolean,
  ) => {
    setTogglingId(consultation.id);
    setError(null);
    try {
      const response = await fetch(`/api/consultations/${consultation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_complete",
          completed,
        }),
      });

      if (!response.ok) {
        setError(
          await readApiErrorMessage(
            response,
            "Failed to update consultation status.",
          ),
        );
        return;
      }

      refresh();
    } catch {
      setError("Network error while updating consultation status.");
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            My Consultations
          </h1>
          <p className="text-sm text-muted-foreground">
            Book, reschedule, or cancel consultations.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setProfileOpen(true)}>
            <UserRound className="mr-1.5 h-4 w-4" />
            My Profile
          </Button>
          <Button onClick={() => setBookOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Book Consultation
          </Button>
        </div>
      </div>

      <SummaryCards summary={summary} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={status}
          onValueChange={(value) => setStatus(value as ConsultationStatusFilter)}
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search reason..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-8"
            />
          </div>

          <Select
            value={sort}
            onValueChange={(value) => setSort(value as ConsultationSortOption)}
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
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-28 animate-pulse rounded-lg border bg-muted/40"
            />
          ))}
        </div>
      ) : consultations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {searchQuery || status !== "all"
                ? "No consultations match your current filters."
                : "You haven't booked any consultations yet."}
            </p>
            {!searchQuery && status === "all" && (
              <Button variant="outline" onClick={() => setBookOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" />
                Book your first consultation
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {consultations.map((item) => {
            const isScheduled = item.status === "scheduled";
            const isCompleted = item.status === "completed";
            const isCancelled = item.status === "cancelled";
            const isBusy = togglingId === item.id;
            const notStartedYet =
              isScheduled && !hasStarted(item.scheduled_at);

            return (
              <Card
                key={item.id}
                className={
                  isCancelled ? "opacity-75" : isCompleted ? "opacity-90" : undefined
                }
              >
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    {/* Time on its own line, badges always on the line below. */}
                    <p className="flex items-center gap-1.5 font-semibold">
                      <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" />
                      {formatSessionRange(item.scheduled_at, item.duration_minutes)}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={item.status} scheduledAt={item.scheduled_at} />
                    </div>

                    <p className="text-sm text-foreground/90">{item.reason}</p>

                    {(item.rescheduled_at || item.completed_at || item.cancelled_at) && (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {item.rescheduled_at && (
                          <span>
                            Rescheduled {formatDateTime(item.rescheduled_at)}
                          </span>
                        )}
                        {item.completed_at && (
                          <span>Completed {formatDateTime(item.completed_at)}</span>
                        )}
                        {item.cancelled_at && (
                          <span>
                            Cancelled {formatDateTime(item.cancelled_at)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {isScheduled && (
                    <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                      {notStartedYet ? (
                        // Disabled buttons ignore the pointer, so the tooltip sits on a
                        // focusable wrapper (hover or keyboard focus shows it).
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span tabIndex={0} className="inline-flex rounded-md">
                              <Button variant="secondary" size="sm" disabled>
                                <CheckCircle2 className="mr-1 h-4 w-4" />
                                Mark as complete
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>Available after the session starts</TooltipContent>
                        </Tooltip>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={isBusy}
                          onClick={() => void handleToggleComplete(item, true)}
                        >
                          <CheckCircle2 className="mr-1 h-4 w-4" />
                          Mark as complete
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setRescheduleTarget(item)}
                      >
                        Reschedule
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        // Muted rust instead of alarm red: 5.3:1 light / 5.8:1 dark on the secondary bg.
                        className="text-[#9C4A2E] hover:text-[#9C4A2E] dark:text-[#D98E6A] dark:hover:text-[#D98E6A]"
                        onClick={() => setCancelTarget(item)}
                      >
                        <XCircle className="mr-1 h-4 w-4" />
                        Cancel
                      </Button>
                    </div>
                  )}

                  {isCompleted && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 self-start"
                          disabled={isBusy}
                          aria-label="More actions"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => void handleToggleComplete(item, false)}
                        >
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Mark as incomplete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </CardContent>
              </Card>
            );
          })}
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

      <ProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        email={profileEmail}
        firstName={profileFirstName}
        lastName={profileLastName}
        // Re-render the server page so the new names reach the booking form.
        onSaved={() => router.refresh()}
      />

      <BookConsultationDialog
        open={bookOpen}
        onOpenChange={setBookOpen}
        profileFirstName={profileFirstName}
        profileLastName={profileLastName}
        onSuccess={() => refresh(true)}
      />

      <RescheduleConsultationDialog
        consultation={rescheduleTarget}
        onOpenChange={(open) => {
          if (!open) setRescheduleTarget(null);
        }}
        onSuccess={() => refresh()}
      />

      <CancelConsultationDialog
        consultation={cancelTarget}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
        onSuccess={() => refresh()}
      />
    </div>
  );
}
