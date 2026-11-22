"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MIN_CONSULTATION_GAP_MINUTES } from "@/lib/domain/consultation-constants";
import {
  getBookingInputBounds,
  readApiErrorMessage,
  toDateTimeLocalValue,
} from "@/lib/format";
import type { Consultation } from "@/lib/types/database";

interface RescheduleConsultationDialogProps {
  consultation: Consultation | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function RescheduleConsultationDialog({
  consultation,
  onOpenChange,
  onSuccess,
}: RescheduleConsultationDialogProps) {
  return (
    <Dialog open={Boolean(consultation)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reschedule Consultation</DialogTitle>
          <DialogDescription>
            Choose a new upcoming date and time (at least{" "}
            {MIN_CONSULTATION_GAP_MINUTES} minutes apart from other active
            consultations) or update your consultation reason.
          </DialogDescription>
        </DialogHeader>

        {/* Keyed by id so the form re-initialises from props for each consultation. */}
        {consultation && (
          <RescheduleConsultationForm
            key={consultation.id}
            consultation={consultation}
            onCancel={() => onOpenChange(false)}
            onRescheduled={() => {
              onOpenChange(false);
              onSuccess();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface RescheduleConsultationFormProps {
  consultation: Consultation;
  onCancel: () => void;
  onRescheduled: () => void;
}

function RescheduleConsultationForm({
  consultation,
  onCancel,
  onRescheduled,
}: RescheduleConsultationFormProps) {
  const [scheduledAt, setScheduledAt] = useState(() =>
    toDateTimeLocalValue(consultation.scheduled_at),
  );
  const [reason, setReason] = useState(consultation.reason);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const parsedDate = new Date(scheduledAt);
    if (Number.isNaN(parsedDate.getTime())) {
      setError("Please select a valid date and time.");
      return;
    }
    if (parsedDate.getTime() <= Date.now()) {
      setError("New consultation datetime must be in the future.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/consultations/${consultation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reschedule",
          scheduled_at: parsedDate.toISOString(),
          reason: reason.trim(),
        }),
      });

      if (!response.ok) {
        setError(
          await readApiErrorMessage(
            response,
            "Failed to reschedule consultation.",
          ),
        );
        return;
      }

      onRescheduled();
    } catch {
      setError("Network error while rescheduling. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-1.5">
        <Label htmlFor="reschedule-datetime">New Date &amp; Time</Label>
        <Input
          id="reschedule-datetime"
          type="datetime-local"
          value={scheduledAt}
          {...getBookingInputBounds()}
          onChange={(e) => setScheduledAt(e.target.value)}
          required
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="reschedule-reason">Reason for Consultation</Label>
        <Textarea
          id="reschedule-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          maxLength={1000}
          rows={4}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Keep Current Time
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}
