BEGIN;

REVOKE UPDATE ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT UPDATE (full_name) ON TABLE public.profiles TO authenticated;

COMMIT;
