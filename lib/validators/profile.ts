import { z } from "zod";
import { trimmedNameSchema } from "@/lib/validators/consultation";

// Only names are editable; any other field in the body (email, role, ...) is stripped.
export const updateProfileSchema = z.object({
  first_name: trimmedNameSchema("First name"),
  last_name: trimmedNameSchema("Last name"),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
