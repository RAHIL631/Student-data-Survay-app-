BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(5);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'students'
      AND c.relkind IN ('r', 'p')
      AND NOT c.relrowsecurity
  ),
  'any legacy public.students table has row-level security enabled'
);

SELECT is(
  (SELECT count(*)::INTEGER
   FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename = 'students'),
  0,
  'legacy students has no permissive policies because it has no organization scope'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'students'
      AND column_name IN ('organization_id', 'created_by', 'user_id')
  ),
  'legacy students has no tenant or owner column for a safe scoped policy'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.students', 'SELECT'),
  'anonymous API clients have no SELECT privilege on legacy students'
);

SELECT ok(
  NOT has_table_privilege('authenticated', 'public.students', 'SELECT'),
  'authenticated API clients have no SELECT privilege on legacy students'
);

SELECT * FROM finish();
ROLLBACK;
