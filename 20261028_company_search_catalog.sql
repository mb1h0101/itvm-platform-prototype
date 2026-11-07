-- ITVM company search catalogue.
-- Only programme administrators can search all submitted company profiles;
-- each company continues to manage only its own profile under existing RLS.

alter table public.program_company_profiles
  add column if not exists region text,
  add column if not exists city text,
  add column if not exists industry text,
  add column if not exists service_scope text,
  add column if not exists searchable boolean not null default true;

create index if not exists program_company_profiles_region_city_idx
  on public.program_company_profiles(region, city)
  where searchable = true;

create index if not exists program_company_profiles_industry_idx
  on public.program_company_profiles(industry)
  where searchable = true;

comment on column public.program_company_profiles.searchable is
  'Controls whether an approved company is included in the ITVM administrator search catalogue. This does not make the record public.';
