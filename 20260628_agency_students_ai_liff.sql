create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete set null,
  country_code text not null check (country_code in ('VN', 'ID', 'OTHER')),
  name text not null,
  contact_name text,
  contact_line_user_id text,
  contact_email text,
  contact_phone text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agency_students (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  interview_record_id uuid references public.interview_records(id) on delete set null,
  country_code text not null check (country_code in ('VN', 'ID', 'OTHER')),
  student_name text not null,
  student_no text,
  line_user_id text,
  status text not null default 'prospect' check (status in ('prospect', 'applied', 'interviewing', 'accepted', 'arrived', 'inactive')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agencies_school_id_idx on public.agencies (school_id);
create index if not exists agencies_country_code_idx on public.agencies (country_code);
create index if not exists agency_students_agency_id_idx on public.agency_students (agency_id);
create index if not exists agency_students_student_id_idx on public.agency_students (student_id);
create index if not exists agency_students_interview_record_id_idx on public.agency_students (interview_record_id);
create index if not exists agency_students_country_status_idx on public.agency_students (country_code, status);

alter table public.agencies enable row level security;
alter table public.agency_students enable row level security;

grant select, insert, update on public.agencies to anon, authenticated;
grant select, insert, update on public.agency_students to anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'agencies' and policyname = 'read agencies') then
    create policy "read agencies" on public.agencies for select using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'agencies' and policyname = 'create agencies') then
    create policy "create agencies" on public.agencies for insert with check (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'agencies' and policyname = 'update agencies') then
    create policy "update agencies" on public.agencies for update using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'agency_students' and policyname = 'read agency students') then
    create policy "read agency students" on public.agency_students for select using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'agency_students' and policyname = 'create agency students') then
    create policy "create agency students" on public.agency_students for insert with check (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'agency_students' and policyname = 'update agency students') then
    create policy "update agency students" on public.agency_students for update using (true);
  end if;
end $$;
