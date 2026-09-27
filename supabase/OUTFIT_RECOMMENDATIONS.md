# Outfit recommendations

`Style Me` saves the plan, loads all active wardrobe pages (up to 500 items), and invokes the authenticated `recommend-outfits` Edge Function. Successful results are displayed in the planning screen. Tap a recommendation to view its Complete Look; Save Look adds it to the saved lookbook.

## Deployment

Apply `migrations/20260926000500_outfit_recommendation_quota.sql` in the hosted Supabase SQL Editor after the previous wardrobe and plan migrations (or use `npx supabase db push` for a linked project with migration history).

In Supabase **Edge Functions → Secrets**, set `OUTFIT_AI_PROVIDER=gemini` and `GEMINI_API_KEY`.
Then run from the project directory:

```sh
npx supabase login
npx supabase functions deploy recommend-outfits --project-ref nmxvtnxrxvstzsntkbdr
```

Reload Expo and press Style Me. Keep JWT verification enabled; the function also checks the token with Supabase Auth.

Outfit generation defaults to **Gemini 3.8 Flash** (`gemini-3.8-flash`), using the Gemini `generateContent` API with JSON Schema output. Create a key in [Google AI Studio](https://aistudio.google.com/apikey).

For local development, set these in the git-ignored `supabase/functions/.env`:

```dotenv
OUTFIT_AI_PROVIDER=gemini
GEMINI_API_KEY=your-key
```

Run `npm run supabase:functions` and leave it running. Restart it after changing secrets. For hosted deployment, configure the same values as Supabase Edge Function secrets and deploy `recommend-outfits`. Never prefix a server key with `EXPO_PUBLIC_`. `GEMINI_OUTFIT_MODEL` optionally overrides the model with another Gemini model supporting JSON Schema outputs.

A Gemini 503 capacity error waits 1–1.5 seconds, then retries once with Gemini 3.7 Flash under the same deadline when using the default model. Explicit model overrides are respected. There is no automatic fallback to another provider. Legacy Groq and OpenAI adapters require explicit `OUTFIT_AI_PROVIDER=groq` or `openai` and the corresponding server key. Clothing photo analysis retains its separate configuration in AI_ANALYSIS.md.

Successful generation makes two Gemini calls (generation and requirements audit), each with a 45-second deadline. The mobile invocation timeout is 110 seconds. The database permits 10 attempts per user per hour. Provider rate limits, blocked/incomplete responses and malformed JSON produce sanitized errors. Hosted secrets do not transfer to the local runtime.

## Contract

Request fields:

- `occasion`, `custom_occasion_description`
- `weather: { temperature_c: number | null, condition: string }`
- `setting: "indoor" | "outdoor" | "both" | null`
- `styling_request`, `preference_chips: string[]`
- `required_wardrobe_item_ids: string[]`
- `available_wardrobe_items`: IDs, names, categories, subcategories, colours, patterns, materials, fit, seasons, formality, style tags, warmth, sleeves and neckline. Photos, URLs, user IDs and unrelated private metadata are excluded. The server maps UUIDs to short request-scoped IDs for generation, then maps selections back to owned UUIDs before validation and delivery.

Success JSON:

```json
{
  "status": "ok",
  "reason": "",
  "recommendations": [
    {
      "title": "Safe Choice",
      "items": [{ "wardrobe_item_id": "<owned UUID>", "role": "Base layer" }],
      "accessories": [{ "wardrobe_item_id": "<owned UUID>", "role": "Finishing detail" }],
      "hairstyle": "A low bun",
      "makeup": "Optional minimal makeup",
      "why_this_works": "An explanation grounded in the selected pieces."
    }
  ]
}
```

The abbreviated example shows one look; successful responses always contain exactly three, ordered **Safe Choice**, **More Stylish**, **Something Different**, with complete clothing combinations. Bags, jewellery and accessories are ID-based too. An empty accessories array is valid. Every selected starting piece must appear in every look. Small wardrobes may reuse pieces with different styling.

Unsatisfiable requirements return `{ "status": "impossible", "reason": "<actionable explanation>", "recommendations": [] }`; anchors are never silently dropped. Missing/foreign/archived IDs produce a conflict error. Invalid model output never reaches the app. Auth, request, quota, configuration, audit and provider failures have sanitized JSON errors and retryable UI states.

## Validation and limits

The function validates the Auth token and queries wardrobe rows through a caller-scoped Supabase client with RLS and an explicit owner filter. Client-supplied attributes are replaced with current database values. All returned clothing and accessory IDs, categories, duplicates, roles, titles, complete clothing combinations and required IDs are checked in code. Known “no heels”, “wear jeans” and “no jeans” expressions receive additional deterministic checks. Under “no heels”, footwear must have explicit flat/no-heel metadata (or be identified as sneakers/trainers); unknown heel heights fail validation. A separate AI pass checks broader natural-language constraints, suitability and prose for invented pieces. That audit retains the full styling request and the attributes of selected pieces only, reducing free-tier token usage. This semantic check is probabilistic and depends on accurate wardrobe metadata; it is not a formal guarantee for arbitrary language. Unknown attributes should result in an impossible response when compliance cannot be established.

Before responding, the function re-reads the wardrobe and rejects changes to selected items during generation. The app also validates the result against its submitted wardrobe. Requests are capped at 750 KB, 500 active items and 20 required pieces; oversized wardrobes fail explicitly rather than silently truncating.

`npm run test:outfits` exercises contracts, hard requirements, authorization boundaries, spoofed attributes, concurrent wardrobe changes, provider failures, quota handling and mobile pagination. Provider calls are mocked. `npm run test:database` verifies quota isolation, expiry and tamper resistance in a disposable local PostgreSQL database. Live AI quality and hosted configuration still require a deployed environment.

Gemini references: [structured outputs](https://ai.google.dev/gemini-api/docs/structured-output), [generateContent API](https://ai.google.dev/api/generate-content), [Gemini 3.8 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash).
