import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "../../messages/en.json";
import zhHK from "../../messages/zh-HK.json";
import { readLangCache } from "@/lib/langCache";

/**
 * Resolve the correct initial language synchronously from localStorage
 * so i18next starts with the right language before React renders.
 */
function resolveInitialLanguage(): string | undefined {
  try {
    // Try to get userId from cached Supabase auth token
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (supabaseUrl) {
      const ref = new URL(supabaseUrl).hostname.split(".")[0];
      const raw = localStorage.getItem(`sb-${ref}-auth-token`);
      if (raw) {
        const userId = JSON.parse(raw)?.user?.id;
        if (userId) {
          const langPref = readLangCache(userId);
          if (langPref === "en" || langPref === "zh-HK") return langPref;
          if (langPref === "system") {
            return navigator.language?.startsWith("zh") ? "zh-HK" : "en";
          }
        }
      }
    }
    // Fall back to i18nextLng from localStorage
    const stored = localStorage.getItem("i18nextLng");
    if (stored === "en" || stored === "zh-HK") return stored;
    return undefined;
  } catch {
    return undefined;
  }
}

const initialLng = resolveInitialLanguage();

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    ...(initialLng ? { lng: initialLng } : {}),
    resources: {
      en: en,
      "zh-HK": zhHK,
    },
    fallbackLng: "en",
    ns: ["common", "charts", "settings", "categories", "transactions", "nav"],
    defaultNS: "common",
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      convertDetectedLanguage: (lng: string) => {
        if (lng.startsWith("zh")) return "zh-HK";
        return "en";
      },
    },
  });

export default i18n;
