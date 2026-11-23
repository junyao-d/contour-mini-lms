// The Database type is generated from the local schema (`npm run db:types`
// writes lib/types/supabase.ts). This file only adds the app's domain types.
import type { Database } from "@/lib/types/supabase";

export type { Database, Json } from "@/lib/types/supabase";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type ConsultationStatus = Database["public"]["Enums"]["consultation_status"];

// Domain DTOs used by API Route Handlers and UI components
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Consultation = Database["public"]["Tables"]["consultations"]["Row"];

export type AdminUser = Pick<
  Profile,
  "id" | "email" | "first_name" | "last_name" | "role"
> & { total_consultations: number };

export type StudentAccountSummary = Pick<
  Profile,
  "id" | "email" | "first_name" | "last_name"
>;

export type AdminConsultation = Consultation & {
  student: StudentAccountSummary;
};

export interface ConsultationSummary {
  total: number;
  scheduled: number;
  completed: number;
  cancelled: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ConsultationListMeta {
  pagination: PaginationMeta;
  summary: ConsultationSummary;
}
