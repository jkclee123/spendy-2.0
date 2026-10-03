-- The browser checks the allowlist only after it has an authenticated session.
-- Signup is checked separately by the owner-executed handle_new_user trigger.
REVOKE EXECUTE ON FUNCTION public.is_email_allowed(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_email_allowed(text) TO authenticated;

-- These SECURITY DEFINER RPCs intentionally remain available to authenticated
-- clients. Migration 013 checks the caller's identity before accessing data.
-- Do not switch mutation RPCs to SECURITY INVOKER: they call aggregate helpers
-- whose EXECUTE permission is deliberately withheld from browser clients.

-- The create-transaction Edge Function calls these using the service-role key.
-- BYPASSRLS does not bypass function EXECUTE permissions.
GRANT EXECUTE ON FUNCTION public.create_transaction_from_web(
  uuid, numeric, text, uuid, text, bigint, integer
) TO service_role;
GRANT EXECUTE ON FUNCTION public.find_category_by_name(uuid, text)
  TO service_role;
