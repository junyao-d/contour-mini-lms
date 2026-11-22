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
  getDefaultBookingDateTime,
  readApiErrorMessage,
} from "@/lib/format";

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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Book a Consultation</DialogTitle>
          <DialogDescription>
            Schedule an upcoming consultation session. Active consultations must
            be spaced at least {MIN_CONSULTATION_GAP_MINUTES} minutes apart.
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
  const [scheduledAt, setScheduledAt] = useState(getDefaultBookingDateTime);
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
      setError("Consultation datetime must be in the future.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          reason: reason.trim(),
          scheduled_at: parsedDate.toISOString(),
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="book-first-name">First Name</Label>
          <Input
            id="book-first-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            readOnly={isFirstNameLocked}
            required
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
            required
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

      <div className="grid gap-1.5">
        <Label htmlFor="book-datetime">Date &amp; Time</Label>
        <Input
          id="book-datetime"
          type="datetime-local"
          value={scheduledAt}
          {...getBookingInputBounds()}
          onChange={(e) => setScheduledAt(e.target.value)}
          required
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="book-reason">Reason for Consultation</Label>
        <Textarea
          id="book-reason"
          placeholder="Describe the topic, assignment, or questions you want to cover..."
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
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Booking..." : "Book Consultation"}
        </Button>
      </DialogFooter>
    </form>
  );
}
