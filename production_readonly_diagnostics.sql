-- Read-only production diagnostics for migrations 20261205000000 through
-- 20261209000000. Run in Supabase Dashboard > SQL Editor for the confirmed
-- project qghesdscscclbfevbypb. This script contains SELECT statements only.
-- It does not read email addresses, names, auth IDs, or record-level data.
--
-- Run the checks in order. If the object inventory says a required relation is
-- missing, skip later data queries that name that relation and report it as a
-- prerequisite failure. Expected migration versions are compared in section 2.

-- 0. Query execution context: confirms which database role runs the diagnostics.
-- Aggregate data results can be RLS-filtered if this role is neither the table
-- owner nor BYPASSRLS/superuser; do not change roles to run this script.
SELECT current_database() AS database_name,
       current_user AS current_role,
       session_user AS session_role,
       r.rolsuper AS is_superuser,
       r.rolbypassrls AS bypasses_rls,
       current_setting('row_security') AS row_security_setting
FROM pg_catalog.pg_roles AS r
WHERE r.rolname = current_user;

-- 1. Object inventory: verifies relations and columns referenced by migrations
-- 20261205-20261209, including auth.users and the migration history table.
WITH required_relations(schema_name, relation_name, introduced_or_used_by) AS (
  VALUES
    ('public', 'profiles', '20261205-20261209'),
    ('public', 'districts', '20261205, 20261207, 20261208'),
    ('public', 'user_invitations', '20261205, 20261206'),
    ('public', 'organizations', '20261207'),
    ('public', 'schools', '20261208'),
    ('public', 'taluks', '20261208'),
    ('public', 'screening_sessions', '20261208'),
    ('public', 'session_assignments', '20261208'),
    ('public', 'audit_logs', '20261206, 20261208, 20261209'),
    ('auth', 'users', '20261205, 20261206'),
    ('supabase_migrations', 'schema_migrations', 'migration history diagnostic')
)
SELECT r.schema_name,
       r.relation_name,
       r.introduced_or_used_by,
       (c.oid IS NOT NULL) AS relation_exists,
       CASE WHEN c.oid IS NULL THEN NULL ELSE c.relkind::text END AS relation_kind
FROM required_relations AS r
LEFT JOIN pg_catalog.pg_namespace AS n ON n.nspname = r.schema_name
LEFT JOIN pg_catalog.pg_class AS c
  ON c.relnamespace = n.oid AND c.relname = r.relation_name
ORDER BY r.schema_name, r.relation_name;

