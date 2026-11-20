BEGIN;

DROP POLICY IF EXISTS districts_read_organization ON public.districts;
CREATE POLICY districts_read_organization ON public.districts
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND (
      public.current_profile_role() = 'organization_admin'
      OR (
        public.current_profile_role() = 'district_manager'
        AND id = public.current_profile_district_id()
      )
      OR (
        public.current_profile_role() = 'enumerator'
        AND (
          id = public.current_profile_district_id()
          OR EXISTS (
            SELECT 1
            FROM public.screening_sessions s
            WHERE s.district_id = districts.id
              AND public.is_assigned_to_session(s.id)
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS taluks_read_organization ON public.taluks;
CREATE POLICY taluks_read_organization ON public.taluks
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND (
      public.current_profile_role() = 'organization_admin'
      OR (
        public.current_profile_role() = 'district_manager'
        AND district_id = public.current_profile_district_id()
      )
      OR (
        public.current_profile_role() = 'enumerator'
        AND (
          district_id = public.current_profile_district_id()
          OR EXISTS (
            SELECT 1
            FROM public.screening_sessions s
            WHERE s.taluk_id = taluks.id
              AND public.is_assigned_to_session(s.id)
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS schools_read_organization ON public.schools;
CREATE POLICY schools_read_organization ON public.schools
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND (
      public.current_profile_role() = 'organization_admin'
      OR (
        public.current_profile_role() = 'district_manager'
        AND district_id = public.current_profile_district_id()
      )
      OR (
        public.current_profile_role() = 'enumerator'
        AND (
          district_id = public.current_profile_district_id()
          OR EXISTS (
            SELECT 1
            FROM public.screening_sessions s
            WHERE s.school_id = schools.id
              AND public.is_assigned_to_session(s.id)
          )
        )
      )
    )
  );

COMMIT;
