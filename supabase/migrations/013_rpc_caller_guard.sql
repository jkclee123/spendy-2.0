-- Enforce that the caller of a user-scoped RPC is actually that user.
--
-- The frontend-facing SECURITY DEFINER functions all take p_user_id and trusted
-- it, so any authenticated user could read or mutate another user's data by
-- passing a different id. Every one of them now calls assert_caller_is() first.
--
-- Signatures are unchanged, so CREATE OR REPLACE preserves the grants set up in
-- 009_secure_definer_functions.sql and no client code needs to change.
--
-- Not guarded (intentionally): recompute_category_aggregate and
-- recompute_month_aggregates_for_user, which are revoked from anon/authenticated
-- and run as internal helper / SQL-console admin calls where auth.uid() is NULL.

-- Raises unless the caller is p_user_id (or a trusted service-role caller).
CREATE OR REPLACE FUNCTION public.assert_caller_is(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_claims text;
  v_uid uuid;
BEGIN
  -- Edge Functions use the service-role key and act on behalf of a user they
  -- have already identified out of band (see supabase/functions/create-transaction),
  -- so auth.uid() is NULL on that path and the id argument is the only source.
  v_claims := NULLIF(current_setting('request.jwt.claims', true), '');
  IF v_claims IS NOT NULL AND (v_claims::jsonb ->> 'role') = 'service_role' THEN
    RETURN;
  END IF;

  v_uid := auth.uid();
  IF v_uid IS NULL OR v_uid <> p_user_id THEN
    RAISE EXCEPTION 'Forbidden: caller is not the requested user'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

-- Only ever called from inside the SECURITY DEFINER functions below, which run
-- as the function owner, so no role needs a direct grant.
REVOKE EXECUTE ON FUNCTION public.assert_caller_is(uuid)
  FROM PUBLIC, anon, authenticated;

-- ---- from 003_rpc_functions.sql ----
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
  v_stored_category_id uuid;
BEGIN
  PERFORM public.assert_caller_is(p_user_id);

  v_stored_category_id := CASE WHEN p_type = 'income' THEN NULL ELSE p_category_id END;

  -- Insert the transaction
  INSERT INTO public.transactions (user_id, name, category_id, amount, type, created_at)
  VALUES (
    p_user_id,
    p_name,
    v_stored_category_id,
    p_amount,
    p_type,
    p_created_at
  )
  RETURNING id INTO v_transaction_id;

  -- Set timezone if not yet recorded for this user
  UPDATE public.users
  SET timezone_offset_minutes = p_timezone_offset
  WHERE id = p_user_id AND timezone_offset_minutes IS NULL;

  -- Calculate year/month from the timestamp adjusted for timezone (ADD offset = local time)
  v_adjusted_ts := to_timestamp((p_created_at + (p_timezone_offset * 60 * 1000)::bigint) / 1000.0);
  v_year := EXTRACT(YEAR FROM v_adjusted_ts)::integer;
  v_month := EXTRACT(MONTH FROM v_adjusted_ts)::integer;

  -- Recompute only the affected (category_id, type) aggregate
  PERFORM public.recompute_category_aggregate(p_user_id, v_year, v_month, v_stored_category_id, p_type, p_timezone_offset);

  -- Update earliest transaction date if needed
  SELECT earliest_transaction_date INTO v_current_earliest FROM public.users WHERE id = p_user_id;
  IF v_current_earliest IS NULL OR p_created_at < v_current_earliest THEN
    UPDATE public.users SET earliest_transaction_date = p_created_at WHERE id = p_user_id;
  END IF;

  RETURN v_transaction_id;
END;
$$;

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
  v_old_category_id uuid;
  v_old_type text;
  v_new_category_id uuid;
  v_old_ts timestamp;
  v_new_ts timestamp;
  v_old_year integer;
  v_old_month integer;
  v_new_year integer;
  v_new_month integer;
BEGIN
  PERFORM public.assert_caller_is(p_user_id);

  -- Get old created_at, category_id, and type before updating
  SELECT created_at, category_id, type INTO v_old_created_at, v_old_category_id, v_old_type
  FROM public.transactions
  WHERE id = p_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  v_new_category_id := CASE WHEN p_type = 'income' THEN NULL ELSE p_category_id END;

  -- Update the transaction
  UPDATE public.transactions
  SET
    amount = p_amount,
    name = p_name,
    category_id = v_new_category_id,
    type = p_type,
    created_at = p_created_at
  WHERE id = p_id AND user_id = p_user_id;

  -- Calculate old and new year/month (ADD offset = local time)
  v_old_ts := to_timestamp((v_old_created_at + (p_timezone_offset * 60 * 1000)::bigint) / 1000.0);
  v_new_ts := to_timestamp((p_created_at + (p_timezone_offset * 60 * 1000)::bigint) / 1000.0);
  v_old_year := EXTRACT(YEAR FROM v_old_ts)::integer;
  v_old_month := EXTRACT(MONTH FROM v_old_ts)::integer;
  v_new_year := EXTRACT(YEAR FROM v_new_ts)::integer;
  v_new_month := EXTRACT(MONTH FROM v_new_ts)::integer;

  IF v_old_year = v_new_year AND v_old_month = v_new_month THEN
    -- Same month: check if (category_id, type) changed
    IF v_old_category_id IS NOT DISTINCT FROM v_new_category_id AND v_old_type = p_type THEN
      -- Same (category, type): single recompute
      PERFORM public.recompute_category_aggregate(p_user_id, v_old_year, v_old_month, v_old_category_id, v_old_type, p_timezone_offset);
    ELSE
      -- Different (category, type) in same month: recompute both old and new
      PERFORM public.recompute_category_aggregate(p_user_id, v_old_year, v_old_month, v_old_category_id, v_old_type, p_timezone_offset);
      PERFORM public.recompute_category_aggregate(p_user_id, v_new_year, v_new_month, v_new_category_id, p_type, p_timezone_offset);
    END IF;
  ELSE
    -- Different months: recompute old (category, type) in old month + new (category, type) in new month
    PERFORM public.recompute_category_aggregate(p_user_id, v_old_year, v_old_month, v_old_category_id, v_old_type, p_timezone_offset);
    PERFORM public.recompute_category_aggregate(p_user_id, v_new_year, v_new_month, v_new_category_id, p_type, p_timezone_offset);
  END IF;
END;
$$;

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
  v_category_id uuid;
  v_type text;
  v_ts timestamp;
  v_year integer;
  v_month integer;
BEGIN
  PERFORM public.assert_caller_is(p_user_id);

  -- Get created_at, category_id, and type before deleting
  SELECT created_at, category_id, type INTO v_created_at, v_category_id, v_type
  FROM public.transactions
  WHERE id = p_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  -- Delete the transaction
  DELETE FROM public.transactions WHERE id = p_id AND user_id = p_user_id;

  -- Recompute only the affected (category_id, type) aggregate
  v_ts := to_timestamp((v_created_at + (p_timezone_offset * 60 * 1000)::bigint) / 1000.0);
  v_year := EXTRACT(YEAR FROM v_ts)::integer;
  v_month := EXTRACT(MONTH FROM v_ts)::integer;
  PERFORM public.recompute_category_aggregate(p_user_id, v_year, v_month, v_category_id, v_type, p_timezone_offset);
END;
$$;

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
  PERFORM public.assert_caller_is(p_user_id);

  SELECT id INTO v_category_id
  FROM public.user_categories
  WHERE user_id = p_user_id
    AND (LOWER(en_name) = LOWER(p_name) OR LOWER(zh_name) = LOWER(p_name))
  ORDER BY created_at ASC
  LIMIT 1;

  RETURN v_category_id;
END;
$$;

-- ---- from 004_aggregate_queries.sql ----
CREATE OR REPLACE FUNCTION get_monthly_income_expense_trend(
  p_user_id uuid,
  p_year integer,
  p_category_id uuid DEFAULT NULL
)
RETURNS TABLE (
  month integer,
  income numeric,
  income_count integer,
  expense numeric,
  expense_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.assert_caller_is(p_user_id);

  IF p_category_id IS NOT NULL THEN
    -- Filter by category: query aggregates table
    RETURN QUERY
    SELECT
      a.month,
      COALESCE(SUM(CASE WHEN a.type = 'income' THEN a.amount END), 0) AS income,
      COALESCE(SUM(CASE WHEN a.type = 'income' THEN a.count END), 0)::integer AS income_count,
      COALESCE(SUM(CASE WHEN a.type = 'expense' THEN a.amount END), 0) AS expense,
      COALESCE(SUM(CASE WHEN a.type = 'expense' THEN a.count END), 0)::integer AS expense_count
    FROM public.aggregates a
    WHERE a.user_id = p_user_id
      AND a.year = p_year
      AND a.category_id = p_category_id
    GROUP BY a.month
    ORDER BY a.month;
  ELSE
    -- All categories: query aggregates table
    RETURN QUERY
    SELECT
      a.month,
      COALESCE(SUM(CASE WHEN a.type = 'income' THEN a.amount END), 0) AS income,
      COALESCE(SUM(CASE WHEN a.type = 'income' THEN a.count END), 0)::integer AS income_count,
      COALESCE(SUM(CASE WHEN a.type = 'expense' THEN a.amount END), 0) AS expense,
      COALESCE(SUM(CASE WHEN a.type = 'expense' THEN a.count END), 0)::integer AS expense_count
    FROM public.aggregates a
    WHERE a.user_id = p_user_id
      AND a.year = p_year
    GROUP BY a.month
    ORDER BY a.month;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION get_expenses_by_category(
  p_user_id uuid,
  p_start_year integer,
  p_start_month integer,
  p_end_year integer,
  p_end_month integer
)
RETURNS TABLE (
  category_id uuid,
  emoji text,
  en_name text,
  zh_name text,
  total numeric,
  count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.assert_caller_is(p_user_id);

  RETURN QUERY
  SELECT
    a.category_id,
    uc.emoji,
    uc.en_name,
    uc.zh_name,
    SUM(a.amount) AS total,
    SUM(a.count)::integer AS count
  FROM public.aggregates a
  LEFT JOIN public.user_categories uc ON uc.id = a.category_id
  WHERE a.user_id = p_user_id
    AND a.type = 'expense'
    AND (a.year > p_start_year OR (a.year = p_start_year AND a.month >= p_start_month))
    AND (a.year < p_end_year OR (a.year = p_end_year AND a.month <= p_end_month))
  GROUP BY a.category_id, uc.emoji, uc.en_name, uc.zh_name
  ORDER BY total DESC;
END;
$$;

CREATE OR REPLACE FUNCTION get_current_user_yearmonth(p_user_id uuid)
RETURNS TABLE (year integer, month integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_offset integer;
BEGIN
  PERFORM public.assert_caller_is(p_user_id);

  SELECT COALESCE(timezone_offset_minutes, 0) INTO v_offset
  FROM public.users WHERE id = p_user_id;
  RETURN QUERY SELECT
    EXTRACT(YEAR FROM (now() + (v_offset * interval '1 minute')))::integer,
    EXTRACT(MONTH FROM (now() + (v_offset * interval '1 minute')))::integer;
END;
$$;

CREATE OR REPLACE FUNCTION get_earliest_aggregate_yearmonth(p_user_id uuid)
RETURNS TABLE (year integer, month integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  PERFORM public.assert_caller_is(p_user_id);

  RETURN QUERY
  SELECT a.year, a.month FROM public.aggregates a
  WHERE a.user_id = p_user_id
  ORDER BY a.year ASC, a.month ASC LIMIT 1;
END;
$$;

-- ---- from 012_income_by_name.sql ----
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
  PERFORM public.assert_caller_is(p_user_id);

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
