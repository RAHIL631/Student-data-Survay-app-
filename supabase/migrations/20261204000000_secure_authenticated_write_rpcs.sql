BEGIN;

-- Keep the intentionally restricted table ACLs. These narrow RPCs provide the
-- same authenticated workflows while deriving organization/creator/owner from
-- the trusted profile and preserving the existing RLS business boundaries.
CREATE OR REPLACE FUNCTION public.create_screening_session_secure(target_input JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := auth.uid();
  actor_org UUID;
  target_school public.schools%ROWTYPE;
  new_id UUID;
BEGIN
  IF actor_id IS NULL OR NOT public.current_profile_is_active()
    OR public.current_profile_role() <> 'organization_admin'
    OR jsonb_typeof(target_input) <> 'object'
  THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Session creation is not authorized';
  END IF;
  actor_org := public.current_profile_organization_id();
  SELECT s.* INTO target_school
  FROM public.schools s
  JOIN public.districts d ON d.id = s.district_id AND d.organization_id = s.organization_id
  JOIN public.taluks t ON t.id = s.taluk_id AND t.organization_id = s.organization_id AND t.district_id = s.district_id
  WHERE s.id = NULLIF(target_input->>'school_id', '')::UUID
    AND s.organization_id = actor_org AND s.status = 'active'
    AND d.status = 'active' AND t.status = 'active';
  IF target_school.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'The selected active school is outside your organization or district scope';
  END IF;
  IF NULLIF(btrim(target_input->>'name'), '') IS NULL
    OR NULLIF(btrim(target_input->>'beo_name'), '') IS NULL
    OR NULLIF(btrim(target_input->>'head_master_name'), '') IS NULL
    OR NULLIF(btrim(target_input->>'screening_faculty_name'), '') IS NULL
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
    btrim(target_input->>'head_master_name'), btrim(target_input->>'screening_faculty_name'),
    (target_input->>'screening_date')::DATE, 'active'
  ) RETURNING id INTO new_id;
  RETURN new_id;
END
$$;

