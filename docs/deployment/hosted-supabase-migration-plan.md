# Hosted Supabase migration and data-transfer plan

## Current state and boundary

The remote Supabase project was inspected read-only. It has 11 applied migrations: `001`–`009`, `20261120175954`, and `20261121100000`. The seven migrations listed below are local-only and have not been applied to hosted Supabase. This work has made no hosted SQL, Auth, Edge Function, or Vercel changes.

The remote public schema matched the 11-migration baseline: no `profiles.is_active`, creator/owner columns on schools/sessions/screenings, or SI reservation table. Remote aggregate counts observed were 1 organization, 1 profile, and zero districts, taluks, schools, screening sessions, assignments, screening records, audit events, and invitations. Do not include the account identity in public reports. Local aggregate counts observed were 1 organization, 2 profiles, 1 school, 1 session, and 5 student screenings; there were no assignment organization/scope mismatches. Local data has not been reset or deleted. Do not transfer local testing records without a separate explicit data-transfer approval.

The hosted snapshot is read-only and must be refreshed immediately before any deployment. Verify live migration history and schema again because database state can change.

## Ordered forward-only package

Apply these seven files, in this exact order, after confirming the hosted history is still the 11-entry baseline:

1. `20261122000000_server_controlled_created_by.sql`
   - Server-derive creator IDs on session/screening inserts; prevent client edits; limit client INSERT columns.
   - Does not rewrite existing records.
2. `20261123000000_active_profiles_and_record_ownership.sql`
   - Adds active profile flag with default `true`; adds school creator/owner and session/screening owner.
   - Backfills session/screening owners from existing `created_by`; leaves historical `created_by` untouched and school owner/creator NULL where history is unavailable.
   - Adds active-aware helpers, activation and ownership-transfer RPCs, ownership triggers, and least-privilege column grants.
3. `20261124000000_student_si_reservations.sql`
   - Creates private SI reservation ledger, advisory-lock reservation RPC, consume trigger, and service-role-only cleanup RPC; adjusts screening grants for reservation-backed SI writes.
4. `20261125000000_support_new_student_reservations.sql`
   - Corrects new-student reservation flow so a client-chosen pending student UUID is supported before the student row exists.
5. `20261126000000_active_audit_actor_enforcement.sql`
   - Preserves existing audit trigger behavior and rejects inactive authenticated actors from protected audit-producing operations.
6. `20261127000000_enforce_assignment_district_consistency.sql`
   - Preflight aborts if any existing assignment crosses organization or district, refers to a non-enumerator, or otherwise violates the intended same-district relationship.
   - Adds active/same-organization/same-district assignment trigger and tightens assignment INSERT policy.
7. `20261128000000_fix_si_reservation_parameter_ambiguity.sql`
   - Recreates the SI reservation RPC with an unambiguous argument name. Grants are revoked/reapplied narrowly; the reservation table and existing records are unchanged.

No migration resets schemas, truncates/deletes application data, changes `auth.users`, or weakens RLS. A SQL migration is atomic per file, but the full seven-file sequence is not one transaction. If a migration fails, stop and inspect the reported file and resulting migration history before proceeding. Do not replay or edit any migration already applied; corrections must be new forward migrations.

## Preconditions before hosted execution

1. Review the complete migration/test diff on `integration` and confirm the exact release commit is the one intended for deployment.
2. Obtain a fresh full hosted backup through an authorized connection. Include schema and data; verify restore capability or a documented restore procedure. Older local backup artifacts are historical and are not a sufficient current hosted backup.
3. Re-read hosted migration history and inspect actual constraints, indexes, grants, RLS, policies, triggers, and functions. Compare against current migrations; stop on divergence.
4. Run the assignment preflight query below using a read-only connection. Resolve any returned row explicitly; do not delete or silently reassign it.
5. Check for any existing SI duplicates within organization before adding/using reservation behavior. The reservation migration preserves existing student rows.
6. Confirm application maintenance window and recovery owner. Take an additional backup immediately before applying the package.

Read-only assignment preflight:

```sql
SELECT a.id, a.organization_id, a.session_id, s.district_id AS session_district,
       a.enumerator_id, p.role, p.is_active, p.district_id AS profile_district
FROM public.session_assignments a
LEFT JOIN public.screening_sessions s ON s.id = a.session_id
LEFT JOIN public.profiles p ON p.id = a.enumerator_id
WHERE s.id IS NULL OR p.id IS NULL
   OR a.organization_id IS DISTINCT FROM s.organization_id
   OR a.organization_id IS DISTINCT FROM p.organization_id
   OR s.district_id IS DISTINCT FROM p.district_id
   OR p.role IS DISTINCT FROM 'enumerator';
```

This query uses only baseline columns so it can be run before migration 2 adds `is_active`.

