# Final branch integration audit

**Audit date:** 2026-11-22
**Repository:** `RAHIL631/Student-data-Survay-app-`
**Target:** `friend/integration`
**Scope:** Read-only branch/history/tree audit. The latest refs were fetched from `friend` only. No branch was checked out, merged, rebased, cherry-picked, committed, pushed, or deleted. The existing backend working changes were left untouched; this report is an additional untracked file.

## Remote branches found

The live branch listing from `git ls-remote --heads friend` returned four branches:

| Remote branch | Latest commit | Date | Latest subject | Commits unique to branch vs `friend/integration` | Status |
| --- | --- | --- | --- | ---: | --- |
| `friend/integration` | `787b6a89843928d217a4df936a5a6622f7e5c366` | 2026-11-21 | Fix frontend deployment routing and toolchain | 0 | Target branch; fully integrated with itself. |
| `friend/feature/backend-infrastructure` | `f51ccb7168a24a709b4beac6210c0a3c9e2bb531` | 2026-11-21 | security: restrict public role database grants | 0 | Fully integrated: its tip is an ancestor of `friend/integration`. Integration is one commit ahead of this branch. |
| `friend/chore/project-structure` | `26153fae03c073222b37b85e6ddd7fe6f66e038b` | 2026-11-20 | fix: serve app routes on Vercel instead of a 404 | 12 ancestry-only commits (10 non-merge commits; two merge commits) | Diverged: integration-only 3 commits, branch-only 12. Ten branch non-merge commits have no patch-equivalent commit in integration. Not fully integrated. |
| `friend/subashree/android-offline-sync` | `76888e76bad17c1e59f2ef997f5a799720aad197` | 2026-11-10 | fix: update GitHub Actions workflows | 6 | Diverged: integration-only 5 commits, branch-only 6. None of its six commits is an ancestor of integration. Not fully integrated. |

`friend/subashree/android-offline-sync` is the first parent of the Android merge commit `31e90a568c2c602e791a52fa6442bd779d6a9afa` on `chore/project-structure`. Thus its changes are carried by the chore branch, but not by integration. The chore branch also has merge commit `883f00138e2f65dc71edc45292f886f78647bad0`; its backend-infrastructure parent `943a7972218d32e76242753c213dfcce9286a6de` is already in integration's history, while the chore-side UI history is not.

The integration-only commits on the divergent sides are:

- Versus `chore/project-structure`: `430097ff01b6fd9eebbc62ca50d5e9226d5224bf` (student screening/completion), `f51ccb7168a24a709b4beac6210c0a3c9e2bb531` (public-role grants), and `787b6a89843928d217a4df936a5a6622f7e5c366` (deployment routing/toolchain).
- Versus `subashree/android-offline-sync`: the same three commits plus `943a7972218d32e76242753c213dfcce9286a6de` (password recovery/backend workflows) and `742509604d2efe5eb6762920092a87a1479e6046` (backend infrastructure/security).
- Versus `feature/backend-infrastructure`: `787b6a89843928d217a4df936a5a6622f7e5c366`; integration contains that later commit and the feature tip is already its ancestor.

### Branch-only non-merge commits on `chore/project-structure`

These ten commits are not patch-equivalent to commits in integration:

- `26153fa` — Vercel SPA route rewrite. The `vercel.json` blob is nevertheless byte-for-byte identical on `friend/integration`, so this behavior is present independently.
- `8d49b37` — unify staff and admin frontends.
- `7b2ce3b` — screening workflow and mobile layout changes.
- `878b8d0` — admin portal and login changes.
- `76888e7` — GitHub Actions workflow changes.
- `9e72f0e` — expanded enumerator user manual.
- `0b7cfc1` — restore Android APK workflow.
- `13be579` — Android workflow registration test changes.
- `683fcb1` — workflow registration refresh (no file diff in that commit).
- `fd68985` — offline sync and Android APK implementation.

