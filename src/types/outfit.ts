import type { Recommendation } from '../../supabase/functions/_shared/outfitRecommendations';
import type { WardrobeItem } from './wardrobe';
import type { PlanDraft } from '@/utils/outfitPlan';
export type CompleteLook = { id: string; planId: string; look: Recommendation; wardrobe: WardrobeItem[]; draft: PlanDraft; requiredIds: string[]; saved: boolean };
export type RecommendationRow = { id: string; user_id: string; outfit_plan_id: string; kind: 'safe_choice' | 'more_stylish' | 'something_different'; title: string; explanation: string | null; generation_metadata: { look?: Recommendation; draft?: PlanDraft; requiredIds?: string[] } };
export type SavedLookRow = { id: string; user_id: string; outfit_recommendation_id: string; created_at: string };
export type RecommendationItemRow = { user_id: string; outfit_recommendation_id: string; wardrobe_item_id: string; role: WardrobeItem['category']; position: number };
