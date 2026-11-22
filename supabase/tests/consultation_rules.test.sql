-- Consultation business rules enforced at the database layer:
-- 60-minute exclusion constraint and the guard_consultation_write trigger.
-- Runs as the seeded student Alice through the same RLS path as PostgREST.
begin;
create extension if not exists pgtap with schema extensions;

select plan(28);

-- Setup as postgres (bypasses the guard trigger): consultations that already started,
-- which a student cannot create directly because bookings must be in the future.
insert into public.consultations (id, user_id, first_name, last_name, reason, scheduled_at, status, completed_at, duration_minutes)
values
  ('c0000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222',
   'Alice', 'Chen', 'Completed in the past', date_trunc('hour', now()) - interval '2 days',
   'completed', now(), 15),
  ('c0000000-0000-4000-8000-000000000005', '22222222-2222-4222-8222-222222222222',
   'Alice', 'Chen', 'Completed, will be reopened', date_trunc('hour', now()) - interval '5 days',
   'completed', now(), 60);

insert into public.consultations (id, user_id, first_name, last_name, reason, scheduled_at)
values
  ('c0000000-0000-4000-8000-000000000006', '22222222-2222-4222-8222-222222222222',
   'Alice', 'Chen', 'Overlaps the completed one',
   date_trunc('hour', now()) - interval '5 days' + interval '30 minutes'),
  ('c0000000-0000-4000-8000-000000000008', '22222222-2222-4222-8222-222222222222',
   'Alice', 'Chen', 'Started yesterday', date_trunc('hour', now()) - interval '1 day');

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

-- ---------------------------------------------------------------------------
-- 1. Exclusion constraint: a 60-minute session blocks its whole window
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ insert into public.consultations (id, user_id, first_name, last_name, reason, scheduled_at, duration_minutes)
     values ('c0000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222',
             'Alice', 'Chen', 'Slot test', date_trunc('hour', now()) + interval '30 days', 60) $$,
  'student can book a future 60-minute session'
);

select throws_ok(
  $$ insert into public.consultations (user_id, first_name, last_name, reason, scheduled_at)
     values ('22222222-2222-4222-8222-222222222222', 'Alice', 'Chen', 'Overlap',
             date_trunc('hour', now()) + interval '30 days 30 minutes') $$,
  '23P01', null,
  'booking 30 minutes into an active 60-minute session is rejected'
);

select lives_ok(
  $$ insert into public.consultations (user_id, first_name, last_name, reason, scheduled_at)
     values ('22222222-2222-4222-8222-222222222222', 'Alice', 'Chen', 'Adjacent',
             date_trunc('hour', now()) + interval '30 days 60 minutes') $$,
  'booking right after a 60-minute session ends is allowed'
);

select lives_ok(
  $$ update public.consultations set status = 'cancelled'
     where id = 'c0000000-0000-4000-8000-000000000001' $$,
  'student can cancel a scheduled consultation'
);

select lives_ok(
  $$ insert into public.consultations (user_id, first_name, last_name, reason, scheduled_at, duration_minutes)
     values ('22222222-2222-4222-8222-222222222222', 'Alice', 'Chen', 'Rebook',
             date_trunc('hour', now()) + interval '30 days', 60) $$,
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
             date_trunc('hour', now()) - interval '1 day') $$,
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
select throws_ok(
  $$ update public.consultations set status = 'scheduled'
     where id = 'c0000000-0000-4000-8000-000000000005' $$,
  '23P01', null,
  'marking incomplete is rejected when it would overlap an active consultation'
);

-- ---------------------------------------------------------------------------
-- 8. Booking horizon (90 days) and 15-minute slot grid
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.consultations (user_id, first_name, last_name, reason, scheduled_at)
     values ('22222222-2222-4222-8222-222222222222', 'Alice', 'Chen', 'Too far ahead',
             date_trunc('hour', now()) + interval '91 days') $$,
  '22023', null,
  'booking beyond 90 days is rejected'
);

select lives_ok(
  $$ insert into public.consultations (user_id, first_name, last_name, reason, scheduled_at)
     values ('22222222-2222-4222-8222-222222222222', 'Alice', 'Chen', 'Within horizon',
             date_trunc('hour', now()) + interval '89 days') $$,
  'booking within 90 days is allowed'
);

select throws_ok(
  $$ insert into public.consultations (user_id, first_name, last_name, reason, scheduled_at)
     values ('22222222-2222-4222-8222-222222222222', 'Alice', 'Chen', 'Off grid',
             date_trunc('hour', now()) + interval '35 days 7 minutes') $$,
  '22023', null,
  'booking at :07 (off the 15-minute grid) is rejected'
);

