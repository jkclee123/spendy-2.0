import { useLanguageReady } from "@/lib/LanguageProvider";

export const VALID_LANG_VALUES = ["system", "en", "zh-HK"] as const;

export interface LanguageContext {
  lang: "en" | "zh-HK";
  userPreference: "system" | "en" | "zh-HK";
  setUserPreference: (lang: "system" | "en" | "zh-HK") => Promise<void>;
  isLoading: boolean;
}

export function useLanguage(): LanguageContext {
  const { isLanguageReady, lang, userPreference, setUserPreference } = useLanguageReady();

  return {
    lang,
    userPreference,
    setUserPreference,
    isLoading: !isLanguageReady,
  };
}
