-- Role-based access control enforced by RLS policies and role triggers.
-- Seeded users: admin 1111..., alice 2222..., bob 3333...
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

-- Total row count as seen without RLS, used to verify the admin sees everything.
create temp table expected_total as
  select count(*)::bigint as n from public.consultations;
grant select on expected_total to authenticated;

create temp table expected_profiles as
  select count(*)::bigint as n from public.profiles;
grant select on expected_profiles to authenticated;

create temp table expected_alice_bookings as
  select count(*)::int as n from public.consultations
  where user_id = '22222222-2222-4222-8222-222222222222';
grant select on expected_alice_bookings to authenticated;

set local role authenticated;

-- ---------------------------------------------------------------------------
-- 2. Row visibility: students see only their own rows, admins see all
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

select is(
  (select count(*) from public.consultations
   where user_id = '33333333-3333-4333-8333-333333333333'),
  0::bigint,
  'alice cannot see any of bob''s consultations'
);

select ok(
  (select count(*) from public.consultations) > 0
  and not exists (
    select 1 from public.consultations
    where user_id <> '22222222-2222-4222-8222-222222222222'
  ),
  'alice sees only her own consultations'
);

set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select is(
  (select count(*) from public.consultations),
  (select n from expected_total),
  'admin sees every consultation in the system'
);

select is(
  (select count(*) from public.profiles),
  (select n from expected_profiles),
  'admin sees every user profile (All Users tab)'
);

select is(
  (select total_consultations from public.profiles_with_consultation_count
   where id = '22222222-2222-4222-8222-222222222222'),
  (select n from expected_alice_bookings),
  'All Users count matches every consultation alice booked (all statuses)'
);

select is(
  (select total_consultations from public.profiles_with_consultation_count
   where id = '11111111-1111-4111-8111-111111111111'),
  0,
  'admins have 0 consultations'
);

-- ---------------------------------------------------------------------------
-- 4. Admins are read-only
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.consultations (user_id, first_name, last_name, reason, scheduled_at)
     values ('11111111-1111-4111-8111-111111111111', 'Contour', 'Admin', 'Admin booking',
             date_trunc('hour', now()) + interval '30 days') $$,
  '42501', null,
  'admin cannot create consultations'
);

-- ---------------------------------------------------------------------------
-- 3. Students cannot escalate their own role
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

-- Clients only hold UPDATE privilege on first_name/last_name, so this fails outright.
select throws_ok(
  $$ update public.profiles set role = 'admin'
     where id = '22222222-2222-4222-8222-222222222222' $$,
  '42501', null,
  'a student cannot change their own role'
);

select is(
  (select role::text from public.profiles
   where id = '22222222-2222-4222-8222-222222222222'),
  'student',
  'student role is unchanged after attempting self-promotion'
);

select is(
  public.is_admin(),
  false,
  'is_admin() stays false for the student'
);

select is(
  (select count(*) from public.profiles),
  1::bigint,
  'a student can only see their own profile'
);

select is(
  (select count(*) from public.profiles_with_consultation_count),
  1::bigint,
  'a student sees only their own row in the user-count view'
);

-- ---------------------------------------------------------------------------
-- My Profile: users may edit only their own first/last name
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ update public.profiles set first_name = 'Alicia', last_name = 'Chen-Wong'
     where id = '22222222-2222-4222-8222-222222222222' $$,
  'a student can update their own first and last name'
);

select is(
  (select first_name || ' ' || last_name from public.profiles
   where id = '22222222-2222-4222-8222-222222222222'),
  'Alicia Chen-Wong',
  'the new name is stored'
);

select throws_ok(
  $$ update public.profiles set email = 'alice2@example.com'
     where id = '22222222-2222-4222-8222-222222222222' $$,
  '42501', null,
  'a student cannot change their email through the profile table'
);

select throws_ok(
  $$ update public.profiles set first_name = '   '
     where id = '22222222-2222-4222-8222-222222222222' $$,
  '23514', null,
  'a blank first name is rejected by the check constraint'
);

-- RLS hides other users' rows from UPDATE, so this matches nothing.
update public.profiles set first_name = 'Hacked'
where id = '33333333-3333-4333-8333-333333333333';

reset role;

select isnt(
  (select first_name from public.profiles
   where id = '33333333-3333-4333-8333-333333333333'),
  'Hacked',
  'a student cannot change another user''s name'
);

select * from finish();
rollback;
