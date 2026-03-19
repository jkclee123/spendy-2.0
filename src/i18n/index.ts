import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../../messages/en.json";
import zhHK from "../../messages/zh-HK.json";
import { readLangCache } from "@/lib/langCache";

/**
 * Resolve the correct initial language synchronously from localStorage
 * so i18next starts with the right language before React renders.
 */
function resolveInitialLanguage(): string | undefined {
  try {
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
    return undefined;
  } catch {
    return undefined;
  }
}

const initialLng = resolveInitialLanguage();

i18n.use(initReactI18next).init({
  ...(initialLng ? { lng: initialLng } : {}),
  initImmediate: false,
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
});

export default i18n;
