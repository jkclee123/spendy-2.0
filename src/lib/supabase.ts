import { createClient } from "@supabase/supabase-js";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY environment variables"
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Read the Supabase session from localStorage synchronously.
 * Returns the cached user/session without waiting for a token refresh.
 */
export function getCachedSession(): { user: SupabaseUser; session: Session } | null {
  try {
    const ref = new URL(supabaseUrl).hostname.split(".")[0];
    const raw = localStorage.getItem(`sb-${ref}-auth-token`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.user && parsed?.access_token) {
      return { user: parsed.user, session: parsed as Session };
    }
    return null;
  } catch {
    return null;
  }
}
