create table if not exists public.program_agency_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  organisation_name text not null,
  contact_name text not null,
  contact_email text not null,
  contact_phone text not null,
  service_country text not null,
  service_description text not null,
  student_support_needs text not null,
  status text not null default 'submitted' check (status in ('draft', 'submitted', 'reviewing', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.program_agency_submissions enable row level security;

create policy "agency owners manage their submissions"
  on public.program_agency_submissions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "program admins manage agency submissions"
  on public.program_agency_submissions for all to authenticated
  using (public.is_program_admin())
  with check (public.is_program_admin());
