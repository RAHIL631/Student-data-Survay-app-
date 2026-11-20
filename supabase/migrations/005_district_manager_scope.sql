BEGIN;

DROP POLICY IF EXISTS profiles_read_organization ON public.profiles;
CREATE POLICY profiles_read_organization ON public.profiles
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND (
      public.current_profile_role() = 'organization_admin'
      OR (
        public.current_profile_role() = 'district_manager'
        AND district_id = public.current_profile_district_id()
      )
      OR id = auth.uid()
    )
  );

DROP POLICY IF EXISTS districts_read_organization ON public.districts;
CREATE POLICY districts_read_organization ON public.districts
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND (
      public.current_profile_role() IN ('organization_admin', 'enumerator')
      OR (
        public.current_profile_role() = 'district_manager'
        AND id = public.current_profile_district_id()
      )
    )
  );

DROP POLICY IF EXISTS taluks_read_organization ON public.taluks;
CREATE POLICY taluks_read_organization ON public.taluks
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND (
      public.current_profile_role() IN ('organization_admin', 'enumerator')
      OR (
        public.current_profile_role() = 'district_manager'
        AND district_id = public.current_profile_district_id()
      )
    )
  );

DROP POLICY IF EXISTS schools_read_organization ON public.schools;
CREATE POLICY schools_read_organization ON public.schools
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND (
      public.current_profile_role() IN ('organization_admin', 'enumerator')
      OR (
        public.current_profile_role() = 'district_manager'
        AND district_id = public.current_profile_district_id()
      )
    )
  );

DROP POLICY IF EXISTS assignments_admin_manager_insert ON public.session_assignments;
CREATE POLICY assignments_admin_manager_insert ON public.session_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_profile_organization_id()
    AND public.current_profile_role() = 'organization_admin'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = session_assignments.enumerator_id
        AND p.organization_id = public.current_profile_organization_id()
        AND p.role = 'enumerator'
        AND (
          public.current_profile_role() = 'organization_admin'
          OR p.district_id = public.current_profile_district_id()
        )
    )
    AND EXISTS (
      SELECT 1 FROM public.screening_sessions s
      WHERE s.id = session_assignments.session_id
        AND s.organization_id = public.current_profile_organization_id()
        AND (
          public.current_profile_role() = 'organization_admin'
          OR s.district_id = public.current_profile_district_id()
        )
    )
  );

DROP POLICY IF EXISTS assignments_admin_manager_delete ON public.session_assignments;
CREATE POLICY assignments_admin_manager_delete ON public.session_assignments
  FOR DELETE TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND public.current_profile_role() = 'organization_admin'
    AND EXISTS (
      SELECT 1 FROM public.screening_sessions s
      WHERE s.id = session_assignments.session_id
        AND s.organization_id = public.current_profile_organization_id()
        AND (
          public.current_profile_role() = 'organization_admin'
          OR s.district_id = public.current_profile_district_id()
        )
    )
  );

COMMIT;
