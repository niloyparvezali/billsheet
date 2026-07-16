import QRCode from "react-qr-code";
import {
  EmailAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
  sendEmailVerification,
  updateEmail,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiActivity,
  FiBell,
  FiBookOpen,
  FiCamera,
  FiCheck,
  FiCloud,
  FiCopy,
  FiDatabase,
  FiDownload,
  FiEdit2,
  FiFileText,
  FiGlobe,
  FiHelpCircle,
  FiKey,
  FiLayout,
  FiLogOut,
  FiMonitor,
  FiRefreshCw,
  FiSettings,
  FiShare2,
  FiMessageCircle,
  FiShield,
  FiSmartphone,
  FiTrash2,
  FiUploadCloud,
  FiUser,
  FiUsers,
} from "react-icons/fi";
import toast from "react-hot-toast";
import { db, storage } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import useOwnedCollection from "../hooks/useOwnedCollection";
import Modal from "../components/Modal";
import ConfirmModal from "../components/ConfirmModal";
import AppGuide from "../components/AppGuide";
import { money } from "../utils/date";
import { exportCsv, exportExcel, exportPdf } from "../utils/exports";
import { useUnsavedChanges } from "../context/UnsavedChangesContext";

const Card = ({ icon: Icon, title, subtitle, children, className = "" }) => (
  <motion.section
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className={`settings-card ${className}`}
  >
    <div className="settings-card-head">
      <span className="settings-card-icon">
        <Icon />
      </span>
      <div>
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </div>
    {children}
  </motion.section>
);
const Toggle = ({ checked, onChange }) => (
  <button
    type="button"
    className={`toggle ${checked ? "on" : ""}`}
    aria-pressed={checked}
    onClick={() => onChange(!checked)}
  >
    <span />
  </button>
);
const Choice = ({ label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`settings-choice ${active ? "active" : ""}`}
  >
    {active && <FiCheck />}
    {label}
  </button>
);
const normalizeTimestamps = (value) => {
  if (Array.isArray(value)) return value.map(normalizeTimestamps);
  if (value && typeof value === "object") {
    if (
      Number.isFinite(Number(value.seconds)) &&
      Number.isFinite(Number(value.nanoseconds))
    )
      return new Timestamp(Number(value.seconds), Number(value.nanoseconds));
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        normalizeTimestamps(item),
      ]),
    );
  }
  return value;
};

const safeParse = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

function AnimatedNumber({ value, prefix = "" }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const end = Number(value) || 0;
    const start = performance.now();
    const timer = requestAnimationFrame(function tick(now) {
      const progress = Math.min(1, (now - start) / 650);
      setShown(Math.round(end * progress));
      if (progress < 1) requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(timer);
  }, [value]);
  return (
    <>
      {prefix}
      {shown.toLocaleString()}
    </>
  );
}

