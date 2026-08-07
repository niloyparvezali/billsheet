import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useAuth } from "./AuthContext";
import { db, firebaseReady } from "../firebase/config";
import { applyTheme, getStoredTheme, initializeTheme, normalizeTheme } from "../utils/theme";

export const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") {
      return "midnight";
    }
    return normalizeTheme(getStoredTheme(null));
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const startupTheme = initializeTheme();
    setTheme(startupTheme);
    setReady(false);

    if (authLoading) {
      setReady(false);
      return;
    }

    const uid = user?.uid || null;
    let cancelled = false;

    const resolveTheme = async () => {
      setReady(false);

      if (!uid) {
        const fallbackTheme = normalizeTheme(getStoredTheme(null));
        if (!cancelled) {
          setTheme(fallbackTheme);
          applyTheme(fallbackTheme, null);
          setReady(true);
        }
        return;
      }

      if (!firebaseReady || !db) {
        const fallbackTheme = normalizeTheme(getStoredTheme(uid));
        if (!cancelled) {
          setTheme(fallbackTheme);
          applyTheme(fallbackTheme, uid);
          setReady(true);
        }
        return;
      }

      try {
        const settingsRef = doc(db, "settings", uid);
        const snapshot = await getDoc(settingsRef);
        if (cancelled) return;

        const savedTheme = snapshot.exists() && snapshot.data()?.theme
          ? normalizeTheme(snapshot.data().theme)
          : startupTheme;

        if (!cancelled) {
          setTheme(savedTheme);
          applyTheme(savedTheme, uid);
          setReady(true);
        }

        if (!snapshot.exists() || !snapshot.data()?.theme) {
          try {
            await setDoc(settingsRef, { theme: savedTheme }, { merge: true });
          } catch (error) {
            console.error("Unable to save default theme to Firebase", error);
          }
        }
      } catch (error) {
        console.error("Unable to resolve theme preference from Firebase", error);
        const fallbackTheme = normalizeTheme(getStoredTheme(uid));
        if (!cancelled) {
          setTheme(fallbackTheme);
          applyTheme(fallbackTheme, uid);
          setReady(true);
        }
      }
    };

    void resolveTheme();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  const setThemePreference = useCallback(
    async (nextTheme) => {
      const normalizedTheme = normalizeTheme(nextTheme);
      setTheme(normalizedTheme);
      applyTheme(normalizedTheme, user?.uid);

      if (!user?.uid || !firebaseReady || !db) {
        return normalizedTheme;
      }

      try {
        await setDoc(doc(db, "settings", user.uid), { theme: normalizedTheme }, { merge: true });
      } catch (error) {
        console.error("Unable to persist theme preference", error);
      }

      return normalizedTheme;
    },
    [user?.uid],
  );

  const value = useMemo(
    () => ({
      theme,
      ready,
      setThemePreference,
    }),
    [ready, setThemePreference, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

export function useThemeReady() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemeReady must be used within a ThemeProvider");
  }
  return context.ready;
}
