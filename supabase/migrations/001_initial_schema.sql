-- Users table (references auth.users)
CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  image text,
  lang text NOT NULL DEFAULT 'system',
  api_token text UNIQUE,
  earliest_transaction_date bigint,
  timezone_offset_minutes integer,
  created_at bigint NOT NULL
);

CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_api_token ON public.users(api_token);

-- User categories table
CREATE TABLE public.user_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  emoji text NOT NULL,
  en_name text,
  zh_name text,
  created_at bigint NOT NULL
);

CREATE INDEX idx_user_categories_user_id ON public.user_categories(user_id);
CREATE INDEX idx_user_categories_user_id_is_active ON public.user_categories(user_id, is_active);

-- Transactions table
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text,
  category_id uuid REFERENCES public.user_categories(id) ON DELETE SET NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  type text NOT NULL CHECK (type IN ('expense', 'income')),
  created_at bigint NOT NULL
);

CREATE INDEX idx_transactions_user_id_created_at ON public.transactions(user_id, created_at DESC);
CREATE INDEX idx_transactions_user_id_category_id ON public.transactions(user_id, category_id);
CREATE INDEX idx_transactions_category_id ON public.transactions(category_id);

-- Aggregates table (pre-computed monthly summaries)
CREATE TABLE public.aggregates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL,
  category_id uuid REFERENCES public.user_categories(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('expense', 'income')),
  amount numeric NOT NULL,
  count integer NOT NULL,
  created_at bigint NOT NULL
);

CREATE INDEX idx_aggregates_user_id_year_month ON public.aggregates(user_id, year, month);
CREATE INDEX idx_aggregates_user_id_year_month_type ON public.aggregates(user_id, year, month, type);
CREATE INDEX idx_aggregates_user_id_category_id ON public.aggregates(user_id, category_id);
CREATE INDEX idx_aggregates_category_id ON public.aggregates(category_id);

-- Files table (for iOS shortcut downloads)
CREATE TABLE public.files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL
);
