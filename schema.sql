create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'checkin_status') then
    create type public.checkin_status as enum ('present', 'late', 'duplicate', 'questioned', 'excused');
  end if;
end $$;

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid,
  line_user_id text unique not null,
  student_no text not null,
  name text not null,
  class_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid,
  line_user_id text unique not null,
  name text not null,
  email text,
  role text not null default 'teacher' check (role in ('admin', 'teacher')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.research_projects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete set null,
  name text not null,
  research_type text not null default 'training',
  department text,
  principal_teacher_name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid,
  research_project_id uuid references public.research_projects(id) on delete set null,
  course_type text not null default 'attendance' check (course_type in ('attendance', 'research_training', 'mixed')),
  name text not null,
  classroom text not null,
  teacher_id uuid references public.teachers(id) on delete set null,
  starts_at timestamptz,
  ends_at timestamptz,
  late_after_minutes integer not null default 10,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  school_id uuid,
  research_project_id uuid references public.research_projects(id) on delete set null,
  course_id uuid references public.courses(id) on delete set null,
  student_id uuid references public.students(id) on delete set null,
  line_user_id text not null,
  student_no text not null,
  student_name text not null,
  class_name text,
  classroom text not null,
  photo_path text not null,
  photo_url text,
  gps_lat numeric,
  gps_lng numeric,
  status public.checkin_status not null default 'present',
  note text,
  checked_in_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.teachers(id) on delete set null
);

