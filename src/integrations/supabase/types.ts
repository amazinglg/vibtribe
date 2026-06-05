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
          sender_id: string | null
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
          sender_id?: string | null
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
          sender_id?: string | null
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
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
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
          encrypted_private_key: string | null
          full_name: string
          id: string
          is_master_admin: boolean
          is_online: boolean | null
          is_suspended: boolean | null
          key_iv: string | null
          key_salt: string | null
          key_setup_completed: boolean
          last_seen: string | null
          login_attempts: number | null
          mobile_number: string | null
          notif_mentions: boolean
          notif_messages: boolean
          notif_secure_chats: boolean
          notif_sounds: boolean
          notif_status: boolean
          profile_completed: boolean | null
          profile_photo_visibility: string
          public_key: string | null
          real_email: string | null
          role: string
          status_visibility: string
          terms_accepted_at: string | null
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
          encrypted_private_key?: string | null
          full_name?: string
          id: string
          is_master_admin?: boolean
          is_online?: boolean | null
          is_suspended?: boolean | null
          key_iv?: string | null
          key_salt?: string | null
          key_setup_completed?: boolean
          last_seen?: string | null
          login_attempts?: number | null
          mobile_number?: string | null
          notif_mentions?: boolean
          notif_messages?: boolean
          notif_secure_chats?: boolean
          notif_sounds?: boolean
          notif_status?: boolean
          profile_completed?: boolean | null
          profile_photo_visibility?: string
          public_key?: string | null
          real_email?: string | null
          role?: string
          status_visibility?: string
          terms_accepted_at?: string | null
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
          encrypted_private_key?: string | null
          full_name?: string
          id?: string
          is_master_admin?: boolean
          is_online?: boolean | null
          is_suspended?: boolean | null
          key_iv?: string | null
          key_salt?: string | null
          key_setup_completed?: boolean
          last_seen?: string | null
          login_attempts?: number | null
          mobile_number?: string | null
          notif_mentions?: boolean
          notif_messages?: boolean
          notif_secure_chats?: boolean
          notif_sounds?: boolean
          notif_status?: boolean
          profile_completed?: boolean | null
          profile_photo_visibility?: string
          public_key?: string | null
          real_email?: string | null
          role?: string
          status_visibility?: string
          terms_accepted_at?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      user_secure_chats: {
        Row: {
          chat_id: string
          code: string
          created_at: string
          user_id: string
        }
        Insert: {
          chat_id: string
          code: string
          created_at?: string
          user_id: string
        }
        Update: {
          chat_id?: string
          code?: string
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
      _hash_otp: { Args: { _code: string }; Returns: string }
      _insert_tribe_system_message: {
        Args: { _chat_id: string; _content: string }
        Returns: undefined
      }
      accept_terms: { Args: never; Returns: undefined }
      admin_delete_ticket: { Args: { _ticket_id: string }; Returns: undefined }
      admin_delete_user: { Args: { _user_id: string }; Returns: undefined }
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
          encrypted_private_key: string | null
          full_name: string
          id: string
          is_master_admin: boolean
          is_online: boolean | null
          is_suspended: boolean | null
          key_iv: string | null
          key_salt: string | null
          key_setup_completed: boolean
          last_seen: string | null
          login_attempts: number | null
          mobile_number: string | null
          notif_mentions: boolean
          notif_messages: boolean
          notif_secure_chats: boolean
          notif_sounds: boolean
          notif_status: boolean
          profile_completed: boolean | null
          profile_photo_visibility: string
          public_key: string | null
          real_email: string | null
          role: string
          status_visibility: string
          terms_accepted_at: string | null
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
          encrypted_private_key: string | null
          full_name: string
          id: string
          is_master_admin: boolean
          is_online: boolean | null
          is_suspended: boolean | null
          key_iv: string | null
          key_salt: string | null
          key_setup_completed: boolean
          last_seen: string | null
          login_attempts: number | null
          mobile_number: string | null
          notif_mentions: boolean
          notif_messages: boolean
          notif_secure_chats: boolean
          notif_sounds: boolean
          notif_status: boolean
          profile_completed: boolean | null
          profile_photo_visibility: string
          public_key: string | null
          real_email: string | null
          role: string
          status_visibility: string
          terms_accepted_at: string | null
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
      check_otp_rate_limit: { Args: { _email: string }; Returns: number }
      cleanup_expired_statuses: { Args: never; Returns: undefined }
      cleanup_expired_statuses_for_user: { Args: never; Returns: number }
      consume_email_otp: {
        Args: { _code: string; _email: string; _purpose: string }
        Returns: boolean
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
      delete_my_account: { Args: never; Returns: undefined }
      edit_my_message: {
        Args: { _msg_id: string; _new_content: string }
        Returns: undefined
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      expire_seen_messages: { Args: { p_chat_id: string }; Returns: undefined }
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
          encrypted_private_key: string | null
          full_name: string
          id: string
          is_master_admin: boolean
          is_online: boolean | null
          is_suspended: boolean | null
          key_iv: string | null
          key_salt: string | null
          key_setup_completed: boolean
          last_seen: string | null
          login_attempts: number | null
          mobile_number: string | null
          notif_mentions: boolean
          notif_messages: boolean
          notif_secure_chats: boolean
          notif_sounds: boolean
          notif_status: boolean
          profile_completed: boolean | null
          profile_photo_visibility: string
          public_key: string | null
          real_email: string | null
          role: string
          status_visibility: string
          terms_accepted_at: string | null
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
      is_admin: { Args: never; Returns: boolean }
      is_admin_user: { Args: never; Returns: boolean }
      is_chat_participant: { Args: { chat_uuid: string }; Returns: boolean }
      is_contact: {
        Args: { _owner_id: string; _viewer_id: string }
        Returns: boolean
      }
      is_master_admin: { Args: never; Returns: boolean }
      is_mobile_available: {
        Args: { _country_code: string; _mobile: string }
        Returns: boolean
      }
      is_real_email_available: { Args: { _email: string }; Returns: boolean }
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
      issue_email_otp: {
        Args: { _code: string; _email: string; _purpose: string }
        Returns: undefined
      }
      mark_messages_read: { Args: { _chat_id: string }; Returns: undefined }
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
        }[]
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      record_login_failure: { Args: { _user_id: string }; Returns: number }
      record_login_success: { Args: { _user_id: string }; Returns: undefined }
      reset_password_with_otp: {
        Args: { _code: string; _identifier: string; _new_password: string }
        Returns: undefined
      }
      tribe_change_privacy: {
        Args: { _chat_id: string; _privacy: string }
        Returns: undefined
      }
      tribe_decide_request: {
        Args: { _approve: boolean; _request_id: string }
        Returns: undefined
      }
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
    }
    Enums: {
      chat_type: "normal" | "secure" | "dual_normal" | "dual_secure"
      message_status: "sent" | "delivered" | "read"
      ticket_status: "open" | "inprocess" | "solved"
      user_status: "active" | "suspended" | "inactive"
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
      chat_type: ["normal", "secure", "dual_normal", "dual_secure"],
      message_status: ["sent", "delivered", "read"],
      ticket_status: ["open", "inprocess", "solved"],
      user_status: ["active", "suspended", "inactive"],
    },
  },
} as const
