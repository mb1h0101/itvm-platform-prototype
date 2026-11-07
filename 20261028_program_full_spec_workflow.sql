-- ITVM / 新型專班 full workflow baseline.
-- Implements the six applicant stages plus the school, company, agency and
-- message records required by the teacher's specification. All applicant data
-- remains private to its owner and authorised programme administrators.

create table if not exists public.program_offerings (
  id uuid primary key default gen_random_uuid(),
  school_name text not null,
  department_name text not null,
  program_name text not null,
  language_requirement text,
  start_term text,
  capacity integer,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.program_offerings
  (school_name, department_name, program_name, language_requirement, start_term, capacity)
select '合作開班學校', '汽修專業人才橋接', 'Vehicle maintenance and service', 'Chinese A2', '2027 Spring', 40
where not exists (select 1 from public.program_offerings where program_name = 'Vehicle maintenance and service');
insert into public.program_offerings
  (school_name, department_name, program_name, language_requirement, start_term, capacity)
select '合作開班學校', '汽修專業人才橋接', 'Vehicle sales and after-sales service', 'Chinese A2', '2027 Spring', 40
where not exists (select 1 from public.program_offerings where program_name = 'Vehicle sales and after-sales service');
insert into public.program_offerings
  (school_name, department_name, program_name, language_requirement, start_term, capacity)
select '合作開班學校', '汽修專業人才橋接', 'Automotive parts, materials and electronics', 'Chinese A2', '2027 Spring', 40
where not exists (select 1 from public.program_offerings where program_name = 'Automotive parts, materials and electronics');

create table if not exists public.program_application_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  current_stage smallint not null default 1 check (current_stage between 1 and 6),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'document_review', 'interview', 'offered', 'accepted', 'preparing_arrival', 'enrolled', 'closed')),
  personal_data jsonb not null default '{}'::jsonb,
  skills_data jsonb not null default '{}'::jsonb,
  declaration_confirmed boolean not null default false,
  selected_offering_id uuid references public.program_offerings(id) on delete set null,
  second_offering_id uuid references public.program_offerings(id) on delete set null,
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.program_case_reviews (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.program_application_cases(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  review_type text not null check (review_type in ('document', 'interview', 'admission', 'scholarship')),
  decision text not null check (decision in ('pending', 'approved', 'revision_requested', 'rejected')),
  score numeric(5,2),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.program_case_offers (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null unique references public.program_application_cases(id) on delete cascade,
  offering_id uuid references public.program_offerings(id) on delete set null,
  scholarship_name text,
  tuition_support text,
  loa_document_path text,
  acceptance_status text not null default 'pending' check (acceptance_status in ('pending', 'accepted', 'declined')),
  response_due_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.program_case_arrivals (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null unique references public.program_application_cases(id) on delete cascade,
  visa_status text not null default 'not_started' check (visa_status in ('not_started', 'preparing', 'submitted', 'approved', 'declined')),
  departure_date date,
  arrival_date date,
  flight_number text,
  pickup_required boolean not null default false,
  pickup_notes text,
  accommodation_status text not null default 'not_started' check (accommodation_status in ('not_started', 'requested', 'confirmed')),
  checkin_status text not null default 'not_started' check (checkin_status in ('not_started', 'scheduled', 'completed')),
  reconfirmed_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.program_company_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  company_name text not null,
  registration_number text,
  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  company_description text,
  status text not null default 'submitted' check (status in ('draft', 'submitted', 'approved', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.program_agency_referrals (
  id uuid primary key default gen_random_uuid(),
  agency_user_id uuid not null references auth.users(id) on delete cascade,
  applicant_email text not null,
  applicant_name text,
  country_code text,
  case_id uuid references public.program_application_cases(id) on delete set null,
  status text not null default 'prospect' check (status in ('prospect', 'invited', 'applied', 'reviewing', 'interviewing', 'accepted', 'arrived', 'inactive')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.program_role_messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.program_application_cases(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid references auth.users(id) on delete cascade,
  recipient_role text check (recipient_role in ('student', 'school', 'company', 'agency')),
  subject text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (recipient_id is not null or recipient_role is not null)
);

create or replace function public.touch_program_workflow_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_program_application_cases on public.program_application_cases;
create trigger touch_program_application_cases before update on public.program_application_cases
for each row execute function public.touch_program_workflow_updated_at();
drop trigger if exists touch_program_case_offers on public.program_case_offers;
create trigger touch_program_case_offers before update on public.program_case_offers
for each row execute function public.touch_program_workflow_updated_at();
drop trigger if exists touch_program_case_arrivals on public.program_case_arrivals;
create trigger touch_program_case_arrivals before update on public.program_case_arrivals
for each row execute function public.touch_program_workflow_updated_at();
drop trigger if exists touch_program_company_profiles on public.program_company_profiles;
create trigger touch_program_company_profiles before update on public.program_company_profiles
for each row execute function public.touch_program_workflow_updated_at();
drop trigger if exists touch_program_agency_referrals on public.program_agency_referrals;
create trigger touch_program_agency_referrals before update on public.program_agency_referrals
for each row execute function public.touch_program_workflow_updated_at();

alter table public.program_offerings enable row level security;
alter table public.program_application_cases enable row level security;
alter table public.program_case_reviews enable row level security;
alter table public.program_case_offers enable row level security;
alter table public.program_case_arrivals enable row level security;
alter table public.program_company_profiles enable row level security;
alter table public.program_agency_referrals enable row level security;
alter table public.program_role_messages enable row level security;

create policy "program offerings authenticated read" on public.program_offerings for select to authenticated using (active or public.is_program_admin());
create policy "program admins manage offerings" on public.program_offerings for all to authenticated using (public.is_program_admin()) with check (public.is_program_admin());

create policy "applicants manage own case" on public.program_application_cases for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "program admins manage cases" on public.program_application_cases for all to authenticated using (public.is_program_admin()) with check (public.is_program_admin());
create policy "program admins manage reviews" on public.program_case_reviews for all to authenticated using (public.is_program_admin()) with check (public.is_program_admin());
create policy "applicants read own reviews" on public.program_case_reviews for select to authenticated using (exists(select 1 from public.program_application_cases c where c.id = case_id and c.user_id = auth.uid()));
create policy "applicants read own offer" on public.program_case_offers for select to authenticated using (exists(select 1 from public.program_application_cases c where c.id = case_id and c.user_id = auth.uid()));
create policy "applicants respond own offer" on public.program_case_offers for update to authenticated using (exists(select 1 from public.program_application_cases c where c.id = case_id and c.user_id = auth.uid())) with check (exists(select 1 from public.program_application_cases c where c.id = case_id and c.user_id = auth.uid()));
create policy "program admins manage offers" on public.program_case_offers for all to authenticated using (public.is_program_admin()) with check (public.is_program_admin());
create policy "applicants manage own arrival" on public.program_case_arrivals for all to authenticated using (exists(select 1 from public.program_application_cases c where c.id = case_id and c.user_id = auth.uid())) with check (exists(select 1 from public.program_application_cases c where c.id = case_id and c.user_id = auth.uid()));
create policy "program admins manage arrivals" on public.program_case_arrivals for all to authenticated using (public.is_program_admin()) with check (public.is_program_admin());
create policy "companies manage own profile" on public.program_company_profiles for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "program admins manage company profiles" on public.program_company_profiles for all to authenticated using (public.is_program_admin()) with check (public.is_program_admin());
create policy "agencies manage own referrals" on public.program_agency_referrals for all to authenticated using (agency_user_id = auth.uid()) with check (agency_user_id = auth.uid());
create policy "program admins manage agency referrals" on public.program_agency_referrals for all to authenticated using (public.is_program_admin()) with check (public.is_program_admin());
create policy "participants read private messages" on public.program_role_messages for select to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid() or public.is_program_admin());
create policy "participants send messages" on public.program_role_messages for insert to authenticated with check (sender_id = auth.uid());
create policy "recipients update messages" on public.program_role_messages for update to authenticated using (recipient_id = auth.uid() or public.is_program_admin()) with check (recipient_id = auth.uid() or public.is_program_admin());

create index if not exists program_application_cases_status_idx on public.program_application_cases(status, updated_at desc);
create index if not exists program_case_reviews_case_idx on public.program_case_reviews(case_id, created_at desc);
create index if not exists program_role_messages_recipient_idx on public.program_role_messages(recipient_id, created_at desc);
create index if not exists program_agency_referrals_agency_idx on public.program_agency_referrals(agency_user_id, updated_at desc);
