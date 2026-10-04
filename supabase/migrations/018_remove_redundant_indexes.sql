BEGIN;

-- Fail rather than wait on locks while removing these small redundant indexes.
SET LOCAL lock_timeout = '5s';

-- Email uniqueness and lookups remain covered by users_email_key.
DROP INDEX IF EXISTS public.idx_users_email;

-- The retained composite indexes cover these leading-column lookups.
DROP INDEX IF EXISTS public.idx_user_categories_user_id;
DROP INDEX IF EXISTS public.idx_aggregates_user_id_year_month;

COMMIT;
