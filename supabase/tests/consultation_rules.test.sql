-- Consultation business rules enforced at the database layer:
-- 60-minute exclusion constraint and the guard_consultation_write trigger.
-- Runs as the seeded student Alice through the same RLS path as PostgREST.
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

-- ---------------------------------------------------------------------------
-- 1. 60-minute exclusion constraint
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ insert into public.consultations (id, user_id, first_name, last_name, reason, scheduled_at)
     values ('c0000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222',
             'Alice', 'Chen', 'Slot test', date_trunc('hour', now()) + interval '30 days') $$,
  'student can book a future slot'
);

select throws_ok(
  $$ insert into public.consultations (user_id, first_name, last_name, reason, scheduled_at)
     values ('22222222-2222-4222-8222-222222222222', 'Alice', 'Chen', 'Overlap',
             date_trunc('hour', now()) + interval '30 days 30 minutes') $$,
  '23P01', null,
  'booking 30 minutes after an active consultation is rejected'
);

select lives_ok(
  $$ insert into public.consultations (user_id, first_name, last_name, reason, scheduled_at)
     values ('22222222-2222-4222-8222-222222222222', 'Alice', 'Chen', 'Adjacent',
             date_trunc('hour', now()) + interval '30 days 60 minutes') $$,
  'booking exactly 60 minutes later is allowed'
);

select lives_ok(
  $$ update public.consultations set status = 'cancelled'
     where id = 'c0000000-0000-4000-8000-000000000001' $$,
  'student can cancel a scheduled consultation'
);

select lives_ok(
  $$ insert into public.consultations (user_id, first_name, last_name, reason, scheduled_at)
     values ('22222222-2222-4222-8222-222222222222', 'Alice', 'Chen', 'Rebook',
             date_trunc('hour', now()) + interval '30 days') $$,
  'a slot freed by cancellation can be booked again'
);

-- ---------------------------------------------------------------------------
-- 5. Cancelled rows are immutable; completed rows cannot be cancelled
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ insert into public.consultations (id, user_id, first_name, last_name, reason, scheduled_at)
     values ('c0000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222',
             'Alice', 'Chen', 'To cancel', date_trunc('hour', now()) + interval '40 days');
     update public.consultations set status = 'cancelled'
     where id = 'c0000000-0000-4000-8000-000000000002' $$,
  'setup: book and cancel a consultation'
);

select throws_ok(
  $$ update public.consultations set reason = 'Edited after cancel'
     where id = 'c0000000-0000-4000-8000-000000000002' $$,
  '22023', null,
  'modifying a cancelled consultation is rejected'
);

select lives_ok(
  $$ insert into public.consultations (id, user_id, first_name, last_name, reason, scheduled_at)
     values ('c0000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222',
             'Alice', 'Chen', 'To complete', date_trunc('hour', now()) + interval '40 days 2 hours');
     update public.consultations set status = 'completed'
     where id = 'c0000000-0000-4000-8000-000000000003' $$,
  'setup: book and complete a consultation'
);

select throws_ok(
  $$ update public.consultations set status = 'cancelled'
     where id = 'c0000000-0000-4000-8000-000000000003' $$,
  '22023', null,
  'cancelling a completed consultation is rejected'
);

-- ---------------------------------------------------------------------------
-- 6. Insert guard: future-only datetime, attendee names locked to profile
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.consultations (user_id, first_name, last_name, reason, scheduled_at)
     values ('22222222-2222-4222-8222-222222222222', 'Alice', 'Chen', 'Past booking',
             now() - interval '1 day') $$,
  '22023', null,
  'booking a past datetime directly via the table is rejected'
);

select lives_ok(
  $$ insert into public.consultations (id, user_id, first_name, last_name, reason, scheduled_at)
     values ('c0000000-0000-4000-8000-000000000004', '22222222-2222-4222-8222-222222222222',
             'Mallory', 'Spoofed', 'Name spoof', date_trunc('hour', now()) + interval '45 days') $$,
  'setup: insert with names that differ from the profile'
);

select is(
  (select first_name from public.consultations where id = 'c0000000-0000-4000-8000-000000000004'),
  (select first_name from public.profiles where id = '22222222-2222-4222-8222-222222222222'),
  'trigger rewrites first_name to the profile value'
);

select is(
  (select last_name from public.consultations where id = 'c0000000-0000-4000-8000-000000000004'),
  (select last_name from public.profiles where id = '22222222-2222-4222-8222-222222222222'),
  'trigger rewrites last_name to the profile value'
);

-- ---------------------------------------------------------------------------
-- 7. Marking a completed consultation incomplete re-checks the slot
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ insert into public.consultations (id, user_id, first_name, last_name, reason, scheduled_at)
     values ('c0000000-0000-4000-8000-000000000005', '22222222-2222-4222-8222-222222222222',
             'Alice', 'Chen', 'Completed early', date_trunc('hour', now()) + interval '50 days');
     update public.consultations set status = 'completed'
     where id = 'c0000000-0000-4000-8000-000000000005' $$,
  'setup: book and complete a consultation'
);

select lives_ok(
  $$ insert into public.consultations (user_id, first_name, last_name, reason, scheduled_at)
     values ('22222222-2222-4222-8222-222222222222', 'Alice', 'Chen', 'Overlaps completed',
             date_trunc('hour', now()) + interval '50 days 30 minutes') $$,
  'a completed consultation does not block an overlapping booking'
);

select throws_ok(
  $$ update public.consultations set status = 'scheduled'
     where id = 'c0000000-0000-4000-8000-000000000005' $$,
  '23P01', null,
  'marking incomplete is rejected when it would overlap an active consultation'
);

select * from finish();
rollback;