CREATE OR REPLACE FUNCTION public.create_school_secure(target_input JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := auth.uid();
  actor_org UUID;
  district_ok BOOLEAN;
  new_id UUID;
BEGIN
  IF actor_id IS NULL OR NOT public.current_profile_is_active()
    OR public.current_profile_role() <> 'organization_admin'
    OR jsonb_typeof(target_input) <> 'object'
  THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'School creation is not authorized';
  END IF;
  actor_org := public.current_profile_organization_id();
  SELECT EXISTS (
    SELECT 1 FROM public.districts d JOIN public.taluks t
      ON t.organization_id = d.organization_id AND t.district_id = d.id
    WHERE d.id = NULLIF(target_input->>'district_id', '')::UUID
      AND t.id = NULLIF(target_input->>'taluk_id', '')::UUID
      AND d.organization_id = actor_org AND d.status = 'active' AND t.status = 'active'
  ) INTO district_ok;
  IF NOT district_ok THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'The selected active district and taluk are outside your organization scope';
  END IF;
  IF NULLIF(btrim(target_input->>'name'), '') IS NULL
    OR NULLIF(btrim(target_input->>'code'), '') IS NULL
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'School name and code are required';
  END IF;
  INSERT INTO public.schools (organization_id, district_id, taluk_id, name, code, status)
  VALUES (actor_org, (target_input->>'district_id')::UUID, (target_input->>'taluk_id')::UUID,
    btrim(target_input->>'name'), btrim(target_input->>'code'), 'active')
  RETURNING id INTO new_id;
  RETURN new_id;
END
$$;

CREATE OR REPLACE FUNCTION public.create_student_screening_secure(
  target_student_id UUID,
  target_input JSONB,
  target_si_reservation_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := auth.uid();
  actor_org UUID;
  actor_role TEXT;
  actor_district UUID;
  target_session public.screening_sessions%ROWTYPE;
  new_id UUID := COALESCE(target_student_id, gen_random_uuid());
BEGIN
  actor_role := public.current_profile_role();
  actor_org := public.current_profile_organization_id();
  actor_district := public.current_profile_district_id();
  IF actor_id IS NULL OR NOT public.current_profile_is_active()
    OR actor_role NOT IN ('organization_admin', 'enumerator')
    OR jsonb_typeof(target_input) <> 'object'
  THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Screening creation is not authorized';
  END IF;
  SELECT s.* INTO target_session FROM public.screening_sessions s
  WHERE s.id = NULLIF(target_input->>'session_id', '')::UUID
    AND s.organization_id = actor_org;
  IF target_session.id IS NULL OR (actor_role = 'enumerator' AND (
    target_session.district_id IS DISTINCT FROM actor_district
    OR target_session.status <> 'active'
    OR NOT public.is_assigned_to_session(target_session.id)
  )) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'The screening session is outside your assigned organization scope';
  END IF;
  INSERT INTO public.student_screenings (
    id, organization_id, session_id, district_id, taluk_id, school_id,
    si_number, student_name, class_name, section, sex, date_of_birth, age,
    height_cm, weight_kg, bmi, skeletal_deformity, skeletal_observation,
    skin_thickness_mm, mid_arm_circumference_cm, additional_remarks,
    screening_date, si_reservation_id
  ) VALUES (
    new_id, actor_org, target_session.id, target_session.district_id, target_session.taluk_id, target_session.school_id,
    NULLIF(btrim(target_input->>'si_number'), ''), NULLIF(btrim(target_input->>'student_name'), ''),
    NULLIF(btrim(target_input->>'class_name'), ''), NULLIF(btrim(target_input->>'section'), ''),
    NULLIF(target_input->>'sex', ''), NULLIF(target_input->>'date_of_birth', '')::DATE,
    NULLIF(target_input->>'age', '')::INTEGER, NULLIF(target_input->>'height_cm', '')::NUMERIC,
    NULLIF(target_input->>'weight_kg', '')::NUMERIC, NULLIF(target_input->>'bmi', '')::NUMERIC,
    NULLIF(target_input->>'skeletal_deformity', ''), NULLIF(target_input->>'skeletal_observation', ''),
    NULLIF(target_input->>'skin_thickness_mm', '')::NUMERIC,
    NULLIF(target_input->>'mid_arm_circumference_cm', '')::NUMERIC,
    NULLIF(target_input->>'additional_remarks', ''),
    COALESCE(NULLIF(target_input->>'screening_date', '')::DATE, CURRENT_DATE), target_si_reservation_id
  ) RETURNING id INTO new_id;
  RETURN new_id;
END
$$;

CREATE OR REPLACE FUNCTION public.update_student_screening_secure(
  target_student_id UUID,
  target_input JSONB,
  target_si_reservation_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := auth.uid();
  actor_org UUID;
  actor_role TEXT;
  actor_district UUID;
  current_row public.student_screenings%ROWTYPE;
BEGIN
  actor_role := public.current_profile_role();
  actor_org := public.current_profile_organization_id();
  actor_district := public.current_profile_district_id();
  IF actor_id IS NULL OR NOT public.current_profile_is_active()
    OR actor_role NOT IN ('organization_admin', 'enumerator')
    OR jsonb_typeof(target_input) <> 'object'
  THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Screening update is not authorized';
  END IF;
  SELECT st.* INTO current_row FROM public.student_screenings st
  WHERE st.id = target_student_id AND st.organization_id = actor_org
  FOR UPDATE;
  IF current_row.id IS NULL OR (actor_role = 'enumerator' AND (
    (current_row.created_by IS DISTINCT FROM actor_id AND current_row.owner_id IS DISTINCT FROM actor_id)
    OR current_row.district_id IS DISTINCT FROM actor_district
    OR NOT public.is_assigned_to_session(current_row.session_id)
  )) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Screening update is not authorized';
  END IF;
  UPDATE public.student_screenings st SET
    si_number = NULLIF(btrim(target_input->>'si_number'), ''),
    student_name = NULLIF(btrim(target_input->>'student_name'), ''),
    class_name = NULLIF(btrim(target_input->>'class_name'), ''),
    section = NULLIF(btrim(target_input->>'section'), ''),
    sex = NULLIF(target_input->>'sex', ''),
    date_of_birth = NULLIF(target_input->>'date_of_birth', '')::DATE,
    age = NULLIF(target_input->>'age', '')::INTEGER,
    height_cm = NULLIF(target_input->>'height_cm', '')::NUMERIC,
    weight_kg = NULLIF(target_input->>'weight_kg', '')::NUMERIC,
    bmi = NULLIF(target_input->>'bmi', '')::NUMERIC,
    skeletal_deformity = NULLIF(target_input->>'skeletal_deformity', ''),
    skeletal_observation = NULLIF(target_input->>'skeletal_observation', ''),
    skin_thickness_mm = NULLIF(target_input->>'skin_thickness_mm', '')::NUMERIC,
    mid_arm_circumference_cm = NULLIF(target_input->>'mid_arm_circumference_cm', '')::NUMERIC,
    additional_remarks = NULLIF(target_input->>'additional_remarks', ''),
    si_reservation_id = target_si_reservation_id
  WHERE st.id = target_student_id;
  RETURN TRUE;
END
$$;

REVOKE ALL ON FUNCTION public.create_screening_session_secure(JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_school_secure(JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_student_screening_secure(UUID, JSONB, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_student_screening_secure(UUID, JSONB, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_screening_session_secure(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_school_secure(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_student_screening_secure(UUID, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_student_screening_secure(UUID, JSONB, UUID) TO authenticated;

COMMIT;
