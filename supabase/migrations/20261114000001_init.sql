-- PatchPing initial schema
-- Users register apps, list each app's components (package + exact version),
-- a scheduled scan checks them against OSV.dev, and new findings are emailed.

create extension if not exists pgcrypto;

-- ───────────────────────── profiles ─────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  notify_email text,
  alerts_enabled boolean not null default true,
  min_severity text not null default 'low'
    check (min_severity in ('low', 'moderate', 'high', 'critical')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── apps ─────────────────────────
create table public.apps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text check (description is null or char_length(description) <= 300),
  last_scanned_at timestamptz,
  created_at timestamptz not null default now()
);
create index apps_user_id_idx on public.apps (user_id);

-- ───────────────────────── components ─────────────────────────
create table public.components (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ecosystem text not null check (ecosystem in (
    'npm', 'PyPI', 'Go', 'crates.io', 'Packagist', 'RubyGems',
    'Maven', 'NuGet', 'Pub', 'Hex'
  )),
  name text not null check (char_length(name) between 1 and 214),
  version text not null check (char_length(version) between 1 and 100),
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  unique (app_id, ecosystem, name, version)
);
create index components_app_id_idx on public.components (app_id);
create index components_user_id_idx on public.components (user_id);

-- ───────────────────────── findings ─────────────────────────
create table public.findings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  app_id uuid not null references public.apps (id) on delete cascade,
  component_id uuid not null references public.components (id) on delete cascade,
  vuln_id text not null,
  aliases text[] not null default '{}',
  summary text,
  details text,
  severity text not null default 'unknown'
    check (severity in ('unknown', 'low', 'moderate', 'high', 'critical')),
  cvss_vector text,
  fixed_version text,
  reference_url text,
  published_at timestamptz,
  status text not null default 'open' check (status in ('open', 'dismissed', 'fixed')),
  first_seen_at timestamptz not null default now(),
  notified_at timestamptz,
  unique (component_id, vuln_id)
);
create index findings_user_id_idx on public.findings (user_id);
create index findings_app_id_idx on public.findings (app_id);
create index findings_pending_idx on public.findings (notified_at) where notified_at is null;

-- ───────────────────────── scan runs (audit log) ─────────────────────────
create table public.scan_runs (
  id bigint generated always as identity primary key,
  trigger text not null check (trigger in ('cron', 'user')),
  user_id uuid references auth.users (id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  components_checked int not null default 0,
  new_findings int not null default 0,
  error text
);
create index scan_runs_user_id_idx on public.scan_runs (user_id);

-- ───────────────────────── fair-use limits ─────────────────────────
create or replace function public.enforce_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'apps' then
    if (select count(*) from public.apps where user_id = new.user_id) >= 25 then
      raise exception 'App limit reached (25 apps per account).';
    end if;
  elsif tg_table_name = 'components' then
    if (select count(*) from public.components where app_id = new.app_id) >= 5000 then
      raise exception 'Component limit reached (5000 per app).';
    end if;
    if not exists (select 1 from public.apps a where a.id = new.app_id and a.user_id = new.user_id) then
      raise exception 'App not found.';
    end if;
  end if;
  return new;
end;
$$;

create trigger apps_limit before insert on public.apps
  for each row execute function public.enforce_limits();
create trigger components_limit before insert on public.components
  for each row execute function public.enforce_limits();

-- ───────────────────────── row level security ─────────────────────────
alter table public.profiles enable row level security;
alter table public.apps enable row level security;
alter table public.components enable row level security;
alter table public.findings enable row level security;
alter table public.scan_runs enable row level security;

create policy "own profile read" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "own profile update" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "own apps" on public.apps
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own components" on public.components
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own findings read" on public.findings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own findings update" on public.findings
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own scan runs read" on public.scan_runs
  for select to authenticated using ((select auth.uid()) = user_id);

-- Users may only change a finding's status, and only a few profile fields.
revoke update on public.findings from authenticated, anon;
grant update (status) on public.findings to authenticated;
revoke update on public.profiles from authenticated, anon;
grant update (notify_email, alerts_enabled, min_severity) on public.profiles to authenticated;
revoke insert, delete on public.findings from authenticated, anon;
revoke insert, update, delete on public.scan_runs from authenticated, anon;
revoke all on public.profiles, public.apps, public.components, public.findings, public.scan_runs from anon;
