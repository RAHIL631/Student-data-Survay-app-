# RLS and permission matrix

This matrix describes the authorization implemented by the source migrations at commit `db3d523` on `integration`. It describes the repository source, not proof of the currently deployed Supabase schema. The project owner has reported six production migrations applied; confirm the exact versions in Supabase migration history before relying on this matrix for production access.

`district_manager` is shown in the interface as **Viewer**. It is a read-only role. Access is limited to the manager's organization and, where applicable, district and owner grants.

| Resource | Anonymous | Organization admin | Viewer (`district_manager`) | Enumerator |
| --- | --- | --- | --- | --- |
| Organizations | None | Read own organization | Read own organization | Read own organization |
| Profiles | None | Read organization profiles, including inactive members for recovery; activate/deactivate other members through the authorized RPC | Read self and active same-district profiles within owner grants; no writes | Read self only; no writes |
| Districts and taluks | None | Organization-scoped CRUD under RLS | Read own district and locations within owner grants | Read own district and locations needed for assigned sessions |
| Schools | None | Organization-scoped CRUD; writes use the secure RPC | Read own district and owner-granted rows; no writes | Read own district and assigned-session locations |
| Screening sessions | None | Organization-scoped read/write; protected writes use secure RPCs | Read owner-granted sessions and same-district assigned sessions; no writes | Read assigned sessions only |
| Session assignments | None | Organization-scoped read/write | Read only rows allowed by district and owner grants; no writes | Read own assignments only |
| Student screenings | None | Organization-scoped read; protected writes use secure RPCs | Read only records allowed by owner grants; no writes | Read assigned-session records; update only own-created/owned records while assigned |
| SI reservations | None | No direct table access; authorized RPCs only | No direct table access; authorized RPCs only | No direct table access; authorized RPCs only |
| Audit logs | None | Read organization audit history | None | None |
| User invitations | None | Read organization history; invite/cancel through authorized function/RPC | Read same-district invitation history only; cannot invite or cancel | None |
| Legacy `students` table, if present | None | Deny by default | Deny by default | Deny by default |

## Safeguards

- Inactive profiles do not receive an effective role or data scope. An active organization admin can restore another organization member through `set_profile_active`; self-activation changes are denied and the action is audited.
- The invitation request RPC is restricted to an active organization admin. Viewers cannot invite or cancel enumerators.
- Client-supplied creator and owner metadata is not trusted. Database policies, column grants, triggers, and secure write RPCs enforce attribution and scope.
- SI reservation records are not directly accessible to client roles. Reservation and consumption use authorization-checked RPC and trigger paths.
- Public invitation preflight is identity-bound and read-only. Acceptance changes the invitation to accepted only after the matching profile is created.

## Production verification

The exact production migration versions and live role behavior must be checked in the Supabase project. Do not apply migrations from this document or change production policies as a substitute for that check. Test each role with real accounts and verify denied operations as well as allowed reads and writes.
