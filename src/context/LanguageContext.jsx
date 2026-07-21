import { createContext, useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { doc, getDoc, setDoc } from "firebase/firestore";
import i18n from "../i18n";
import { db, firebaseReady } from "../firebase/config";
import { useAuth } from "./AuthContext";
import {
  formatMoneyByLang,
  formatNumberByLang,
  toBengaliNumerals,
  translateMonth,
  translateStatus,
} from "../utils/i18nHelpers";

const LanguageContext = createContext(null);
const LOCAL_STORAGE_KEY = "bill-sheet-language";

export function LanguageProvider({ children }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [language, setLanguageState] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved === "bn" || saved === "en") return saved;
    }
    return i18n.language || "en";
  });

  const changeLanguage = async (nextLang) => {
    if (nextLang !== "en" && nextLang !== "bn") return;
    setLanguageState(nextLang);
    void i18n.changeLanguage(nextLang);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, nextLang);
    }

    if (user?.uid && firebaseReady && db) {
      try {
        await setDoc(
          doc(db, "settings", user.uid),
          { language: nextLang },
          { merge: true }
        );
      } catch (error) {
        console.error("Failed to save language preference to Firestore", error);
      }
    }
  };

  // Sync language from Firestore when user logs in
  useEffect(() => {
    if (!user?.uid) {
      return;
    }

    let isMounted = true;
    async function loadSavedLanguage() {
      if (!firebaseReady || !db) return;
      try {
        const settingsRef = doc(db, "settings", user.uid);
        const snapshot = await getDoc(settingsRef);
        if (snapshot.exists()) {
          const savedLang = snapshot.data()?.language;
          if ((savedLang === "en" || savedLang === "bn") && isMounted) {
            setLanguageState(savedLang);
            void i18n.changeLanguage(savedLang);
            if (typeof window !== "undefined") {
              window.localStorage.setItem(LOCAL_STORAGE_KEY, savedLang);
            }
            return;
          }
        }
        // If no language has been saved for this user, default to English
        if (isMounted) {
          setLanguageState("en");
          void i18n.changeLanguage("en");
          if (typeof window !== "undefined") {
            window.localStorage.setItem(LOCAL_STORAGE_KEY, "en");
          }
        }
      } catch (error) {
        console.error("Failed to load language from Firestore", error);
      }
    }

    void loadSavedLanguage();

    return () => {
      isMounted = false;
    };
  }, [user?.uid]);

  const value = {
    language,
    changeLanguage,
    t,
    formatNumber: (num) => formatNumberByLang(num, language),
    formatMoney: (amount) => formatMoneyByLang(amount, language),
    translateStatus: (status) => translateStatus(status, language),
    translateMonth: (month) => translateMonth(month, language),
    toBengaliNumerals: (str) => (language === "bn" ? toBengaliNumerals(str) : str),
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
