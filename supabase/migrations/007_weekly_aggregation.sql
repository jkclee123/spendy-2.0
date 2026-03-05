-- Weekly aggregation job using pg_cron
-- Runs every Monday at 2 AM UTC to recompute previous month aggregates for all users

-- Enable pg_cron extension (must be enabled in Supabase Dashboard under Extensions)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Helper function: recompute previous month aggregates for all users
CREATE OR REPLACE FUNCTION recompute_previous_month_for_all_users()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_record RECORD;
  target_year integer;
  target_month integer;
BEGIN
  -- Calculate previous month
  target_year := EXTRACT(YEAR FROM (now() - INTERVAL '1 month'))::integer;
  target_month := EXTRACT(MONTH FROM (now() - INTERVAL '1 month'))::integer;

  -- Recompute for each user
  FOR user_record IN SELECT id, timezone_offset_minutes FROM public.users LOOP
    PERFORM public.recompute_month_aggregates(
      user_record.id,
      target_year,
      target_month,
      COALESCE(user_record.timezone_offset_minutes, 0)
    );
  END LOOP;
END;
$$;

-- Schedule weekly aggregation: every Monday at 2 AM UTC
-- Uncomment the following after enabling pg_cron extension:
-- SELECT cron.schedule(
--   'weekly-aggregation',
--   '0 2 * * 1',
--   'SELECT recompute_previous_month_for_all_users()'
-- );
