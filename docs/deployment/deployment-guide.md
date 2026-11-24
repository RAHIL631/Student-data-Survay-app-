# Frontend deployment guide

This application is a Vite and React single-page app. Production deployment must point to the intended Supabase project and preserve client-side route refreshes, including `/accept-invitation`.

## Vercel project setup

1. Connect the GitHub repository `RAHIL631/Student-data-Survay-app-` to the Vercel project.
2. Set the production branch to `integration` when deploying this integration line. Confirm the deployment commit includes the intended reviewed changes.
3. Use the repository root as the project root. Keep the Vite defaults: install with `npm install` (or `npm ci` in CI), build with `npm run build`, and output directory `dist`.
4. Set the client environment variables in Vercel for each required environment:
   - `VITE_SUPABASE_URL`: URL for the intended Supabase project.
   - `VITE_SUPABASE_ANON_KEY`: that project's publishable/anon key.
5. Never put a Supabase `service_role` key or other secret in a `VITE_` variable. Vite embeds `VITE_` values in browser assets.
6. Ensure Supabase Auth Site URL and redirect allow-list include the production app origin and the invitation callback path. The callback is `/accept-invitation`.
7. Configure SPA fallback/rewrite behavior so direct navigation and refresh on `/accept-invitation` load the app entry point.
8. Deploy a preview first, inspect build output, then promote/deploy production through the approved Vercel workflow.

## Pre-deployment checks

- Confirm repository, branch, root directory, build command, output directory, and commit SHA in the Vercel deployment details.
- Confirm the configured Supabase URL belongs to the intended project without exposing environment variable values in logs, screenshots, or support requests.
- Confirm the matching Supabase migrations and Edge Functions are present in the target project. A successful frontend build does not establish that backend state is current.
- Review CI results for dependency installation, tests, type validation, and production build.

## Post-deployment smoke checks

1. Open the deployment URL and refresh it. Confirm the application loads without failed assets or browser console errors.
2. Open `/accept-invitation` directly. Confirm the public page loads and rejects missing or invalid invitation context safely.
3. Sign in with a test account for each role and verify route access, logout, refresh, and session restoration.
4. Verify the real invitation lifecycle using the existing pending invitation when available: admin invitation, delivered email, preflight, name/password setup, profile creation, acceptance, retry behavior, and subsequent login. Do not create duplicate invitations or delete existing Auth users for recovery tests.
5. Verify student registration, screening submission/retrieval, assigned-session access, and database changes using approved test data.
6. Inspect browser network responses and Supabase Auth, Edge Function, RPC, and database logs for errors, including RLS denials. Do not weaken RLS to silence errors.

Record the deployment URL, commit SHA, build result, and each smoke-check outcome. Mark flows that were not actually exercised as unverified. Do not claim successful invitation email delivery or end-to-end acceptance based on build or migration checks alone.
