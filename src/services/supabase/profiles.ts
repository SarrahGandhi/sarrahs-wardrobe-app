import { requireSupabase } from "./client";
import type { UserProfile } from "@/types/user";

export async function getProfile(userId: string): Promise<UserProfile> {
  const { data, error } = await requireSupabase()
    .from("profiles")
    .select("id, display_name, avatar_url, created_at, updated_at")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}
