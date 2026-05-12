-- Lock down SECURITY DEFINER functions: revoke default PUBLIC EXECUTE
-- and grant only to roles that actually call each function.
-- Resolves database linter warnings 0028 and 0029.

-- ---- Drop stale functions left in production DB (not in any migration) ----
DROP FUNCTION IF EXISTS public.recompute_month_aggregates(uuid, integer, integer, integer);
DROP FUNCTION IF EXISTS public.recompute_previous_month_for_all_users();

-- ---- Internal helper: no external caller ----
REVOKE EXECUTE ON FUNCTION public.recompute_category_aggregate(uuid, integer, integer, uuid, text, integer)
  FROM PUBLIC, anon, authenticated;

-- ---- Trigger function: fires from on_auth_user_created, no RPC access needed ----
REVOKE EXECUTE ON FUNCTION public.handle_new_user()
  FROM PUBLIC, anon, authenticated;

-- ---- Manual admin function: run from SQL console as superuser only ----
REVOKE EXECUTE ON FUNCTION public.recompute_month_aggregates_for_user(uuid, integer, integer)
  FROM PUBLIC, anon, authenticated;

-- ---- Frontend-facing RPCs: authenticated users only ----
REVOKE EXECUTE ON FUNCTION public.create_transaction_from_web(uuid, numeric, text, uuid, text, bigint, integer)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.create_transaction_from_web(uuid, numeric, text, uuid, text, bigint, integer)
  TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_transaction(uuid, uuid, numeric, text, uuid, text, bigint, integer)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.update_transaction(uuid, uuid, numeric, text, uuid, text, bigint, integer)
  TO authenticated;

REVOKE EXECUTE ON FUNCTION public.delete_transaction(uuid, uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.delete_transaction(uuid, uuid, integer)
  TO authenticated;

-- find_category_by_name is also called from the create-transaction Edge Function
-- via service_role, which bypasses role grants entirely. Only the frontend path
-- needs an explicit grant.
REVOKE EXECUTE ON FUNCTION public.find_category_by_name(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.find_category_by_name(uuid, text)
  TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_current_user_yearmonth(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_current_user_yearmonth(uuid)
  TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_earliest_aggregate_yearmonth(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_earliest_aggregate_yearmonth(uuid)
  TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_expenses_by_category(uuid, integer, integer, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_expenses_by_category(uuid, integer, integer, integer, integer)
  TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_monthly_income_expense_trend(uuid, integer, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_monthly_income_expense_trend(uuid, integer, uuid)
  TO authenticated;
