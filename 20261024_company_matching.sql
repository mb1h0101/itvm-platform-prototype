-- Company job requirements, matching decisions, and interview slots.
create table if not exists public.program_job_requirements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_name text not null,
  contact_name text not null,
  contact_email text not null,
  specialisation text not null check (specialisation in ('maintenance', 'sales', 'parts')),
  position_title text not null,
  headcount integer not null default 1 check (headcount > 0),
  job_description text not null,
  interview_availability text,
  status text not null default 'open' check (status in ('draft', 'open', 'paused', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.program_match_recommendations (
  id uuid primary key default gen_random_uuid(),
  job_requirement_id uuid not null references public.program_job_requirements(id) on delete cascade,
  questionnaire_submission_id uuid not null references public.program_questionnaire_submissions(id) on delete cascade,
  status text not null default 'suggested' check (status in ('suggested', 'shortlisted', 'interviewing', 'accepted', 'rejected')),
  score numeric(5,2),
  notes text,
  created_at timestamptz not null default now(),
  unique(job_requirement_id, questionnaire_submission_id)
);

create table if not exists public.program_interview_slots (
  id uuid primary key default gen_random_uuid(),
  match_recommendation_id uuid not null references public.program_match_recommendations(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  meeting_url text,
  status text not null default 'proposed' check (status in ('proposed', 'confirmed', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

alter table public.program_job_requirements enable row level security;
alter table public.program_match_recommendations enable row level security;
alter table public.program_interview_slots enable row level security;

create policy "companies manage their job requirements" on public.program_job_requirements
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "companies read their match recommendations" on public.program_match_recommendations
  for select to authenticated using (exists (select 1 from public.program_job_requirements j where j.id = job_requirement_id and j.user_id = auth.uid()));

create policy "companies read their interview slots" on public.program_interview_slots
  for select to authenticated using (exists (select 1 from public.program_match_recommendations m join public.program_job_requirements j on j.id = m.job_requirement_id where m.id = match_recommendation_id and j.user_id = auth.uid()));
