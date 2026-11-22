# Selective collaborator feature integration plan

**Status: planning only.** This plan is based on the branch audit and a fresh read of `friend` refs. No collaborator source, backend file, migration, or shared branch was changed. Keep the existing local backend implementation and dirty worktree intact throughout any later approved integration.

## Branch and commit scope

The latest refs were refreshed from `friend` only; they match the audit. `friend/feature/backend-infrastructure` is already an ancestor of `friend/integration`; it has no missing commits to port. Do not re-import its invitation, recovery, or public-grant migration history.

The branch-only history on `friend/chore/project-structure` is:

| Commit | Work | Selective action |
| --- | --- | --- |
| `878b8d0` | Admin portal and login | Port selected admin UI and login presentation; keep current auth/profile contract. |
| `7b2ce3b` | Screening and mobile layout | Review and adapt page/layout changes to current data services and permissions. |
| `8d49b37` | Unified staff/admin frontend | Port missing admin routes and navigation selectively; do not replace current app/auth shell wholesale. |
| `883f001` (merge) | Backend invitation/recovery integration | Do not merge. Its backend-infrastructure parent is already integrated; review only file-level follow-up changes. |
| `fd68985` | Offline sync and Android APK | Port offline queue selectively after replacing its incompatible SI creation contract; assess Android/PWA additions separately. |
| `683fcb1` | Workflow registration refresh | No file change in the commit; no standalone port. |
| `13be579` | Android workflow registration test | Review resulting workflow only; do not copy its interim state without the later workflow. |
| `0b7cfc1` | Restore Android APK workflow | Port the manual debug APK workflow after validating the Android project. |
| `9e72f0e` | Expanded enumerator manual | Adapt and update the existing manual. |
| `76888e7` | GitHub Actions updates | Port only compatible workflow changes and keep integration triggers. |
| `31e90a5` (merge) | Merge Android offline-sync branch | Do not merge; its Android changes are covered by the source branch commits below. |
| `26153fa` | Vercel SPA rewrite | No port needed: `vercel.json` is identical on `friend/integration`. |

`friend/subashree/android-offline-sync` contributes six commits, all included in the chore branch's Android history and all absent from integration:

- `fd689854027e000c15fe0f14cfbbad3cf8ec1c40` — offline sync and Android APK project.
- `683fcb1716f5cb0cd845bd218ba2d6b7697c9156` — workflow registration refresh (no file diff).
- `13be579fd1a0ea1139dc3145c1d1bf62a33fc73b` — workflow registration test changes.
- `0b7cfc160a02c07d317155bddf7de73f8f337966` — restore APK workflow.
- `9e72f0e5b65f8a2d5aed86def31e4dd8c146d790` — user manual.
- `76888e76bad17c1e59f2ef997f5a799720aad197` — workflow updates.

The chore branch's ten non-merge patches are not patch-equivalent to integration. The Vercel route change is already present by file content; the remaining nine non-merge changes need the review described here. The Android source branch has five integration-only commits (`7425096`, `943a797`, `430097f`, `f51ccb7`, `787b6a8`) and does not contain those later backend/deployment changes. Do not use the Android branch as a replacement base.

## Feature and file port map

For each source below, read from `friend/chore/project-structure:<path>` (or `friend/subashree/android-offline-sync:<path>` where indicated). Port by adapting into the matching target path on integration; never copy the branch's full file over a locally modified file.