create table if not exists public.roster_imports (
  id uuid primary key default gen_random_uuid(),
  school_id uuid,
  teacher_id uuid references public.teachers(id) on delete set null,
  teacher_name text not null,
  teacher_line_user_id text,
  source_name text not null,
  course_source_name text not null,
  total_rows integer not null default 0,
  imported_rows integer not null default 0,
  skipped_rows integer not null default 0,
  pending_line_rows integer not null default 0,
  missing_data_rows integer not null default 0,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

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
  interview_record_id uuid,
  country_code text not null check (country_code in ('VN', 'ID', 'OTHER')),
  student_name text not null,
  student_no text,
  line_user_id text,
  status text not null default 'prospect' check (status in ('prospect', 'applied', 'interviewing', 'accepted', 'arrived', 'inactive')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.interview_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid,
  student_name text not null,
  country text not null,
  target_department text not null,
  motivation text,
  chinese_level text not null default '初級',
  interview_date date,
  taiwan_arrival_date date,
  intro_script text not null,
  checkin_code text unique not null,
  readiness_status text not null default '準備中',
  course_id uuid references public.courses(id) on delete set null,
  assigned_teacher_id uuid references public.teachers(id) on delete set null,
  created_by_teacher_id uuid references public.teachers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ad_events (
  id uuid primary key default gen_random_uuid(),
  ad_key text not null,
  event_type text not null check (event_type in ('view', 'click')),
  line_user_id text,
  display_name text,
  entry_mode text,
  created_at timestamptz not null default now()
);

create table if not exists public.app_usage_events (
  id uuid primary key default gen_random_uuid(),
  line_user_id text not null,
  display_name text,
  entry_mode text,
  created_at timestamptz not null default now()
);

alter table public.students
  add column if not exists school_id uuid;

alter table public.teachers
  add column if not exists school_id uuid;

alter table public.courses
  add column if not exists school_id uuid;

alter table public.courses
  add column if not exists research_project_id uuid,
  add column if not exists course_type text not null default 'attendance';

alter table public.checkins
  add column if not exists school_id uuid;

alter table public.checkins
  add column if not exists research_project_id uuid;

alter table public.interview_records
  add column if not exists school_id uuid;

alter table public.roster_imports
  add column if not exists school_id uuid;

alter table public.agencies
  add column if not exists school_id uuid,
  add column if not exists country_code text not null default 'OTHER',
  add column if not exists name text,
  add column if not exists contact_name text,
  add column if not exists contact_line_user_id text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists notes text,
  add column if not exists is_active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

alter table public.agency_students
  add column if not exists agency_id uuid,
  add column if not exists student_id uuid,
  add column if not exists interview_record_id uuid,
  add column if not exists country_code text not null default 'OTHER',
  add column if not exists student_name text,
  add column if not exists student_no text,
  add column if not exists line_user_id text,
  add column if not exists status text not null default 'prospect',
  add column if not exists notes text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists checkins_checked_in_at_idx on public.checkins (checked_in_at desc);
create index if not exists checkins_course_id_idx on public.checkins (course_id);
create index if not exists checkins_student_no_idx on public.checkins (student_no);
create index if not exists courses_teacher_id_idx on public.courses (teacher_id);
create index if not exists students_school_id_idx on public.students (school_id);
create index if not exists teachers_school_id_idx on public.teachers (school_id);
create index if not exists research_projects_school_id_idx on public.research_projects (school_id);
create index if not exists research_projects_name_idx on public.research_projects (name);
create index if not exists courses_school_id_idx on public.courses (school_id);
create index if not exists courses_research_project_id_idx on public.courses (research_project_id);
create index if not exists checkins_school_id_idx on public.checkins (school_id);
create index if not exists checkins_research_project_id_idx on public.checkins (research_project_id);
create index if not exists roster_imports_submitted_at_idx on public.roster_imports (submitted_at desc);
create index if not exists roster_imports_teacher_id_idx on public.roster_imports (teacher_id);
create index if not exists roster_imports_school_id_idx on public.roster_imports (school_id);
create index if not exists agencies_school_id_idx on public.agencies (school_id);
create index if not exists agencies_country_code_idx on public.agencies (country_code);
create index if not exists agency_students_agency_id_idx on public.agency_students (agency_id);
create index if not exists agency_students_student_id_idx on public.agency_students (student_id);
create index if not exists agency_students_interview_record_id_idx on public.agency_students (interview_record_id);
create index if not exists agency_students_country_status_idx on public.agency_students (country_code, status);
create index if not exists interview_records_created_at_idx on public.interview_records (created_at desc);
create index if not exists interview_records_course_id_idx on public.interview_records (course_id);
create index if not exists interview_records_assigned_teacher_id_idx on public.interview_records (assigned_teacher_id);
create index if not exists interview_records_school_id_idx on public.interview_records (school_id);
create index if not exists ad_events_created_at_idx on public.ad_events (created_at desc);
create index if not exists ad_events_ad_key_event_type_idx on public.ad_events (ad_key, event_type);
create index if not exists app_usage_events_created_at_idx on public.app_usage_events (created_at desc);
create index if not exists app_usage_events_line_user_id_idx on public.app_usage_events (line_user_id);

alter table public.students
  add column if not exists school_id uuid;

alter table public.teachers
  add column if not exists school_id uuid;

alter table public.courses
  add column if not exists school_id uuid;

alter table public.courses
  add column if not exists research_project_id uuid,
  add column if not exists course_type text not null default 'attendance';

alter table public.checkins
  add column if not exists school_id uuid;

alter table public.checkins
  add column if not exists research_project_id uuid;

alter table public.interview_records
  add column if not exists school_id uuid;

alter table public.roster_imports
  add column if not exists school_id uuid;

alter table public.agencies
  add column if not exists school_id uuid,
  add column if not exists country_code text not null default 'OTHER',
  add column if not exists name text,
  add column if not exists contact_name text,
  add column if not exists contact_line_user_id text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists notes text,
  add column if not exists is_active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

alter table public.agency_students
  add column if not exists agency_id uuid,
  add column if not exists student_id uuid,
  add column if not exists interview_record_id uuid,
  add column if not exists country_code text not null default 'OTHER',
  add column if not exists student_name text,
  add column if not exists student_no text,
  add column if not exists line_user_id text,
  add column if not exists status text not null default 'prospect',
  add column if not exists notes text,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'students_school_id_fkey') then
    alter table public.students add constraint students_school_id_fkey foreign key (school_id) references public.schools(id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'teachers_school_id_fkey') then
    alter table public.teachers add constraint teachers_school_id_fkey foreign key (school_id) references public.schools(id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'courses_school_id_fkey') then
    alter table public.courses add constraint courses_school_id_fkey foreign key (school_id) references public.schools(id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'courses_research_project_id_fkey') then
    alter table public.courses add constraint courses_research_project_id_fkey foreign key (research_project_id) references public.research_projects(id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'checkins_school_id_fkey') then
    alter table public.checkins add constraint checkins_school_id_fkey foreign key (school_id) references public.schools(id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'checkins_research_project_id_fkey') then
    alter table public.checkins add constraint checkins_research_project_id_fkey foreign key (research_project_id) references public.research_projects(id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'interview_records_school_id_fkey') then
    alter table public.interview_records add constraint interview_records_school_id_fkey foreign key (school_id) references public.schools(id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'roster_imports_school_id_fkey') then
    alter table public.roster_imports add constraint roster_imports_school_id_fkey foreign key (school_id) references public.schools(id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'agencies_school_id_fkey') then
    alter table public.agencies add constraint agencies_school_id_fkey foreign key (school_id) references public.schools(id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'agency_students_agency_id_fkey') then
    alter table public.agency_students add constraint agency_students_agency_id_fkey foreign key (agency_id) references public.agencies(id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'agency_students_student_id_fkey') then
    alter table public.agency_students add constraint agency_students_student_id_fkey foreign key (student_id) references public.students(id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'agency_students_interview_record_id_fkey') then
    alter table public.agency_students add constraint agency_students_interview_record_id_fkey foreign key (interview_record_id) references public.interview_records(id) on delete set null;
  end if;
end $$;

alter table public.teachers
  add column if not exists role text not null default 'teacher';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'teachers_role_check'
      and conrelid = 'public.teachers'::regclass
  ) then
    alter table public.teachers
      add constraint teachers_role_check check (role in ('admin', 'teacher'));
  end if;
