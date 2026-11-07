-- Repair an incomplete earlier matching migration before adding student access.
-- These statements are deliberately idempotent so they are safe on production
-- projects where the other matching tables already exist.
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

alter table public.program_interview_slots enable row level security;

drop policy if exists "companies read their interview slots" on public.program_interview_slots;
create policy "companies read their interview slots" on public.program_interview_slots
  for select to authenticated using (
    exists (
      select 1
      from public.program_match_recommendations m
      join public.program_job_requirements j on j.id = m.job_requirement_id
      where m.id = match_recommendation_id and j.user_id = auth.uid()
    )
  );

create or replace function public.is_program_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.teachers
    where teachers.email = auth.jwt() ->> 'email'
      and teachers.role = 'admin'
      and teachers.is_active = true
  );
$$;

grant execute on function public.is_program_admin() to authenticated;

drop policy if exists "program admins manage interview slots" on public.program_interview_slots;
create policy "program admins manage interview slots" on public.program_interview_slots
  for all to authenticated using (public.is_program_admin()) with check (public.is_program_admin());

-- Private applicant evidence. This bucket must never be public: identity and
-- academic documents are reachable only by their owner or an approved admin.
insert into storage.buckets (id, name, public)
values ('program-application-documents', 'program-application-documents', false)
on conflict (id) do update set public = false;

drop policy if exists "program applicant uploads own documents" on storage.objects;
create policy "program applicant uploads own documents"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'program-application-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "program applicant reads own documents" on storage.objects;
create policy "program applicant reads own documents"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'program-application-documents'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_program_admin())
  );

drop policy if exists "program applicant updates own documents" on storage.objects;
create policy "program applicant updates own documents"
  on storage.objects for update to authenticated
  using (bucket_id = 'program-application-documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'program-application-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "program applicant deletes own documents" on storage.objects;
create policy "program applicant deletes own documents"
  on storage.objects for delete to authenticated
  using (bucket_id = 'program-application-documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- Students can read only matching and interview rows that originate from their
-- own application; companies and schools retain the policies defined earlier.
drop policy if exists "students read their own match recommendations" on public.program_match_recommendations;
create policy "students read their own match recommendations"
  on public.program_match_recommendations for select to authenticated
  using (
    exists (
      select 1 from public.program_questionnaire_submissions q
      where q.id = questionnaire_submission_id and q.user_id = auth.uid()
    )
  );

drop policy if exists "students read their own interview slots" on public.program_interview_slots;
create policy "students read their own interview slots"
  on public.program_interview_slots for select to authenticated
  using (
    exists (
      select 1
      from public.program_match_recommendations m
      join public.program_questionnaire_submissions q on q.id = m.questionnaire_submission_id
      where m.id = match_recommendation_id and q.user_id = auth.uid()
    )
  );

-- The fifth pathway must also be accepted when a company opens a role.
alter table public.program_job_requirements
  drop constraint if exists program_job_requirements_specialisation_check;

alter table public.program_job_requirements
  add constraint program_job_requirements_specialisation_check
  check (specialisation in ('maintenance', 'sales', 'parts', 'electrics'));
