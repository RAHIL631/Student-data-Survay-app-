DROP POLICY districts_read_organization ON public.districts;
CREATE POLICY districts_read_organization ON public.districts
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND (
      public.current_profile_role() = 'organization_admin'
      OR id = public.current_profile_district_id()
      OR EXISTS (
        SELECT 1
        FROM public.screening_sessions s
        JOIN public.session_assignments a ON a.session_id = s.id
        WHERE s.district_id = districts.id
          AND a.enumerator_id = auth.uid()
      )
    )
  );

DROP POLICY profiles_read_organization ON public.profiles;
CREATE POLICY profiles_read_organization ON public.profiles
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND (
      public.current_profile_role() = 'organization_admin'
      OR id = auth.uid()
      OR (
        public.current_profile_role() = 'district_manager'
        AND district_id = public.current_profile_district_id()
      )
    )
  );

DROP POLICY taluks_read_organization ON public.taluks;
CREATE POLICY taluks_read_organization ON public.taluks
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND (
      public.current_profile_role() = 'organization_admin'
      OR district_id = public.current_profile_district_id()
      OR EXISTS (
        SELECT 1
        FROM public.screening_sessions s
        JOIN public.session_assignments a ON a.session_id = s.id
        WHERE s.taluk_id = taluks.id
          AND a.enumerator_id = auth.uid()
      )
    )
  );

DROP POLICY schools_read_organization ON public.schools;
CREATE POLICY schools_read_organization ON public.schools
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND (
      public.current_profile_role() = 'organization_admin'
      OR district_id = public.current_profile_district_id()
      OR EXISTS (
        SELECT 1
        FROM public.screening_sessions s
        JOIN public.session_assignments a ON a.session_id = s.id
        WHERE s.school_id = schools.id
          AND a.enumerator_id = auth.uid()
      )
    )
  );

DROP POLICY assignments_admin_manager_insert ON public.session_assignments;
CREATE POLICY assignments_admin_manager_insert ON public.session_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_profile_organization_id()
    AND (
      public.current_profile_role() = 'organization_admin'
      OR (
        public.current_profile_role() = 'district_manager'
        AND EXISTS (
          SELECT 1 FROM public.screening_sessions s
          WHERE s.id = session_id
            AND s.organization_id = organization_id
            AND s.district_id = public.current_profile_district_id()
        )
      )
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = enumerator_id
        AND p.organization_id = public.current_profile_organization_id()
        AND p.role = 'enumerator'
        AND p.district_id = (
          SELECT s.district_id FROM public.screening_sessions s
          WHERE s.id = session_id
        )
    )
    AND EXISTS (
      SELECT 1 FROM public.screening_sessions s
      WHERE s.id = session_id
        AND s.organization_id = public.current_profile_organization_id()
    )
  );

DROP POLICY assignments_admin_manager_delete ON public.session_assignments;
CREATE POLICY assignments_admin_manager_delete ON public.session_assignments
  FOR DELETE TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND (
      public.current_profile_role() = 'organization_admin'
      OR (
        public.current_profile_role() = 'district_manager'
        AND EXISTS (
          SELECT 1 FROM public.screening_sessions s
          WHERE s.id = session_id
            AND s.organization_id = organization_id
            AND s.district_id = public.current_profile_district_id()
        )
      )
    )
  );

DROP POLICY audit_logs_admin_manager_read ON public.audit_logs;
CREATE POLICY audit_logs_admin_manager_read ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND (
      public.current_profile_role() = 'organization_admin'
      OR (
        public.current_profile_role() = 'district_manager'
        AND (
          (record_type = 'districts' AND record_id = public.current_profile_district_id())
          OR EXISTS (
            SELECT 1 FROM public.taluks t
            WHERE record_type = 'taluks'
              AND t.id = record_id
              AND t.district_id = public.current_profile_district_id()
          )
          OR EXISTS (
            SELECT 1 FROM public.schools s
            WHERE record_type = 'schools'
              AND s.id = record_id
              AND s.district_id = public.current_profile_district_id()
          )
          OR EXISTS (
            SELECT 1 FROM public.screening_sessions s
            WHERE record_type = 'screening_sessions'
              AND s.id = record_id
              AND s.district_id = public.current_profile_district_id()
          )
          OR EXISTS (
            SELECT 1
            FROM public.student_screenings s
            WHERE record_type = 'student_screenings'
              AND s.id = record_id
              AND s.district_id = public.current_profile_district_id()
          )
          OR EXISTS (
            SELECT 1
            FROM public.session_assignments a
            JOIN public.screening_sessions s ON s.id = a.session_id
            WHERE record_type = 'session_assignments'
              AND a.id = record_id
              AND s.district_id = public.current_profile_district_id()
          )
        )
      )
    )
  );

REVOKE UPDATE ON public.profiles FROM authenticated;
REVOKE ALL ON FUNCTION public.current_profile_organization_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_profile_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_profile_district_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_assigned_to_session(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_profile_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_profile_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_profile_district_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_assigned_to_session(UUID) TO authenticated;

ALTER TABLE public.student_screenings
  DROP CONSTRAINT IF EXISTS student_screenings_organization_id_si_number_key,
  ADD CONSTRAINT student_screenings_org_session_si_key
    UNIQUE (organization_id, session_id, si_number),
  ADD CONSTRAINT student_screenings_dob_before_screening_check
    CHECK (date_of_birth <= screening_date);
