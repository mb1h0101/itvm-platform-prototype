-- Allows only active school administrators to operate the protected matching workflow.
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

create policy "program admins manage submissions" on public.program_questionnaire_submissions
  for all to authenticated using (public.is_program_admin()) with check (public.is_program_admin());

create policy "program admins manage job requirements" on public.program_job_requirements
  for all to authenticated using (public.is_program_admin()) with check (public.is_program_admin());

create policy "program admins manage match recommendations" on public.program_match_recommendations
  for all to authenticated using (public.is_program_admin()) with check (public.is_program_admin());

create policy "program admins manage interview slots" on public.program_interview_slots
  for all to authenticated using (public.is_program_admin()) with check (public.is_program_admin());
