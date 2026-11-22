/**
 * Minimum spacing (in minutes) required between a student's active scheduled consultations.
 * Keep in sync with `public.consultation_slot_range` (+3600s) in
 * `supabase/migrations/20261121000001_initial_schema.sql`.
 */
export const MIN_CONSULTATION_GAP_MINUTES = 60;
