BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'student_screenings' AND column_name = 'owner_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'screening_sessions' AND column_name = 'owner_id'
  ) THEN
    RAISE EXCEPTION 'Viewer access requires the reviewed owner_id columns.';
  END IF;
END
$$;

CREATE TABLE public.owner_data_grants (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT owner_data_grants_pkey PRIMARY KEY (organization_id, viewer_id, owner_id),
  CONSTRAINT owner_data_grants_viewer_fk FOREIGN KEY (organization_id, viewer_id)
    REFERENCES public.profiles(organization_id, id) ON DELETE CASCADE,
  CONSTRAINT owner_data_grants_owner_fk FOREIGN KEY (organization_id, owner_id)
    REFERENCES public.profiles(organization_id, id) ON DELETE CASCADE,
  CONSTRAINT owner_data_grants_creator_fk FOREIGN KEY (organization_id, created_by)
    REFERENCES public.profiles(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT owner_data_grants_not_self CHECK (viewer_id <> owner_id)
);

CREATE INDEX owner_data_grants_owner_idx
  ON public.owner_data_grants (organization_id, owner_id);

ALTER TABLE public.owner_data_grants ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_view_owner_data(target_owner_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.owner_data_grants g
    JOIN public.profiles viewer
      ON viewer.id = auth.uid()
     AND viewer.organization_id = g.organization_id
     AND viewer.role = 'district_manager'
     AND viewer.is_active
    JOIN public.profiles faculty
      ON faculty.id = g.owner_id
     AND faculty.organization_id = g.organization_id
     AND faculty.role = 'enumerator'
     AND faculty.is_active
     AND faculty.district_id = viewer.district_id
    WHERE g.viewer_id = auth.uid()
      AND g.owner_id = target_owner_id
      AND g.organization_id = public.current_profile_organization_id()
  )
$$;

CREATE OR REPLACE FUNCTION public.set_owner_data_grant(
  target_viewer_id UUID,
  target_owner_id UUID,
  should_grant BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_org UUID := public.current_profile_organization_id();
  viewer_district UUID;
BEGIN
  IF auth.uid() IS NULL
    OR NOT public.current_profile_is_active()
    OR public.current_profile_role() <> 'organization_admin'
    OR should_grant IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Only an active organization administrator can change viewer access.';
  END IF;

  SELECT district_id INTO viewer_district
  FROM public.profiles
  WHERE id = target_viewer_id
    AND organization_id = actor_org
    AND role = 'district_manager'
    AND is_active
    AND district_id IS NOT NULL;
  IF viewer_district IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = target_owner_id
      AND organization_id = actor_org
      AND role = 'enumerator'
      AND is_active
      AND district_id = viewer_district
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Select an active viewer and faculty member in the same organization and district.';
  END IF;

  IF should_grant THEN
    INSERT INTO public.owner_data_grants (organization_id, viewer_id, owner_id, created_by)
    VALUES (actor_org, target_viewer_id, target_owner_id, auth.uid())
    ON CONFLICT (organization_id, viewer_id, owner_id) DO NOTHING;
  ELSE
    DELETE FROM public.owner_data_grants
    WHERE organization_id = actor_org
      AND viewer_id = target_viewer_id
      AND owner_id = target_owner_id;
  END IF;
  RETURN TRUE;
END
$$;

CREATE POLICY owner_data_grants_admin_read ON public.owner_data_grants
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND public.current_profile_role() = 'organization_admin'
    AND public.current_profile_is_active()
  );
CREATE POLICY owner_data_grants_viewer_read ON public.owner_data_grants
  FOR SELECT TO authenticated
  USING (
    viewer_id = auth.uid()
    AND public.current_profile_role() = 'district_manager'
    AND public.current_profile_is_active()
  );

REVOKE ALL ON TABLE public.owner_data_grants FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.owner_data_grants TO authenticated;
REVOKE ALL ON FUNCTION public.can_view_owner_data(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_owner_data_grant(UUID, UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_owner_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_owner_data_grant(UUID, UUID, BOOLEAN) TO authenticated;

-- Viewers are read-only: scope screening and session reads to explicit faculty grants.
DROP POLICY screenings_read_assigned_scope ON public.student_screenings;
CREATE POLICY screenings_read_assigned_scope ON public.student_screenings
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND (
      public.current_profile_role() = 'organization_admin'
      OR (
        public.current_profile_role() = 'district_manager'
        AND public.can_view_owner_data(owner_id)
      )
      OR (
        public.current_profile_role() = 'enumerator'
        AND session_id IS NOT NULL
        AND public.is_assigned_to_session(session_id)
      )
    )
  );

DROP POLICY screenings_insert_assigned_scope ON public.student_screenings;
CREATE POLICY screenings_insert_assigned_scope ON public.student_screenings
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_profile_organization_id()
    AND created_by = auth.uid()
    AND (
      public.current_profile_role() = 'organization_admin'
      OR (
        public.current_profile_role() = 'enumerator'
        AND session_id IS NOT NULL
        AND public.is_assigned_to_session(session_id)
      )
    )
  );

DROP POLICY screenings_admin_manager_update ON public.student_screenings;
CREATE POLICY screenings_admin_update ON public.student_screenings
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND public.current_profile_role() = 'organization_admin'
  )
  WITH CHECK (
    organization_id = public.current_profile_organization_id()
    AND public.current_profile_role() = 'organization_admin'
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
        AND public.can_view_owner_data(owner_id)
      )
      OR (
        public.current_profile_role() = 'enumerator'
        AND public.is_assigned_to_session(id)
      )
    )
  );

