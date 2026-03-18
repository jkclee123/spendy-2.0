import { ReactNode, createContext, useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { VALID_LANG_VALUES } from "@/hooks/useLanguage";
import { readLangCache, writeLangCache } from "@/lib/langCache";
import { ToastProvider } from "@/components/ui/Toast";

interface LanguageReadyContextValue {
  isLanguageReady: boolean;
  userExists: boolean | null;
}

const LanguageReadyContext = createContext<LanguageReadyContextValue>({
  isLanguageReady: false,
  userExists: null,
});

export function useLanguageReady() {
  return useContext(LanguageReadyContext);
}

interface LanguageProviderProps {
  children: ReactNode;
}

/**
 * Language provider that syncs user language preference with i18next
 */
export function LanguageProvider({ children }: LanguageProviderProps) {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const [userExists, setUserExists] = useState<boolean | null>(null);

  // Apply cached language synchronously on first render
  const [isLanguageReady] = useState(() => {
    if (!user) return !!localStorage.getItem("i18nextLng");
    const cached = readLangCache(user.id);
    if (
      cached &&
      cached !== "system" &&
      VALID_LANG_VALUES.includes(cached as (typeof VALID_LANG_VALUES)[number])
    ) {
      i18n.changeLanguage(cached);
      return true;
    }
    return !!localStorage.getItem("i18nextLng");
  });

  useEffect(() => {
    async function syncLanguage() {
      if (!user) {
        setUserExists(null);
        return;
      }

      // Fetch user's language preference and existence in a single query
      const { data } = await supabase.from("users").select("id, lang").eq("id", user.id).single();

      setUserExists(data !== null);

      const raw = data?.lang;
      const resolvedLang = (() => {
        const isValidNonSystem =
          raw &&
          raw !== "system" &&
          VALID_LANG_VALUES.includes(raw as (typeof VALID_LANG_VALUES)[number]);
        if (isValidNonSystem) return raw;
        const browserLang = navigator.language;
        return browserLang.startsWith("zh") ? "zh-HK" : "en";
      })();

      // Update cache and language if different from current
      writeLangCache(user.id, raw ?? "system");
      if (i18n.language !== resolvedLang) {
        await i18n.changeLanguage(resolvedLang);
      }
    }

    syncLanguage();
  }, [user, i18n]);

  return (
    <LanguageReadyContext.Provider value={{ isLanguageReady, userExists }}>
      <ToastProvider>{children}</ToastProvider>
    </LanguageReadyContext.Provider>
  );
}
