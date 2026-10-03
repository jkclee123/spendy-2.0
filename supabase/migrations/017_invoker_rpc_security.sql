BEGIN;

-- Keep the explicit identity check as well as RLS. The service-role Edge
-- Function may act on behalf of users, but browser callers may not.
ALTER FUNCTION public.assert_caller_is(uuid) SECURITY INVOKER;
GRANT EXECUTE ON FUNCTION public.assert_caller_is(uuid) TO authenticated, service_role;

-- Aggregate maintenance now has exactly the caller's table permissions. These
-- tables already have owner-scoped write policies; no privileged helper or new
-- bypass-RLS path is needed for the transaction RPCs.
CREATE OR REPLACE FUNCTION public.recompute_category_aggregate(
  p_user_id uuid,
  p_year integer,
  p_month integer,
  p_category_id uuid,
  p_type text,
  p_timezone_offset integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_month_start bigint;
  v_month_end bigint;
BEGIN
  PERFORM public.assert_caller_is(p_user_id);
  v_month_start := (EXTRACT(EPOCH FROM make_date(p_year, p_month, 1)::timestamp) * 1000)::bigint
    - (p_timezone_offset::bigint * 60000);
  v_month_end := (EXTRACT(EPOCH FROM (make_date(p_year, p_month, 1) + interval '1 month')::timestamp) * 1000)::bigint
    - (p_timezone_offset::bigint * 60000);

  DELETE FROM public.aggregates
  WHERE user_id = p_user_id AND year = p_year AND month = p_month
    AND category_id IS NOT DISTINCT FROM p_category_id AND type = p_type;

  INSERT INTO public.aggregates (user_id, year, month, category_id, type, amount, count, created_at)
  SELECT p_user_id, p_year, p_month, p_category_id, p_type,
    SUM(amount), COUNT(*)::integer, (EXTRACT(EPOCH FROM now()) * 1000)::bigint
  FROM public.transactions
  WHERE user_id = p_user_id AND created_at >= v_month_start AND created_at < v_month_end
    AND category_id IS NOT DISTINCT FROM p_category_id AND type = p_type
  HAVING COUNT(*) > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recompute_category_aggregate(uuid, integer, integer, uuid, text, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recompute_category_aggregate(uuid, integer, integer, uuid, text, integer)
  TO authenticated, service_role;

ALTER FUNCTION public.create_transaction_from_web(uuid, numeric, text, uuid, text, bigint, integer) SECURITY INVOKER;
ALTER FUNCTION public.update_transaction(uuid, uuid, numeric, text, uuid, text, bigint, integer) SECURITY INVOKER;
ALTER FUNCTION public.delete_transaction(uuid, uuid, integer) SECURITY INVOKER;
ALTER FUNCTION public.find_category_by_name(uuid, text) SECURITY INVOKER;
ALTER FUNCTION public.get_current_user_yearmonth(uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_earliest_aggregate_yearmonth(uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_expenses_by_category(uuid, integer, integer, integer, integer) SECURITY INVOKER;
ALTER FUNCTION public.get_income_by_name(uuid, integer, integer, integer, integer) SECURITY INVOKER;
ALTER FUNCTION public.get_income_by_category(uuid, integer, integer, integer, integer) SECURITY INVOKER;
ALTER FUNCTION public.get_monthly_income_expense_trend(uuid, integer, uuid) SECURITY INVOKER;

-- Explicit table privileges for invoker RPCs, still constrained by existing RLS.
GRANT SELECT, UPDATE ON public.users TO authenticated;
GRANT SELECT ON public.user_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions, public.aggregates TO authenticated;
GRANT SELECT, UPDATE ON public.users TO service_role;
GRANT SELECT ON public.user_categories TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions, public.aggregates TO service_role;

-- A signed-in user may inspect only their own allowlist membership, never probe
-- arbitrary emails. handle_new_user remains SECURITY DEFINER, so its invoker
-- lookup runs as the trigger owner and can still validate new signup emails.
-- The previous deployment may have committed SQL before migration bookkeeping
-- failed on the concurrently allocated version 016. Allow a safe reapplication.
DROP POLICY IF EXISTS allowed_emails_select_own ON public.allowed_emails;
CREATE POLICY allowed_emails_select_own ON public.allowed_emails
  FOR SELECT TO authenticated
  USING (normalized_email = lower(trim((SELECT auth.jwt()) ->> 'email')));
REVOKE ALL ON public.allowed_emails FROM PUBLIC, anon, authenticated;
GRANT SELECT (normalized_email) ON public.allowed_emails TO authenticated;
ALTER FUNCTION public.is_email_allowed(text) SECURITY INVOKER;
ALTER FUNCTION public.is_email_allowed(text) SET search_path = '';

COMMIT;
