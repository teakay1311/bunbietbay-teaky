<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run, deploy, and package this app

This repo now supports 2 runtime modes:
- web app via Vite
- desktop app via Electron with local file-based data storage
- Supabase-backed account login, trip collaboration, invitations, and role-based access
- optional Cloudinary image storage so photos do not bloat app snapshots

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy env file if you want account login and multi-user trips:
   `cp .env.example .env`
3. Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` if using Supabase.
4. Optionally fill in `VITE_CLOUDINARY_CLOUD_NAME` and `VITE_CLOUDINARY_UPLOAD_PRESET` if you want photos stored outside the app snapshot.
2. Run the app:
   `npm run dev`

## Configure Supabase Auth And Workspace Data

1. Create a Supabase project.
2. In Supabase SQL Editor, run these files in order:
   - `supabase/schema.sql`
   - `supabase/add_trip_enhancements.sql`
   - `supabase/add_revoked_trip_memberships.sql` (required for existing projects)
   - `supabase/add_trip_entity_links.sql`
   - `supabase/add_preferences_and_notebook_permissions.sql`
   - `supabase/protect_owner_memberships.sql`
   - `supabase/accept_invitation_function.sql`
3. Copy `.env.example` to `.env`.
4. Set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. In `Authentication -> Sign In / Providers`, enable Email OTP.
6. Open the hosted web app and sign in by email OTP.
7. After login:
   - each account gets a profile in `profiles`
   - only invited members can open a trip
   - each trip uses `owner`, `admin`, `editor`, or `viewer` roles
   - invitations are managed by email in the Trip Members screen

On localhost and desktop, the app can still operate in local mode when you have not signed in yet. On hosted web, login is required when Supabase is configured.

### Recover an existing Supabase project after the revoked-membership update

Do not run `schema.sql` again on a database that already contains trips.

1. Create a Supabase backup, then record row counts for `trips`, `trip_memberships`, `activities`, `expenses`, and `photos`.
2. Confirm whether `public.trip_memberships.revoked_at` exists in `information_schema.columns`.
3. Run the additive migrations in order, checking row counts after each file:
   - `supabase/add_revoked_trip_memberships.sql`
   - `supabase/add_trip_entity_links.sql`
   - `supabase/add_preferences_and_notebook_permissions.sql`
   - `supabase/protect_owner_memberships.sql`
   - `supabase/accept_invitation_function.sql`
4. Confirm existing memberships have `revoked_at is null`, then reload the PostgREST schema cache if the API still reports a missing column.
5. Reload the web app and sign in again. Keep additive columns if the frontend must be rolled back.

## Configure Cloudinary Photo Storage

If Cloudinary is configured, photo uploads are compressed then sent to Cloudinary, and the app stores only the returned image URL. This keeps trip workspaces lighter and avoids storing large images directly in browser storage.

1. Create a Cloudinary account.
2. Create an unsigned upload preset.
3. Copy `.env.example` to `.env` if you have not already.
4. Set:
   - `VITE_CLOUDINARY_CLOUD_NAME`
   - `VITE_CLOUDINARY_UPLOAD_PRESET`
   - optional `VITE_CLOUDINARY_FOLDER`
5. Restart the app.

If these variables are missing, the app falls back to compressed local photo storage and continues to work as before.

Current limitation: when using unsigned Cloudinary uploads, deleting a photo inside the app removes the photo from the app state, but does not automatically delete the remote asset from your Cloudinary account.

## Run Desktop Locally

1. Install dependencies:
   `npm install`
2. Start the renderer + Electron shell together:
   `npm run dev:desktop`

Desktop data is stored on the local machine inside the app `userData` directory. In the installed app, the Settings screen can open that folder directly.

## Test The App

- Run unit and helper tests:
  `npm test`
- Run TypeScript contract checks:
  `npm run typecheck`
- Run unused-code checks:
  `npm run lint`
- Run smoke E2E checks for the main routes:
  `npm run test:smoke`
- After building the desktop renderer, run Electron with isolated temporary user data:
  `npm run build:desktop:renderer && npm run test:electron-smoke`

Generated `dist/`, `release/`, `node_modules/`, and Vite cache files are intentionally not committed. CI and desktop packaging always rebuild them from source with `npm ci`.

The smoke suite opens the trips list, a seeded trip, settings, and an invalid trip route, then fails if the browser emits runtime errors.

## Build Desktop Installers

- Build a macOS installer on macOS:
  `npm run dist:mac`
- Build a Windows installer on Windows:
  `npm run dist:win`
- Build for the current OS with Electron Builder:
  `npm run dist:desktop`

Build output is written to:
`release/`

For cross-platform installer generation, use the GitHub Actions workflow:
`.github/workflows/desktop-build.yml`

It builds:
- `.dmg` on `macos-latest`
- Windows installer on `windows-latest`

## Deploy to GitHub Pages

This repo includes a GitHub Actions workflow for GitHub Pages deployment.

1. Push the repository to GitHub.
2. In GitHub, open `Settings -> Pages`.
3. Set `Source` to `GitHub Actions`.
4. Push to the `main` or `master` branch.

The workflow will:
- install dependencies with `npm ci`
- build the app with the correct GitHub Pages base path
- use `HashRouter` only for the GitHub Pages build, so refreshing sub-pages works

If your default branch is not `main` or `master`, update the workflow branch trigger.

## Deploy to Vercel

Set these variables for both Production and Preview before deploying:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_REQUIRE_AUTH=true`

Vercel runs `npm run build:vercel`. The read-only preflight blocks promotion when required variables, historical membership support, entity links, or preference tables are missing. Database migrations remain a separate, explicit step and are never run by the frontend build.
