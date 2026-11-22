-- ============================================================================
-- Contour Mini-LMS — Initial Database Schema Migration
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Custom Enum Types
-- ----------------------------------------------------------------------------

-- Application roles for RBAC (student by default; admin promoted out-of-band)
create type public.app_role as enum ('student', 'admin');

-- Consultation lifecycle states (soft-cancel preserves audit history)
create type public.consultation_status as enum ('scheduled', 'completed', 'cancelled');

-- ----------------------------------------------------------------------------
-- 2. Profiles Table (1:1 with auth.users)
-- ----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  first_name text check (first_name is null or char_length(trim(first_name)) between 1 and 100),
  last_name text check (last_name is null or char_length(trim(last_name)) between 1 and 100),
  role public.app_role not null default 'student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. Global & Auth Safety Triggers
-- ----------------------------------------------------------------------------

-- Reusable trigger function to automatically maintain updated_at on mutable tables
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new is distinct from old then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger trg_profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- Automatically provision a student profile whenever a new auth.users row is created.
-- Role is always hardcoded to 'student' to prevent client-side privilege escalation.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_first_name text;
  v_last_name text;
begin
  v_first_name := left(nullif(trim(coalesce(new.raw_user_meta_data ->> 'first_name', '')), ''), 100);
  v_last_name := left(nullif(trim(coalesce(new.raw_user_meta_data ->> 'last_name', '')), ''), 100);

  insert into public.profiles (id, email, first_name, last_name, role)
  values (new.id, new.email, v_first_name, v_last_name, 'student');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Keep public.profiles.email in sync if a user updates their email in auth.users
create or replace function public.handle_user_email_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set email = new.email
  where id = new.id;

  return new;
end;
$$;

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_updated();

-- Prevent non-privileged sessions from escalating or altering public.profiles.role
create or replace function public.prevent_role_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.role is distinct from new.role then
    if current_user not in ('postgres', 'supabase_admin', 'service_role')
       and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
      raise exception 'Changing user role is not permitted'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_profiles_prevent_role_change
  before update on public.profiles
  for each row
  execute function public.prevent_role_change();

-- ----------------------------------------------------------------------------
-- 4. Consultations Table & Overlap Constraint
-- ----------------------------------------------------------------------------

-- Required for GiST exclusion constraints combining UUID equality with tstzrange overlap
create extension if not exists btree_gist;

-- Immutable helper returning the half-open 60-minute (1-hour) booking window [scheduled_at, scheduled_at + 60m).
-- Uses UTC epoch arithmetic (+3600s) so the expression is strictly IMMUTABLE for indexing.
create or replace function public.consultation_slot_range(p_scheduled_at timestamptz)
returns tstzrange
language sql
immutable
strict
set search_path = ''
as $$
  select pg_catalog.tstzrange(
    p_scheduled_at,
    pg_catalog.to_timestamp(extract(epoch from p_scheduled_at) + 3600),
    '[)'
  );
$$;

create table public.consultations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  first_name text not null check (char_length(trim(first_name)) between 1 and 100),
  last_name text not null check (char_length(trim(last_name)) between 1 and 100),
  reason text not null check (char_length(trim(reason)) between 1 and 1000),
  scheduled_at timestamptz not null,
  status public.consultation_status not null default 'scheduled',
  completed_at timestamptz,
  cancelled_at timestamptz,
  rescheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Keep status and lifecycle audit timestamps strictly consistent
  constraint chk_consultations_completed_at check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  ),
  constraint chk_consultations_cancelled_at check (
    (status = 'cancelled' and cancelled_at is not null)
    or (status <> 'cancelled' and cancelled_at is null)
  ),

  -- Prevent a student from holding overlapping active consultations within 60 minutes (1 hour)
  constraint no_overlapping_scheduled_consultations
    exclude using gist (
      user_id with =,
      public.consultation_slot_range(scheduled_at) with &&
    )
    where (status = 'scheduled')
);

-- Defense-in-depth trigger enforcing consultation business rules and immutable
-- audit columns at the database layer (blocks direct PostgREST bypasses).
create or replace function public.guard_consultation_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_profile_first_name text;
  v_profile_last_name text;
begin
  -- Allow migrations, seed scripts, and service-role admin operations
  if current_user in ('postgres', 'supabase_admin', 'service_role')
     or coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.scheduled_at <= now() then
      raise exception 'Consultation datetime must be in the future'
        using errcode = '22023';
    end if;

    -- Lock attendee names to the caller's profile whenever stored on public.profiles
    select first_name, last_name
    into v_profile_first_name, v_profile_last_name
    from public.profiles
    where id = new.user_id;

    if v_profile_first_name is not null then
      new.first_name := v_profile_first_name;
    end if;
    if v_profile_last_name is not null then
      new.last_name := v_profile_last_name;
    end if;

    new.status := 'scheduled';
    new.completed_at := null;
    new.cancelled_at := null;
    new.rescheduled_at := null;
    new.created_at := now();
    return new;
  end if;

  -- UPDATE rules: lock immutable fields
  if new.id is distinct from old.id
     or new.user_id is distinct from old.user_id
     or new.created_at is distinct from old.created_at
     or new.first_name is distinct from old.first_name
     or new.last_name is distinct from old.last_name then
    raise exception 'Immutable consultation fields cannot be modified'
      using errcode = '42501';
  end if;

  if old.status = 'cancelled' then
    raise exception 'Cancelled consultations cannot be modified'
      using errcode = '22023';
  end if;

  if old.status = 'completed' then
    if new.status = 'cancelled' then
      raise exception 'Completed consultations cannot be cancelled'
        using errcode = '22023';
    end if;
    if new.scheduled_at is distinct from old.scheduled_at
       or new.reason is distinct from old.reason then
      raise exception 'Completed consultations cannot be rescheduled or edited'
        using errcode = '22023';
    end if;

    new.completed_at := case when new.status = 'scheduled' then null else old.completed_at end;
    new.cancelled_at := null;
    new.rescheduled_at := old.rescheduled_at;
    return new;
  end if;

  -- old.status = 'scheduled'
  if new.status = 'cancelled' then
    if new.scheduled_at is distinct from old.scheduled_at
       or new.reason is distinct from old.reason then
      raise exception 'Cannot reschedule or edit a consultation while cancelling'
        using errcode = '22023';
    end if;
    new.cancelled_at := now();
    new.completed_at := null;
    new.rescheduled_at := old.rescheduled_at;
    return new;
  end if;

  if new.status = 'completed' then
    if new.scheduled_at is distinct from old.scheduled_at
       or new.reason is distinct from old.reason then
      raise exception 'Cannot reschedule or edit a consultation while completing'
        using errcode = '22023';
    end if;
    new.completed_at := now();
    new.cancelled_at := null;
    new.rescheduled_at := old.rescheduled_at;
    return new;
  end if;

  -- Staying 'scheduled' (reschedule / reason edit)
  new.completed_at := null;
  new.cancelled_at := null;
  if new.scheduled_at is distinct from old.scheduled_at then
    if new.scheduled_at <= now() then
      raise exception 'Consultation datetime must be in the future'
        using errcode = '22023';
    end if;
    new.rescheduled_at := now();
  else
    new.rescheduled_at := old.rescheduled_at;
  end if;

  return new;
