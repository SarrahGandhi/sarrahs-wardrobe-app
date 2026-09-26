# AI clothing suggestions

The app sends only `{ "image_path": "<user UUID>/<photo UUID>.jpg" }` to the
`analyze-clothing` Supabase Edge Function. It does not call OpenAI directly and contains
no AI API key. Only the pure JSON contract is shared with the mobile bundle.

## Enable on your hosted project

1. Apply prior profile, wardrobe, and private-photo migrations if not already installed.
2. Run `migrations/20260926000300_clothing_analysis_quota.sql` in Supabase SQL Editor.
   It creates a private counter and an authenticated RPC for an atomic 20-request/hour
   limit per account. Requests that reach the quota check count even if analysis fails.
3. In Supabase **Edge Functions → Secrets**, add `OPENAI_API_KEY` with an OpenAI API
   project key. It needs access to the model and API billing. Never use an EXPO_PUBLIC
   variable, commit this key, or place it in the mobile `.env`.
4. From the project directory, authenticate the CLI and deploy:

```sh
npx --yes supabase@2.117.0 login
npx --yes supabase@2.117.0 functions deploy analyze-clothing --project-ref nmxvtnxrxvstzsntkbdr
```

`verify_jwt = true` is configured in supabase/config.toml. Keep JWT verification enabled.
The function additionally validates the user token through `auth.getUser(token)` and uses
that user's RLS-scoped client for Storage and the quota RPC. Supabase supplies
`SUPABASE_URL` and `SUPABASE_ANON_KEY` to the runtime; no service-role key is used.

The default model is `gpt-4.1-mini-2025-04-14`, which supports image inputs and Structured
Outputs. Optional server secret `CLOTHING_ANALYSIS_MODEL` can select another compatible
Responses API vision model supporting the same JSON Schema. Model-specific compatibility
must be checked before changing it.

Restart/reload Expo after deploying. No additional native dependency or native rebuild is
needed for this step. Upload a new photo to test. The existing photo path is analyzed only
once per open Add Item flow, so revisiting details does not overwrite edits or charge again.

No hosted deployment, secret configuration, or live paid AI request is performed by the
repository tests. Until configured/deployed, the app falls back to manual entry.

## Runtime and data contract

- Request body is limited to 1 KB and must contain exactly image_path. Arbitrary image
  URLs, user IDs, storage bucket names, prompts, and model choices are rejected.
- The authenticated user ID must match the private object path. Download uses their
  Storage permissions; files are checked for JPEG MIME/signature and a 5 MB maximum.
- Image bytes are sent directly to OpenAI as a data URI. No public bucket or public
  image URL is created. `store: false` disables Responses API response storage; this
  does not imply exemption from the provider's other data-retention policies.
- A strict JSON schema requests all 14 fields, with nullable values. Server validation
  separately rejects missing/extra fields, wrong types, unsupported enums, long text,
  oversized arrays, invalid warmth, and sleeve/neckline values on incompatible categories.
- Nullable arrays: secondary_colours, possible_material, season, style_tags. Others are
  nullable strings/enums except warmth_level, a nullable integer from 1 to 5.
- suggested_name maps to name; possible_material maps to material. Unknown arrays become
  empty arrays for database compatibility. A missing category must be chosen by the user.
- Image text is untrusted input; the prompt asks the model to ignore embedded instructions.
  Material and warmth are expressly estimates, not verified product facts.
- AI calls have a 30-second timeout; Supabase backend calls have 10-second timeouts;
  mobile invocation has a 45-second timeout. Refusals, incomplete output, bad JSON,
  missing configuration, rate limits, and network errors all lead to manual entry.
- The user can skip waiting by choosing Enter details manually. Late client results
  are ignored after cancellation/unmount. An already-running server request may still
  finish and incur usage; canceling the UI does not guarantee canceling provider billing.
- Analysis never inserts or updates wardrobe_items. Only Save to wardrobe persists the
  reviewed form. Going back to the photo preserves the form; selecting a replacement
  photo discards the old suggestions. Private uploaded-photo cleanup follows PHOTOS.md.
- Responses use no-store and safe error messages. Provider payloads, image bytes, tokens,
  and API keys are not logged or returned. CORS supports the web app; token verification
  and RLS, not CORS, enforce access.

## Validation

```sh
npm run test:analysis
npm run test:wardrobe
npm run test:database
npm run lint
npm run typecheck
npx --yes deno check --config supabase/functions/deno.json supabase/functions/analyze-clothing/index.ts
```

Tests use mocked AI/Auth/Storage boundaries and real Request/Response handling, verify
strict output validation and client field mapping, and check database quota denial,
expiry, account isolation and tamper resistance in disposable PostgreSQL. Deno checks
the real Edge dependency. App exports verify iOS, Android and web bundling. Test real
photos, manual corrections, skip/failure paths, and final Save on a device after deployment.

References:
- [OpenAI image inputs](https://developers.openai.com/api/docs/guides/images-vision)
- [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini)
- [Supabase function authentication](https://supabase.com/docs/guides/functions/auth)
- [Supabase server secrets](https://supabase.com/docs/guides/functions/secrets)
