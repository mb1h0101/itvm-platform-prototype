-- New-type international program: online questionnaire and matching data.
-- Run this file in the existing Supabase project's SQL Editor.

create table if not exists public.program_questionnaire_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  questionnaire_type text not null check (questionnaire_type in ('integrated', 'maintenance', 'sales', 'parts')),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'reviewing', 'matched', 'interviewing', 'closed')),
  applicant_name_en text,
  applicant_name_zh text,
  email text,
  phone text,
  nationality text,
  residence_country text,
  education_level text,
  school_and_major text,
  graduation_year integer,
  chinese_level text,
  english_level text,
  career_preference text,
  second_preference text,
  work_experience_years numeric(4,1),
  skill_profile jsonb not null default '{}'::jsonb,
  supporting_links jsonb not null default '{}'::jsonb,
  motivation text,
  interview_availability text,
  consent_shared boolean not null default false,
  declaration_confirmed boolean not null default false,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists program_questionnaire_submissions_status_idx on public.program_questionnaire_submissions(status, created_at desc);
create index if not exists program_questionnaire_submissions_type_idx on public.program_questionnaire_submissions(questionnaire_type, created_at desc);

alter table public.program_questionnaire_submissions enable row level security;

drop policy if exists "questionnaire owners manage their records" on public.program_questionnaire_submissions;
create policy "questionnaire owners manage their records"
  on public.program_questionnaire_submissions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "questionnaire admins review records" on public.program_questionnaire_submissions;
create policy "questionnaire admins review records"
  on public.program_questionnaire_submissions
  for select to authenticated
  using (
    exists (
      select 1 from public.teachers
      where teachers.email = auth.jwt() ->> 'email'
        and teachers.role = 'admin'
        and teachers.is_active = true
    )
  );
