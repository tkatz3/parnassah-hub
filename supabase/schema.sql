-- ============================================================
--  ParnassaHub — Supabase Schema
-- ============================================================
-- Run this entire file in Supabase Dashboard → SQL Editor → New query
-- ============================================================


-- ── 1. PROFILES ─────────────────────────────────────────────
-- Extends Supabase's built-in auth.users table.
-- role: 'seeker' | 'employer'

create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          text not null check (role in ('seeker', 'employer')),
  first_name    text,
  last_name     text,
  phone         text,
  created_at    timestamptz default now()
);

-- Auto-create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'seeker')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ── 2. COMPANIES ────────────────────────────────────────────
-- One company per employer account.

create table if not exists public.companies (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  website     text,
  industry    text,
  description text,
  created_at  timestamptz default now()
);


-- ── 3. JOBS ─────────────────────────────────────────────────

create table if not exists public.jobs (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  title         text not null,
  category      text not null,
  location      text not null,
  vacancy_type  text not null check (vacancy_type in ('Full Time', 'Part-Time', 'Commission', 'Volunteer')),
  salary_min    integer,
  salary_max    integer,
  pay_period    text check (pay_period in ('Annual', 'Hourly', 'Daily', 'Commission Only', 'Unpaid / Volunteer')),
  description   text,
  requirements  text,
  contact_email text,
  contact_phone text,
  active        boolean default true,
  created_at    timestamptz default now()
);


-- ── 4. SEEKER PROFILES ──────────────────────────────────────

create table if not exists public.seeker_profiles (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles(id) on delete cascade,
  resume_url            text,
  preferred_categories  text[],   -- e.g. ARRAY['Accounting & Auditing','Finance & Banking']
  preferred_locations   text[],   -- e.g. ARRAY['Union County','Remote']
  preferred_types       text[],   -- e.g. ARRAY['Full Time','Part-Time']
  created_at            timestamptz default now()
);


-- ── 5. APPLICATIONS ─────────────────────────────────────────

create table if not exists public.applications (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.jobs(id) on delete cascade,
  seeker_id   uuid not null references public.profiles(id) on delete cascade,
  status      text default 'Submitted' check (status in ('Submitted','In Review','Interview Scheduled','Rejected','Hired')),
  applied_at  timestamptz default now(),
  unique (job_id, seeker_id)   -- prevent duplicate applications
);


-- ── 6. SAVED JOBS ───────────────────────────────────────────

create table if not exists public.saved_jobs (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.jobs(id) on delete cascade,
  seeker_id   uuid not null references public.profiles(id) on delete cascade,
  saved_at    timestamptz default now(),
  unique (job_id, seeker_id)
);


-- ============================================================
--  ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles        enable row level security;
alter table public.companies       enable row level security;
alter table public.jobs            enable row level security;
alter table public.seeker_profiles enable row level security;
alter table public.applications    enable row level security;
alter table public.saved_jobs      enable row level security;

-- profiles: users can read/update their own row
create policy "profiles: own row" on public.profiles
  for all using (auth.uid() = id);

-- companies: employers manage their own company
create policy "companies: owner full access" on public.companies
  for all using (auth.uid() = user_id);

-- jobs: anyone can read active jobs; employers manage their own
create policy "jobs: public read active" on public.jobs
  for select using (active = true);

create policy "jobs: employer manages own" on public.jobs
  for all using (
    company_id in (
      select id from public.companies where user_id = auth.uid()
    )
  );

-- seeker_profiles: own row only
create policy "seeker_profiles: own row" on public.seeker_profiles
  for all using (auth.uid() = user_id);

-- applications: seekers see/create their own; employers see apps for their jobs
create policy "applications: seeker own" on public.applications
  for all using (auth.uid() = seeker_id);

create policy "applications: employer reads own job apps" on public.applications
  for select using (
    job_id in (
      select j.id from public.jobs j
      join public.companies c on c.id = j.company_id
      where c.user_id = auth.uid()
    )
  );

create policy "applications: employer updates status" on public.applications
  for update using (
    job_id in (
      select j.id from public.jobs j
      join public.companies c on c.id = j.company_id
      where c.user_id = auth.uid()
    )
  );

-- saved_jobs: seeker own row
create policy "saved_jobs: seeker own" on public.saved_jobs
  for all using (auth.uid() = seeker_id);


-- ============================================================
--  SAMPLE DATA  (feel free to delete after testing)
-- ============================================================

-- Insert a sample company (no real user_id — placeholder for testing)
-- You'll replace these with real data once employers sign up.

-- insert into public.jobs (company_id, title, category, location, vacancy_type,
--   salary_min, salary_max, pay_period, description, contact_email, active)
-- values (
--   '<company-uuid-here>',
--   'Senior Accountant',
--   'Accounting & Auditing',
--   'Union County',
--   'Full Time',
--   70000, 90000, 'Annual',
--   'Looking for an experienced Senior Accountant...',
--   'hr@company.com',
--   true
-- );
