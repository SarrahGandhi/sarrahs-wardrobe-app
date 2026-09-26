import type { User } from "@supabase/supabase-js";

export type AuthUser = User;
export interface UserProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}
