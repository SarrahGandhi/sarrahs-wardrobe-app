# Outfit recommendations

`Style Me` saves the plan, loads all active wardrobe pages (up to 500 items), and invokes the authenticated `recommend-outfits` Edge Function. Successful results are displayed in the planning screen. Recommendations are transient; this feature does not save generated looks.

## Deployment

Apply migrations with `npx supabase db push`, including `20260926000500_outfit_recommendation_quota.sql`, then deploy `recommend-outfits`.

Outfit generation defaults to **Groq**, using `openai/gpt-oss-120b` with strict JSON schema output. Groq has a rate-limited free plan; use a free-plan account to avoid paid usage. Create a key at https://console.groq.com/keys.

For local development, set these in the git-ignored `supabase/functions/.env`:

```dotenv
OUTFIT_AI_PROVIDER=groq
GROQ_API_KEY=your-key
```

Run `npm run supabase:functions` and leave it running. Restart the command after changing secrets. For hosted deployment, configure those same values as Supabase Edge Function secrets. Never prefix a server key with `EXPO_PUBLIC_`. `GROQ_OUTFIT_MODEL` optionally overrides the Groq model and must support strict JSON schema and low reasoning effort.

There is **no automatic OpenAI fallback**. To explicitly restore OpenAI, set `OUTFIT_AI_PROVIDER=openai` and `OPENAI_API_KEY`; its optional model override is `OUTFIT_RECOMMENDATION_MODEL`. Clothing photo analysis still uses its existing OpenAI configuration; this switch applies to outfit recommendations only.

Successful generation makes two provider calls (generation and requirements audit), each with a 40-second deadline. A Groq `json_validate_failed` rejection receives one automatic retry within that same deadline; a short HTTP 429 rate limit is retried once after the provider’s `retry-after` delay, up to 25 seconds within the same deadline. Long or repeated rate limits return an actionable error. Other request errors are not retried. The mobile invocation timeout is 110 seconds. The database permits 10 attempts per user per hour. Groq also enforces its own free-tier limits, which the app reports separately from the account limit. Authentication and provider failures use sanitized messages. Hosted secrets do not transfer to the local runtime.

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

The function validates the Auth token and queries wardrobe rows through a caller-scoped Supabase client with RLS and an explicit owner filter. Client-supplied attributes are replaced with current database values. All returned clothing and accessory IDs, categories, duplicates, roles, titles, complete clothing combinations and required IDs are checked in code. Known “no heels” and “wear jeans” expressions receive additional deterministic checks. A separate AI pass checks broader natural-language constraints, suitability and prose for invented pieces. That audit retains the full styling request and the attributes of selected pieces only, reducing free-tier token usage. This semantic check is probabilistic and depends on accurate wardrobe metadata; it is not a formal guarantee for arbitrary language. Unknown attributes should result in an impossible response when compliance cannot be established.

Before responding, the function re-reads the wardrobe and rejects changes to selected items during generation. The app also validates the result against its submitted wardrobe. Requests are capped at 750 KB, 500 active items and 20 required pieces; oversized wardrobes fail explicitly rather than silently truncating.

`npm run test:outfits` exercises contracts, hard requirements, authorization boundaries, spoofed attributes, concurrent wardrobe changes, provider failures, quota handling and mobile pagination. Provider calls are mocked; live AI quality and deployed RLS/quota behavior require a configured Supabase environment.

Groq uses [strict structured outputs](https://console.groq.com/docs/structured-outputs). See [free-plan rate limits](https://console.groq.com/docs/rate-limits). The optional OpenAI adapter uses the Responses API with `store: false`.
