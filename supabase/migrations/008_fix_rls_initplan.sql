-- Fix auth RLS init plan warnings: wrap auth.uid() in subquery so it's
-- evaluated once per query, not once per row.

-- public.users
DROP POLICY IF EXISTS "users_select_own" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;

CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (id = (select auth.uid()));

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (id = (select auth.uid()));

-- public.user_categories
DROP POLICY IF EXISTS "user_categories_select_own" ON public.user_categories;
DROP POLICY IF EXISTS "user_categories_insert_own" ON public.user_categories;
DROP POLICY IF EXISTS "user_categories_update_own" ON public.user_categories;
DROP POLICY IF EXISTS "user_categories_delete_own" ON public.user_categories;

CREATE POLICY "user_categories_select_own" ON public.user_categories
  FOR SELECT USING (user_id = (select auth.uid()));

CREATE POLICY "user_categories_insert_own" ON public.user_categories
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "user_categories_update_own" ON public.user_categories
  FOR UPDATE USING (user_id = (select auth.uid()));

CREATE POLICY "user_categories_delete_own" ON public.user_categories
  FOR DELETE USING (user_id = (select auth.uid()));

-- public.transactions
DROP POLICY IF EXISTS "transactions_select_own" ON public.transactions;
DROP POLICY IF EXISTS "transactions_insert_own" ON public.transactions;
DROP POLICY IF EXISTS "transactions_update_own" ON public.transactions;
DROP POLICY IF EXISTS "transactions_delete_own" ON public.transactions;

CREATE POLICY "transactions_select_own" ON public.transactions
  FOR SELECT USING (user_id = (select auth.uid()));

CREATE POLICY "transactions_insert_own" ON public.transactions
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "transactions_update_own" ON public.transactions
  FOR UPDATE USING (user_id = (select auth.uid()));

CREATE POLICY "transactions_delete_own" ON public.transactions
  FOR DELETE USING (user_id = (select auth.uid()));

-- public.aggregates
DROP POLICY IF EXISTS "aggregates_select_own" ON public.aggregates;
DROP POLICY IF EXISTS "aggregates_insert_own" ON public.aggregates;
DROP POLICY IF EXISTS "aggregates_update_own" ON public.aggregates;
DROP POLICY IF EXISTS "aggregates_delete_own" ON public.aggregates;

CREATE POLICY "aggregates_select_own" ON public.aggregates
  FOR SELECT USING (user_id = (select auth.uid()));

CREATE POLICY "aggregates_insert_own" ON public.aggregates
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "aggregates_update_own" ON public.aggregates
  FOR UPDATE USING (user_id = (select auth.uid()));

CREATE POLICY "aggregates_delete_own" ON public.aggregates
  FOR DELETE USING (user_id = (select auth.uid()));
