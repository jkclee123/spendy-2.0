import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase, getCachedSession } from "@/lib/supabase";
import { useLanguageReady } from "@/lib/LanguageProvider";

export type AuthError = "not_allowed" | null;

interface AuthContextValue {
  user: SupabaseUser | null;
  session: Session | null;
  isLoading: boolean;
  authError: AuthError;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  isLoading: true,
  authError: null,
  clearAuthError: () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const cached = getCachedSession();
  const [user, setUser] = useState<SupabaseUser | null>(cached?.user ?? null);
  const [session, setSession] = useState<Session | null>(cached?.session ?? null);
  const [isLoading, setIsLoading] = useState(!cached);
  const [authError, setAuthError] = useState<AuthError>(null);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);

      // Enforce the email allowlist on every session, not just signup. A user
      // whose email is removed from allowed_emails still holds a valid auth.users
      // row, so the signup trigger alone would not lock them out.
      const email = session?.user?.email;
      if (!email) return;
      void supabase.rpc("is_email_allowed", { p_email: email }).then(({ data, error }) => {
        if (error || data !== false) return;
        setAuthError("not_allowed");
        void supabase.auth.signOut();
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setAuthError(null);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
  };

  const signOutHandler = async () => {
    // Clear app caches to prevent data leaking to another user
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.startsWith("spendy:txn-cache:") ||
          key.startsWith("spendy:cat-cache:") ||
          key.startsWith("spendy:lang-pref:"))
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        authError,
        clearAuthError: () => setAuthError(null),
        signInWithGoogle,
        signOut: signOutHandler,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * ProtectedRoute component that redirects to /login if not authenticated.
 * Also signs out automatically if the authenticated user has no DB record.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading, signOut } = useAuth();
  const { userExists } = useLanguageReady();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login", { replace: true, state: { from: location } });
    }
  }, [user, isLoading, navigate, location]);

  useEffect(() => {
    if (userExists === false) {
      signOut();
    }
  }, [userExists, signOut]);

  if (isLoading) {
    return null;
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
