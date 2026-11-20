BEGIN;

ALTER TABLE public.audit_logs
  ADD COLUMN district_id UUID;

CREATE INDEX audit_logs_org_district_created_idx
  ON public.audit_logs (organization_id, district_id, created_at DESC);

ALTER TABLE public.student_screenings
  DROP CONSTRAINT student_screenings_created_by_fkey,
  ADD CONSTRAINT student_screenings_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES public.profiles(id)
    ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.write_audit_log()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  row_id UUID;
  row_organization_id UUID;
  row_district_id UUID;
  old_district_id UUID;
  new_district_id UUID;
  old_session_district_id UUID;
  old_enumerator_district_id UUID;
  new_session_district_id UUID;
  new_enumerator_district_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    row_id := OLD.id;
    row_organization_id := OLD.organization_id;
  ELSE
    row_id := NEW.id;
    row_organization_id := NEW.organization_id;
  END IF;

  IF TG_TABLE_NAME = 'districts' THEN
    IF TG_OP = 'UPDATE' AND (
      OLD.id IS DISTINCT FROM NEW.id
      OR OLD.organization_id IS DISTINCT FROM NEW.organization_id
    ) THEN
      row_district_id := NULL;
    ELSE
      row_district_id := row_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'session_assignments' THEN
    IF TG_OP <> 'INSERT' THEN
      SELECT s.district_id, p.district_id
      INTO old_session_district_id, old_enumerator_district_id
      FROM public.screening_sessions s
      JOIN public.profiles p ON p.id = OLD.enumerator_id
      WHERE s.id = OLD.session_id
        AND s.organization_id = OLD.organization_id
        AND p.organization_id = OLD.organization_id;

      IF old_session_district_id IS NOT NULL
        AND old_session_district_id = old_enumerator_district_id THEN
        old_district_id := old_session_district_id;
      END IF;
    END IF;

    IF TG_OP <> 'DELETE' THEN
      SELECT s.district_id, p.district_id
      INTO new_session_district_id, new_enumerator_district_id
      FROM public.screening_sessions s
      JOIN public.profiles p ON p.id = NEW.enumerator_id
      WHERE s.id = NEW.session_id
        AND s.organization_id = NEW.organization_id
        AND p.organization_id = NEW.organization_id;

      IF new_session_district_id IS NOT NULL
        AND new_session_district_id = new_enumerator_district_id THEN
        new_district_id := new_session_district_id;
      END IF;
    END IF;

    IF TG_OP = 'UPDATE' THEN
      IF OLD.organization_id IS DISTINCT FROM NEW.organization_id
        OR old_district_id IS DISTINCT FROM new_district_id THEN
        row_district_id := NULL;
      ELSE
        row_district_id := new_district_id;
      END IF;
    ELSIF TG_OP = 'DELETE' THEN
      row_district_id := old_district_id;
    ELSE
      row_district_id := new_district_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.organization_id IS DISTINCT FROM NEW.organization_id
      OR OLD.district_id IS DISTINCT FROM NEW.district_id THEN
      row_district_id := NULL;
    ELSE
      row_district_id := NEW.district_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    row_district_id := OLD.district_id;
  ELSE
    row_district_id := NEW.district_id;
  END IF;

  INSERT INTO public.audit_logs (
    organization_id, district_id, actor_id, action, record_type, record_id, metadata
  )
  VALUES (
    row_organization_id,
    row_district_id,
    auth.uid(),
    lower(TG_OP),
    TG_TABLE_NAME,
    row_id,
    jsonb_build_object('source', 'database_trigger')
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$$;

DROP POLICY IF EXISTS audit_logs_admin_manager_read ON public.audit_logs;
CREATE POLICY audit_logs_admin_manager_read ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND (
      public.current_profile_role() = 'organization_admin'
      OR (
        public.current_profile_role() = 'district_manager'
        AND district_id IS NOT NULL
        AND district_id = public.current_profile_district_id()
      )
    )
  );

DROP POLICY IF EXISTS assignments_admin_manager_delete ON public.session_assignments;
CREATE POLICY assignments_admin_manager_delete ON public.session_assignments
  FOR DELETE TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND public.current_profile_role() = 'organization_admin'
  );

COMMIT;
