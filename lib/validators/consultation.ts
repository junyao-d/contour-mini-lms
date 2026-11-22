import { z } from "zod";
import {
  DEFAULT_SESSION_DURATION_MINUTES,
  MAX_BOOKING_HORIZON_DAYS,
  SESSION_DURATION_OPTIONS,
  SLOT_GRANULARITY_MINUTES,
} from "@/lib/domain/consultation-constants";

const trimmedNameSchema = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(100, `${label} must be at most 100 characters`);

const reasonSchema = z
  .string()
  .trim()
  .min(1, "Reason for consultation is required")
  .max(1000, "Reason must be at most 1000 characters");

const SLOT_MS = SLOT_GRANULARITY_MINUTES * 60 * 1000;
const HORIZON_MS = MAX_BOOKING_HORIZON_DAYS * 24 * 60 * 60 * 1000;

/** Start-time rules shared by the API and the booking dialogs (client-side pre-check). */
export const consultationStartSchema = z.iso
  .datetime({
    offset: true,
    message: "Datetime must be a valid ISO 8601 timestamp with timezone offset",
  })
  .refine((value) => new Date(value).getTime() > Date.now(), {
    message: "Consultation datetime must be in the future",
  })
  .refine((value) => new Date(value).getTime() <= Date.now() + HORIZON_MS, {
    message: `Consultations can be booked at most ${MAX_BOOKING_HORIZON_DAYS} days ahead`,
  })
  // Epoch-based check is timezone-safe: every real UTC offset is a multiple of 15 minutes.
  .refine((value) => new Date(value).getTime() % SLOT_MS === 0, {
    message: `Consultation time must start on a ${SLOT_GRANULARITY_MINUTES}-minute boundary (e.g. 10:00, 10:15)`,
  });

const durationSchema = z.literal(SESSION_DURATION_OPTIONS, {
  error: `Session length must be one of ${SESSION_DURATION_OPTIONS.join(", ")} minutes`,
});

export const uuidParamSchema = z.uuid("Invalid consultation ID");

export const createConsultationSchema = z.object({
  first_name: trimmedNameSchema("First name"),
  last_name: trimmedNameSchema("Last name"),
  reason: reasonSchema,
  scheduled_at: consultationStartSchema,
  duration_minutes: durationSchema.default(DEFAULT_SESSION_DURATION_MINUTES),
});

export const rescheduleConsultationSchema = z.object({
  action: z.literal("reschedule"),
  scheduled_at: consultationStartSchema,
  duration_minutes: durationSchema.optional(),
  reason: reasonSchema.optional(),
});

export const toggleCompleteConsultationSchema = z.object({
  action: z.literal("toggle_complete"),
  completed: z.boolean(),
});

export const cancelConsultationSchema = z.object({
  action: z.literal("cancel"),
});

export const updateConsultationSchema = z.discriminatedUnion("action", [
  rescheduleConsultationSchema,
  toggleCompleteConsultationSchema,
  cancelConsultationSchema,
]);

export const consultationStatusFilterSchema = z.enum([
  "all",
  "scheduled",
  "completed",
  "cancelled",
]);

export const consultationSortOptionSchema = z.enum([
  "scheduled_at_desc",
  "scheduled_at_asc",
  "created_at_desc",
]);

export const listConsultationsQuerySchema = z.object({
  status: consultationStatusFilterSchema.default("all"),
  search: z.string().trim().max(100, "Search query is too long").default(""),
  sort: consultationSortOptionSchema.default("scheduled_at_desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  // Optional scheduled_at window [from, to), used by the booking time picker.
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
});

export type CreateConsultationInput = z.infer<typeof createConsultationSchema>;
export type UpdateConsultationInput = z.infer<typeof updateConsultationSchema>;
export type ListConsultationsQuery = z.infer<typeof listConsultationsQuerySchema>;
export type ConsultationStatusFilter = z.infer<typeof consultationStatusFilterSchema>;
export type ConsultationSortOption = z.infer<typeof consultationSortOptionSchema>;
