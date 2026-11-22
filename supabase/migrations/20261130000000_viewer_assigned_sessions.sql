BEGIN;

-- Sessions are generally created by organization administrators. Let a viewer
-- see a session only when it is assigned to a same-district faculty member
-- whose records that viewer was explicitly granted.
CREATE OR REPLACE FUNCTION public.can_view_assigned_session_for_viewer(target_session_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles viewer
    JOIN public.screening_sessions s
      ON s.id = target_session_id
     AND s.organization_id = viewer.organization_id
     AND s.district_id = viewer.district_id
    JOIN public.session_assignments assignment
      ON assignment.session_id = s.id
     AND assignment.organization_id = s.organization_id
    JOIN public.profiles faculty
      ON faculty.id = assignment.enumerator_id
     AND faculty.organization_id = viewer.organization_id
     AND faculty.role = 'enumerator'
     AND faculty.is_active
     AND faculty.district_id = viewer.district_id
    JOIN public.owner_data_grants grant_row
      ON grant_row.organization_id = viewer.organization_id
     AND grant_row.viewer_id = viewer.id
     AND grant_row.owner_id = faculty.id
    WHERE viewer.id = auth.uid()
      AND viewer.role = 'district_manager'
      AND viewer.is_active
      AND viewer.district_id IS NOT NULL
  )
$$;
REVOKE ALL ON FUNCTION public.can_view_assigned_session_for_viewer(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_assigned_session_for_viewer(UUID) TO authenticated;

DROP POLICY screenings_read_assigned_scope ON public.student_screenings;
CREATE POLICY screenings_read_assigned_scope ON public.student_screenings
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND (
      public.current_profile_role() = 'organization_admin'
      OR (
        public.current_profile_role() = 'district_manager'
        AND (
          public.can_view_owner_data(owner_id)
          OR (session_id IS NOT NULL AND public.can_view_assigned_session_for_viewer(session_id))
        )
      )
      OR (
        public.current_profile_role() = 'enumerator'
        AND session_id IS NOT NULL
        AND public.is_assigned_to_session(session_id)
      )
    )
  );

DROP POLICY sessions_read_assigned_scope ON public.screening_sessions;
CREATE POLICY sessions_read_assigned_scope ON public.screening_sessions
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND (
      public.current_profile_role() = 'organization_admin'
      OR (
        public.current_profile_role() = 'district_manager'
        AND (
          public.can_view_owner_data(owner_id)
          OR public.can_view_assigned_session_for_viewer(id)
        )
      )
      OR (
        public.current_profile_role() = 'enumerator'
        AND public.is_assigned_to_session(id)
      )
    )
  );

DROP POLICY assignments_read_assigned_scope ON public.session_assignments;
CREATE POLICY assignments_read_assigned_scope ON public.session_assignments
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND (
      public.current_profile_role() = 'organization_admin'
      OR enumerator_id = auth.uid()
      OR (
        public.current_profile_role() = 'district_manager'
        AND public.can_view_assigned_session_for_viewer(session_id)
      )
    )
  );

COMMIT;