end $$;

alter table public.schools enable row level security;
alter table public.students enable row level security;
alter table public.teachers enable row level security;
alter table public.research_projects enable row level security;
alter table public.courses enable row level security;
alter table public.checkins enable row level security;
alter table public.roster_imports enable row level security;
alter table public.agencies enable row level security;
alter table public.agency_students enable row level security;
alter table public.interview_records enable row level security;
alter table public.ad_events enable row level security;
alter table public.app_usage_events enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.schools to anon, authenticated;
grant select, insert, update on public.students to anon, authenticated;
grant select on public.teachers to anon, authenticated;
grant select, insert, update on public.research_projects to anon, authenticated;
grant select, insert, update on public.courses to anon, authenticated;
grant select, insert, update on public.checkins to anon, authenticated;
grant select, insert on public.roster_imports to anon, authenticated;
grant select, insert, update on public.agencies to anon, authenticated;
grant select, insert, update on public.agency_students to anon, authenticated;
grant select, insert, update on public.interview_records to anon, authenticated;
grant select, insert on public.ad_events to anon, authenticated;
grant select, insert on public.app_usage_events to anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'schools' and policyname = 'read active schools') then
    create policy "read active schools" on public.schools for select using (is_active = true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'schools' and policyname = 'manage school seeds') then
    create policy "manage school seeds" on public.schools for insert with check (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'students' and policyname = 'students can register') then
    create policy "students can register" on public.students for insert with check (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'students' and policyname = 'students can read own/lookup') then
    create policy "students can read own/lookup" on public.students for select using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'students' and policyname = 'students can update own profile') then
    create policy "students can update own profile" on public.students for update using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'teachers' and policyname = 'read active teachers') then
    create policy "read active teachers" on public.teachers for select using (is_active = true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'research_projects' and policyname = 'read active research projects') then
    create policy "read active research projects" on public.research_projects for select using (is_active = true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'research_projects' and policyname = 'create research projects') then
    create policy "create research projects" on public.research_projects for insert with check (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'research_projects' and policyname = 'update research projects') then
    create policy "update research projects" on public.research_projects for update using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'courses' and policyname = 'read active courses') then
    create policy "read active courses" on public.courses for select using (is_active = true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'courses' and policyname = 'create courses') then
    create policy "create courses" on public.courses for insert with check (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'courses' and policyname = 'update courses') then
    create policy "update courses" on public.courses for update using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'checkins' and policyname = 'create checkins') then
    create policy "create checkins" on public.checkins for insert with check (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'checkins' and policyname = 'read checkins') then
    create policy "read checkins" on public.checkins for select using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'checkins' and policyname = 'teachers update checkins') then
    create policy "teachers update checkins" on public.checkins for update using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'roster_imports' and policyname = 'create roster imports') then
    create policy "create roster imports" on public.roster_imports for insert with check (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'roster_imports' and policyname = 'read roster imports') then
    create policy "read roster imports" on public.roster_imports for select using (true);
  end if;

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

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'interview_records' and policyname = 'create interview records') then
    create policy "create interview records" on public.interview_records for insert with check (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'interview_records' and policyname = 'read interview records') then
    create policy "read interview records" on public.interview_records for select using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'interview_records' and policyname = 'update interview records') then
    create policy "update interview records" on public.interview_records for update using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ad_events' and policyname = 'create ad events') then
    create policy "create ad events" on public.ad_events for insert with check (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ad_events' and policyname = 'read ad events') then
    create policy "read ad events" on public.ad_events for select using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'app_usage_events' and policyname = 'create app usage events') then
    create policy "create app usage events" on public.app_usage_events for insert with check (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'app_usage_events' and policyname = 'read app usage events') then
    create policy "read app usage events" on public.app_usage_events for select using (true);
  end if;