-- 1a. Column inventory: checks exact columns read or written by migrations
-- 20261205-20261209. approval_status is introduced by 20261206; its absence
-- before that migration is expected, but it must exist before 20261209.
WITH required_columns(schema_name, relation_name, column_name, migration_use) AS (
  VALUES
    ('public','profiles','id','20261205, 20261206, 20261209'),
    ('public','profiles','organization_id','20261205, 20261206, 20261209'),
    ('public','profiles','email','20261205, 20261206'),
    ('public','profiles','full_name','20261206'),
    ('public','profiles','role','20261205, 20261206, 20261209'),
    ('public','profiles','district_id','20261206, 20261208, 20261209'),
    ('public','profiles','is_active','20261205, 20261206, 20261208, 20261209'),
    ('public','profiles','approval_status','added by 20261206, required by 20261209'),
    ('public','districts','id','20261205, 20261207, 20261208'),
    ('public','districts','organization_id','20261205, 20261207, 20261208'),
    ('public','districts','name','20261207'),
    ('public','districts','code','20261207'),
    ('public','districts','status','20261208'),
    ('public','organizations','id','20261207'),
    ('public','user_invitations','id','20261205, 20261206'),
    ('public','user_invitations','invited_by','20261205'),
    ('public','user_invitations','idempotency_key','20261205'),
    ('public','user_invitations','organization_id','20261205, 20261206'),
    ('public','user_invitations','district_id','20261205, 20261206'),
    ('public','user_invitations','email','20261205, 20261206'),
    ('public','user_invitations','role','20261205, 20261206'),
    ('public','user_invitations','status','20261205, 20261206'),
    ('public','user_invitations','auth_status','20261205, 20261206'),
    ('public','user_invitations','auth_user_id','20261206'),
    ('public','user_invitations','accepted_at','20261206'),
    ('auth','users','id','20261205, 20261206'),
    ('auth','users','email','20261205, 20261206'),
    ('auth','users','email_confirmed_at','20261206'),
    ('public','schools','id','20261208'),
    ('public','schools','organization_id','20261208'),
    ('public','schools','district_id','20261208'),
    ('public','schools','taluk_id','20261208'),
    ('public','schools','owner_id','20261208'),
    ('public','schools','name','20261208'),
    ('public','schools','code','20261208'),
    ('public','schools','status','20261208'),
    ('public','taluks','id','20261208'),
    ('public','taluks','organization_id','20261208'),
    ('public','taluks','district_id','20261208'),
    ('public','taluks','status','20261208'),
    ('public','screening_sessions','id','20261208'),
    ('public','screening_sessions','organization_id','20261208'),
    ('public','screening_sessions','district_id','20261208'),
    ('public','screening_sessions','taluk_id','20261208'),
    ('public','screening_sessions','school_id','20261208'),
    ('public','screening_sessions','name','20261208'),
    ('public','screening_sessions','beo_name','20261208'),
    ('public','screening_sessions','head_master_name','20261208'),
    ('public','screening_sessions','screening_faculty_name','20261208'),
    ('public','screening_sessions','screening_date','20261208'),
    ('public','screening_sessions','status','20261208'),
    ('public','session_assignments','organization_id','20261208'),
    ('public','session_assignments','session_id','20261208'),
    ('public','session_assignments','enumerator_id','20261208'),
    ('public','audit_logs','organization_id','20261206, 20261208, 20261209'),
    ('public','audit_logs','district_id','20261206, 20261208, 20261209'),
    ('public','audit_logs','actor_id','20261206, 20261208, 20261209'),
    ('public','audit_logs','action','20261206, 20261208, 20261209'),
    ('public','audit_logs','record_type','20261206, 20261208, 20261209'),
    ('public','audit_logs','record_id','20261206, 20261208, 20261209'),
    ('public','audit_logs','metadata','20261206, 20261208, 20261209')
)
SELECT r.schema_name,
       r.relation_name,
       r.column_name,
       r.migration_use,
       (c.column_name IS NOT NULL) AS column_exists
FROM required_columns AS r
LEFT JOIN information_schema.columns AS c
  ON c.table_schema = r.schema_name
 AND c.table_name = r.relation_name
 AND c.column_name = r.column_name
ORDER BY r.schema_name, r.relation_name, r.column_name;

-- 2. Migration history: lists the five expected versions and whether each is
-- applied. First confirm supabase_migrations.schema_migrations exists in
-- section 1. The name field is read through row JSON because some CLI history
-- tables store version/statements but no migration name; name will then be NULL.
WITH expected(version) AS (
  VALUES
    ('20261205000000'),
    ('20261206000000'),
    ('20261207000000'),
    ('20261208000000'),
    ('20261209000000')
), history AS (
  SELECT to_jsonb(m) AS row_data
  FROM supabase_migrations.schema_migrations AS m
)
SELECT e.version,
       h.row_data ->> 'name' AS recorded_name,
       (h.row_data IS NOT NULL) AS applied
FROM expected AS e
LEFT JOIN history AS h ON h.row_data ->> 'version' = e.version
ORDER BY e.version;

-- 2a. Full migration history: reports all stored versions and names without
-- exposing migration statements or application data. Run only if section 1
-- confirms the history relation exists. A NULL name means it is not stored there.
SELECT to_jsonb(m) ->> 'version' AS version,
       to_jsonb(m) ->> 'name' AS recorded_name
FROM supabase_migrations.schema_migrations AS m
ORDER BY to_jsonb(m) ->> 'version';

