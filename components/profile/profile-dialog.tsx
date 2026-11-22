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
import { readApiErrorMessage } from "@/lib/format";
import { updateProfileSchema } from "@/lib/validators/profile";

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  firstName: string | null;
  lastName: string | null;
  onSaved: () => void;
}

export function ProfileDialog({
  open,
  onOpenChange,
  email,
  firstName,
  lastName,
  onSaved,
}: ProfileDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>My Profile</DialogTitle>
          <DialogDescription>
            Your name is used on new consultations. Existing consultations keep
            the name they were booked with.
          </DialogDescription>
        </DialogHeader>

        {/* DialogContent unmounts on close, so the form resets to the saved values. */}
        <ProfileForm
          email={email}
          initialFirstName={firstName ?? ""}
          initialLastName={lastName ?? ""}
          onCancel={() => onOpenChange(false)}
          onSaved={() => {
            onOpenChange(false);
            onSaved();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

interface ProfileFormProps {
  email: string;
  initialFirstName: string;
  initialLastName: string;
  onCancel: () => void;
  onSaved: () => void;
}

type FieldErrors = Partial<Record<"first_name" | "last_name", string>>;

function ProfileForm({
  email,
  initialFirstName,
  initialLastName,
  onCancel,
  onSaved,
}: ProfileFormProps) {
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Same Zod rules as the API, so errors show inline before a round trip.
    const parsed = updateProfileSchema.safeParse({
      first_name: firstName,
      last_name: lastName,
    });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        next[key] ??= issue.message;
      }
      setFieldErrors(next);
      return;
    }
    setFieldErrors({});

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (!response.ok) {
        setError(await readApiErrorMessage(response, "Failed to update profile."));
        return;
      }

      onSaved();
    } catch {
      setError("Network error while saving your profile. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="grid gap-1.5">
        <Label htmlFor="profile-email">Email</Label>
        <Input
          id="profile-email"
          value={email}
          readOnly
          className="bg-muted text-muted-foreground"
          aria-describedby="profile-email-hint"
        />
        <p id="profile-email-hint" className="text-xs text-muted-foreground">
          Your email is your sign-in and can&apos;t be changed here.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="profile-first-name">First Name</Label>
          <Input
            id="profile-first-name"
            value={firstName}
            onChange={(e) => {
              setFirstName(e.target.value);
              setFieldErrors((prev) => ({ ...prev, first_name: undefined }));
            }}
            maxLength={100}
            aria-invalid={fieldErrors.first_name ? true : undefined}
            aria-describedby={fieldErrors.first_name ? "profile-first-name-error" : undefined}
          />
          {fieldErrors.first_name && (
            <p id="profile-first-name-error" className="text-sm text-destructive">
              {fieldErrors.first_name}
            </p>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="profile-last-name">Last Name</Label>
          <Input
            id="profile-last-name"
            value={lastName}
            onChange={(e) => {
              setLastName(e.target.value);
              setFieldErrors((prev) => ({ ...prev, last_name: undefined }));
            }}
            maxLength={100}
            aria-invalid={fieldErrors.last_name ? true : undefined}
            aria-describedby={fieldErrors.last_name ? "profile-last-name-error" : undefined}
          />
          {fieldErrors.last_name && (
            <p id="profile-last-name-error" className="text-sm text-destructive">
              {fieldErrors.last_name}
            </p>
          )}
        </div>
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
          {isSubmitting ? "Saving..." : "Save Changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}
