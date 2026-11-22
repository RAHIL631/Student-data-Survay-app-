# RLS and permission matrix

This matrix describes the final **local** schema after all migrations. Every public application table has RLS enabled. Hosted Supabase still needs the seven reviewed forward migrations before this matrix describes production.

| Table | `anon` | Organization admin | District manager | Enumerator |
| --- | --- | --- | --- | --- |
| `organizations` | none | SELECT own organization | SELECT own organization | SELECT own organization |
| `profiles` | none | SELECT active same-organization profiles; update allowed profile fields | SELECT self and active same-district profiles; no writes | SELECT self only; no writes |
| `districts`, `taluks` | none | organization-scoped SELECT/INSERT/UPDATE/DELETE | own district SELECT | own district and required assigned-session location SELECT |
| `schools` | none | organization-scoped CRUD | own district-scoped CRUD | own/assigned-session location SELECT |
| `screening_sessions` | none | organization-scoped SELECT/INSERT/UPDATE | own district SELECT/INSERT/UPDATE | assigned-session SELECT |
| `session_assignments` | none | organization-scoped SELECT/INSERT/DELETE | own district SELECT/INSERT/DELETE | own assignment SELECT only |
| `student_screenings` | none | organization-scoped SELECT/INSERT/UPDATE | own district SELECT/INSERT/UPDATE | assigned-session SELECT/INSERT and own-created/owned UPDATE while assigned |
| `student_si_reservations` | none | no direct table access; authorized RPC only | no direct table access; authorized RPC only | no direct table access; authorized RPC only |
| `audit_logs` | none | organization SELECT | same-district known-scope SELECT | none |
| `user_invitations` | none | approved history columns; invite/cancel through RPC + Edge Function | same-district history; invite/cancel enumerators within district | none |
| Legacy `students`, when present | none | none | none | none |

## Safeguards

- Active profile helper functions return no effective role or scope for inactive users. The only inactive-profile data available to the user is their own activation flag, needed for a clear sign-out message.
- Client writes cannot supply or change creator/owner metadata. Table privileges are column-limited; RLS independently enforces scope.
- An active organization administrator can activate/deactivate other organization profiles through `set_profile_active`; the RPC denies self-change and emits an audit row. There is no direct client `is_active` update grant.
- `transfer_record_ownership` accepts only supported records and checks active actor, target, organization, district, and assignment scope before changing owner and writing an audit row.
- Session assignment triggers require an active enumerator, matching organization, and exactly matching district. Managers also require their own district. The migration aborts before creating the constraint if existing rows violate it.
- SI reservation RPC checks active actor, role, assignment/session scope, uniqueness, and idempotency. The reservation table is inaccessible directly; authenticated SI changes are accepted only when a matching reservation is consumed by the trigger.
- Invitation state writes are narrow RPCs. Auth user invitation is performed by the server-side `invite-user` Edge Function, which validates the caller's JWT. The Supabase service-role key belongs only in Edge Function secrets.
- Auth recovery and invitation URLs are Supabase Auth configuration requirements; they are not database privileges.

## Reviewed test coverage

Local pgTAP tests cover account status and ownership changes, active-enumerator assignments, same-district assignment scope, organization/district RLS, creator-field protection, invitation transitions, legacy-table denial, profile update grants, screening completeness, expired SI reservation reassignment, and public-role table privileges. Current result: 236 assertions across 9 files pass locally.
