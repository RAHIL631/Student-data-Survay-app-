# Student Health Hub

Student Health Hub is a React + TypeScript web application backed by Supabase Auth and Postgres. The application does not include demo accounts or seeded student records. Organization data is loaded from the signed-in user's Supabase account and protected by database Row Level Security (RLS).

## Run locally

1. Create a Supabase project.
2. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the project's API settings. These are the project URL and public anon/publishable key; never put a service-role key in the browser or commit it.
3. Apply every SQL file in `supabase/migrations/` in ascending filename order. This includes the numbered migrations and the timestamped migrations. Use the Supabase CLI or SQL Editor; do not reset a live project or apply `seed.sql` to production.
4. Create an organization administrator in Supabase Authentication, then create the initial organization and profile from the SQL Editor:

```sql
insert into public.organizations (name)
values ('Your organization')
returning id;
```

Use the returned organization ID and the administrator's Auth user ID/email:

```sql
insert into public.profiles (id, organization_id, email, full_name, role)
select id, 'YOUR-ORGANIZATION-UUID', email, 'Organization Administrator', 'organization_admin'
from auth.users
where email = 'admin@your-organization.example';
```

5. Install dependencies and start Vite:

```powershell
npm install
npm run dev
```

Set the application's allowed redirect URLs in Supabase Authentication settings for local and deployed URLs.

## First use

- Sign in with an account created in Supabase Auth and provisioned with a `public.profiles` row.
- Add districts and taluks, then schools.
- Create a screening session and assign one or more enumerator profiles.
- Enumerators open **Screening Sessions**, choose **Start screening**, and record students for that session.
- Student screening records, reports, and audit history are stored in Supabase; RLS restricts access by organization and role.

After the initial administrator is provisioned, organization administrators can invite district managers and enumerators from the Enumerators page. District managers can invite enumerators in their own district. Invitation acceptance provisions the profile from the stored invitation scope; do not expose a Supabase service-role key in this frontend.

## Validate

```powershell
npm test
npm run build
```

The app intentionally shows an unconfigured-backend message and does not fall back to sample data when local Supabase settings are absent. Cloud operation requires the project, migrations, Auth users, and organization profiles described above.

## Temporary local test sign-in

For local UI testing only, copy `.env.example` to `.env.local` and set `VITE_ENABLE_LOCAL_TEST_LOGIN=true`, leaving both Supabase values empty. Restart Vite and choose **Continue as local enumerator** on the login screen. This opens a clearly labeled local test session with an empty screening list and a local-only test session. Any student screenings you add are stored in that browser only; they are not sent to Supabase or suitable for real student data. Remove the setting or set it to `false` and restart Vite to disable local test sign-in.