export default function Settings() {
  const { hasUnsavedChanges, setHasUnsavedChanges } =
    useUnsavedChanges(); /*addbyme*/
  const { user, logout } = useAuth();
  const restoreInput = useRef(null);
  const photoInput = useRef(null);
  const nameInput = useRef(null);
  const { data: users } = useOwnedCollection("users");
  const { data: payments } = useOwnedCollection("payments");
  const { data: categories } = useOwnedCollection("categories");
  const [profile, setProfile] = useState({
    name: user?.displayName || "",
    email: user?.email || "",
    company: user?.companyName || "",
    photoURL: user?.photoURL || "",
  });
  const [accountProfile, setAccountProfile] = useState({
    fullName: user?.displayName || user?.fullName || "",
    companyName: user?.companyName || "",
    email: user?.email || "",
    phoneNumber: user?.phoneNumber || "",
    dob: "",
    createdAt: user?.createdAt || "",
    uid: user?.uid || "",
    status: "Active",
    authMethod: user?.authMethod || "Phone + Passcode",
    lastLoginAt: user?.lastLoginAt || "",
  });
  const [password, setPassword] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isProfileEditing, setIsProfileEditing] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [preferences, setPreferences] = useState(() =>
    safeParse(localStorage.settingsPreferences, {
      email: true,
      billing: true,
      payment: true,
      report: false,
      weekly: false,
      updates: true,
      joined: true,
    }),
  );
  const [danger, setDanger] = useState(null);
  const [dangerText, setDangerText] = useState("");
  const [loginSessions, setLoginSessions] = useState([]);
  const [confirmAction, setConfirmAction] = useState(null);
  const [smsTemplate, setSmsTemplate] = useState(
    "Dear {name}, your monthly bill is {bill}. Please pay by {duedate}. Thank you.",
  );
  const totalCollections = useMemo(
    () =>
      payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    [payments],
  );
  const totalBills = useMemo(
    () =>
      users.reduce((sum, member) => sum + Number(member.monthlyBill || 0), 0),
    [users],
  );
  const initials = (accountProfile.fullName || accountProfile.email || user?.displayName || user?.email || "A")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "U";
  const formatDateValue = (value) => {
    if (!value) return "Not available";
    if (typeof value?.toDate === "function") {
      return value.toDate().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not available";
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };
  const formatDateTimeValue = (value) => {
    if (!value) return "Not available";
    if (typeof value?.toDate === "function") {
      return value.toDate().toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not available";
    return date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  const memberSince = formatDateValue(accountProfile.createdAt);
  const lastLogin = formatDateTimeValue(accountProfile.lastLoginAt);
  useEffect(() => {
    setProfile((current) => ({
      ...current,
      name: user?.displayName || current.name || "",
      email: user?.email || current.email || "",
      company: user?.companyName || current.company || "",
      photoURL: user?.photoURL || current.photoURL || "",
    }));
  }, [user?.displayName, user?.email, user?.companyName, user?.photoURL]);

  useEffect(() => {
    const load = async () => {
      if (!user || !db) return;
      try {
        const saved = await getDoc(doc(db, "settings", user.uid));
        if (saved.exists()) {
          const data = saved.data();
          if (data.profile)
            setProfile((current) => ({ ...current, ...data.profile }));
          if (data.preferences) setPreferences(data.preferences);
          if (typeof data.smsTemplate === "string")
            setSmsTemplate(data.smsTemplate);
        }
        const accountSnap = await getDoc(doc(db, "authAccounts", user.uid));
        if (accountSnap.exists()) {
          const data = accountSnap.data();
          setAccountProfile({
            fullName: data.fullName || user.displayName || "",
            companyName: data.companyName || user.companyName || "",
            email: data.email || user.email || "",
            phoneNumber: data.phone || user.phoneNumber || "",
            dob: data.dob || "",
            createdAt: data.createdAt || user.createdAt || "",
            uid: data.uid || user.uid || "",
            status: "Active",
            authMethod: "Phone + Passcode",
            lastLoginAt: data.lastLoginAt || user.lastLoginAt || "",
          });
        } else {
          setAccountProfile((current) => ({
            ...current,
            fullName: user.displayName || current.fullName || "",
            companyName: user.companyName || current.companyName || "",
            email: user.email || current.email || "",
            phoneNumber: user.phoneNumber || current.phoneNumber || "",
            uid: user.uid || current.uid || "",
          }));
        }
      } catch (error) {
        console.warn("Could not load settings", error);
      }
    };
    load();
  }, [user?.uid, user?.displayName, user?.companyName, user?.email, user?.phoneNumber, user?.createdAt, user?.lastLoginAt]);
  useEffect(() => {
    if (isProfileEditing) nameInput.current?.focus();
  }, [isProfileEditing]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const setPreference = (key, value) => {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    localStorage.settingsPreferences = JSON.stringify(next);

    setHasUnsavedChanges(true);
  };
  const saveChanges = async () => {
    try {
      if (!profile.name.trim() || !profile.email.trim()) {
        toast.error("Name and email are required");
        return false;
      }
      if (!user) {
        toast.error("Please sign in again to save settings");
        return false;
      }
      if (profile.email !== user.email) {
        const current = window.prompt(
          "Enter your current password to change your email address",
        );
        if (!current) return false;
        await reauthenticateWithCredential(
          user,
          EmailAuthProvider.credential(user.email, current),
        );
        await updateEmail(user, profile.email.trim());
        await sendEmailVerification(user);
        toast.success("Verification email sent to your new address");
      }
      if (user) await updateProfile(user, { displayName: profile.name.trim() });
      const saved = {
        profile,
        preferences,
        smsTemplate,
        updatedAt: new Date().toISOString(),
      };
      localStorage.settingsPreferences = JSON.stringify(preferences);
      if (db && user)
        await setDoc(doc(db, "settings", user.uid), saved, { merge: true });
      toast.success("Settings saved across your devices");
      setHasUnsavedChanges(false);
      return true;
    } catch (error) {
      toast.error(
        error.code === "auth/requires-recent-login"
          ? "Please sign in again before changing your email"
          : error.message,
      );
      return false;
    }
  };
  const toggleProfileEditing = async () => {
    if (!isProfileEditing) return setIsProfileEditing(true);
    if (await saveChanges()) setIsProfileEditing(false);
  };
  const savePassword = async (event) => {
    event.preventDefault();
    if (!user)
      return toast.error("Please sign in again to update your password");
    if (password.next !== password.confirm)
      return toast.error("New passwords do not match");
    if (password.next.length < 6)
      return toast.error("Password must contain at least 6 characters");
    if (!password.current) return toast.error("Enter your current password");
    try {
      const credential = EmailAuthProvider.credential(
        user.email,
        password.current,
      );
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, password.next);
      setPassword({ current: "", next: "", confirm: "" });
      toast.success("Password updated");
    } catch (error) {
      toast.error(
        error.code === "auth/wrong-password"
          ? "Current password is incorrect"
          : "Password update failed. Sign in again and try once more.",
      );
    }
  };
  const changePhoto = async (event) => {
    const file = event?.target?.files?.[0];
    if (!file) return photoInput.current?.click();
    if (!storage || !user)
      return toast.error("Firebase Storage is not configured");
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024)
      return toast.error("Use an image smaller than 5 MB");
    try {
      const fileRef = ref(
        storage,
        `profiles/${user.uid}/avatar-${Date.now()}-${file.name}`,
      );
      await uploadBytes(fileRef, file);
      const photoURL = await getDownloadURL(fileRef);
      await updateProfile(user, { photoURL });
      const nextProfile = { ...profile, photoURL };
      setProfile(nextProfile);
      await setDoc(
        doc(db, "settings", user.uid),
        { profile: nextProfile, photoURL },
        { merge: true },
      );
      toast.success("Profile photo uploaded");
    } catch (error) {
      toast.error(
        error.code === "storage/unauthorized"
          ? "Photo upload is blocked. Enable Firebase Storage and deploy storage.rules."
          : error.message || "Photo upload failed. Please try again.",
      );
    } finally {
      event.target.value = "";
    }
  };
  const records = payments.map((payment) => ({
    Name: payment.userName || "Customer",
    Month: payment.month,
    Year: payment.year,
    Amount: Number(payment.amount || 0),
    Due: Number(payment.due || 0),
    Status: payment.status || "pending",
  }));
  const downloadBackup = () => {
    const backup = {
      version: 1,
      createdAt: new Date().toISOString(),
      users,
      categories,
      payments,
    };
    const blob = new Blob([JSON.stringify(backup)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `billsheet-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success("Backup downloaded");
  };
  const normalizeString = (value) =>
    String(value || "")
      .trim()
      .toLowerCase();

  const makeUserKey = (user) =>
    [
      normalizeString(user.name),
      normalizeString(user.phone),
      normalizeString(user.category),
    ].join("|");

  const makeCategoryKey = (category) => normalizeString(category.name);

  const makePaymentKey = (payment) =>
    [normalizeString(payment.userName), payment.month, payment.year].join("|");

  const removeCollection = async (name) => {
    if (!db || !user) return;
    const snapshot = await getDocs(
      query(collection(db, name), where("ownerId", "==", user.uid)),
    );
    for (let i = 0; i < snapshot.docs.length; i += 400) {
      const batch = writeBatch(db);
      snapshot.docs.slice(i, i + 400).forEach((item) => batch.delete(item.ref));
      await batch.commit();
    }
  };
  const confirmDanger = async () => {
    if (dangerText !== "DELETE") return toast.error("Type DELETE to confirm");
    try {
      if (danger === "Delete All Bills") await removeCollection("payments");
      if (danger === "Remove All Users") await removeCollection("users");
      if (danger === "Reset Database") {
        await Promise.all(
          ["payments", "users", "categories"].map(removeCollection),
        );
        if (user)
          await setDoc(doc(db, "settings", user.uid), {
            profile: {
              name: user.displayName || "Administrator",
              email: user.email || "",
              company: "BillSheet",
            },
            preferences: { monthlyReport: false },
            theme: "light",
          });
      }
      if (danger === "Logout current device") await logout();
      if (danger === "Delete Account") await deleteUser(user);
      toast.success(`${danger} completed`);
      setDanger(null);
      setDangerText("");
    } catch (error) {
      toast.error(
        error.code === "auth/requires-recent-login"
          ? "Please sign in again before completing this action"
          : error.message,
      );
    }
  };
  const APP_URL = "https://billsheet-net.vercel.app/";

  const getBrowserName = (userAgent = "") => {
    if (/Edg\//.test(userAgent)) return "Edge";
    if (/Chrome\//.test(userAgent)) return "Chrome";
    if (/Firefox\//.test(userAgent)) return "Firefox";
    if (/Safari\//.test(userAgent) && !/Chrome\//.test(userAgent)) return "Safari";
    return "Browser";
  };
  const getOsName = (userAgent = "") => {
    if (/Windows/.test(userAgent)) return "Windows";
    if (/Mac OS X/.test(userAgent)) return "macOS";
    if (/Android/.test(userAgent)) return "Android";
    if (/iPhone|iPad|iPod/.test(userAgent)) return "iOS";
    return "Unknown";
  };
  const getDeviceName = (userAgent = "") => {
    if (/iPhone|iPad|iPod/.test(userAgent)) return "iPhone";
    if (/Android/.test(userAgent)) return "Android";
    if (/Mac OS X/.test(userAgent)) return "MacBook";
    if (/Windows/.test(userAgent)) return "Windows PC";
    return "Desktop";
  };
  const formatRelativeTime = (value) => {
    if (!value) return "Just now";
    const source = value?.toDate ? value.toDate() : new Date(value);
    const diffMs = Date.now() - source.getTime();
    const minutes = Math.max(1, Math.floor(diffMs / 60000));
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  };
  const formatSessionTimestamp = (value) => {
    if (!value) return "Not available";
    const source = value?.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(source.getTime())) return "Not available";
    return source.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  const buildSessionPayload = async (currentDevice = true) => {
    if (!user?.uid || !db) return null;
    const userAgent = navigator.userAgent || "";
    const { city = "", country = "", ip = "" } = await fetch("https://ipapi.co/json/")
      .then((response) => (response.ok ? response.json() : {}))
      .catch(() => ({}));
    const locationLabel = [city, country].filter(Boolean).join(", ");
    const deviceFingerprint = [
      getDeviceName(userAgent),
      getBrowserName(userAgent),
      getOsName(userAgent),
      userAgent,
    ]
      .filter(Boolean)
      .join("|");
    return {
      userId: user.uid,
      deviceName: getDeviceName(userAgent),
      browser: getBrowserName(userAgent),
      operatingSystem: getOsName(userAgent),
      deviceFingerprint,
      loginTime: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      ipAddress: ip || "",
      city: city || "",
      country: country || "",
      locationLabel: locationLabel || "Location unavailable",
      userAgent,
      currentDevice,
    };
  };
  const ensureCurrentSession = async () => {
    if (!user?.uid || !db) return;
    const existingSessionId = sessionStorage.getItem("bill-sheet-current-session-id");
    const payload = await buildSessionPayload(true);
    if (!payload) return;
    if (existingSessionId) {
      try {
        await updateDoc(doc(db, "loginSessions", existingSessionId), {
          ...payload,
          lastActiveAt: new Date().toISOString(),
        });
        return;
      } catch {
        sessionStorage.removeItem("bill-sheet-current-session-id");
      }
    }

    const existingMatches = await getDocs(
      query(collection(db, "loginSessions"), where("userId", "==", user.uid)),
    );
    const sameDeviceSession = existingMatches.docs.find((item) => {
      const data = item.data();
      return data.deviceFingerprint === payload.deviceFingerprint;
    });

    if (sameDeviceSession) {
      const sessionId = sameDeviceSession.id;
      await updateDoc(doc(db, "loginSessions", sessionId), {
        ...payload,
        lastActiveAt: new Date().toISOString(),
      });
      sessionStorage.setItem("bill-sheet-current-session-id", sessionId);
      return;
    }

    const created = await addDoc(collection(db, "loginSessions"), {
      ...payload,
      userId: user.uid,
    });
    sessionStorage.setItem("bill-sheet-current-session-id", created.id);
  };
  const refreshSessionActivity = async () => {
    const sessionId = sessionStorage.getItem("bill-sheet-current-session-id");
    if (!sessionId || !db || !user?.uid) return;
    try {
      await updateDoc(doc(db, "loginSessions", sessionId), {
        lastActiveAt: new Date().toISOString(),
      });
    } catch {
      // Ignore transient failures while the session is active.
    }
  };
  const removeSession = async (sessionId, keepCurrent = false) => {
    if (!db || !sessionId) return;
    const currentId = sessionStorage.getItem("bill-sheet-current-session-id");
    if (sessionId === currentId && !keepCurrent) {
      await deleteDoc(doc(db, "loginSessions", sessionId));
      sessionStorage.removeItem("bill-sheet-current-session-id");
      await logout();
      return;
    }
    await deleteDoc(doc(db, "loginSessions", sessionId));
  };
  const signOutAllOtherDevices = async () => {
    if (!db || !user?.uid) return;
    const currentId = sessionStorage.getItem("bill-sheet-current-session-id");
    const snapshot = await getDocs(
      query(collection(db, "loginSessions"), where("userId", "==", user.uid)),
    );
    const removals = snapshot.docs
      .filter((item) => item.id !== currentId)
      .map((item) => deleteDoc(item.ref));
    await Promise.all(removals);
    setConfirmAction(null);
  };

  useEffect(() => {
    if (!user?.uid || !db) return;
    ensureCurrentSession();
    const interval = window.setInterval(() => {
      refreshSessionActivity();
    }, 60000);
    return () => window.clearInterval(interval);
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid || !db) return;
    const unsubscribe = onSnapshot(
      query(collection(db, "loginSessions"), where("userId", "==", user.uid)),
      (snapshot) => {
        const sessions = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setLoginSessions(sessions);
      },
    );
    return () => unsubscribe();
  }, [user?.uid]);

  const shareApp = async () => {
    const shareData = {
      title: "BillSheet",
      text: "Manage your monthly billing easily with BillSheet.",
      url: APP_URL,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(APP_URL);
        toast.success("Website link copied.");
      } else {
        window.prompt("Copy this link", APP_URL);
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        toast.error("Unable to share.");
      }
    }
  };
  const restoreBackup = async (event) => {
    const file = event.target.files?.[0];

    if (!file || !db || !user) return;

    try {
      const backup = JSON.parse(await file.text());

      if (!Array.isArray(backup.users) || !Array.isArray(backup.payments)) {
        throw new Error("Invalid BillSheet backup file");
      }

      const existingUsersSnap = await getDocs(
        query(collection(db, "users"), where("ownerId", "==", user.uid)),
      );

      const existingCategoriesSnap = await getDocs(
        query(collection(db, "categories"), where("ownerId", "==", user.uid)),
      );

      const existingPaymentsSnap = await getDocs(
        query(collection(db, "payments"), where("ownerId", "==", user.uid)),
      );

      const existingUsers = new Map();

      existingUsersSnap.forEach((docSnap) => {
        existingUsers.set(makeUserKey(docSnap.data()), {
          id: docSnap.id,
          ...docSnap.data(),
        });
      });

      const existingCategories = new Map();

      existingCategoriesSnap.forEach((docSnap) => {
        existingCategories.set(makeCategoryKey(docSnap.data()), {
          id: docSnap.id,
          ...docSnap.data(),
        });
      });

      const existingPayments = new Map();

      existingPaymentsSnap.forEach((docSnap) => {
        existingPayments.set(makePaymentKey(docSnap.data()), {
          id: docSnap.id,
          ...docSnap.data(),
        });
      });

      let addedUsers = 0;
      let updatedUsers = 0;

      for (const backupUser of backup.users) {
        const key = makeUserKey(backupUser);

        const existing = existingUsers.get(key);

        const { id, ...data } = backupUser;

        const normalized = normalizeTimestamps(data);

        // Transfer ownership to the current account
        normalized.ownerId = user.uid;

        if (existing) {
          await setDoc(doc(db, "users", existing.id), normalized, {
            merge: true,
          });

          updatedUsers++;
        } else {
          const newId = id || doc(collection(db, "users")).id;

          await setDoc(doc(db, "users", newId), normalized);

          existingUsers.set(key, {
            id: newId,
            ...normalized,
          });

          addedUsers++;
        }
      }

      toast.success(
        `Users Restored\n\nAdded: ${addedUsers}\nUpdated: ${updatedUsers}`,
      );

      toast.success("Backup loaded successfully.");
    } catch (error) {
      toast.error(error.message || "Restore failed.");
    } finally {
      event.target.value = "";
    }
  };

  const copyLink = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(APP_URL);
        toast.success("Website link copied.");
      } else {
        window.prompt("Copy this link", APP_URL);
      }
    } catch {
      toast.error("Unable to copy link.");
    }
  };

  return (
    <div className="page settings-page">
      {hasUnsavedChanges && (
        <div className="unsaved-banner">
          <div className="unsaved-banner-text">
            <span className="dot"></span>
            <span>Before leaving, apply your changes.</span>
          </div>

          <div className="unsaved-banner-actions">
            <button className="btn btn-primary" onClick={saveChanges}>
              Save
            </button>

            <button
              className="btn btn-secondary"
              onClick={() => window.location.reload()}
            >
              Discard
            </button>
          </div>
        </div>
      )}
      <div className="settings-hero">
        <div>
          <span className="eyebrow">
            <FiSettings /> Workspace settings
          </span>
          <h2>Settings</h2>
          <p>
            Manage your profile, security, appearance, notifications, and
            application preferences.
          </p>
        </div>
      </div>

      <div className="settings-grid profile-security">
        <Card
          icon={FiUser}
          title="Profile"
          subtitle="Registration details and account overview"
        >
          <div className="profile-shell">
            <div className="profile-card">
              <div className="profile-card-header">
                <div className="profile-avatar">{initials}</div>
                <div className="profile-card-summary">
                  <div className="profile-card-title-row">
                    <h4>{accountProfile.fullName || "User"}</h4>
                    <span className="profile-status-badge">Active</span>
                  </div>
                </div>
              </div>
              <div className="profile-card-divider" />
              <div className="profile-card-info">
                <div>
                  <span>Full Name</span>
                  <strong>{accountProfile.fullName || "Not available"}</strong>
                </div>
                <div>
                  <span>Company Name</span>
                  <strong>{accountProfile.companyName || "Not available"}</strong>
                </div>
                <div>
                  <span>Email Address</span>
                  <strong>{accountProfile.email || "Not available"}</strong>
                </div>
                <div>
                  <span>Phone Number</span>
                  <strong>{accountProfile.phoneNumber || "Not available"}</strong>
                </div>
              </div>
            </div>
            <div className="account-info-grid">
              <div className="account-info-item">
                <span>Date of Birth</span>
                <strong>{accountProfile.dob || "Not available"}</strong>
              </div>
              <div className="account-info-item">
                <span>Member Since</span>
                <strong>{memberSince}</strong>
              </div>
              <div className="account-info-item">
                <span>Last Login</span>
                <strong>{lastLogin}</strong>
              </div>
            </div>
          </div>
        </Card>
        <Card
          icon={FiShield}
          title="Security"
          subtitle="Keep your passcode secure"
        >
          <form className="security-form" onSubmit={savePassword}>
            {[
              ["Current passcode", "current"],
              ["New passcode", "next"],
              ["Confirm passcode", "confirm"],
            ].map(([label, key]) => (
              <label key={key}>
                {label}
                <div className="password-input">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password[key]}
                    onChange={(e) =>
                      setPassword({ ...password, [key]: e.target.value })
                    }
                    required={key !== "current"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </label>
            ))}
            <button className="btn btn-primary">
              <FiKey /> Update Passcode
            </button>
          </form>
          <div className="security-row">
            <div>
              <b>Two Factor Authentication</b>
              <span>
                Coming soon. More security options will be added here.
              </span>
            </div>
            <button type="button" className="btn btn-secondary" disabled>
              Coming soon
            </button>
          </div>
          <small className="muted-line">
            Last passcode changed: {memberSince}
          </small>
        </Card>
      </div>

      <div className="settings-grid triple">
        <Card
          icon={FiMonitor}
          title="Where You're Logged In"
          subtitle="Manage the devices currently signed in to your account."
        >
          <div className="session-list">
            {loginSessions.length === 0 ? (
              <div className="session-empty">Loading sessions…</div>
            ) : (
              loginSessions
                .slice()
                .sort((left, right) => {
                  if (left.currentDevice) return -1;
                  if (right.currentDevice) return 1;
                  return new Date(right.lastActiveAt || right.loginTime || 0) - new Date(left.lastActiveAt || left.loginTime || 0);
                })
                .map((session) => {
                  const isCurrent = Boolean(session.currentDevice);
                  return (
                    <div className="session-item" key={session.id}>
                      <div className="session-item-head">
                        <div className="session-icon-wrap">
                          {session.operatingSystem?.includes("iOS") || session.deviceName?.includes("iPhone") ? (
                            <FiSmartphone />
                          ) : session.deviceName?.includes("Mac") ? (
                            <FiMonitor />
                          ) : (
                            <FiMonitor />
                          )}
                        </div>
                        <div className="session-item-main">
                          <div className="session-item-title-row">
                            <b>{session.deviceName || "Device"}</b>
                            {isCurrent ? (
                              <span className="session-badge">
                                <span className="session-dot" /> This Device
                              </span>
                            ) : null}
                          </div>
                          <div className="session-meta">
                            <span>{session.browser || "Browser"} • {session.operatingSystem || "OS"}</span>
                          </div>
                          <div className="session-meta secondary">
                            <span>{session.locationLabel || [session.city, session.country].filter(Boolean).join(", ") || "Location unavailable"}</span>
                          </div>
                          <div className="session-meta secondary">
                            <span>Last active {formatRelativeTime(session.lastActiveAt || session.loginTime)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="session-stats">
                        <div>
                          <span>Login time</span>
                          <strong>{formatSessionTimestamp(session.loginTime)}</strong>
                        </div>
                        <div>
                          <span>Last active</span>
                          <strong>{formatSessionTimestamp(session.lastActiveAt || session.loginTime)}</strong>
                        </div>
                      </div>
                      <div className="session-actions">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            if (isCurrent) {
                              setConfirmAction({ type: "signout-current", sessionId: session.id });
                              return;
                            }
                            removeSession(session.id);
                          }}
                        >
                          {isCurrent ? "Sign out" : "Remove session"}
                        </button>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
          <button
            type="button"
            className="btn btn-secondary full-width"
            onClick={() => setConfirmAction({ type: "signout-others" })}
          >
            <FiLogOut /> Sign out of all other devices
          </button>
        </Card>
        <Card
          icon={FiLayout}
          title="Appearance"
          subtitle="Current workspace appearance"
        >
          <p className="setting-label">Theme settings</p>
          <div className="choice-row">
            <button type="button" className="theme-card active">
              <span
                className="theme-color"
                style={{ background: "#0a6a64" }}
              />
              <div className="theme-info">
                <div className="theme-title">Teal</div>
                <div className="theme-subtitle">Calm & Aesthetic</div>
              </div>
            </button>
          </div>
        </Card>
        <Card
          icon={FiBell}
          title="Notifications"
          subtitle="Automated monthly reporting"
        >
          <div className="toggle-list">
            <div>
              <span>Monthly Summary Report</span>
              <Toggle
                checked={preferences.monthlyReport || false}
                onChange={(value) => setPreference("monthlyReport", value)}
              />
            </div>
          </div>
          <small className="muted-line">
            This saves your preference. To send emails, deploy a scheduled Cloud
            Function that checks this setting and runs on the first day of each
            month.
          </small>
        </Card>
      </div>

      <div className="settings-grid">
        <Card
          icon={FiMessageCircle}
          title="SMS Template"
          subtitle="Personalize the message prepared for each customer"
        >
          <label className="sms-template-field">
            Message
            <textarea
              value={smsTemplate}
              onChange={(event) => {
                setSmsTemplate(event.target.value);
                setHasUnsavedChanges(true);
              }}
              placeholder="Write your SMS message"
              rows={4}
            />
          </label>
          <small className="muted-line">
            Available placeholders: <b>{"{name}"}</b>, <b>{"{bill}"}</b>, and{" "}
            <b>{"{duedate}"}</b>. Use Save Changes to apply this template.
          </small>
        </Card>
      </div>

      <div className="settings-grid triple">
        <Card
          icon={FiDatabase}
          title="Data & Backup"
          subtitle="Your workspace data"
        >
          <div className="data-status">
            <span>
              <FiCheck /> Firebase Connected
            </span>
            <span>Last backup: Downloadable JSON backup</span>
            <span>Storage used: 0.8 MB</span>
          </div>
          <input
            ref={restoreInput}
            className="restore-input"
            type="file"
            accept="application/json"
            onChange={restoreBackup}
          />
          <div className="backup-actions">
            <button
              type="button"
              className="backup-item"
              disabled={!payments.length}
              onClick={() => exportCsv(records, "billsheet-payments")}
            >
              <FiDownload />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              className="backup-item"
              disabled={!payments.length}
              onClick={() => exportExcel(records, "billsheet-payments")}
            >
              <FiDownload />
              <span>Export Excel</span>
            </button>

            <button
              className="backup-item"
              disabled={!payments.length}
              onClick={() => exportPdf(records, "billsheet-payments")}
            >
              <FiFileText />
              <span>Export PDF</span>
            </button>

            <button className="backup-item" onClick={downloadBackup}>
              <FiCloud />
              <span>Backup Now</span>
            </button>

            <button
              className="backup-item"
              onClick={() => restoreInput.current?.click()}
            >
              <FiRefreshCw />
              <span>Restore Backup</span>
            </button>
          </div>
        </Card>
        <Card
          icon={FiGlobe}
          title="Share BillSheet"
          subtitle="Open BillSheet from any device or share it with others."
        >
          <div className="share-card">
            <div className="share-url">https://billsheet-net.vercel.app/</div>

            <div className="share-qr">
              <QRCode
                value="https://billsheet-net.vercel.app/"
                size={120}
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>

            <small className="share-note">
              Scan this QR code to access BillSheet.
            </small>
            <div className="share-buttons">
              <button className="btn btn-primary" onClick={shareApp}>
                <FiShare2 />
                Share
              </button>

              <button className="btn btn-secondary" onClick={copyLink}>
                <FiCopy />
                Copy Link
              </button>
            </div>
          </div>
        </Card>
        <Card
          icon={FiHelpCircle}
          title="Quick Guide"
          subtitle="Everything you need to get started."
        >
          <div className="guide-item">
            <FiUsers />
            <span>Customer Management</span>
          </div>

          <div className="guide-item">
            <FiFileText />
            <span>Monthly Billing</span>
          </div>

          <div className="guide-item">
            <FiActivity />
            <span>Payment Collection</span>
          </div>

          <div className="guide-item">
            <FiMessageCircle />
            <span>SMS Reminders</span>
          </div>

          <div className="guide-item">
            <FiDownload />
            <span>Reports & Exports</span>
          </div>
          <button
            className="primary full-width"
            onClick={() => setGuideOpen(true)}
          >
            <FiBookOpen />
            View User Guide
          </button>
        </Card>
      </div>

      <section className="settings-stats">
        <div className="settings-section-title">
          <div>
            <span className="eyebrow">
              <FiActivity /> Overview
            </span>
            <h3>Dashboard Statistics</h3>
          </div>
        </div>
        <div className="settings-stat-grid">
          <Stat icon={FiUsers} label="Total Users" value={users.length} />
          <Stat
            icon={FiFileText}
            label="Total Bills"
            value={totalBills}
            moneyValue
          />
          <Stat
            icon={FiActivity}
            label="Monthly Collections"
            value={totalCollections}
            moneyValue
          />
          <Stat
            icon={FiDatabase}
            label="Storage Used"
            value={0.8}
            suffix=" MB"
          />
        </div>
      </section>

      <Card
        icon={FiTrash2}
        title="Danger Zone"
        subtitle="These actions are permanent and require confirmation."
        className="danger-zone"
      >
        <div className="danger-actions">
          {[
            "Delete Account",
            "Delete All Bills",
            "Reset Database",
            "Remove All Users",
            "Logout current device",
          ].map((action) => (
            <button
              key={action}
              className="danger-button"
              onClick={() => setDanger(action)}
            >
              {action}
            </button>
          ))}
        </div>
      </Card>
      {confirmAction && (
        <ConfirmModal
          title={
            confirmAction.type === "signout-current"
              ? "Sign out this device"
              : "Sign out other devices"
          }
          message={
            confirmAction.type === "signout-current"
              ? "This will end the current session on this device and sign you out from BillSheet."
              : "This will sign out every other logged-in device except the one you are using now."
          }
          confirmText={
            confirmAction.type === "signout-current" ? "Sign out" : "Sign out all others"
          }
          onCancel={() => setConfirmAction(null)}
          onConfirm={async () => {
            if (confirmAction.type === "signout-current") {
              await removeSession(confirmAction.sessionId);
            } else {
              await signOutAllOtherDevices();
            }
            setConfirmAction(null);
          }}
        />
      )}
      {guideOpen && <AppGuide onClose={() => setGuideOpen(false)} />}
      {danger && (
        <Modal
          title={danger}
          onClose={() => {
            setDanger(null);
            setDangerText("");
          }}
        >
          <div className="danger-confirm">
            <FiTrash2 />
            <p>
              Type <b>DELETE</b> to permanently confirm this action.
            </p>
            <input
              autoFocus
              value={dangerText}
              onChange={(e) => setDangerText(e.target.value)}
              placeholder="Type DELETE"
            />
            <div>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setDanger(null);
                  setDangerText("");
                }}
              >
                Cancel
              </button>
              <button className="danger-button" onClick={confirmDanger}>
                Confirm {danger}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, moneyValue, suffix = "" }) {
  return (
    <motion.article whileHover={{ y: -4 }} className="settings-stat">
      <span>
        <Icon />
      </span>
      <p>{label}</p>
      <h3>
        {moneyValue ? money(value) : <AnimatedNumber value={value} />}
        {suffix}
      </h3>
    </motion.article>
  );
}
