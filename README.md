# Student Health Hub

Student Health Hub is a React + TypeScript web application backed by Supabase Auth and Postgres. The application does not include demo accounts or seeded student records. Organization data is loaded from the signed-in user's Supabase account and protected by database Row Level Security (RLS).

The login-page photo shows students reading in the library at Government Primary School, Kharwada Amona, Bicholim, Goa. It is hosted locally at `public/school-students.jpg` and credited to Saili Chodankar under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) via [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Government_Primary_School,Kharwada_Amona_Bicholim_Goa.jpg).

## Run locally

1. Create a Supabase project.
2. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the project's API settings. These are the project URL and public anon/publishable key; never put a service-role key in the browser or commit it.
3. Apply `supabase/migrations/001_init.sql`, `supabase/migrations/002_live_backend.sql`, `supabase/migrations/003_role_scope_hardening.sql`, and `supabase/migrations/004_owner_scoped_records.sql` in order using the Supabase SQL Editor (or the Supabase CLI).
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

Additional staff accounts are invited from the administrator dashboard in the same application. The Supabase Edge Function validates the caller's access token and organization-admin profile before creating Auth invitations and profile rows. Do not expose a Supabase service-role key in the browser.

## Unified role-based frontend

Staff and administrators use one React frontend, one login, and one deployment. The signed-in role controls the dashboard, visible navigation, and access to the staff-management page. Server-side authorization and Supabase RLS remain the security boundary.

```powershell
npm run build
```

Deploy the contents of `dist/` as a single static site and configure the host to serve `index.html` for SPA routes. The administrator dashboard and staff screens are available in that same app; only profiles with the `organization_admin` role can access administrator-only routes.

Deploy the staff invitation function after linking the Supabase project:

```powershell
supabase functions deploy admin-provision-user
supabase secrets set ADMIN_ALLOWED_ORIGINS=https://your-domain.example
```

Set `ADMIN_ALLOWED_ORIGINS` to the exact comma-separated origins from which the unified app is served. Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions; the service-role key must remain server-side. Configure Supabase Auth email delivery and the Site URL/redirect allow-list so invitees can accept invitations in the app.

Organization administrators are intentionally not created by client-side code or by another organization administrator. Create the first organization and first admin profile using the SQL bootstrap above; the server-side invite function can provision district supervisors and enumerators.

## Validate

```powershell
npm test
npm run build
```

The app intentionally shows an unconfigured-backend message and does not fall back to sample data when local Supabase settings are absent. Cloud operation requires the project, migrations, Auth users, and organization profiles described above.

## Temporary local test sign-in

For local UI testing only, copy `.env.example` to `.env.local` and set `VITE_ENABLE_LOCAL_TEST_LOGIN=true`, leaving both Supabase values empty. Restart Vite and choose one of the clearly labeled local role buttons on the unified login screen. These development-only sessions exercise role-specific navigation using synthetic local data; records stay in that browser and are not sent to Supabase or suitable for real student data. Local test sign-in is disabled in production builds. Remove the setting or set it to `false` and restart Vite to disable local test sign-in.
