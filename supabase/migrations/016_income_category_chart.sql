-- Income category charts use the same guarded aggregate breakdown as expenses.
CREATE OR REPLACE FUNCTION public.get_income_by_category(
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
    AND a.type = 'income'
    AND (a.year > p_start_year OR (a.year = p_start_year AND a.month >= p_start_month))
    AND (a.year < p_end_year OR (a.year = p_end_year AND a.month <= p_end_month))
  GROUP BY a.category_id, uc.emoji, uc.en_name, uc.zh_name
  ORDER BY total DESC;
END;
$$;

-- Frontend-only RPC: service_role grants in 014 are for Edge Function mutations.
REVOKE EXECUTE ON FUNCTION public.get_income_by_category(uuid, integer, integer, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_income_by_category(uuid, integer, integer, integer, integer)
  TO authenticated;
