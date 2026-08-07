import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useAuth } from "./AuthContext";
import { db, firebaseReady } from "../firebase/config";
import { applyTheme, getStoredTheme, normalizeTheme } from "../utils/theme";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [theme, setTheme] = useState("midnight");
  const [ready, setReady] = useState(false);
  const lastResolvedUserRef = useRef(null);

  useEffect(() => {
    if (location.pathname === "/login") {
      applyTheme("midnight", null);
      setTheme("midnight");
      setReady(true);
      lastResolvedUserRef.current = null;
      return;
    }

    if (authLoading) return;

    const uid = user?.uid || null;
    if (lastResolvedUserRef.current === uid) {
      if (!uid && !ready) {
        setTheme("midnight");
        applyTheme("midnight", null);
        setReady(true);
      }
      return;
    }

    lastResolvedUserRef.current = uid;
    let cancelled = false;

    const resolveTheme = async () => {
      const fallbackTheme = uid ? getStoredTheme(uid) : "midnight";
      const initialTheme = normalizeTheme(fallbackTheme);

      if (!cancelled) {
        setTheme(initialTheme);
        applyTheme(initialTheme, uid);
        setReady(true);
      }

      if (!uid) {
        return;
      }

      if (!firebaseReady || !db) {
        return;
      }

      try {
        const settingsRef = doc(db, "settings", uid);
        const snapshot = await getDoc(settingsRef);
        if (cancelled) return;

        const savedTheme = snapshot.exists() ? normalizeTheme(snapshot.data()?.theme) : "";
        if (savedTheme) {
          if (!cancelled) {
            setTheme(savedTheme);
            applyTheme(savedTheme, uid);
          }
          return;
        }

        const defaultTheme = "midnight";
        if (!cancelled) {
          setTheme(defaultTheme);
          applyTheme(defaultTheme, uid);
        }
        await setDoc(settingsRef, { theme: defaultTheme }, { merge: true });
      } catch (error) {
        console.error("Unable to resolve theme preference", error);
      }
    };

    void resolveTheme();

    return () => {
      cancelled = true;
    };
  }, [authLoading, ready, user?.uid]);

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
