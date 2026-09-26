# My Wardrobe

The Wardrobe tab reads real, active `wardrobe_items` owned by the authenticated user.
There is no sample-item fallback. Apply the checked-in wardrobe/outfit migration to
the connected Supabase project before using these screens.

- Debounced name/brand/primary-colour search combines with category and favourite
  filters on the server. Results are ordered by creation time and id, in pages of 40.
- A virtualized image grid adapts to phone/tablet widths and larger accessibility
  text. Missing/broken photos have a fallback. Pull to refresh or use Load more.
- Requests explicitly filter user_id; database RLS remains the security boundary.
  Account changes remount private screens. Old list/detail requests cannot replace
  current results after navigating or changing filters.
- `/wardrobe-items/[id]` is protected by the authenticated Router stack. Unknown,
  deleted, archived, or another user's item displays an unavailable state.
- Edit validates attributes, URL schemes and warmth, preserving nulls/arrays/enums.
  Writes are confirmed before changing displayed favourite or item data.
- Delete requires an explicit in-screen confirmation, including on web. Foreign-key
  failures explain that outfit references must be removed first. No cascading delete
  of another feature's records is attempted.
- Build an outfit around this passes an item ID to `/plan`; that screen loads the
  owned item again and saves occasion/instructions in `outfit_plans.anchor_item_id`.
  AI generation is not implemented in this step; the screen states this clearly.

Add Item now supports camera/library selection, preview, private Storage upload, and
manual attributes. New rows persist image_path and use 10-minute signed URLs for
display, renewed on focus and every eight minutes while focused. Existing image_url
rows continue to display their HTTP(S) source. See ../../../supabase/PHOTOS.md.

Validation: `npm run test:wardrobe`, `npm run test:database`, `npm run lint`,
`npm run typecheck`, and Expo export for iOS, Android, and web. Unit tests use the
real Supabase query builder with a mocked HTTP transport; database tests validate
ownership in isolated PostgreSQL. Native device interactions still require a pass.
