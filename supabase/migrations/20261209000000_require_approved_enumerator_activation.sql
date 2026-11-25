BEGIN;

-- Keep approval and activity status consistent. A pending Enumerator cannot be
-- made active through any profile update path until the Admin approval RPC has
-- changed approval_status to approved.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE role = 'enumerator'
      AND approval_status = 'pending'
      AND is_active
  ) THEN
    RAISE EXCEPTION 'Pending active Enumerators exist; review those profiles before applying this migration';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_enumerator_activation_requires_approval'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_enumerator_activation_requires_approval
      CHECK (role <> 'enumerator' OR approval_status <> 'pending' OR NOT is_active);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.set_profile_active(
  target_profile_id UUID,
  target_is_active BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_org UUID;
  target_profile public.profiles%ROWTYPE;
  previous_value BOOLEAN;
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_profile_is_active()
    OR public.current_profile_role() <> 'organization_admin'
    OR target_profile_id = auth.uid()
  THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Account status change is not authorized';
  END IF;

  caller_org := public.current_profile_organization_id();
  SELECT p.* INTO target_profile FROM public.profiles p
  WHERE p.id = target_profile_id AND p.organization_id = caller_org
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Account status change is not authorized';
  END IF;
  IF target_is_active AND target_profile.role = 'enumerator'
    AND target_profile.approval_status <> 'approved'
  THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Enumerator approval is required before activation';
  END IF;

  previous_value := target_profile.is_active;
  IF previous_value = target_is_active THEN RETURN TRUE; END IF;

  UPDATE public.profiles SET is_active = target_is_active WHERE id = target_profile_id;
  INSERT INTO public.audit_logs (
    organization_id, district_id, actor_id, action, record_type, record_id, metadata
  ) VALUES (
    caller_org, target_profile.district_id, auth.uid(),
    CASE WHEN target_is_active THEN 'account_activated' ELSE 'account_deactivated' END,
    'profiles', target_profile_id,
    jsonb_build_object('previous_is_active', previous_value, 'is_active', target_is_active)
  );
  RETURN TRUE;
END
$$;

REVOKE ALL ON FUNCTION public.set_profile_active(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_profile_active(UUID, BOOLEAN) TO authenticated;

COMMIT;
