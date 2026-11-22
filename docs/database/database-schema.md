# Database schema and migration order

The local Supabase PostgreSQL schema is defined by the ordered SQL files in `supabase/migrations/`. Browser-facing generated types are in `src/lib/database.types.ts`; the service layer maps those rows to application types in `src/types.ts`. This document describes the repository's local migration set. It does not establish which migrations are present on a hosted project.

## Main tables

| Table | Purpose and relationships |
|---|---|
| `organizations` | Tenant root for organization data. |
| `profiles` | Application profile keyed by the existing `auth.users.id`; stores organization, role, optional district, and active state. Current roles are `organization_admin`, `district_manager`, and `enumerator`. |
| `districts`, `taluks`, `schools` | Organization-scoped location hierarchy. Composite constraints/policies protect tenant and location consistency. `schools` also has nullable creator/owner metadata in the current migrations. |
| `screening_sessions` | Screening event with organization, district, taluk, and school scope, creator attribution, optional owner, and session status/details. |
| `session_assignments` | Many-to-many assignments between sessions and enumerator profiles; duplicate pairs are prohibited and current migrations enforce active enumerator, organization, and district consistency. |
| `student_screenings` | Student screening observations and measurements linked to a session and location tuple; includes a manually entered SI number, status, immutable creator attribution, and nullable owner metadata. |
| `student_si_reservations` | Private, short-lived reservations for manually supplied SI numbers. Browser roles cannot directly read/write this table; the authenticated reservation RPC and database trigger manage reservations. |
| `audit_logs` | Trigger/function-generated records for audited changes, with organization and optional district scope. |
| `user_invitations` | Invitation state and organization/role/scope. The existing invitation workflow links an Auth user after invite and provisions a profile when the invitation is accepted. |

The legacy `public.students` table is not part of the current application model or generated browser types. Migration `008_secure_legacy_students.sql` enables RLS if that legacy table exists and leaves it without client policies.

## Ownership, attribution, SI numbers, and access

- `created_by` is set from the authenticated caller for API-created records and cannot be changed on update. Historical creator values are preserved.
- `owner_id` is nullable on schools, screening sessions, and student screenings. Existing session/screening owners are initialized from their known creators; existing schools without creator history are left unassigned rather than attributed to an inferred user.
- `transfer_record_ownership` is an audited operation with role/scope checks. Ownership metadata does not replace creator attribution or session assignments.
- Student SI numbers remain manually entered. `reserve_student_si_number` accepts the session ID, requested SI value, idempotency key, and optional existing student ID. It checks the active profile and allowed session scope, protects organization-wide uniqueness, and returns a reservation ID. The reservation is consumed by a trigger when the corresponding student write occurs. Expired reservations are cleaned by a service-role-only database function; the service key must remain server-side.
- Active-profile checks are used in protected operations and assignment access. RLS remains enabled and role/district scoping is enforced in policies and database functions; report exports use only frontend service results and do not bypass RLS.
- There is no Viewer role, owner-grant table, automatic SI-number generator, or offline submission queue in this schema.

## Migration order in this repository

Apply migrations in ascending filename order only after checking the target database's existing migration history and reviewing the deployment plan.

| File | Purpose |
|---|---|
| `001_init.sql` | Initial tenant, profile, district, and screening schema. |
| `002_live_backend.sql` | Location/session/assignment/screening backend, helper functions, RLS, and audit triggers. |
| `003_district_manager_scope.sql` | District-scoped reads and assignment access. |
| `004_audit_and_delete_scope.sql` | District-aware audit visibility and safe assignment deletion rules. |
| `005_user_invitations.sql` | Invitation storage and guarded invitation operations. |
| `006_restrict_profile_updates.sql` | Restricts browser profile updates to prevent role or tenant-scope escalation. |
| `007_scope_enumerator_locations.sql` | Limits enumerator location reads to assigned work. |
| `008_secure_legacy_students.sql` | Enables RLS on the unused legacy `public.students` table when present, without client policies. |
| `009_student_completion_status.sql` | Student screening completion status support. |
| `20261120175954_enforce_skeletal_observation_requirement.sql` | Enforces the skeletal observation requirement used by screening completion. |
| `20261121100000_restrict_public_role_grants.sql` | Restricts public-role table/function grants. |
| `20261122000000_server_controlled_created_by.sql` | Sets creator attribution from the authenticated identity and limits insertable columns. |
| `20261123000000_active_profiles_and_record_ownership.sql` | Adds active profiles and nullable record ownership, scoped active-profile checks, activation and ownership-transfer workflows. |
| `20261124000000_student_si_reservations.sql` | Adds private SI reservations, authenticated reservation, consumption, and server-only cleanup. |
| `20261125000000_support_new_student_reservations.sql` | Extends reservation support for new student submissions while keeping the user-entered SI value. |
| `20261126000000_active_audit_actor_enforcement.sql` | Prevents inactive authenticated profiles from performing audited operations and improves district attribution for assignment audit entries. |
| `20261127000000_enforce_assignment_district_consistency.sql` | Validates existing and future assignments across organization, district, role, and active status. |
| `20261128000000_fix_si_reservation_parameter_ambiguity.sql` | Fixes reservation function parameter/column ambiguity without changing its current contract. |

The timestamped files above are the seven backend migrations added after the earlier migration set. The locally present files do not prove hosted application or migration status. Never reset a live database to reconcile migration history; use `docs/deployment/hosted-supabase-migration-plan.md` for preflight and deployment safeguards.

## Local database tests

With the local Supabase stack running, run:

```powershell
npx supabase test db .\supabase\tests\database
```

The database tests use transactional fixtures. SI concurrency behavior is separately exercised with `npm run test:si-concurrency` against the local stack. Neither check verifies the hosted database.
