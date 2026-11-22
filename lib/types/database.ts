export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AppRole = "student" | "admin";

export type ConsultationStatus = "scheduled" | "completed" | "cancelled";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          first_name: string | null;
          last_name: string | null;
          role: AppRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          first_name?: string | null;
          last_name?: string | null;
          role?: AppRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          first_name?: string | null;
          last_name?: string | null;
          role?: AppRole;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      consultations: {
        Row: {
          id: string;
          user_id: string;
          first_name: string;
          last_name: string;
          reason: string;
          scheduled_at: string;
          status: ConsultationStatus;
          completed_at: string | null;
          cancelled_at: string | null;
          rescheduled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          first_name: string;
          last_name: string;
          reason: string;
          scheduled_at: string;
          status?: ConsultationStatus;
          completed_at?: string | null;
          cancelled_at?: string | null;
          rescheduled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          first_name?: string;
          last_name?: string;
          reason?: string;
          scheduled_at?: string;
          status?: ConsultationStatus;
          completed_at?: string | null;
          cancelled_at?: string | null;
          rescheduled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "consultations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      consultations_with_student: {
        Row: {
          id: string;
          user_id: string;
          first_name: string;
          last_name: string;
          reason: string;
          scheduled_at: string;
          status: ConsultationStatus;
          completed_at: string | null;
          cancelled_at: string | null;
          rescheduled_at: string | null;
          created_at: string;
          updated_at: string;
          student_email: string;
          student_first_name: string | null;
          student_last_name: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      consultation_slot_range: {
        Args: {
          p_scheduled_at: string;
        };
        Returns: string;
      };
      get_consultation_summary: {
        Args: {
          p_user_id?: string | null;
        };
        Returns: {
          total: number;
          scheduled: number;
          completed: number;
          cancelled: number;
        }[];
      };
    };
    Enums: {
      app_role: AppRole;
      consultation_status: ConsultationStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// Domain DTOs used by API Route Handlers and UI components
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Consultation = Database["public"]["Tables"]["consultations"]["Row"];

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
