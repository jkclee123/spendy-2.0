-- USAGE: Edit the values below and run the entire script in Supabase SQL console.
--
-- DO $$
-- DECLARE
--   target_user_id uuid := 'YOUR-USER-UUID-HERE';
--   target_year    integer := 2026;
--   target_month   integer := 3;
-- BEGIN
--   PERFORM public.recompute_month_aggregates_for_user(target_user_id, target_year, target_month);
--   RAISE NOTICE 'Done recomputing aggregates for user % year % month %',
--     target_user_id, target_year, target_month;
-- END;
-- $$;

CREATE OR REPLACE FUNCTION public.recompute_month_aggregates_for_user(
  p_user_id uuid,
  p_year    integer,
  p_month   integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_timezone_offset integer;
  v_month_start     bigint;
  v_month_end       bigint;
BEGIN
  -- Look up user timezone offset, defaulting to 0 (UTC)
  SELECT COALESCE(timezone_offset_minutes, 0)
    INTO v_timezone_offset
    FROM public.users
   WHERE id = p_user_id;

  -- Calculate month boundaries in milliseconds (UTC epoch for local midnight)
  v_month_start := (EXTRACT(EPOCH FROM make_date(p_year, p_month, 1)::timestamp) * 1000)::bigint
                   - (v_timezone_offset * 60 * 1000)::bigint;

  IF p_month = 12 THEN
    v_month_end := (EXTRACT(EPOCH FROM make_date(p_year + 1, 1, 1)::timestamp) * 1000)::bigint
                   - (v_timezone_offset * 60 * 1000)::bigint;
  ELSE
    v_month_end := (EXTRACT(EPOCH FROM make_date(p_year, p_month + 1, 1)::timestamp) * 1000)::bigint
                   - (v_timezone_offset * 60 * 1000)::bigint;
  END IF;

  -- Delete all existing aggregate rows for this user/year/month
  DELETE FROM public.aggregates
  WHERE user_id = p_user_id
    AND year = p_year
    AND month = p_month;

  -- Re-insert by grouping all transactions in that month by (category_id, type)
  INSERT INTO public.aggregates (user_id, year, month, category_id, type, amount, count, created_at)
  SELECT
    p_user_id,
    p_year,
    p_month,
    category_id,
    type,
    SUM(amount),
    COUNT(*)::integer,
    (EXTRACT(EPOCH FROM now()) * 1000)::bigint
  FROM public.transactions
  WHERE user_id = p_user_id
    AND created_at >= v_month_start
    AND created_at < v_month_end
  GROUP BY category_id, type
  HAVING COUNT(*) > 0;
END;
$$;