-- 3. 20261209 preflight: returns only an aggregate count of active Enumerators
-- whose approval is pending. Requires public.profiles to exist. JSON field access
-- avoids a missing-column error; preflight_count is NULL until all three columns
-- exist, so a missing prerequisite is not misreported as zero.
WITH required AS (
  SELECT
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='role')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='approval_status')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='is_active') AS ready
), counts AS (
  SELECT count(*) FILTER (
    WHERE to_jsonb(p) ->> 'role' = 'enumerator'
      AND to_jsonb(p) ->> 'approval_status' = 'pending'
      AND to_jsonb(p) ->> 'is_active' = 'true'
  ) AS preflight_count
  FROM public.profiles AS p
)
SELECT required.ready AS prerequisites_present,
       CASE WHEN required.ready THEN counts.preflight_count END AS pending_active_enumerator_count
FROM required CROSS JOIN counts;

-- 3a. Approval-state distribution: aggregate counts only. Requires the profiles
-- relation; counts are NULL if role, approval_status, or is_active is absent.
WITH required AS (
  SELECT
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='role')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='approval_status')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='is_active') AS ready
)
SELECT CASE WHEN required.ready THEN to_jsonb(p) ->> 'role' END AS role,
       CASE WHEN required.ready THEN to_jsonb(p) ->> 'approval_status' END AS approval_status,
       CASE WHEN required.ready THEN to_jsonb(p) ->> 'is_active' END AS is_active,
       CASE WHEN required.ready THEN count(*) END AS profile_count,
       required.ready AS prerequisites_present
FROM public.profiles AS p
CROSS JOIN required
GROUP BY required.ready,
         CASE WHEN required.ready THEN to_jsonb(p) ->> 'role' END,
         CASE WHEN required.ready THEN to_jsonb(p) ->> 'approval_status' END,
         CASE WHEN required.ready THEN to_jsonb(p) ->> 'is_active' END
ORDER BY role, approval_status, is_active;

-- 4. 20261207 district normalization diagnostics: aggregate-only counts for
-- duplicate (organization_id, code) groups, legacy aliases, duplicate alias
-- candidates per canonical code, and rows blocked by an existing canonical
-- name/code. This mirrors the aliases and collision guards in the migration.
-- Requires public.districts to exist; all fields use row JSON and the result
-- reports NULL metrics unless id, organization_id, name, and code exist.
WITH required AS (
  SELECT
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='districts' AND column_name='id')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='districts' AND column_name='organization_id')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='districts' AND column_name='name')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='districts' AND column_name='code') AS ready
), aliases(legacy_name, canonical_name, canonical_code) AS (
  VALUES
    ('Bagalkot', 'Bagalkote', 'KA-BGK'),
    ('Bellary', 'Ballari', 'KA-BAL'),
    ('Belgaum', 'Belagavi', 'KA-BEL'),
    ('Bangalore Rural', 'Bengaluru Rural', 'KA-BRU'),
    ('Ramanagara', 'Bengaluru South', 'KA-BSO'),
    ('Bangalore Urban', 'Bengaluru Urban', 'KA-BUR'),
    ('Chickballapur', 'Chikkaballapura', 'KA-CHI'),
    ('Chikmagalur', 'Chikkamagaluru', 'KA-CHM'),
    ('Davangere', 'Davanagere', 'KA-DAV'),
    ('Gulbarga', 'Kalaburagi', 'KA-KAL'),
    ('Mysore', 'Mysuru', 'KA-MYS'),
    ('Shimoga', 'Shivamogga', 'KA-SHI'),
    ('Tumkur', 'Tumakuru', 'KA-TUM'),
    ('Bijapur', 'Vijayapura', 'KA-VIJ'),
    ('Vijapura', 'Vijayapura', 'KA-VIJ')
), district_rows AS (
  SELECT to_jsonb(d) AS j FROM public.districts AS d
), candidates AS (
  SELECT d.j,
         a.canonical_name,
         a.canonical_code,
         d.j ->> 'organization_id' AS org_id,
         d.j ->> 'id' AS district_id
  FROM district_rows AS d
  JOIN aliases AS a
    ON lower(btrim(d.j ->> 'name')) = lower(a.legacy_name)
), duplicate_codes AS (
  SELECT j ->> 'organization_id' AS org_id, j ->> 'code' AS code
  FROM district_rows
  WHERE j ->> 'organization_id' IS NOT NULL
    AND j ->> 'code' IS NOT NULL
  GROUP BY j ->> 'organization_id', j ->> 'code'
  HAVING count(*) > 1
), multiple_alias_candidates AS (
  SELECT org_id, canonical_code
  FROM candidates
  GROUP BY org_id, canonical_code
  HAVING count(*) > 1
), blocked_by_name AS (
  SELECT DISTINCT c.org_id, c.district_id
  FROM candidates AS c
  JOIN district_rows AS d
    ON d.j ->> 'organization_id' = c.org_id
   AND d.j ->> 'id' IS DISTINCT FROM c.district_id
   AND lower(btrim(d.j ->> 'name')) = lower(c.canonical_name)
), blocked_by_code AS (
  SELECT DISTINCT c.org_id, c.district_id
  FROM candidates AS c
  JOIN district_rows AS d
    ON d.j ->> 'organization_id' = c.org_id
   AND d.j ->> 'id' IS DISTINCT FROM c.district_id
   AND d.j ->> 'code' = c.canonical_code
)
SELECT required.ready AS prerequisites_present,
       CASE WHEN required.ready THEN (SELECT count(*) FROM duplicate_codes) END AS duplicate_organization_code_group_count,
       CASE WHEN required.ready THEN (SELECT count(*) FROM candidates) END AS legacy_alias_row_count,
       CASE WHEN required.ready THEN (SELECT count(*) FROM multiple_alias_candidates) END AS multiple_alias_candidate_group_count,
       CASE WHEN required.ready THEN (SELECT count(*) FROM blocked_by_name) END AS rows_blocked_by_existing_canonical_name,
       CASE WHEN required.ready THEN (SELECT count(*) FROM blocked_by_code) END AS rows_blocked_by_existing_canonical_code
