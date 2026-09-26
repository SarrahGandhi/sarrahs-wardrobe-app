import type { WardrobeEdit, WardrobeItem } from '@/types/wardrobe';
export const textFields = [
  ['name', 'Name', 200], ['brand', 'Brand', 200], ['subcategory', 'Subcategory', 100],
  ['primary_colour', 'Primary colour', 100], ['secondary_colours', 'Secondary colours', 1000],
  ['pattern', 'Pattern', 100], ['material', 'Materials', 1000], ['style_tags', 'Style tags', 1000],
  ['neckline', 'Neckline', 100], ['warmth_level', 'Warmth level (1–5)', 1],
  ['image_url', 'Photo URL', 4096], ['product_url', 'Product URL', 4096],
] as const;
export type TextField = typeof textFields[number][0];
export type WardrobeDraft = Record<TextField, string>;
export function itemDraft(item: WardrobeItem): WardrobeDraft {
  return Object.fromEntries(textFields.map(([key]) => [key, Array.isArray(item[key]) ? item[key].join(', ') : String(item[key] ?? '')])) as WardrobeDraft;
}
export function parseWardrobeDraft(draft: WardrobeDraft): Pick<WardrobeEdit, TextField> {
  if (!draft.name.trim()) throw new Error('Give this piece a name.');
  for (const [key, label, max] of textFields) if (draft[key].trim().length > max) throw new Error(`${label} is too long.`);
  for (const key of ['image_url', 'product_url'] as const) {
    if (draft[key].trim()) {
      try {
        const url = new URL(draft[key].trim());
        if (!['http:', 'https:'].includes(url.protocol) || /\s/.test(draft[key].trim())) throw new Error();
      } catch { throw new Error('Use a complete http:// or https:// URL for photos and products.'); }
    }
  }
  const warmth = draft.warmth_level.trim() ? Number(draft.warmth_level) : null;
  if (warmth !== null && (!Number.isInteger(warmth) || warmth < 1 || warmth > 5)) throw new Error('Warmth must be a whole number from 1 to 5.');
  const list = (value: string) => [...new Set(value.split(',').map(part => part.trim()).filter(Boolean))];
  return { name: draft.name.trim(), brand: draft.brand.trim() || null, subcategory: draft.subcategory.trim() || null,
    primary_colour: draft.primary_colour.trim() || null, secondary_colours: list(draft.secondary_colours),
    pattern: draft.pattern.trim() || null, material: list(draft.material), style_tags: list(draft.style_tags),
    neckline: draft.neckline.trim() || null, warmth_level: warmth, image_url: draft.image_url.trim() || null,
    product_url: draft.product_url.trim() || null };
}
export const attributeLabel = (value: string) => value.replaceAll('_', ' ').replace(/^./, char => char.toUpperCase());
