
BEGIN;

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

      -- Both measurements are mandatory.
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

COMMIT;
