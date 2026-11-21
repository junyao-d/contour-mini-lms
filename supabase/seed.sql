-- ============================================================================
-- Contour Mini-LMS — Local Development Seed Data
-- ============================================================================
-- Accounts seeded (password for all: Password123!):
--   Admin:     admin@contour-lms.local
--   Student 1: alice@contour-lms.local
--   Student 2: bob@contour-lms.local
-- ============================================================================

do $$
declare
  v_admin_id uuid := '11111111-1111-4111-8111-111111111111';
  v_alice_id uuid := '22222222-2222-4222-8222-222222222222';
  v_bob_id   uuid := '33333333-3333-4333-8333-333333333333';
  v_password_hash text := extensions.crypt('Password123!', extensions.gen_salt('bf'));
begin
  -- 1. Seed Auth users (inserting into auth.users fires on_auth_user_created -> public.profiles)
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change,
    email_change_token_new,
    email_change_token_current,
    reauthentication_token,
    phone_change,
    phone_change_token,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    is_sso_user,
    is_anonymous,
    created_at,
    updated_at
  )
  values
    (
      '00000000-0000-0000-0000-000000000000',
      v_admin_id,
      'authenticated',
      'authenticated',
      'admin@contour-lms.local',
      v_password_hash,
      now(),
      '', '', '', '', '', '', '', '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"first_name":"Contour","last_name":"Admin","email_verified":true}'::jsonb,
      false, false, false,
      now() - interval '14 days',
      now() - interval '14 days'
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      v_alice_id,
      'authenticated',
      'authenticated',
      'alice@contour-lms.local',
      v_password_hash,
      now(),
      '', '', '', '', '', '', '', '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"first_name":"Alice","last_name":"Chen","email_verified":true}'::jsonb,
      false, false, false,
      now() - interval '10 days',
      now() - interval '10 days'
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      v_bob_id,
      'authenticated',
      'authenticated',
      'bob@contour-lms.local',
      v_password_hash,
      now(),
      '', '', '', '', '', '', '', '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"first_name":"Bob","last_name":"Patel","email_verified":true}'::jsonb,
      false, false, false,
      now() - interval '8 days',
      now() - interval '8 days'
    )
  on conflict (id) do nothing;

  -- 2. Seed matching email identities required by Supabase Auth (GoTrue)
  insert into auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values
    (
      '11111111-1111-4111-8111-111111111112',
      v_admin_id,
      v_admin_id::text,
      jsonb_build_object('sub', v_admin_id::text, 'email', 'admin@contour-lms.local', 'email_verified', true),
      'email',
      now(),
      now() - interval '14 days',
      now() - interval '14 days'
    ),
    (
      '22222222-2222-4222-8222-222222222223',
      v_alice_id,
      v_alice_id::text,
      jsonb_build_object('sub', v_alice_id::text, 'email', 'alice@contour-lms.local', 'email_verified', true),
      'email',
      now(),
      now() - interval '10 days',
      now() - interval '10 days'
    ),
    (
      '33333333-3333-4333-8333-333333333334',
      v_bob_id,
      v_bob_id::text,
      jsonb_build_object('sub', v_bob_id::text, 'email', 'bob@contour-lms.local', 'email_verified', true),
      'email',
      now(),
      now() - interval '8 days',
      now() - interval '8 days'
    )
  on conflict (provider_id, provider) do nothing;

  -- 3. Promote seeded admin account (allowed for postgres role)
  update public.profiles
  set role = 'admin'
  where id = v_admin_id;

  -- 4. Seed 6 sample consultations across scheduled, completed, cancelled, and rescheduled states
  insert into public.consultations (
    id,
    user_id,
    first_name,
    last_name,
    reason,
    scheduled_at,
    status,
    completed_at,
    cancelled_at,
    rescheduled_at,
    created_at
  )
  values
    -- Alice: upcoming scheduled
    (
      'aaaaaaaa-aaaa-4aaa-8aaa-000000000001',
      v_alice_id,
      'Alice',
      'Chen',
      'Review quadratic functions practice exam and work through weak areas.',
      date_trunc('hour', now()) + interval '2 days' + interval '2 hours',
      'scheduled',
      null,
      null,
      null,
      now() - interval '2 days'
    ),
    -- Alice: upcoming scheduled (previously rescheduled)
    (
      'aaaaaaaa-aaaa-4aaa-8aaa-000000000002',
      v_alice_id,
      'Alice',
      'Chen',
      '1-on-1 feedback on essay structure and thesis arguments for English SAC.',
      date_trunc('hour', now()) + interval '4 days' + interval '3 hours',
      'scheduled',
      null,
      null,
      now() - interval '6 hours',
      now() - interval '3 days'
    ),
    -- Alice: completed
    (
      'aaaaaaaa-aaaa-4aaa-8aaa-000000000003',
      v_alice_id,
      'Alice',
      'Chen',
      'Clarify organic chemistry reaction pathways before lab report submission.',
      date_trunc('hour', now()) - interval '3 days',
      'completed',
      now() - interval '2 days' - interval '20 hours',
      null,
      null,
      now() - interval '7 days'
    ),
    -- Alice: cancelled
    (
      'aaaaaaaa-aaaa-4aaa-8aaa-000000000004',
      v_alice_id,
      'Alice',
      'Chen',
      'Quick homework check on trigonometric identities.',
      date_trunc('hour', now()) + interval '1 day',
      'cancelled',
      null,
      now() - interval '1 day',
      null,
      now() - interval '5 days'
    ),
    -- Bob: upcoming scheduled
    (
      'bbbbbbbb-bbbb-4bbb-8bbb-000000000001',
      v_bob_id,
      'Bob',
      'Patel',
      'Walk through calculus integration by substitution and past exam problems.',
      date_trunc('hour', now()) + interval '3 days' + interval '1 hour',
      'scheduled',
      null,
      null,
      null,
      now() - interval '1 day'
    ),
    -- Bob: completed
    (
      'bbbbbbbb-bbbb-4bbb-8bbb-000000000002',
      v_bob_id,
      'Bob',
      'Patel',
      'Physics kinematics projectile motion problem set review.',
      date_trunc('hour', now()) - interval '2 days',
      'completed',
      now() - interval '1 day' - interval '18 hours',
      null,
      null,
      now() - interval '6 days'
    )
  on conflict (id) do nothing;
end;
$$;
