import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "../../messages/en.json";
import zhHK from "../../messages/zh-HK.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
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
      order: ["navigator"],
      convertDetectedLanguage: (lng: string) => {
        if (lng.startsWith("zh")) return "zh-HK";
        return "en";
      },
    },
  });

export default i18n;
