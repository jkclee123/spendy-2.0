import { useCallback, useMemo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { writeLangCache } from "@/lib/langCache";

export const VALID_LANG_VALUES = ["system", "en", "zh-HK"] as const;
type LangPreference = (typeof VALID_LANG_VALUES)[number];

export interface LanguageContext {
  lang: "en" | "zh-HK";
  userPreference: "system" | "en" | "zh-HK";
  setUserPreference: (lang: "system" | "en" | "zh-HK") => Promise<void>;
  isLoading: boolean;
}

function detectBrowserLanguage(): "en" | "zh-HK" {
  const browserLang = navigator.language || "en";
  if (browserLang.startsWith("zh")) return "zh-HK";
  return "en";
}

export function useLanguage(): LanguageContext {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const [userPreference, setUserPref] = useState<"system" | "en" | "zh-HK">("system");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchPreference() {
      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data } = await supabase.from("users").select("lang").eq("id", user.id).single();

      if (data?.lang) {
        const raw = data.lang;
        const validated = VALID_LANG_VALUES.includes(raw as LangPreference)
          ? (raw as LangPreference)
          : "system";
        setUserPref(validated);
      }
      setIsLoading(false);
    }

    fetchPreference();
  }, [user]);

  const lang = useMemo(() => {
    if (userPreference === "system") return detectBrowserLanguage();
    return userPreference as "en" | "zh-HK";
  }, [userPreference]);

  // Sync i18next language when lang changes
  useEffect(() => {
    if (!isLoading && i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }
  }, [lang, i18n, isLoading]);

  const setUserPreference = useCallback(
    async (newLang: "system" | "en" | "zh-HK") => {
      if (!user) throw new Error("User not found");
      if (!VALID_LANG_VALUES.includes(newLang)) throw new Error("Invalid language");

      await supabase.from("users").update({ lang: newLang }).eq("id", user.id);

      writeLangCache(user.id, newLang);
      setUserPref(newLang);
    },
    [user]
  );

  return {
    lang,
    userPreference,
    setUserPreference,
    isLoading,
  };
}
