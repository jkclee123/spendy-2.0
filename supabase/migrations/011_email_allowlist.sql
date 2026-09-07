-- Email allowlist: only emails present in this table may sign up / sign in.

CREATE TABLE public.allowed_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  normalized_email text NOT NULL UNIQUE,
  created_at bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint
);

CREATE INDEX idx_allowed_emails_normalized_email ON public.allowed_emails(normalized_email);

-- No policies: the table is unreachable from anon/authenticated clients.
-- Manage entries from the SQL console or with the service_role key.
ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

-- Seed the existing users so nobody currently signed in gets locked out.
INSERT INTO public.allowed_emails (email, normalized_email)
SELECT email, lower(trim(email)) FROM public.users
ON CONFLICT (normalized_email) DO NOTHING;

INSERT INTO public.allowed_emails (email, normalized_email)
VALUES ('jkclee123@gmail.com', 'jkclee123@gmail.com')
ON CONFLICT (normalized_email) DO NOTHING;

-- Allowlist lookup. SECURITY DEFINER so callers never touch the table itself.
CREATE OR REPLACE FUNCTION public.is_email_allowed(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.allowed_emails
    WHERE normalized_email = lower(trim(p_email))
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_email_allowed(text) FROM PUBLIC;
-- anon needs it too: the check runs right after the OAuth redirect.
GRANT EXECUTE ON FUNCTION public.is_email_allowed(text) TO anon, authenticated;

-- Gate signup at the source: reject the auth.users insert for unlisted emails.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_now bigint := (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
BEGIN
  IF NEW.email IS NULL OR NOT public.is_email_allowed(NEW.email) THEN
    RAISE EXCEPTION 'email_not_allowed: % is not on the allowlist', COALESCE(NEW.email, '(none)')
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Create user profile
  INSERT INTO public.users (id, name, email, image, api_token, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'User'),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url',
    encode(gen_random_bytes(32), 'base64'),
    v_now
  );

  -- Insert default categories
  INSERT INTO public.user_categories (user_id, emoji, en_name, zh_name, created_at)
  VALUES
    (NEW.id, '🍗', 'Restaurant', '食飯', v_now),
    (NEW.id, '🚃', 'Transport', '搭車', v_now + 1);

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