The commit subject “backend invitation and recovery flows” is on the chore-side merge commit, not an additional non-merge patch in that list. Integration already contains the core invitation and password recovery flows from the backend-infrastructure ancestry, but the final chore tree has additional edits to the related UI and auth files; those versions have not been reconciled into integration.

## Feature coverage

| Feature area | Finding on `friend/integration` |
| --- | --- |
| Backend infrastructure/security | The `feature/backend-infrastructure` tip is in integration history. Its core invitation, password recovery, and public-role grant hardening are integrated. The local, uncommitted backend work is newer and remains separate from all remote refs. |
| Admin portal/login | Partial. Integration has a role-aware application and an Admin Portal link/settings page, but lacks `src/pages/AdminDashboardPage.tsx`, `src/pages/AdminUsersPage.tsx`, and `supabase/functions/admin-provision-user/index.ts`, which exist on `chore/project-structure`. Its `LoginPage`, `Layout`, permissions, and related auth files differ from the chore versions. |
| Staff/admin frontend integration | Not fully integrated. Chore contains additional unified navigation, role-specific admin/staff pages, and layout/auth changes. The final integration tree does not contain the branch's admin dashboard/users pages. |
| Screening workflow/mobile layout | Partial. Integration has screening pages, but chore changes `src/pages/ScreeningSessionsPage.tsx`, `StudentRegistrationPage.tsx`, `AssignmentsPage.tsx`, `StudentsPage.tsx`, `Layout.tsx`, and styling/workflow code. Those branch revisions are not in integration. |
| Invitation/account recovery | Core features are present in integration (`invite-user`, invitation acceptance, and password recovery). Chore has unreconciled changes to `InvitationManagement.tsx`, `AcceptInvitationPage.tsx`, `LoginPage.tsx`, `AuthProvider.tsx`, and `dataService.ts`; do not treat the two implementations as identical. |
| Vercel routing | Present. `vercel.json` exists on both branches with identical blob ID `1323cdac34c6ae8f7e1f8a2f3adc299eae7bdcea`. The chore commit itself is not in integration ancestry, but its routing file content is. |
| Android offline sync | Missing from integration. The design document `docs/OFFLINE_SYNC.md` exists, but `src/lib/pendingSubmissions.js`, `src/lib/pendingSubmissionSync.js`, their type declarations, and `tests/offline/pending-submissions.test.js` are absent. |
| Android APK workflow | Missing from integration. There is no `android/` project or `.github/workflows/android-apk.yml` on the target branch. |
| CI/test workflows | Partial. Integration has CI and test workflows, but chore changes `.github/workflows/ci.yml` and `.github/workflows/tests.yml`; the APK workflow is absent. |
| Documentation/manuals | Partial. Integration has `docs/user-manuals/user-manual.md` and `docs/OFFLINE_SYNC.md`, but the chore branch adds 104 lines to the enumerator manual and changes the offline-sync document. The fuller manual content is not integrated. |

## Missing files and overlapping work

Notable branch files absent from integration include:

- `.github/workflows/android-apk.yml`
- `android/` project and `capacitor.config.ts`
- `src/lib/pendingSubmissions.js`, `src/lib/pendingSubmissionSync.js`, and declarations
- `tests/offline/pending-submissions.test.js`
- `src/pages/AdminDashboardPage.tsx`, `src/pages/AdminUsersPage.tsx`
- `supabase/functions/admin-provision-user/index.ts`

The following ten tracked files already have local backend edits and also differ between the remote integration and chore trees: `README.md`, `package.json`, `src/context/AuthProvider.tsx`, `src/lib/dataService.ts`, `src/lib/database.types.ts`, `src/pages/ScreeningSessionsPage.tsx`, `src/pages/SettingsPage.tsx`, `src/pages/StudentRegistrationPage.tsx`, `supabase/tests/database/district_manager_scope.test.sql`, and `supabase/tests/database/public_role_privileges.test.sql`. No branch version was copied over these files. The local backend additions have no same-path file collision in the chore tree, but the migration design does conflict as detailed below.

