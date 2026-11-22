
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT no_plan();

SELECT is(
  (SELECT count(*)::int
   FROM information_schema.role_table_grants
   WHERE table_schema = 'public'
     AND grantee = 'anon'),
  0,
  'anon has no table-level grants in public'
);

SELECT is(
  (SELECT count(*)::int
   FROM information_schema.role_table_grants
   WHERE table_schema = 'public'
     AND grantee = 'authenticated'
     AND privilege_type IN ('TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN')),
  0,
  'authenticated has no structural or maintenance privileges in public'
);

SELECT is(
  (SELECT count(*)::int
   FROM pg_default_acl d
   JOIN pg_namespace n ON n.oid = d.defaclnamespace
   JOIN pg_roles owner_role ON owner_role.oid = d.defaclrole
   CROSS JOIN LATERAL aclexplode(d.defaclacl) acl
   JOIN pg_roles grantee ON grantee.oid = acl.grantee
   WHERE n.nspname = 'public'
     AND owner_role.rolname = 'postgres'
     AND d.defaclobjtype::text IN ('r', 'S')
     AND grantee.rolname IN ('anon', 'authenticated')),
  0,
  'postgres-owned future public tables and sequences grant no default privileges to client roles'
);

SELECT ok(
  has_table_privilege('authenticated', 'public.organizations', 'SELECT')
  AND has_column_privilege('authenticated', 'public.screening_sessions', 'name', 'INSERT')
  AND has_column_privilege('authenticated', 'public.student_screenings', 'student_name', 'INSERT')
  AND NOT has_column_privilege('authenticated', 'public.screening_sessions', 'created_by', 'INSERT')
  AND NOT has_column_privilege('authenticated', 'public.student_screenings', 'created_by', 'INSERT')
  AND has_table_privilege('authenticated', 'public.session_assignments', 'DELETE'),
  'authenticated retains approved operations and cannot supply creator attribution'
);

SELECT ok(
  has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE')
  AND NOT has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE'),
  'profile updates remain limited to full_name'
);

SELECT ok(
  has_column_privilege('authenticated', 'public.user_invitations', 'id', 'SELECT')
  AND NOT has_column_privilege('authenticated', 'public.user_invitations', 'failure_code', 'SELECT'),
  'invitation reads remain limited to the approved columns'
);

SELECT * FROM finish();
ROLLBACK;
