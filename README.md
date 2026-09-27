# Sarrah's Wardrobe

An Expo React Native TypeScript foundation for a personal wardrobe and stylist app.
Uses Expo SDK 57, Expo Router, strict TypeScript, and an editorial light theme.

## Run locally

Use Node.js 22.13 or newer (an LTS release is recommended) and npm.

```bash
npm ci
npm start
```

The app uses hosted Supabase through the ignored `.env` file, already configured
in this workspace. For a fresh checkout, copy `.env.example` to `.env` and set
your hosted project's URL and public publishable key. Leave the Android URL
override empty so every platform uses the hosted project.

Scan the QR code with an SDK 57-compatible Expo Go installation. Your phone and
computer should be on the same network. Alternatively:

```bash
npm run ios      # iOS Simulator; requires macOS and Xcode
npm run android  # Android emulator; requires Android Studio / a running emulator
npm run web      # optional browser preview
```

If your Expo Go version doesn't support SDK 57, use a compatible Expo Go version
or a development build. After changing `.env`, fully reload the app.
See [authentication setup and verification](supabase/README.md) for email confirmation,
password reset, optional local Supabase setup, and the SQL migration.

## What's implemented

- Five tabs: Home, Wardrobe, Plan, Saved, and Profile, with a prominent olive Plan button.
- Working navigation and a missing-route screen.
- Editorial Home with a greeting, photography hero, outfit-planning CTA, recent sample looks,
  and wardrobe / add-clothing shortcuts.
- Shared sample look cards in Home and Saved, with navigable look previews.
- An add-clothing flow with camera/library selection, preview, private upload, and manual item details.
- Shared theme tokens, accessible controls, responsive content width, wrapping text,
  and reusable loading, empty, and input-error states.
- Top/side safe areas in screens, bottom safe areas owned by the tab navigator.
- iOS keyboard avoidance, Android window resize, keyboard dismissal on scroll,
  and a tab bar that hides while the keyboard is open.
- A Router error boundary for unexpected rendering errors.

Authentication is implemented with Supabase: account creation, confirmation, login,
logout, session persistence/refresh, password recovery, and protected navigation.
A database trigger creates profiles; RLS restricts reads and updates to the owner.
My Wardrobe now loads real user-owned items with search, category/favourite filters,
detail/edit/delete actions, and an anchored outfit brief. See
[wardrobe implementation](src/services/supabase/WARDROBE.md).
Camera/photo-library item creation and private Storage uploads are implemented.
See [photo setup and testing](supabase/PHOTOS.md).
AI clothing analysis now suggests editable item attributes after upload. Enable it using
[Edge Function setup](supabase/AI_ANALYSIS.md). Outfit generation, weather, and profile
editing remain future work.

Temporary UI fixtures live in `src/mocks/editorial.ts`; they are not user-owned records
and are not persisted. Sample labels distinguish these previews from real saved looks.
Category and preference chips are static previews, not filters or saved selections.
Photography is bundled for offline rendering; credits are in `assets/editorial/README.md`.

## UI foundation structure