FROM required;

-- 5. Required function inventory: reports exact identity arguments, return
-- type, language, SECURITY DEFINER flag, volatility, and function-local settings
-- for migration functions and the helper functions they call. No function is run.
WITH expected(signature, migration_or_prerequisite) AS (
  VALUES
    ('public.request_user_invitation(text,text,uuid,uuid)', '20261205'),
    ('public.existing_auth_user_for_invitation(uuid)', '20261205'),
    ('public.accept_user_invitation(uuid,text)', '20261206'),
    ('public.approve_enumerator_profile(uuid)', '20261206'),
    ('public.seed_karnataka_districts(uuid)', '20261207'),
    ('public.seed_karnataka_districts_after_organization_insert()', '20261207 trigger function'),
    ('public.assign_school_owner(uuid,uuid)', '20261208'),
    ('public.create_school_secure(jsonb)', '20261208'),
    ('public.create_screening_session_secure(jsonb)', '20261208'),
    ('public.set_profile_active(uuid,boolean)', '20261209'),
    ('public.current_profile_is_active()', 'supporting prerequisite'),
    ('public.current_profile_role()', 'supporting prerequisite'),
    ('public.current_profile_organization_id()', 'supporting prerequisite'),
    ('public.current_profile_district_id()', 'supporting prerequisite'),
    ('auth.uid()', 'Supabase Auth prerequisite')
)
SELECT e.signature AS expected_signature,
       e.migration_or_prerequisite,
       p.oid IS NOT NULL AS function_exists,
       CASE WHEN p.oid IS NOT NULL THEN n.nspname END AS schema_name,
       CASE WHEN p.oid IS NOT NULL THEN p.proname END AS function_name,
       CASE WHEN p.oid IS NOT NULL THEN pg_catalog.pg_get_function_identity_arguments(p.oid) END AS identity_arguments,
       CASE WHEN p.oid IS NOT NULL THEN pg_catalog.pg_get_function_result(p.oid) END AS return_type,
       CASE WHEN p.oid IS NOT NULL THEN p.prosecdef END AS security_definer,
       CASE WHEN p.oid IS NOT NULL THEN l.lanname END AS language,
       CASE WHEN p.oid IS NOT NULL THEN p.provolatile END AS volatility,
       CASE WHEN p.oid IS NOT NULL THEN p.proconfig END AS function_settings
