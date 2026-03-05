-- Rate limiting table for external API tokens
-- Tracks request counts within sliding time windows
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_token text NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  window_start bigint NOT NULL,
  updated_at bigint NOT NULL DEFAULT EXTRACT(EPOCH FROM now()) * 1000
);

CREATE INDEX IF NOT EXISTS rate_limits_api_token_idx ON public.rate_limits (api_token);

-- Enable RLS with no policies: blocks all client access while service role (Edge Functions) bypasses RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
