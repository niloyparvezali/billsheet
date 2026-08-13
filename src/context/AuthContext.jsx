import { createContext, useContext, useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
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

const AuthContext = createContext(null);
const LOCAL_ACCOUNT_KEY = "bill-sheet-auth-accounts";
const LOCAL_SESSION_KEY = "bill-sheet-auth-session";

export const normalizePhone = (value = "") => value.replace(/\D/g, "");
const normalizeEmail = (value = "") => value.trim().toLowerCase();

export const validateEmail = (email) => {
  const normalized = normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
};

const writeSessionUser = (user) => {
  if (typeof window === "undefined") return;
  if (user) {
    window.localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(user));
  } else {
    window.localStorage.removeItem(LOCAL_SESSION_KEY);
  }
};

const readSessionUser = () => {
  if (typeof window === "undefined") return null;
  try {
    const sessionData = window.localStorage.getItem(LOCAL_SESSION_KEY);
    return sessionData ? JSON.parse(sessionData) : null;
  } catch {
    return null;
  }
};

const loadLocalAccounts = () => {
  if (typeof window === "undefined") return [];
  try {
    const data = window.localStorage.getItem(LOCAL_ACCOUNT_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const saveLocalAccounts = (accounts) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_ACCOUNT_KEY, JSON.stringify(accounts));
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
      setLoading(false);
    });
  }, []);

  const signInWithEmailAndPasscode = async (email, passcode) => {
    if (!email || !passcode) {
      throw new Error("Enter both your email address and passcode.");
    }

    const normalizedEmail = validateEmail(email);
    if (!normalizedEmail) {
      throw new Error("Enter a valid email address.");
    }
    if (!/^\d{6}$/.test(passcode)) {
      throw new Error("Passcode must be 6 digits.");
    }

    if (firebaseReady && auth && db) {
      let firebaseUser;
      try {
        const result = await signInWithEmailAndPassword(auth, normalizedEmail, passcode);
        firebaseUser = result.user;
      } catch (error) {
        if (
          error.code === "auth/user-not-found" ||
          error.code === "auth/invalid-credential" ||
          error.code === "auth/wrong-password" ||
          error.code === "auth/invalid-email"
        ) {
          throw new Error("No matching account was found, or passcode is incorrect.");
        }
        throw error;
      }

      const nextUser = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
        photoURL: firebaseUser.photoURL || null,
      };
      setUser(nextUser);
      writeSessionUser(nextUser);
      return nextUser;
    }

    // Fallback: Use localStorage for offline/unconfigured mode
    const accounts = loadLocalAccounts();
    const account = accounts.find((item) => normalizeEmail(item.email) === normalizedEmail);
    if (!account) {
      throw new Error("No matching account was found.");
    }
    
    // For offline mode, verify passcodeHash
    const encoder = new TextEncoder();
    const data = encoder.encode(String(passcode));
    const digest = await crypto.subtle.digest("SHA-256", data);
    const passcodeHash = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    
    if (account.passcodeHash !== passcodeHash) {
      throw new Error("Incorrect passcode.");
    }

    const nextUser = {
      uid: account.uid || `local-${normalizedEmail}`,
      email: normalizedEmail,
      displayName: account.fullName || normalizedEmail,
      photoURL: null,
    };
    setUser(nextUser);
    writeSessionUser(nextUser);
    return nextUser;
  };

  const registerWithEmailAndPasscode = async (profile) => {
    const fullName = profile.fullName?.trim() || "";
    const companyName = profile.companyName?.trim() || "";
    const email = validateEmail(profile.email);
    const phone = normalizePhone(profile.phone);
    const passcode = String(profile.passcode || "");
    const confirmPasscode = String(profile.confirmPasscode || "");
    const dob = profile.dob || "";

    if (!fullName || !companyName || !email || !phone || !dob) {
      throw new Error("Please fill in all fields.");
    }
    if (!/^01\d{9}$/.test(phone)) {
      throw new Error("Use a valid Bangladeshi phone number beginning with 01.");
    }
    if (!/^\d{6}$/.test(passcode)) {
      throw new Error("Passcode must be 6 digits.");
    }
    if (passcode !== confirmPasscode) {
      throw new Error("Passcodes do not match.");
    }

    const accountRecord = {
      uid: "",
      fullName,
      companyName,
      email,
      phone,
      dob,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    if (firebaseReady && auth && db) {
      let created;
      try {
        // Use the user's real email for Firebase Authentication.
        created = await createUserWithEmailAndPassword(auth, email, passcode);
      } catch (error) {
        if (error.code === "auth/email-already-in-use") {
          throw new Error("That email address is already registered.");
        }
        throw error;
      }

      accountRecord.uid = created.user.uid;

      // Now that user is authenticated, check if phone is unique in authAccounts.
      try {
        const phoneSnapshot = await getDocs(
          query(
            collection(db, "authAccounts"),
            where("phone", "==", phone)
          )
        );

        if (!phoneSnapshot.empty) {
          // Phone already exists. Delete the auth user we just created.
          await created.user.delete();
          throw new Error("That phone number is already registered.");
        }

        // Check if email is already used (in case someone registered via a different flow).
        const emailSnapshot = await getDocs(
          query(
            collection(db, "authAccounts"),
            where("email", "==", email)
          )
        );

        if (!emailSnapshot.empty) {
          // Email already exists. Delete the auth user we just created.
          await created.user.delete();
          throw new Error("That email address is already registered.");
        }
      } catch (queryError) {
        // If query fails, try to delete the auth user we created
        try {
          await created.user.delete();
        } catch {}
        throw queryError;
      }

      // All checks passed. Store account data in Firestore.
      await setDoc(doc(db, "authAccounts", created.user.uid), accountRecord);

      const nextUser = {
        uid: created.user.uid,
        email,
        displayName: fullName,
        photoURL: created.user.photoURL || null,
        companyName,
        phoneNumber: phone,
      };
      setUser(nextUser);
      writeSessionUser(nextUser);
      return nextUser;
    }

    // Fallback: Use localStorage for offline/unconfigured mode
    const accounts = loadLocalAccounts();
    const existing = accounts.find((item) => normalizeEmail(item.email) === email || item.phone === phone);
    if (existing) {
      throw new Error("That phone number or email is already registered.");
    }

    // For offline mode, store passcodeHash
    const encoder = new TextEncoder();
    const data = encoder.encode(String(passcode));
    const digest = await crypto.subtle.digest("SHA-256", data);
    const passcodeHash = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

    const nextAccount = {
      ...accountRecord,
      uid: `local-${email}`,
      passcodeHash,
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

  const recoverPasscode = async (email) => {
    const normalizedEmail = validateEmail(email);
    if (!normalizedEmail) {
      throw new Error("Enter a valid email address.");
    }

    if (firebaseReady && auth && db) {
      try {
        await sendPasswordResetEmail(auth, normalizedEmail);
      } catch (error) {
        // Ignore network/provider issues and keep flow generic
        // Firebase will silently fail if email not found (security best practice)
      }
      // Always return success to avoid revealing if account exists
      return { success: true };
    }

    // Fallback: Use localStorage
    const accounts = loadLocalAccounts();
    const account = accounts.find((item) => normalizeEmail(item.email) === normalizedEmail);
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
    if (!/^\d{6}$/.test(trimmedNew)) {
      throw new Error("Passcode must be 6 digits.");
    }
    if (trimmedConfirm !== trimmedNew) {
      throw new Error("New passcodes do not match.");
    }
    if (trimmedNew === trimmedCurrent) {
      throw new Error("Please choose a different passcode.");
    }

    if (firebaseReady && auth && user?.uid && user?.email) {
      try {
        // Verify current passcode by re-authenticating
        try {
          await signInWithEmailAndPassword(auth, user.email, trimmedCurrent);
        } catch (error) {
          if (
            error.code === "auth/user-not-found" ||
            error.code === "auth/invalid-credential" ||
            error.code === "auth/wrong-password" ||
            error.code === "auth/invalid-email"
          ) {
            throw new Error("Current passcode is incorrect.");
          }
          throw error;
        }

        // Current passcode verified. Now update to new passcode.
        await updatePassword(auth.currentUser, trimmedNew);
        
        // Update lastLoginAt timestamp
        const accountRef = doc(db, "authAccounts", user.uid);
        await updateDoc(accountRef, {
          lastLoginAt: new Date().toISOString(),
        });
        
        return true;
      } catch (error) {
        throw error;
      }
    }

    // Fallback: Use localStorage
    const accounts = loadLocalAccounts();
    const account = accounts.find((item) => item.uid === user?.uid || normalizeEmail(item.email) === normalizeEmail(user?.email));
    
    if (!account) {
      throw new Error("Account not found.");
    }

    // For offline mode, verify current passcode hash
    const encoder = new TextEncoder();
    const data = encoder.encode(String(trimmedCurrent));
    const digest = await crypto.subtle.digest("SHA-256", data);
    const currentHash = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

    if (account.passcodeHash !== currentHash) {
      throw new Error("Current passcode is incorrect.");
    }

    // Update to new passcode hash
    const newData = encoder.encode(String(trimmedNew));
    const newDigest = await crypto.subtle.digest("SHA-256", newData);
    const nextHash = Array.from(new Uint8Array(newDigest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

    account.passcodeHash = nextHash;
    saveLocalAccounts(accounts);
    return true;
  };

  const signInWithGoogle = async () => {
    if (!firebaseReady || !auth) {
      throw new Error("Firebase is not configured.");
    }

    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      const firebaseUser = result.user;
      
      // Create session user object
      const nextUser = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
        photoURL: firebaseUser.photoURL || null,
      };
      
      setUser(nextUser);
      writeSessionUser(nextUser);
      return nextUser;
    } catch (error) {
      // Handle common popup errors gracefully
      if (error.code === "auth/popup-closed-by-user") {
        throw new Error("Google sign-in was cancelled.");
      }
      if (error.code === "auth/popup-blocked") {
        throw new Error("Please enable popups for BillSheet to use Google sign-in.");
      }
      if (error.code === "auth/account-exists-with-different-credential") {
        throw new Error("An account already exists with this email address.");
      }
      throw error;
    }
  };

  const value = {
    user,
    loading,
    configured: firebaseReady,
    login: signInWithEmailAndPasscode,
    signup: registerWithEmailAndPasscode,
    resetPassword: recoverPasscode,
    signInWithGoogle,
    logout: async () => {
      if (firebaseReady && auth) {
        await signOut(auth);
      }
      setUser(null);
      writeSessionUser(null);
    },
    signInWithEmailAndPasscode,
    registerWithEmailAndPasscode,
    recoverPasscode,
    changePasscode,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
