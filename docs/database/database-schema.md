# Database schema

The application uses the existing Supabase PostgreSQL database. The source of truth is the ordered migration chain in `supabase/migrations/`; generated browser types are maintained in `src/lib/database.types.ts`.

## Tables

| Table | Purpose and key relationships |
|---|---|
| `organizations` | Tenant root for organizational records. |
| `profiles` | One application profile per `auth.users` account; carries organization, role, and optional district. |
| `districts` | Belongs to one organization; organization/code and organization/id are unique. |
| `taluks` | Belongs to an organization and district. |
| `schools` | Belongs to an organization, district, and taluk; composite foreign keys enforce that scope. |
| `screening_sessions` | Belongs to an organization, district, taluk, and school; created by a profile in the same organization. |
| `session_assignments` | Connects an enumerator profile with a session in the same organization; duplicate session/enumerator pairs are prohibited. |
| `student_screenings` | Student screening data connected to one complete session/location tuple and its creator. |
| `audit_logs` | Trigger-generated records for audited data changes, with organization and optional district scope. |
| `user_invitations` | Invitation history and state for the role/scope approved at creation; Auth-user identity is linked after the Admin Auth invite call. |

The legacy `students` table is not part of the application schema and is intentionally not exposed in generated application types. Migration 008 enables RLS on it if it exists; no client policy is granted.

## Integrity and lifecycle

- Composite foreign keys enforce organization/district/taluk/school consistency rather than trusting browser-supplied IDs.
- `profiles.id` references `auth.users.id`; deleting an Auth user cascades to its profile.
- Invitation organization, district, and inviter references use `ON DELETE RESTRICT` to retain invitation history. Deleting the linked Auth user clears `auth_user_id` but does not erase the invitation.
- Invitation identity/scope fields are immutable. Invitation creation uses an inviter-bound idempotency key and a global active-email uniqueness index.
- Profile creation happens only in `accept_user_invitation`, after the confirmed Auth user matches both the invitation email and recorded `auth_user_id`. Profile creation and the accepted state update happen in one database transaction.
- Invitation recipients set a password through Supabase Auth before the SPA calls the acceptance RPC. Passwords are never stored in application tables.
- There is no general Auth-signup trigger or public administrator-signup endpoint. The first organization administrator must be provisioned by an authorized local operator after creating the Auth user.
- Cancellation does not revoke a Supabase Auth email link. The acceptance function rejects a cancelled invitation, and Auth users are not automatically deleted.
- Automatic expiration, resend, and operator reconciliation are not implemented. The schema supports an `expired` state, but no scheduled process currently transitions pending invitations to it.

## Migration order

1. `001_init.sql` — tenant, profile, district, and initial screening tables.
2. `002_live_backend.sql` — locations, sessions, assignments, screening schema, helper functions, RLS, and audit triggers.
3. `003_role_scope_hardening.sql` — role-scoped access before owner isolation.
4. `004_owner_scoped_records.sql` — owner IDs, audit metadata, soft deletes, grants, per-owner SI numbering, and owner-based RLS.
5. `005_district_manager_scope.sql` — district-scoped read-only master-data visibility.
6. `006_audit_and_delete_scope.sql` — audit visibility and safe assignment deletion rules.
7. `007_user_invitations.sql` — invitation storage, policies, and guarded database operations.
8. `008_restrict_profile_updates.sql` — limits profile updates to the display-name column.
9. `009_scope_enumerator_locations.sql` — limits enumerator location reads to their own district and locations used by sessions assigned to them.
10. `010_secure_legacy_students.sql` — enables RLS on the unused legacy `public.students` table when present, without granting client access.

Viewer (`district_manager`) access to screening records is read-only and requires an explicit `owner_data_grants` entry. Viewers do not create or modify records or assignments. Administrators manage grants and can read all records in their organization; Screening Faculty can access only their owned records.

The merged migration chain has not yet been verified against a local or hosted database. Hosted migration state must be checked by an authorized owner before any hosted rollout. Never reset a database to resolve migration history.

## Local database tests

Run the pgTAP suite against the local Supabase stack:

```powershell
npx supabase test db .\supabase\tests\database
```

The tests run inside transactions and roll back their fixtures. Concurrency guarantees should additionally be exercised with separate local database sessions; the single-session pgTAP tests do not establish race behavior.
