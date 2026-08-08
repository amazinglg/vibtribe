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
      apk_download_events: {
        Row: {
          created_at: string
          id: string
          ip_hash: string | null
          referrer: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip_hash?: string | null
          referrer?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip_hash?: string | null
          referrer?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      app_releases: {
        Row: {
          id: string
          note: string | null
          released_at: string
          released_by: string | null
          version: string
        }
        Insert: {
          id?: string
          note?: string | null
          released_at?: string
          released_by?: string | null
          version: string
        }
        Update: {
          id?: string
          note?: string | null
          released_at?: string
          released_by?: string | null
          version?: string
        }
        Relationships: []
      }
      app_roles: {
        Row: {
          created_at: string
          description: string | null
          is_system: boolean
          key: string
          label: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          is_system?: boolean
          key: string
          label: string
        }
        Update: {
          created_at?: string
          description?: string | null
          is_system?: boolean
          key?: string
          label?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Relationships: []
      }
      blocked_signups: {
        Row: {
          blocked_at: string
          email_lower: string | null
          id: string
          mobile_hash: string | null
          notes: string | null
          reason: string
          source_user_id: string | null
          unblocked_at: string | null
          unblocked_by: string | null
        }
        Insert: {
          blocked_at?: string
          email_lower?: string | null
          id?: string
          mobile_hash?: string | null
          notes?: string | null
          reason?: string
          source_user_id?: string | null
          unblocked_at?: string | null
          unblocked_by?: string | null
        }
        Update: {
          blocked_at?: string
          email_lower?: string | null
          id?: string
          mobile_hash?: string | null
          notes?: string | null
          reason?: string
          source_user_id?: string | null
          unblocked_at?: string | null
          unblocked_by?: string | null
        }
        Relationships: []
      }
      blocked_users: {
        Row: {
          blocked_user_id: string
          blocker_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          blocked_user_id: string
          blocker_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          blocked_user_id?: string
          blocker_id?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_users_blocked_user_id_fkey"
            columns: ["blocked_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_users_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_messages: {
        Row: {
          attachment_type: string | null
          attachment_url: string | null
          content: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "broadcast_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          accepted_at: string | null
          call_type: string
          callee_id: string
          caller_id: string
          chat_id: string | null
          created_at: string
          ended_at: string | null
          id: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          call_type: string
          callee_id: string
          caller_id: string
          chat_id?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          call_type?: string
          callee_id?: string
          caller_id?: string
          chat_id?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          status?: string
        }
        Relationships: []
      }
      chat_members: {
        Row: {
          chat_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          chat_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          chat_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_members_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_members_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "tribe_public"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_mutes: {
        Row: {
          chat_id: string
          created_at: string
          id: string
          muted_until: string | null
          user_id: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          id?: string
          muted_until?: string | null
          user_id: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          id?: string
          muted_until?: string | null
          user_id?: string
        }
        Relationships: []
      }
      chats: {
        Row: {
          avatar_url: string | null
          chat_type: Database["public"]["Enums"]["chat_type"] | null
          created_at: string | null
          created_by: string | null
          description: string | null
          disappear_mode: string
          handle: string | null
          id: string
          is_group: boolean
          name: string | null
          participant_one: string | null
          participant_two: string | null
          privacy: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          chat_type?: Database["public"]["Enums"]["chat_type"] | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          disappear_mode?: string
          handle?: string | null
          id?: string
          is_group?: boolean
          name?: string | null
          participant_one?: string | null
          participant_two?: string | null
          privacy?: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          chat_type?: Database["public"]["Enums"]["chat_type"] | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          disappear_mode?: string
          handle?: string | null
          id?: string
          is_group?: boolean
          name?: string | null
          participant_one?: string | null
          participant_two?: string | null
          privacy?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chats_participant_one_fkey"
            columns: ["participant_one"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_participant_two_fkey"
            columns: ["participant_two"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_log: {
        Row: {
          accepted_at: string
          consent_type: string
          created_at: string
          id: string
          ip: string | null
          policy_version: string
          user_agent: string | null
          user_id: string
          withdrawn_at: string | null
        }
        Insert: {
          accepted_at?: string
          consent_type: string
          created_at?: string
          id?: string
          ip?: string | null
          policy_version: string
          user_agent?: string | null
          user_id: string
          withdrawn_at?: string | null
        }
        Update: {
          accepted_at?: string
          consent_type?: string
          created_at?: string
          id?: string
          ip?: string | null
          policy_version?: string
          user_agent?: string | null
          user_id?: string
          withdrawn_at?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          contact_id: string
          contact_name: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          contact_id: string
          contact_name?: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          contact_id?: string
          contact_name?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      content_reports: {
        Row: {
          action_taken: string | null
          chat_id: string | null
          comments: string | null
          created_at: string
          id: string
          message_id: string | null
          moderated_at: string | null
          moderator_id: string | null
          moderator_notes: string | null
          priority: number
          reason: Database["public"]["Enums"]["report_reason"]
          report_type: Database["public"]["Enums"]["report_type"]
          reported_user_id: string | null
          reported_user_name: string | null
          reporter_id: string
          reporter_name: string | null
          snapshot: Json
          status: Database["public"]["Enums"]["report_status"]
          status_id: string | null
          target_ref: string | null
          updated_at: string
        }
        Insert: {
          action_taken?: string | null
          chat_id?: string | null
          comments?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          moderated_at?: string | null
          moderator_id?: string | null
          moderator_notes?: string | null
          priority?: number
          reason: Database["public"]["Enums"]["report_reason"]
          report_type: Database["public"]["Enums"]["report_type"]
          reported_user_id?: string | null
          reported_user_name?: string | null
          reporter_id: string
          reporter_name?: string | null
          snapshot?: Json
          status?: Database["public"]["Enums"]["report_status"]
          status_id?: string | null
          target_ref?: string | null
          updated_at?: string
        }
        Update: {
          action_taken?: string | null
          chat_id?: string | null
          comments?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          moderated_at?: string | null
          moderator_id?: string | null
          moderator_notes?: string | null
          priority?: number
          reason?: Database["public"]["Enums"]["report_reason"]
          report_type?: Database["public"]["Enums"]["report_type"]
          reported_user_id?: string | null
          reported_user_name?: string | null
          reporter_id?: string
          reporter_name?: string | null
          snapshot?: Json
          status?: Database["public"]["Enums"]["report_status"]
          status_id?: string | null
          target_ref?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      data_export_requests: {
        Row: {
          byte_size: number | null
          completed_at: string | null
          created_at: string
          delivered_to_email: string | null
          error: string | null
          id: string
          status: string
          user_id: string
        }
        Insert: {
          byte_size?: number | null
          completed_at?: string | null
          created_at?: string
          delivered_to_email?: string | null
          error?: string | null
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          byte_size?: number | null
          completed_at?: string | null
          created_at?: string
          delivered_to_email?: string | null
          error?: string | null
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      deleted_users_log: {
        Row: {
          country_code: string | null
          deleted_at: string
          email: string | null
          full_name: string | null
          id: string
          initiated_by: string
          initiator_id: string | null
          mobile_hash: string | null
          mobile_number: string | null
          original_user_id: string
          reason_key: string
          reason_text: string | null
          terms_breach: boolean
        }
        Insert: {
          country_code?: string | null
          deleted_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          initiated_by: string
          initiator_id?: string | null
          mobile_hash?: string | null
          mobile_number?: string | null
          original_user_id: string
          reason_key: string
          reason_text?: string | null
          terms_breach?: boolean
        }
        Update: {
          country_code?: string | null
          deleted_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          initiated_by?: string
          initiator_id?: string | null
          mobile_hash?: string | null
          mobile_number?: string | null
          original_user_id?: string
          reason_key?: string
          reason_text?: string | null
          terms_breach?: boolean
        }
        Relationships: []
      }
      email_campaign_recipients: {
        Row: {
          campaign_id: string
          created_at: string
          email: string
          error_message: string | null
          id: string
          resend_message_id: string | null
          sent_at: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          email: string
          error_message?: string | null
          id?: string
          resend_message_id?: string | null
          sent_at?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          email?: string
          error_message?: string | null
          id?: string
          resend_message_id?: string | null
          sent_at?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          audience_filter: Json
          banner_image_url: string | null
          content_html: string
          created_at: string
          created_by: string
          failed_count: number
          id: string
          preheader: string | null
          sent_at: string | null
          sent_count: number
          status: string
          subject: string
          total_recipients: number
          updated_at: string
        }
        Insert: {
          audience_filter?: Json
          banner_image_url?: string | null
          content_html?: string
          created_at?: string
          created_by: string
          failed_count?: number
          id?: string
          preheader?: string | null
          sent_at?: string | null
          sent_count?: number
          status?: string
          subject: string
          total_recipients?: number
          updated_at?: string
        }
        Update: {
          audience_filter?: Json
          banner_image_url?: string | null
          content_html?: string
          created_at?: string
          created_by?: string
          failed_count?: number
          id?: string
          preheader?: string | null
          sent_at?: string | null
          sent_count?: number
          status?: string
          subject?: string
          total_recipients?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_otp_codes: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          email: string
          excluded_from_count: boolean
          expires_at: string
          id: string
          purpose: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          email: string
          excluded_from_count?: boolean
          expires_at?: string
          id?: string
          purpose: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          email?: string
          excluded_from_count?: boolean
          expires_at?: string
          id?: string
          purpose?: string
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
      fcm_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      force_logout_tokens: {
        Row: {
          id: string
          issued_at: string
          issued_by: string | null
          session_id: string | null
          user_id: string
        }
        Insert: {
          id?: string
          issued_at?: string
          issued_by?: string | null
          session_id?: string | null
          user_id: string
        }
        Update: {
          id?: string
          issued_at?: string
          issued_by?: string | null
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "force_logout_tokens_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "force_logout_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guardian_consents: {
        Row: {
          consent_token: string
          consent_version: string
          consented_at: string | null
          created_at: string
          email_otp_attempts: number
          email_otp_expires_at: string | null
          email_otp_hash: string | null
          email_verified_at: string | null
          graduated_at: string | null
          guardian_email: string
          guardian_mobile: string
          guardian_name: string
          id: string
          ip: string | null
          last_reminder_at: string | null
          last_reminder_sent_at: string | null
          minor_user_id: string
          relationship: string
          revoked_at: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          consent_token: string
          consent_version?: string
          consented_at?: string | null
          created_at?: string
          email_otp_attempts?: number
          email_otp_expires_at?: string | null
          email_otp_hash?: string | null
          email_verified_at?: string | null
          graduated_at?: string | null
          guardian_email: string
          guardian_mobile: string
          guardian_name: string
          id?: string
          ip?: string | null
          last_reminder_at?: string | null
          last_reminder_sent_at?: string | null
          minor_user_id: string
          relationship: string
          revoked_at?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          consent_token?: string
          consent_version?: string
          consented_at?: string | null
          created_at?: string
          email_otp_attempts?: number
          email_otp_expires_at?: string | null
          email_otp_hash?: string | null
          email_verified_at?: string | null
          graduated_at?: string | null
          guardian_email?: string
          guardian_mobile?: string
          guardian_name?: string
          id?: string
          ip?: string | null
          last_reminder_at?: string | null
          last_reminder_sent_at?: string | null
          minor_user_id?: string
          relationship?: string
          revoked_at?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      message_tombstones: {
        Row: {
          chat_id: string
          deleted_at: string
          id: string
        }
        Insert: {
          chat_id: string
          deleted_at?: string
          id: string
        }
        Update: {
          chat_id?: string
          deleted_at?: string
          id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          chat_id: string | null
          content: string
          created_at: string | null
          deleted_for: string[]
          deleted_for_everyone: boolean
          edited_at: string | null
          expires_at: string | null
          id: string
          message_status: Database["public"]["Enums"]["message_status"] | null
          message_type: string
          reactions: Json | null
          reply_to: string | null
          sender_id: string | null
          updated_at: string
        }
        Insert: {
          chat_id?: string | null
          content: string
          created_at?: string | null
          deleted_for?: string[]
          deleted_for_everyone?: boolean
          edited_at?: string | null
          expires_at?: string | null
          id?: string
          message_status?: Database["public"]["Enums"]["message_status"] | null
          message_type?: string
          reactions?: Json | null
          reply_to?: string | null
          sender_id?: string | null
          updated_at?: string
        }
        Update: {
          chat_id?: string | null
          content?: string
          created_at?: string | null
          deleted_for?: string[]
          deleted_for_everyone?: boolean
          edited_at?: string | null
          expires_at?: string | null
          id?: string
          message_status?: Database["public"]["Enums"]["message_status"] | null
          message_type?: string
          reactions?: Json | null
          reply_to?: string | null
          sender_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "tribe_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          ip: string | null
          moderator_id: string
          moderator_name: string | null
          notes: string | null
          report_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip?: string | null
          moderator_id: string
          moderator_name?: string | null
          notes?: string | null
          report_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip?: string | null
          moderator_id?: string
          moderator_name?: string | null
          notes?: string | null
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_audit_log_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "content_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          related_user_id: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          related_user_id?: string | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          related_user_id?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_user_id_fkey"
            columns: ["related_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      offboarding_appeals: {
        Row: {
          appellant_email: string | null
          appellant_name: string | null
          block_id: string | null
          created_at: string
          id: string
          original_user_id: string | null
          reason: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_notes: string | null
          status: string
          submitted_at: string | null
          token: string
        }
        Insert: {
          appellant_email?: string | null
          appellant_name?: string | null
          block_id?: string | null
          created_at?: string
          id?: string
          original_user_id?: string | null
          reason?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          status?: string
          submitted_at?: string | null
          token: string
        }
        Update: {
          appellant_email?: string | null
          appellant_name?: string | null
          block_id?: string | null
          created_at?: string
          id?: string
          original_user_id?: string | null
          reason?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          status?: string
          submitted_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "offboarding_appeals_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocked_signups"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_keys: {
        Row: {
          category: string
          description: string | null
          key: string
          label: string
          sort_order: number
        }
        Insert: {
          category: string
          description?: string | null
          key: string
          label: string
          sort_order?: number
        }
        Update: {
          category?: string
          description?: string | null
          key?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          count: number
          created_at: string
          expires_at: string
          id: string
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          created_at?: string
          expires_at: string
          id?: string
          key: string
          window_start: string
        }
        Update: {
          count?: number
          created_at?: string
          expires_at?: string
          id?: string
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      report_appeals: {
        Row: {
          appellant_id: string
          created_at: string
          id: string
          reason: string
          report_id: string
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_notes: string | null
          status: Database["public"]["Enums"]["appeal_status"]
          updated_at: string
        }
        Insert: {
          appellant_id: string
          created_at?: string
          id?: string
          reason: string
          report_id: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["appeal_status"]
          updated_at?: string
        }
        Update: {
          appellant_id?: string
          created_at?: string
          id?: string
          reason?: string
          report_id?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["appeal_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_appeals_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "content_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          allowed: boolean
          permission_key: string
          role_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allowed?: boolean
          permission_key: string
          role_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allowed?: boolean
          permission_key?: string
          role_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permission_keys"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "role_permissions_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "app_roles"
            referencedColumns: ["key"]
          },
        ]
      }
      status_likes: {
        Row: {
          created_at: string
          id: string
          liker_id: string
          status_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          liker_id: string
          status_id: string
        }
        Update: {
          created_at?: string
          id?: string
          liker_id?: string
          status_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_likes_liker_id_fkey"
            columns: ["liker_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_likes_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      status_views: {
        Row: {
          id: string
          status_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          id?: string
          status_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          id?: string
          status_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_views_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      statuses: {
        Row: {
          background_color: string | null
          content: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          media_type: string | null
          media_url: string | null
          selected_viewers: string[] | null
          user_id: string | null
          view_count: number | null
          visibility: string | null
        }
        Insert: {
          background_color?: string | null
          content?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          selected_viewers?: string[] | null
          user_id?: string | null
          view_count?: number | null
          visibility?: string | null
        }
        Update: {
          background_color?: string | null
          content?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          selected_viewers?: string[] | null
          user_id?: string | null
          view_count?: number | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "statuses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subprocessor_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      support_ticket_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          sender_id: string | null
          sender_name: string | null
          sender_type: string
          ticket_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sender_id?: string | null
          sender_name?: string | null
          sender_type: string
          ticket_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sender_id?: string | null
          sender_name?: string | null
          sender_type?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_reply: string | null
          category: string | null
          country_code_snapshot: string | null
          created_at: string | null
          email: string
          id: string
          is_external: boolean
          issue_description: string
          issue_title: string
          mobile_snapshot: string | null
          name: string
          replied_at: string | null
          ticket_status: Database["public"]["Enums"]["ticket_status"] | null
          updated_at: string | null
          user_id: string | null
          username_snapshot: string | null
        }
        Insert: {
          admin_reply?: string | null
          category?: string | null
          country_code_snapshot?: string | null
          created_at?: string | null
          email: string
          id?: string
          is_external?: boolean
          issue_description: string
          issue_title: string
          mobile_snapshot?: string | null
          name: string
          replied_at?: string | null
          ticket_status?: Database["public"]["Enums"]["ticket_status"] | null
          updated_at?: string | null
          user_id?: string | null
          username_snapshot?: string | null
        }
        Update: {
          admin_reply?: string | null
          category?: string | null
          country_code_snapshot?: string | null
          created_at?: string | null
          email?: string
          id?: string
          is_external?: boolean
          issue_description?: string
          issue_title?: string
          mobile_snapshot?: string | null
          name?: string
          replied_at?: string | null
          ticket_status?: Database["public"]["Enums"]["ticket_status"] | null
          updated_at?: string | null
          user_id?: string | null
          username_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
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
      tribe_invites: {
        Row: {
          chat_id: string
          code: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          revoked_at: string | null
        }
        Insert: {
          chat_id: string
          code: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          revoked_at?: string | null
        }
        Update: {
          chat_id?: string
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          revoked_at?: string | null
        }
        Relationships: []
      }
      tribe_join_requests: {
        Row: {
          chat_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          status: string
          user_id: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      trust_locks: {
        Row: {
          chat_id: string
          created_at: string
          enabled: boolean
          enabled_at: string | null
          owner_user_id: string | null
          updated_at: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          enabled?: boolean
          enabled_at?: string | null
          owner_user_id?: string | null
          updated_at?: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          enabled?: boolean
          enabled_at?: string | null
          owner_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trust_locks_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: true
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trust_locks_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: true
            referencedRelation: "tribe_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_active_chat: {
        Row: {
          chat_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          chat_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          chat_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_consents: {
        Row: {
          created_at: string
          granted: boolean
          granted_at: string | null
          id: string
          purpose: string
          source: string | null
          updated_at: string
          user_id: string
          withdrawn_at: string | null
        }
        Insert: {
          created_at?: string
          granted?: boolean
          granted_at?: string | null
          id?: string
          purpose: string
          source?: string | null
          updated_at?: string
          user_id: string
          withdrawn_at?: string | null
        }
        Update: {
          created_at?: string
          granted?: boolean
          granted_at?: string | null
          id?: string
          purpose?: string
          source?: string | null
          updated_at?: string
          user_id?: string
          withdrawn_at?: string | null
        }
        Relationships: []
      }
      user_hidden_chats: {
        Row: {
          chat_id: string
          hidden_at: string
          user_id: string
        }
        Insert: {
          chat_id: string
          hidden_at?: string
          user_id: string
        }
        Update: {
          chat_id?: string
          hidden_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_hidden_chats_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_hidden_chats_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "tribe_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["user_status"] | null
          app_theme: string | null
          avatar_url: string | null
          bio: string | null
          country_code: string | null
          created_at: string | null
          dob: string | null
          email: string
          email_marketing_opt_in: boolean
          full_name: string
          id: string
          inactivity_final_warning_sent_at: string | null
          inactivity_warning_sent_at: string | null
          is_master_admin: boolean
          is_online: boolean | null
          is_premium: boolean
          is_suspended: boolean | null
          is_verified: boolean
          key_setup_completed: boolean
          last_seen: string | null
          login_attempts: number | null
          marketing_consent_at: string | null
          marketing_consent_ip: string | null
          marketing_consent_source: string | null
          max_privacy_mode: boolean
          media_cache_limit_mb: number
          mobile_hash: string | null
          mobile_number: string | null
          mobile_verified_at: string | null
          notif_mentions: boolean
          notif_messages: boolean
          notif_secure_chats: boolean
          notif_sounds: boolean
          notif_status: boolean
          pref_camera_enabled: boolean
          pref_contacts_enabled: boolean
          pref_mic_enabled: boolean
          pref_notifications_enabled: boolean
          premium_expires_at: string | null
          premium_granted_at: string | null
          premium_granted_by: string | null
          premium_source: string | null
          privacy_accepted_at: string | null
          profile_completed: boolean | null
          profile_photo_allowed_viewers: string[]
          profile_photo_visibility: string
          public_key: string | null
          real_email: string | null
          role: string
          signup_reminder_last_sent_at: string | null
          signup_reminders_sent: number
          status_allowed_viewers: string[]
          status_visibility: string
          terms_accepted_at: string | null
          terms_warning_sent_at: string | null
          totp_enabled: boolean
          totp_enabled_at: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["user_status"] | null
          app_theme?: string | null
          avatar_url?: string | null
          bio?: string | null
          country_code?: string | null
          created_at?: string | null
          dob?: string | null
          email: string
          email_marketing_opt_in?: boolean
          full_name?: string
          id: string
          inactivity_final_warning_sent_at?: string | null
          inactivity_warning_sent_at?: string | null
          is_master_admin?: boolean
          is_online?: boolean | null
          is_premium?: boolean
          is_suspended?: boolean | null
          is_verified?: boolean
          key_setup_completed?: boolean
          last_seen?: string | null
          login_attempts?: number | null
          marketing_consent_at?: string | null
          marketing_consent_ip?: string | null
          marketing_consent_source?: string | null
          max_privacy_mode?: boolean
          media_cache_limit_mb?: number
          mobile_hash?: string | null
          mobile_number?: string | null
          mobile_verified_at?: string | null
          notif_mentions?: boolean
          notif_messages?: boolean
          notif_secure_chats?: boolean
          notif_sounds?: boolean
          notif_status?: boolean
          pref_camera_enabled?: boolean
          pref_contacts_enabled?: boolean
          pref_mic_enabled?: boolean
          pref_notifications_enabled?: boolean
          premium_expires_at?: string | null
          premium_granted_at?: string | null
          premium_granted_by?: string | null
          premium_source?: string | null
          privacy_accepted_at?: string | null
          profile_completed?: boolean | null
          profile_photo_allowed_viewers?: string[]
          profile_photo_visibility?: string
          public_key?: string | null
          real_email?: string | null
          role?: string
          signup_reminder_last_sent_at?: string | null
          signup_reminders_sent?: number
          status_allowed_viewers?: string[]
          status_visibility?: string
          terms_accepted_at?: string | null
          terms_warning_sent_at?: string | null
          totp_enabled?: boolean
          totp_enabled_at?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          account_status?: Database["public"]["Enums"]["user_status"] | null
          app_theme?: string | null
          avatar_url?: string | null
          bio?: string | null
          country_code?: string | null
          created_at?: string | null
          dob?: string | null
          email?: string
          email_marketing_opt_in?: boolean
          full_name?: string
          id?: string
          inactivity_final_warning_sent_at?: string | null
          inactivity_warning_sent_at?: string | null
          is_master_admin?: boolean
          is_online?: boolean | null
          is_premium?: boolean
          is_suspended?: boolean | null
          is_verified?: boolean
          key_setup_completed?: boolean
          last_seen?: string | null
          login_attempts?: number | null
          marketing_consent_at?: string | null
          marketing_consent_ip?: string | null
          marketing_consent_source?: string | null
          max_privacy_mode?: boolean
          media_cache_limit_mb?: number
          mobile_hash?: string | null
          mobile_number?: string | null
          mobile_verified_at?: string | null
          notif_mentions?: boolean
          notif_messages?: boolean
          notif_secure_chats?: boolean
          notif_sounds?: boolean
          notif_status?: boolean
          pref_camera_enabled?: boolean
          pref_contacts_enabled?: boolean
          pref_mic_enabled?: boolean
          pref_notifications_enabled?: boolean
          premium_expires_at?: string | null
          premium_granted_at?: string | null
          premium_granted_by?: string | null
          premium_source?: string | null
          privacy_accepted_at?: string | null
          profile_completed?: boolean | null
          profile_photo_allowed_viewers?: string[]
          profile_photo_visibility?: string
          public_key?: string | null
          real_email?: string | null
          role?: string
          signup_reminder_last_sent_at?: string | null
          signup_reminders_sent?: number
          status_allowed_viewers?: string[]
          status_visibility?: string
          terms_accepted_at?: string | null
          terms_warning_sent_at?: string | null
          totp_enabled?: boolean
          totp_enabled_at?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      user_profiles_private: {
        Row: {
          encrypted_private_key: string | null
          id: string
          key_iv: string | null
          key_salt: string | null
          totp_pending_secret: string | null
          totp_secret: string | null
          updated_at: string
        }
        Insert: {
          encrypted_private_key?: string | null
          id: string
          key_iv?: string | null
          key_salt?: string | null
          totp_pending_secret?: string | null
          totp_secret?: string | null
          updated_at?: string
        }
        Update: {
          encrypted_private_key?: string | null
          id?: string
          key_iv?: string | null
          key_salt?: string | null
          totp_pending_secret?: string | null
          totp_secret?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_private_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_secure_chats: {
        Row: {
          chat_id: string
          code_hash: string | null
          created_at: string
          user_id: string
        }
        Insert: {
          chat_id: string
          code_hash?: string | null
          created_at?: string
          user_id: string
        }
        Update: {
          chat_id?: string
          code_hash?: string | null
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          app_version: string | null
          created_at: string
          device_id: string
          device_name: string
          id: string
          last_seen_at: string
          platform: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          device_id: string
          device_name?: string
          id?: string
          last_seen_at?: string
          platform?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          app_version?: string | null
          created_at?: string
          device_id?: string
          device_name?: string
          id?: string
          last_seen_at?: string
          platform?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      app_releases_public: {
        Row: {
          id: string | null
          released_at: string | null
          version: string | null
        }
        Insert: {
          id?: string | null
          released_at?: string | null
          version?: string | null
        }
        Update: {
          id?: string | null
          released_at?: string | null
          version?: string | null
        }
        Relationships: []
      }
      tribe_public: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          handle: string | null
          id: string | null
          member_count: number | null
          name: string | null
          privacy: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          handle?: string | null
          id?: string | null
          member_count?: never
          name?: string | null
          privacy?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          handle?: string | null
          id?: string | null
          member_count?: never
          name?: string | null
          privacy?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _base32_decode: { Args: { _input: string }; Returns: string }
      _hash_otp: { Args: { _code: string }; Returns: string }
      _hotp: { Args: { _counter: number; _secret: string }; Returns: string }
      _insert_tribe_system_message: {
        Args: { _chat_id: string; _content: string }
        Returns: undefined
      }
      _my_profile_guard: {
        Args: never
        Returns: {
          account_status: string
          is_master_admin: boolean
          is_suspended: boolean
          role: string
        }[]
      }
      _profile_guard: {
        Args: { _id: string }
        Returns: {
          account_status: string
          is_master_admin: boolean
          is_suspended: boolean
          role: string
        }[]
      }
      accept_privacy_and_terms: { Args: never; Returns: undefined }
      accept_terms: { Args: never; Returns: undefined }
      admin_delete_deleted_user_log: {
        Args: { _id: string }
        Returns: undefined
      }
      admin_delete_report: { Args: { _report_id: string }; Returns: undefined }
      admin_delete_ticket: { Args: { _ticket_id: string }; Returns: undefined }
      admin_delete_user: {
        Args: {
          _appeal_token?: string
          _reason_key?: string
          _reason_text?: string
          _user_id: string
        }
        Returns: Json
      }
      admin_get_guardian_consent: {
        Args: { _user_id: string }
        Returns: {
          consent_token: string
          consent_version: string
          consented_at: string | null
          created_at: string
          email_otp_attempts: number
          email_otp_expires_at: string | null
          email_otp_hash: string | null
          email_verified_at: string | null
          graduated_at: string | null
          guardian_email: string
          guardian_mobile: string
          guardian_name: string
          id: string
          ip: string | null
          last_reminder_at: string | null
          last_reminder_sent_at: string | null
          minor_user_id: string
          relationship: string
          revoked_at: string | null
          updated_at: string
          user_agent: string | null
        }
        SetofOptions: {
          from: "*"
          to: "guardian_consents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_get_totp_secret_by_identifier: {
        Args: { _identifier: string }
        Returns: string
      }
      admin_get_user_profile: {
        Args: { _user_id: string }
        Returns: {
          account_status: Database["public"]["Enums"]["user_status"] | null
          app_theme: string | null
          avatar_url: string | null
          bio: string | null
          country_code: string | null
          created_at: string | null
          dob: string | null
          email: string
          email_marketing_opt_in: boolean
          full_name: string
          id: string
          inactivity_final_warning_sent_at: string | null
          inactivity_warning_sent_at: string | null
          is_master_admin: boolean
          is_online: boolean | null
          is_premium: boolean
          is_suspended: boolean | null
          is_verified: boolean
          key_setup_completed: boolean
          last_seen: string | null
          login_attempts: number | null
          marketing_consent_at: string | null
          marketing_consent_ip: string | null
          marketing_consent_source: string | null
          max_privacy_mode: boolean
          media_cache_limit_mb: number
          mobile_hash: string | null
          mobile_number: string | null
          mobile_verified_at: string | null
          notif_mentions: boolean
          notif_messages: boolean
          notif_secure_chats: boolean
          notif_sounds: boolean
          notif_status: boolean
          pref_camera_enabled: boolean
          pref_contacts_enabled: boolean
          pref_mic_enabled: boolean
          pref_notifications_enabled: boolean
          premium_expires_at: string | null
          premium_granted_at: string | null
          premium_granted_by: string | null
          premium_source: string | null
          privacy_accepted_at: string | null
          profile_completed: boolean | null
          profile_photo_allowed_viewers: string[]
          profile_photo_visibility: string
          public_key: string | null
          real_email: string | null
          role: string
          signup_reminder_last_sent_at: string | null
          signup_reminders_sent: number
          status_allowed_viewers: string[]
          status_visibility: string
          terms_accepted_at: string | null
          terms_warning_sent_at: string | null
          totp_enabled: boolean
          totp_enabled_at: string | null
          updated_at: string | null
          username: string | null
        }
        SetofOptions: {
          from: "*"
          to: "user_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_list_premium_users: {
        Args: never
        Returns: {
          avatar_url: string
          country_code: string
          created_at: string
          full_name: string
          id: string
          is_premium: boolean
          mobile_number: string
          premium_expires_at: string
          premium_granted_at: string
          premium_granted_by: string
          premium_source: string
          real_email: string
          username: string
        }[]
      }
      admin_list_tribes: {
        Args: never
        Returns: {
          avatar_url: string
          created_at: string
          created_by: string
          founder_name: string
          handle: string
          id: string
          member_count: number
          name: string
          privacy: string
        }[]
      }
      admin_list_user_profiles: {
        Args: never
        Returns: {
          account_status: Database["public"]["Enums"]["user_status"] | null
          app_theme: string | null
          avatar_url: string | null
          bio: string | null
          country_code: string | null
          created_at: string | null
          dob: string | null
          email: string
          email_marketing_opt_in: boolean
          full_name: string
          id: string
          inactivity_final_warning_sent_at: string | null
          inactivity_warning_sent_at: string | null
          is_master_admin: boolean
          is_online: boolean | null
          is_premium: boolean
          is_suspended: boolean | null
          is_verified: boolean
          key_setup_completed: boolean
          last_seen: string | null
          login_attempts: number | null
          marketing_consent_at: string | null
          marketing_consent_ip: string | null
          marketing_consent_source: string | null
          max_privacy_mode: boolean
          media_cache_limit_mb: number
          mobile_hash: string | null
          mobile_number: string | null
          mobile_verified_at: string | null
          notif_mentions: boolean
          notif_messages: boolean
          notif_secure_chats: boolean
          notif_sounds: boolean
          notif_status: boolean
          pref_camera_enabled: boolean
          pref_contacts_enabled: boolean
          pref_mic_enabled: boolean
          pref_notifications_enabled: boolean
          premium_expires_at: string | null
          premium_granted_at: string | null
          premium_granted_by: string | null
          premium_source: string | null
          privacy_accepted_at: string | null
          profile_completed: boolean | null
          profile_photo_allowed_viewers: string[]
          profile_photo_visibility: string
          public_key: string | null
          real_email: string | null
          role: string
          signup_reminder_last_sent_at: string | null
          signup_reminders_sent: number
          status_allowed_viewers: string[]
          status_visibility: string
          terms_accepted_at: string | null
          terms_warning_sent_at: string | null
          totp_enabled: boolean
          totp_enabled_at: string | null
          updated_at: string | null
          username: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "user_profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_reset_otp_attempts: {
        Args: { _user_id: string }
        Returns: undefined
      }
      admin_reset_user_password: {
        Args: { new_password: string; target_user_id: string }
        Returns: undefined
      }
      admin_review_offboarding_appeal: {
        Args: { _appeal_id: string; _decision: string; _notes?: string }
        Returns: Json
      }
      admin_revoke_premium: {
        Args: { _user_id: string }
        Returns: {
          account_status: Database["public"]["Enums"]["user_status"] | null
          app_theme: string | null
          avatar_url: string | null
          bio: string | null
          country_code: string | null
          created_at: string | null
          dob: string | null
          email: string
          email_marketing_opt_in: boolean
          full_name: string
          id: string
          inactivity_final_warning_sent_at: string | null
          inactivity_warning_sent_at: string | null
          is_master_admin: boolean
          is_online: boolean | null
          is_premium: boolean
          is_suspended: boolean | null
          is_verified: boolean
          key_setup_completed: boolean
          last_seen: string | null
          login_attempts: number | null
          marketing_consent_at: string | null
          marketing_consent_ip: string | null
          marketing_consent_source: string | null
          max_privacy_mode: boolean
          media_cache_limit_mb: number
          mobile_hash: string | null
          mobile_number: string | null
          mobile_verified_at: string | null
          notif_mentions: boolean
          notif_messages: boolean
          notif_secure_chats: boolean
          notif_sounds: boolean
          notif_status: boolean
          pref_camera_enabled: boolean
          pref_contacts_enabled: boolean
          pref_mic_enabled: boolean
          pref_notifications_enabled: boolean
          premium_expires_at: string | null
          premium_granted_at: string | null
          premium_granted_by: string | null
          premium_source: string | null
          privacy_accepted_at: string | null
          profile_completed: boolean | null
          profile_photo_allowed_viewers: string[]
          profile_photo_visibility: string
          public_key: string | null
          real_email: string | null
          role: string
          signup_reminder_last_sent_at: string | null
          signup_reminders_sent: number
          status_allowed_viewers: string[]
          status_visibility: string
          terms_accepted_at: string | null
          terms_warning_sent_at: string | null
          totp_enabled: boolean
          totp_enabled_at: string | null
          updated_at: string | null
          username: string | null
        }
        SetofOptions: {
          from: "*"
          to: "user_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_premium: {
        Args: { _forever?: boolean; _months: number; _user_id: string }
        Returns: {
          account_status: Database["public"]["Enums"]["user_status"] | null
          app_theme: string | null
          avatar_url: string | null
          bio: string | null
          country_code: string | null
          created_at: string | null
          dob: string | null
          email: string
          email_marketing_opt_in: boolean
          full_name: string
          id: string
          inactivity_final_warning_sent_at: string | null
          inactivity_warning_sent_at: string | null
          is_master_admin: boolean
          is_online: boolean | null
          is_premium: boolean
          is_suspended: boolean | null
          is_verified: boolean
          key_setup_completed: boolean
          last_seen: string | null
          login_attempts: number | null
          marketing_consent_at: string | null
          marketing_consent_ip: string | null
          marketing_consent_source: string | null
          max_privacy_mode: boolean
          media_cache_limit_mb: number
          mobile_hash: string | null
          mobile_number: string | null
          mobile_verified_at: string | null
          notif_mentions: boolean
          notif_messages: boolean
          notif_secure_chats: boolean
          notif_sounds: boolean
          notif_status: boolean
          pref_camera_enabled: boolean
          pref_contacts_enabled: boolean
          pref_mic_enabled: boolean
          pref_notifications_enabled: boolean
          premium_expires_at: string | null
          premium_granted_at: string | null
          premium_granted_by: string | null
          premium_source: string | null
          privacy_accepted_at: string | null
          profile_completed: boolean | null
          profile_photo_allowed_viewers: string[]
          profile_photo_visibility: string
          public_key: string | null
          real_email: string | null
          role: string
          signup_reminder_last_sent_at: string | null
          signup_reminders_sent: number
          status_allowed_viewers: string[]
          status_visibility: string
          terms_accepted_at: string | null
          terms_warning_sent_at: string | null
          totp_enabled: boolean
          totp_enabled_at: string | null
          updated_at: string | null
          username: string | null
        }
        SetofOptions: {
          from: "*"
          to: "user_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_user_verified: {
        Args: { _user_id: string; _verified: boolean }
        Returns: undefined
      }
      age_years: { Args: { _dob: string }; Returns: number }
      can_view_profile_photo: {
        Args: { _owner: string; _viewer: string }
        Returns: boolean
      }
      can_view_status_owner: { Args: { _owner_id: string }; Returns: boolean }
      cancel_totp_enrollment: { Args: never; Returns: undefined }
      check_otp_rate_limit: { Args: { _email: string }; Returns: number }
      claim_push_subscription: {
        Args: { _auth: string; _endpoint: string; _p256dh: string }
        Returns: undefined
      }
      cleanup_expired_statuses: { Args: never; Returns: undefined }
      cleanup_expired_statuses_for_user: { Args: never; Returns: number }
      compute_mobile_hash: { Args: { _mobile: string }; Returns: string }
      confirm_totp_enrollment: { Args: { _code: string }; Returns: undefined }
      consume_email_otp: {
        Args: { _code: string; _email: string; _purpose: string }
        Returns: boolean
      }
      create_tribe: {
        Args: { _member_ids: string[]; _name: string }
        Returns: string
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      delete_message_for_everyone: {
        Args: { _msg_id: string }
        Returns: undefined
      }
      delete_message_for_me: { Args: { _msg_id: string }; Returns: undefined }
      delete_my_account: {
        Args: { _reason_key?: string; _reason_text?: string }
        Returns: Json
      }
      disable_totp: { Args: never; Returns: undefined }
      edit_my_message: {
        Args: { _msg_id: string; _new_content: string }
        Returns: undefined
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      expire_premium_users: { Args: never; Returns: undefined }
      expire_seen_messages: { Args: { p_chat_id: string }; Returns: undefined }
      find_secure_chat_by_code: { Args: { _code: string }; Returns: string }
      find_users_by_mobile_hashes: {
        Args: { _hashes: string[] }
        Returns: {
          avatar_url: string
          full_name: string
          id: string
          is_verified: boolean
          mobile_hash: string
          profile_photo_visibility: string
        }[]
      }
      find_users_by_mobiles: {
        Args: { _mobiles: string[] }
        Returns: {
          avatar_url: string
          full_name: string
          id: string
          is_verified: boolean
          mobile_number: string
          profile_photo_visibility: string
        }[]
      }
      get_any_admin_id: { Args: never; Returns: string }
      get_guardian_consent_by_token: {
        Args: { _token: string }
        Returns: {
          consent_version: string
          consented_at: string
          guardian_email: string
          guardian_mobile: string
          guardian_name: string
          id: string
          minor_dob: string
          minor_full_name: string
          relationship: string
          revoked_at: string
        }[]
      }
      get_my_encryption_material: {
        Args: never
        Returns: {
          encrypted_private_key: string
          key_iv: string
          key_salt: string
          key_setup_completed: boolean
          public_key: string
        }[]
      }
      get_my_full_profile: {
        Args: never
        Returns: {
          account_status: Database["public"]["Enums"]["user_status"] | null
          app_theme: string | null
          avatar_url: string | null
          bio: string | null
          country_code: string | null
          created_at: string | null
          dob: string | null
          email: string
          email_marketing_opt_in: boolean
          full_name: string
          id: string
          inactivity_final_warning_sent_at: string | null
          inactivity_warning_sent_at: string | null
          is_master_admin: boolean
          is_online: boolean | null
          is_premium: boolean
          is_suspended: boolean | null
          is_verified: boolean
          key_setup_completed: boolean
          last_seen: string | null
          login_attempts: number | null
          marketing_consent_at: string | null
          marketing_consent_ip: string | null
          marketing_consent_source: string | null
          max_privacy_mode: boolean
          media_cache_limit_mb: number
          mobile_hash: string | null
          mobile_number: string | null
          mobile_verified_at: string | null
          notif_mentions: boolean
          notif_messages: boolean
          notif_secure_chats: boolean
          notif_sounds: boolean
          notif_status: boolean
          pref_camera_enabled: boolean
          pref_contacts_enabled: boolean
          pref_mic_enabled: boolean
          pref_notifications_enabled: boolean
          premium_expires_at: string | null
          premium_granted_at: string | null
          premium_granted_by: string | null
          premium_source: string | null
          privacy_accepted_at: string | null
          profile_completed: boolean | null
          profile_photo_allowed_viewers: string[]
          profile_photo_visibility: string
          public_key: string | null
          real_email: string | null
          role: string
          signup_reminder_last_sent_at: string | null
          signup_reminders_sent: number
          status_allowed_viewers: string[]
          status_visibility: string
          terms_accepted_at: string | null
          terms_warning_sent_at: string | null
          totp_enabled: boolean
          totp_enabled_at: string | null
          updated_at: string | null
          username: string | null
        }
        SetofOptions: {
          from: "*"
          to: "user_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_my_guardian_send_target: {
        Args: never
        Returns: {
          consent_token: string
          consented_at: string
          guardian_email: string
          guardian_name: string
          id: string
          relationship: string
        }[]
      }
      get_my_guardian_status: {
        Args: never
        Returns: {
          consented_at: string
          created_at: string
          email_verified_at: string
          guardian_email_masked: string
          guardian_mobile_masked: string
          guardian_name: string
          id: string
          relationship: string
          revoked_at: string
          updated_at: string
        }[]
      }
      get_my_latest_consent_versions: {
        Args: never
        Returns: {
          accepted_at: string
          consent_type: string
          policy_version: string
        }[]
      }
      get_my_saved_contact_profiles: {
        Args: { _ids: string[] }
        Returns: {
          avatar_url: string
          full_name: string
          id: string
          is_verified: boolean
          mobile_number: string
          profile_photo_visibility: string
        }[]
      }
      get_my_totp_pending_secret: { Args: never; Returns: string }
      get_my_totp_secret: { Args: never; Returns: string }
      get_public_profile_snippets: {
        Args: { _ids: string[] }
        Returns: {
          avatar_url: string
          full_name: string
          id: string
          is_online: boolean
          is_verified: boolean
          last_seen: string
          profile_photo_visibility: string
          username: string
        }[]
      }
      guardian_auto_graduate: { Args: never; Returns: number }
      guardian_reminders_due: {
        Args: never
        Returns: {
          consent_token: string
          guardian_email: string
          guardian_name: string
          id: string
          minor_full_name: string
          minor_user_id: string
        }[]
      }
      has_active_guardian_consent: {
        Args: { _user_id: string }
        Returns: boolean
      }
      has_permission: {
        Args: { _permission_key: string; _user_id: string }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_admin_user: { Args: never; Returns: boolean }
      is_chat_muted: {
        Args: { _chat_id: string; _user_id: string }
        Returns: boolean
      }
      is_chat_participant:
        | { Args: { _chat_id: string; _user_id: string }; Returns: boolean }
        | { Args: { chat_uuid: string }; Returns: boolean }
      is_contact: {
        Args: { _owner_id: string; _viewer_id: string }
        Returns: boolean
      }
      is_master_admin: { Args: never; Returns: boolean }
      is_minor: { Args: { _user_id: string }; Returns: boolean }
      is_mobile_available: {
        Args: { _country_code: string; _mobile: string }
        Returns: boolean
      }
      is_pending_guardian: { Args: { _user_id: string }; Returns: boolean }
      is_pinned_master_mobile: { Args: { _mobile: string }; Returns: boolean }
      is_real_email_available: { Args: { _email: string }; Returns: boolean }
      is_signup_blocked: {
        Args: { _email: string; _mobile_hash: string }
        Returns: boolean
      }
      is_tribe_admin: {
        Args: { _chat_id: string; _user_id: string }
        Returns: boolean
      }
      is_tribe_founder: {
        Args: { _chat_id: string; _user_id: string }
        Returns: boolean
      }
      is_tribe_leader: {
        Args: { _chat_id: string; _user_id: string }
        Returns: boolean
      }
      is_tribe_member: {
        Args: { _chat_id: string; _user_id: string }
        Returns: boolean
      }
      is_tribe_secured: { Args: { _chat_id: string }; Returns: boolean }
      is_username_available: { Args: { _username: string }; Returns: boolean }
      issue_email_otp: {
        Args: { _code: string; _email: string; _purpose: string }
        Returns: undefined
      }
      list_pending_signup_reminders: {
        Args: { _limit?: number }
        Returns: {
          email: string
          email_confirmed_at: string
          full_name: string
          reminders_sent: number
          user_id: string
        }[]
      }
      list_recent_public_users: {
        Args: { _limit?: number }
        Returns: {
          avatar_url: string
          full_name: string
          id: string
          is_verified: boolean
          mobile_number: string
          profile_photo_visibility: string
        }[]
      }
      lookup_offboarding_appeal: {
        Args: { _token: string }
        Returns: {
          appellant_name: string
          reviewed_at: string
          reviewer_notes: string
          status: string
        }[]
      }
      mark_guardian_reminded: { Args: { _id: string }; Returns: undefined }
      mark_messages_read: { Args: { _chat_id: string }; Returns: undefined }
      mark_secure_chat: {
        Args: { _chat_id: string; _code: string }
        Returns: undefined
      }
      mark_secure_tribe: {
        Args: { _chat_id: string; _code: string }
        Returns: Json
      }
      mark_signup_reminder_sent: {
        Args: { _user_id: string }
        Returns: undefined
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      pre_login_lookup: {
        Args: { _identifier: string }
        Returns: {
          account_status: Database["public"]["Enums"]["user_status"]
          email: string
          id: string
          is_suspended: boolean
          login_attempts: number
          totp_enabled: boolean
        }[]
      }
      rate_limit_hit: {
        Args: { _key: string; _max: number; _window_secs: number }
        Returns: boolean
      }
      rate_limits_cleanup: { Args: never; Returns: undefined }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      record_consent: {
        Args: { _consent_type: string; _policy_version: string }
        Returns: string
      }
      record_guardian_consent: {
        Args: { _ip: string; _token: string; _user_agent: string }
        Returns: boolean
      }
      record_login_failure: { Args: { _user_id: string }; Returns: number }
      record_login_success: { Args: { _user_id: string }; Returns: undefined }
      reset_password_with_otp: {
        Args: { _code: string; _identifier: string; _new_password: string }
        Returns: undefined
      }
      revoke_guardian_consent: {
        Args: { _ip: string; _token: string; _user_agent: string }
        Returns: boolean
      }
      search_public_users: {
        Args: { _limit?: number; _q: string }
        Returns: {
          avatar_url: string
          full_name: string
          id: string
          is_online: boolean
          is_verified: boolean
          mobile_number: string
          profile_photo_visibility: string
          username: string
        }[]
      }
      set_broadcast_avatar: { Args: { _url: string }; Returns: undefined }
      set_my_encryption_material: {
        Args: {
          _encrypted_private_key: string
          _key_iv: string
          _key_salt: string
          _mark_setup?: boolean
          _public_key: string
        }
        Returns: undefined
      }
      set_user_consent: {
        Args: { _granted: boolean; _purpose: string; _source?: string }
        Returns: undefined
      }
      sms_gw_consume_token: {
        Args: {
          _from_msisdn: string
          _gateway_id: string
          _received_at: string
          _sms_id: string
          _token_fingerprint: string
          _token_hash: string
        }
        Returns: Json
      }
      sms_gw_create_claim: {
        Args: { _gateway_id: string; _token_hash: string; _user_id: string }
        Returns: Json
      }
      sms_gw_get_gateway_auth: { Args: { _device_id: string }; Returns: Json }
      sms_gw_list_gateways: { Args: never; Returns: Json }
      sms_gw_phone_status: { Args: { _user_id: string }; Returns: Json }
      sms_gw_register_gateway: {
        Args: {
          _created_by: string
          _device_id: string
          _label: string
          _secret_hash: string
        }
        Returns: Json
      }
      sms_gw_register_nonce: {
        Args: { _gateway_id: string; _nonce: string }
        Returns: boolean
      }
      sms_gw_set_gateway_status: {
        Args: { _device_id: string; _status: string }
        Returns: Json
      }
      sms_gw_touch_gateway: { Args: { _device_id: string }; Returns: undefined }
      start_totp_enrollment: { Args: { _secret: string }; Returns: undefined }
      submit_guardian_details: {
        Args: {
          _guardian_email: string
          _guardian_mobile: string
          _guardian_name: string
          _relationship: string
        }
        Returns: {
          consent_token: string
          guardian_email: string
          otp_code: string
        }[]
      }
      submit_offboarding_appeal: {
        Args: { _reason: string; _token: string }
        Returns: Json
      }
      tribe_change_privacy: {
        Args: { _chat_id: string; _privacy: string }
        Returns: undefined
      }
      tribe_decide_request: {
        Args: { _approve: boolean; _request_id: string }
        Returns: undefined
      }
      tribe_delete: { Args: { _chat_id: string }; Returns: undefined }
      tribe_delete_message_as_leader: {
        Args: { _msg_id: string }
        Returns: undefined
      }
      tribe_demote_member: {
        Args: { _chat_id: string; _user_id: string }
        Returns: undefined
      }
      tribe_join_public: { Args: { _chat_id: string }; Returns: undefined }
      tribe_join_via_invite: { Args: { _code: string }; Returns: string }
      tribe_leave: { Args: { _chat_id: string }; Returns: undefined }
      tribe_promote_member: {
        Args: { _chat_id: string; _user_id: string }
        Returns: undefined
      }
      tribe_remove_member: {
        Args: { _chat_id: string; _user_id: string }
        Returns: undefined
      }
      tribe_request_join: { Args: { _chat_id: string }; Returns: undefined }
      tribe_set_handle: {
        Args: { _chat_id: string; _handle: string }
        Returns: undefined
      }
      unmark_secure_chat: {
        Args: { _chat_id: string; _delete_messages?: boolean }
        Returns: Json
      }
      verify_guardian_email_otp: { Args: { _code: string }; Returns: boolean }
      visible_avatar_urls: {
        Args: { _owner_ids: string[] }
        Returns: {
          avatar_url: string
          id: string
        }[]
      }
    }
    Enums: {
      appeal_status: "pending" | "approved" | "rejected"
      chat_type: "normal" | "secure" | "dual_normal" | "dual_secure"
      message_status: "sent" | "delivered" | "read"
      report_reason:
        | "child_safety"
        | "nudity_sexual"
        | "harassment_bullying"
        | "hate_speech"
        | "violence"
        | "spam"
        | "scam_fraud"
        | "fake_profile"
        | "impersonation"
        | "terrorism"
        | "illegal_activity"
        | "self_harm"
        | "privacy_violation"
        | "copyright"
        | "other"
      report_status:
        | "pending"
        | "true_positive"
        | "false_positive"
        | "dismissed"
      report_type:
        | "message"
        | "image"
        | "video"
        | "file"
        | "audio"
        | "profile"
        | "chat"
        | "status"
        | "tribe"
      ticket_status: "open" | "inprocess" | "solved"
      user_status: "active" | "suspended" | "inactive" | "pending_guardian"
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
      appeal_status: ["pending", "approved", "rejected"],
      chat_type: ["normal", "secure", "dual_normal", "dual_secure"],
      message_status: ["sent", "delivered", "read"],
      report_reason: [
        "child_safety",
        "nudity_sexual",
        "harassment_bullying",
        "hate_speech",
        "violence",
        "spam",
        "scam_fraud",
        "fake_profile",
        "impersonation",
        "terrorism",
        "illegal_activity",
        "self_harm",
        "privacy_violation",
        "copyright",
        "other",
      ],
      report_status: [
        "pending",
        "true_positive",
        "false_positive",
        "dismissed",
      ],
      report_type: [
        "message",
        "image",
        "video",
        "file",
        "audio",
        "profile",
        "chat",
        "status",
        "tribe",
      ],
      ticket_status: ["open", "inprocess", "solved"],
      user_status: ["active", "suspended", "inactive", "pending_guardian"],
    },
  },
} as const
