"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatSessionRange, readApiErrorMessage } from "@/lib/format";
import type { Consultation } from "@/lib/types/database";

interface CancelConsultationDialogProps {
  consultation: Consultation | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CancelConsultationDialog({
  consultation,
  onOpenChange,
  onSuccess,
}: CancelConsultationDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirmCancel = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!consultation) return;

    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/consultations/${consultation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });

      if (!response.ok) {
        setError(
          await readApiErrorMessage(response, "Failed to cancel consultation."),
        );
        return;
      }

      onOpenChange(false);
      onSuccess();
    } catch {
      setError("Network error while cancelling. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog
      open={Boolean(consultation)}
      onOpenChange={(open) => {
        if (!open) setError(null);
        onOpenChange(open);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel Consultation?</AlertDialogTitle>
          <AlertDialogDescription>
            {consultation && (
              <>
                This will permanently cancel your consultation scheduled for{" "}
                <strong className="text-foreground">
                  {formatSessionRange(consultation.scheduled_at, consultation.duration_minutes)}
                </strong>
                . Cancelled consultations cannot be reopened, though you can
                book a new one anytime.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>
            Keep Consultation
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirmCancel}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Cancelling..." : "Confirm Cancel"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
