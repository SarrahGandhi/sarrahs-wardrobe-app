# Local Supabase and authentication

The local stack provides PostgreSQL, Auth, the REST API, Studio, and Mailpit.
It does not require a hosted Supabase account. Storage, Realtime, and Edge Functions
are disabled until their application features are implemented.

## Start and run

Install Docker Desktop and keep it running. From the project directory:

```bash
npm ci
npm run supabase:start
npm run supabase:env    # only needed if .env has not already been created
npm start -- --clear
```

The CLI is pinned to 2.117.0 in the npm scripts. The environment script copies
only the API URL and public publishable key from local status. It refuses to
replace an existing `.env` unless you explicitly pass `--replace`.

- API: http://127.0.0.1:54321
- Studio / database: http://127.0.0.1:54323
- Local email inbox: http://127.0.0.1:54324

All signup and reset emails stay in Mailpit; nothing is emailed externally.
Create your own account in the app, open Mailpit, and enter its six-digit code.
Test accounts created by `npm run test:auth` are removed afterward.

`npm run supabase:stop` stops this project's stack and retains its database.
Do not run `supabase db reset` against data you want to keep.

## Phones and emulators

The generated `.env` uses `127.0.0.1` for iOS Simulator and desktop web, and
`EXPO_PUBLIC_SUPABASE_ANDROID_URL=http://10.0.2.2:54321` for Android Emulator.

For a physical phone, use your computer's LAN address in both public URL variables
and restart Expo. The phone and computer need the same trusted local network;
your firewall must permit the local API port. The Android override must be changed
too, or it will still point to the emulator-only host alias.

Entering email codes works without a custom URL scheme and is convenient for
Expo Go and emulators. Email links also work with the PKCE callback route when
opened in the app/browser that initiated the request. A link containing localhost
cannot reach your computer from a physical phone: use the code from Mailpit.

For native release/development builds, the existing `sarrahs-wardrobe` URL scheme
routes to `sarrahs-wardrobe://auth/callback`. Test link handling in an installed
native build before release. PKCE verifiers use Expo Crypto on native platforms
and browser Web Crypto on web. A consumed, expired, or cross-device PKCE link
shows a recovery message rather than admitting the user to private screens.

## Database

The full wardrobe/outfit design, ownership rules, deployment instructions, and
database tests are documented in [SCHEMA.md](SCHEMA.md). The additive migration is
`migrations/20260926000100_wardrobe_and_outfits.sql`; a complete fresh-project SQL
script is available at [sql/full_schema.sql](sql/full_schema.sql).


`migrations/20260925000100_profiles.sql` creates:

- `profiles`: `id`, `display_name`, nullable `avatar_url`, `created_at`, `updated_at`.
- A foreign key to `auth.users` with cascading deletion.
- An atomic signup trigger, plus backfill for pre-existing Auth users.
- An update trigger that maintains `updated_at` on the server.
- RLS policies allowing authenticated users to select/update only their own row.
- Column grants permitting updates only to `display_name` and `avatar_url`.

Clients cannot insert/delete profiles, change their ID, or supply timestamps.
Anonymous clients have no access. Trigger functions use a fixed search path and
are not callable by client roles. Any future private tables and Storage buckets
need their own owner-scoped policies before the app uses them.

## Auth implementation

- `src/services/supabase/client.ts`: single typed client, PKCE, persisted sessions,
  public-key validation, explicit missing-configuration state.
- `src/providers/AuthProvider.tsx`: initial restoration, auth event subscription,
  foreground refresh lifecycle, persisted password-recovery mode, race-safe profile
  fetching, loading/errors/retry. Auth callbacks do not await additional Auth calls.
- `src/services/auth/`: real signup/login/logout, confirmation resend, recovery,
  code verification, password changes, callback exchange, native PKCE support.
- `src/screens/auth/`: accessible forms with validation and pending/error/success states.
- `src/app/_layout.tsx`: private tabs and detail screens require a session; recovery
  sessions are directed to password reset; public forms are signed-out only.
- Profile displays the authenticated email/name and provides logout. Home uses the
  real profile name instead of the former sample identity.

Native sessions use AsyncStorage, as in Supabase's React Native integration;
web sessions use the SDK's browser storage. No password is persisted by the app.
Logout revokes this device's refresh session and clears its stored session. Other
devices remain signed in. As with Supabase generally, an already issued access
JWT can remain valid until expiry; RLS still limits it to its owner.

The existing outfit photographs remain labelled sample content. They are not
stored in the database or represented as items owned by the authenticated user.

## Verification

```bash
npm run test:auth:unit
npm run test:auth
npm run typecheck
npm run lint
npx expo-doctor
npx expo export --platform ios --platform android --platform web
```

The integration suite uses the real local Auth/REST APIs and actual Mailpit emails:

- Signups, confirmation requirements, confirmation links/codes, automatic profiles.
- Own-profile updates and timestamps; denial of anonymous and cross-user access.
- Denial of inserts/deletes, ID changes, and timestamp tampering.
- SDK session persistence/restoration, refresh, logout, invalid credentials, login.
- Reset links/codes, the recovery auth event, password update, old-password rejection,
  used-link rejection, and invalid-code rejection.

Only randomly named `.test` accounts created by the current run are deleted.
The suite refuses to run against a non-loopback URL. It uses no service-role key;
cleanup uses the named local Docker database container.

Unit tests cover validation, safe error messages, callback deduplication/replay,
and native PKCE adapter behaviour with an injected crypto implementation.
These automated checks do not replace a native device interaction pass. No browser
or device was connected during implementation, so native form interactions,
keyboard behaviour, and operating-system email-link dispatch remain to be checked.

## Moving to hosted Supabase later

1. Apply the migration to the intended project using its SQL Editor or Supabase CLI.
2. Enable email/password authentication and email confirmation; use an 8+ character
   minimum password length.
3. Copy the confirmation and recovery templates from `templates/` to the hosted
   email templates. They contain both `{{ .Token }}` and `{{ .ConfirmationURL }}`.
4. Configure SMTP for real delivery. The local Mailpit setup does not deliver mail.
5. Allow the exact native callback and the deployed web callback (including the
   recovery query). Local `exp://**` redirects are for development only.
6. Replace `.env` with the hosted HTTPS project URL and public publishable key.
   Remove/empty the Android override so it uses the hosted URL as well.
7. Restart Expo and repeat tests with suitable hosted test accounts.

Never copy `SECRET_KEY`, `SERVICE_ROLE_KEY`, `JWT_SECRET`, or database credentials
from CLI status into `.env` or any `EXPO_PUBLIC_*` variable. Client configuration
is bundled into the app; only public keys belong there.

References: [Supabase React Native](https://supabase.com/docs/guides/auth/quickstarts/react-native),
[profile triggers](https://supabase.com/docs/guides/auth/managing-user-data),
[PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow), and
[Expo protected routes](https://docs.expo.dev/router/advanced/protected/).
