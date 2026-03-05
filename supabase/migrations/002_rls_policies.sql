-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- Users: can only read/update their own row
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (id = (select auth.uid()));

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (id = (select auth.uid()));

-- User categories: filtered by user_id
CREATE POLICY "user_categories_select_own" ON public.user_categories
  FOR SELECT USING (user_id = (select auth.uid()));

CREATE POLICY "user_categories_insert_own" ON public.user_categories
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "user_categories_update_own" ON public.user_categories
  FOR UPDATE USING (user_id = (select auth.uid()));

CREATE POLICY "user_categories_delete_own" ON public.user_categories
  FOR DELETE USING (user_id = (select auth.uid()));

-- Transactions: filtered by user_id
CREATE POLICY "transactions_select_own" ON public.transactions
  FOR SELECT USING (user_id = (select auth.uid()));

CREATE POLICY "transactions_insert_own" ON public.transactions
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "transactions_update_own" ON public.transactions
  FOR UPDATE USING (user_id = (select auth.uid()));

CREATE POLICY "transactions_delete_own" ON public.transactions
  FOR DELETE USING (user_id = (select auth.uid()));

-- Aggregates: filtered by user_id
CREATE POLICY "aggregates_select_own" ON public.aggregates
  FOR SELECT USING (user_id = (select auth.uid()));

CREATE POLICY "aggregates_insert_own" ON public.aggregates
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "aggregates_update_own" ON public.aggregates
  FOR UPDATE USING (user_id = (select auth.uid()));

CREATE POLICY "aggregates_delete_own" ON public.aggregates
  FOR DELETE USING (user_id = (select auth.uid()));

-- Files: public read access
CREATE POLICY "files_select_public" ON public.files
  FOR SELECT USING (true);
