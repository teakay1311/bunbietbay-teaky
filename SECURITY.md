# Security Plan

## Current safeguards

- Electron runs with `contextIsolation`, `sandbox`, `webSecurity`, and `nodeIntegration: false`.
- External navigation from the Electron shell is blocked and opened in the system browser.
- Web builds include a baseline Content Security Policy in [index.html](/Users/teakay/Downloads/bunbietbay-&-teakay's-trips/index.html).
- Supabase client code uses only the public anon key in frontend code.
- Optional app lock with PIN is available locally on the device.

## Near-term hardening

1. Keep production deployments behind HTTPS only.
2. Add RLS validation review for all Supabase tables used in production.
3. Move Cloudinary destructive operations behind a trusted backend or serverless function.
4. Encrypt desktop app state at rest with a user-derived key if the app stores sensitive data.
5. Add signed release pipelines for desktop installers.

## Operational guidance

- Never expose Supabase service-role keys or Cloudinary API secrets in frontend code.
- Treat JSON backup files as sensitive user data.
- Prefer Cloudinary or another remote storage provider for large photo libraries instead of local embedded images.
