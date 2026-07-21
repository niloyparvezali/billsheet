import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../locales/en.json";
import bn from "../locales/bn.json";

const getSavedLanguage = () => {
  if (typeof window !== "undefined") {
    const saved = window.localStorage.getItem("bill-sheet-language");
    if (saved === "bn" || saved === "en") return saved;
  }
  return "en";
};

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    bn: { translation: bn },
  },
  lng: getSavedLanguage(),
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
