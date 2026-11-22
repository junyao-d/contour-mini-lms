import { Badge } from "@/components/ui/badge";
import { hasStarted } from "@/lib/domain/consultation-transitions";
import type { ConsultationStatus } from "@/lib/types/database";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<
  ConsultationStatus,
  { label: string; className: string }
> = {
  scheduled: {
    label: "Scheduled",
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
  },
  completed: {
    label: "Completed",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  },
  cancelled: {
    label: "Cancelled",
    className:
      "border-neutral-300 bg-neutral-100 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400",
  },
};

export function StatusBadge({
  status,
  scheduledAt,
}: {
  status: ConsultationStatus;
  scheduledAt: string;
}) {
  const config = STATUS_STYLES[status];
  // Display-only: a scheduled consultation whose start time has passed.
  const isPastDue = status === "scheduled" && hasStarted(scheduledAt);

  return (
    <>
      <Badge variant="outline" className={cn("font-medium", config.className)}>
        {config.label}
      </Badge>
      {isPastDue && (
        <Badge
          variant="outline"
          className="border-amber-200 bg-amber-50 font-medium text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
        >
          Past due
        </Badge>
      )}
    </>
  );
}