FROM expected AS e
LEFT JOIN pg_catalog.pg_proc AS p ON p.oid = to_regprocedure(e.signature)
LEFT JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
LEFT JOIN pg_catalog.pg_language AS l ON l.oid = p.prolang
ORDER BY e.signature;

-- 5a. Effective EXECUTE privilege: checks the four requested roles for the
-- migration RPCs. NULL means the function or role does not exist. This inspects
-- privileges only; it does not call any of the functions.
WITH expected(signature) AS (
  VALUES
    ('public.request_user_invitation(text,text,uuid,uuid)'),
    ('public.existing_auth_user_for_invitation(uuid)'),
    ('public.accept_user_invitation(uuid,text)'),
    ('public.approve_enumerator_profile(uuid)'),
    ('public.seed_karnataka_districts(uuid)'),
    ('public.seed_karnataka_districts_after_organization_insert()'),
    ('public.assign_school_owner(uuid,uuid)'),
    ('public.create_school_secure(jsonb)'),
    ('public.create_screening_session_secure(jsonb)'),
    ('public.set_profile_active(uuid,boolean)'),
    ('public.current_profile_is_active()'),
    ('public.current_profile_role()'),
    ('public.current_profile_organization_id()'),
    ('public.current_profile_district_id()'),
    ('auth.uid()')
), requested_roles(role_name) AS (
  VALUES ('anon'), ('authenticated'), ('service_role'), ('postgres')
)
SELECT e.signature AS expected_signature,
       rr.role_name,
       r.oid IS NOT NULL AS role_exists,
       p.oid IS NOT NULL AS function_exists,
       CASE WHEN r.oid IS NOT NULL AND p.oid IS NOT NULL
            THEN has_function_privilege(r.oid, p.oid, 'EXECUTE') END AS effective_execute
FROM expected AS e
CROSS JOIN requested_roles AS rr
LEFT JOIN pg_catalog.pg_roles AS r ON r.rolname = rr.role_name
LEFT JOIN pg_catalog.pg_proc AS p ON p.oid = to_regprocedure(e.signature)
ORDER BY e.signature, rr.role_name;

-- 5b. Direct function ACL entries: includes PUBLIC and owner ACL entries as
-- stored, so the service_role-only lookup contract from 20261205 is reviewable.
-- No privilege is granted or revoked by this query.
WITH expected(signature) AS (
  VALUES
    ('public.request_user_invitation(text,text,uuid,uuid)'),
    ('public.existing_auth_user_for_invitation(uuid)'),
    ('public.accept_user_invitation(uuid,text)'),
    ('public.approve_enumerator_profile(uuid)'),
    ('public.seed_karnataka_districts(uuid)'),
    ('public.seed_karnataka_districts_after_organization_insert()'),
    ('public.assign_school_owner(uuid,uuid)'),
    ('public.create_school_secure(jsonb)'),
    ('public.create_screening_session_secure(jsonb)'),
    ('public.set_profile_active(uuid,boolean)'),
    ('public.current_profile_is_active()'),
    ('public.current_profile_role()'),
    ('public.current_profile_organization_id()'),
    ('public.current_profile_district_id()'),
    ('auth.uid()')
)
SELECT e.signature AS expected_signature,
       CASE WHEN acl.grantee = 0 THEN 'PUBLIC' ELSE grantee.rolname END AS grantee,
       grantor.rolname AS grantor,
       acl.privilege_type,
       acl.is_grantable
FROM expected AS e
JOIN pg_catalog.pg_proc AS p ON p.oid = to_regprocedure(e.signature)
CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl
LEFT JOIN pg_catalog.pg_roles AS grantee ON grantee.oid = acl.grantee
LEFT JOIN pg_catalog.pg_roles AS grantor ON grantor.oid = acl.grantor
WHERE acl.privilege_type = 'EXECUTE'
ORDER BY e.signature, grantee, grantor;

