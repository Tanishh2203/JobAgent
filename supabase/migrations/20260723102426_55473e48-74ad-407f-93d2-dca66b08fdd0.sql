
-- profiles: user preferences & filters
CREATE TABLE public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  my_experience_years NUMERIC NOT NULL DEFAULT 1,
  search_term TEXT NOT NULL DEFAULT 'AI ML Engineer',
  location TEXT NOT NULL DEFAULT 'Bangalore, India',
  min_score NUMERIC NOT NULL DEFAULT 0.35,
  top_k INTEGER NOT NULL DEFAULT 10,
  work_modes TEXT[] NOT NULL DEFAULT ARRAY['Remote','Hybrid','On-site','Not specified'],
  hours_old INTEGER NOT NULL DEFAULT 24,
  digest_email TEXT,
  full_name TEXT,
  linkedin TEXT,
  github TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- resumes: parsed text + extracted skills
CREATE TABLE public.resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  text TEXT NOT NULL,
  skills TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resumes TO authenticated;
GRANT ALL ON public.resumes TO service_role;
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own resumes" ON public.resumes FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX resumes_user_active_idx ON public.resumes(user_id, is_active);

-- jobs: ingested from scraper webhook
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'unknown',
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  work_mode TEXT NOT NULL DEFAULT 'Not specified',
  experience_min NUMERIC,
  experience_max NUMERIC,
  description TEXT NOT NULL DEFAULT '',
  url TEXT,
  posted_at TIMESTAMPTZ,
  score NUMERIC NOT NULL DEFAULT 0,
  matched_skills TEXT[] NOT NULL DEFAULT '{}',
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own jobs" ON public.jobs FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX jobs_user_score_idx ON public.jobs(user_id, score DESC, ingested_at DESC);

-- drafts: generated cold emails
CREATE TABLE public.drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'google/gemini-3.6-flash',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, job_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drafts TO authenticated;
GRANT ALL ON public.drafts TO service_role;
ALTER TABLE public.drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own drafts" ON public.drafts FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, digest_email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
