# Frontend and backend dependency audit

This inventory covers the `integration` branch after its full local migration chain. Local runtime and tests do not establish production availability; hosted Supabase remains on the 11-migration baseline until the seven forward migrations and server configuration are approved and applied.

## Frontend flows

| Flow | Frontend dependency | Backend support |
| --- | --- | --- |
| Login and session restore | `AuthProvider` calls Supabase Auth then `getProfile` | `auth.users` remains Supabase-managed; profile lookup uses active-aware `public.profiles`. Inactive profiles are signed out and shown a clear message. |
| Password recovery | Supabase Auth recovery email and password update | Auth URL allow-list must include production origin and `/reset-password`. |
| Invitation | `invite-user` Edge Function; invite/cancel/history/accept calls | Idempotent invitation table/RPC state machine, supported Supabase Auth invite API, and profile provisioning from invitation scope. |
| Dashboard and reports | Count/list queries for screenings, sessions, districts, taluks, schools, profiles, audit events | RLS scopes by active role, organization, district, and assignment. CSV export is client-side. |
| Locations | create/update districts, taluks, schools | Existing hierarchy/constraints; schools derive creator and owner server-side. |
| Sessions | create/update and select session rows | Creator/owner set in trigger; managers limited to own district. |
| Assignments | many-to-many assign/unassign | RLS, audit triggers, and scope trigger enforce active enumerator and exact organization/district match. |
| Student registration and editing | create/update/view screenings and SI number | Session scope, immutable creator, owner, completion trigger, reservation RPC and one-use reservation trigger for non-null SI assignment/changes. |
| Account status | Settings account activation manager | Admin-only `set_profile_active` RPC, self-change denied and audit logged. |
| Ownership management | service method `transferRecordOwnership` | Authorized RPC checks scope and role, then audits transfer. Current UI does not expose a transfer screen. |
| Local test login | browser-only local test mode | Deliberately bypasses Supabase and only stores local test data; must remain disabled for production. |

## Other backend dependencies

- Edge Functions in source: `invite-user` is implemented. `admin-operations`, `export-reports`, and `sync-submissions` directories are documentation-only; the app does not call those functions.
- Offline sync queue is not implemented. Local test mode stores browser-only demo data; it is not an offline production submission path.
- No Supabase Storage upload or bucket is used by the current frontend.
- Reset-password is handled by Supabase Auth; invitation auth-user creation is server-side through Supabase Auth Admin from the Edge Function. The migrations never modify Supabase-managed Auth tables.

## Security model

Frontend route visibility is convenience only; RLS and checked RPCs are the authorization boundary. The roles are `organization_admin`, `district_manager`, and `enumerator`. Inactive profiles have no effective role. Organization admins manage organization data; district managers manage their district; enumerators access assigned sessions and their created/owned screenings.

Every security-definer function in the new migrations uses an empty search path and qualified references. Functions that can mutate state perform active-user and scope checks. Trigger functions are not executable by API roles. No service-role key belongs in Vite environment variables or the deployed frontend.

## Hosted deployment dependencies

- Vercel frontend variables already point at the hosted project per the user's setup, but hosted project use should be rechecked after deployment; no production login/dashboard claim is made here.
- The hosted schema is missing the seven local forward migrations. See [the ordered deployment plan](../deployment/hosted-supabase-migration-plan.md).
- Production Auth URL configuration and `invite-user` deployment/origin settings were not independently verified. Configure the production app origin, `/reset-password`, and `/accept-invitation`; set `INVITE_ALLOWED_ORIGINS` to the exact allowed origins.
- Edge Function runtime needs its Supabase URL, anon key, and service-role key as server-side secrets. Never put service-role credentials in Vercel frontend variables.
- Production workflows still need approved deployment and test accounts. Local tests do not prove hosted authentication or dashboard behavior.
