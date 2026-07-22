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
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db, firebaseReady } from "../firebase/config";
import { applyTheme, getStoredTheme, normalizeTheme } from "../utils/theme";

const AuthContext = createContext(null);
const LOCAL_ACCOUNT_KEY = "bill-sheet-auth-accounts";
const LOCAL_SESSION_KEY = "bill-sheet-auth-session";

const normalizePhone = (value = "") => value.replace(/\D/g, "");
const normalizeEmail = (value = "") => value.trim().toLowerCase();
const makeRandomPassword = () =>
  `${Math.random().toString(36).slice(2)}-${Math.random()
    .toString(36)
    .slice(2)}-${Math.random().toString(36).slice(2)}`;

const hashPasscode = async (passcode) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(String(passcode));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const loadLocalAccounts = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_ACCOUNT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveLocalAccounts = (accounts) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_ACCOUNT_KEY, JSON.stringify(accounts));
};

const readSessionUser = () => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeSessionUser = (user) => {
  if (typeof window === "undefined") return;
  if (user) {
    window.localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(user));
  } else {
    window.localStorage.removeItem(LOCAL_SESSION_KEY);
  }
};

const syncThemeFromSettings = async (uid) => {
  if (!uid || !firebaseReady || !db) return;
  try {
    const settingsRef = doc(db, "settings", uid);
    const snapshot = await getDoc(settingsRef);
    const firebaseTheme = snapshot.exists() ? normalizeTheme(snapshot.data()?.theme) : "";
    const storedTheme = normalizeTheme(getStoredTheme());
    if (!firebaseTheme) return;
    if (firebaseTheme !== storedTheme) {
      applyTheme(firebaseTheme);
    }
  } catch (error) {
    console.error("Unable to sync theme preference", error);
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readSessionUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseReady || !auth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, (u) => {
      if (!u) {
        setUser(null);
        writeSessionUser(null);
        setLoading(false);
        return;
      }
      const nextUser = {
        uid: u.uid,
        email: u.email,
        displayName: u.displayName || u.email?.split("@")[0] || "User",
        photoURL: u.photoURL || null,
      };
      setUser(nextUser);
      writeSessionUser(nextUser);
      void syncThemeFromSettings(u.uid);
      setLoading(false);
    });
  }, []);

  const signInWithPhoneAndPasscode = async (phone, passcode) => {
    if (!phone || !passcode) {
      throw new Error("Enter both your phone number and passcode.");
    }

    const normalizedPhone = normalizePhone(phone);
    if (!/^01\d{9}$/.test(normalizedPhone)) {
      throw new Error("Use a valid Bangladeshi phone number beginning with 01.");
    }
    if (!/^\d{6}$/.test(passcode)) {
      throw new Error("Passcode must be 6 digits.");
    }

    const passcodeHash = await hashPasscode(passcode);

    if (firebaseReady && auth && db) {
      const q = query(collection(db, "authAccounts"), where("phone", "==", normalizedPhone));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        throw new Error("No matching account was found.");
      }
      const account = snapshot.docs[0].data();
      if (account.passcodeHash !== passcodeHash) {
        throw new Error("Incorrect passcode.");
      }
      const firebaseUser = await signInWithEmailAndPassword(
        auth,
        account.email,
        account.firebasePassword,
      );
      const nextUser = {
        uid: firebaseUser.user.uid,
        email: firebaseUser.user.email,
        displayName: account.fullName || firebaseUser.user.displayName || account.email,
        photoURL: firebaseUser.user.photoURL || null,
        companyName: account.companyName || "",
        phoneNumber: normalizedPhone,
      };
      setUser(nextUser);
      writeSessionUser(nextUser);
      await syncThemeFromSettings(firebaseUser.user.uid);
      return nextUser;
    }

    const accounts = loadLocalAccounts();
    const account = accounts.find((item) => item.phone === normalizedPhone);
    if (!account) {
      throw new Error("No matching account was found.");
    }
    if (account.passcodeHash !== passcodeHash) {
      throw new Error("Incorrect passcode.");
    }

    const nextUser = {
      uid: account.uid || `local-${normalizedPhone}`,
      email: account.email,
      displayName: account.fullName || account.email,
      photoURL: null,
      companyName: account.companyName || "",
      phoneNumber: normalizedPhone,
    };
    setUser(nextUser);
    writeSessionUser(nextUser);
    return nextUser;
  };

  const registerWithPhoneAndPasscode = async (profile) => {
    const fullName = profile.fullName?.trim() || "";
    const companyName = profile.companyName?.trim() || "";
    const email = normalizeEmail(profile.email);
    const phone = normalizePhone(profile.phone);
    const passcode = String(profile.passcode || "");
    const confirmPasscode = String(profile.confirmPasscode || "");
    const dob = profile.dob || "";

    if (!fullName || !companyName || !email || !phone || !dob) {
      throw new Error("Please fill in all fields.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Enter a valid email address.");
    }
    if (!/^01\d{9}$/.test(phone)) {
      throw new Error("Use a valid Bangladeshi phone number beginning with 01.");
    }
    if (!/^(\d{4}|\d{6})$/.test(passcode)) {
      throw new Error("Passcode must be 4 or 6 digits.");
    }
    if (passcode !== confirmPasscode) {
      throw new Error("Passcodes do not match.");
    }

    const passcodeHash = await hashPasscode(passcode);
    const firebasePassword = makeRandomPassword();
    const accountRecord = {
      uid: "",
      fullName,
      companyName,
      email,
      phone,
      passcodeHash,
      firebasePassword,
      dob,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    if (firebaseReady && auth && db) {
      const existingPhoneQuery = query(collection(db, "authAccounts"), where("phone", "==", phone));
      const phoneSnapshot = await getDocs(existingPhoneQuery);
      if (!phoneSnapshot.empty) {
        throw new Error("That phone number is already registered.");
      }
      const existingEmailQuery = query(collection(db, "authAccounts"), where("email", "==", email));
      const emailSnapshot = await getDocs(existingEmailQuery);
      if (!emailSnapshot.empty) {
        throw new Error("That email address is already registered.");
      }

      const created = await createUserWithEmailAndPassword(auth, email, firebasePassword);
      accountRecord.uid = created.user.uid;
      await setDoc(doc(db, "authAccounts", created.user.uid), accountRecord);
      const nextUser = {
        uid: created.user.uid,
        email: created.user.email,
        displayName: fullName,
        photoURL: created.user.photoURL || null,
        companyName,
        phoneNumber: phone,
      };
      setUser(nextUser);
      writeSessionUser(nextUser);
      await syncThemeFromSettings(created.user.uid);
      return nextUser;
    }

    const accounts = loadLocalAccounts();
    const existing = accounts.find((item) => item.phone === phone || item.email === email);
    if (existing) {
      throw new Error("That phone number or email is already registered.");
    }
    const nextAccount = {
      ...accountRecord,
      uid: `local-${phone}`,
    };
    accounts.push(nextAccount);
    saveLocalAccounts(accounts);
    const nextUser = {
      uid: nextAccount.uid,
      email,
      displayName: fullName,
      photoURL: null,
      companyName,
      phoneNumber: phone,
    };
    setUser(nextUser);
    writeSessionUser(nextUser);
    return nextUser;
  };

  const recoverPasscode = async (phone) => {
    const normalizedPhone = normalizePhone(phone);
    if (!/^01\d{9}$/.test(normalizedPhone)) {
      throw new Error("Use a valid Bangladeshi phone number beginning with 01.");
    }

    if (firebaseReady && auth && db) {
      const q = query(collection(db, "authAccounts"), where("phone", "==", normalizedPhone));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const account = snapshot.docs[0].data();
        try {
          await sendPasswordResetEmail(auth, account.email);
        } catch {
          // Intentionally ignore network or provider issues and keep the flow generic.
        }
      }
      return { success: true };
    }

    const accounts = loadLocalAccounts();
    const account = accounts.find((item) => item.phone === normalizedPhone);
    if (account) {
      account.passcodeHash = "";
      saveLocalAccounts(accounts);
    }
    return { success: true };
  };

  const changePasscode = async ({ currentPasscode, newPasscode, confirmNewPasscode }) => {
    const trimmedCurrent = String(currentPasscode || "").trim();
    const trimmedNew = String(newPasscode || "").trim();
    const trimmedConfirm = String(confirmNewPasscode || "").trim();

    if (!trimmedCurrent) {
      throw new Error("Current passcode is required.");
    }
    if (!/^\d{4,6}$/.test(trimmedNew)) {
      throw new Error("Passcode must contain 4–6 digits.");
    }
    if (trimmedConfirm !== trimmedNew) {
      throw new Error("New passcodes do not match.");
    }
    if (trimmedNew === trimmedCurrent) {
      throw new Error("Please choose a different passcode.");
    }

    const currentHash = await hashPasscode(trimmedCurrent);
    const nextHash = await hashPasscode(trimmedNew);

    if (firebaseReady && auth && db && user?.uid) {
      const accountRef = doc(db, "authAccounts", user.uid);
      const snapshot = await getDoc(accountRef);
      const account = snapshot.exists() ? snapshot.data() : null;
      if (!account || account.passcodeHash !== currentHash) {
        throw new Error("Current passcode is incorrect.");
      }
      await updateDoc(accountRef, {
        passcodeHash: nextHash,
        lastLoginAt: new Date().toISOString(),
      });
      return true;
    }

    const accounts = loadLocalAccounts();
    const account = accounts.find((item) => item.uid === user?.uid || item.phone === user?.phoneNumber || item.email === user?.email);
    if (!account || account.passcodeHash !== currentHash) {
      throw new Error("Current passcode is incorrect.");
    }
    account.passcodeHash = nextHash;
    saveLocalAccounts(accounts);
    return true;
  };

  const value = {
    user,
    loading,
    configured: firebaseReady,
    login: signInWithPhoneAndPasscode,
    signup: registerWithPhoneAndPasscode,
    resetPassword: recoverPasscode,
    google: () =>
      firebaseReady
        ? signInWithPopup(auth, new GoogleAuthProvider())
        : Promise.reject(new Error("Firebase is not configured")),
    logout: async () => {
      if (firebaseReady && auth) {
        await signOut(auth);
      }
      setUser(null);
      writeSessionUser(null);
    },
    signInWithPhoneAndPasscode,
    registerWithPhoneAndPasscode,
    recoverPasscode,
    changePasscode,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
