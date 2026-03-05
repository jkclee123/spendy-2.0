-- Re-apply updated handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_now bigint := (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
BEGIN
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
