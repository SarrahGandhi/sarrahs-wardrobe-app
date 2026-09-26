import type { UserProfile } from "./user";

/** Matches the checked-in profiles migration. Regenerate from schema when it expands. */
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: UserProfile;
        Insert: {
          id: string;
          display_name?: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: { display_name?: string; avatar_url?: string | null };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
