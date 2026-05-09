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
          user_id: string
        }
        Insert: {
          chat_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          chat_id?: string
          id?: string
          joined_at?: string
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
        ]
      }
      chats: {
        Row: {
          avatar_url: string | null
          chat_type: Database["public"]["Enums"]["chat_type"] | null
          created_at: string | null
          created_by: string | null
          disappear_mode: string
          id: string
          is_group: boolean
          is_secure: boolean | null
          name: string | null
          parent_chat_id: string | null
          participant_one: string | null
          participant_two: string | null
          secure_code: string | null
          secure_code_hash: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          chat_type?: Database["public"]["Enums"]["chat_type"] | null
          created_at?: string | null
          created_by?: string | null
          disappear_mode?: string
          id?: string
          is_group?: boolean
          is_secure?: boolean | null
          name?: string | null
          parent_chat_id?: string | null
          participant_one?: string | null
          participant_two?: string | null
          secure_code?: string | null
          secure_code_hash?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          chat_type?: Database["public"]["Enums"]["chat_type"] | null
          created_at?: string | null
          created_by?: string | null
          disappear_mode?: string
          id?: string
          is_group?: boolean
          is_secure?: boolean | null
          name?: string | null
          parent_chat_id?: string | null
          participant_one?: string | null
          participant_two?: string | null
          secure_code?: string | null
          secure_code_hash?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chats_parent_chat_id_fkey"
            columns: ["parent_chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
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
      force_logout_tokens: {
        Row: {
          id: string
          issued_at: string
          issued_by: string | null
          user_id: string
        }
        Insert: {
          id?: string
          issued_at?: string
          issued_by?: string | null
          user_id: string
        }
        Update: {
          id?: string
          issued_at?: string
          issued_by?: string | null
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
          expires_at: string | null
          id: string
          message_status: Database["public"]["Enums"]["message_status"] | null
          reactions: Json | null
          sender_id: string | null
        }
        Insert: {
          chat_id?: string | null
          content: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          message_status?: Database["public"]["Enums"]["message_status"] | null
          reactions?: Json | null
          sender_id?: string | null
        }
        Update: {
          chat_id?: string | null
          content?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          message_status?: Database["public"]["Enums"]["message_status"] | null
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
      support_tickets: {
        Row: {
          admin_reply: string | null
          created_at: string | null
          email: string
          id: string
          issue_description: string
          issue_title: string
          name: string
          replied_at: string | null
          ticket_status: Database["public"]["Enums"]["ticket_status"] | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          admin_reply?: string | null
          created_at?: string | null
          email: string
          id?: string
          issue_description: string
          issue_title: string
          name: string
          replied_at?: string | null
          ticket_status?: Database["public"]["Enums"]["ticket_status"] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          admin_reply?: string | null
          created_at?: string | null
          email?: string
          id?: string
          issue_description?: string
          issue_title?: string
          name?: string
          replied_at?: string | null
          ticket_status?: Database["public"]["Enums"]["ticket_status"] | null
          updated_at?: string | null
          user_id?: string | null
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
      user_profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["user_status"] | null
          app_theme: string | null
          avatar_url: string | null
          bio: string | null
          country_code: string | null
          created_at: string | null
          email: string
          full_name: string
          id: string
          is_master_admin: boolean
          is_online: boolean | null
          is_suspended: boolean | null
          last_seen: string | null
          login_attempts: number | null
          mobile_number: string | null
          profile_completed: boolean | null
          public_key: string | null
          real_email: string | null
          role: string
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
          email: string
          full_name?: string
          id: string
          is_master_admin?: boolean
          is_online?: boolean | null
          is_suspended?: boolean | null
          last_seen?: string | null
          login_attempts?: number | null
          mobile_number?: string | null
          profile_completed?: boolean | null
          public_key?: string | null
          real_email?: string | null
          role?: string
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
          email?: string
          full_name?: string
          id?: string
          is_master_admin?: boolean
          is_online?: boolean | null
          is_suspended?: boolean | null
          last_seen?: string | null
          login_attempts?: number | null
          mobile_number?: string | null
          profile_completed?: boolean | null
          public_key?: string | null
          real_email?: string | null
          role?: string
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_reset_user_password: {
        Args: { new_password: string; target_user_id: string }
        Returns: undefined
      }
      expire_seen_messages: { Args: { p_chat_id: string }; Returns: undefined }
      is_admin: { Args: never; Returns: boolean }
      is_admin_user: { Args: never; Returns: boolean }
      is_chat_participant: { Args: { chat_uuid: string }; Returns: boolean }
      is_master_admin: { Args: never; Returns: boolean }
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