## Deployment and verification sequence

Once separately approved, apply the seven SQL files in order with Supabase CLI migration tooling or the SQL editor. Capture each success and verify recorded migration versions. Then run the following read-only checks:

```sql
-- Required additions
SELECT table_name, column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (table_name, column_name) IN (
    ('profiles','is_active'), ('schools','created_by'), ('schools','owner_id'),
    ('screening_sessions','owner_id'), ('student_screenings','owner_id'),
    ('student_screenings','si_reservation_id')
  )
ORDER BY table_name, column_name;

-- RLS remains enabled on sensitive and new tables
SELECT c.relname, c.relrowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('profiles','schools','screening_sessions','session_assignments',
                    'student_screenings','student_si_reservations','user_invitations');

-- Assignment scope must be empty
SELECT a.id
FROM public.session_assignments a
JOIN public.screening_sessions s ON s.id = a.session_id
JOIN public.profiles p ON p.id = a.enumerator_id
WHERE a.organization_id <> s.organization_id
   OR a.organization_id <> p.organization_id
   OR s.district_id IS DISTINCT FROM p.district_id
   OR p.role <> 'enumerator';

-- Reservation ledger is never directly accessible to browser API roles
SELECT has_table_privilege('anon', 'public.student_si_reservations', 'SELECT') AS anon_select,
       has_table_privilege('authenticated', 'public.student_si_reservations', 'SELECT') AS authenticated_select;
```

Additionally inspect grants/policies for all tables and verify creator/owner columns are absent from client write grants. Run the complete database suite against a controlled hosted staging project before production, then smoke-test account activation, invitation/recovery, multiple enumerators, SI create/edit/retry/concurrency, and organization/district RLS with dedicated accounts. Never use student production data as test fixtures.

## Data and Auth handling

- The existing hosted account/profile/organization stay as-is through schema migrations. Migrations do not edit Auth-managed tables.
- The hosted project currently has almost no application operational records, while local contains test and screening data. No local-to-hosted transfer is included. If requested separately, inventory/classify records, prepare a foreign-key-ordered dry run with identity crosswalk, verify sensitive-data authorization and a current backup, then seek approval of the exact transfer before writing.
- Never copy `auth.users` directly or assume password hashes can be moved. Invite/create hosted accounts through supported Supabase Auth APIs and map application foreign keys through an approved identity crosswalk.
- Preserve historical creator attribution. Historical school owner/creator stays NULL; session/screening ownership is derived from their existing creator fields.

## Manual configuration (separate approval required)

- In Supabase Auth URL Configuration, set the production Site URL and allow the deployed origin plus `/reset-password` and `/accept-invitation` destinations. Verify the exact Vercel domain before saving.
- Deploy `invite-user` from reviewed source. Set `INVITE_ALLOWED_ORIGINS` to the exact production origin (and intentionally used previews only). Set Supabase URL, anon key, and service-role key as server-side Edge Function secrets. Never expose service-role credentials in Vercel variables or frontend bundles.
- Schedule or invoke `cleanup_expired_student_si_reservations` using an authorized server-side mechanism; only `service_role` can execute it.
- Keep Vercel's public `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_ENV`, and local-test-login flag configured as frontend environment settings. Public anon keys are designed for frontend use with RLS; do not print or commit their values. Preview/production settings are configured separately.
- Confirm Vercel Production Branch and redeploy the reviewed integration release only after code and hosted schema approvals.

## Recovery considerations

The migrations are additive or tighten permissions. Existing rows are not deleted. Migration 2 backfills owner IDs only from existing creator IDs; revert is not a simple down migration because later data may rely on these columns/RPCs. Migration 3 creates reservation infrastructure and changes SI write grants. Migration 6 rejects cross-district assignments and therefore must not be applied until its preflight is clean. Migration 7 safely replaces the RPC in one transaction and reapplies its execute grants. If an approved deployment fails partway, stop; preserve the database, inspect applied versions and restore from the verified backup only under the incident procedure. Do not reset hosted Supabase or replay applied migrations.

## Current unverified items

- Auth redirect allow-list and `invite-user` production deployment/runtime configuration have not been independently verified.
- A previous read-only production inspection found the Vercel bundle targeted the hosted Supabase project but still requested the obsolete `profiles.is_active` field. A fresh live bundle request was blocked by this environment's network policy, so the current deployment and Production Branch are unverified. The local production build targets the hosted project and contains no localhost endpoint or service-role marker.
- Production Vercel login/dashboard is not validated by local tests. After approved release, verify the browser's Supabase endpoint, profile query, and role-scoped dashboard using approved test accounts.
- No hosted write, migration, Auth configuration, Edge Function deployment, data transfer, Vercel deployment, commit, or push occurred during this preparation.