end;
$$;

create trigger trg_consultations_guard_write
  before insert or update on public.consultations
  for each row
  execute function public.guard_consultation_write();

create trigger trg_consultations_set_updated_at
  before update on public.consultations
  for each row
  execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 5. Performance Indexes
-- ----------------------------------------------------------------------------

-- Student dashboard queries (own consultations, optionally filtered by status)
create index idx_consultations_user_scheduled
  on public.consultations (user_id, scheduled_at desc);

create index idx_consultations_user_status_scheduled
  on public.consultations (user_id, status, scheduled_at desc);

-- Admin console queries (global filtering & sorting)
create index idx_consultations_status_scheduled
  on public.consultations (status, scheduled_at desc);

create index idx_consultations_scheduled_at
  on public.consultations (scheduled_at desc);

create index idx_consultations_created_at
  on public.consultations (created_at desc);

-- Role lookup support
create index idx_profiles_role
  on public.profiles (role);

-- ----------------------------------------------------------------------------
-- 6. RBAC Helper & Row-Level Security (RLS)
-- ----------------------------------------------------------------------------

-- Returns true if the currently authenticated user has the 'admin' role.
-- SECURITY DEFINER prevents recursive RLS evaluation when queried inside policies.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, service_role;

-- Enable RLS on application tables
alter table public.profiles enable row level security;
alter table public.consultations enable row level security;

-- Profiles policies: SELECT-only for authenticated users (own profile or Admin).
-- No client INSERT/UPDATE/DELETE policies; provisioning & email sync are trigger-driven.
create policy "profiles_select_own_or_admin"
  on public.profiles
  for select
  to authenticated
  using (
    (select auth.uid()) = id
    or (select public.is_admin())
  );

-- Consultations policies:
-- 1. Students read their own consultations; Admins read all consultations system-wide.
create policy "consultations_select_own_or_admin"
  on public.consultations
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or (select public.is_admin())
  );

-- 2. Students can book new consultations only for themselves as 'scheduled' (admins are read-only).
create policy "consultations_insert_own"
  on public.consultations
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and not (select public.is_admin())
    and status = 'scheduled'
  );

-- 3. Student owners can update (reschedule, complete/incomplete, cancel) only their own rows
--    and cannot reassign user_id. Admins remain read-only; no DELETE policy (soft-cancel).
create policy "consultations_update_own"
  on public.consultations
  for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and not (select public.is_admin())
  )
  with check (
    (select auth.uid()) = user_id
    and not (select public.is_admin())
  );

-- ----------------------------------------------------------------------------
-- 7. Read View & Single-Query Summary Function (SECURITY INVOKER -> RLS active)
-- ----------------------------------------------------------------------------

-- Joins consultations with student profile fields for single-query Admin search & listing.
-- `security_invoker = true` ensures caller RLS policies on both tables are strictly enforced.
create view public.consultations_with_student
with (security_invoker = true) as
select
  c.id,
  c.user_id,
  c.first_name,
  c.last_name,
  c.reason,
  c.scheduled_at,
  c.status,
  c.completed_at,
  c.cancelled_at,
  c.rescheduled_at,
  c.created_at,
  c.updated_at,
  p.email as student_email,
  p.first_name as student_first_name,
  p.last_name as student_last_name
from public.consultations c
join public.profiles p on p.id = c.user_id;

revoke all on public.consultations_with_student from public, anon;
grant select on public.consultations_with_student to authenticated, service_role;

-- Returns consultation counts across all statuses in a single index-backed query.
-- SECURITY INVOKER ensures Postgres RLS scopes results automatically per caller.
create or replace function public.get_consultation_summary(p_user_id uuid default null)
returns table (
  total bigint,
  scheduled bigint,
  completed bigint,
  cancelled bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    count(*)::bigint as total,
    count(*) filter (where status = 'scheduled')::bigint as scheduled,
    count(*) filter (where status = 'completed')::bigint as completed,
    count(*) filter (where status = 'cancelled')::bigint as cancelled
  from public.consultations
  where p_user_id is null or user_id = p_user_id;
$$;

revoke all on function public.get_consultation_summary(uuid) from public;
grant execute on function public.get_consultation_summary(uuid) to authenticated, service_role;