select throws_ok(
  $$ insert into public.consultations (user_id, first_name, last_name, reason, scheduled_at)
     values ('22222222-2222-4222-8222-222222222222', 'Alice', 'Chen', 'With seconds',
             date_trunc('hour', now()) + interval '35 days 15 minutes 30 seconds') $$,
  '22023', null,
  'booking with non-zero seconds is rejected'
);

select throws_ok(
  $$ update public.consultations
     set scheduled_at = date_trunc('hour', now()) + interval '45 days 10 minutes'
     where id = 'c0000000-0000-4000-8000-000000000004' $$,
  '22023', null,
  'rescheduling off the 15-minute grid is rejected'
);

select lives_ok(
  $$ update public.consultations
     set scheduled_at = date_trunc('hour', now()) + interval '46 days 45 minutes'
     where id = 'c0000000-0000-4000-8000-000000000004' $$,
  'rescheduling onto the 15-minute grid is allowed'
);

-- ---------------------------------------------------------------------------
-- 9. A consultation can be marked complete only after it has started
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ insert into public.consultations (id, user_id, first_name, last_name, reason, scheduled_at)
     values ('c0000000-0000-4000-8000-000000000007', '22222222-2222-4222-8222-222222222222',
             'Alice', 'Chen', 'Not started', date_trunc('hour', now()) + interval '60 days') $$,
  'setup: book a future consultation'
);

select throws_ok(
  $$ update public.consultations set status = 'completed'
     where id = 'c0000000-0000-4000-8000-000000000007' $$,
  '22023', null,
  'completing a consultation before it starts is rejected'
);

select lives_ok(
  $$ update public.consultations set status = 'completed'
     where id = 'c0000000-0000-4000-8000-000000000008' $$,
  'completing a consultation after it started is allowed'
);

-- ---------------------------------------------------------------------------
-- 10. Session length (15/30/45/60) drives the overlap window
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ insert into public.consultations (id, user_id, first_name, last_name, reason, scheduled_at, duration_minutes)
     values ('c0000000-0000-4000-8000-000000000009', '22222222-2222-4222-8222-222222222222',
             'Alice', 'Chen', 'Short A', date_trunc('hour', now()) + interval '70 days', 15),
            ('c0000000-0000-4000-8000-000000000010', '22222222-2222-4222-8222-222222222222',
             'Alice', 'Chen', 'Short B', date_trunc('hour', now()) + interval '70 days 15 minutes', 15),
            ('c0000000-0000-4000-8000-000000000011', '22222222-2222-4222-8222-222222222222',
             'Alice', 'Chen', 'Short C', date_trunc('hour', now()) + interval '70 days 60 minutes', 15) $$,
  'back-to-back 15-minute sessions are allowed (A, B, then C at +60)'
);

select is(
  (select duration_minutes::int from public.consultations
   where id = 'c0000000-0000-4000-8000-000000000004'),
  15,
  'session length defaults to 15 minutes'
);

select throws_ok(
  $$ insert into public.consultations (user_id, first_name, last_name, reason, scheduled_at, duration_minutes)
     values ('22222222-2222-4222-8222-222222222222', 'Alice', 'Chen', 'Overlaps a 45',
             date_trunc('hour', now()) + interval '70 days 30 minutes', 45) $$,
  '23P01', null,
  'a 45-minute session cannot run into the next booking'
);

select lives_ok(
  $$ insert into public.consultations (user_id, first_name, last_name, reason, scheduled_at, duration_minutes)
     values ('22222222-2222-4222-8222-222222222222', 'Alice', 'Chen', 'Fits after',
             date_trunc('hour', now()) + interval '70 days 30 minutes', 30) $$,
  'a 30-minute session that starts when the previous one ends is allowed'
);

select throws_ok(
  $$ insert into public.consultations (user_id, first_name, last_name, reason, scheduled_at, duration_minutes)
     values ('22222222-2222-4222-8222-222222222222', 'Alice', 'Chen', 'Odd length',
             date_trunc('hour', now()) + interval '75 days', 20) $$,
  '23514', null,
  'a session length outside 15/30/45/60 is rejected'
);

select throws_ok(
  $$ update public.consultations set duration_minutes = 30
     where id = 'c0000000-0000-4000-8000-000000000009' $$,
  '23P01', null,
  'lengthening a session into the next booking is rejected'
);

select * from finish();
rollback;
