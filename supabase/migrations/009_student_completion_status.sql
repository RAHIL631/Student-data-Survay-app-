
BEGIN;

-- Allow incomplete student records to be saved as Pending.
ALTER TABLE public.student_screenings
  DROP CONSTRAINT student_screenings_status_check,
  ALTER COLUMN si_number DROP NOT NULL,
  ALTER COLUMN student_name DROP NOT NULL,
  ALTER COLUMN class_name DROP NOT NULL,
  ALTER COLUMN section DROP NOT NULL,
  ALTER COLUMN sex DROP NOT NULL,
  ALTER COLUMN date_of_birth DROP NOT NULL,
  ALTER COLUMN age DROP NOT NULL,
  ALTER COLUMN height_cm DROP NOT NULL,
  ALTER COLUMN weight_kg DROP NOT NULL,
  ALTER COLUMN bmi DROP NOT NULL;

-- Automatically calculate student screening completion status.
CREATE OR REPLACE FUNCTION public.set_student_screening_completion_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.status := CASE
    WHEN NULLIF(btrim(NEW.si_number), '') IS NOT NULL
      AND NULLIF(btrim(NEW.student_name), '') IS NOT NULL
      AND NULLIF(btrim(NEW.class_name), '') IS NOT NULL
      AND NULLIF(btrim(NEW.section), '') IS NOT NULL
      AND NEW.sex IN ('Male', 'Female', 'Other', 'Prefer not to specify')
      AND NEW.date_of_birth IS NOT NULL
      AND NEW.date_of_birth <= NEW.screening_date
      AND NEW.age BETWEEN 0 AND 120
      AND NEW.age = EXTRACT(
        YEAR FROM age(NEW.screening_date, NEW.date_of_birth)
      )::INTEGER
      AND NEW.height_cm > 0
      AND NEW.height_cm < 'Infinity'::NUMERIC
      AND NEW.weight_kg > 0
      AND NEW.weight_kg < 'Infinity'::NUMERIC
      AND NEW.bmi > 0
      AND NEW.bmi < 'Infinity'::NUMERIC

      -- Skeletal deformity response is mandatory.
      AND NEW.skeletal_deformity IN ('No', 'Yes', 'Suspected')

      -- Observation is mandatory for Yes and Suspected.
      AND (
        NEW.skeletal_deformity = 'No'
        OR (
          NEW.skeletal_deformity IN ('Yes', 'Suspected')
          AND NULLIF(btrim(NEW.skeletal_observation), '') IS NOT NULL
        )
      )

      -- Skin thickness and MAC are mandatory and non-negative.
      AND NEW.skin_thickness_mm >= 0
      AND NEW.skin_thickness_mm < 'Infinity'::NUMERIC
      AND NEW.mid_arm_circumference_cm >= 0
      AND NEW.mid_arm_circumference_cm < 'Infinity'::NUMERIC

    THEN 'Complete'
    ELSE 'Pending'
  END;

  RETURN NEW;
END;
$$;

-- Recalculate status on every insert and update.
CREATE TRIGGER student_screenings_calculate_completion_status
  BEFORE INSERT OR UPDATE ON public.student_screenings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_student_screening_completion_status();

-- Recalculate existing records using the new rules.
UPDATE public.student_screenings
SET status = 'Pending';

-- Only Pending and Complete are valid screening statuses.
ALTER TABLE public.student_screenings
  ADD CONSTRAINT student_screenings_status_check
  CHECK (status IN ('Pending', 'Complete'));

-- Allow enumerators to update their own records in assigned sessions.
CREATE POLICY screenings_enumerator_update_own_assigned
  ON public.student_screenings
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND public.current_profile_role() = 'enumerator'
    AND created_by = auth.uid()
    AND session_id IS NOT NULL
    AND public.is_assigned_to_session(session_id)
  )
  WITH CHECK (
    organization_id = public.current_profile_organization_id()
    AND public.current_profile_role() = 'enumerator'
    AND created_by = auth.uid()
    AND session_id IS NOT NULL
    AND public.is_assigned_to_session(session_id)
  );

COMMIT;
