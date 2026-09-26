# Service boundary

Supabase profile reads live in `supabase/`; authentication operations live in
`auth/`. Screens consume these typed operations through the auth context and
shared action hook. Future weather, generation, and image-analysis operations
belong here, calling authenticated server functions when secrets are involved.
