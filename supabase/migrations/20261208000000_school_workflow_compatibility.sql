BEGIN;

-- School ownership is assigned only by an active organization administrator
-- to an active Enumerator in the same organization and district.
CREATE OR REPLACE FUNCTION public.assign_school_owner(
  target_school_id UUID,
  target_enumerator_id UUID
)
RETURNS BOOLEAN
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := auth.uid();
  actor_org UUID;
  target_school public.schools%ROWTYPE;
  target_enumerator public.profiles%ROWTYPE;
BEGIN
  IF actor_id IS NULL OR NOT public.current_profile_is_active()
    OR public.current_profile_role() <> 'organization_admin'
  THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'School assignment is not authorized';
  END IF;

  actor_org := public.current_profile_organization_id();
  SELECT s.* INTO target_school FROM public.schools s
  WHERE s.id = target_school_id AND s.organization_id = actor_org
  FOR UPDATE;
  SELECT p.* INTO target_enumerator FROM public.profiles p
  WHERE p.id = target_enumerator_id AND p.organization_id = actor_org AND p.is_active
  FOR SHARE;

  IF NOT FOUND OR target_school.id IS NULL
    OR target_enumerator.role <> 'enumerator'
    OR target_enumerator.district_id IS DISTINCT FROM target_school.district_id
  THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'School assignment is not authorized';
  END IF;
  IF target_school.owner_id = target_enumerator.id THEN RETURN TRUE; END IF;

  UPDATE public.schools SET owner_id = target_enumerator.id WHERE id = target_school.id;
  INSERT INTO public.audit_logs (
    organization_id, district_id, actor_id, action, record_type, record_id, metadata
  ) VALUES (
    actor_org, target_school.district_id, actor_id, 'ownership_transferred', 'schools',
    target_school.id,
    jsonb_build_object('previous_owner_id', target_school.owner_id, 'owner_id', target_enumerator.id)
  );
  RETURN TRUE;
END
$$;

CREATE OR REPLACE FUNCTION public.create_school_secure(target_input JSONB)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := auth.uid();
  actor_org UUID;
  actor_role TEXT;
  actor_district UUID;
  location_ok BOOLEAN;
  new_id UUID;
BEGIN
  actor_role := public.current_profile_role();
  IF actor_id IS NULL OR NOT public.current_profile_is_active()
    OR actor_role NOT IN ('organization_admin', 'enumerator')
    OR jsonb_typeof(target_input) <> 'object'
  THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'School creation is not authorized';
  END IF;

  actor_org := public.current_profile_organization_id();
  actor_district := public.current_profile_district_id();
  SELECT EXISTS (
    SELECT 1 FROM public.districts d
    JOIN public.taluks t ON t.organization_id = d.organization_id AND t.district_id = d.id
    WHERE d.id = NULLIF(target_input->>'district_id', '')::UUID
      AND t.id = NULLIF(target_input->>'taluk_id', '')::UUID
      AND d.organization_id = actor_org AND d.status = 'active' AND t.status = 'active'
      AND (actor_role = 'organization_admin' OR d.id = actor_district)
  ) INTO location_ok;
  IF NOT location_ok THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'The selected active district and taluk are outside your authorized scope';
  END IF;
  IF NULLIF(btrim(target_input->>'name'), '') IS NULL
    OR NULLIF(btrim(target_input->>'code'), '') IS NULL
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'School name and code are required';
  END IF;

  INSERT INTO public.schools (organization_id, district_id, taluk_id, name, code, status)
  VALUES (
    actor_org, (target_input->>'district_id')::UUID, (target_input->>'taluk_id')::UUID,
    btrim(target_input->>'name'), btrim(target_input->>'code'), 'active'
  ) RETURNING id INTO new_id;
  RETURN new_id;
END
$$;

CREATE OR REPLACE FUNCTION public.create_screening_session_secure(target_input JSONB)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := auth.uid();
  actor_org UUID;
  actor_role TEXT;
  actor_district UUID;
  target_school public.schools%ROWTYPE;
  faculty public.profiles%ROWTYPE;
  new_id UUID;
BEGIN
  actor_role := public.current_profile_role();
  IF actor_id IS NULL OR NOT public.current_profile_is_active()
    OR actor_role NOT IN ('organization_admin', 'enumerator')
    OR jsonb_typeof(target_input) <> 'object'
  THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Session creation is not authorized';
  END IF;

  actor_org := public.current_profile_organization_id();
  actor_district := public.current_profile_district_id();
  SELECT s.* INTO target_school
  FROM public.schools s
  JOIN public.districts d ON d.id = s.district_id AND d.organization_id = s.organization_id
  JOIN public.taluks t ON t.id = s.taluk_id AND t.organization_id = s.organization_id AND t.district_id = s.district_id
  WHERE s.id = NULLIF(target_input->>'school_id', '')::UUID
    AND s.organization_id = actor_org AND s.status = 'active'
    AND d.status = 'active' AND t.status = 'active'
    AND (actor_role = 'organization_admin' OR (s.owner_id = actor_id AND s.district_id = actor_district));
  IF target_school.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'The selected active school is outside your organization or account scope';
  END IF;

  SELECT p.* INTO faculty FROM public.profiles p
  WHERE p.id = target_school.owner_id AND p.organization_id = actor_org
    AND p.district_id = target_school.district_id AND p.role = 'enumerator' AND p.is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Assign an active Screening Faculty account to this school before creating a session';
  END IF;
  IF NULLIF(btrim(target_input->>'name'), '') IS NULL
    OR NULLIF(btrim(target_input->>'beo_name'), '') IS NULL
    OR NULLIF(btrim(target_input->>'head_master_name'), '') IS NULL
    OR NULLIF(target_input->>'screening_date', '') IS NULL
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Required session details are missing';
  END IF;

  INSERT INTO public.screening_sessions (
    organization_id, district_id, taluk_id, school_id, name, beo_name,
    head_master_name, screening_faculty_name, screening_date, status
  ) VALUES (
    actor_org, target_school.district_id, target_school.taluk_id, target_school.id,
    btrim(target_input->>'name'), btrim(target_input->>'beo_name'),
    btrim(target_input->>'head_master_name'), faculty.full_name,
    (target_input->>'screening_date')::DATE, 'active'
  ) RETURNING id INTO new_id;

  INSERT INTO public.session_assignments (organization_id, session_id, enumerator_id)
  VALUES (actor_org, new_id, faculty.id);
  RETURN new_id;
END
$$;

REVOKE ALL ON FUNCTION public.assign_school_owner(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_school_owner(UUID, UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.create_school_secure(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_school_secure(JSONB) TO authenticated;
REVOKE ALL ON FUNCTION public.create_screening_session_secure(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_screening_session_secure(JSONB) TO authenticated;

COMMIT;
