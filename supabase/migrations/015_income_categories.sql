BEGIN;

ALTER TABLE public.user_categories
  ADD COLUMN type text NOT NULL DEFAULT 'expense'
  CHECK (type IN ('expense', 'income'));

-- Validate direct writes as well as SECURITY DEFINER RPC writes. The row lock
-- serializes category edits with assignments so concurrent writes cannot leave
-- a transaction referencing a category of a different type or owner.
CREATE FUNCTION public.validate_transaction_category()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_category public.user_categories%ROWTYPE;
BEGIN
  IF NEW.category_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_category FROM public.user_categories
  WHERE id = NEW.category_id FOR SHARE;
  IF NOT FOUND OR v_category.user_id <> NEW.user_id OR v_category.type <> NEW.type THEN
    RAISE EXCEPTION 'Category must belong to the transaction user and match its type'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_transaction_category()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER validate_transaction_category
BEFORE INSERT OR UPDATE OF category_id, user_id, type ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.validate_transaction_category();

-- Preserve historical transaction types; only detach incompatible categories.
-- Use the existing monthly rebuild helper, including the user's stored offset.
CREATE FUNCTION public.detach_incompatible_category_transactions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_month record;
BEGIN
  IF OLD.type IS NOT DISTINCT FROM NEW.type AND OLD.user_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  FOR v_month IN
    WITH detached AS (
      UPDATE public.transactions
      SET category_id = NULL
      WHERE category_id = NEW.id
        AND (type <> NEW.type OR user_id <> NEW.user_id)
      RETURNING user_id, created_at
    )
    SELECT DISTINCT d.user_id,
      EXTRACT(YEAR FROM to_timestamp((d.created_at +
        (COALESCE(u.timezone_offset_minutes, 0)::bigint * 60000)) / 1000.0))::integer AS year,
      EXTRACT(MONTH FROM to_timestamp((d.created_at +
        (COALESCE(u.timezone_offset_minutes, 0)::bigint * 60000)) / 1000.0))::integer AS month
    FROM detached d JOIN public.users u ON u.id = d.user_id
  LOOP
    PERFORM public.recompute_month_aggregates_for_user(v_month.user_id, v_month.year, v_month.month);
  END LOOP;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.detach_incompatible_category_transactions()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER detach_incompatible_category_transactions
AFTER UPDATE OF type, user_id ON public.user_categories
FOR EACH ROW EXECUTE FUNCTION public.detach_incompatible_category_transactions();

-- Keep the signatures, caller guards, SECURITY DEFINER and empty search_path
-- from 013. CREATE OR REPLACE also preserves the existing EXECUTE grants (014).
CREATE OR REPLACE FUNCTION public.create_transaction_from_web(
  p_user_id uuid, p_amount numeric, p_name text, p_category_id uuid,
  p_type text, p_created_at bigint, p_timezone_offset integer DEFAULT 0
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
  PERFORM public.assert_caller_is(p_user_id);
  INSERT INTO public.transactions (user_id, name, category_id, amount, type, created_at)
  VALUES (p_user_id, p_name, p_category_id, p_amount, p_type, p_created_at)
  RETURNING id INTO v_transaction_id;

  UPDATE public.users SET timezone_offset_minutes = p_timezone_offset
  WHERE id = p_user_id AND timezone_offset_minutes IS NULL;

  v_adjusted_ts := to_timestamp((p_created_at + (p_timezone_offset * 60 * 1000)::bigint) / 1000.0);
  v_year := EXTRACT(YEAR FROM v_adjusted_ts)::integer;
  v_month := EXTRACT(MONTH FROM v_adjusted_ts)::integer;
  PERFORM public.recompute_category_aggregate(p_user_id, v_year, v_month, p_category_id, p_type, p_timezone_offset);

  SELECT earliest_transaction_date INTO v_current_earliest FROM public.users WHERE id = p_user_id;
  IF v_current_earliest IS NULL OR p_created_at < v_current_earliest THEN
    UPDATE public.users SET earliest_transaction_date = p_created_at WHERE id = p_user_id;
  END IF;
  RETURN v_transaction_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_transaction(
  p_id uuid, p_user_id uuid, p_amount numeric, p_name text, p_category_id uuid,
  p_type text, p_created_at bigint, p_timezone_offset integer DEFAULT 0
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
  v_old_ts timestamp;
  v_new_ts timestamp;
  v_old_year integer;
  v_old_month integer;
  v_new_year integer;
  v_new_month integer;
BEGIN
  PERFORM public.assert_caller_is(p_user_id);
  SELECT created_at, category_id, type INTO v_old_created_at, v_old_category_id, v_old_type
  FROM public.transactions WHERE id = p_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  UPDATE public.transactions SET amount = p_amount, name = p_name,
    category_id = p_category_id, type = p_type, created_at = p_created_at
  WHERE id = p_id AND user_id = p_user_id;

  v_old_ts := to_timestamp((v_old_created_at + (p_timezone_offset * 60 * 1000)::bigint) / 1000.0);
  v_new_ts := to_timestamp((p_created_at + (p_timezone_offset * 60 * 1000)::bigint) / 1000.0);
  v_old_year := EXTRACT(YEAR FROM v_old_ts)::integer;
  v_old_month := EXTRACT(MONTH FROM v_old_ts)::integer;
  v_new_year := EXTRACT(YEAR FROM v_new_ts)::integer;
  v_new_month := EXTRACT(MONTH FROM v_new_ts)::integer;

  PERFORM public.recompute_category_aggregate(p_user_id, v_old_year, v_old_month, v_old_category_id, v_old_type, p_timezone_offset);
  IF v_old_year <> v_new_year OR v_old_month <> v_new_month
    OR v_old_category_id IS DISTINCT FROM p_category_id OR v_old_type <> p_type THEN
    PERFORM public.recompute_category_aggregate(p_user_id, v_new_year, v_new_month, p_category_id, p_type, p_timezone_offset);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.find_category_by_name(p_user_id uuid, p_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_category_id uuid;
BEGIN
  PERFORM public.assert_caller_is(p_user_id);
  SELECT id INTO v_category_id FROM public.user_categories
  WHERE user_id = p_user_id AND type = 'expense'
    AND (LOWER(en_name) = LOWER(p_name) OR LOWER(zh_name) = LOWER(p_name))
  ORDER BY created_at ASC LIMIT 1;
  RETURN v_category_id;
END;
$$;

COMMIT;
