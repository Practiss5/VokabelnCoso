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
      classes: {
        Row: {
          created_at: string
          id: string
          join_code: string
          name: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          join_code?: string
          name: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          id?: string
          join_code?: string
          name?: string
          teacher_id?: string
        }
        Relationships: []
      }
      homeworks: {
        Row: {
          class_id: string
          created_at: string
          due_at: string
          id: string
          instructions: string
          list_id: string
          teacher_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          due_at: string
          id?: string
          instructions?: string
          list_id: string
          teacher_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          due_at?: string
          id?: string
          instructions?: string
          list_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "homeworks_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homeworks_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "vocab_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      list_assignments: {
        Row: {
          class_id: string
          created_at: string
          list_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          list_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          list_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_assignments_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "vocab_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      list_folders: {
        Row: {
          created_at: string
          id: string
          name: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          teacher_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          class_id: string | null
          created_at: string
          full_name: string
          id: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          full_name?: string
          id: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          full_name?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_class_fk"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          correct: boolean
          created_at: string
          error_type: string | null
          given_answer: string | null
          id: string
          mode: string
          skill: string | null
          student_id: string
          word_id: string
        }
        Insert: {
          correct: boolean
          created_at?: string
          error_type?: string | null
          given_answer?: string | null
          id?: string
          mode: string
          skill?: string | null
          student_id: string
          word_id: string
        }
        Update: {
          correct?: boolean
          created_at?: string
          error_type?: string | null
          given_answer?: string | null
          id?: string
          mode?: string
          skill?: string | null
          student_id?: string
          word_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_progress: {
        Row: {
          correct_count: number
          due_at: string
          last_error: string | null
          last_reviewed_at: string | null
          skill: string
          step: number
          streak: number
          student_id: string
          word_id: string
          wrong_count: number
        }
        Insert: {
          correct_count?: number
          due_at?: string
          last_error?: string | null
          last_reviewed_at?: string | null
          skill: string
          step?: number
          streak?: number
          student_id: string
          word_id: string
          wrong_count?: number
        }
        Update: {
          correct_count?: number
          due_at?: string
          last_error?: string | null
          last_reviewed_at?: string | null
          skill?: string
          step?: number
          streak?: number
          student_id?: string
          word_id?: string
          wrong_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "skill_progress_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
        ]
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
      vocab_lists: {
        Row: {
          created_at: string
          description: string
          folder_id: string | null
          id: string
          level: string
          teacher_id: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string
          folder_id?: string | null
          id?: string
          level?: string
          teacher_id: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          folder_id?: string | null
          id?: string
          level?: string
          teacher_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "vocab_lists_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "list_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      word_progress: {
        Row: {
          correct_count: number
          due_at: string
          ease: number
          interval_days: number
          last_reviewed_at: string | null
          repetitions: number
          student_id: string
          word_id: string
          wrong_count: number
        }
        Insert: {
          correct_count?: number
          due_at?: string
          ease?: number
          interval_days?: number
          last_reviewed_at?: string | null
          repetitions?: number
          student_id: string
          word_id: string
          wrong_count?: number
        }
        Update: {
          correct_count?: number
          due_at?: string
          ease?: number
          interval_days?: number
          last_reviewed_at?: string | null
          repetitions?: number
          student_id?: string
          word_id?: string
          wrong_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "word_progress_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
        ]
      }
      words: {
        Row: {
          created_at: string
          example_de: string
          example_fr: string
          french: string
          german: string
          id: string
          list_id: string
        }
        Insert: {
          created_at?: string
          example_de?: string
          example_fr?: string
          french: string
          german: string
          id?: string
          list_id: string
        }
        Update: {
          created_at?: string
          example_de?: string
          example_fr?: string
          french?: string
          german?: string
          id?: string
          list_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "words_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "vocab_lists"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_teacher_of_student: { Args: { _student: string }; Returns: boolean }
      join_class: { Args: { _code: string }; Returns: string }
      my_class_id: { Args: never; Returns: string }
      owns_list: { Args: { _list: string }; Returns: boolean }
      record_answer: {
        Args: {
          _correct: boolean
          _error?: string
          _given?: string
          _mode: string
          _word: string
        }
        Returns: {
          correct_count: number
          due_at: string
          last_error: string | null
          last_reviewed_at: string | null
          skill: string
          step: number
          streak: number
          student_id: string
          word_id: string
          wrong_count: number
        }
        SetofOptions: {
          from: "*"
          to: "skill_progress"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      step_interval: { Args: { _step: number }; Returns: string }
      student_can_access_list: { Args: { _list: string }; Returns: boolean }
      update_my_name: { Args: { _name: string }; Returns: undefined }
    }
    Enums: {
      app_role: "teacher" | "student"
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
      app_role: ["teacher", "student"],
    },
  },
} as const
