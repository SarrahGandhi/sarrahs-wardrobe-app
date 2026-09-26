# Plan Outfit

Apply `migrations/20260926000400_plan_outfit_inputs.sql` in your hosted Supabase
SQL Editor after the existing wardrobe schema migration. No AI key or Edge Function
is needed for this flow. For a fresh project only, `sql/full_schema.sql` includes it.

The Plan tab contains occasion options (including Other with required description),
optional Celsius temperature, manual weather condition, indoor/outdoor/both,
natural-language preferences, style chips, and a searchable multi-select wardrobe
picker. Skip clears the optional starting pieces. Cancel preserves the previous selection.
The item detail action preselects its owned wardrobe item in the same form.

Only occasion is required. Temperatures are validated against the database's −100 to
70 °C range. Style Me saves the reviewed inputs and shows a saved confirmation;
it does not call AI or create recommendations. Editing after success creates a new
plan on the next save. Unsaved form state lasts while the screen remains mounted;
it is not persisted across an app restart.

`outfit_plans.setting` records indoor/outdoor/both. `outfit_plan_items` stores multiple
starting pieces with composite ownership foreign keys, RLS and a timestamp. Existing
anchor references are backfilled; new plans also retain their first selected piece in
`anchor_item_id` for compatibility. `save_outfit_plan` saves everything atomically using
the caller's authenticated permissions. It rejects unavailable/archived/foreign pieces.
A stable UUID prevents duplicates when retrying a save whose response was lost.

Verification: `node --test tests/outfit-plan.unit.mjs`, `npm run test:database`,
`npm run lint`, `npm run typecheck`. Database tests cover multiple selections, retry,
optional inputs, validation, foreign items, archived items, account isolation and deletes.
On a device, try occasion-only, Other, a negative temperature, search/select across
pages, cancel/skip, an item-detail starting piece, offline retry and saved confirmation.