DROP POLICY sessions_admin_manager_insert ON public.screening_sessions;
CREATE POLICY sessions_admin_insert ON public.screening_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_profile_organization_id()
    AND public.current_profile_role() = 'organization_admin'
    AND created_by = auth.uid()
  );
DROP POLICY sessions_admin_manager_update ON public.screening_sessions;
CREATE POLICY sessions_admin_update ON public.screening_sessions
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND public.current_profile_role() = 'organization_admin'
  )
  WITH CHECK (
    organization_id = public.current_profile_organization_id()
    AND public.current_profile_role() = 'organization_admin'
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
        AND EXISTS (
          SELECT 1 FROM public.screening_sessions s
          WHERE s.id = session_assignments.session_id
            AND s.organization_id = session_assignments.organization_id
            AND public.can_view_owner_data(s.owner_id)
        )
      )
    )
  );
DROP POLICY assignments_admin_manager_insert ON public.session_assignments;
CREATE POLICY assignments_admin_insert ON public.session_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_profile_organization_id()
    AND public.current_profile_role() = 'organization_admin'
    AND EXISTS (
      SELECT 1 FROM public.screening_sessions s
      JOIN public.profiles faculty ON faculty.id = session_assignments.enumerator_id
      WHERE s.id = session_assignments.session_id
        AND s.organization_id = session_assignments.organization_id
        AND faculty.organization_id = session_assignments.organization_id
        AND faculty.role = 'enumerator'
        AND faculty.is_active
        AND s.district_id = faculty.district_id
    )
  );
DROP POLICY assignments_admin_manager_delete ON public.session_assignments;
CREATE POLICY assignments_admin_delete ON public.session_assignments
  FOR DELETE TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND public.current_profile_role() = 'organization_admin'
  );

-- Audit history can expose activity outside a viewer's explicit record grants.
DROP POLICY audit_logs_admin_manager_read ON public.audit_logs;
CREATE POLICY audit_logs_admin_read ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND public.current_profile_role() = 'organization_admin'
    AND public.current_profile_is_active()
  );

-- Remove district-manager write paths on schools and owner metadata RPC updates.
DROP POLICY schools_admin_write ON public.schools;
CREATE POLICY schools_admin_write ON public.schools
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_profile_organization_id()
    AND public.current_profile_role() = 'organization_admin'
  );
DROP POLICY schools_admin_update ON public.schools;
CREATE POLICY schools_admin_update ON public.schools
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND public.current_profile_role() = 'organization_admin'
  )
  WITH CHECK (
    organization_id = public.current_profile_organization_id()
    AND public.current_profile_role() = 'organization_admin'
  );
DROP POLICY schools_admin_delete ON public.schools;
CREATE POLICY schools_admin_delete ON public.schools
  FOR DELETE TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND public.current_profile_role() = 'organization_admin'
  );

CREATE OR REPLACE FUNCTION public.reject_viewer_owner_changes()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND public.current_profile_role() = 'district_manager' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Viewers cannot change record ownership.';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER schools_reject_viewer_owner_change
  BEFORE UPDATE OF owner_id ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.reject_viewer_owner_changes();
CREATE TRIGGER sessions_reject_viewer_owner_change
  BEFORE UPDATE OF owner_id ON public.screening_sessions
  FOR EACH ROW EXECUTE FUNCTION public.reject_viewer_owner_changes();
CREATE TRIGGER screenings_reject_viewer_owner_change
  BEFORE UPDATE OF owner_id ON public.student_screenings
  FOR EACH ROW EXECUTE FUNCTION public.reject_viewer_owner_changes();
