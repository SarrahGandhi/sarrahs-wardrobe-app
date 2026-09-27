import type { RecommendationRow, SavedLookRow, RecommendationItemRow } from './outfit';
import type { WardrobeItem, WardrobeEdit, OutfitPlan } from "./wardrobe";
import type { UserProfile } from "./user";

/** Typed tables currently used by app services; matches the checked-in migrations. */
export type Database = {
  public: {
    Tables: {
      outfit_recommendations: { Row: RecommendationRow; Insert: RecommendationRow; Update: Partial<RecommendationRow>; Relationships: [] };
      outfit_recommendation_items: { Row: RecommendationItemRow; Insert: RecommendationItemRow; Update: Partial<RecommendationItemRow>; Relationships: [] };
      saved_looks: { Row: SavedLookRow; Insert: Pick<SavedLookRow, 'user_id' | 'outfit_recommendation_id'>; Update: Partial<SavedLookRow>; Relationships: [] };
      wardrobe_items: {
        Row: WardrobeItem;
        Insert: Partial<WardrobeItem> & Pick<WardrobeItem, "name" | "category">;
        Update: Partial<WardrobeEdit> & { archived_at?: string | null };
        Relationships: [];
      };
      outfit_plans: {
        Row: OutfitPlan;
        Insert: Partial<OutfitPlan> & Pick<OutfitPlan, "occasion">;
        Update: Partial<Omit<OutfitPlan, "id" | "user_id" | "created_at" | "updated_at">>;
        Relationships: [];
      };
      profiles: {
        Row: { [K in keyof UserProfile]: UserProfile[K] };
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
    Functions: {
      save_outfit_plan: {
        Args: { p_id: string; p_occasion: string; p_temperature_c: number | null;
          p_weather_summary: string | null; p_setting: string | null; p_instructions: string | null;
          p_style_preferences: string[]; p_item_ids: string[] };
        Returns: string;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