-- 6. Constraints and indexes: checks uniqueness, foreign-key, approval-state,
-- and other existing constraints on tables involved in migrations 20261205-09.
-- Constraint definitions contain schema expressions, not row data.
SELECT n.nspname AS schema_name,
       t.relname AS table_name,
       c.conname AS constraint_name,
       c.contype AS constraint_type,
       pg_catalog.pg_get_constraintdef(c.oid, true) AS definition,
       c.convalidated AS validated
FROM pg_catalog.pg_constraint AS c
JOIN pg_catalog.pg_class AS t ON t.oid = c.conrelid
JOIN pg_catalog.pg_namespace AS n ON n.oid = t.relnamespace
WHERE (n.nspname = 'public' AND t.relname IN (
         'profiles','districts','user_invitations','organizations','schools',
         'taluks','screening_sessions','session_assignments','audit_logs'
       ))
   OR (n.nspname = 'auth' AND t.relname = 'users')
ORDER BY n.nspname, t.relname, c.conname;

-- 6a. District indexes: specifically confirms the organization/code uniqueness
-- prerequisite used by 20261207 ON CONFLICT (organization_id, code).
SELECT schemaname,
       tablename,
       indexname,
       indexdef
FROM pg_catalog.pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('districts', 'user_invitations')
ORDER BY tablename, indexname;

-- 7. Trigger inventory: reports enabled user-defined triggers on the affected
-- organization, profile, invitation, school, and session tables, including the
-- expected organizations_seed_karnataka_districts trigger from 20261207.
SELECT n.nspname AS schema_name,
       t.relname AS table_name,
       tr.tgname AS trigger_name,
       tr.tgenabled AS enabled_state,
       pg_catalog.pg_get_triggerdef(tr.oid, true) AS trigger_definition,
       pn.nspname AS function_schema,
       p.proname AS function_name,
       pg_catalog.pg_get_function_identity_arguments(p.oid) AS function_arguments
FROM pg_catalog.pg_trigger AS tr
JOIN pg_catalog.pg_class AS t ON t.oid = tr.tgrelid
JOIN pg_catalog.pg_namespace AS n ON n.oid = t.relnamespace
JOIN pg_catalog.pg_proc AS p ON p.oid = tr.tgfoid
JOIN pg_catalog.pg_namespace AS pn ON pn.oid = p.pronamespace
WHERE NOT tr.tgisinternal
  AND n.nspname = 'public'
  AND t.relname IN (
    'organizations','profiles','user_invitations','districts','schools',
    'screening_sessions','session_assignments'
  )
ORDER BY t.relname, tr.tgname;

-- 8. RLS state: verifies whether row security is enabled/forced on the relevant
-- public tables. This reports table metadata only.
SELECT n.nspname AS schema_name,
       c.relname AS table_name,
       c.relrowsecurity AS row_security_enabled,
       c.relforcerowsecurity AS row_security_forced
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
WHERE ((n.nspname = 'public' AND c.relname IN (
    'profiles','districts','user_invitations','organizations','schools',
    'taluks','screening_sessions','session_assignments','audit_logs'
  ))
   OR (n.nspname = 'auth' AND c.relname = 'users'))
  AND c.relkind IN ('r','p')
ORDER BY c.relname;

-- 8a. RLS policies on the same tables: records policy names, roles, commands,
-- USING, and WITH CHECK expressions for comparison with migration contracts.
SELECT schemaname,
       tablename,
       policyname,
       permissive,
       roles,
       cmd,
       qual AS using_expression,
       with_check AS with_check_expression
FROM pg_catalog.pg_policies
WHERE (schemaname = 'public' AND tablename IN (
    'profiles','districts','user_invitations','organizations','schools',
    'taluks','screening_sessions','session_assignments','audit_logs'
  ))
   OR (schemaname = 'auth' AND tablename = 'users')
ORDER BY tablename, policyname;

