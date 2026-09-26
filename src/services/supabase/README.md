# Supabase client boundary

`client.ts` exports a single typed client, or a configuration error if public
credentials are missing/invalid. Session storage and PKCE are configured here.
`profiles.ts` reads the signed-in user's profile, with ownership enforced by RLS.

Auth operations live in `../auth/`; session lifecycle and profile state live in
`../../providers/AuthProvider.tsx`. Models mirror the checked-in migration.

See [local setup, migrations, and verification](../../../supabase/README.md).
No service-role key, secret key, or database password belongs in the mobile app.
