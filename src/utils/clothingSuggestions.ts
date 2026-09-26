import type { ClothingAnalysis } from '../../supabase/functions/_shared/clothingAnalysis';
import type { WardrobeItem } from '@/types/wardrobe';

/** Draft-only mapping: never writes to Supabase or fills an invented brand. */
export function applyClothingSuggestions(draft: WardrobeItem, suggestion: ClothingAnalysis): WardrobeItem {
  return {
    ...draft,
    name: suggestion.suggested_name ?? '',
    category: suggestion.category ?? draft.category,
    subcategory: suggestion.subcategory,
    primary_colour: suggestion.primary_colour,
    secondary_colours: suggestion.secondary_colours ?? [],
    pattern: suggestion.pattern,
    material: suggestion.possible_material ?? [],
    fit: suggestion.fit,
    season: suggestion.season ?? [],
    formality: suggestion.formality,
    style_tags: suggestion.style_tags ?? [],
    warmth_level: suggestion.warmth_level,
    sleeve_length: suggestion.sleeve_length,
    neckline: suggestion.neckline,
  };
}
