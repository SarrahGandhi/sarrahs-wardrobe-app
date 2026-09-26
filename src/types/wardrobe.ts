export const categories = ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'bag', 'jewellery', 'accessory'] as const;
export type WardrobeCategory = typeof categories[number];
export const categoryLabels: Record<WardrobeCategory, string> = { top: 'Tops', bottom: 'Bottoms', dress: 'Dresses', outerwear: 'Outerwear', shoes: 'Shoes', bag: 'Bags', jewellery: 'Jewellery', accessory: 'Accessories' };
export const fits = ['fitted', 'regular', 'relaxed', 'oversized'] as const;
export const seasons = ['spring', 'summer', 'autumn', 'winter'] as const;
export const formalities = ['casual', 'smart_casual', 'business', 'semi_formal', 'formal'] as const;
export const sleeves = ['sleeveless', 'short', 'elbow', 'three_quarter', 'long'] as const;
export type WardrobeItem = {
  id: string; user_id: string; name: string; category: WardrobeCategory;
  image_path: string | null; image_url: string | null; product_url: string | null; brand: string | null;
  subcategory: string | null; primary_colour: string | null; secondary_colours: string[];
  pattern: string | null; material: string[]; fit: typeof fits[number] | null;
  season: (typeof seasons[number])[]; formality: typeof formalities[number] | null;
  style_tags: string[]; warmth_level: number | null; sleeve_length: typeof sleeves[number] | null;
  neckline: string | null; favourite: boolean; archived_at: string | null;
  created_at: string; updated_at: string;
};
export type WardrobeEdit = Omit<WardrobeItem, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'archived_at' | 'image_path'>;
export type OutfitPlan = {
  id: string; user_id: string; occasion: string; planned_for: string | null;
  location: string | null; temperature_c: number | null; feels_like_c: number | null;
  precipitation_probability: number | null; weather_summary: string | null;
  weather_observed_at: string | null; formality: WardrobeItem['formality'];
  style_preferences: string[]; preferred_colours: string[]; excluded_categories: WardrobeCategory[];
  setting: 'indoor' | 'outdoor' | 'both' | null; anchor_item_id: string | null; instructions: string | null; created_at: string; updated_at: string;
};
