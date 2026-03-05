-- Recompute aggregates for a given user/year/month
CREATE OR REPLACE FUNCTION recompute_month_aggregates(
  p_user_id uuid,
  p_year integer,
  p_month integer,
  p_timezone_offset integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_month_start bigint;
  v_month_end bigint;
BEGIN
  -- Calculate month boundaries in milliseconds (adjusted for timezone)
  v_month_start := (EXTRACT(EPOCH FROM make_date(p_year, p_month, 1)::timestamp) * 1000)::bigint
                   + (p_timezone_offset * 60 * 1000)::bigint;

  IF p_month = 12 THEN
    v_month_end := (EXTRACT(EPOCH FROM make_date(p_year + 1, 1, 1)::timestamp) * 1000)::bigint
                   + (p_timezone_offset * 60 * 1000)::bigint;
  ELSE
    v_month_end := (EXTRACT(EPOCH FROM make_date(p_year, p_month + 1, 1)::timestamp) * 1000)::bigint
                   + (p_timezone_offset * 60 * 1000)::bigint;
  END IF;

  -- Delete existing aggregates for this month
  DELETE FROM public.aggregates
  WHERE user_id = p_user_id AND year = p_year AND month = p_month;

  -- Re-insert aggregates computed from raw transactions
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
  GROUP BY category_id, type;
END;
$$;

-- Create transaction from web UI
CREATE OR REPLACE FUNCTION create_transaction_from_web(
  p_user_id uuid,
  p_amount numeric,
  p_name text,
  p_category_id uuid,
  p_type text,
  p_created_at bigint,
  p_timezone_offset integer DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_transaction_id uuid;
  v_year integer;
  v_month integer;
  v_adjusted_ts timestamp;
  v_current_earliest bigint;
BEGIN
  -- Insert the transaction
  INSERT INTO public.transactions (user_id, name, category_id, amount, type, created_at)
  VALUES (
    p_user_id,
    p_name,
    CASE WHEN p_type = 'income' THEN NULL ELSE p_category_id END,
    p_amount,
    p_type,
    p_created_at
  )
  RETURNING id INTO v_transaction_id;

  -- Calculate year/month from the timestamp adjusted for timezone
  v_adjusted_ts := to_timestamp((p_created_at - (p_timezone_offset * 60 * 1000)::bigint) / 1000.0);
  v_year := EXTRACT(YEAR FROM v_adjusted_ts)::integer;
  v_month := EXTRACT(MONTH FROM v_adjusted_ts)::integer;

  -- Recompute aggregates for the affected month
  PERFORM public.recompute_month_aggregates(p_user_id, v_year, v_month, p_timezone_offset);

  -- Update earliest transaction date if needed
  SELECT earliest_transaction_date INTO v_current_earliest FROM public.users WHERE id = p_user_id;
  IF v_current_earliest IS NULL OR p_created_at < v_current_earliest THEN
    UPDATE public.users SET earliest_transaction_date = p_created_at WHERE id = p_user_id;
  END IF;

  RETURN v_transaction_id;
END;
$$;

-- Update transaction
CREATE OR REPLACE FUNCTION update_transaction(
  p_id uuid,
  p_user_id uuid,
  p_amount numeric,
  p_name text,
  p_category_id uuid,
  p_type text,
  p_created_at bigint,
  p_timezone_offset integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_created_at bigint;
  v_old_ts timestamp;
  v_new_ts timestamp;
  v_old_year integer;
  v_old_month integer;
  v_new_year integer;
  v_new_month integer;
BEGIN
  -- Get old created_at for recomputing old month
  SELECT created_at INTO v_old_created_at
  FROM public.transactions
  WHERE id = p_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  -- Update the transaction
  UPDATE public.transactions
  SET
    amount = p_amount,
    name = p_name,
    category_id = CASE WHEN p_type = 'income' THEN NULL ELSE p_category_id END,
    type = p_type,
    created_at = p_created_at
  WHERE id = p_id AND user_id = p_user_id;

  -- Calculate old and new year/month
  v_old_ts := to_timestamp((v_old_created_at - (p_timezone_offset * 60 * 1000)::bigint) / 1000.0);
  v_new_ts := to_timestamp((p_created_at - (p_timezone_offset * 60 * 1000)::bigint) / 1000.0);
  v_old_year := EXTRACT(YEAR FROM v_old_ts)::integer;
  v_old_month := EXTRACT(MONTH FROM v_old_ts)::integer;
  v_new_year := EXTRACT(YEAR FROM v_new_ts)::integer;
  v_new_month := EXTRACT(MONTH FROM v_new_ts)::integer;

  -- Recompute aggregates for affected months
  PERFORM public.recompute_month_aggregates(p_user_id, v_old_year, v_old_month, p_timezone_offset);
  IF v_old_year != v_new_year OR v_old_month != v_new_month THEN
    PERFORM public.recompute_month_aggregates(p_user_id, v_new_year, v_new_month, p_timezone_offset);
  END IF;
END;
$$;

-- Delete transaction
CREATE OR REPLACE FUNCTION delete_transaction(
  p_id uuid,
  p_user_id uuid,
  p_timezone_offset integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_created_at bigint;
  v_ts timestamp;
  v_year integer;
  v_month integer;
BEGIN
  -- Get created_at before deleting
  SELECT created_at INTO v_created_at
  FROM public.transactions
  WHERE id = p_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  -- Delete the transaction
  DELETE FROM public.transactions WHERE id = p_id AND user_id = p_user_id;

  -- Recompute aggregates
  v_ts := to_timestamp((v_created_at - (p_timezone_offset * 60 * 1000)::bigint) / 1000.0);
  v_year := EXTRACT(YEAR FROM v_ts)::integer;
  v_month := EXTRACT(MONTH FROM v_ts)::integer;
  PERFORM public.recompute_month_aggregates(p_user_id, v_year, v_month, p_timezone_offset);
END;
$$;

-- Find category by name (case-insensitive search)
CREATE OR REPLACE FUNCTION find_category_by_name(
  p_user_id uuid,
  p_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_category_id uuid;
BEGIN
  SELECT id INTO v_category_id
  FROM public.user_categories
  WHERE user_id = p_user_id
    AND (LOWER(en_name) = LOWER(p_name) OR LOWER(zh_name) = LOWER(p_name))
  ORDER BY created_at ASC
  LIMIT 1;

  RETURN v_category_id;
END;
$$;