The remote collaborator branches remain present. The audit found no deleted remote branches. Their work is **not lost from GitHub**, but several requested features are not in the current integration tree and would be missed by a production release from integration today.

## Migration comparison and conflicts

`integration` and `chore/project-structure` share identical migration contents only for versions `001` and `002`. They reuse the same Supabase migration version prefixes `003`–`009` for different files and different SQL:

| Version prefix | `friend/integration` | `friend/chore/project-structure` | Same SQL? |
| --- | --- | --- | --- |
| `003` | `003_district_manager_scope.sql` | `003_role_scope_hardening.sql` | No |
| `004` | `004_audit_and_delete_scope.sql` | `004_owner_scoped_records.sql` | No |
| `005` | `005_user_invitations.sql` | `005_district_manager_scope.sql` | No |
| `006` | `006_restrict_profile_updates.sql` | `006_audit_and_delete_scope.sql` | No |
| `007` | `007_scope_enumerator_locations.sql` | `007_user_invitations.sql` | No |
| `008` | `008_secure_legacy_students.sql` | `008_restrict_profile_updates.sql` | No |
| `009` | `009_student_completion_status.sql` | `009_scope_enumerator_locations.sql` | No |

The chore branch omits integration's `009_student_completion_status.sql` and timestamped migrations `20261120175954_enforce_skeletal_observation_requirement.sql` and `20261121100000_restrict_public_role_grants.sql`; it instead has `010_secure_legacy_students.sql`. The Android branch has only migrations `001` and `002`. These are alternative migration lineages, not safely mergeable/replayable sets. Never apply the chore migration directory wholesale to the existing hosted project.

The seven current local untracked backend migrations use unique timestamp versions `20261122000000` through `20261128000000`, with no same-version remote file. There is still a material schema conflict with chore's `004_owner_scoped_records.sql`: that migration adds `owner_data_grants`, makes owner/creator fields non-null, backfills owner scope differently, and assigns `created_by` from `owner_id`. The local implementation intentionally keeps historical school ownership NULL, backfills session/student owners from their existing creators, and preserves `created_by`. These models must not be combined by merging or replaying migrations.

## Safe next actions requiring approval

1. **Do not deploy from integration until this audit is resolved.** Production release from the current remote integration branch would omit the Android/offline-sync work and the additional chore-side admin/workflow/manual changes.
2. Review the collaborator feature requests and decide which items are in scope for this release: admin portal, mobile workflow refinements, offline sync, Android APK, and documentation updates.
3. Preserve the existing local backend changes. After approval, perform any code reconciliation in a separate review branch/worktree or PR; do not overwrite the dirty integration worktree. The ten overlapping tracked paths require manual conflict review.
4. Reconcile migrations first. Keep the hosted 11-migration history and the local forward-only sequence as the baseline; do not import/replay chore versions `003`–`010`. If selected collaborator backend behavior is needed, design new timestamped forward migrations after reviewing the existing hosted schema and current local migrations.
5. Review Android offline storage and sync, idempotency, authorization, and conflict behavior before enabling it for student data. Review the APK workflow and CI changes independently.
6. Run frontend, backend, security, and Android workflow checks on the reconciled review branch. Review the resulting full diff and obtain explicit approval before merging or deploying.

## Conclusion

**Are all required collaborator changes present in `friend/integration`? No.** The backend-infrastructure branch is fully integrated, and the Vercel rewrite content is present. The chore branch's admin portal refinements, mobile/screening changes, manual updates, CI changes, offline-sync implementation, and Android APK workflow are not fully integrated. The Android offline-sync branch is also not integrated. The migration lineages conflict by version prefix and ownership model, so they require deliberate reconciliation before production deployment.
