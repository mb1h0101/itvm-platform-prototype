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

alter table public.courses
  add column if not exists research_project_id uuid,
  add column if not exists course_type text not null default 'attendance';

alter table public.checkins
  add column if not exists research_project_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'courses_course_type_check'
      and conrelid = 'public.courses'::regclass
  ) then
    alter table public.courses
      add constraint courses_course_type_check
      check (course_type in ('attendance', 'research_training', 'mixed'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'courses_research_project_id_fkey') then
    alter table public.courses
      add constraint courses_research_project_id_fkey
      foreign key (research_project_id) references public.research_projects(id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'checkins_research_project_id_fkey') then
    alter table public.checkins
      add constraint checkins_research_project_id_fkey
      foreign key (research_project_id) references public.research_projects(id) on delete set null;
  end if;
end $$;

create index if not exists research_projects_school_id_idx on public.research_projects (school_id);
create index if not exists research_projects_name_idx on public.research_projects (name);
create index if not exists courses_research_project_id_idx on public.courses (research_project_id);
create index if not exists checkins_research_project_id_idx on public.checkins (research_project_id);

alter table public.research_projects enable row level security;

grant select, insert, update on public.research_projects to anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'research_projects'
      and policyname = 'read active research projects'
  ) then
    create policy "read active research projects"
      on public.research_projects for select
      using (is_active = true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'research_projects'
      and policyname = 'create research projects'
  ) then
    create policy "create research projects"
      on public.research_projects for insert
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'research_projects'
      and policyname = 'update research projects'
  ) then
    create policy "update research projects"
      on public.research_projects for update
      using (true);
  end if;
end $$;

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
