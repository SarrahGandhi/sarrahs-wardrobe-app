import { requireSupabase } from './client';
import { listWardrobe, wardrobePageSize } from './wardrobe';
import { planInputs, type PlanDraft } from '@/utils/outfitPlan';
import type { WardrobeItem } from '@/types/wardrobe';
import { aiErrorMessages, projectItem, validateOutfitResult, type OutfitRequest } from '../../../supabase/functions/_shared/outfitRecommendations';
export type { OutfitResult } from '../../../supabase/functions/_shared/outfitRecommendations';
function checkCancellation(signal: AbortSignal) {
  // React Native's AbortSignal implements `aborted`, but not `throwIfAborted`.
  if (signal.aborted) {
    const error = new Error('Outfit generation cancelled.');
    error.name = 'AbortError';
    throw error;
  }
}
export async function recommendOutfits(userId: string, draft: PlanDraft, requiredIds: string[], signal: AbortSignal) {
  const inputs = planInputs(draft);
  const wardrobe: WardrobeItem[] = [];
  for (let offset = 0; ; offset += wardrobePageSize) {
    checkCancellation(signal);
    const page = await listWardrobe(userId, { search: '', category: null, favourites: false }, offset);
    checkCancellation(signal);
    wardrobe.push(...page);
    if (wardrobe.length > 500) throw new Error('Outfit generation currently supports up to 500 active wardrobe items.');
    if (page.length < wardrobePageSize) break;
  }
  const body: OutfitRequest = { occasion: draft.occasion, custom_occasion_description: draft.description.trim(),
    weather: { temperature_c: inputs.p_temperature_c, condition: draft.condition.trim() }, setting: draft.setting,
    styling_request: draft.instructions.trim(), preference_chips: draft.preferences,
    required_wardrobe_item_ids: requiredIds, available_wardrobe_items: wardrobe.map(projectItem) };
  const { data, error } = await requireSupabase().functions.invoke('recommend-outfits', { body, signal, timeout: 110_000 });
  checkCancellation(signal);
  if (error) {
    const messages: Record<string, string> = {
      400: 'Check your occasion and selected wardrobe pieces, then try again.',
      404: 'Outfit generation is not deployed yet. Please finish the server setup.',
      502: 'The outfit service couldn’t generate valid recommendations. Please try again.',
      401: 'Sign in again to generate outfits.', 409: 'Your wardrobe changed. Refresh your selected pieces and try again.',
      422: 'We couldn’t satisfy every requirement. Adjust your request or try again.',
      429: 'You have used 10 outfit requests this hour. Failed AI attempts count too; try again when the hour resets.', 503: 'Outfit generation is not configured yet.',
    };
    let providerCode: unknown;
    try {
      const payload = await error.context?.clone?.().json();
      providerCode = payload?.error;
    } catch { /* Non-JSON transport errors use the status fallback. */ }
    if (typeof providerCode === 'string' && Object.prototype.hasOwnProperty.call(aiErrorMessages, providerCode)) {
      throw new Error(aiErrorMessages[providerCode]);
    }
    const status = error.context?.status;
    throw new Error(messages[status] ?? 'We couldn’t generate outfits. Check your connection and try again.');
  }
  return { result: validateOutfitResult(data, body), wardrobe };
}
