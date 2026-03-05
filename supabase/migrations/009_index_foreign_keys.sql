-- Add covering indexes for foreign key columns to improve query performance.

CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON public.transactions (category_id);
CREATE INDEX IF NOT EXISTS idx_aggregates_category_id ON public.aggregates (category_id);
