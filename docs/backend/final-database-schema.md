# Database schema in the integration source

This describes the schema after applying the complete `integration` migration chain present at commit `db3d523` in filename order. The repository includes migrations through `20261204000000_secure_authenticated_write_rpcs.sql`, following `20261128000000_fix_si_reservation_parameter_ambiguity.sql`. This source history does not prove which migrations are applied in the hosted Supabase project. The project owner has reported six production migrations applied; verify exact migration IDs in the project's migration history before treating production as aligned. Do not apply these migrations blindly or infer production state from this document.

## Tables and scope

| Table | Purpose and key additions |
| --- | --- |
| `organizations` | Tenant root. |
| `profiles` | `id` equals the Supabase Auth user ID; organization, optional district, email, name, constrained role (`organization_admin`, `district_manager`, `enumerator`), and `is_active boolean not null default true`. |
| `districts`, `taluks`, `schools` | Organization and location hierarchy with composite foreign keys. Schools include server-managed `created_by` and `owner_id`; historical school rows remain NULL because historic authorship is unknown. |
| `screening_sessions` | Location-scoped sessions, immutable server-attributed `created_by`, and `owner_id`. Existing owner IDs are backfilled from `created_by`; `created_by` itself is preserved. |
| `session_assignments` | Many-to-many relationship between sessions and enumerators. A session can have multiple enumerators; an enumerator can have multiple sessions. A trigger requires active enumerators and exact organization/district match. |
| `student_screenings` | Demographic and screening data with server-attributed creator, owner, completion status, optional SI number, and internal `si_reservation_id`. Existing owner IDs are backfilled from `created_by` without changing creator history. |
| `student_si_reservations` | Internal reservation ledger, no direct `anon`, `authenticated`, or `service_role` table grants. Reservations are made through an authorized RPC and consumed by a student-row trigger. |
| `audit_logs` | Trigger-generated row events plus explicit account activation and ownership transfer events. Actor identity is derived from `auth.uid()`. |
| `user_invitations` | Idempotent invitation state machine, scoped to organization and (where applicable) district. Auth account actions occur through the `invite-user` Edge Function and Supabase Auth API. |

The `public.students` legacy table, if present, is RLS enabled and deny-by-default with no client policies or client SELECT privileges. Current application data uses `student_screenings`.

## Important constraints and workflows

- Roles are `organization_admin`, `district_manager`, and `enumerator`; invitation creation supports district managers and enumerators. Profile creation is through trusted provisioning/invitation flows, never public self-registration.
- All active application tables have RLS. Scope helpers ignore inactive profiles. The own-profile SELECT exception lets a disabled user read `is_active` so the frontend can sign the session out and show the account status.
- Schools, sessions, and screening records derive creator/owner metadata in database triggers. Client grants exclude those fields. Historical `created_by` values are not rewritten.
- `set_profile_active` is organization-admin-only, disallows self-status changes, and writes an audit event. `transfer_record_ownership` checks organization/district/role/assignment scope and audits successful changes.
- Assignment INSERT and UPDATE triggers enforce active enumerator status, same organization, and same district. Existing invalid assignments cause the migration preflight to abort for explicit review.
- SI number uniqueness remains organization-wide. `reserve_student_si_number` uses advisory locking, a 15-minute reservation, and an idempotency key. Authenticated inserts or SI changes require a matching reservation; direct table access to the reservation ledger is revoked. Cleanup is exposed only to `service_role` and must be scheduled/operated server-side.
- Invitation acceptance uses the invitation's stored organization, district, email, and role. The service-role credential is required only by the Edge Function runtime; it must not be in Vite or Vercel frontend variables.
- Password recovery uses Supabase Auth; `/reset-password` and `/accept-invitation` must be included in Auth redirect configuration.

## Security function requirements

Security-definer functions in the new migrations set `search_path = ''`, qualify database objects, and perform explicit active-user, role, and scope checks. The `write_audit_log` replacement preserves prior district and cascade handling while rejecting inactive JWT actors. Direct execution of trigger-only functions is revoked. No migration reads, inserts into, updates, or deletes from Supabase-managed `auth.users`.

## Migration chain

Hosted baseline observed read-only: `001`–`009`, `20261120175954`, and `20261121100000` (11 entries). Local forward migrations after that baseline are:

1. `20261122000000_server_controlled_created_by.sql`
2. `20261123000000_active_profiles_and_record_ownership.sql`
3. `20261124000000_student_si_reservations.sql`
4. `20261125000000_support_new_student_reservations.sql`
5. `20261126000000_active_audit_actor_enforcement.sql`
6. `20261127000000_enforce_assignment_district_consistency.sql`
7. `20261128000000_fix_si_reservation_parameter_ambiguity.sql`

The local database has the full sequence applied. The exact backup, preconditions, verification queries, rollback limits, and manual configuration steps are in [hosted-supabase-migration-plan.md](../deployment/hosted-supabase-migration-plan.md).
