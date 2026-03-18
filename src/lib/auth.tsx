import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase, getCachedSession } from "@/lib/supabase";
import { useLanguageReady } from "@/lib/LanguageProvider";

interface AuthContextValue {
  user: SupabaseUser | null;
  session: Session | null;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  isLoading: true,
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

  useEffect(() => {
    // Background token refresh — updates state if session changed or expired
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // Listen for auth changes (TOKEN_REFRESHED, SIGNED_OUT, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
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
