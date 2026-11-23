BEGIN;

-- Active organization administrators need to see inactive member rows in order
-- to reactivate them. Viewers still see only active profiles in their district.
DROP POLICY IF EXISTS profiles_read_organization ON public.profiles;
CREATE POLICY profiles_read_organization ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR (
      organization_id = public.current_profile_organization_id()
      AND public.current_profile_is_active()
      AND (
        public.current_profile_role() = 'organization_admin'
        OR (
          is_active
          AND public.current_profile_role() = 'district_manager'
          AND district_id = public.current_profile_district_id()
          AND public.can_view_owner_data(id)
        )
      )
    )
  );

COMMIT;
