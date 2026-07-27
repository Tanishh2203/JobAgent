export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      drafts: {
        Row: {
          body: string
          created_at: string
          id: string
          job_id: string
          model: string
          subject: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          job_id: string
          model?: string
          subject: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          job_id?: string
          model?: string
          subject?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drafts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          company: string
          description: string
          experience_max: number | null
          experience_min: number | null
          id: string
          ingested_at: string
          location: string | null
          matched_skills: string[]
          posted_at: string | null
          score: number
          source: string
          source_id: string
          title: string
          url: string | null
          user_id: string
          work_mode: string
        }
        Insert: {
          company: string
          description?: string
          experience_max?: number | null
          experience_min?: number | null
          id?: string
          ingested_at?: string
          location?: string | null
          matched_skills?: string[]
          posted_at?: string | null
          score?: number
          source?: string
          source_id: string
          title: string
          url?: string | null
          user_id: string
          work_mode?: string
        }
        Update: {
          company?: string
          description?: string
          experience_max?: number | null
          experience_min?: number | null
          id?: string
          ingested_at?: string
          location?: string | null
          matched_skills?: string[]
          posted_at?: string | null
          score?: number
          source?: string
          source_id?: string
          title?: string
          url?: string | null
          user_id?: string
          work_mode?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          digest_email: string | null
          full_name: string | null
          github: string | null
          hours_old: number
          linkedin: string | null
          location: string
          min_score: number
          my_experience_years: number
          search_term: string
          top_k: number
          updated_at: string
          user_id: string
          work_modes: string[]
        }
        Insert: {
          created_at?: string
          digest_email?: string | null
          full_name?: string | null
          github?: string | null
          hours_old?: number
          linkedin?: string | null
          location?: string
          min_score?: number
          my_experience_years?: number
          search_term?: string
          top_k?: number
          updated_at?: string
          user_id: string
          work_modes?: string[]
        }
        Update: {
          created_at?: string
          digest_email?: string | null
          full_name?: string | null
          github?: string | null
          hours_old?: number
          linkedin?: string | null
          location?: string
          min_score?: number
          my_experience_years?: number
          search_term?: string
          top_k?: number
          updated_at?: string
          user_id?: string
          work_modes?: string[]
        }
        Relationships: []
      }
      resumes: {
        Row: {
          created_at: string
          filename: string
          id: string
          is_active: boolean
          skills: string[]
          text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filename: string
          id?: string
          is_active?: boolean
          skills?: string[]
          text: string
          user_id: string
        }
        Update: {
          created_at?: string
          filename?: string
          id?: string
          is_active?: boolean
          skills?: string[]
          text?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
