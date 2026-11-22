-- Role-based access control enforced by RLS policies and role triggers.
-- Seeded users: admin 1111..., alice 2222..., bob 3333...
begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

-- Total row count as seen without RLS, used to verify the admin sees everything.
create temp table expected_total as
  select count(*)::bigint as n from public.consultations;
grant select on expected_total to authenticated;

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

-- No UPDATE policy exists on profiles, so RLS silently matches zero rows.
update public.profiles set role = 'admin'
where id = '22222222-2222-4222-8222-222222222222';

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

select * from finish();
rollback;
