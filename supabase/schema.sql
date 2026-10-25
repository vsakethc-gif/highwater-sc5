-- =====================================================================
-- Highwater: community reports database (brief, section 11)
--
-- How to use: open your Supabase project → SQL Editor → New query,
-- paste this whole file, and click Run. It is safe to run more than once.
--
-- Security model, in plain words:
--   * The public (the app's "publishable" key) can READ only active, non-expired
--     reports, and only safe columns. It can never read the hashed device ID.
--   * The public can NEVER insert, update, or delete rows directly.
--   * New reports and votes come only through our Cloudflare Worker, which checks
--     Turnstile (anti-spam) and the content, then calls the two functions below
--     using the secret key. Those functions re-check everything.
--   * Signed-in admins (listed in the admins table) can see all reports and
--     change their status (hide, restore, resolve).
-- No names, emails, phone numbers, accounts, or IP addresses are stored.
-- =====================================================================

-- ---------- Tables ----------

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in (
    'streetlight_out', 'traffic_signal_out', 'downed_tree', 'flooded_road',
    'blocked_drain', 'road_damage', 'sign_damage', 'downed_power_line', 'other')),
  lat double precision not null check (lat between 33.6 and 35.5),
  lon double precision not null check (lon between -82.2 and -79.8),
  county_fips text not null check (county_fips in ('45021','45023','45039','45055','45057','45061','45087','45091')),
  description text check (description is null or char_length(description) <= 280),
  created_at timestamptz not null default now(),
  -- "Still there" votes push this forward, which delays expiry.
  last_confirmed_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'hidden', 'resolved', 'expired')),
  confirm_count int not null default 0,
  resolved_votes int not null default 0,
  flag_count int not null default 0,
  -- One-way hash of a random ID stored on the reporter's device (not tied to identity).
  -- Used only to limit how many reports one device can send. Never readable by the public.
  device_hash text not null
);

create index if not exists reports_active_idx on public.reports (status, last_confirmed_at);
create index if not exists reports_device_idx on public.reports (device_hash, created_at);

create table if not exists public.votes (
  report_id uuid not null references public.reports(id) on delete cascade,
  device_hash text not null,
  kind text not null check (kind in ('confirm', 'fixed', 'flag')),
  created_at timestamptz not null default now(),
  primary key (report_id, device_hash, kind)   -- one vote of each kind per device per report
);

create index if not exists votes_device_idx on public.votes (device_hash, created_at);

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- ---------- Row Level Security ----------

alter table public.reports enable row level security;
alter table public.votes enable row level security;
alter table public.admins enable row level security;

-- Start from "no access" for the public roles, then grant only what's needed.
revoke all on public.reports, public.votes, public.admins from anon, authenticated;

-- Public: read safe columns only (device_hash is not in this list).
grant select (id, category, lat, lon, county_fips, description, created_at, last_confirmed_at,
              status, confirm_count, resolved_votes) on public.reports to anon, authenticated;

-- Rows the public can see: active and not expired.
-- Flooded-road reports expire 48 hours after the last "Still there"; everything else after 30 days.
drop policy if exists "public reads active reports" on public.reports;
create policy "public reads active reports" on public.reports
  for select to anon, authenticated
  using (
    status = 'active'
    and last_confirmed_at > now() - case when category = 'flooded_road' then interval '48 hours' else interval '30 days' end
  );

-- Admins: see every report (any status) and change status.
create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

grant select (flag_count) on public.reports to authenticated;
grant update (status) on public.reports to authenticated;

drop policy if exists "admins read all reports" on public.reports;
create policy "admins read all reports" on public.reports
  for select to authenticated using (public.is_admin());

drop policy if exists "admins change status" on public.reports;
create policy "admins change status" on public.reports
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.admins to authenticated;
drop policy if exists "admins see themselves" on public.admins;
create policy "admins see themselves" on public.admins
  for select to authenticated using (user_id = auth.uid());

-- ---------- Functions the Worker calls (with the secret key) ----------

-- Add a report after re-checking everything. Returns the new report's id.
create or replace function public.submit_report(
  p_category text, p_lat double precision, p_lon double precision,
  p_county_fips text, p_description text, p_device_hash text
) returns uuid
  language plpgsql security definer set search_path = public
as $$
declare
  v_desc text := nullif(btrim(coalesce(p_description, '')), '');
  v_id uuid;
begin
  -- No phone numbers or email addresses in descriptions (privacy).
  if v_desc is not null and (v_desc ~ '\d{3}[\s.\-)]*\d{3}[\s.\-]*\d{4}' or v_desc ~* '[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}') then
    raise exception 'personal_info' using errcode = 'P0001';
  end if;
  -- At most 5 reports per device per hour.
  if (select count(*) from public.reports where device_hash = p_device_hash and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into public.reports (category, lat, lon, county_fips, description, device_hash)
  values (p_category, round(p_lat::numeric, 5), round(p_lon::numeric, 5), p_county_fips, v_desc, p_device_hash)
  returning id into v_id;
  return v_id;
end;
$$;

-- Record a vote: 'confirm' ("Still there"), 'fixed', or 'flag' (inappropriate).
--   3 "Fixed" votes  → status becomes 'resolved'
--   3 flags          → status becomes 'hidden' until an admin reviews it
-- Each device can cast each kind of vote once per report, and at most 30 votes per hour.
create or replace function public.vote_report(p_report_id uuid, p_device_hash text, p_kind text)
  returns text
  language plpgsql security definer set search_path = public
as $$
declare
  v_inserted int;
begin
  if p_kind not in ('confirm', 'fixed', 'flag') then
    raise exception 'bad_kind' using errcode = 'P0001';
  end if;
  if (select count(*) from public.votes where device_hash = p_device_hash and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.reports where id = p_report_id and status = 'active') then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  insert into public.votes (report_id, device_hash, kind) values (p_report_id, p_device_hash, p_kind)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return 'already_voted';
  end if;

  if p_kind = 'confirm' then
    update public.reports set confirm_count = confirm_count + 1, last_confirmed_at = now() where id = p_report_id;
  elsif p_kind = 'fixed' then
    update public.reports set resolved_votes = resolved_votes + 1,
      status = case when resolved_votes + 1 >= 3 then 'resolved' else status end
    where id = p_report_id;
  else
    update public.reports set flag_count = flag_count + 1,
      status = case when flag_count + 1 >= 3 then 'hidden' else status end
    where id = p_report_id;
  end if;
  return 'ok';
end;
$$;

-- Only the secret key (service_role) may call these. Supabase lets the public call
-- functions by default, so take that away explicitly.
revoke all on function public.submit_report(text, double precision, double precision, text, text, text) from public, anon, authenticated;
revoke all on function public.vote_report(uuid, text, text) from public, anon, authenticated;
grant execute on function public.submit_report(text, double precision, double precision, text, text, text) to service_role;
grant execute on function public.vote_report(uuid, text, text) to service_role;
