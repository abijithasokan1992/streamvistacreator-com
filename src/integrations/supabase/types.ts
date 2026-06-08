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
      dmca_requests: {
        Row: {
          accuracy_statement: boolean
          admin_notes: string | null
          copyright_work: string
          created_at: string
          description: string
          evidence_path: string | null
          good_faith_statement: boolean
          id: string
          infringing_url: string
          reporter_address: string | null
          reporter_email: string
          reporter_name: string
          reporter_phone: string | null
          signature: string
          status: string
          updated_at: string
        }
        Insert: {
          accuracy_statement?: boolean
          admin_notes?: string | null
          copyright_work: string
          created_at?: string
          description: string
          evidence_path?: string | null
          good_faith_statement?: boolean
          id?: string
          infringing_url: string
          reporter_address?: string | null
          reporter_email: string
          reporter_name: string
          reporter_phone?: string | null
          signature: string
          status?: string
          updated_at?: string
        }
        Update: {
          accuracy_statement?: boolean
          admin_notes?: string | null
          copyright_work?: string
          created_at?: string
          description?: string
          evidence_path?: string | null
          good_faith_statement?: boolean
          id?: string
          infringing_url?: string
          reporter_address?: string | null
          reporter_email?: string
          reporter_name?: string
          reporter_phone?: string | null
          signature?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      onboarding_audit_log: {
        Row: {
          changed_by: string | null
          changed_by_email: string | null
          created_at: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          onboarding_request_id: string
        }
        Insert: {
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          onboarding_request_id: string
        }
        Update: {
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          onboarding_request_id?: string
        }
        Relationships: []
      }
      onboarding_notifications: {
        Row: {
          channel: string
          created_at: string
          error_code: string | null
          error_message: string | null
          event: string
          id: string
          message_sid: string | null
          onboarding_request_id: string
          raw: Json | null
          status: string
          to_number: string | null
          updated_at: string
        }
        Insert: {
          channel: string
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          event: string
          id?: string
          message_sid?: string | null
          onboarding_request_id: string
          raw?: Json | null
          status?: string
          to_number?: string | null
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          event?: string
          id?: string
          message_sid?: string | null
          onboarding_request_id?: string
          raw?: Json | null
          status?: string
          to_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_notifications_onboarding_request_id_fkey"
            columns: ["onboarding_request_id"]
            isOneToOne: false
            referencedRelation: "onboarding_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_requests: {
        Row: {
          access_code: string | null
          amount_paid_paise: number | null
          base_price: number
          business_email: string | null
          client_name: string
          contact_phone: string | null
          created_at: string
          final_price: number
          id: string
          mfi_proof_path: string | null
          onboarding_status: string
          payment_status: string
          plan_type: string
          professional_role: string
          promo_code: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          selected_cycle: string
        }
        Insert: {
          access_code?: string | null
          amount_paid_paise?: number | null
          base_price: number
          business_email?: string | null
          client_name: string
          contact_phone?: string | null
          created_at?: string
          final_price: number
          id?: string
          mfi_proof_path?: string | null
          onboarding_status?: string
          payment_status?: string
          plan_type?: string
          professional_role: string
          promo_code?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          selected_cycle: string
        }
        Update: {
          access_code?: string | null
          amount_paid_paise?: number | null
          base_price?: number
          business_email?: string | null
          client_name?: string
          contact_phone?: string | null
          created_at?: string
          final_price?: number
          id?: string
          mfi_proof_path?: string | null
          onboarding_status?: string
          payment_status?: string
          plan_type?: string
          professional_role?: string
          promo_code?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          selected_cycle?: string
        }
        Relationships: []
      }
      premium_invitations: {
        Row: {
          created_at: string
          created_by: string | null
          discount_percent: number
          expires_at: string
          id: string
          invitee_email: string | null
          invitee_name: string
          invitee_phone: string | null
          is_free: boolean
          note: string | null
          redeemed_at: string | null
          redeemed_by: string | null
          sent_channels: string[]
          status: string
          storage_tb: number
          token: string
          updated_at: string
          validity_days: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          discount_percent?: number
          expires_at?: string
          id?: string
          invitee_email?: string | null
          invitee_name: string
          invitee_phone?: string | null
          is_free?: boolean
          note?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          sent_channels?: string[]
          status?: string
          storage_tb?: number
          token?: string
          updated_at?: string
          validity_days?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          discount_percent?: number
          expires_at?: string
          id?: string
          invitee_email?: string | null
          invitee_name?: string
          invitee_phone?: string | null
          is_free?: boolean
          note?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          sent_channels?: string[]
          status?: string
          storage_tb?: number
          token?: string
          updated_at?: string
          validity_days?: number
        }
        Relationships: []
      }
      shared_files: {
        Row: {
          created_at: string
          download_count: number
          expires_at: string | null
          filename: string
          id: string
          max_downloads: number | null
          mime_type: string | null
          owner_id: string
          password_hash: string | null
          password_salt: string | null
          revoked: boolean
          share_token: string
          size_bytes: number
          storage_path: string
          tier: string
        }
        Insert: {
          created_at?: string
          download_count?: number
          expires_at?: string | null
          filename: string
          id?: string
          max_downloads?: number | null
          mime_type?: string | null
          owner_id: string
          password_hash?: string | null
          password_salt?: string | null
          revoked?: boolean
          share_token: string
          size_bytes: number
          storage_path: string
          tier?: string
        }
        Update: {
          created_at?: string
          download_count?: number
          expires_at?: string | null
          filename?: string
          id?: string
          max_downloads?: number | null
          mime_type?: string | null
          owner_id?: string
          password_hash?: string | null
          password_salt?: string | null
          revoked?: boolean
          share_token?: string
          size_bytes?: number
          storage_path?: string
          tier?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          customer_email: string | null
          environment: string
          id: string
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          customer_email?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          customer_email?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      claim_admin_if_none: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mfi_seats_taken: { Args: never; Returns: number }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
