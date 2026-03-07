import { ReactNode, createContext, useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { VALID_LANG_VALUES } from "@/hooks/useLanguage";
import { ToastProvider } from "@/components/ui/Toast";

interface LanguageReadyContextValue {
  isLanguageReady: boolean;
}

const LanguageReadyContext = createContext<LanguageReadyContextValue>({ isLanguageReady: false });

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
  const hasCachedLang = !!localStorage.getItem("i18nextLng");
  const [isLanguageReady, setIsLanguageReady] = useState(hasCachedLang);

  useEffect(() => {
    async function syncLanguage() {
      if (!user) {
        setIsLanguageReady(true);
        return;
      }

      // Fetch user's language preference from Supabase
      const { data } = await supabase.from("users").select("lang").eq("id", user.id).single();

      const raw = data?.lang;
      const isValidNonSystem =
        raw &&
        raw !== "system" &&
        VALID_LANG_VALUES.includes(raw as (typeof VALID_LANG_VALUES)[number]);
      if (isValidNonSystem) {
        await i18n.changeLanguage(raw);
      } else {
        const browserLang = navigator.language;
        await i18n.changeLanguage(browserLang.startsWith("zh") ? "zh-HK" : "en");
      }

      setIsLanguageReady(true);
    }

    syncLanguage();
  }, [user, i18n]);

  return (
    <LanguageReadyContext.Provider value={{ isLanguageReady }}>
      <ToastProvider>{children}</ToastProvider>
    </LanguageReadyContext.Provider>
  );
}
