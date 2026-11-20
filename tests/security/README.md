# Backend security tests

The pgTAP database tests are in
[`supabase/tests/database/`](../../supabase/tests/database/). They use
synthetic users and records and roll back their transactions when they finish.

## Coverage

The suite checks that:

- Screening Faculty can read only explicitly granted owner records as a
  Viewer, while records without a grant remain hidden.
- Viewers cannot insert, update, or delete screening records or manage session
  assignments; their master-data reads remain limited to their district.
- Organization administrators can read records belonging to multiple owners.
- Invitation tests cover role and scope authorization, idempotency, duplicate
  email protection, exact Auth-user matching, cancellation, acceptance, and
  history preservation.
- Profile privilege tests verify that authenticated users can update only the
  permitted display-name column. Legacy-student tests verify that the unused
  table is not exposed to authenticated users.

Assertions that represent an allowed update also check the resulting value:
RLS can silently filter an unauthorized `UPDATE` without raising an error.
Policy-denied `INSERT` checks use `throws_ok` and SQLSTATE `42501`; the
Viewer delete checks also expect the denied operation to raise SQLSTATE
`42501`.

## Prerequisites and commands

Install the Supabase CLI and Docker Desktop, and make sure Docker is running.
Run from the repository root. These commands operate on the **local** Supabase
stack only; do not add `--linked` or a project reference. `supabase db reset`
recreates the local database, applies all migrations, and can erase local
database data.

```powershell
supabase start
supabase db reset
supabase test db .\supabase\tests\database
supabase stop
```

The test enables `pgTAP` in its transaction and uses authenticated role
simulation with local JWT claims. Setup and verification queries use the
database test owner; RLS assertions are explicitly run after `SET LOCAL ROLE
authenticated`.

## Limitations

- The merged migrations and updated tests have not yet been run against the
  local Supabase database. Hosted project settings and RLS behavior remain
  unverified.
- Fixtures insert rows directly into `auth.users`. The repository migrations
  do not create an `auth.users` profile trigger; a project-specific trigger or
  customized Auth schema could affect fixture setup.
- The suite verifies the policies and schema in the local migrations, not
  hosted-project configuration, dashboard-added policies, or frontend route
  guards.
- The suite asserts that client-side profile insertion is denied; initial
  account provisioning is documented as a manual Supabase operation.