Authentication adds `src/providers/`, `src/screens/auth/`, `src/services/auth/`,
`src/app/(auth)/`, `src/app/auth/callback.tsx`, `src/app/reset-password.tsx`,
`src/types/{user,database}.ts`, `supabase/`, `scripts/`, and `tests/`.
See [the auth architecture](supabase/README.md#auth-implementation) for details.

```text
.
├── .env.example
├── .gitignore
├── AGENTS.md
├── LICENSE
├── README.md
├── app.json
├── eslint.config.js
├── package.json
├── package-lock.json
├── tsconfig.json
├── assets/                         # Starter icons and bundled preview photography
│   ├── editorial/
│   │   ├── README.md
│   │   ├── hero.jpg
│   │   ├── tailored.jpg
│   │   └── city.jpg
│   ├── android-icon-background.png
│   ├── android-icon-foreground.png
│   ├── android-icon-monochrome.png
│   ├── favicon.png
│   ├── icon.png
│   └── splash-icon.png
└── src/
    ├── app/                        # Expo Router routes only
    │   ├── _layout.tsx
    │   ├── +not-found.tsx
    │   ├── add-clothing.tsx
    │   ├── looks/
    │   │   └── [id].tsx
    │   └── (tabs)/
    │       ├── _layout.tsx
    │       ├── index.tsx
    │       ├── wardrobe.tsx
    │       ├── plan.tsx
    │       ├── saved.tsx
    │       └── profile.tsx
    ├── navigation/
    │   └── tabs.ts
    ├── screens/
    │   ├── HomeScreen.tsx
    │   ├── AddClothingScreen.tsx
    │   ├── LookPreviewScreen.tsx
    │   ├── WardrobeScreen.tsx
    │   ├── PlanOutfitScreen.tsx
    │   ├── SavedScreen.tsx
    │   └── ProfileScreen.tsx
    ├── components/
    │   ├── PageHeading.tsx
    │   ├── EditorialPhoto.tsx
    │   ├── HomeShortcut.tsx
    │   ├── LookCard.tsx
    │   └── ui/
    │       ├── AppText.tsx
    │       ├── Button.tsx
    │       ├── Card.tsx
    │       ├── Chip.tsx
    │       ├── EmptyState.tsx
    │       ├── IconButton.tsx
    │       ├── Input.tsx
    │       ├── LoadingState.tsx
    │       ├── Screen.tsx
    │       ├── SectionHeader.tsx
    │       └── index.ts
    ├── constants/
    │   ├── theme.ts
    │   └── wardrobe.ts
    ├── hooks/
    │   └── useResponsiveLayout.ts
    ├── mocks/
    │   └── editorial.ts
    ├── services/
    │   ├── README.md
    │   └── supabase/
    │       └── README.md
    ├── types/
    │   ├── look.ts
    │   └── ui.ts
    └── utils/
        └── getErrorMessage.ts
```

All files above were created for the foundation and primary-interface steps. `AGENTS.md`, `LICENSE`,
and icons came from the official Expo starter. Its `App.tsx` and `index.ts`
were removed in favour of the Router entry point. Generated `.expo/`,
`expo-env.d.ts`, `dist/`, and `node_modules/` are ignored.

Navigation configuration lives outside `app/` because Expo Router treats files
in that directory as routes. Route files only re-export screen components.
Use the `@/` alias for `src/` imports. Future business logic belongs in hooks and
services, with shared domain contracts in `types/`.

## Shared components

`Screen` defaults to scrolling and owns top/side safe areas. Set `bottomInset`
for standalone screens outside tabs. It accepts `contentStyle` and `scroll`.

`Button` supports primary, secondary, and ghost variants, icons, disabled state,
and a loading indicator. `IconButton` requires an accessibility label. `Input`
supports normal React Native input props plus a label, hint, and error.
`Chip` is static unless given `onPress`; interactive chips support selected and
disabled states. `Card`, `SectionHeader`, `LoadingState`, and `EmptyState` provide
shared presentation. `AppText` centralizes text styles without disabling font scaling.

## Verification

```bash
npm run typecheck
npm run lint
npx expo-doctor
npx expo export --platform ios --platform android
```

Expo Doctor passed 21/21 checks during setup. TypeScript, lint, and iOS, Android,
and web bundle exports passed after the primary-interface update.
Native bundle export verifies compilation, not device behaviour.
Browser/device visual checks were unavailable in the development session.
Before shipping, check each tab on iOS and Android at small and large text sizes,
safe-area insets, Android back navigation, and keyboard behaviour when forms are added.

The initial dependency audit reports 13 moderate advisories inherited through
Expo/Router dependencies (`uuid` and `decode-uri-component` chains). There were
no high or critical advisories. npm's proposed fixes include incompatible major
downgrades; those were not applied. Recheck upstream fixes before release.

## Configuration

`.env.example` documents the public Supabase configuration. The generated `.env`
connects to the local Docker stack; no hosted credentials are needed for local work.
Migration SQL and owner-only RLS are in `supabase/migrations/`.
Never put AI keys, product-search secrets, or service-role keys in `EXPO_PUBLIC_*`.

The app name, URL scheme, light appearance, and Android keyboard resize behaviour
are configured in `app.json`. Launcher artwork is still the Expo starter artwork.

Reference: [Expo Router installation](https://docs.expo.dev/router/installation/)
and [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/).

The Plan Outfit tab supports occasion, manual weather, preferences and multiple starting
pieces from your wardrobe. Style Me validates and saves a plan; generation is not yet
implemented. Apply the [Plan Outfit migration](supabase/PLAN_OUTFIT.md) to enable saving.
