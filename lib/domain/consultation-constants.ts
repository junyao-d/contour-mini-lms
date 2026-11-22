/**
 * Minimum spacing (in minutes) required between a student's active scheduled consultations.
 * Keep in sync with `public.consultation_slot_range` (+3600s) in
 * `supabase/migrations/20261121000001_initial_schema.sql`.
 */
export const MIN_CONSULTATION_GAP_MINUTES = 60;

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