REVOKE ALL ON FUNCTION public.reject_viewer_owner_changes() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reject_viewer_invitation_changes()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND public.current_profile_role() = 'district_manager' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Viewers cannot create or change invitations.';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER user_invitations_reject_viewer_changes
  BEFORE INSERT OR UPDATE ON public.user_invitations
  FOR EACH ROW EXECUTE FUNCTION public.reject_viewer_invitation_changes();
REVOKE ALL ON FUNCTION public.reject_viewer_invitation_changes() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.request_user_invitation(
  requested_email TEXT,
  requested_role TEXT,
  requested_district_id UUID,
  request_idempotency_key UUID
)
RETURNS TABLE (invitation_id UUID, created BOOLEAN, result_code TEXT)
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor public.profiles%ROWTYPE;
  prior_invitation public.user_invitations%ROWTYPE;
  normalized_email TEXT;
  new_invitation_id UUID;
BEGIN
  IF auth.uid() IS NULL OR request_idempotency_key IS NULL
    OR requested_email IS NULL OR requested_role IS NULL OR requested_district_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Invitation request is not authorized';
  END IF;
  normalized_email := lower(btrim(requested_email));
  IF normalized_email = ''
    OR normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    OR requested_role NOT IN ('district_manager', 'enumerator') THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'conflict'::TEXT;
    RETURN;
  END IF;

  SELECT p.* INTO actor FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active;
  IF NOT FOUND OR actor.role <> 'organization_admin'
    OR NOT EXISTS (
      SELECT 1 FROM public.districts d
      WHERE d.id = requested_district_id AND d.organization_id = actor.organization_id
    ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Invitation request is not authorized';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'invitation-idempotency:' || actor.id::TEXT || ':' || request_idempotency_key::TEXT, 0));
  SELECT i.* INTO prior_invitation FROM public.user_invitations i
  WHERE i.invited_by = actor.id AND i.idempotency_key = request_idempotency_key;
  IF FOUND THEN
    IF prior_invitation.email = normalized_email AND prior_invitation.role = requested_role
      AND prior_invitation.organization_id = actor.organization_id
      AND prior_invitation.district_id = requested_district_id THEN
      RETURN QUERY SELECT prior_invitation.id, FALSE, 'existing'::TEXT;
    ELSE
      RETURN QUERY SELECT NULL::UUID, FALSE, 'conflict'::TEXT;
    END IF;
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('invitation-email:' || normalized_email, 0));
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE lower(btrim(p.email)) = normalized_email)
    OR EXISTS (SELECT 1 FROM auth.users u WHERE lower(btrim(u.email)) = normalized_email) THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'conflict'::TEXT;
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.user_invitations (organization_id, district_id, invited_by, email, role, idempotency_key)
    VALUES (actor.organization_id, requested_district_id, actor.id, normalized_email, requested_role, request_idempotency_key)
    RETURNING id INTO new_invitation_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT i.* INTO prior_invitation FROM public.user_invitations i
    WHERE i.invited_by = actor.id AND i.idempotency_key = request_idempotency_key;
    IF FOUND AND prior_invitation.email = normalized_email AND prior_invitation.role = requested_role
      AND prior_invitation.organization_id = actor.organization_id
      AND prior_invitation.district_id = requested_district_id THEN
      RETURN QUERY SELECT prior_invitation.id, FALSE, 'existing'::TEXT;
    ELSE
      RETURN QUERY SELECT NULL::UUID, FALSE, 'conflict'::TEXT;
    END IF;
    RETURN;
  END;
  RETURN QUERY SELECT new_invitation_id, TRUE, 'created'::TEXT;
END
$$;
REVOKE ALL ON FUNCTION public.request_user_invitation(TEXT, TEXT, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_user_invitation(TEXT, TEXT, UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_user_invitation(target_invitation_id UUID)
RETURNS BOOLEAN
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor public.profiles%ROWTYPE;
  target public.user_invitations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RETURN FALSE; END IF;
  SELECT p.* INTO actor FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active;
  IF NOT FOUND OR actor.role <> 'organization_admin' THEN RETURN FALSE; END IF;
  SELECT i.* INTO target FROM public.user_invitations i WHERE i.id = target_invitation_id FOR UPDATE;
  IF NOT FOUND OR target.organization_id <> actor.organization_id THEN RETURN FALSE; END IF;
  IF target.status = 'cancelled' THEN RETURN TRUE; END IF;
  IF target.status NOT IN ('provisioning', 'pending') THEN RETURN FALSE; END IF;
  UPDATE public.user_invitations SET status = 'cancelled', cancelled_at = now()
  WHERE id = target.id AND status IN ('provisioning', 'pending');
  RETURN FOUND;
END
$$;
REVOKE ALL ON FUNCTION public.cancel_user_invitation(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_user_invitation(UUID) TO authenticated;

COMMIT;
