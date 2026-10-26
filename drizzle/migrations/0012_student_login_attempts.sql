CREATE TABLE public.student_login_attempts (
  code text PRIMARY KEY,
  failures integer NOT NULL DEFAULT 0,
  lock_level integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.student_login_attempts TO service_role;
ALTER TABLE public.student_login_attempts ENABLE ROW LEVEL SECURITY;