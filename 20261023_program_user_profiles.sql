create table if not exists public.program_user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_role text not null check (requested_role in ('student', 'school', 'company', 'agency')),
  preferred_language text not null default 'zh-TW' check (preferred_language in ('zh-TW', 'en', 'id', 'vi')),
  display_name text,
  email text,
  approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.program_user_profiles enable row level security;

create policy "Users can read their own program profile"
  on public.program_user_profiles for select
  using (auth.uid() = user_id);

create policy "Users can update their own program profile"
  on public.program_user_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.create_program_user_profile()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.program_user_profiles (user_id, requested_role, preferred_language, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'requested_role', 'student'),
    coalesce(new.raw_user_meta_data ->> 'preferred_language', 'zh-TW'),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.email
  )
  on conflict (user_id) do update set
    display_name = excluded.display_name,
    email = excluded.email,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_program_profile on auth.users;
create trigger on_auth_user_created_program_profile
  after insert on auth.users
  for each row execute procedure public.create_program_user_profile();
