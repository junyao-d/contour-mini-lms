import { Card, CardContent } from "@/components/ui/card";
import type { ConsultationSummary } from "@/lib/types/database";

const ITEMS: Array<{
  key: keyof ConsultationSummary;
  label: string;
  accent: string;
}> = [
  { key: "total", label: "Total", accent: "text-foreground" },
  {
    key: "scheduled",
    label: "Scheduled",
    accent: "text-blue-600 dark:text-blue-400",
  },
  {
    key: "completed",
    label: "Completed",
    accent: "text-emerald-600 dark:text-emerald-400",
  },
  { key: "cancelled", label: "Cancelled", accent: "text-muted-foreground" },
];

export function SummaryCards({ summary }: { summary: ConsultationSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {ITEMS.map((item) => (
        <Card key={item.key}>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {item.label}
            </p>
            <p className={`mt-1 text-2xl font-bold ${item.accent}`}>
              {summary[item.key]}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
