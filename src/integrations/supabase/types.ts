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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          achieved_results: string | null
          agenda: string | null
          axis: string | null
          created_at: string
          description: string | null
          end_date: string | null
          evidence: Json
          expected_results: string | null
          id: string
          indicators: string[]
          kind: string
          objectives: string | null
          organization_id: string | null
          outcomes: Json
          owner_id: string
          participant_agents: string[]
          participants: string | null
          problem: string | null
          problem_description: string | null
          referrals: string | null
          solution: string | null
          solution_description: string | null
          start_date: string | null
          status: string
          title: string
          updated_at: string
          work_done: string | null
        }
        Insert: {
          achieved_results?: string | null
          agenda?: string | null
          axis?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          evidence?: Json
          expected_results?: string | null
          id?: string
          indicators?: string[]
          kind: string
          objectives?: string | null
          organization_id?: string | null
          outcomes?: Json
          owner_id?: string
          participant_agents?: string[]
          participants?: string | null
          problem?: string | null
          problem_description?: string | null
          referrals?: string | null
          solution?: string | null
          solution_description?: string | null
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string
          work_done?: string | null
        }
        Update: {
          achieved_results?: string | null
          agenda?: string | null
          axis?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          evidence?: Json
          expected_results?: string | null
          id?: string
          indicators?: string[]
          kind?: string
          objectives?: string | null
          organization_id?: string | null
          outcomes?: Json
          owner_id?: string
          participant_agents?: string[]
          participants?: string | null
          problem?: string | null
          problem_description?: string | null
          referrals?: string | null
          solution?: string | null
          solution_description?: string | null
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
          work_done?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      actors: {
        Row: {
          actor_name: string
          address: string | null
          birth_date: string | null
          created_at: string
          document: string | null
          email: string | null
          id: string
          institution_name: string
          institution_type: string
          owner_id: string
          phone: string | null
          position: string | null
        }
        Insert: {
          actor_name: string
          address?: string | null
          birth_date?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          institution_name: string
          institution_type?: string
          owner_id?: string
          phone?: string | null
          position?: string | null
        }
        Update: {
          actor_name?: string
          address?: string | null
          birth_date?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          institution_name?: string
          institution_type?: string
          owner_id?: string
          phone?: string | null
          position?: string | null
        }
        Relationships: []
      }
      indicator_values: {
        Row: {
          accumulated: string
          code: string
          current: string
          owner_id: string
          previous: string
          updated_at: string
        }
        Insert: {
          accumulated?: string
          code: string
          current?: string
          owner_id: string
          previous?: string
          updated_at?: string
        }
        Update: {
          accumulated?: string
          code?: string
          current?: string
          owner_id?: string
          previous?: string
          updated_at?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          address: string | null
          contact: string | null
          created_at: string
          demand: string | null
          document: string | null
          email: string | null
          id: string
          kind: string
          maturity: string | null
          name: string
          notes: string | null
          owner_id: string
          phone: string | null
          referral: string | null
          region: string | null
          sector: string | null
          size: string | null
          stage: string
        }
        Insert: {
          address?: string | null
          contact?: string | null
          created_at?: string
          demand?: string | null
          document?: string | null
          email?: string | null
          id?: string
          kind?: string
          maturity?: string | null
          name: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
          referral?: string | null
          region?: string | null
          sector?: string | null
          size?: string | null
          stage?: string
        }
        Update: {
          address?: string | null
          contact?: string | null
          created_at?: string
          demand?: string | null
          document?: string | null
          email?: string | null
          id?: string
          kind?: string
          maturity?: string | null
          name?: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
          referral?: string | null
          region?: string | null
          sector?: string | null
          size?: string | null
          stage?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approval_status: string
          created_at: string
          full_name: string
          governance: string | null
          id: string
          phone: string | null
          region: string | null
          requested_role: Database["public"]["Enums"]["app_role"] | null
        }
        Insert: {
          approval_status?: string
          created_at?: string
          full_name?: string
          governance?: string | null
          id: string
          phone?: string | null
          region?: string | null
          requested_role?: Database["public"]["Enums"]["app_role"] | null
        }
        Update: {
          approval_status?: string
          created_at?: string
          full_name?: string
          governance?: string | null
          id?: string
          phone?: string | null
          region?: string | null
          requested_role?: Database["public"]["Enums"]["app_role"] | null
        }
        Relationships: []
      }
      strategy_actions: {
        Row: {
          activities: Json
          axis: string
          created_at: string
          description: string
          expected_results: Json
          id: string
          owner_id: string
          problem: string
          problem_description: string
          solution: string
          solution_description: string
          status: string
          updated_at: string
        }
        Insert: {
          activities?: Json
          axis: string
          created_at?: string
          description?: string
          expected_results?: Json
          id?: string
          owner_id?: string
          problem?: string
          problem_description?: string
          solution?: string
          solution_description?: string
          status?: string
          updated_at?: string
        }
        Update: {
          activities?: Json
          axis?: string
          created_at?: string
          description?: string
          expected_results?: Json
          id?: string
          owner_id?: string
          problem?: string
          problem_description?: string
          solution?: string
          solution_description?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activity_agent_choices: {
        Args: never
        Returns: {
          full_name: string
          user_id: string
        }[]
      }
      coordination_participants: {
        Args: never
        Returns: {
          full_name: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_account_approved: { Args: { _user_id?: string }; Returns: boolean }
      review_account: {
        Args: { _decision: string; _user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "coordinator" | "agent" | "viewer"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "coordinator", "agent", "viewer"],
    },
  },
} as const
