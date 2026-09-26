# Add Wardrobe Item: setup and verification

## Hosted Supabase setup

If profiles and wardrobe/outfit tables already exist, run only
[`migrations/20260926000200_wardrobe_images.sql`](migrations/20260926000200_wardrobe_images.sql)
in your project's SQL Editor. It adds `wardrobe_items.image_path` and the private
`wardrobe-images` bucket. The previous two migrations are prerequisites. For a fresh
Supabase project, use the updated `sql/full_schema.sql` instead of running each migration.
This task does not apply changes to your hosted project.

Do not make the bucket public. Uploaded images are JPEG, limited to 5 MB, and named
`<auth user UUID>/<random photo UUID>.jpg`. Policies permit the owner to upload, read,
and delete unreferenced objects. No overwrite/update policy is granted. A restrictive
ownership guard prevents another bucket's broad permissive policy from exposing these
photos. The wardrobe row's path must belong to that row's user; it cannot simultaneously
store a private path and a legacy external image URL.

## App flow

1. Tap Add Item in My Wardrobe or the Home add-clothing shortcut.
2. Choose Take Photo or Choose From Photos. Search Online and Paste Product Link are
   visible, disabled, and labelled Coming soon.
3. Preview the selection. Retake/reselect as needed; canceling the picker retains the
   previous selection. Camera denial offers an explanation and Settings when blocked.
4. Tap Upload photo & continue. Images are converted to JPEG and reduced to at most
   1600 pixels on their longest edge (when source dimensions are available).
5. The app shows Analyzing item and requests editable AI suggestions (see AI_ANALYSIS.md).
   If unavailable, enter details manually. Review the piece's details and Save to wardrobe. The saved piece opens immediately;
   the wardrobe tab reloads when focused again.

Photos use Expo ImagePicker's system picker, so library selection does not request
broad photo-library access. iOS limited access is supported. Camera permission is
requested only when taking a photo. No microphone permission is requested/configured.
Android's pending picker result is recovered after activity recreation where available.
Web uses the system/browser picker; camera behavior depends on browser/device support.

Private photos are displayed using 10-minute signed URLs, refreshed on focus and every
8 minutes while focused. Signed URLs are bearer links valid until expiry; they are never
stored in wardrobe_items. Existing external image_url records keep working.

The client uploads ArrayBuffer bytes, avoiding React Native Blob/FormData limitations.
A stable photo path and item UUID make retries safe after lost responses. Failed saves
keep the photo/details for retry. Explicit cancellation cleans up unsaved uploads;
normal navigation away attempts cleanup as well. Deleting an item attempts file cleanup
after the database delete succeeds. Abrupt process termination, offline cleanup, or an
ambiguous save response can leave an unreferenced private object. Production maintenance
should periodically remove old unreferenced objects through the Storage API, with a grace
period for active drafts. Do not delete storage.objects rows directly. Auth-user deletion
also requires server-side Storage API cleanup; a database cascade does not remove bytes.

## Local development and builds

`expo-image-picker` and `expo-image-manipulator` are installed using Expo's SDK-compatible
installer. Both are available in compatible Expo Go. Restart Expo after installing:

```sh
npm start -- --clear
```

Existing custom development/production builds need rebuilding to include the added
native modules and permission strings. Native configuration is in app.json; no generated
ios/android directories are edited. A simulator without a camera can use library images.

Storage is now enabled in supabase/config.toml. For local Docker development, restart
this project's stack to activate Storage, then apply migrations using your local workflow.
The hosted project does not read local config.toml.

## Verification

```sh
npm run test:wardrobe
npm run test:database
npm run lint
npm run typecheck
npx expo export --platform ios --platform android --platform web
```

Unit tests cover native permission handling, picker cancellation, image normalization,
ArrayBuffer uploads, ownership path validation, signed URL expiry, and retry-safe saves.
Disposable PostgreSQL tests execute the migrations and Storage metadata policies, testing
cross-user/anonymous denial, broad-policy isolation, owner reads/uploads/deletes, and
wardrobe image constraints. The test Storage schema models managed metadata tables;
it does not run the Storage HTTP service or validate binary MIME detection.

Device checks still needed: take/reselect/cancel, deny and re-enable camera access,
select under limited photo access, upload an HEIC/large photo, interrupt connectivity,
retry Save, and verify the resulting piece on another signed-in device. No hosted test
accounts or wardrobe records are created by automated tests.
