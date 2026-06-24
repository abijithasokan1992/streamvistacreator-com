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
      acquisition_requests: {
        Row: {
          buyer_user_id: string
          counter_amount: number | null
          counter_terms: Json | null
          created_at: string
          id: string
          message: string | null
          offer_amount: number | null
          offer_currency: string | null
          owner_user_id: string
          responded_at: string | null
          responded_by: string | null
          rights: Json
          status: Database["public"]["Enums"]["acquisition_status"]
          territories: string[]
          title_id: string
          updated_at: string
        }
        Insert: {
          buyer_user_id: string
          counter_amount?: number | null
          counter_terms?: Json | null
          created_at?: string
          id?: string
          message?: string | null
          offer_amount?: number | null
          offer_currency?: string | null
          owner_user_id: string
          responded_at?: string | null
          responded_by?: string | null
          rights?: Json
          status?: Database["public"]["Enums"]["acquisition_status"]
          territories?: string[]
          title_id: string
          updated_at?: string
        }
        Update: {
          buyer_user_id?: string
          counter_amount?: number | null
          counter_terms?: Json | null
          created_at?: string
          id?: string
          message?: string | null
          offer_amount?: number | null
          offer_currency?: string | null
          owner_user_id?: string
          responded_at?: string | null
          responded_by?: string | null
          rights?: Json
          status?: Database["public"]["Enums"]["acquisition_status"]
          territories?: string[]
          title_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "acquisition_requests_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "content_titles"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_zones: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          image_url: string | null
          is_active: boolean
          link_url: string | null
          slot: string
          sort_order: number
          starts_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          slot: string
          sort_order?: number
          starts_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          slot?: string
          sort_order?: number
          starts_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
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
      admin_settings: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      admin_staff_permissions: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          permission: Database["public"]["Enums"]["internal_permission"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          permission: Database["public"]["Enums"]["internal_permission"]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          permission?: Database["public"]["Enums"]["internal_permission"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_staff_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_staff_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      admin_staff_profiles: {
        Row: {
          created_at: string
          created_by: string | null
          department: Database["public"]["Enums"]["internal_department"]
          designation: Database["public"]["Enums"]["internal_designation"]
          email: string
          full_name: string
          notes: string | null
          status: Database["public"]["Enums"]["internal_staff_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department: Database["public"]["Enums"]["internal_department"]
          designation: Database["public"]["Enums"]["internal_designation"]
          email: string
          full_name: string
          notes?: string | null
          status?: Database["public"]["Enums"]["internal_staff_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department?: Database["public"]["Enums"]["internal_department"]
          designation?: Database["public"]["Enums"]["internal_designation"]
          email?: string
          full_name?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["internal_staff_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      advertisements: {
        Row: {
          ad_type: string | null
          carousel_fee: number | null
          contact_number: string | null
          created_at: string | null
          duration_seconds: number | null
          id: string
          media_url: string | null
          organization_id: string | null
          price: number | null
          promote_to_carousel: boolean | null
          status: string | null
          title: string
          website_url: string | null
        }
        Insert: {
          ad_type?: string | null
          carousel_fee?: number | null
          contact_number?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          media_url?: string | null
          organization_id?: string | null
          price?: number | null
          promote_to_carousel?: boolean | null
          status?: string | null
          title: string
          website_url?: string | null
        }
        Update: {
          ad_type?: string | null
          carousel_fee?: number | null
          contact_number?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          media_url?: string | null
          organization_id?: string | null
          price?: number | null
          promote_to_carousel?: boolean | null
          status?: string | null
          title?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "advertisements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_events: {
        Row: {
          agent: Database["public"]["Enums"]["agent_surface"]
          created_at: string
          created_by: string | null
          id: string
          payload: Json
          severity: Database["public"]["Enums"]["agent_severity"]
          summary: string | null
          title: string
        }
        Insert: {
          agent: Database["public"]["Enums"]["agent_surface"]
          created_at?: string
          created_by?: string | null
          id?: string
          payload?: Json
          severity?: Database["public"]["Enums"]["agent_severity"]
          summary?: string | null
          title: string
        }
        Update: {
          agent?: Database["public"]["Enums"]["agent_surface"]
          created_at?: string
          created_by?: string | null
          id?: string
          payload?: Json
          severity?: Database["public"]["Enums"]["agent_severity"]
          summary?: string | null
          title?: string
        }
        Relationships: []
      }
      agent_reports: {
        Row: {
          audio_base64: string | null
          body: string
          created_at: string
          event_window_end: string | null
          event_window_start: string | null
          generated_by: string | null
          id: string
          title: string
        }
        Insert: {
          audio_base64?: string | null
          body: string
          created_at?: string
          event_window_end?: string | null
          event_window_start?: string | null
          generated_by?: string | null
          id?: string
          title: string
        }
        Update: {
          audio_base64?: string | null
          body?: string
          created_at?: string
          event_window_end?: string | null
          event_window_start?: string | null
          generated_by?: string | null
          id?: string
          title?: string
        }
        Relationships: []
      }
      alumni: {
        Row: {
          converted_at: string | null
          id: string
          member_id: string | null
          notes: string | null
          organization_id: string | null
        }
        Insert: {
          converted_at?: string | null
          id?: string
          member_id?: string | null
          notes?: string | null
          organization_id?: string | null
        }
        Update: {
          converted_at?: string | null
          id?: string
          member_id?: string | null
          notes?: string | null
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alumni_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alumni_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          active: boolean | null
          created_at: string | null
          created_by: string | null
          id: string
          key_hash: string | null
          key_name: string | null
          workspace_id: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          key_hash?: string | null
          key_name?: string | null
          workspace_id?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          key_hash?: string | null
          key_name?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      archive_jobs: {
        Row: {
          asset_id: string | null
          checksum_algo: string
          checksum_value: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          metadata: Json
          progress_percent: number
          requested_by: string
          source_tier: string
          started_at: string | null
          status: string
          target_location: string | null
          target_tier: string
          total_bytes: number
          transferred_bytes: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          asset_id?: string | null
          checksum_algo?: string
          checksum_value?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json
          progress_percent?: number
          requested_by: string
          source_tier?: string
          started_at?: string | null
          status?: string
          target_location?: string | null
          target_tier?: string
          total_bytes?: number
          transferred_bytes?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          asset_id?: string | null
          checksum_algo?: string
          checksum_value?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json
          progress_percent?: number
          requested_by?: string
          source_tier?: string
          started_at?: string | null
          status?: string
          target_location?: string | null
          target_tier?: string
          total_bytes?: number
          transferred_bytes?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "archive_jobs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "studio_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archive_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_metadata: {
        Row: {
          asset_id: string | null
          camera_make: string | null
          camera_model: string | null
          codec: string | null
          created_at: string | null
          fps: number | null
          id: string
          lens: string | null
          location: string | null
          metadata: Json | null
          resolution: string | null
          shoot_date: string | null
        }
        Insert: {
          asset_id?: string | null
          camera_make?: string | null
          camera_model?: string | null
          codec?: string | null
          created_at?: string | null
          fps?: number | null
          id?: string
          lens?: string | null
          location?: string | null
          metadata?: Json | null
          resolution?: string | null
          shoot_date?: string | null
        }
        Update: {
          asset_id?: string | null
          camera_make?: string | null
          camera_model?: string | null
          codec?: string | null
          created_at?: string | null
          fps?: number | null
          id?: string
          lens?: string | null
          location?: string | null
          metadata?: Json | null
          resolution?: string | null
          shoot_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_metadata_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_versions: {
        Row: {
          asset_id: string | null
          checksum: string | null
          created_at: string | null
          created_by: string | null
          file_url: string | null
          id: string
          version_number: number
        }
        Insert: {
          asset_id?: string | null
          checksum?: string | null
          created_at?: string | null
          created_by?: string | null
          file_url?: string | null
          id?: string
          version_number: number
        }
        Update: {
          asset_id?: string | null
          checksum?: string | null
          created_at?: string | null
          created_by?: string | null
          file_url?: string | null
          id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "asset_versions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          asset_name: string | null
          asset_type: string | null
          checksum: string | null
          created_at: string | null
          file_url: string | null
          id: string
          production_id: string | null
          proxy_url: string | null
          workspace_id: string | null
        }
        Insert: {
          asset_name?: string | null
          asset_type?: string | null
          checksum?: string | null
          created_at?: string | null
          file_url?: string | null
          id?: string
          production_id?: string | null
          proxy_url?: string | null
          workspace_id?: string | null
        }
        Update: {
          asset_name?: string | null
          asset_type?: string | null
          checksum?: string | null
          created_at?: string | null
          file_url?: string | null
          id?: string
          production_id?: string | null
          proxy_url?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_production_id_fkey"
            columns: ["production_id"]
            isOneToOne: false
            referencedRelation: "productions"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_apps: {
        Row: {
          app_key: string
          created_at: string
          description: string | null
          display_name: string
          is_active: boolean
        }
        Insert: {
          app_key: string
          created_at?: string
          description?: string | null
          display_name: string
          is_active?: boolean
        }
        Update: {
          app_key?: string
          created_at?: string
          description?: string | null
          display_name?: string
          is_active?: boolean
        }
        Relationships: []
      }
      billing_config: {
        Row: {
          api_rate_paise_per_1k: number
          auto_charge_enabled: boolean
          bandwidth_rate_paise_per_gb: number
          creator_basic_archive_after_days: number
          creator_tier_tb: number
          egress_free_gb: number
          egress_overage_rate_paise_per_gb: number
          free_tier_gb: number
          id: number
          idle_flag_days: number
          idle_freeze_days: number
          storage_rate_paise_per_gb: number
          updated_at: string
        }
        Insert: {
          api_rate_paise_per_1k?: number
          auto_charge_enabled?: boolean
          bandwidth_rate_paise_per_gb?: number
          creator_basic_archive_after_days?: number
          creator_tier_tb?: number
          egress_free_gb?: number
          egress_overage_rate_paise_per_gb?: number
          free_tier_gb?: number
          id?: number
          idle_flag_days?: number
          idle_freeze_days?: number
          storage_rate_paise_per_gb?: number
          updated_at?: string
        }
        Update: {
          api_rate_paise_per_1k?: number
          auto_charge_enabled?: boolean
          bandwidth_rate_paise_per_gb?: number
          creator_basic_archive_after_days?: number
          creator_tier_tb?: number
          egress_free_gb?: number
          egress_overage_rate_paise_per_gb?: number
          free_tier_gb?: number
          id?: number
          idle_flag_days?: number
          idle_freeze_days?: number
          storage_rate_paise_per_gb?: number
          updated_at?: string
        }
        Relationships: []
      }
      billing_ledger_events: {
        Row: {
          actor_user_id: string | null
          billing_order_id: string
          created_at: string
          event_type: string
          id: string
          payload: Json
        }
        Insert: {
          actor_user_id?: string | null
          billing_order_id: string
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
        }
        Update: {
          actor_user_id?: string | null
          billing_order_id?: string
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "billing_ledger_events_billing_order_id_fkey"
            columns: ["billing_order_id"]
            isOneToOne: false
            referencedRelation: "billing_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_manual_payment_submissions: {
        Row: {
          amount_paid_paise: number
          bank_name: string | null
          billing_order_id: string
          created_at: string
          currency: string
          id: string
          paid_at: string | null
          payer_email: string | null
          payer_name: string | null
          payer_phone: string | null
          payment_channel: string
          proof_file_path: string | null
          remarks: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["billing_manual_status"]
          submitted_by_user_id: string | null
          updated_at: string
          utr_or_reference: string | null
        }
        Insert: {
          amount_paid_paise: number
          bank_name?: string | null
          billing_order_id: string
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          payer_email?: string | null
          payer_name?: string | null
          payer_phone?: string | null
          payment_channel: string
          proof_file_path?: string | null
          remarks?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["billing_manual_status"]
          submitted_by_user_id?: string | null
          updated_at?: string
          utr_or_reference?: string | null
        }
        Update: {
          amount_paid_paise?: number
          bank_name?: string | null
          billing_order_id?: string
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          payer_email?: string | null
          payer_name?: string | null
          payer_phone?: string | null
          payment_channel?: string
          proof_file_path?: string | null
          remarks?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["billing_manual_status"]
          submitted_by_user_id?: string | null
          updated_at?: string
          utr_or_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_manual_payment_submissions_billing_order_id_fkey"
            columns: ["billing_order_id"]
            isOneToOne: false
            referencedRelation: "billing_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_orders: {
        Row: {
          amount_subtotal_paise: number
          amount_tax_paise: number
          amount_total_paise: number
          app_key: string
          created_at: string
          created_by: string | null
          currency: string
          customer_org_id: string | null
          customer_user_id: string | null
          id: string
          invoice_id: string | null
          metadata: Json
          notes: string | null
          payment_method_mode: Database["public"]["Enums"]["billing_payment_rail"]
          payment_trace_id: string | null
          product_id: string | null
          source_ref_id: string | null
          source_type: string
          status: Database["public"]["Enums"]["billing_order_status"]
          updated_at: string
        }
        Insert: {
          amount_subtotal_paise?: number
          amount_tax_paise?: number
          amount_total_paise?: number
          app_key: string
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_org_id?: string | null
          customer_user_id?: string | null
          id?: string
          invoice_id?: string | null
          metadata?: Json
          notes?: string | null
          payment_method_mode?: Database["public"]["Enums"]["billing_payment_rail"]
          payment_trace_id?: string | null
          product_id?: string | null
          source_ref_id?: string | null
          source_type: string
          status?: Database["public"]["Enums"]["billing_order_status"]
          updated_at?: string
        }
        Update: {
          amount_subtotal_paise?: number
          amount_tax_paise?: number
          amount_total_paise?: number
          app_key?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_org_id?: string | null
          customer_user_id?: string | null
          id?: string
          invoice_id?: string | null
          metadata?: Json
          notes?: string | null
          payment_method_mode?: Database["public"]["Enums"]["billing_payment_rail"]
          payment_trace_id?: string | null
          product_id?: string | null
          source_ref_id?: string | null
          source_type?: string
          status?: Database["public"]["Enums"]["billing_order_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_orders_app_key_fkey"
            columns: ["app_key"]
            isOneToOne: false
            referencedRelation: "billing_apps"
            referencedColumns: ["app_key"]
          },
          {
            foreignKeyName: "billing_orders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_orders_payment_trace_id_fkey"
            columns: ["payment_trace_id"]
            isOneToOne: false
            referencedRelation: "payment_traces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "billing_products"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_payment_attempts: {
        Row: {
          amount_paise: number
          billing_order_id: string
          created_at: string
          currency: string
          failure_reason: string | null
          gateway_response: Json
          id: string
          rail: Database["public"]["Enums"]["billing_payment_rail"]
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature_valid: boolean | null
          status: Database["public"]["Enums"]["billing_attempt_status"]
          updated_at: string
          utr_or_reference: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount_paise?: number
          billing_order_id: string
          created_at?: string
          currency?: string
          failure_reason?: string | null
          gateway_response?: Json
          id?: string
          rail: Database["public"]["Enums"]["billing_payment_rail"]
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature_valid?: boolean | null
          status?: Database["public"]["Enums"]["billing_attempt_status"]
          updated_at?: string
          utr_or_reference?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount_paise?: number
          billing_order_id?: string
          created_at?: string
          currency?: string
          failure_reason?: string | null
          gateway_response?: Json
          id?: string
          rail?: Database["public"]["Enums"]["billing_payment_rail"]
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature_valid?: boolean | null
          status?: Database["public"]["Enums"]["billing_attempt_status"]
          updated_at?: string
          utr_or_reference?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_payment_attempts_billing_order_id_fkey"
            columns: ["billing_order_id"]
            isOneToOne: false
            referencedRelation: "billing_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_payment_method_configs: {
        Row: {
          account_number: string | null
          bank_name: string | null
          beneficiary_name: string | null
          branch: string | null
          created_at: string
          created_by: string | null
          display_name: string
          id: string
          ifsc: string | null
          instructions: string | null
          is_enabled: boolean
          metadata: Json
          qr_image_path: string | null
          rail: Database["public"]["Enums"]["billing_payment_rail"]
          scope_app_key: string | null
          scope_product_types: string[]
          support_contact: string | null
          updated_at: string
          upi_id: string | null
        }
        Insert: {
          account_number?: string | null
          bank_name?: string | null
          beneficiary_name?: string | null
          branch?: string | null
          created_at?: string
          created_by?: string | null
          display_name: string
          id?: string
          ifsc?: string | null
          instructions?: string | null
          is_enabled?: boolean
          metadata?: Json
          qr_image_path?: string | null
          rail: Database["public"]["Enums"]["billing_payment_rail"]
          scope_app_key?: string | null
          scope_product_types?: string[]
          support_contact?: string | null
          updated_at?: string
          upi_id?: string | null
        }
        Update: {
          account_number?: string | null
          bank_name?: string | null
          beneficiary_name?: string | null
          branch?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string
          id?: string
          ifsc?: string | null
          instructions?: string | null
          is_enabled?: boolean
          metadata?: Json
          qr_image_path?: string | null
          rail?: Database["public"]["Enums"]["billing_payment_rail"]
          scope_app_key?: string | null
          scope_product_types?: string[]
          support_contact?: string | null
          updated_at?: string
          upi_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_payment_method_configs_scope_app_key_fkey"
            columns: ["scope_app_key"]
            isOneToOne: false
            referencedRelation: "billing_apps"
            referencedColumns: ["app_key"]
          },
        ]
      }
      billing_price_versions: {
        Row: {
          amount_paise: number
          created_at: string
          currency: string
          effective_from: string
          id: string
          notes: string | null
          product_id: string
          tax_rate: number
          version: number
        }
        Insert: {
          amount_paise: number
          created_at?: string
          currency?: string
          effective_from?: string
          id?: string
          notes?: string | null
          product_id: string
          tax_rate?: number
          version: number
        }
        Update: {
          amount_paise?: number
          created_at?: string
          currency?: string
          effective_from?: string
          id?: string
          notes?: string | null
          product_id?: string
          tax_rate?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "billing_price_versions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "billing_products"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_products: {
        Row: {
          app_key: string
          base_amount_paise: number
          billing_mode: string
          created_at: string
          currency: string
          description: string | null
          id: string
          is_active: boolean
          is_self_serve: boolean
          metadata: Json
          name: string
          product_key: string
          product_type: string
          target_actor: string
          tax_mode: string
          tax_rate: number
          updated_at: string
        }
        Insert: {
          app_key: string
          base_amount_paise?: number
          billing_mode?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_self_serve?: boolean
          metadata?: Json
          name: string
          product_key: string
          product_type: string
          target_actor?: string
          tax_mode?: string
          tax_rate?: number
          updated_at?: string
        }
        Update: {
          app_key?: string
          base_amount_paise?: number
          billing_mode?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_self_serve?: boolean
          metadata?: Json
          name?: string
          product_key?: string
          product_type?: string
          target_actor?: string
          tax_mode?: string
          tax_rate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_products_app_key_fkey"
            columns: ["app_key"]
            isOneToOne: false
            referencedRelation: "billing_apps"
            referencedColumns: ["app_key"]
          },
        ]
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
      carousel_slides: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_published: boolean | null
          media_type: string | null
          media_url: string | null
          organization_id: string | null
          title: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_published?: boolean | null
          media_type?: string | null
          media_url?: string | null
          organization_id?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_published?: boolean | null
          media_type?: string | null
          media_url?: string | null
          organization_id?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carousel_slides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_overrides: {
        Row: {
          checklist_key: string
          created_at: string
          id: string
          note: string | null
          project_id: string | null
          set_by: string | null
          set_by_email: string | null
          state: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          checklist_key: string
          created_at?: string
          id?: string
          note?: string | null
          project_id?: string | null
          set_by?: string | null
          set_by_email?: string | null
          state: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          checklist_key?: string
          created_at?: string
          id?: string
          note?: string | null
          project_id?: string | null
          set_by?: string | null
          set_by_email?: string | null
          state?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_overrides_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_overrides_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          id: string
          manual_invoice_id: string | null
          subject_user_id: string | null
          support_request_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          manual_invoice_id?: string | null
          subject_user_id?: string | null
          support_request_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          manual_invoice_id?: string | null
          subject_user_id?: string | null
          support_request_id?: string | null
        }
        Relationships: []
      }
      commercial_request_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          from_state:
            | Database["public"]["Enums"]["commercial_request_state"]
            | null
          id: string
          note: string | null
          request_id: string
          to_state: Database["public"]["Enums"]["commercial_request_state"]
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          from_state?:
            | Database["public"]["Enums"]["commercial_request_state"]
            | null
          id?: string
          note?: string | null
          request_id: string
          to_state: Database["public"]["Enums"]["commercial_request_state"]
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          from_state?:
            | Database["public"]["Enums"]["commercial_request_state"]
            | null
          id?: string
          note?: string | null
          request_id?: string
          to_state?: Database["public"]["Enums"]["commercial_request_state"]
        }
        Relationships: [
          {
            foreignKeyName: "commercial_request_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "commercial_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_requests: {
        Row: {
          accepted_agreement_id: string | null
          admin_notes: string | null
          assigned_admin_id: string | null
          buyer_user_id: string
          created_at: string
          id: string
          interest_summary: string | null
          message: string | null
          owner_user_id: string | null
          request_type: Database["public"]["Enums"]["commercial_request_type"]
          state: Database["public"]["Enums"]["commercial_request_state"]
          state_changed_at: string
          state_changed_by: string | null
          terms: Json
          title_id: string | null
          title_query: string | null
          updated_at: string
        }
        Insert: {
          accepted_agreement_id?: string | null
          admin_notes?: string | null
          assigned_admin_id?: string | null
          buyer_user_id: string
          created_at?: string
          id?: string
          interest_summary?: string | null
          message?: string | null
          owner_user_id?: string | null
          request_type: Database["public"]["Enums"]["commercial_request_type"]
          state?: Database["public"]["Enums"]["commercial_request_state"]
          state_changed_at?: string
          state_changed_by?: string | null
          terms?: Json
          title_id?: string | null
          title_query?: string | null
          updated_at?: string
        }
        Update: {
          accepted_agreement_id?: string | null
          admin_notes?: string | null
          assigned_admin_id?: string | null
          buyer_user_id?: string
          created_at?: string
          id?: string
          interest_summary?: string | null
          message?: string | null
          owner_user_id?: string | null
          request_type?: Database["public"]["Enums"]["commercial_request_type"]
          state?: Database["public"]["Enums"]["commercial_request_state"]
          state_changed_at?: string
          state_changed_by?: string | null
          terms?: Json
          title_id?: string | null
          title_query?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_requests_accepted_agreement_id_fkey"
            columns: ["accepted_agreement_id"]
            isOneToOne: false
            referencedRelation: "legal_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_requests_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "content_titles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_profile: {
        Row: {
          brands: Json
          created_at: string
          ecosystem_thesis: string
          founder_bio: string
          founder_image_alt: string | null
          founder_image_url: string | null
          founder_name: string
          founder_role_line: string
          id: string
          parent_company_description: string
          parent_company_name: string
          updated_at: string
          visibility: Json
        }
        Insert: {
          brands?: Json
          created_at?: string
          ecosystem_thesis?: string
          founder_bio?: string
          founder_image_alt?: string | null
          founder_image_url?: string | null
          founder_name?: string
          founder_role_line?: string
          id?: string
          parent_company_description?: string
          parent_company_name?: string
          updated_at?: string
          visibility?: Json
        }
        Update: {
          brands?: Json
          created_at?: string
          ecosystem_thesis?: string
          founder_bio?: string
          founder_image_alt?: string | null
          founder_image_url?: string | null
          founder_name?: string
          founder_role_line?: string
          id?: string
          parent_company_description?: string
          parent_company_name?: string
          updated_at?: string
          visibility?: Json
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          company: string | null
          created_at: string
          email: string
          id: string
          message: string
          name: string
          role: string | null
          source: string | null
          status: string
          updated_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          role?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          role?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      content_approvals: {
        Row: {
          actor_user_id: string
          created_at: string
          from_status: Database["public"]["Enums"]["content_status"] | null
          id: string
          note: string | null
          title_id: string
          to_status: Database["public"]["Enums"]["content_status"]
        }
        Insert: {
          actor_user_id: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["content_status"] | null
          id?: string
          note?: string | null
          title_id: string
          to_status: Database["public"]["Enums"]["content_status"]
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["content_status"] | null
          id?: string
          note?: string | null
          title_id?: string
          to_status?: Database["public"]["Enums"]["content_status"]
        }
        Relationships: [
          {
            foreignKeyName: "content_approvals_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "content_titles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_titles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          duration_minutes: number | null
          genre: string | null
          id: string
          language: string | null
          locked: boolean
          locked_at: string | null
          locked_by: string | null
          metadata: Json
          owner_user_id: string
          previous_status: Database["public"]["Enums"]["content_status"] | null
          published_at: string | null
          requested_from_stage: string | null
          status: Database["public"]["Enums"]["content_status"]
          submitted_at: string | null
          synopsis: string | null
          title: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          duration_minutes?: number | null
          genre?: string | null
          id?: string
          language?: string | null
          locked?: boolean
          locked_at?: string | null
          locked_by?: string | null
          metadata?: Json
          owner_user_id: string
          previous_status?: Database["public"]["Enums"]["content_status"] | null
          published_at?: string | null
          requested_from_stage?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          submitted_at?: string | null
          synopsis?: string | null
          title: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          duration_minutes?: number | null
          genre?: string | null
          id?: string
          language?: string | null
          locked?: boolean
          locked_at?: string | null
          locked_by?: string | null
          metadata?: Json
          owner_user_id?: string
          previous_status?: Database["public"]["Enums"]["content_status"] | null
          published_at?: string | null
          requested_from_stage?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          submitted_at?: string | null
          synopsis?: string | null
          title?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      deal_deliveries: {
        Row: {
          asset_refs: Json
          buyer_org_name: string | null
          buyer_user_id: string | null
          created_at: string
          created_by: string | null
          deal_memo_id: string
          delivered_at: string | null
          expires_at: string | null
          id: string
          internal_notes: string | null
          method: string
          package_notes: string | null
          recipient_email: string | null
          share_url: string | null
          shared_at: string | null
          status: string
          title_id: string | null
          updated_at: string
        }
        Insert: {
          asset_refs?: Json
          buyer_org_name?: string | null
          buyer_user_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_memo_id: string
          delivered_at?: string | null
          expires_at?: string | null
          id?: string
          internal_notes?: string | null
          method?: string
          package_notes?: string | null
          recipient_email?: string | null
          share_url?: string | null
          shared_at?: string | null
          status?: string
          title_id?: string | null
          updated_at?: string
        }
        Update: {
          asset_refs?: Json
          buyer_org_name?: string | null
          buyer_user_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_memo_id?: string
          delivered_at?: string | null
          expires_at?: string | null
          id?: string
          internal_notes?: string | null
          method?: string
          package_notes?: string | null
          recipient_email?: string | null
          share_url?: string | null
          shared_at?: string | null
          status?: string
          title_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_deliveries_deal_memo_id_fkey"
            columns: ["deal_memo_id"]
            isOneToOne: false
            referencedRelation: "deal_memos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_deliveries_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "content_titles"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_memos: {
        Row: {
          amount_paise: number | null
          approval_notes: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          buyer_contact_email: string | null
          buyer_facing_memo: string | null
          buyer_org_name: string | null
          buyer_user_id: string | null
          close_outcome: string | null
          close_reason: string | null
          closed_at: string | null
          closed_by: string | null
          commercial_request_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          deal_type: Database["public"]["Enums"]["deal_type"]
          delivered_at: string | null
          delivery_notes: string | null
          delivery_status: string
          exclusivity: Database["public"]["Enums"]["right_exclusivity"] | null
          id: string
          internal_notes: string | null
          language: string | null
          memo_number: string
          ops_stage: string
          owner_admin_id: string | null
          owner_share_paise: number | null
          owner_share_pct: number | null
          paid_amount_paise: number
          paid_at: string | null
          payment_mode: string | null
          payment_notes: string | null
          payment_reference: string | null
          payment_status: string
          payment_terms: string | null
          platform_share_paise: number | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          right_category: Database["public"]["Enums"]["right_category"] | null
          status: Database["public"]["Enums"]["deal_status"]
          term_end: string | null
          term_start: string | null
          territory: string | null
          title_id: string
          updated_at: string
        }
        Insert: {
          amount_paise?: number | null
          approval_notes?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          buyer_contact_email?: string | null
          buyer_facing_memo?: string | null
          buyer_org_name?: string | null
          buyer_user_id?: string | null
          close_outcome?: string | null
          close_reason?: string | null
          closed_at?: string | null
          closed_by?: string | null
          commercial_request_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_type: Database["public"]["Enums"]["deal_type"]
          delivered_at?: string | null
          delivery_notes?: string | null
          delivery_status?: string
          exclusivity?: Database["public"]["Enums"]["right_exclusivity"] | null
          id?: string
          internal_notes?: string | null
          language?: string | null
          memo_number?: string
          ops_stage?: string
          owner_admin_id?: string | null
          owner_share_paise?: number | null
          owner_share_pct?: number | null
          paid_amount_paise?: number
          paid_at?: string | null
          payment_mode?: string | null
          payment_notes?: string | null
          payment_reference?: string | null
          payment_status?: string
          payment_terms?: string | null
          platform_share_paise?: number | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          right_category?: Database["public"]["Enums"]["right_category"] | null
          status?: Database["public"]["Enums"]["deal_status"]
          term_end?: string | null
          term_start?: string | null
          territory?: string | null
          title_id: string
          updated_at?: string
        }
        Update: {
          amount_paise?: number | null
          approval_notes?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          buyer_contact_email?: string | null
          buyer_facing_memo?: string | null
          buyer_org_name?: string | null
          buyer_user_id?: string | null
          close_outcome?: string | null
          close_reason?: string | null
          closed_at?: string | null
          closed_by?: string | null
          commercial_request_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_type?: Database["public"]["Enums"]["deal_type"]
          delivered_at?: string | null
          delivery_notes?: string | null
          delivery_status?: string
          exclusivity?: Database["public"]["Enums"]["right_exclusivity"] | null
          id?: string
          internal_notes?: string | null
          language?: string | null
          memo_number?: string
          ops_stage?: string
          owner_admin_id?: string | null
          owner_share_paise?: number | null
          owner_share_pct?: number | null
          paid_amount_paise?: number
          paid_at?: string | null
          payment_mode?: string | null
          payment_notes?: string | null
          payment_reference?: string | null
          payment_status?: string
          payment_terms?: string | null
          platform_share_paise?: number | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          right_category?: Database["public"]["Enums"]["right_category"] | null
          status?: Database["public"]["Enums"]["deal_status"]
          term_end?: string | null
          term_start?: string | null
          territory?: string | null
          title_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_memos_commercial_request_id_fkey"
            columns: ["commercial_request_id"]
            isOneToOne: false
            referencedRelation: "commercial_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_memos_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "content_titles"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_ops_events: {
        Row: {
          actor_user_id: string | null
          deal_memo_id: string
          id: string
          kind: string
          metadata: Json
          occurred_at: string
          summary: string | null
        }
        Insert: {
          actor_user_id?: string | null
          deal_memo_id: string
          id?: string
          kind: string
          metadata?: Json
          occurred_at?: string
          summary?: string | null
        }
        Update: {
          actor_user_id?: string | null
          deal_memo_id?: string
          id?: string
          kind?: string
          metadata?: Json
          occurred_at?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_ops_events_deal_memo_id_fkey"
            columns: ["deal_memo_id"]
            isOneToOne: false
            referencedRelation: "deal_memos"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_payouts: {
        Row: {
          basis: string
          beneficiary_email: string | null
          beneficiary_label: string | null
          beneficiary_type: string
          beneficiary_user_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          deal_memo_id: string
          gross_amount_paise: number
          id: string
          internal_notes: string | null
          paid_at: string | null
          payment_reference: string | null
          payout_amount_paise: number
          platform_share_paise: number
          share_pct: number | null
          status: string
          title_id: string | null
          updated_at: string
        }
        Insert: {
          basis?: string
          beneficiary_email?: string | null
          beneficiary_label?: string | null
          beneficiary_type?: string
          beneficiary_user_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_memo_id: string
          gross_amount_paise?: number
          id?: string
          internal_notes?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          payout_amount_paise?: number
          platform_share_paise?: number
          share_pct?: number | null
          status?: string
          title_id?: string | null
          updated_at?: string
        }
        Update: {
          basis?: string
          beneficiary_email?: string | null
          beneficiary_label?: string | null
          beneficiary_type?: string
          beneficiary_user_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_memo_id?: string
          gross_amount_paise?: number
          id?: string
          internal_notes?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          payout_amount_paise?: number
          platform_share_paise?: number
          share_pct?: number | null
          status?: string
          title_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_payouts_deal_memo_id_fkey"
            columns: ["deal_memo_id"]
            isOneToOne: false
            referencedRelation: "deal_memos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_payouts_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "content_titles"
            referencedColumns: ["id"]
          },
        ]
      }
      deliverables: {
        Row: {
          created_at: string | null
          delivery_date: string | null
          id: string
          notes: string | null
          production_id: string | null
          project_id: string | null
          status: string | null
          title: string | null
        }
        Insert: {
          created_at?: string | null
          delivery_date?: string | null
          id?: string
          notes?: string | null
          production_id?: string | null
          project_id?: string | null
          status?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string | null
          delivery_date?: string | null
          id?: string
          notes?: string | null
          production_id?: string | null
          project_id?: string | null
          status?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliverables_production_id_fkey"
            columns: ["production_id"]
            isOneToOne: false
            referencedRelation: "productions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_program_offers: {
        Row: {
          accepted_at: string | null
          channel_scope_json: Json
          created_at: string
          creator_user_id: string
          id: string
          is_non_exclusive: boolean
          legal_text_snapshot: string | null
          offered_at: string | null
          offered_by_admin: string | null
          platform_share_pct: number
          program_name: string
          rejected_at: string | null
          revenue_model: string
          rights_holder_share_pct: number
          rights_scope_json: Json
          status: Database["public"]["Enums"]["distribution_offer_status"]
          streamvista_share_pct: number
          term_end_date: string | null
          term_start_date: string | null
          term_years: number
          termination_fee_amount: number
          termination_fee_currency: string
          termination_notice_days: number
          territory_scope_json: Json
          title_id: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          channel_scope_json?: Json
          created_at?: string
          creator_user_id: string
          id?: string
          is_non_exclusive?: boolean
          legal_text_snapshot?: string | null
          offered_at?: string | null
          offered_by_admin?: string | null
          platform_share_pct?: number
          program_name?: string
          rejected_at?: string | null
          revenue_model?: string
          rights_holder_share_pct?: number
          rights_scope_json?: Json
          status?: Database["public"]["Enums"]["distribution_offer_status"]
          streamvista_share_pct?: number
          term_end_date?: string | null
          term_start_date?: string | null
          term_years?: number
          termination_fee_amount?: number
          termination_fee_currency?: string
          termination_notice_days?: number
          territory_scope_json?: Json
          title_id?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          channel_scope_json?: Json
          created_at?: string
          creator_user_id?: string
          id?: string
          is_non_exclusive?: boolean
          legal_text_snapshot?: string | null
          offered_at?: string | null
          offered_by_admin?: string | null
          platform_share_pct?: number
          program_name?: string
          rejected_at?: string | null
          revenue_model?: string
          rights_holder_share_pct?: number
          rights_scope_json?: Json
          status?: Database["public"]["Enums"]["distribution_offer_status"]
          streamvista_share_pct?: number
          term_end_date?: string | null
          term_start_date?: string | null
          term_years?: number
          termination_fee_amount?: number
          termination_fee_currency?: string
          termination_notice_days?: number
          territory_scope_json?: Json
          title_id?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "distribution_program_offers_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "content_titles"
            referencedColumns: ["id"]
          },
        ]
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
      fastlink_payments: {
        Row: {
          amount_inr: number
          context: string
          created_at: string
          id: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_inr?: number
          context?: string
          created_at?: string
          id?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_inr?: number
          context?: string
          created_at?: string
          id?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      featured_films: {
        Row: {
          blurb: string | null
          created_at: string
          ends_at: string | null
          id: string
          is_active: boolean
          link_url: string | null
          poster_url: string | null
          sort_order: number
          starts_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          blurb?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          link_url?: string | null
          poster_url?: string | null
          sort_order?: number
          starts_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          blurb?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          link_url?: string | null
          poster_url?: string | null
          sort_order?: number
          starts_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      founder_works: {
        Row: {
          achievement: string | null
          banner: string | null
          created_at: string
          id: string
          role: string | null
          sort_order: number
          synopsis: string | null
          title: string
          updated_at: string
          visible: boolean
          year: string | null
        }
        Insert: {
          achievement?: string | null
          banner?: string | null
          created_at?: string
          id?: string
          role?: string | null
          sort_order?: number
          synopsis?: string | null
          title: string
          updated_at?: string
          visible?: boolean
          year?: string | null
        }
        Update: {
          achievement?: string | null
          banner?: string | null
          created_at?: string
          id?: string
          role?: string | null
          sort_order?: number
          synopsis?: string | null
          title?: string
          updated_at?: string
          visible?: boolean
          year?: string | null
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
      hard_disk_intakes: {
        Row: {
          admin_notes: string | null
          contact_name: string | null
          contact_phone: string | null
          courier_tracking: string | null
          created_at: string
          drive_capacity_gb: number | null
          drive_interface: string | null
          drive_label: string
          drive_serial: string | null
          estimated_content_gb: number | null
          expected_arrival: string | null
          filesystem: string | null
          handoff_method: string
          id: string
          notes: string | null
          pickup_address: string | null
          project_title: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          courier_tracking?: string | null
          created_at?: string
          drive_capacity_gb?: number | null
          drive_interface?: string | null
          drive_label: string
          drive_serial?: string | null
          estimated_content_gb?: number | null
          expected_arrival?: string | null
          filesystem?: string | null
          handoff_method?: string
          id?: string
          notes?: string | null
          pickup_address?: string | null
          project_title?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          courier_tracking?: string | null
          created_at?: string
          drive_capacity_gb?: number | null
          drive_interface?: string | null
          drive_label?: string
          drive_serial?: string | null
          estimated_content_gb?: number | null
          expected_arrival?: string | null
          filesystem?: string | null
          handoff_method?: string
          id?: string
          notes?: string | null
          pickup_address?: string | null
          project_title?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      hero_banners: {
        Row: {
          created_at: string
          cta_label: string | null
          cta_url: string | null
          ends_at: string | null
          headline: string
          id: string
          image_url: string | null
          is_active: boolean
          sort_order: number
          starts_at: string | null
          status: string
          subheadline: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          ends_at?: string | null
          headline: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          sort_order?: number
          starts_at?: string | null
          status?: string
          subheadline?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          ends_at?: string | null
          headline?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          sort_order?: number
          starts_at?: string | null
          status?: string
          subheadline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      homepage_hero_reel: {
        Row: {
          backdrop_url: string | null
          created_at: string
          created_by: string | null
          cta_label: string | null
          cta_url: string | null
          ends_at: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_featured: boolean
          poster_url: string | null
          sort_order: number
          starts_at: string | null
          status: string
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          backdrop_url?: string | null
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          cta_url?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          poster_url?: string | null
          sort_order?: number
          starts_at?: string | null
          status?: string
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          backdrop_url?: string | null
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          cta_url?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          poster_url?: string | null
          sort_order?: number
          starts_at?: string | null
          status?: string
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      ingest_alert_events: {
        Row: {
          channels_attempted: string[]
          delivery_status: Json
          fired_at: string
          id: string
          payload: Json
          rule_id: string
          rule_type: string
          workspace_id: string
        }
        Insert: {
          channels_attempted?: string[]
          delivery_status?: Json
          fired_at?: string
          id?: string
          payload?: Json
          rule_id: string
          rule_type: string
          workspace_id: string
        }
        Update: {
          channels_attempted?: string[]
          delivery_status?: Json
          fired_at?: string
          id?: string
          payload?: Json
          rule_id?: string
          rule_type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingest_alert_events_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "ingest_alert_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingest_alert_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ingest_alert_rules: {
        Row: {
          channels: string[]
          cooldown_minutes: number
          created_at: string
          created_by: string
          enabled: boolean
          id: string
          last_evaluated_at: string | null
          last_fired_at: string | null
          name: string
          recipients: Json
          rule_type: string
          threshold: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          channels?: string[]
          cooldown_minutes?: number
          created_at?: string
          created_by: string
          enabled?: boolean
          id?: string
          last_evaluated_at?: string | null
          last_fired_at?: string | null
          name: string
          recipients?: Json
          rule_type: string
          threshold?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          channels?: string[]
          cooldown_minutes?: number
          created_at?: string
          created_by?: string
          enabled?: boolean
          id?: string
          last_evaluated_at?: string | null
          last_fired_at?: string | null
          name?: string
          recipients?: Json
          rule_type?: string
          threshold?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingest_alert_rules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ingest_job_items: {
        Row: {
          asset_class: string | null
          created_at: string
          error_message: string | null
          file_name: string
          id: string
          job_id: string
          metadata: Json
          mime_guess: string | null
          progress_percent: number
          relative_path: string
          size_bytes: number
          status: string
          updated_at: string
          upload_id: string | null
          upload_session_id: string | null
        }
        Insert: {
          asset_class?: string | null
          created_at?: string
          error_message?: string | null
          file_name: string
          id?: string
          job_id: string
          metadata?: Json
          mime_guess?: string | null
          progress_percent?: number
          relative_path?: string
          size_bytes?: number
          status?: string
          updated_at?: string
          upload_id?: string | null
          upload_session_id?: string | null
        }
        Update: {
          asset_class?: string | null
          created_at?: string
          error_message?: string | null
          file_name?: string
          id?: string
          job_id?: string
          metadata?: Json
          mime_guess?: string | null
          progress_percent?: number
          relative_path?: string
          size_bytes?: number
          status?: string
          updated_at?: string
          upload_id?: string | null
          upload_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ingest_job_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ingest_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingest_job_items_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "recent_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      ingest_jobs: {
        Row: {
          asset_class: string | null
          camera_label: string | null
          completed_at: string | null
          completed_files: number
          created_at: string
          created_by: string
          destination_type: string
          error_message: string | null
          failed_files: number
          id: string
          job_mode: string
          metadata: Json
          notes: string | null
          preserve_structure: boolean
          project_id: string | null
          shoot_day: string | null
          source_id: string | null
          source_summary: Json
          started_at: string | null
          status: string
          title_id: string | null
          total_bytes: number
          total_files: number
          transferred_bytes: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          asset_class?: string | null
          camera_label?: string | null
          completed_at?: string | null
          completed_files?: number
          created_at?: string
          created_by: string
          destination_type?: string
          error_message?: string | null
          failed_files?: number
          id?: string
          job_mode: string
          metadata?: Json
          notes?: string | null
          preserve_structure?: boolean
          project_id?: string | null
          shoot_day?: string | null
          source_id?: string | null
          source_summary?: Json
          started_at?: string | null
          status?: string
          title_id?: string | null
          total_bytes?: number
          total_files?: number
          transferred_bytes?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          asset_class?: string | null
          camera_label?: string | null
          completed_at?: string | null
          completed_files?: number
          created_at?: string
          created_by?: string
          destination_type?: string
          error_message?: string | null
          failed_files?: number
          id?: string
          job_mode?: string
          metadata?: Json
          notes?: string | null
          preserve_structure?: boolean
          project_id?: string | null
          shoot_day?: string | null
          source_id?: string | null
          source_summary?: Json
          started_at?: string | null
          status?: string
          title_id?: string | null
          total_bytes?: number
          total_files?: number
          transferred_bytes?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingest_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingest_jobs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "ingest_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingest_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ingest_sources: {
        Row: {
          agent_device_id: string | null
          created_at: string
          created_by: string
          id: string
          label: string
          metadata: Json
          path_hint: string | null
          source_identifier: string | null
          source_type: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          agent_device_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          label: string
          metadata?: Json
          path_hint?: string | null
          source_identifier?: string | null
          source_type: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          agent_device_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          label?: string
          metadata?: Json
          path_hint?: string | null
          source_identifier?: string | null
          source_type?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingest_sources_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ingest_telemetry: {
        Row: {
          bytes: number | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          event: string
          http_status: number | null
          id: string
          metadata: Json | null
          oci_upload_id: string | null
          part_number: number | null
          session_id: string | null
          severity: string
          user_id: string | null
        }
        Insert: {
          bytes?: number | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          event: string
          http_status?: number | null
          id?: string
          metadata?: Json | null
          oci_upload_id?: string | null
          part_number?: number | null
          session_id?: string | null
          severity?: string
          user_id?: string | null
        }
        Update: {
          bytes?: number | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          event?: string
          http_status?: number | null
          id?: string
          metadata?: Json | null
          oci_upload_id?: string | null
          part_number?: number | null
          session_id?: string | null
          severity?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ingest_telemetry_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "upload_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      intro_invite_secrets: {
        Row: {
          created_at: string
          intro_invite_id: string
          token: string
        }
        Insert: {
          created_at?: string
          intro_invite_id: string
          token: string
        }
        Update: {
          created_at?: string
          intro_invite_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "intro_invite_secrets_intro_invite_id_fkey"
            columns: ["intro_invite_id"]
            isOneToOne: true
            referencedRelation: "intro_invites"
            referencedColumns: ["id"]
          },
        ]
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
          updated_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          billed_to_email: string | null
          billed_to_name: string | null
          created_at: string
          currency: string
          description: string
          gst_paise: number
          gst_percent: number
          id: string
          invoice_number: string
          issued_at: string
          plan_id: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          source: string
          status: string
          subscription_id: string | null
          subtotal_paise: number
          support_request_id: string | null
          topup_id: string | null
          total_paise: number
          updated_at: string
          user_id: string
        }
        Insert: {
          billed_to_email?: string | null
          billed_to_name?: string | null
          created_at?: string
          currency?: string
          description: string
          gst_paise: number
          gst_percent?: number
          id?: string
          invoice_number?: string
          issued_at?: string
          plan_id?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          source: string
          status?: string
          subscription_id?: string | null
          subtotal_paise: number
          support_request_id?: string | null
          topup_id?: string | null
          total_paise: number
          updated_at?: string
          user_id: string
        }
        Update: {
          billed_to_email?: string | null
          billed_to_name?: string | null
          created_at?: string
          currency?: string
          description?: string
          gst_paise?: number
          gst_percent?: number
          id?: string
          invoice_number?: string
          issued_at?: string
          plan_id?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          source?: string
          status?: string
          subscription_id?: string | null
          subtotal_paise?: number
          support_request_id?: string | null
          topup_id?: string | null
          total_paise?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_support_request_id_fkey"
            columns: ["support_request_id"]
            isOneToOne: false
            referencedRelation: "support_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_topup_id_fkey"
            columns: ["topup_id"]
            isOneToOne: false
            referencedRelation: "storage_topups"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_acceptances: {
        Row: {
          accepted_at: string
          agreement_id: string
          agreement_type: Database["public"]["Enums"]["legal_agreement_type"]
          context: Json
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
          version: number
        }
        Insert: {
          accepted_at?: string
          agreement_id: string
          agreement_type: Database["public"]["Enums"]["legal_agreement_type"]
          context?: Json
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
          version: number
        }
        Update: {
          accepted_at?: string
          agreement_id?: string
          agreement_type?: Database["public"]["Enums"]["legal_agreement_type"]
          context?: Json
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "legal_acceptances_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "legal_agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_agreements: {
        Row: {
          agreement_type: Database["public"]["Enums"]["legal_agreement_type"]
          body: string
          created_at: string
          created_by: string | null
          id: string
          is_current: boolean
          is_published: boolean
          published_at: string | null
          requires_legal_review: boolean
          summary: string | null
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          agreement_type: Database["public"]["Enums"]["legal_agreement_type"]
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_current?: boolean
          is_published?: boolean
          published_at?: string | null
          requires_legal_review?: boolean
          summary?: string | null
          title: string
          updated_at?: string
          version: number
        }
        Update: {
          agreement_type?: Database["public"]["Enums"]["legal_agreement_type"]
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_current?: boolean
          is_published?: boolean
          published_at?: string | null
          requires_legal_review?: boolean
          summary?: string | null
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      manual_invoices: {
        Row: {
          billed_to_email: string | null
          billed_to_name: string | null
          created_at: string
          created_by: string | null
          currency: string
          deal_memo_id: string | null
          document_type: string
          due_date: string | null
          entitlement_assignment_id: string | null
          entitlement_granted_at: string | null
          grants_plan_code: string | null
          grants_until: string | null
          gst_paise: number
          gst_percent: number
          id: string
          invoice_number: string
          issued_at: string | null
          line_items: Json
          notes: string | null
          paid_at: string | null
          payment_link_url: string | null
          payment_method: string | null
          payment_reference: string | null
          status: string
          storage_allocation_id: string | null
          subtotal_paise: number
          support_request_id: string | null
          surface: string
          tax_inclusive: boolean
          total_paise: number
          updated_at: string
          user_id: string
          voided_at: string | null
        }
        Insert: {
          billed_to_email?: string | null
          billed_to_name?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_memo_id?: string | null
          document_type?: string
          due_date?: string | null
          entitlement_assignment_id?: string | null
          entitlement_granted_at?: string | null
          grants_plan_code?: string | null
          grants_until?: string | null
          gst_paise?: number
          gst_percent?: number
          id?: string
          invoice_number?: string
          issued_at?: string | null
          line_items?: Json
          notes?: string | null
          paid_at?: string | null
          payment_link_url?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          status?: string
          storage_allocation_id?: string | null
          subtotal_paise?: number
          support_request_id?: string | null
          surface?: string
          tax_inclusive?: boolean
          total_paise?: number
          updated_at?: string
          user_id: string
          voided_at?: string | null
        }
        Update: {
          billed_to_email?: string | null
          billed_to_name?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_memo_id?: string | null
          document_type?: string
          due_date?: string | null
          entitlement_assignment_id?: string | null
          entitlement_granted_at?: string | null
          grants_plan_code?: string | null
          grants_until?: string | null
          gst_paise?: number
          gst_percent?: number
          id?: string
          invoice_number?: string
          issued_at?: string | null
          line_items?: Json
          notes?: string | null
          paid_at?: string | null
          payment_link_url?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          status?: string
          storage_allocation_id?: string | null
          subtotal_paise?: number
          support_request_id?: string | null
          surface?: string
          tax_inclusive?: boolean
          total_paise?: number
          updated_at?: string
          user_id?: string
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manual_invoices_deal_memo_id_fkey"
            columns: ["deal_memo_id"]
            isOneToOne: false
            referencedRelation: "deal_memos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_invoices_entitlement_assignment_id_fkey"
            columns: ["entitlement_assignment_id"]
            isOneToOne: false
            referencedRelation: "plan_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_invoices_storage_allocation_id_fkey"
            columns: ["storage_allocation_id"]
            isOneToOne: false
            referencedRelation: "storage_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_invoices_support_request_id_fkey"
            columns: ["support_request_id"]
            isOneToOne: false
            referencedRelation: "support_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_user_id: string | null
          allowed: boolean
          created_at: string
          details: Json
          id: string
          permission_key: string | null
          resource: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_user_id?: string | null
          allowed?: boolean
          created_at?: string
          details?: Json
          id?: string
          permission_key?: string | null
          resource?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_user_id?: string | null
          allowed?: boolean
          created_at?: string
          details?: Json
          id?: string
          permission_key?: string | null
          resource?: string | null
        }
        Relationships: []
      }
      media_assets: {
        Row: {
          category: string | null
          created_at: string | null
          file_url: string | null
          id: string
          language: string | null
          media_type: string | null
          ocr_text_en: string | null
          ocr_text_ml: string | null
          organization_id: string | null
          tags: string[] | null
          title: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          file_url?: string | null
          id?: string
          language?: string | null
          media_type?: string | null
          ocr_text_en?: string | null
          ocr_text_ml?: string | null
          organization_id?: string | null
          tags?: string[] | null
          title?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          file_url?: string | null
          id?: string
          language?: string | null
          media_type?: string | null
          ocr_text_en?: string | null
          ocr_text_ml?: string | null
          organization_id?: string | null
          tags?: string[] | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          address: string | null
          created_at: string | null
          date_of_birth: string | null
          email: string | null
          full_name: string
          id: string
          member_number: string | null
          membership_end: string | null
          membership_start: string | null
          organization_id: string | null
          phone: string | null
          status: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          full_name: string
          id?: string
          member_number?: string | null
          membership_end?: string | null
          membership_start?: string | null
          organization_id?: string | null
          phone?: string | null
          status?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          full_name?: string
          id?: string
          member_number?: string | null
          membership_end?: string | null
          membership_start?: string | null
          organization_id?: string | null
          phone?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      news_articles: {
        Row: {
          category: string | null
          content: string | null
          content_ml: string | null
          created_at: string | null
          id: string
          image_url: string | null
          organization_id: string | null
          published: boolean | null
          title: string | null
          title_ml: string | null
        }
        Insert: {
          category?: string | null
          content?: string | null
          content_ml?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          organization_id?: string | null
          published?: boolean | null
          title?: string | null
          title_ml?: string | null
        }
        Update: {
          category?: string | null
          content?: string | null
          content_ml?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          organization_id?: string | null
          published?: boolean | null
          title?: string | null
          title_ml?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "news_articles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      news_events: {
        Row: {
          created_at: string
          ends_at: string | null
          event_date: string | null
          id: string
          image_url: string | null
          is_active: boolean
          kind: string
          link_url: string | null
          location: string | null
          sort_order: number
          starts_at: string | null
          status: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          event_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          kind: string
          link_url?: string | null
          location?: string | null
          sort_order?: number
          starts_at?: string | null
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          event_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          kind?: string
          link_url?: string | null
          location?: string | null
          sort_order?: number
          starts_at?: string | null
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string | null
          title: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          title?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          title?: string | null
          user_id?: string | null
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
          link_metadata: Json
          link_source: string | null
          link_status: string
          linked_at: string | null
          linked_file_id: string | null
          linked_share_token: string | null
          mfi_proof_path: string | null
          onboarding_status: string
          payment_status: string
          plan_type: string
          professional_role: string
          promo_code: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          selected_cycle: string
          submitter_user_id: string | null
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
          link_metadata?: Json
          link_source?: string | null
          link_status?: string
          linked_at?: string | null
          linked_file_id?: string | null
          linked_share_token?: string | null
          mfi_proof_path?: string | null
          onboarding_status?: string
          payment_status?: string
          plan_type?: string
          professional_role: string
          promo_code?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          selected_cycle: string
          submitter_user_id?: string | null
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
          link_metadata?: Json
          link_source?: string | null
          link_status?: string
          linked_at?: string | null
          linked_file_id?: string | null
          linked_share_token?: string | null
          mfi_proof_path?: string | null
          onboarding_status?: string
          payment_status?: string
          plan_type?: string
          professional_role?: string
          promo_code?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          selected_cycle?: string
          submitter_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_requests_linked_file_id_fkey"
            columns: ["linked_file_id"]
            isOneToOne: false
            referencedRelation: "shared_files"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          domain_name: string | null
          id: string
          logo_url: string | null
          name: string
          primary_color: string | null
          subscription_plan: string | null
          subscription_status: string | null
        }
        Insert: {
          created_at?: string | null
          domain_name?: string | null
          id?: string
          logo_url?: string | null
          name: string
          primary_color?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
        }
        Update: {
          created_at?: string | null
          domain_name?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
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
      payment_debug_logs: {
        Row: {
          action_type: string
          created_at: string
          duration_ms: number | null
          error_message: string | null
          event_id: string | null
          extra: Json
          id: string
          order_id: string | null
          payment_id: string | null
          severity: string
          source: string
          ts: string
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          event_id?: string | null
          extra?: Json
          id?: string
          order_id?: string | null
          payment_id?: string | null
          severity?: string
          source?: string
          ts?: string
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          event_id?: string | null
          extra?: Json
          id?: string
          order_id?: string | null
          payment_id?: string | null
          severity?: string
          source?: string
          ts?: string
          user_id?: string | null
        }
        Relationships: []
      }
      payment_traces: {
        Row: {
          allocation_created: boolean
          amount_paise: number | null
          checkout_opened_at: string | null
          created_at: string
          currency: string | null
          entitlement_completed_at: string | null
          entitlement_started_at: string | null
          extra: Json
          final_result: string | null
          frontend_state: string | null
          id: string
          invoice_created: boolean
          invoice_id: string | null
          last_error: string | null
          order_created_at: string
          order_id: string
          payment_completed_at: string | null
          payment_id: string | null
          razorpay_order_status: string | null
          razorpay_payment_status: string | null
          source: string | null
          topup_id: string | null
          updated_at: string
          user_id: string | null
          verify_completed_at: string | null
          verify_started_at: string | null
          webhook_event: string | null
          webhook_received_at: string | null
          webhook_signature_valid: boolean | null
        }
        Insert: {
          allocation_created?: boolean
          amount_paise?: number | null
          checkout_opened_at?: string | null
          created_at?: string
          currency?: string | null
          entitlement_completed_at?: string | null
          entitlement_started_at?: string | null
          extra?: Json
          final_result?: string | null
          frontend_state?: string | null
          id?: string
          invoice_created?: boolean
          invoice_id?: string | null
          last_error?: string | null
          order_created_at?: string
          order_id: string
          payment_completed_at?: string | null
          payment_id?: string | null
          razorpay_order_status?: string | null
          razorpay_payment_status?: string | null
          source?: string | null
          topup_id?: string | null
          updated_at?: string
          user_id?: string | null
          verify_completed_at?: string | null
          verify_started_at?: string | null
          webhook_event?: string | null
          webhook_received_at?: string | null
          webhook_signature_valid?: boolean | null
        }
        Update: {
          allocation_created?: boolean
          amount_paise?: number | null
          checkout_opened_at?: string | null
          created_at?: string
          currency?: string | null
          entitlement_completed_at?: string | null
          entitlement_started_at?: string | null
          extra?: Json
          final_result?: string | null
          frontend_state?: string | null
          id?: string
          invoice_created?: boolean
          invoice_id?: string | null
          last_error?: string | null
          order_created_at?: string
          order_id?: string
          payment_completed_at?: string | null
          payment_id?: string | null
          razorpay_order_status?: string | null
          razorpay_payment_status?: string | null
          source?: string | null
          topup_id?: string | null
          updated_at?: string
          user_id?: string | null
          verify_completed_at?: string | null
          verify_started_at?: string | null
          webhook_event?: string | null
          webhook_received_at?: string | null
          webhook_signature_valid?: boolean | null
        }
        Relationships: []
      }
      plan_assignments: {
        Row: {
          created_at: string
          ends_at: string | null
          granted_by: string | null
          id: string
          is_lifetime: boolean
          is_promotional: boolean
          notes: string | null
          org_id: string | null
          plan_id: string
          starts_at: string
          status: Database["public"]["Enums"]["plan_assignment_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          granted_by?: string | null
          id?: string
          is_lifetime?: boolean
          is_promotional?: boolean
          notes?: string | null
          org_id?: string | null
          plan_id: string
          starts_at?: string
          status?: Database["public"]["Enums"]["plan_assignment_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          granted_by?: string | null
          id?: string
          is_lifetime?: boolean
          is_promotional?: boolean
          notes?: string | null
          org_id?: string | null
          plan_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["plan_assignment_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_assignments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          bandwidth_gb: number
          billing_cycle: string
          code: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          features: Json
          gst_percent: number
          id: string
          is_active: boolean
          is_archived: boolean
          name: string
          price_amount: number
          razorpay_plan_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          sort_order: number
          storage_gb: number
          topup_unit_tb: number | null
          trial_days: number
          updated_at: string
          user_limit: number
          visibility: string
        }
        Insert: {
          bandwidth_gb?: number
          billing_cycle?: string
          code: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          features?: Json
          gst_percent?: number
          id?: string
          is_active?: boolean
          is_archived?: boolean
          name: string
          price_amount?: number
          razorpay_plan_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          sort_order?: number
          storage_gb?: number
          topup_unit_tb?: number | null
          trial_days?: number
          updated_at?: string
          user_limit?: number
          visibility?: string
        }
        Update: {
          bandwidth_gb?: number
          billing_cycle?: string
          code?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          features?: Json
          gst_percent?: number
          id?: string
          is_active?: boolean
          is_archived?: boolean
          name?: string
          price_amount?: number
          razorpay_plan_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          sort_order?: number
          storage_gb?: number
          topup_unit_tb?: number | null
          trial_days?: number
          updated_at?: string
          user_limit?: number
          visibility?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          category: string
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          category?: string
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          category?: string
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
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
      productions: {
        Row: {
          created_at: string | null
          description: string | null
          end_date: string | null
          id: string
          start_date: string | null
          status: string | null
          title: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          start_date?: string | null
          status?: string | null
          title?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          start_date?: string | null
          status?: string | null
          title?: string | null
          workspace_id?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          camera_brand: string | null
          capture_format: string | null
          created_at: string
          crew: Json
          description: string | null
          foldering_mode_archive: string
          foldering_mode_raw: string
          id: string
          lens_brand: string | null
          name: string
          production_banner:
            | Database["public"]["Enums"]["production_banner"]
            | null
          resolution: string | null
          schedule_artists: string | null
          schedule_charting: string | null
          schedule_equipment: string | null
          script_object_key: string | null
          script_url: string | null
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          camera_brand?: string | null
          capture_format?: string | null
          created_at?: string
          crew?: Json
          description?: string | null
          foldering_mode_archive?: string
          foldering_mode_raw?: string
          id?: string
          lens_brand?: string | null
          name: string
          production_banner?:
            | Database["public"]["Enums"]["production_banner"]
            | null
          resolution?: string | null
          schedule_artists?: string | null
          schedule_charting?: string | null
          schedule_equipment?: string | null
          script_object_key?: string | null
          script_url?: string | null
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          camera_brand?: string | null
          capture_format?: string | null
          created_at?: string
          crew?: Json
          description?: string | null
          foldering_mode_archive?: string
          foldering_mode_raw?: string
          id?: string
          lens_brand?: string | null
          name?: string
          production_banner?:
            | Database["public"]["Enums"]["production_banner"]
            | null
          resolution?: string | null
          schedule_artists?: string | null
          schedule_charting?: string | null
          schedule_equipment?: string | null
          script_object_key?: string | null
          script_url?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      razorpay_audit_log: {
        Row: {
          amount_paise: number | null
          created_at: string
          currency: string | null
          error_code: string | null
          error_description: string | null
          event_type: string
          id: string
          order_id: string | null
          payload: Json | null
          payment_id: string | null
          signature_valid: boolean | null
          source: string
          status: string | null
          subscription_id: string | null
          user_id: string | null
        }
        Insert: {
          amount_paise?: number | null
          created_at?: string
          currency?: string | null
          error_code?: string | null
          error_description?: string | null
          event_type: string
          id?: string
          order_id?: string | null
          payload?: Json | null
          payment_id?: string | null
          signature_valid?: boolean | null
          source?: string
          status?: string | null
          subscription_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount_paise?: number | null
          created_at?: string
          currency?: string | null
          error_code?: string | null
          error_description?: string | null
          event_type?: string
          id?: string
          order_id?: string | null
          payload?: Json | null
          payment_id?: string | null
          signature_valid?: boolean | null
          source?: string
          status?: string | null
          subscription_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      razorpay_config: {
        Row: {
          id: boolean
          key_id: string | null
          mode: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          key_id?: string | null
          mode?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          key_id?: string | null
          mode?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      razorpay_webhook_ledger: {
        Row: {
          created_at: string
          error_message: string | null
          event_id: string
          event_type: string | null
          id: string
          last_attempt_at: string | null
          order_id: string | null
          payload: Json
          payment_id: string | null
          processed_at: string | null
          retry_count: number
          signature_valid: boolean | null
          status: string
          subscription_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_id: string
          event_type?: string | null
          id?: string
          last_attempt_at?: string | null
          order_id?: string | null
          payload: Json
          payment_id?: string | null
          processed_at?: string | null
          retry_count?: number
          signature_valid?: boolean | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_id?: string
          event_type?: string | null
          id?: string
          last_attempt_at?: string | null
          order_id?: string | null
          payload?: Json
          payment_id?: string | null
          processed_at?: string | null
          retry_count?: number
          signature_valid?: boolean | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recent_uploads: {
        Row: {
          bucket: string
          category: string | null
          client_pending_id: string | null
          created_at: string
          error_message: string | null
          file_name: string
          file_size: number
          id: string
          last_accessed_at: string
          mime_type: string | null
          namespace: string
          object_key: string
          oci_upload_id: string | null
          par_expires_at: string | null
          par_url: string | null
          production_banner:
            | Database["public"]["Enums"]["production_banner"]
            | null
          project_id: string | null
          region: string
          status: string
          storage_tier: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          bucket: string
          category?: string | null
          client_pending_id?: string | null
          created_at?: string
          error_message?: string | null
          file_name: string
          file_size?: number
          id?: string
          last_accessed_at?: string
          mime_type?: string | null
          namespace: string
          object_key: string
          oci_upload_id?: string | null
          par_expires_at?: string | null
          par_url?: string | null
          production_banner?:
            | Database["public"]["Enums"]["production_banner"]
            | null
          project_id?: string | null
          region: string
          status?: string
          storage_tier?: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          bucket?: string
          category?: string | null
          client_pending_id?: string | null
          created_at?: string
          error_message?: string | null
          file_name?: string
          file_size?: number
          id?: string
          last_accessed_at?: string
          mime_type?: string | null
          namespace?: string
          object_key?: string
          oci_upload_id?: string | null
          par_expires_at?: string | null
          par_url?: string | null
          production_banner?:
            | Database["public"]["Enums"]["production_banner"]
            | null
          project_id?: string | null
          region?: string
          status?: string
          storage_tier?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recent_uploads_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recent_uploads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
      restore_jobs: {
        Row: {
          archive_job_id: string | null
          asset_id: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          eta_seconds: number | null
          id: string
          metadata: Json
          progress_percent: number
          requested_by: string
          started_at: string | null
          status: string
          target_tier: string
          total_bytes: number
          transferred_bytes: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archive_job_id?: string | null
          asset_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          eta_seconds?: number | null
          id?: string
          metadata?: Json
          progress_percent?: number
          requested_by: string
          started_at?: string | null
          status?: string
          target_tier?: string
          total_bytes?: number
          transferred_bytes?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archive_job_id?: string | null
          asset_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          eta_seconds?: number | null
          id?: string
          metadata?: Json
          progress_percent?: number
          requested_by?: string
          started_at?: string | null
          status?: string
          target_tier?: string
          total_bytes?: number
          transferred_bytes?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restore_jobs_archive_job_id_fkey"
            columns: ["archive_job_id"]
            isOneToOne: false
            referencedRelation: "archive_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restore_jobs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "studio_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restore_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_transactions: {
        Row: {
          amount: number | null
          created_at: string | null
          description: string | null
          id: string
          organization_id: string | null
          revenue_type: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          organization_id?: string | null
          revenue_type?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          organization_id?: string | null
          revenue_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revenue_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      review_comments: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          review_link_id: string | null
          timestamp_seconds: number | null
          user_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          review_link_id?: string | null
          timestamp_seconds?: number | null
          user_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          review_link_id?: string | null
          timestamp_seconds?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_comments_review_link_id_fkey"
            columns: ["review_link_id"]
            isOneToOne: false
            referencedRelation: "review_links"
            referencedColumns: ["id"]
          },
        ]
      }
      review_link_secrets: {
        Row: {
          created_at: string
          password_hash: string
          password_hash_algo: string
          password_salt: string
          review_link_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          password_hash: string
          password_hash_algo?: string
          password_salt: string
          review_link_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          password_hash?: string
          password_hash_algo?: string
          password_salt?: string
          review_link_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_link_secrets_review_link_id_fkey"
            columns: ["review_link_id"]
            isOneToOne: true
            referencedRelation: "review_links"
            referencedColumns: ["id"]
          },
        ]
      }
      review_links: {
        Row: {
          asset_mime: string | null
          asset_name: string
          asset_object_key: string | null
          asset_par_expires_at: string | null
          asset_par_url: string | null
          asset_size_bytes: number | null
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          last_viewed_at: string | null
          max_views: number | null
          project_id: string | null
          requires_password: boolean
          revoked: boolean
          token: string
          updated_at: string
          upload_id: string | null
          view_count: number
          view_only: boolean
          workspace_id: string
        }
        Insert: {
          asset_mime?: string | null
          asset_name: string
          asset_object_key?: string | null
          asset_par_expires_at?: string | null
          asset_par_url?: string | null
          asset_size_bytes?: number | null
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          last_viewed_at?: string | null
          max_views?: number | null
          project_id?: string | null
          requires_password?: boolean
          revoked?: boolean
          token?: string
          updated_at?: string
          upload_id?: string | null
          view_count?: number
          view_only?: boolean
          workspace_id: string
        }
        Update: {
          asset_mime?: string | null
          asset_name?: string
          asset_object_key?: string | null
          asset_par_expires_at?: string | null
          asset_par_url?: string | null
          asset_size_bytes?: number | null
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          last_viewed_at?: string | null
          max_views?: number | null
          project_id?: string | null
          requires_password?: boolean
          revoked?: boolean
          token?: string
          updated_at?: string
          upload_id?: string | null
          view_count?: number
          view_only?: boolean
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_links_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "recent_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      role_invitations: {
        Row: {
          accepted_at: string | null
          accepted_user_id: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          notes: string | null
          role: Database["public"]["Enums"]["app_role"]
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
          id?: string
          invited_by?: string | null
          notes?: string | null
          role: Database["public"]["Enums"]["app_role"]
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
          id?: string
          invited_by?: string | null
          notes?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      scholarships: {
        Row: {
          amount: number | null
          application_deadline: string | null
          created_at: string | null
          description: string | null
          id: string
          organization_id: string | null
          status: string | null
          title: string | null
        }
        Insert: {
          amount?: number | null
          application_deadline?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          organization_id?: string | null
          status?: string | null
          title?: string | null
        }
        Update: {
          amount?: number | null
          application_deadline?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          organization_id?: string | null
          status?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scholarships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      screening_events: {
        Row: {
          actor_user_id: string | null
          id: string
          invite_id: string
          ip: string | null
          kind: string
          metadata: Json
          occurred_at: string
          progress_pct: number | null
          user_agent: string | null
        }
        Insert: {
          actor_user_id?: string | null
          id?: string
          invite_id: string
          ip?: string | null
          kind: string
          metadata?: Json
          occurred_at?: string
          progress_pct?: number | null
          user_agent?: string | null
        }
        Update: {
          actor_user_id?: string | null
          id?: string
          invite_id?: string
          ip?: string | null
          kind?: string
          metadata?: Json
          occurred_at?: string
          progress_pct?: number | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "screening_events_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "screening_invites"
            referencedColumns: ["id"]
          },
        ]
      }
      screening_invites: {
        Row: {
          buyer_org_name: string | null
          buyer_user_id: string | null
          commercial_request_id: string | null
          completed: boolean
          created_at: string
          created_by: string | null
          deal_memo_id: string | null
          expires_at: string
          first_opened_at: string | null
          id: string
          invite_email: string
          invite_name: string | null
          last_viewed_at: string | null
          max_progress_pct: number
          max_views: number | null
          metadata: Json
          nda_required: boolean
          notes: string | null
          playback_url: string | null
          playback_url_expires_at: string | null
          revoke_reason: string | null
          revoked_at: string | null
          screening_asset_id: string | null
          status: string
          title_id: string
          token: string
          updated_at: string
          view_count: number
          watermark_enabled: boolean
        }
        Insert: {
          buyer_org_name?: string | null
          buyer_user_id?: string | null
          commercial_request_id?: string | null
          completed?: boolean
          created_at?: string
          created_by?: string | null
          deal_memo_id?: string | null
          expires_at: string
          first_opened_at?: string | null
          id?: string
          invite_email: string
          invite_name?: string | null
          last_viewed_at?: string | null
          max_progress_pct?: number
          max_views?: number | null
          metadata?: Json
          nda_required?: boolean
          notes?: string | null
          playback_url?: string | null
          playback_url_expires_at?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
          screening_asset_id?: string | null
          status?: string
          title_id: string
          token: string
          updated_at?: string
          view_count?: number
          watermark_enabled?: boolean
        }
        Update: {
          buyer_org_name?: string | null
          buyer_user_id?: string | null
          commercial_request_id?: string | null
          completed?: boolean
          created_at?: string
          created_by?: string | null
          deal_memo_id?: string | null
          expires_at?: string
          first_opened_at?: string | null
          id?: string
          invite_email?: string
          invite_name?: string | null
          last_viewed_at?: string | null
          max_progress_pct?: number
          max_views?: number | null
          metadata?: Json
          nda_required?: boolean
          notes?: string | null
          playback_url?: string | null
          playback_url_expires_at?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
          screening_asset_id?: string | null
          status?: string
          title_id?: string
          token?: string
          updated_at?: string
          view_count?: number
          watermark_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "screening_invites_commercial_request_id_fkey"
            columns: ["commercial_request_id"]
            isOneToOne: false
            referencedRelation: "commercial_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_invites_deal_memo_id_fkey"
            columns: ["deal_memo_id"]
            isOneToOne: false
            referencedRelation: "deal_memos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_invites_screening_asset_id_fkey"
            columns: ["screening_asset_id"]
            isOneToOne: false
            referencedRelation: "title_screening_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_invites_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "content_titles"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_file_secrets: {
        Row: {
          created_at: string
          password_hash: string
          password_salt: string | null
          shared_file_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          password_hash: string
          password_salt?: string | null
          shared_file_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          password_hash?: string
          password_salt?: string | null
          shared_file_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_file_secrets_shared_file_id_fkey"
            columns: ["shared_file_id"]
            isOneToOne: true
            referencedRelation: "shared_files"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_files: {
        Row: {
          created_at: string
          download_count: number
          expires_at: string | null
          filename: string
          has_password: boolean
          id: string
          max_downloads: number | null
          mime_type: string | null
          owner_id: string
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
          has_password?: boolean
          id?: string
          max_downloads?: number | null
          mime_type?: string | null
          owner_id: string
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
          has_password?: boolean
          id?: string
          max_downloads?: number | null
          mime_type?: string | null
          owner_id?: string
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
      storage_allocations: {
        Row: {
          allocated_gb: number
          created_at: string
          expires_at: string | null
          granted_by: string | null
          id: string
          notes: string | null
          org_id: string | null
          source: string
          updated_at: string
          used_gb: number
          user_id: string | null
        }
        Insert: {
          allocated_gb?: number
          created_at?: string
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          notes?: string | null
          org_id?: string | null
          source?: string
          updated_at?: string
          used_gb?: number
          user_id?: string | null
        }
        Update: {
          allocated_gb?: number
          created_at?: string
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          notes?: string | null
          org_id?: string | null
          source?: string
          updated_at?: string
          used_gb?: number
          user_id?: string | null
        }
        Relationships: []
      }
      storage_topups: {
        Row: {
          amount_inr: number
          billing_interval_months: number
          billing_periods: number
          created_at: string
          entitlement_projected_at: string | null
          gst_paise: number | null
          id: string
          notes: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          source: string
          status: string
          storage_class: string | null
          subtotal_paise: number | null
          tb_added: number
          total_paise: number | null
          updated_at: string
          user_id: string
          vault_product_id: string | null
        }
        Insert: {
          amount_inr?: number
          billing_interval_months?: number
          billing_periods?: number
          created_at?: string
          entitlement_projected_at?: string | null
          gst_paise?: number | null
          id?: string
          notes?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          source?: string
          status?: string
          storage_class?: string | null
          subtotal_paise?: number | null
          tb_added?: number
          total_paise?: number | null
          updated_at?: string
          user_id: string
          vault_product_id?: string | null
        }
        Update: {
          amount_inr?: number
          billing_interval_months?: number
          billing_periods?: number
          created_at?: string
          entitlement_projected_at?: string | null
          gst_paise?: number | null
          id?: string
          notes?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          source?: string
          status?: string
          storage_class?: string | null
          subtotal_paise?: number | null
          tb_added?: number
          total_paise?: number | null
          updated_at?: string
          user_id?: string
          vault_product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storage_topups_vault_product_id_fkey"
            columns: ["vault_product_id"]
            isOneToOne: false
            referencedRelation: "studio_vault_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storage_topups_vault_product_id_fkey"
            columns: ["vault_product_id"]
            isOneToOne: false
            referencedRelation: "studio_vault_products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          attendance: number | null
          created_at: string | null
          full_name: string | null
          id: string
          leadership_score: number | null
          marks: number | null
          organization_id: string | null
          school_name: string | null
          sports_score: number | null
          total_score: number | null
          volunteer_score: number | null
        }
        Insert: {
          attendance?: number | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          leadership_score?: number | null
          marks?: number | null
          organization_id?: string | null
          school_name?: string | null
          sports_score?: number | null
          total_score?: number | null
          volunteer_score?: number | null
        }
        Update: {
          attendance?: number | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          leadership_score?: number | null
          marks?: number | null
          organization_id?: string | null
          school_name?: string | null
          sports_score?: number | null
          total_score?: number | null
          volunteer_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "students_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_asset_files: {
        Row: {
          asset_id: string
          created_at: string
          id: string
          role: string
          sort_order: number
          upload_id: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          id?: string
          role?: string
          sort_order?: number
          upload_id: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          id?: string
          role?: string
          sort_order?: number
          upload_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_asset_files_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "studio_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_asset_files_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "recent_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_assets: {
        Row: {
          asset_type: string
          camera_make: string | null
          camera_model: string | null
          codec: string | null
          created_at: string
          file_count: number
          fps: number | null
          id: string
          metadata: Json
          notes: string | null
          owner_id: string
          primary_upload_id: string | null
          project_id: string | null
          resolution: string | null
          shoot_date: string | null
          sidecar_kinds: string[]
          status: string
          tags: string[]
          title: string
          total_size_bytes: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          asset_type?: string
          camera_make?: string | null
          camera_model?: string | null
          codec?: string | null
          created_at?: string
          file_count?: number
          fps?: number | null
          id?: string
          metadata?: Json
          notes?: string | null
          owner_id: string
          primary_upload_id?: string | null
          project_id?: string | null
          resolution?: string | null
          shoot_date?: string | null
          sidecar_kinds?: string[]
          status?: string
          tags?: string[]
          title: string
          total_size_bytes?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          asset_type?: string
          camera_make?: string | null
          camera_model?: string | null
          codec?: string | null
          created_at?: string
          file_count?: number
          fps?: number | null
          id?: string
          metadata?: Json
          notes?: string | null
          owner_id?: string
          primary_upload_id?: string | null
          project_id?: string | null
          resolution?: string | null
          shoot_date?: string | null
          sidecar_kinds?: string[]
          status?: string
          tags?: string[]
          title?: string
          total_size_bytes?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_assets_primary_upload_id_fkey"
            columns: ["primary_upload_id"]
            isOneToOne: false
            referencedRelation: "recent_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_vault_products: {
        Row: {
          badge: string | null
          billing_modes: Json
          code: string
          created_at: string
          created_by: string | null
          default_tb_options: Json
          description: string | null
          enterprise_only: boolean
          features: Json
          gst_percent: number
          id: string
          internal_cost_per_tb_paise: number
          max_tb: number
          min_tb: number
          name: string
          oci_storage_tier: string | null
          self_serve_enabled: boolean
          sell_price_per_tb_paise: number
          short_pitch: string | null
          sort_order: number
          storage_class: string
          updated_at: string
          visible: boolean
        }
        Insert: {
          badge?: string | null
          billing_modes?: Json
          code: string
          created_at?: string
          created_by?: string | null
          default_tb_options?: Json
          description?: string | null
          enterprise_only?: boolean
          features?: Json
          gst_percent?: number
          id?: string
          internal_cost_per_tb_paise?: number
          max_tb?: number
          min_tb?: number
          name: string
          oci_storage_tier?: string | null
          self_serve_enabled?: boolean
          sell_price_per_tb_paise: number
          short_pitch?: string | null
          sort_order?: number
          storage_class: string
          updated_at?: string
          visible?: boolean
        }
        Update: {
          badge?: string | null
          billing_modes?: Json
          code?: string
          created_at?: string
          created_by?: string | null
          default_tb_options?: Json
          description?: string | null
          enterprise_only?: boolean
          features?: Json
          gst_percent?: number
          id?: string
          internal_cost_per_tb_paise?: number
          max_tb?: number
          min_tb?: number
          name?: string
          oci_storage_tier?: string | null
          self_serve_enabled?: boolean
          sell_price_per_tb_paise?: number
          short_pitch?: string | null
          sort_order?: number
          storage_class?: string
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          cancel_requested_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          customer_email: string | null
          environment: string
          gateway: string
          id: string
          paddle_customer_id: string | null
          paddle_subscription_id: string | null
          price_id: string | null
          product_id: string | null
          provider: string
          razorpay_customer_id: string | null
          razorpay_plan_id: string | null
          razorpay_subscription_id: string | null
          razorpay_token_id: string | null
          status: string
          storage_quantity_tb: number | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_type: string
          unit_amount_paise: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          cancel_requested_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          customer_email?: string | null
          environment?: string
          gateway?: string
          id?: string
          paddle_customer_id?: string | null
          paddle_subscription_id?: string | null
          price_id?: string | null
          product_id?: string | null
          provider?: string
          razorpay_customer_id?: string | null
          razorpay_plan_id?: string | null
          razorpay_subscription_id?: string | null
          razorpay_token_id?: string | null
          status?: string
          storage_quantity_tb?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_type?: string
          unit_amount_paise?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean | null
          cancel_requested_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          customer_email?: string | null
          environment?: string
          gateway?: string
          id?: string
          paddle_customer_id?: string | null
          paddle_subscription_id?: string | null
          price_id?: string | null
          product_id?: string | null
          provider?: string
          razorpay_customer_id?: string | null
          razorpay_plan_id?: string | null
          razorpay_subscription_id?: string | null
          razorpay_token_id?: string | null
          status?: string
          storage_quantity_tb?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_type?: string
          unit_amount_paise?: number | null
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
          metadata: Json
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
          metadata?: Json
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
          metadata?: Json
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
      title_assets: {
        Row: {
          category: string
          created_at: string
          id: string
          is_primary: boolean
          title_id: string
          upload_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          is_primary?: boolean
          title_id: string
          upload_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          title_id?: string
          upload_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "title_assets_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "content_titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "title_assets_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "recent_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      title_commercial_profiles: {
        Row: {
          acquisition_open: boolean
          admin_approval_required: boolean
          admin_internal_notes: string | null
          available_for_acquisition: boolean
          available_for_distribution_partnership: boolean
          available_for_exclusive_license: boolean
          available_for_nonexclusive_license: boolean
          available_for_screeners: boolean
          buyer_facing_summary: string | null
          chain_of_title_notes: string | null
          commercial_status: Database["public"]["Enums"]["title_commercial_status"]
          created_at: string
          creator_final_approval_required: boolean
          creator_tier: string
          deal_mode: Database["public"]["Enums"]["deal_mode"]
          delivery_readiness_summary: string | null
          distribution_open: boolean
          id: string
          legal_clearance_summary: string | null
          licensing_open: boolean
          notes: string | null
          owner_user_id: string
          protection_tier: Database["public"]["Enums"]["protection_tier"]
          published_to_buyers: boolean
          rights_status_summary: string | null
          screening_allowed: boolean
          title_id: string
          updated_at: string
        }
        Insert: {
          acquisition_open?: boolean
          admin_approval_required?: boolean
          admin_internal_notes?: string | null
          available_for_acquisition?: boolean
          available_for_distribution_partnership?: boolean
          available_for_exclusive_license?: boolean
          available_for_nonexclusive_license?: boolean
          available_for_screeners?: boolean
          buyer_facing_summary?: string | null
          chain_of_title_notes?: string | null
          commercial_status?: Database["public"]["Enums"]["title_commercial_status"]
          created_at?: string
          creator_final_approval_required?: boolean
          creator_tier?: string
          deal_mode?: Database["public"]["Enums"]["deal_mode"]
          delivery_readiness_summary?: string | null
          distribution_open?: boolean
          id?: string
          legal_clearance_summary?: string | null
          licensing_open?: boolean
          notes?: string | null
          owner_user_id: string
          protection_tier?: Database["public"]["Enums"]["protection_tier"]
          published_to_buyers?: boolean
          rights_status_summary?: string | null
          screening_allowed?: boolean
          title_id: string
          updated_at?: string
        }
        Update: {
          acquisition_open?: boolean
          admin_approval_required?: boolean
          admin_internal_notes?: string | null
          available_for_acquisition?: boolean
          available_for_distribution_partnership?: boolean
          available_for_exclusive_license?: boolean
          available_for_nonexclusive_license?: boolean
          available_for_screeners?: boolean
          buyer_facing_summary?: string | null
          chain_of_title_notes?: string | null
          commercial_status?: Database["public"]["Enums"]["title_commercial_status"]
          created_at?: string
          creator_final_approval_required?: boolean
          creator_tier?: string
          deal_mode?: Database["public"]["Enums"]["deal_mode"]
          delivery_readiness_summary?: string | null
          distribution_open?: boolean
          id?: string
          legal_clearance_summary?: string | null
          licensing_open?: boolean
          notes?: string | null
          owner_user_id?: string
          protection_tier?: Database["public"]["Enums"]["protection_tier"]
          published_to_buyers?: boolean
          rights_status_summary?: string | null
          screening_allowed?: boolean
          title_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "title_commercial_profiles_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: true
            referencedRelation: "content_titles"
            referencedColumns: ["id"]
          },
        ]
      }
      title_edit_requests: {
        Row: {
          admin_response: string | null
          created_at: string
          creator_user_id: string
          handled_at: string | null
          handled_by_admin: string | null
          id: string
          message: string | null
          request_type: string
          requested_sections: string[]
          status: Database["public"]["Enums"]["title_edit_request_status"]
          title_id: string
          updated_at: string
        }
        Insert: {
          admin_response?: string | null
          created_at?: string
          creator_user_id: string
          handled_at?: string | null
          handled_by_admin?: string | null
          id?: string
          message?: string | null
          request_type: string
          requested_sections?: string[]
          status?: Database["public"]["Enums"]["title_edit_request_status"]
          title_id: string
          updated_at?: string
        }
        Update: {
          admin_response?: string | null
          created_at?: string
          creator_user_id?: string
          handled_at?: string | null
          handled_by_admin?: string | null
          id?: string
          message?: string | null
          request_type?: string
          requested_sections?: string[]
          status?: Database["public"]["Enums"]["title_edit_request_status"]
          title_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "title_edit_requests_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "content_titles"
            referencedColumns: ["id"]
          },
        ]
      }
      title_lock_state: {
        Row: {
          current_submission_state: string
          is_locked: boolean
          lock_reason: string | null
          locked_at: string | null
          locked_by: string | null
          title_id: string
          updated_at: string
        }
        Insert: {
          current_submission_state?: string
          is_locked?: boolean
          lock_reason?: string | null
          locked_at?: string | null
          locked_by?: string | null
          title_id: string
          updated_at?: string
        }
        Update: {
          current_submission_state?: string
          is_locked?: boolean
          lock_reason?: string | null
          locked_at?: string | null
          locked_by?: string | null
          title_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "title_lock_state_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: true
            referencedRelation: "content_titles"
            referencedColumns: ["id"]
          },
        ]
      }
      title_review_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          created_at: string
          id: string
          reviewer_user_id: string | null
          stage: string
          title_id: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          id?: string
          reviewer_user_id?: string | null
          stage: string
          title_id: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          id?: string
          reviewer_user_id?: string | null
          stage?: string
          title_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "title_review_assignments_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "content_titles"
            referencedColumns: ["id"]
          },
        ]
      }
      title_review_checklist: {
        Row: {
          blocking: boolean
          created_at: string
          id: string
          item_key: string
          item_label: string
          note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string
          stage: string
          status: string
          title_id: string
          updated_at: string
        }
        Insert: {
          blocking?: boolean
          created_at?: string
          id?: string
          item_key: string
          item_label: string
          note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          stage: string
          status?: string
          title_id: string
          updated_at?: string
        }
        Update: {
          blocking?: boolean
          created_at?: string
          id?: string
          item_key?: string
          item_label?: string
          note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          stage?: string
          status?: string
          title_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "title_review_checklist_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "content_titles"
            referencedColumns: ["id"]
          },
        ]
      }
      title_review_issues: {
        Row: {
          category_group: string
          category_key: string
          category_label: string
          created_at: string
          creator_note: string | null
          id: string
          internal_note: string | null
          raised_at: string
          raised_by: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          stage: string
          status: string
          title_id: string
          updated_at: string
        }
        Insert: {
          category_group: string
          category_key: string
          category_label: string
          created_at?: string
          creator_note?: string | null
          id?: string
          internal_note?: string | null
          raised_at?: string
          raised_by?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          stage: string
          status?: string
          title_id: string
          updated_at?: string
        }
        Update: {
          category_group?: string
          category_key?: string
          category_label?: string
          created_at?: string
          creator_note?: string | null
          id?: string
          internal_note?: string | null
          raised_at?: string
          raised_by?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          stage?: string
          status?: string
          title_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "title_review_issues_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "content_titles"
            referencedColumns: ["id"]
          },
        ]
      }
      title_review_notes: {
        Row: {
          author_email: string | null
          author_user_id: string | null
          body: string
          created_at: string
          id: string
          title_id: string
        }
        Insert: {
          author_email?: string | null
          author_user_id?: string | null
          body: string
          created_at?: string
          id?: string
          title_id: string
        }
        Update: {
          author_email?: string | null
          author_user_id?: string | null
          body?: string
          created_at?: string
          id?: string
          title_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "title_review_notes_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "content_titles"
            referencedColumns: ["id"]
          },
        ]
      }
      title_rights_availability: {
        Row: {
          committed_deal_id: string | null
          created_at: string
          created_by: string | null
          exclusivity: Database["public"]["Enums"]["right_exclusivity"]
          id: string
          language: string
          notes: string | null
          right_category: Database["public"]["Enums"]["right_category"]
          status: Database["public"]["Enums"]["right_status"]
          term_end: string | null
          term_start: string | null
          territory: string
          title_id: string
          updated_at: string
        }
        Insert: {
          committed_deal_id?: string | null
          created_at?: string
          created_by?: string | null
          exclusivity?: Database["public"]["Enums"]["right_exclusivity"]
          id?: string
          language?: string
          notes?: string | null
          right_category: Database["public"]["Enums"]["right_category"]
          status?: Database["public"]["Enums"]["right_status"]
          term_end?: string | null
          term_start?: string | null
          territory?: string
          title_id: string
          updated_at?: string
        }
        Update: {
          committed_deal_id?: string | null
          created_at?: string
          created_by?: string | null
          exclusivity?: Database["public"]["Enums"]["right_exclusivity"]
          id?: string
          language?: string
          notes?: string | null
          right_category?: Database["public"]["Enums"]["right_category"]
          status?: Database["public"]["Enums"]["right_status"]
          term_end?: string | null
          term_start?: string | null
          territory?: string
          title_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "title_rights_availability_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "content_titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trights_deal_fk"
            columns: ["committed_deal_id"]
            isOneToOne: false
            referencedRelation: "deal_memos"
            referencedColumns: ["id"]
          },
        ]
      }
      title_screening_assets: {
        Row: {
          created_at: string
          created_by: string | null
          duration_seconds: number | null
          external_url: string | null
          file_size: number | null
          id: string
          is_active: boolean
          label: string
          mime_type: string | null
          notes: string | null
          resolution: string | null
          source_kind: string
          title_id: string
          updated_at: string
          upload_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          external_url?: string | null
          file_size?: number | null
          id?: string
          is_active?: boolean
          label?: string
          mime_type?: string | null
          notes?: string | null
          resolution?: string | null
          source_kind?: string
          title_id: string
          updated_at?: string
          upload_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          external_url?: string | null
          file_size?: number | null
          id?: string
          is_active?: boolean
          label?: string
          mime_type?: string | null
          notes?: string | null
          resolution?: string | null
          source_kind?: string
          title_id?: string
          updated_at?: string
          upload_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "title_screening_assets_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "content_titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "title_screening_assets_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "recent_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      title_section_unlocks: {
        Row: {
          closed_at: string | null
          created_at: string
          expires_at: string | null
          id: string
          opened_at: string
          opened_by_admin: string | null
          opened_for_user_id: string | null
          reason: string | null
          section_key: string
          status: Database["public"]["Enums"]["title_section_unlock_status"]
          title_id: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          opened_at?: string
          opened_by_admin?: string | null
          opened_for_user_id?: string | null
          reason?: string | null
          section_key: string
          status?: Database["public"]["Enums"]["title_section_unlock_status"]
          title_id: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          opened_at?: string
          opened_by_admin?: string | null
          opened_for_user_id?: string | null
          reason?: string | null
          section_key?: string
          status?: Database["public"]["Enums"]["title_section_unlock_status"]
          title_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "title_section_unlocks_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "content_titles"
            referencedColumns: ["id"]
          },
        ]
      }
      upload_sessions: {
        Row: {
          created_at: string
          error_message: string | null
          file_name: string
          file_sha256: string | null
          file_size: number | null
          id: string
          mime_type: string | null
          object_key: string | null
          oci_upload_id: string | null
          production_banner:
            | Database["public"]["Enums"]["production_banner"]
            | null
          status: string
          total_chunks: number | null
          updated_at: string
          uploaded_parts: Json
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          file_name: string
          file_sha256?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          object_key?: string | null
          oci_upload_id?: string | null
          production_banner?:
            | Database["public"]["Enums"]["production_banner"]
            | null
          status?: string
          total_chunks?: number | null
          updated_at?: string
          uploaded_parts?: Json
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          file_name?: string
          file_sha256?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          object_key?: string | null
          oci_upload_id?: string | null
          production_banner?:
            | Database["public"]["Enums"]["production_banner"]
            | null
          status?: string
          total_chunks?: number | null
          updated_at?: string
          uploaded_parts?: Json
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      usage_meters: {
        Row: {
          api_calls: number
          bandwidth_gb: number
          created_at: string
          last_recomputed_at: string
          period_start: string
          storage_gb: number
          updated_at: string
          user_id: string
        }
        Insert: {
          api_calls?: number
          bandwidth_gb?: number
          created_at?: string
          last_recomputed_at?: string
          period_start?: string
          storage_gb?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          api_calls?: number
          bandwidth_gb?: number
          created_at?: string
          last_recomputed_at?: string
          period_start?: string
          storage_gb?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      usage_overages: {
        Row: {
          amount_paise: number
          charge_provider: string | null
          charge_ref: string | null
          charged_at: string | null
          created_at: string
          failure_reason: string | null
          id: string
          kind: string
          period_start: string
          rate_paise: number
          status: string
          units: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_paise: number
          charge_provider?: string | null
          charge_ref?: string | null
          charged_at?: string | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          kind: string
          period_start: string
          rate_paise: number
          status?: string
          units: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_paise?: number
          charge_provider?: string | null
          charge_ref?: string | null
          charged_at?: string | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          kind?: string
          period_start?: string
          rate_paise?: number
          status?: string
          units?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          bandwidth_overage_inr_per_gb: number
          bandwidth_quota_gb: number
          bandwidth_used_mb: number
          created_at: string
          display_name: string | null
          first_name: string | null
          full_name: string | null
          idle_flagged_at: string | null
          idle_frozen_at: string | null
          idle_status: string
          is_suspended: boolean
          job_title: string | null
          last_active_at: string
          last_name: string | null
          onboarding_step: string
          organization_name: string | null
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
          avatar_url?: string | null
          bandwidth_overage_inr_per_gb?: number
          bandwidth_quota_gb?: number
          bandwidth_used_mb?: number
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          full_name?: string | null
          idle_flagged_at?: string | null
          idle_frozen_at?: string | null
          idle_status?: string
          is_suspended?: boolean
          job_title?: string | null
          last_active_at?: string
          last_name?: string | null
          onboarding_step?: string
          organization_name?: string | null
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
          avatar_url?: string | null
          bandwidth_overage_inr_per_gb?: number
          bandwidth_quota_gb?: number
          bandwidth_used_mb?: number
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          full_name?: string | null
          idle_flagged_at?: string | null
          idle_frozen_at?: string | null
          idle_status?: string
          is_suspended?: boolean
          job_title?: string | null
          last_active_at?: string
          last_name?: string | null
          onboarding_step?: string
          organization_name?: string | null
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
      voucher_redemptions: {
        Row: {
          amount_off: number | null
          created_at: string
          id: string
          plan_assignment_id: string | null
          user_id: string
          voucher_id: string
        }
        Insert: {
          amount_off?: number | null
          created_at?: string
          id?: string
          plan_assignment_id?: string | null
          user_id: string
          voucher_id: string
        }
        Update: {
          amount_off?: number | null
          created_at?: string
          id?: string
          plan_assignment_id?: string | null
          user_id?: string
          voucher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voucher_redemptions_plan_assignment_id_fkey"
            columns: ["plan_assignment_id"]
            isOneToOne: false
            referencedRelation: "plan_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voucher_redemptions_voucher_id_fkey"
            columns: ["voucher_id"]
            isOneToOne: false
            referencedRelation: "vouchers"
            referencedColumns: ["id"]
          },
        ]
      }
      vouchers: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          currency: string | null
          discount_amount: number | null
          discount_percent: number | null
          expires_at: string | null
          id: string
          is_active: boolean
          max_redemptions: number | null
          plan_id: string | null
          redemptions_count: number
          scope: string
          target_org_id: string | null
          target_user_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          plan_id?: string | null
          redemptions_count?: number
          scope?: string
          target_org_id?: string | null
          target_user_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          plan_id?: string | null
          redemptions_count?: number
          scope?: string
          target_org_id?: string | null
          target_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vouchers_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      welfare_beneficiaries: {
        Row: {
          assistance_amount: number | null
          beneficiary_name: string | null
          category: string | null
          created_at: string | null
          id: string
          organization_id: string | null
          status: string | null
        }
        Insert: {
          assistance_amount?: number | null
          beneficiary_name?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          organization_id?: string | null
          status?: string | null
        }
        Update: {
          assistance_amount?: number | null
          beneficiary_name?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          organization_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "welfare_beneficiaries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_storage_admin_adjustments: {
        Row: {
          adjustment_type: Database["public"]["Enums"]["storage_adjustment_type"]
          created_at: string
          created_by_admin: string | null
          delta_gb: number
          expires_at: string | null
          id: string
          reason: string | null
          resulting_bonus_gb: number
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          adjustment_type: Database["public"]["Enums"]["storage_adjustment_type"]
          created_at?: string
          created_by_admin?: string | null
          delta_gb?: number
          expires_at?: string | null
          id?: string
          reason?: string | null
          resulting_bonus_gb?: number
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          adjustment_type?: Database["public"]["Enums"]["storage_adjustment_type"]
          created_at?: string
          created_by_admin?: string | null
          delta_gb?: number
          expires_at?: string | null
          id?: string
          reason?: string | null
          resulting_bonus_gb?: number
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      workspace_storage_entitlements: {
        Row: {
          admin_bonus_storage_gb: number
          auto_expand_enabled: boolean
          billing_status: string
          created_at: string
          effective_from: string
          effective_to: string | null
          grant_reason: string | null
          granted_by: string | null
          hard_stop_threshold_pct: number
          id: string
          included_storage_gb: number
          paid_storage_gb: number
          plan_code: string
          source: string
          storage_addon_blocks: number
          total_storage_gb: number | null
          updated_at: string
          urgent_threshold_pct: number
          user_id: string
          warning_threshold_pct: number
          workspace_id: string | null
        }
        Insert: {
          admin_bonus_storage_gb?: number
          auto_expand_enabled?: boolean
          billing_status?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          grant_reason?: string | null
          granted_by?: string | null
          hard_stop_threshold_pct?: number
          id?: string
          included_storage_gb?: number
          paid_storage_gb?: number
          plan_code?: string
          source?: string
          storage_addon_blocks?: number
          total_storage_gb?: number | null
          updated_at?: string
          urgent_threshold_pct?: number
          user_id: string
          warning_threshold_pct?: number
          workspace_id?: string | null
        }
        Update: {
          admin_bonus_storage_gb?: number
          auto_expand_enabled?: boolean
          billing_status?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          grant_reason?: string | null
          granted_by?: string | null
          hard_stop_threshold_pct?: number
          id?: string
          included_storage_gb?: number
          paid_storage_gb?: number
          plan_code?: string
          source?: string
          storage_addon_blocks?: number
          total_storage_gb?: number | null
          updated_at?: string
          urgent_threshold_pct?: number
          user_id?: string
          warning_threshold_pct?: number
          workspace_id?: string | null
        }
        Relationships: []
      }
      workspace_storage_usage: {
        Row: {
          active_bytes: number
          archived_bytes: number
          billable_bytes: number
          derived_bytes: number
          display_used_bytes: number
          id: string
          last_recalculated_at: string | null
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          active_bytes?: number
          archived_bytes?: number
          billable_bytes?: number
          derived_bytes?: number
          display_used_bytes?: number
          id?: string
          last_recalculated_at?: string | null
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          active_bytes?: number
          archived_bytes?: number
          billable_bytes?: number
          derived_bytes?: number
          display_used_bytes?: number
          id?: string
          last_recalculated_at?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          production_banner:
            | Database["public"]["Enums"]["production_banner"]
            | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          production_banner?:
            | Database["public"]["Enums"]["production_banner"]
            | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          production_banner?:
            | Database["public"]["Enums"]["production_banner"]
            | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      payment_security_events: {
        Row: {
          action_type: string | null
          created_at: string | null
          duration_ms: number | null
          error_message: string | null
          event_category: string | null
          event_id: string | null
          extra: Json | null
          id: string | null
          order_id: string | null
          payment_id: string | null
          severity: string | null
          source: string | null
          user_id: string | null
        }
        Insert: {
          action_type?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          event_category?: never
          event_id?: string | null
          extra?: Json | null
          id?: string | null
          order_id?: string | null
          payment_id?: string | null
          severity?: string | null
          source?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          event_category?: never
          event_id?: string | null
          extra?: Json | null
          id?: string | null
          order_id?: string | null
          payment_id?: string | null
          severity?: string | null
          source?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      studio_vault_products_public: {
        Row: {
          badge: string | null
          billing_modes: Json | null
          code: string | null
          created_at: string | null
          default_tb_options: Json | null
          description: string | null
          enterprise_only: boolean | null
          features: Json | null
          gst_percent: number | null
          id: string | null
          max_tb: number | null
          min_tb: number | null
          name: string | null
          oci_storage_tier: string | null
          self_serve_enabled: boolean | null
          sell_price_per_tb_paise: number | null
          short_pitch: string | null
          sort_order: number | null
          storage_class: string | null
          updated_at: string | null
          visible: boolean | null
        }
        Insert: {
          badge?: string | null
          billing_modes?: Json | null
          code?: string | null
          created_at?: string | null
          default_tb_options?: Json | null
          description?: string | null
          enterprise_only?: boolean | null
          features?: Json | null
          gst_percent?: number | null
          id?: string | null
          max_tb?: number | null
          min_tb?: number | null
          name?: string | null
          oci_storage_tier?: string | null
          self_serve_enabled?: boolean | null
          sell_price_per_tb_paise?: number | null
          short_pitch?: string | null
          sort_order?: number | null
          storage_class?: string | null
          updated_at?: string | null
          visible?: boolean | null
        }
        Update: {
          badge?: string | null
          billing_modes?: Json | null
          code?: string | null
          created_at?: string | null
          default_tb_options?: Json | null
          description?: string | null
          enterprise_only?: boolean | null
          features?: Json | null
          gst_percent?: number | null
          id?: string | null
          max_tb?: number | null
          min_tb?: number | null
          name?: string | null
          oci_storage_tier?: string | null
          self_serve_enabled?: boolean | null
          sell_price_per_tb_paise?: number | null
          short_pitch?: string | null
          sort_order?: number | null
          storage_class?: string | null
          updated_at?: string | null
          visible?: boolean | null
        }
        Relationships: []
      }
      v_kammattam_meter: {
        Row: {
          black_paise: number | null
          white_paise: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _mi_compute_totals: {
        Args: {
          _gst_percent: number
          _line_items: Json
          _tax_inclusive: boolean
        }
        Returns: {
          gst_paise: number
          subtotal_paise: number
          total_paise: number
        }[]
      }
      accept_legal_agreement: {
        Args: {
          p_agreement_type: Database["public"]["Enums"]["legal_agreement_type"]
          p_context?: Json
        }
        Returns: {
          accepted_at: string
          agreement_id: string
          agreement_type: Database["public"]["Enums"]["legal_agreement_type"]
          context: Json
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "legal_acceptances"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_internal_review_note: {
        Args: { _body: string; _title_id: string }
        Returns: string
      }
      add_review_issue: {
        Args: {
          _category_group: string
          _category_key: string
          _category_label: string
          _creator_note?: string
          _internal_note?: string
          _severity?: string
          _stage: string
          _title_id: string
        }
        Returns: string
      }
      admin_adjust_storage: {
        Args: {
          _delta_gb: number
          _expires_at?: string
          _reason?: string
          _type: Database["public"]["Enums"]["storage_adjustment_type"]
          _user_id: string
        }
        Returns: Json
      }
      admin_billing_order_detail: { Args: { _order_id: string }; Returns: Json }
      admin_billing_orders_list: {
        Args: {
          _app_key?: string
          _limit?: number
          _rail?: string
          _status?: string
        }
        Returns: {
          amount_total_paise: number
          app_key: string
          created_at: string
          currency: string
          customer_email: string
          customer_user_id: string
          id: string
          invoice_id: string
          invoice_number: string
          payment_method_mode: string
          payment_trace_id: string
          razorpay_order_id: string
          source_type: string
          status: string
          updated_at: string
        }[]
      }
      admin_close_deal_memo: {
        Args: {
          _deal_id: string
          _status: Database["public"]["Enums"]["deal_status"]
        }
        Returns: {
          amount_paise: number | null
          approval_notes: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          buyer_contact_email: string | null
          buyer_facing_memo: string | null
          buyer_org_name: string | null
          buyer_user_id: string | null
          close_outcome: string | null
          close_reason: string | null
          closed_at: string | null
          closed_by: string | null
          commercial_request_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          deal_type: Database["public"]["Enums"]["deal_type"]
          delivered_at: string | null
          delivery_notes: string | null
          delivery_status: string
          exclusivity: Database["public"]["Enums"]["right_exclusivity"] | null
          id: string
          internal_notes: string | null
          language: string | null
          memo_number: string
          ops_stage: string
          owner_admin_id: string | null
          owner_share_paise: number | null
          owner_share_pct: number | null
          paid_amount_paise: number
          paid_at: string | null
          payment_mode: string | null
          payment_notes: string | null
          payment_reference: string | null
          payment_status: string
          payment_terms: string | null
          platform_share_paise: number | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          right_category: Database["public"]["Enums"]["right_category"] | null
          status: Database["public"]["Enums"]["deal_status"]
          term_end: string | null
          term_start: string | null
          territory: string | null
          title_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "deal_memos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_create_manual_invoice: {
        Args: {
          _document_type: string
          _due_date?: string
          _grants_plan_code?: string
          _grants_until?: string
          _gst_percent?: number
          _line_items: Json
          _notes?: string
          _payment_link_url?: string
          _payment_method?: string
          _support_request_id: string
          _surface: string
          _tax_inclusive?: boolean
          _user_id: string
        }
        Returns: string
      }
      admin_create_screening_invite: {
        Args: {
          _buyer_org_name?: string
          _buyer_user_id?: string
          _commercial_request_id?: string
          _deal_memo_id?: string
          _expires_at?: string
          _invite_email: string
          _invite_name?: string
          _max_views?: number
          _nda_required?: boolean
          _notes?: string
          _playback_url?: string
          _playback_url_expires_at?: string
          _screening_asset_id: string
          _title_id: string
        }
        Returns: {
          id: string
          token: string
        }[]
      }
      admin_deal_close: {
        Args: { _deal_id: string; _outcome: string; _reason?: string }
        Returns: undefined
      }
      admin_deal_link_invoice: {
        Args: { _deal_id: string; _invoice_id: string }
        Returns: undefined
      }
      admin_deal_record_payment: {
        Args: {
          _deal_id: string
          _mode?: string
          _notes?: string
          _paid_amount_paise?: number
          _paid_at?: string
          _reference?: string
          _status: string
        }
        Returns: undefined
      }
      admin_deal_set_approval: {
        Args: { _deal_id: string; _decision: string; _notes?: string }
        Returns: undefined
      }
      admin_deal_upsert_delivery: {
        Args: {
          _deal_id: string
          _delivery_id: string
          _expires_at?: string
          _internal_notes?: string
          _mark_delivered?: boolean
          _method?: string
          _package_notes?: string
          _recipient_email?: string
          _share_url?: string
          _status: string
        }
        Returns: string
      }
      admin_deal_upsert_payout: {
        Args: {
          _basis?: string
          _beneficiary_email?: string
          _beneficiary_label?: string
          _beneficiary_type?: string
          _beneficiary_user_id?: string
          _deal_id: string
          _gross_amount_paise?: number
          _mark_paid?: boolean
          _notes?: string
          _payout_amount_paise?: number
          _payout_id: string
          _platform_share_paise?: number
          _reference?: string
          _share_pct?: number
          _status?: string
        }
        Returns: string
      }
      admin_exists: { Args: never; Returns: boolean }
      admin_extend_screening_invite: {
        Args: {
          _invite_id: string
          _new_expires_at: string
          _new_playback_url?: string
          _new_playback_url_expires_at?: string
        }
        Returns: undefined
      }
      admin_grant_invoice_entitlement: {
        Args: { _invoice_id: string }
        Returns: string
      }
      admin_grant_storage: {
        Args: { _gb: number; _note?: string; _user_id: string }
        Returns: Json
      }
      admin_handle_title_edit_request: {
        Args: {
          _decision: string
          _request_id: string
          _response: string
          _unlock_sections: string[]
        }
        Returns: Json
      }
      admin_issue_manual_invoice: {
        Args: { _invoice_id: string }
        Returns: undefined
      }
      admin_list_creator_storage_risk: {
        Args: never
        Returns: {
          active_blocks: number
          cancelling_tb: number
          email: string
          full_name: string
          halted_blocks: number
          monthly_paise: number
          next_period_end: string
          over_quota: boolean
          plan_tier: string
          projected_over_quota: boolean
          projected_total_gb: number
          total_gb: number
          used_gb: number
          user_id: string
        }[]
      }
      admin_mark_invoice_paid: {
        Args: {
          _invoice_id: string
          _payment_method?: string
          _payment_reference?: string
        }
        Returns: undefined
      }
      admin_mark_order_paid: {
        Args: { _order_id: string; _reason: string }
        Returns: Json
      }
      admin_pending_manual_reviews: {
        Args: { _limit?: number }
        Returns: {
          amount_paid_paise: number
          app_key: string
          bank_name: string
          currency: string
          customer_email: string
          customer_user_id: string
          order_id: string
          order_status: string
          order_total_paise: number
          paid_at: string
          payer_email: string
          payer_name: string
          payer_phone: string
          payment_channel: string
          proof_file_path: string
          remarks: string
          source_type: string
          submission_id: string
          submission_status: string
          submitted_at: string
          utr_or_reference: string
        }[]
      }
      admin_provision_creator_plan: {
        Args: {
          _grant_expires_at?: string
          _manual_invoice_id?: string
          _notes?: string
          _plan_tier: string
          _storage_grant_gb?: number
          _support_request_id: string
          _user_id: string
        }
        Returns: Json
      }
      admin_provision_studio_plan: {
        Args: {
          _manual_invoice_id?: string
          _notes?: string
          _package_label: string
          _support_request_id: string
          _user_id: string
        }
        Returns: Json
      }
      admin_review_manual_payment: {
        Args: {
          _action: string
          _review_notes?: string
          _submission_id: string
        }
        Returns: Json
      }
      admin_review_queue: {
        Args: { _status?: string }
        Returns: {
          approved_at: string
          id: string
          latest_note: string
          locked: boolean
          owner_email: string
          owner_user_id: string
          previous_status: Database["public"]["Enums"]["content_status"]
          published_at: string
          status: Database["public"]["Enums"]["content_status"]
          submitted_at: string
          title: string
          updated_at: string
          workspace_id: string
        }[]
      }
      admin_revoke_screening_invite: {
        Args: { _invite_id: string; _reason?: string }
        Returns: undefined
      }
      admin_studio_vault_purchases: {
        Args: { _limit?: number }
        Returns: {
          amount_inr: number
          billing_interval_months: number
          created_at: string
          customer_email: string
          entitlement_projected_at: string
          invoice_id: string
          invoice_number: string
          product_name: string
          razorpay_order_id: string
          razorpay_payment_id: string
          status: string
          storage_class: string
          tb_added: number
          topup_id: string
          total_paise: number
          updated_at: string
          user_id: string
        }[]
      }
      admin_title_history: {
        Args: { _title_id: string }
        Returns: {
          action: string
          actor_email: string
          actor_user_id: string
          details: Json
          from_status: string
          kind: string
          note: string
          occurred_at: string
          to_status: string
        }[]
      }
      admin_update_manual_invoice: {
        Args: {
          _clear_grant?: boolean
          _due_date?: string
          _grants_plan_code?: string
          _grants_until?: string
          _gst_percent?: number
          _invoice_id: string
          _line_items: Json
          _notes?: string
          _payment_link_url?: string
          _payment_method?: string
          _tax_inclusive?: boolean
        }
        Returns: undefined
      }
      admin_void_manual_invoice: {
        Args: { _invoice_id: string; _reason?: string }
        Returns: undefined
      }
      assert_storage_quota: {
        Args: { _add_bytes: number; _user_id: string }
        Returns: Json
      }
      assign_title_reviewer: {
        Args: { _reviewer: string; _stage: string; _title_id: string }
        Returns: Json
      }
      attach_referral: {
        Args: { _code: string; _email?: string }
        Returns: string
      }
      billing_sync_from_storage_topup: {
        Args: { _topup_id: string }
        Returns: string
      }
      can_signup_as: { Args: { _role: string }; Returns: boolean }
      can_write_workspace: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      claim_admin_if_none: { Args: never; Returns: boolean }
      complete_title_asset_upload: {
        Args: {
          _category: string
          _is_primary?: boolean
          _title_id: string
          _upload_id: string
        }
        Returns: string
      }
      compute_inactive_creator_basic_uploads: {
        Args: { p_days?: number }
        Returns: {
          bucket: string
          file_size: number
          last_accessed_at: string
          namespace: string
          object_key: string
          region: string
          upload_id: string
          user_id: string
          workspace_id: string
        }[]
      }
      create_manual_vault_order: {
        Args: {
          _billing_interval_months: number
          _customer_note?: string
          _payment_mode: string
          _vault_product_id: string
        }
        Returns: Json
      }
      creator_free_tier_status: { Args: { _user_id?: string }; Returns: Json }
      creator_lock_title_on_submit: {
        Args: { _title_id: string }
        Returns: Json
      }
      creator_request_title_edit: {
        Args: {
          _message: string
          _request_type: string
          _sections: string[]
          _title_id: string
        }
        Returns: Json
      }
      creator_resubmit_title: {
        Args: { _note?: string; _title_id: string }
        Returns: Json
      }
      creator_review_feedback: {
        Args: { _title_id: string }
        Returns: {
          category_group: string
          category_label: string
          creator_note: string
          id: string
          raised_at: string
          resolved_at: string
          severity: string
          stage: string
          status: string
        }[]
      }
      current_dashboard_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      deal_memo_check_conflict: {
        Args: { _deal_id: string }
        Returns: {
          conflict_count: number
          sample_memo: string
        }[]
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_archive_job: { Args: { p_upload_id: string }; Returns: string }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      fulfill_billing_order: { Args: { _order_id: string }; Returns: Json }
      get_active_branding: {
        Args: never
        Returns: {
          allow_user_logos: boolean
          footer_logo_position: string
          footer_logo_url: string
          id: string
          show_wordmark: boolean
          site_logo_position: string
          site_logo_url: string
          user_logos_paid_only: boolean
        }[]
      }
      get_canonical_payg_price: { Args: never; Returns: Json }
      get_creator_storage_entitlement: {
        Args: { _user_id: string }
        Returns: {
          active_storage_subscriptions: number
          admin_gb: number
          cancelling_tb: number
          halted_subscriptions: number
          included_gb: number
          monthly_paise: number
          next_period_end: string
          over_quota: boolean
          paid_gb: number
          paid_tb: number
          projected_over_quota_after_cancellations: boolean
          projected_total_gb_after_cancellations: number
          total_gb: number
          used_gb: number
        }[]
      }
      get_payment_method_configs_for_my_order: {
        Args: { _order_id: string }
        Returns: {
          account_number: string
          bank_name: string
          beneficiary_name: string
          branch: string
          display_name: string
          id: string
          ifsc: string
          instructions: string
          qr_image_path: string
          rail: string
          support_contact: string
          upi_id: string
        }[]
      }
      get_workspace_entitlement_snapshot: {
        Args: { p_user_id: string }
        Returns: Json
      }
      get_workspace_storage_entitlement: {
        Args: { _user_id: string }
        Returns: Json
      }
      grant_creator_role: { Args: { _user_id: string }; Returns: undefined }
      has_accepted_agreement: {
        Args: {
          _type: Database["public"]["Enums"]["legal_agreement_type"]
          _user_id: string
        }
        Returns: boolean
      }
      has_admin_permission: {
        Args: {
          _perm: Database["public"]["Enums"]["internal_permission"]
          _user_id: string
        }
        Returns: boolean
      }
      has_premium_storage_entitlement: {
        Args: { _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      invoke_edge_function: { Args: { fn_name: string }; Returns: number }
      is_free_tier_user: { Args: { _user_id: string }; Returns: boolean }
      is_legal_reviewer: { Args: { _user_id: string }; Returns: boolean }
      is_producer_of: {
        Args: { _creator: string; _ep: string }
        Returns: boolean
      }
      is_qc_reviewer: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_workspace_admin: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      list_review_candidates: {
        Args: never
        Returns: {
          email: string
          role: string
          user_id: string
        }[]
      }
      list_shares_for_me: {
        Args: never
        Returns: {
          created_at: string
          download_count: number
          expires_at: string
          filename: string
          has_password: boolean
          id: string
          max_downloads: number
          mime_type: string
          revoked: boolean
          share_token: string
          size_bytes: number
          tier: string
          view_only: boolean
        }[]
      }
      log_onboarding_request_view: {
        Args: { _ids: string[] }
        Returns: undefined
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
      payment_trace_upsert: {
        Args: { p_order_id: string; p_patch: Json }
        Returns: string
      }
      primary_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      project_topup_entitlement: { Args: { _topup_id: string }; Returns: Json }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      realtime_topic_workspace: { Args: { _topic: string }; Returns: string }
      record_payment_trace_event: {
        Args: { p_event: string; p_extra?: Json; p_order_id: string }
        Returns: undefined
      }
      request_creator_link: {
        Args: { _creator_email: string }
        Returns: boolean
      }
      request_title_changes: {
        Args: {
          _creator_summary: string
          _internal_note?: string
          _reasons: Json
          _title_id: string
        }
        Returns: Json
      }
      resolve_review_issue: {
        Args: { _issue_id: string; _resolution_note?: string }
        Returns: Json
      }
      revoke_creator_role: { Args: { _user_id: string }; Returns: undefined }
      screening_log_event: {
        Args: { _kind: string; _progress_pct?: number; _token: string }
        Returns: undefined
      }
      screening_resolve: { Args: { _token: string }; Returns: Json }
      set_initial_role: { Args: { _role: string }; Returns: boolean }
      stage_egress_overage_invoices: {
        Args: { p_period?: string }
        Returns: {
          invoice_id: string
          overage_gb: number
          user_id: string
        }[]
      }
      studio_vault_calculate_price: {
        Args: { _months?: number; _product_id: string; _tb: number }
        Returns: Json
      }
      studio_vault_create_topup: {
        Args: { _months: number; _product_id: string; _tb: number }
        Returns: string
      }
      studio_vault_upsert_product: { Args: { _payload: Json }; Returns: string }
      submit_manual_payment_proof: {
        Args: {
          _amount_paid_paise: number
          _bank_name?: string
          _order_id: string
          _paid_at: string
          _payer_email?: string
          _payer_name?: string
          _payer_phone?: string
          _payment_channel: string
          _proof_file_path?: string
          _remarks?: string
          _utr_or_reference: string
        }
        Returns: Json
      }
      submit_title_to_admin: {
        Args: { _note?: string; _title_id: string }
        Returns: undefined
      }
      sweep_abandoned_topups: {
        Args: { _older_than_hours?: number }
        Returns: Json
      }
      sweep_manual_invoices_overdue: { Args: never; Returns: number }
      sweep_screening_invites_expired: { Args: never; Returns: number }
      title_review_summary: { Args: { _title_id: string }; Returns: Json }
      title_submission_readiness: { Args: { _title_id: string }; Returns: Json }
      title_write_allowed: { Args: { _title_id: string }; Returns: boolean }
      transition_title_status: {
        Args: { _note?: string; _title_id: string; _to_status: string }
        Returns: Json
      }
      upsert_title_checklist_item: {
        Args: {
          _blocking?: boolean
          _item_key: string
          _item_label: string
          _note?: string
          _severity?: string
          _stage: string
          _status: string
          _title_id: string
        }
        Returns: Json
      }
      user_in_banner: {
        Args: {
          _banner: Database["public"]["Enums"]["production_banner"]
          _user_id: string
        }
        Returns: boolean
      }
      validate_razorpay_live_secrets: {
        Args: { _key_secret: string; _webhook_secret: string }
        Returns: Json
      }
    }
    Enums: {
      acquisition_status:
        | "pending"
        | "accepted"
        | "declined"
        | "countered"
        | "withdrawn"
      admin_division: "ops" | "finance" | "dev" | "marketing"
      agent_severity: "info" | "warn" | "critical"
      agent_surface: "home" | "creator" | "studio" | "buyer" | "chief"
      app_role:
        | "admin"
        | "moderator"
        | "user"
        | "executive_producer"
        | "creator"
        | "client"
        | "content_owner"
        | "studio"
        | "buyer"
        | "localization_partner"
        | "distributor"
        | "super_admin"
        | "studio_owner"
        | "studio_manager"
        | "studio_uploader"
        | "studio_reviewer"
        | "studio_archive_manager"
        | "qc_reviewer"
        | "legal_reviewer"
        | "founder"
      billing_attempt_status:
        | "initiated"
        | "succeeded"
        | "failed"
        | "expired"
        | "refunded"
        | "verified"
        | "signature_failed"
      billing_manual_status:
        | "submitted"
        | "under_review"
        | "approved"
        | "rejected"
        | "needs_clarification"
      billing_order_status:
        | "draft"
        | "awaiting_payment"
        | "payment_under_review"
        | "paid"
        | "failed"
        | "cancelled"
        | "expired"
        | "refunded"
      billing_payment_rail:
        | "razorpay"
        | "bank_transfer"
        | "upi_manual"
        | "invoice_offline"
        | "admin_mark_paid"
      commercial_request_state:
        | "pending_admin_review"
        | "awaiting_creator_review"
        | "more_info_required"
        | "rejected"
        | "approved_for_negotiation"
        | "agreement_pending"
        | "delivery_authorized"
        | "closed"
      commercial_request_type:
        | "acquisition"
        | "licensing"
        | "distribution"
        | "screener"
        | "rights_info"
      content_status:
        | "draft"
        | "submitted"
        | "in_review"
        | "changes_requested"
        | "approved"
        | "ready_for_distribution"
        | "locked"
        | "published"
        | "archived"
        | "incomplete"
        | "qc_review"
        | "legal_review"
        | "hold"
        | "rejected"
      deal_mode: "admin_managed" | "creator_managed" | "hybrid"
      deal_status:
        | "draft"
        | "screening_requested"
        | "screening_shared"
        | "negotiating"
        | "offer_sent"
        | "won"
        | "lost"
        | "expired"
        | "cancelled"
      deal_type:
        | "licensing"
        | "screener"
        | "acquisition"
        | "distribution_representation"
        | "rights_information"
      distribution_offer_status:
        | "draft"
        | "offered"
        | "accepted"
        | "rejected"
        | "expired"
        | "cancelled"
      internal_department:
        | "finance"
        | "billing"
        | "audit"
        | "management"
        | "operations"
        | "legal"
        | "qc"
        | "engineering"
      internal_designation:
        | "auditor"
        | "accounts_staff"
        | "billing_staff"
        | "finance_approver"
        | "finance_head"
        | "ca_finance_reviewer"
        | "management_reviewer"
        | "ops_lead"
        | "engineering"
      internal_permission:
        | "finance_read"
        | "finance_admin"
        | "billing_ops"
        | "invoice_approval"
        | "refund_approval"
        | "manual_invoice_write"
        | "subscription_read"
        | "audit_readonly"
        | "finance_reports"
        | "management_reports"
        | "review_ops"
        | "buyer_request_ops"
        | "storage_adjustment_ops"
      internal_staff_status: "invited" | "active" | "suspended"
      legal_agreement_type:
        | "creator_master"
        | "buyer_request_confidentiality"
        | "free_tier_commercial"
        | "screener_access"
        | "antipiracy_addendum"
      plan_assignment_status: "active" | "suspended" | "expired" | "cancelled"
      production_banner: "Crayons Pictures" | "Abhijith Asokan Productions"
      protection_tier: "baseline" | "enhanced" | "forensic"
      right_category:
        | "screening"
        | "digital_ott"
        | "satellite_tv"
        | "theatrical"
        | "airline_nontheatrical"
        | "remake_adaptation"
        | "dubbing_derivative"
        | "distribution_representation"
        | "acquisition"
      right_exclusivity: "exclusive" | "non_exclusive" | "hold" | "unavailable"
      right_status: "available" | "hold" | "sold" | "blocked"
      storage_adjustment_type: "grant" | "reduce" | "set"
      studio_slug:
        | "crayons_pictures"
        | "abhijith_asokan_productions"
        | "independent"
      title_commercial_status:
        | "not_open"
        | "screening_only"
        | "licensing_open"
        | "acquisition_open"
        | "invite_only"
        | "internal_hold"
      title_edit_request_status:
        | "open"
        | "approved"
        | "rejected"
        | "fulfilled"
        | "cancelled"
      title_section_unlock_status: "open" | "closed" | "expired"
      workspace_role: "owner" | "admin" | "editor" | "viewer"
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
      acquisition_status: [
        "pending",
        "accepted",
        "declined",
        "countered",
        "withdrawn",
      ],
      admin_division: ["ops", "finance", "dev", "marketing"],
      agent_severity: ["info", "warn", "critical"],
      agent_surface: ["home", "creator", "studio", "buyer", "chief"],
      app_role: [
        "admin",
        "moderator",
        "user",
        "executive_producer",
        "creator",
        "client",
        "content_owner",
        "studio",
        "buyer",
        "localization_partner",
        "distributor",
        "super_admin",
        "studio_owner",
        "studio_manager",
        "studio_uploader",
        "studio_reviewer",
        "studio_archive_manager",
        "qc_reviewer",
        "legal_reviewer",
        "founder",
      ],
      billing_attempt_status: [
        "initiated",
        "succeeded",
        "failed",
        "expired",
        "refunded",
        "verified",
        "signature_failed",
      ],
      billing_manual_status: [
        "submitted",
        "under_review",
        "approved",
        "rejected",
        "needs_clarification",
      ],
      billing_order_status: [
        "draft",
        "awaiting_payment",
        "payment_under_review",
        "paid",
        "failed",
        "cancelled",
        "expired",
        "refunded",
      ],
      billing_payment_rail: [
        "razorpay",
        "bank_transfer",
        "upi_manual",
        "invoice_offline",
        "admin_mark_paid",
      ],
      commercial_request_state: [
        "pending_admin_review",
        "awaiting_creator_review",
        "more_info_required",
        "rejected",
        "approved_for_negotiation",
        "agreement_pending",
        "delivery_authorized",
        "closed",
      ],
      commercial_request_type: [
        "acquisition",
        "licensing",
        "distribution",
        "screener",
        "rights_info",
      ],
      content_status: [
        "draft",
        "submitted",
        "in_review",
        "changes_requested",
        "approved",
        "ready_for_distribution",
        "locked",
        "published",
        "archived",
        "incomplete",
        "qc_review",
        "legal_review",
        "hold",
        "rejected",
      ],
      deal_mode: ["admin_managed", "creator_managed", "hybrid"],
      deal_status: [
        "draft",
        "screening_requested",
        "screening_shared",
        "negotiating",
        "offer_sent",
        "won",
        "lost",
        "expired",
        "cancelled",
      ],
      deal_type: [
        "licensing",
        "screener",
        "acquisition",
        "distribution_representation",
        "rights_information",
      ],
      distribution_offer_status: [
        "draft",
        "offered",
        "accepted",
        "rejected",
        "expired",
        "cancelled",
      ],
      internal_department: [
        "finance",
        "billing",
        "audit",
        "management",
        "operations",
        "legal",
        "qc",
        "engineering",
      ],
      internal_designation: [
        "auditor",
        "accounts_staff",
        "billing_staff",
        "finance_approver",
        "finance_head",
        "ca_finance_reviewer",
        "management_reviewer",
        "ops_lead",
        "engineering",
      ],
      internal_permission: [
        "finance_read",
        "finance_admin",
        "billing_ops",
        "invoice_approval",
        "refund_approval",
        "manual_invoice_write",
        "subscription_read",
        "audit_readonly",
        "finance_reports",
        "management_reports",
        "review_ops",
        "buyer_request_ops",
        "storage_adjustment_ops",
      ],
      internal_staff_status: ["invited", "active", "suspended"],
      legal_agreement_type: [
        "creator_master",
        "buyer_request_confidentiality",
        "free_tier_commercial",
        "screener_access",
        "antipiracy_addendum",
      ],
      plan_assignment_status: ["active", "suspended", "expired", "cancelled"],
      production_banner: ["Crayons Pictures", "Abhijith Asokan Productions"],
      protection_tier: ["baseline", "enhanced", "forensic"],
      right_category: [
        "screening",
        "digital_ott",
        "satellite_tv",
        "theatrical",
        "airline_nontheatrical",
        "remake_adaptation",
        "dubbing_derivative",
        "distribution_representation",
        "acquisition",
      ],
      right_exclusivity: ["exclusive", "non_exclusive", "hold", "unavailable"],
      right_status: ["available", "hold", "sold", "blocked"],
      storage_adjustment_type: ["grant", "reduce", "set"],
      studio_slug: [
        "crayons_pictures",
        "abhijith_asokan_productions",
        "independent",
      ],
      title_commercial_status: [
        "not_open",
        "screening_only",
        "licensing_open",
        "acquisition_open",
        "invite_only",
        "internal_hold",
      ],
      title_edit_request_status: [
        "open",
        "approved",
        "rejected",
        "fulfilled",
        "cancelled",
      ],
      title_section_unlock_status: ["open", "closed", "expired"],
      workspace_role: ["owner", "admin", "editor", "viewer"],
    },
  },
} as const
