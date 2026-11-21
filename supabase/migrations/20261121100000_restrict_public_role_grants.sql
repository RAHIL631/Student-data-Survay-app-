
BEGIN;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

REVOKE UPDATE (full_name) ON TABLE public.profiles FROM authenticated;
REVOKE SELECT (
  id, organization_id, district_id, email, role, status, auth_status,
  created_at, last_auth_response_at, accepted_at, cancelled_at
) ON TABLE public.user_invitations FROM authenticated;

GRANT SELECT ON public.organizations TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.districts, public.taluks, public.schools TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.screening_sessions, public.student_screenings TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.session_assignments TO authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT SELECT (
  id, organization_id, district_id, email, role, status, auth_status,
  created_at, last_auth_response_at, accepted_at, cancelled_at
) ON public.user_invitations TO authenticated;
GRANT UPDATE (full_name) ON public.profiles TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;

COMMIT;
