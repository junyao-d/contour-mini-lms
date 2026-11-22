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
import {
  SessionTimePicker,
  validateSessionTime,
  type SessionTimeValue,
} from "@/components/consultations/session-time-picker";
import { DEFAULT_SESSION_DURATION_MINUTES } from "@/lib/domain/consultation-constants";
import { readApiErrorMessage } from "@/lib/format";

interface BookConsultationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileFirstName: string | null;
  profileLastName: string | null;
  onSuccess: () => void;
}

export function BookConsultationDialog({
  open,
  onOpenChange,
  profileFirstName,
  profileLastName,
  onSuccess,
}: BookConsultationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Book a Consultation</DialogTitle>
          <DialogDescription>
            Choose how long you need, then pick a day and time. Sessions
            can&apos;t overlap with your other upcoming sessions.
          </DialogDescription>
        </DialogHeader>

        {/* DialogContent unmounts on close, so the form state resets on every open. */}
        <BookConsultationForm
          profileFirstName={profileFirstName}
          profileLastName={profileLastName}
          onCancel={() => onOpenChange(false)}
          onBooked={() => {
            onOpenChange(false);
            onSuccess();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

interface BookConsultationFormProps {
  profileFirstName: string | null;
  profileLastName: string | null;
  onCancel: () => void;
  onBooked: () => void;
}

function BookConsultationForm({
  profileFirstName,
  profileLastName,
  onCancel,
  onBooked,
}: BookConsultationFormProps) {
  const isFirstNameLocked = Boolean(profileFirstName?.trim());
  const isLastNameLocked = Boolean(profileLastName?.trim());

  const [firstName, setFirstName] = useState(profileFirstName ?? "");
  const [lastName, setLastName] = useState(profileLastName ?? "");
  const [reason, setReason] = useState("");
  const [time, setTime] = useState<SessionTimeValue>({
    start: null,
    duration: DEFAULT_SESSION_DURATION_MINUTES,
  });
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
    if (!firstName.trim() || !lastName.trim()) {
      setError("First and last name are required.");
      return;
    }
    if (nextTimeError || nextReasonError || !time.start) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          reason: reason.trim(),
          scheduled_at: time.start,
          duration_minutes: time.duration,
        }),
      });

      if (!response.ok) {
        setError(
          await readApiErrorMessage(response, "Failed to book consultation."),
        );
        return;
      }

      onBooked();
    } catch {
      setError("Network error while booking consultation. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    // noValidate: all errors are shown inline in the app's style, not as browser bubbles.
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="book-first-name">First Name</Label>
          <Input
            id="book-first-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            readOnly={isFirstNameLocked}
            maxLength={100}
            className={isFirstNameLocked ? "bg-muted text-muted-foreground" : ""}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="book-last-name">Last Name</Label>
          <Input
            id="book-last-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            readOnly={isLastNameLocked}
            maxLength={100}
            className={isLastNameLocked ? "bg-muted text-muted-foreground" : ""}
          />
        </div>
      </div>

      {(isFirstNameLocked || isLastNameLocked) && (
        <p className="text-xs text-muted-foreground">
          From your profile
        </p>
      )}

      <SessionTimePicker
        value={time}
        onChange={(next) => {
          setTime(next);
          setTimeError(null);
        }}
        error={timeError}
        errorId="book-time-error"
      />

      <div className="grid gap-1.5">
        <Label htmlFor="book-reason">Reason for Consultation</Label>
        <Textarea
          id="book-reason"
          placeholder="Describe the topic, assignment, or questions you want to cover..."
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setReasonError(null);
          }}
          maxLength={1000}
          rows={3}
          aria-invalid={reasonError ? true : undefined}
          aria-describedby={reasonError ? "book-reason-error" : undefined}
        />
        {reasonError && (
          <p id="book-reason-error" className="text-sm text-destructive">
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
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Booking..." : "Book Consultation"}
        </Button>
      </DialogFooter>
    </form>
  );
}