| Feature | Source path(s) | Target path(s) and selective treatment |
| --- | --- | --- |
| Admin organization overview | `src/pages/AdminDashboardPage.tsx` | Add `src/pages/AdminDashboardPage.tsx`; it calls existing `getDashboardSummary`, `getDistricts`, and `getOrganizationUsers`. Wire it into `src/App.tsx` as the organization-admin dashboard. |
| Staff/admin routes and navigation | `src/App.tsx`, `src/lib/permissions.ts`, `src/components/Layout.tsx` | Merge route, menu, and permission entries into the existing files. Restrict `/users` and admin-only actions to `organization_admin`; preserve the current role names/labels (`district_manager` remains district manager). |
| Admin user management | `src/pages/AdminUsersPage.tsx`, `src/components/InvitationManagement.tsx` | Add/adapt an admin page that reuses current invitations and the existing `AccountActivationManagement`/`setProfileActive` RPC. Keep the current organization/district permissions. Do not copy the Viewer owner-grant panel by default (see backend gap below). |
| Login and responsive shell | `src/pages/LoginPage.tsx`, `src/components/Layout.tsx`, `src/index.css`, `src/App.tsx` | Review the visual and mobile improvements as focused diffs. Preserve current auth restoration, inactive-account sign-out, recovery state, route guards, Vite/React Router setup, and SPA rewrite. |
| Screening/mobile workflow | `src/pages/ScreeningSessionsPage.tsx`, `src/pages/StudentRegistrationPage.tsx`, `src/pages/AssignmentsPage.tsx`, `src/pages/StudentsPage.tsx`, `src/pages/DashboardPage.tsx`, `src/pages/EnumeratorsPage.tsx`, `src/pages/SchoolsPage.tsx`, `src/pages/ReportsPage.tsx`, `src/pages/ProfilePage.tsx`, `src/pages/SettingsPage.tsx`, `src/components/Layout.tsx`, `src/index.css` | Port mobile/responsive presentation and useful workflow affordances one component at a time. Preserve existing multi-enumerator assignments, manual SI entry/reservation, creator attribution, ownership RPCs, status rules, current export behavior, and route security. |
| Offline queue and idempotency | `src/lib/pendingSubmissions.js`, `src/lib/pendingSubmissions.d.ts`, `src/lib/pendingSubmissionSync.js`, `src/lib/pendingSubmissionSync.d.ts`, `src/lib/studentSubmissionIdempotency.js`, `src/lib/studentSubmissionIdempotency.d.ts`, `tests/offline/pending-submissions.test.js` | Add these paths after adapting the uploader to the current `createStudentScreening` API. Merge pending-submission types into `src/types.ts`; selectively update `src/context/AuthProvider.tsx` and `src/pages/StudentRegistrationPage.tsx`. Do not port the branch `dataService.ts` wholesale. |
| PWA offline app shell | `vite.config.ts`, `src/main.tsx`, `public/manifest.webmanifest`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-maskable-512.png`, `index.html` | Add only a compatible service-worker/PWA setup and missing assets. Keep current `vercel.json`; ensure API/Auth responses are not cached and SPA routes still work on direct navigation. Review `public/school-students.jpg` only if the selected login design uses it. |
| Student reports | `src/services/export/studentReport.ts`, `src/pages/ReportsPage.tsx` | Add/adapt the client-only PDF/XLSX export service and buttons. Preserve existing CSV export and formula-injection handling. Add `exceljs`, `jspdf`, and `jspdf-autotable` individually only if the exports are approved and bundle/build checks pass. |
| Android shell | `capacitor.config.ts`, `android/**` (including Gradle wrapper/settings/build files, `android/app/**`, manifest, `MainActivity.java`, resources and `.gitignore` files), `android/README.md` | Add the generated Capacitor Android project at the same paths after validating app identity, native permissions, package versions, and wrapper execution mode. Do not import build outputs or user-local signing files. |
| APK workflow | `.github/workflows/android-apk.yml` | Add a manual debug-APK workflow after CI validation. Keep Node 22, Java/Android SDK setup and artifact upload; this source workflow builds an unsigned debug APK and does not require signing secrets. |
| CI workflows | `.github/workflows/ci.yml`, `.github/workflows/tests.yml` | Adapt commands and job additions, but retain `integration` push/PR coverage. The chore workflow changes triggers to `main`/`chore/project-structure`; copying them unchanged would stop CI from running on the target branch. |
| Documentation | `README.md`, `docs/OFFLINE_SYNC.md`, `docs/user-manuals/README.md`, `docs/user-manuals/user-manual.md`, `docs/database/database-schema.md`, `docs/deployment/backup-and-recovery.md`, `android/README.md` | Update user manuals and offline instructions to match the final implementation and data-retention policy. Rewrite schema/backup statements against the current schema/runbook; do not copy claims that depend on the chore migration model. |

Keep current integration functionality that the chore tree removes or rewrites, including `src/pages/StudentDetailsPage.tsx`, the existing `src/lib/screeningStatus.*` and `src/lib/studentExport.*` modules, their tests, and the current invitation/reset routes. Do not apply branch deletions as part of a selective port.

## Backend compatibility map

The current local design is the seven uncommitted timestamped migrations `20261122000000`–`20261128000000`: active profiles; `created_by` preservation and nullable historical owners; `transfer_record_ownership`; many-to-many active enumerator assignments constrained to the same organization and district; and the current manual-SI reservation RPC. Keep that model and its migrations unchanged unless an explicitly reviewed new requirement needs a forward migration.

| Collaborator dependency | Current local support | Plan |
| --- | --- | --- |
| Dashboard counts, districts, profiles, sessions and screenings | Existing `getDashboardSummary`, `getDistricts`, `getOrganizationProfiles`/`getOrganizationUsers` and RLS-scoped reads | No migration. Adapt the page to existing service return types and active-profile filtering. |
| Account activation | `profiles.is_active`, `set_profile_active` RPC, audit logging, frontend `setProfileActive` and activation component | No migration. Use the RPC; do not directly update `profiles.is_active` from a service-role function or browser. Active-profile checks—not Auth bans—are the current access boundary. |
| Password reset for staff | Supabase Auth recovery flow and `/reset-password` route exist | No database migration. Use the current recovery flow with the correct redirect. If server-side admin authorization for sending another user's reset email is required, separately design a JWT-verified Edge Function; do not reuse the branch function without review. |
| User invites | Current `user_invitations` schema/RPCs and `invite-user` Edge Function | Reuse the existing workflow. Compare any chore edits and preserve idempotency, invitation scope, acceptance checks and current runtime secrets. |
| School owner assignment | `schools.owner_id` and audited `transfer_record_ownership` exist, but this RPC currently permits organization-admin/district-manager targets for schools, not enumerators | The branch `SchoolsPage` assigns schools to active enumerators through `assign_school_owner`. If that feature is required, a new forward migration is genuinely needed to extend the existing transfer RPC/policy safely for an active same-organization/same-district enumerator and audit the change. Do not import `assign_school_owner` or the branch trigger. |
| Viewer-to-owner data grants | **Not supported.** Current roles are admin, district manager, enumerator; district managers have district-scoped operational access. No `owner_data_grants`, `set_owner_data_grant`, `can_view_owner_data`, or viewer-only role/policy exists. | Do not port this UI or broaden RLS by assumption. If owner-specific read sharing is required, obtain product/security approval for the role semantics and prepare a separate additive schema/RLS design with tests. |
| Owner metadata | Local `owner_id` exists on schools/sessions/screenings; `created_by` remains historical attribution; transfer RPC audits changes | Use current types/services. Do not require branch `updated_by`, `deleted_by`, `deleted_at`, or `NOT NULL` ownership. Do not overwrite `created_by` or assign historical schools to an arbitrary enumerator. |
| Student SI allocation | Local `reserve_student_si_number(target_session_id, requested_si_number, request_idempotency_key, requested_student_id)` reserves a user-entered SI number; reservation rows are private and consumed by a trigger. | Branch `dataService.ts` calls a different two-argument RPC `(target_session_id, target_idempotency_key)` returning an auto-generated number. Do not call it. Adapt offline sync to preserve the submitted SI value and pass the current reservation key/student ID to `createStudentScreening`. No new table/migration is needed for queuing a pending submission. |
| Student submission retry | Student row has stable UUID primary key; current insert path checks an existing row by ID and exact payload, with creator checks | Persist the stable student ID and SI request key in IndexedDB. Retry through the current service; never treat an unrelated SI collision as a successful duplicate. No new database column is required. |
| Multiple enumerators | `session_assignments` many-to-many; active enumerator and same-district checks | Keep existing assignment service/policy and pgTAP coverage. Do not import owner-as-assignment or single-owner assumptions from branch pages. |

### Migration collisions to avoid

Do not import collaborator `003_role_scope_hardening.sql` through `010_secure_legacy_students.sql`. Its versions `003`–`009` collide with different SQL already present in the hosted/integration history. In particular, `004_owner_scoped_records.sql`:

- makes owner/creator metadata non-null and backfills schools to an inferred admin/enumerator;
- writes `created_by = owner_id` and adds `updated_by`, `deleted_by`, and soft-delete fields;
- creates `owner_data_grants`, `student_si_counters`, and a different `student_si_reservations` shape;
- defines the two-argument auto-number RPC and owner-sharing RLS.

The local reservation table has the same name but a different, already-applied local schema and function contract. Never combine the two definitions. Existing local database migrations already include the necessary active/owner/SI support for the online workflow; the only identified potential new migration is the conditional enumerator school-owner transfer extension above. No migration is required for the offline queue, admin overview, PDF/XLSX export, or Android shell.

## Edge Function and secrets

`supabase/functions/admin-provision-user/index.ts` exists only on the chore branch. It expects runtime `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `ADMIN_ALLOWED_ORIGINS`. It verifies a JWT and organization-admin profile, but then directly changes the profile active flag, bans/unbans the Auth user, and inserts audit rows through the service client. That creates split-state/error-recovery cases and bypasses the current `set_profile_active` workflow; do not deploy it as-is. Prefer the existing RPC for activation and current recovery flow for reset requests. If an admin-only Auth Admin action is later approved, require a separately reviewed, idempotent Edge Function with strict origin/JWT checks and service-role credentials only in Supabase server secrets.

`invite-user` is already implemented in the integration lineage. Its `INVITE_ALLOWED_ORIGINS` and standard Supabase runtime secrets remain separate from any proposed admin function. Never place a service-role key in Vite, Vercel, Android resources, or the APK. No function deployment/config change is part of this plan.

## Android and offline-sync dependencies

- Offline storage uses IndexedDB database `student-health-hub-offline`, store `pendingSubmissions`, with per-user index, stable local IDs, idempotency keys, lease/claim state, retries and conflict records. The queue stores full student screening details on the device. It is not encrypted by this code; decide device/retention/logout policy before enabling it with real student data. The implementation scopes reads/sync by user ID but leaves local records on disk, including after logout.
- The service worker uses Workbox to precache static app assets and navigate back to `index.html`; the configuration shown does not intentionally cache Supabase API responses. Confirm this in the final generated worker and test Vercel SPA routes and offline reloads.
- Port the workflow as **manual debug APK** only. Its required tools are Node 22, Java 21, Android SDK platform/build-tools 36, Capacitor CLI/core/Android packages, npm lockfile, and Gradle wrapper. The checked-in workflow builds `assembleDebug` and uploads an artifact; it does not sign a release APK. A signed/release workflow would require a separate secrets and approval design.
- The chore package manifest downgrades Vite 8 to Vite 5, `@vitejs/plugin-react` 6 to 4, React Router 7 to 6, and `.nvmrc` from Node 22 to 18, while adding Capacitor 8, PWA and report libraries. Do not copy that manifest/lockfile or `.nvmrc`. Add only required packages and lock changes after verifying peer compatibility with the existing Vite/React Router/Node versions. Preserve the current engine requirement and test the Vite PWA plugin against Vite 8 before selecting a version.
- Check `android/app/src/main/AndroidManifest.xml` permissions, application ID, Gradle SDK/Java settings and executable wrapper mode. Do not include build outputs, local signing properties, or unrelated generated files.

## Safe implementation order (for a later approved task)

1. Preserve the existing backend work and use a separate review worktree/branch after approval; do not reset, clean, or replace files in the current dirty integration worktree. Review the full source diffs for the listed paths.
2. Port the admin overview, route and responsive UI changes first, wiring only to current services, roles, AuthProvider and RLS. Keep account activation on `set_profile_active` and invitation operations on `invite-user`.
3. Decide whether school-to-enumerator ownership and viewer owner grants are required. If school assignment is required, design/test a new forward migration extending the existing RPC. Do not implement viewer grants without explicit role/RLS approval.
4. Port the offline queue with the current backend contract: generate and persist a stable student UUID and SI idempotency key before queueing, keep the manually entered SI, scope pending data to the authenticated user, and retry only via current `createStudentScreening`. Keep conflict data locally and expose clear resolution; do not overwrite records.
5. Add PWA service-worker/app-shell support without changing the Vite major or Supabase data caching. Then add Capacitor Android files and the debug workflow, preserving integration CI triggers and Vercel rewrites.
6. Port report exports and update manuals/schema documentation to the actual local schema. Keep existing student detail, status, CSV and password recovery functionality.
7. Review the exact staged diff later; run TypeScript validation, unit/offline tests, local pgTAP/RLS/security tests, build, dependency audit, service-worker checks, Android `cap sync`, Gradle unit tests and `assembleDebug`. Smoke-test login/recovery, admin navigation, assignments, SI creation/edit/retry, offline reconnect and account switching with dedicated test data.
8. Stop for review before any hosted migration, Edge Function deployment, Vercel deploy, merge, commit, or push. Apply only new forward migrations that have separately reviewed preconditions, tests and backup plan.

## Risks and approval checkpoints

1. **Role and data-sharing decision:** confirm whether “Viewer” owner-specific access is a real required role/permission. It conflicts with the existing district-manager role and RLS model.
2. **School ownership decision:** confirm whether admins must assign schools directly to enumerators; current transfer RPC intentionally limits target roles. If yes, approve a separate forward-only RPC/policy migration after local tests.
3. **Student-data-at-rest decision:** approve IndexedDB storage, device controls, retention, logout/account-switch behavior, backup exposure and conflict handling before field use.
4. **Toolchain decision:** retain current Vite 8/React Router 7/Node 22; approve only individually compatible dependencies. Do not accept branch-wide version downgrades as an Android prerequisite.
5. **Auth and Edge Function decision:** any new admin-only Auth operation must have server-side caller verification and protected runtime secrets; no direct public profile update or service-role frontend access.
6. **Release decision:** after full diff/test review, separately approve merge/push, hosted migrations, Edge Function configuration, and Vercel deployment. This planning task performs none of them.

## Features that can be ported without changing the completed backend architecture

- Admin dashboard and role-aware navigation, using existing summary/profile/district services.
- Responsive/login/screening presentation changes that preserve current service calls and role rules.
- Staff invitation UI using existing `invite-user`, plus activation UI using `set_profile_active`.
- PDF/XLSX reporting that consumes already-authorized frontend rows.
- IndexedDB pending submissions and PWA app-shell behavior **after** adapting retries to the current stable student-ID and manual-SI reservation flow and approving local student-data storage.
- Capacitor Android wrapper and unsigned debug APK workflow, with compatible dependencies and no database or service-role changes.
- Updated user manuals and CI tests reflecting the final implementation.

Viewer owner-grant RLS, the collaborator's auto-number reservation model, and unrestricted assignment of schools to enumerators cannot be ported as-is without changing backend behavior. The auto-number design should remain excluded; school-to-enumerator ownership is a conditional, narrowly scoped forward migration; viewer grants require a separate product/security decision.
