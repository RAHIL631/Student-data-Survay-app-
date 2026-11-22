BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.session_assignments a
    JOIN public.screening_sessions s ON s.id = a.session_id
    JOIN public.profiles p ON p.id = a.enumerator_id
    WHERE a.organization_id <> s.organization_id
      OR a.organization_id <> p.organization_id
      OR s.district_id IS DISTINCT FROM p.district_id
      OR p.role <> 'enumerator'
  ) THEN
    RAISE EXCEPTION 'Existing session assignments cross organization or district scope; resolve them explicitly before applying this migration';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.enforce_session_assignment_scope()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_session public.screening_sessions%ROWTYPE;
  target_enumerator public.profiles%ROWTYPE;
BEGIN
  SELECT s.* INTO target_session FROM public.screening_sessions s
  WHERE s.id = NEW.session_id;
  SELECT p.* INTO target_enumerator FROM public.profiles p
  WHERE p.id = NEW.enumerator_id;

  IF target_session.id IS NULL
    OR target_enumerator.id IS NULL
    OR NEW.organization_id <> target_session.organization_id
    OR NEW.organization_id <> target_enumerator.organization_id
    OR target_session.district_id IS DISTINCT FROM target_enumerator.district_id
    OR target_enumerator.role <> 'enumerator'
    OR NOT target_enumerator.is_active
    OR (auth.uid() IS NOT NULL AND NOT public.current_profile_is_active())
  THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Enumerator and screening session must be active and in the same organization and district';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER session_assignments_enforce_scope
  BEFORE INSERT OR UPDATE ON public.session_assignments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_session_assignment_scope();

DROP POLICY IF EXISTS assignments_admin_manager_insert ON public.session_assignments;
CREATE POLICY assignments_admin_manager_insert ON public.session_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_profile_organization_id()
    AND public.current_profile_role() IN ('organization_admin', 'district_manager')
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = enumerator_id
        AND p.organization_id = public.current_profile_organization_id()
        AND p.role = 'enumerator'
        AND p.is_active
        AND p.district_id = (
          SELECT s.district_id FROM public.screening_sessions s
          WHERE s.id = session_assignments.session_id
            AND s.organization_id = session_assignments.organization_id
        )
        AND (
          public.current_profile_role() = 'organization_admin'
          OR p.district_id = public.current_profile_district_id()
        )
    )
    AND EXISTS (
      SELECT 1 FROM public.screening_sessions s
      WHERE s.id = session_id
        AND s.organization_id = public.current_profile_organization_id()
        AND (
          public.current_profile_role() = 'organization_admin'
          OR s.district_id = public.current_profile_district_id()
        )
    )
  );

REVOKE ALL ON FUNCTION public.enforce_session_assignment_scope() FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
