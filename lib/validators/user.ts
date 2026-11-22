import { z } from "zod";

export const userRoleFilterSchema = z.enum(["all", "student", "admin"]);

export const userSortOptionSchema = z.enum([
  "created_at_desc",
  "consultations_desc",
  "consultations_asc",
]);

export const listUsersQuerySchema = z.object({
  role: userRoleFilterSchema.default("all"),
  sort: userSortOptionSchema.default("created_at_desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export type UserRoleFilter = z.infer<typeof userRoleFilterSchema>;
export type UserSortOption = z.infer<typeof userSortOptionSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
