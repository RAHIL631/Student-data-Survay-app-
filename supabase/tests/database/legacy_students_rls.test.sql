BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(1);

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

SELECT * FROM finish();
ROLLBACK;
