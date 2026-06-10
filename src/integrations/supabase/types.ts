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
      admin_audit_log: {
        Row: {
          action: string
          admin_email: string | null
          admin_user_id: string
          created_at: string
          details: Json
          id: string
          target_email: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_email?: string | null
          admin_user_id: string
          created_at?: string
          details?: Json
          id?: string
          target_email?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_email?: string | null
          admin_user_id?: string
          created_at?: string
          details?: Json
          id?: string
          target_email?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      admin_divisions: {
        Row: {
          created_at: string
          division: Database["public"]["Enums"]["admin_division"]
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          division: Database["public"]["Enums"]["admin_division"]
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          division?: Database["public"]["Enums"]["admin_division"]
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      branding_settings: {
        Row: {
          allow_user_logos: boolean
          created_at: string
          footer_logo_position: string
          footer_logo_url: string | null
          id: string
          show_wordmark: boolean
          site_logo_position: string
          site_logo_url: string | null
          updated_at: string
          updated_by: string | null
          user_logos_paid_only: boolean
        }
        Insert: {
          allow_user_logos?: boolean
          created_at?: string
          footer_logo_position?: string
          footer_logo_url?: string | null
          id?: string
          show_wordmark?: boolean
          site_logo_position?: string
          site_logo_url?: string | null
          updated_at?: string
          updated_by?: string | null
          user_logos_paid_only?: boolean
        }
        Update: {
          allow_user_logos?: boolean
          created_at?: string
          footer_logo_position?: string
          footer_logo_url?: string | null
          id?: string
          show_wordmark?: boolean
          site_logo_position?: string
          site_logo_url?: string | null
          updated_at?: string
          updated_by?: string | null
          user_logos_paid_only?: boolean
        }
        Relationships: []
      }
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
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      free_tier_config: {
        Row: {
          amount: number
          bandwidth_gb: number
          bandwidth_overage_inr_per_gb: number
          created_at: string
          currency: string
          duration_days: number
          id: string
          is_active: boolean
          label: string
          notes: string | null
          storage_gb: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount?: number
          bandwidth_gb?: number
          bandwidth_overage_inr_per_gb?: number
          created_at?: string
          currency?: string
          duration_days?: number
          id?: string
          is_active?: boolean
          label?: string
          notes?: string | null
          storage_gb?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          bandwidth_gb?: number
          bandwidth_overage_inr_per_gb?: number
          created_at?: string
          currency?: string
          duration_days?: number
          id?: string
          is_active?: boolean
          label?: string
          notes?: string | null
          storage_gb?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      intro_invites: {
        Row: {
          accepted_at: string | null
          accepted_user_id: string | null
          created_at: string
          email: string
          expires_at: string
          first_name: string
          id: string
          inviter_user_id: string
          last_name: string
          rate: number
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          created_at?: string
          email: string
          expires_at?: string
          first_name: string
          id?: string
          inviter_user_id: string
          last_name?: string
          rate?: number
          status?: string
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          first_name?: string
          id?: string
          inviter_user_id?: string
          last_name?: string
          rate?: number
          status?: string
          token?: string
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
      partner_logos: {
        Row: {
          created_at: string
          description: string
          id: string
          is_active: boolean
          logo_url: string
          name: string
          sort_order: number
          tag: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          logo_url: string
          name: string
          sort_order?: number
          tag?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          logo_url?: string
          name?: string
          sort_order?: number
          tag?: string
          updated_at?: string
        }
        Relationships: []
      }
      partner_logos_settings: {
        Row: {
          aspect_ratio: string
          container_bg: string
          id: boolean
          object_fit: string
          updated_at: string
        }
        Insert: {
          aspect_ratio?: string
          container_bg?: string
          id?: boolean
          object_fit?: string
          updated_at?: string
        }
        Update: {
          aspect_ratio?: string
          container_bg?: string
          id?: boolean
          object_fit?: string
          updated_at?: string
        }
        Relationships: []
      }
      premium_invitation_redemptions: {
        Row: {
          id: string
          invitation_id: string
          redeemed_at: string
          user_id: string
        }
        Insert: {
          id?: string
          invitation_id: string
          redeemed_at?: string
          user_id: string
        }
        Update: {
          id?: string
          invitation_id?: string
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "premium_invitation_redemptions_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "premium_invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      premium_invitations: {
        Row: {
          account_type: string
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
          referral_code: string | null
          sent_channels: string[]
          status: string
          storage_tb: number
          token: string
          updated_at: string
          validity_days: number
        }
        Insert: {
          account_type?: string
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
          referral_code?: string | null
          sent_channels?: string[]
          status?: string
          storage_tb?: number
          token?: string
          updated_at?: string
          validity_days?: number
        }
        Update: {
          account_type?: string
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
          referral_code?: string | null
          sent_channels?: string[]
          status?: string
          storage_tb?: number
          token?: string
          updated_at?: string
          validity_days?: number
        }
        Relationships: []
      }
      producer_assignments: {
        Row: {
          assigned_by: string | null
          created_at: string
          creator_user_id: string
          ep_user_id: string
          id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          creator_user_id: string
          ep_user_id: string
          id?: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          creator_user_id?: string
          ep_user_id?: string
          id?: string
        }
        Relationships: []
      }
      razorpay_config: {
        Row: {
          id: boolean
          key_id: string | null
          key_secret: string | null
          mode: string
          updated_at: string
          updated_by: string | null
          webhook_secret: string | null
        }
        Insert: {
          id?: boolean
          key_id?: string | null
          key_secret?: string | null
          mode?: string
          updated_at?: string
          updated_by?: string | null
          webhook_secret?: string | null
        }
        Update: {
          id?: boolean
          key_id?: string | null
          key_secret?: string | null
          mode?: string
          updated_at?: string
          updated_by?: string | null
          webhook_secret?: string | null
        }
        Relationships: []
      }
      recent_uploads: {
        Row: {
          bucket: string
          client_pending_id: string | null
          created_at: string
          error_message: string | null
          file_name: string
          file_size: number
          id: string
          mime_type: string | null
          namespace: string
          object_key: string
          par_expires_at: string | null
          par_url: string | null
          region: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bucket: string
          client_pending_id?: string | null
          created_at?: string
          error_message?: string | null
          file_name: string
          file_size?: number
          id?: string
          mime_type?: string | null
          namespace: string
          object_key: string
          par_expires_at?: string | null
          par_url?: string | null
          region: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bucket?: string
          client_pending_id?: string | null
          created_at?: string
          error_message?: string | null
          file_name?: string
          file_size?: number
          id?: string
          mime_type?: string | null
          namespace?: string
          object_key?: string
          par_expires_at?: string | null
          par_url?: string | null
          region?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          user_id: string
        }
        Insert: {
          code?: string
          created_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          commission_rate: number
          commission_until: string | null
          created_at: string
          id: string
          note: string | null
          referred_email: string | null
          referred_user_id: string | null
          referrer_code: string
          referrer_user_id: string | null
          reward_amount: number
          reward_type: string | null
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          commission_rate?: number
          commission_until?: string | null
          created_at?: string
          id?: string
          note?: string | null
          referred_email?: string | null
          referred_user_id?: string | null
          referrer_code: string
          referrer_user_id?: string | null
          reward_amount?: number
          reward_type?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          commission_rate?: number
          commission_until?: string | null
          created_at?: string
          id?: string
          note?: string | null
          referred_email?: string | null
          referred_user_id?: string | null
          referrer_code?: string
          referrer_user_id?: string | null
          reward_amount?: number
          reward_type?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      shared_files: {
        Row: {
          created_at: string
          download_count: number
          expires_at: string | null
          filename: string
          has_password: boolean | null
          id: string
          max_downloads: number | null
          mime_type: string | null
          owner_id: string
          password_hash: string | null
          password_salt: string | null
          recipient_email: string | null
          revoked: boolean
          share_token: string
          size_bytes: number
          storage_path: string
          tier: string
          view_only: boolean
        }
        Insert: {
          created_at?: string
          download_count?: number
          expires_at?: string | null
          filename: string
          has_password?: boolean | null
          id?: string
          max_downloads?: number | null
          mime_type?: string | null
          owner_id: string
          password_hash?: string | null
          password_salt?: string | null
          recipient_email?: string | null
          revoked?: boolean
          share_token: string
          size_bytes: number
          storage_path: string
          tier?: string
          view_only?: boolean
        }
        Update: {
          created_at?: string
          download_count?: number
          expires_at?: string | null
          filename?: string
          has_password?: boolean | null
          id?: string
          max_downloads?: number | null
          mime_type?: string | null
          owner_id?: string
          password_hash?: string | null
          password_salt?: string | null
          recipient_email?: string | null
          revoked?: boolean
          share_token?: string
          size_bytes?: number
          storage_path?: string
          tier?: string
          view_only?: boolean
        }
        Relationships: []
      }
      site_config: {
        Row: {
          extra_origins: string[]
          id: boolean
          oracle_bucket: string | null
          oracle_capacity_gb: number | null
          oracle_fingerprint: string | null
          oracle_namespace: string | null
          oracle_private_key: string | null
          oracle_private_key_set: boolean
          oracle_region: string | null
          oracle_tenancy_ocid: string | null
          oracle_user_ocid: string | null
          primary_domain: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          extra_origins?: string[]
          id?: boolean
          oracle_bucket?: string | null
          oracle_capacity_gb?: number | null
          oracle_fingerprint?: string | null
          oracle_namespace?: string | null
          oracle_private_key?: string | null
          oracle_private_key_set?: boolean
          oracle_region?: string | null
          oracle_tenancy_ocid?: string | null
          oracle_user_ocid?: string | null
          primary_domain?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          extra_origins?: string[]
          id?: boolean
          oracle_bucket?: string | null
          oracle_capacity_gb?: number | null
          oracle_fingerprint?: string | null
          oracle_namespace?: string | null
          oracle_private_key?: string | null
          oracle_private_key_set?: boolean
          oracle_region?: string | null
          oracle_tenancy_ocid?: string | null
          oracle_user_ocid?: string | null
          primary_domain?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      storage_topups: {
        Row: {
          amount_inr: number
          created_at: string
          id: string
          notes: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          status: string
          tb_added: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_inr?: number
          created_at?: string
          id?: string
          notes?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          status?: string
          tb_added?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_inr?: number
          created_at?: string
          id?: string
          notes?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          status?: string
          tb_added?: number
          updated_at?: string
          user_id?: string
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
          gateway: string
          id: string
          price_id: string | null
          product_id: string | null
          razorpay_plan_id: string | null
          razorpay_subscription_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
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
          gateway?: string
          id?: string
          price_id?: string | null
          product_id?: string | null
          razorpay_plan_id?: string | null
          razorpay_subscription_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
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
          gateway?: string
          id?: string
          price_id?: string | null
          product_id?: string | null
          razorpay_plan_id?: string | null
          razorpay_subscription_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      support_requests: {
        Row: {
          admin_reply: string | null
          created_at: string
          id: string
          message: string
          request_type: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_reply?: string | null
          created_at?: string
          id?: string
          message: string
          request_type: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_reply?: string | null
          created_at?: string
          id?: string
          message?: string
          request_type?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          bandwidth_overage_inr_per_gb: number
          bandwidth_quota_gb: number
          bandwidth_used_mb: number
          created_at: string
          display_name: string | null
          first_name: string | null
          is_suspended: boolean
          last_name: string | null
          onboarding_step: string
          personal_logo_url: string | null
          plan_tier: string
          professional_role: string | null
          storage_used_mb: number
          studio_name: string | null
          studio_slug: Database["public"]["Enums"]["studio_slug"]
          topup_tb: number
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          bandwidth_overage_inr_per_gb?: number
          bandwidth_quota_gb?: number
          bandwidth_used_mb?: number
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          is_suspended?: boolean
          last_name?: string | null
          onboarding_step?: string
          personal_logo_url?: string | null
          plan_tier?: string
          professional_role?: string | null
          storage_used_mb?: number
          studio_name?: string | null
          studio_slug?: Database["public"]["Enums"]["studio_slug"]
          topup_tb?: number
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          bandwidth_overage_inr_per_gb?: number
          bandwidth_quota_gb?: number
          bandwidth_used_mb?: number
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          is_suspended?: boolean
          last_name?: string | null
          onboarding_step?: string
          personal_logo_url?: string | null
          plan_tier?: string
          professional_role?: string | null
          storage_used_mb?: number
          studio_name?: string | null
          studio_slug?: Database["public"]["Enums"]["studio_slug"]
          topup_tb?: number
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
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
      admin_exists: { Args: never; Returns: boolean }
      attach_referral: {
        Args: { _code: string; _email?: string }
        Returns: string
      }
      claim_admin_if_none: { Args: never; Returns: boolean }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      grant_creator_role: { Args: { _user_id: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_producer_of: {
        Args: { _creator: string; _ep: string }
        Returns: boolean
      }
      mfi_seats_taken: { Args: never; Returns: number }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      primary_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      revoke_creator_role: { Args: { _user_id: string }; Returns: undefined }
    }
    Enums: {
      admin_division: "ops" | "finance" | "dev" | "marketing"
      app_role:
        | "admin"
        | "moderator"
        | "user"
        | "executive_producer"
        | "creator"
        | "client"
      studio_slug:
        | "crayons_pictures"
        | "abhijith_asokan_productions"
        | "independent"
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
      admin_division: ["ops", "finance", "dev", "marketing"],
      app_role: [
        "admin",
        "moderator",
        "user",
        "executive_producer",
        "creator",
        "client",
      ],
      studio_slug: [
        "crayons_pictures",
        "abhijith_asokan_productions",
        "independent",
      ],
    },
  },
} as const
