BEGIN;

-- Let authenticated clients create rows without supplying audit attribution.
-- The existing INSERT policies still scope rows to the caller's organization,
-- role, and (for enumerators) assigned session.
REVOKE INSERT ON TABLE public.screening_sessions FROM authenticated;
GRANT INSERT (
  organization_id, district_id, taluk_id, school_id, name, beo_name,
  head_master_name, screening_faculty_name, screening_date, status
) ON TABLE public.screening_sessions TO authenticated;

REVOKE INSERT ON TABLE public.student_screenings FROM authenticated;
GRANT INSERT (
  organization_id, session_id, district_id, taluk_id, school_id, si_number,
  student_name, class_name, section, sex, date_of_birth, age, height_cm,
  weight_kg, bmi, skeletal_deformity, skeletal_observation,
  skin_thickness_mm, mid_arm_circumference_cm, additional_remarks,
  screening_date
) ON TABLE public.student_screenings TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_created_by_attribution()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Trusted SQL maintenance may run without an Auth JWT. For API requests,
    -- the authenticated identity is always the creator.
    IF auth.uid() IS NOT NULL THEN
      NEW.created_by := auth.uid();
    END IF;
  ELSIF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'created_by is immutable';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_created_by_attribution() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER screening_sessions_guard_created_by
  BEFORE INSERT OR UPDATE ON public.screening_sessions
  FOR EACH ROW EXECUTE FUNCTION public.guard_created_by_attribution();

CREATE TRIGGER student_screenings_guard_created_by
  BEFORE INSERT OR UPDATE ON public.student_screenings
  FOR EACH ROW EXECUTE FUNCTION public.guard_created_by_attribution();

COMMIT;
