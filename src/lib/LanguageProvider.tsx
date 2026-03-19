import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { VALID_LANG_VALUES } from "@/hooks/useLanguage";
import { readLangCache, writeLangCache } from "@/lib/langCache";
import { ToastProvider } from "@/components/ui/Toast";

interface LanguageReadyContextValue {
  isLanguageReady: boolean;
  userExists: boolean | null;
  lang: "en" | "zh-HK";
  userPreference: "system" | "en" | "zh-HK";
  setUserPreference: (lang: "system" | "en" | "zh-HK") => Promise<void>;
}

function detectBrowserLanguage(): "en" | "zh-HK" {
  const browserLang = navigator.language || "en";
  if (browserLang.startsWith("zh")) return "zh-HK";
  return "en";
}

const LanguageReadyContext = createContext<LanguageReadyContextValue>({
  isLanguageReady: false,
  userExists: null,
  lang: detectBrowserLanguage(),
  userPreference: "system",
  setUserPreference: async () => {},
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
  const userId = user?.id ?? null;
  const [userExists, setUserExists] = useState<boolean | null>(null);
  const [userPreference, setUserPref] = useState<"system" | "en" | "zh-HK">("system");

  // i18n.init() already resolved the correct language synchronously,
  // so we only need to wait for DB fetch when there's no cache for this user.
  const [isLanguageReady, setIsLanguageReady] = useState(() => {
    if (!user) return true;
    const cached = readLangCache(user.id);
    if (cached && VALID_LANG_VALUES.includes(cached as (typeof VALID_LANG_VALUES)[number])) {
      return true;
    }
    // No cache for this user — block rendering until DB responds
    return false;
  });

  useEffect(() => {
    async function syncLanguage() {
      if (!userId) {
        setUserExists(null);
        return;
      }

      // Fetch user's language preference and existence in a single query
      const { data } = await supabase.from("users").select("id, lang").eq("id", userId).single();

      setUserExists(data !== null);

      const raw = data?.lang;
      const validated =
        raw && VALID_LANG_VALUES.includes(raw as (typeof VALID_LANG_VALUES)[number])
          ? (raw as "system" | "en" | "zh-HK")
          : "system";
      setUserPref(validated);

      const resolvedLang = (() => {
        if (validated !== "system") return validated as "en" | "zh-HK";
        const browserLang = navigator.language;
        return browserLang.startsWith("zh") ? "zh-HK" : "en";
      })();

      // Update cache and language if different from current
      writeLangCache(userId, raw ?? "system");
      if (i18n.language !== resolvedLang) {
        await i18n.changeLanguage(resolvedLang);
      }
      setIsLanguageReady(true);
    }

    syncLanguage();
  }, [userId, i18n]);

  const lang = useMemo<"en" | "zh-HK">(() => {
    if (userPreference === "system") return detectBrowserLanguage();
    return userPreference;
  }, [userPreference]);

  // Sync i18next when lang changes (e.g. after setUserPreference)
  useEffect(() => {
    if (isLanguageReady && i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }
  }, [lang, i18n, isLanguageReady]);

  const setUserPreference = useCallback(
    async (newLang: "system" | "en" | "zh-HK") => {
      if (!userId) throw new Error("User not found");
      if (!VALID_LANG_VALUES.includes(newLang)) throw new Error("Invalid language");

      await supabase.from("users").update({ lang: newLang }).eq("id", userId);

      writeLangCache(userId, newLang);
      setUserPref(newLang);
    },
    [userId]
  );

  return (
    <LanguageReadyContext.Provider
      value={{ isLanguageReady, userExists, lang, userPreference, setUserPreference }}
    >
      <ToastProvider>{children}</ToastProvider>
    </LanguageReadyContext.Provider>
  );
}
