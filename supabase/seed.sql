CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  full_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
