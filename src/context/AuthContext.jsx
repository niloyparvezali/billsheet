import { createContext, useContext, useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth, firebaseReady } from "../firebase/config";
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!firebaseReady) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);
  const value = {
    user,
    loading,
    configured: firebaseReady,
    login: (email, password) =>
      firebaseReady
        ? signInWithEmailAndPassword(auth, email, password)
        : Promise.reject(new Error("Firebase is not configured")),
    signup: (email, password) =>
      firebaseReady
        ? createUserWithEmailAndPassword(auth, email, password)
        : Promise.reject(new Error("Firebase is not configured")),
    resetPassword: (email) =>
      firebaseReady
        ? sendPasswordResetEmail(auth, email)
        : Promise.reject(new Error("Firebase is not configured")),
    google: () =>
      firebaseReady
        ? signInWithPopup(auth, new GoogleAuthProvider())
        : Promise.reject(new Error("Firebase is not configured")),
    logout: () =>
      firebaseReady ? signOut(auth) : Promise.resolve(),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
