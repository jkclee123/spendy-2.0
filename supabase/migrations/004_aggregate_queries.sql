-- Get monthly income/expense trend for a year
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

-- Get expenses by category for a date range
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

-- Returns the current year/month in the user's stored timezone
CREATE OR REPLACE FUNCTION get_current_user_yearmonth(p_user_id uuid)
RETURNS TABLE (year integer, month integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_offset integer;
BEGIN
  SELECT COALESCE(timezone_offset_minutes, 0) INTO v_offset
  FROM public.users WHERE id = p_user_id;
  RETURN QUERY SELECT
    EXTRACT(YEAR FROM (now() + (v_offset * interval '1 minute')))::integer,
    EXTRACT(MONTH FROM (now() + (v_offset * interval '1 minute')))::integer;
END;
$$;

-- Returns the earliest year/month from the aggregates table
CREATE OR REPLACE FUNCTION get_earliest_aggregate_yearmonth(p_user_id uuid)
RETURNS TABLE (year integer, month integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT a.year, a.month FROM public.aggregates a
  WHERE a.user_id = p_user_id
  ORDER BY a.year ASC, a.month ASC LIMIT 1;
END;
$$;