end $$;

insert into public.schools (name, code, is_active)
values
  ('南臺科技大學', 'STUST', true),
  ('崑山科技大學', 'KSU', true),
  ('國立高雄科技大學', 'NKUST', true)
on conflict (code) do update set
  name = excluded.name,
  is_active = excluded.is_active;

with stust as (
  select id from public.schools where code = 'STUST' limit 1
),
project_insert as (
  insert into public.research_projects (
    school_id,
    name,
    research_type,
    department,
    principal_teacher_name,
    description,
    is_active
  )
  select
    stust.id,
    'HSIS-MIDI 手指獨立訓練',
    'wearable_midi_learning_analytics',
    '南台科大流行音樂系',
    '林岑芳老師',
    '穿戴式多 IMU 與 MIDI 回饋的手指獨立訓練研究，先與 LINE 點名系統共用課程、學生與出席紀錄。',
    true
  from stust
  where not exists (
    select 1 from public.research_projects
    where name = 'HSIS-MIDI 手指獨立訓練'
      and principal_teacher_name = '林岑芳老師'
  )
  returning id, school_id
),
project_row as (
  select id, school_id from project_insert
  union all
  select id, school_id from public.research_projects
  where name = 'HSIS-MIDI 手指獨立訓練'
    and principal_teacher_name = '林岑芳老師'
  limit 1
)
insert into public.courses (
  school_id,
  research_project_id,
  course_type,
  name,
  classroom,
  teacher_id,
  starts_at,
  ends_at,
  late_after_minutes,
  is_active
)
select
  school_id,
  id,
  'research_training',
  'HSIS-MIDI 手指獨立訓練',
  '南台科大流行音樂系｜林岑芳老師',
  null,
  null,
  null,
  10,
  true
from project_row
where not exists (
  select 1 from public.courses
  where name = 'HSIS-MIDI 手指獨立訓練'
    and classroom = '南台科大流行音樂系｜林岑芳老師'
);

insert into public.courses (name, classroom, starts_at, ends_at, late_after_minutes)
select '預設課程', '一般教室', null, null, 10
where not exists (
  select 1 from public.courses
  where name = '預設課程'
    and classroom = '一般教室'
);

insert into storage.buckets (id, name, public)
values ('checkin-photos', 'checkin-photos', true)
on conflict (id) do update set public = true;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'checkin photos public read'
  ) then
    create policy "checkin photos public read"
      on storage.objects for select
      using (bucket_id = 'checkin-photos');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'checkin photos anon upload'
  ) then
    create policy "checkin photos anon upload"
      on storage.objects for insert
      with check (bucket_id = 'checkin-photos');
  end if;
end $$;
