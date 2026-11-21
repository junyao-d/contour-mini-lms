import { z } from "zod";

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

const futureIsoDatetimeSchema = z.iso
  .datetime({
    offset: true,
    message: "Datetime must be a valid ISO 8601 timestamp with timezone offset",
  })
  .refine((value) => new Date(value).getTime() > Date.now(), {
    message: "Consultation datetime must be in the future",
  });

export const uuidParamSchema = z.uuid("Invalid consultation ID");

export const createConsultationSchema = z.object({
  first_name: trimmedNameSchema("First name"),
  last_name: trimmedNameSchema("Last name"),
  reason: reasonSchema,
  scheduled_at: futureIsoDatetimeSchema,
});

export const rescheduleConsultationSchema = z.object({
  action: z.literal("reschedule"),
  scheduled_at: futureIsoDatetimeSchema,
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
});

export type CreateConsultationInput = z.infer<typeof createConsultationSchema>;
export type UpdateConsultationInput = z.infer<typeof updateConsultationSchema>;
export type ListConsultationsQuery = z.infer<typeof listConsultationsQuerySchema>;
export type ConsultationStatusFilter = z.infer<typeof consultationStatusFilterSchema>;
export type ConsultationSortOption = z.infer<typeof consultationSortOptionSchema>;
