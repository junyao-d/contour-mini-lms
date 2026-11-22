/**
 * Session lengths a student can book. A student's scheduled sessions may not overlap;
 * longer needs are covered by booking another, back-to-back session.
 * Keep in sync with the `duration_minutes` CHECK constraint and default in
 * `supabase/migrations/20261121000001_initial_schema.sql`.
 */
export const SESSION_DURATION_OPTIONS = [15, 30, 45, 60] as const;
export type SessionDuration = (typeof SESSION_DURATION_OPTIONS)[number];
export const DEFAULT_SESSION_DURATION_MINUTES: SessionDuration = 15;

/**
 * Bookings and reschedules must fall within this many days from now.
 * Keep in sync with `guard_consultation_write` (interval '90 days') in the migration.
 */
export const MAX_BOOKING_HORIZON_DAYS = 90;

/**
 * Consultations start on this minute grid (e.g. :00, :15, :30, :45) with zero seconds.
 * Keep in sync with `guard_consultation_write` (900-second check) in the migration.
 */
export const SLOT_GRANULARITY_MINUTES = 15;

/**
 * Hours (viewer's local time) shown in the booking time picker. UI only: there is no
 * tutor availability model, so the API accepts any aligned time within the horizon.
 */
export const PICKER_DAY_START_HOUR = 8;
export const PICKER_DAY_END_HOUR = 20;
