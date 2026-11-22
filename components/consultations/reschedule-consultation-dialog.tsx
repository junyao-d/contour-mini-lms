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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  SessionTimePicker,
  validateSessionTime,
  type SessionTimeValue,
} from "@/components/consultations/session-time-picker";
import type { SessionDuration } from "@/lib/domain/consultation-constants";
import { readApiErrorMessage } from "@/lib/format";
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Reschedule Consultation</DialogTitle>
          <DialogDescription>
            Change the length, day or time, or update the reason. Sessions
            can&apos;t overlap with your other upcoming sessions.
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
  const [time, setTime] = useState<SessionTimeValue>(() => ({
    // Normalise to toISOString() so it matches the picker's slot keys.
    start: new Date(consultation.scheduled_at).toISOString(),
    duration: consultation.duration_minutes as SessionDuration,
  }));
  const [reason, setReason] = useState(consultation.reason);
  const [timeError, setTimeError] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const nextTimeError = validateSessionTime(time);
    const nextReasonError = reason.trim()
      ? null
      : "Tell us what you'd like to cover.";
    setTimeError(nextTimeError);
    setReasonError(nextReasonError);
    if (nextTimeError || nextReasonError || !time.start) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/consultations/${consultation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reschedule",
          scheduled_at: time.start,
          duration_minutes: time.duration,
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
    // noValidate: all errors are shown inline in the app's style, not as browser bubbles.
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <SessionTimePicker
        value={time}
        onChange={(next) => {
          setTime(next);
          setTimeError(null);
        }}
        excludeId={consultation.id}
        error={timeError}
        errorId="reschedule-time-error"
      />

      <div className="grid gap-1.5">
        <Label htmlFor="reschedule-reason">Reason for Consultation</Label>
        <Textarea
          id="reschedule-reason"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setReasonError(null);
          }}
          maxLength={1000}
          rows={3}
          aria-invalid={reasonError ? true : undefined}
          aria-describedby={reasonError ? "reschedule-reason-error" : undefined}
        />
        {reasonError && (
          <p id="reschedule-reason-error" className="text-sm text-destructive">
            {reasonError}
          </p>
        )}
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