-- 8b. Explicit migration prerequisite checks: verifies the named approval
-- constraints and any non-partial unique index whose key columns are exactly
-- (organization_id, code), regardless of that index's actual name.
SELECT 'profiles' AS table_name,
       'profiles_approval_status_check' AS prerequisite,
       EXISTS (
         SELECT 1 FROM pg_catalog.pg_constraint AS c
         JOIN pg_catalog.pg_class AS t ON t.oid = c.conrelid
         JOIN pg_catalog.pg_namespace AS n ON n.oid = t.relnamespace
         WHERE n.nspname = 'public' AND t.relname = 'profiles'
           AND c.conname = 'profiles_approval_status_check'
       ) AS present
UNION ALL
SELECT 'profiles',
       'profiles_enumerator_activation_requires_approval',
       EXISTS (
         SELECT 1 FROM pg_catalog.pg_constraint AS c
         JOIN pg_catalog.pg_class AS t ON t.oid = c.conrelid
         JOIN pg_catalog.pg_namespace AS n ON n.oid = t.relnamespace
         WHERE n.nspname = 'public' AND t.relname = 'profiles'
           AND c.conname = 'profiles_enumerator_activation_requires_approval'
       )
UNION ALL
SELECT 'districts',
       'non-partial unique key (organization_id, code) for 20261207 ON CONFLICT',
       EXISTS (
         SELECT 1
         FROM pg_catalog.pg_index AS ix
         JOIN pg_catalog.pg_class AS tbl ON tbl.oid = ix.indrelid
         JOIN pg_catalog.pg_namespace AS n ON n.oid = tbl.relnamespace
         WHERE n.nspname = 'public' AND tbl.relname = 'districts'
           AND ix.indisunique AND ix.indisvalid AND ix.indisready
           AND ix.indpred IS NULL AND ix.indnkeyatts = 2
           AND (
             SELECT array_agg(att.attname ORDER BY key_col.ordinality)
             FROM unnest(ix.indkey) WITH ORDINALITY AS key_col(attnum, ordinality)
             JOIN pg_catalog.pg_attribute AS att
               ON att.attrelid = tbl.oid AND att.attnum = key_col.attnum
             WHERE key_col.ordinality <= ix.indnkeyatts
           ) = ARRAY['organization_id','code']::name[]
       );

-- 9. Invitation state inventory: aggregate counts by role/status/auth_status;
-- no invitation IDs, emails, or names are returned. Requires the user_invitations
-- relation; missing fields appear as NULL grouping keys because row JSON is used.
SELECT to_jsonb(i) ->> 'role' AS role,
       to_jsonb(i) ->> 'status' AS invitation_status,
       to_jsonb(i) ->> 'auth_status' AS auth_status,
       count(*) AS invitation_count
FROM public.user_invitations AS i
GROUP BY to_jsonb(i) ->> 'role',
         to_jsonb(i) ->> 'status',
         to_jsonb(i) ->> 'auth_status'
ORDER BY role, invitation_status, auth_status;

-- 9a. School ownership and screening-session/assignment inventory: aggregate
-- counts only, with no school or user names/IDs. Requires the named relations.
-- first_count/second_count mean owned/unowned for schools and active/non-active
-- sessions; they are NULL if the relevant column prerequisite is absent.
SELECT 'schools' AS object_type,
       count(*) AS total_count,
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='schools' AND column_name='owner_id')
            THEN count(*) FILTER (WHERE to_jsonb(x) ->> 'owner_id' IS NOT NULL) END AS first_count,
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='schools' AND column_name='owner_id')
            THEN count(*) FILTER (WHERE to_jsonb(x) ->> 'owner_id' IS NULL) END AS second_count
FROM public.schools AS x
UNION ALL
SELECT 'screening_sessions',
       count(*),
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='screening_sessions' AND column_name='status')
            THEN count(*) FILTER (WHERE to_jsonb(x) ->> 'status' = 'active') END,
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='screening_sessions' AND column_name='status')
            THEN count(*) FILTER (WHERE to_jsonb(x) ->> 'status' IS DISTINCT FROM 'active') END
FROM public.screening_sessions AS x
UNION ALL
SELECT 'session_assignments', count(*), NULL::bigint, NULL::bigint
FROM public.session_assignments AS x;
