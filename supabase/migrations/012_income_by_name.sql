-- Get income grouped by transaction name for a date range.
-- Income transactions are never categorised, so the aggregates table (which
-- groups by category) cannot answer this; read from transactions directly and
-- bucket by the user's local month boundaries.
CREATE OR REPLACE FUNCTION get_income_by_name(
  p_user_id uuid,
  p_start_year integer,
  p_start_month integer,
  p_end_year integer,
  p_end_month integer
)
RETURNS TABLE (
  name text,
  total numeric,
  count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_offset integer;
  v_range_start bigint;
  v_range_end bigint;
BEGIN
  SELECT COALESCE(u.timezone_offset_minutes, 0) INTO v_offset
  FROM public.users u WHERE u.id = p_user_id;
  v_offset := COALESCE(v_offset, 0);

  -- Local midnight of the first day of the start month, as a UTC epoch in ms
  v_range_start :=
    (EXTRACT(EPOCH FROM make_date(p_start_year, p_start_month, 1)::timestamp) * 1000)::bigint
    - (v_offset * 60 * 1000)::bigint;

  -- Exclusive upper bound: local midnight of the first day after the end month
  v_range_end :=
    (EXTRACT(EPOCH FROM (make_date(p_end_year, p_end_month, 1) + interval '1 month')::timestamp) * 1000)::bigint
    - (v_offset * 60 * 1000)::bigint;

  RETURN QUERY
  SELECT
    NULLIF(btrim(COALESCE(tx.name, '')), ''),
    SUM(tx.amount),
    COUNT(*)::integer
  FROM public.transactions tx
  WHERE tx.user_id = p_user_id
    AND tx.type = 'income'
    AND tx.created_at >= v_range_start
    AND tx.created_at < v_range_end
  GROUP BY 1
  ORDER BY 2 DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_income_by_name(uuid, integer, integer, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_income_by_name(uuid, integer, integer, integer, integer)
  TO authenticated;
