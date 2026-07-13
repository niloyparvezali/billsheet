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
  collection,
  query,
  where,
  doc,
  getDoc,
  getDocs,
  setDoc,
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
    name: user?.displayName || "Administrator",
    email: user?.email || "",
    company: "BillSheet",
  });
  const [password, setPassword] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isProfileEditing, setIsProfileEditing] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.theme || "teal");
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
  const initials = (profile.name || user?.email || "A")
    .slice(0, 1)
    .toUpperCase();
  const memberSince = user?.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Not available";
  const lastLogin = user?.metadata?.lastSignInTime
    ? new Date(user.metadata.lastSignInTime).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Not available";
  useEffect(() => {
    const load = async () => {
      if (!user || !db) return;
      try {
        const saved = await getDoc(doc(db, "settings", user.uid));
        if (!saved.exists()) return;
        const data = saved.data();
        if (data.profile)
          setProfile((current) => ({ ...current, ...data.profile }));
        if (data.preferences) setPreferences(data.preferences);
        if (typeof data.smsTemplate === "string")
          setSmsTemplate(data.smsTemplate);
        if (data.theme) changeTheme(data.theme);
      } catch (error) {
        console.warn("Could not load settings", error);
      }
    };
    load();
  }, [user?.uid]);
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
        theme,
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
  const changeTheme = (value) => {
    setTheme(value);

    localStorage.theme = value;
    document.documentElement.dataset.theme = value;
    document.documentElement.classList.toggle("dark", value === "dark");
  };
  const savePassword = async (event) => {
    event.preventDefault();
    if (!user) return toast.error("Please sign in again to update your password");
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
  const restoreBackup = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !db || !user) return;
    try {
      const backup = JSON.parse(await file.text());
      if (!Array.isArray(backup.users) || !Array.isArray(backup.payments))
        throw new Error("Invalid BillSheet backup file");
      const restoreRecords = async (name, records) => {
        for (let i = 0; i < records.length; i += 400) {
          const batch = writeBatch(db);
          records.slice(i, i + 400).forEach((record) => {
            const { id, ...data } = record;
            const normalized = normalizeTimestamps(data);
            if (!normalized.ownerId) normalized.ownerId = user.uid;
            const docRef = id ? doc(db, name, id) : doc(collection(db, name));
            batch.set(docRef, normalized, { merge: true });
          });
          await batch.commit();
        }
      };
      await restoreRecords("users", backup.users);
      await restoreRecords("categories", backup.categories || []);
      await restoreRecords("payments", backup.payments);
      toast.success("Backup restored successfully");
    } catch (error) {
      toast.error(error.message || "Could not restore backup");
    } finally {
      event.target.value = "";
    }
  };
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
          subtitle="Your personal and company details"
        >
          <input
            ref={photoInput}
            className="restore-input"
            type="file"
            accept="image/*"
            onChange={changePhoto}
          />
          <div className="profile-editor">
            <div className="avatar-editor">
              {profile.photoURL || user?.photoURL ? (
                <img src={profile.photoURL || user?.photoURL} alt="Profile" />
              ) : (
                <b>{initials}</b>
              )}
              <button
                type="button"
                onClick={() => photoInput.current?.click()}
                title="Change photo"
              >
                <FiCamera />
              </button>
            </div>
            <div className="profile-form">
              <label>
                Full name
                <input
                  ref={nameInput}
                  value={profile.name}
                  disabled={!isProfileEditing}
                  onChange={(e) => {
                    setProfile({ ...profile, name: e.target.value });
                    setHasUnsavedChanges(true);
                  }}
                />
              </label>
              <label>
                Email address
                <input
                  type="email"
                  value={profile.email}
                  disabled={!isProfileEditing}
                  onChange={(e) => {
                    setProfile({ ...profile, email: e.target.value });
                    setHasUnsavedChanges(true);
                  }}
                />
              </label>
              <label>
                Company name
                <input
                  value={profile.company}
                  disabled={!isProfileEditing}
                  onChange={(e) => {
                    setProfile({ ...profile, company: e.target.value });
                    setHasUnsavedChanges(true);
                  }}
                />
              </label>
            </div>
          </div>
          <div className="profile-meta">
            <span>
              <b>Role</b>Administrator
            </span>
            <span>
              <b>Member since</b>
              {memberSince}
            </span>
            <span>
              <b>Last login</b>
              {lastLogin}
            </span>
          </div>
          <div className="settings-actions">
            <button className="btn btn-secondary" onClick={toggleProfileEditing}>
              <FiEdit2 /> {isProfileEditing ? "Save" : "Edit"}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => photoInput.current?.click()}
            >
              <FiUploadCloud /> Upload Photo
            </button>
          </div>
        </Card>
        <Card
          icon={FiShield}
          title="Security"
          subtitle="Keep your account protected"
        >
          <form className="security-form" onSubmit={savePassword}>
            {[
              ["Current password", "current"],
              ["New password", "next"],
              ["Confirm password", "confirm"],
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
              <FiKey /> Update Password
            </button>
          </form>
          <div className="security-row">
            <div>
              <b>Two Factor Authentication</b>
              <span>Coming soon. More security options will be added here.</span>
            </div>
            <button type="button" className="btn btn-secondary" disabled>
              Coming soon
            </button>
          </div>
          <small className="muted-line">
            Last password changed: {memberSince}
          </small>
        </Card>
      </div>

      <div className="settings-grid triple">
        <Card
          icon={FiMonitor}
          title="Active Devices"
          subtitle="Manage signed-in devices"
        >
          <div className="device">
            <FiMonitor />
            <div>
              <b>Windows PC - Chrome</b>
              <span>Dhaka, Bangladesh - Active now</span>
            </div>
            <button
              className="text-danger"
              onClick={() =>
                toast("This device will be signed out on its next refresh")
              }
            >
              Logout
            </button>
          </div>
          <div className="device">
            <FiSmartphone />
            <div>
              <b>iPhone - Safari</b>
              <span>Dhaka, Bangladesh - Last active today</span>
            </div>
            <button
              className="text-danger"
              onClick={() => toast("Mobile device signed out")}
            >
              Logout
            </button>
          </div>
          <button className="secondary full-width" onClick={logout}>
            <FiLogOut /> Logout From All Devices
          </button>
        </Card>
        <Card
          icon={FiLayout}
          title="Appearance"
          subtitle="Choose a theme for the entire workspace"
        >
          <p className="setting-label">Theme settings</p>
          <div className="choice-row">
            {[
              {
                value: "teal",
                label: "Teal",
                color: "#0a6a64",
              },
              {
                value: "light",
                label: "Light",
                color: "#ffffff",
              },
              {
                value: "dark",
                label: "Dark",
                color: "#1b1b1b",
              },
              {
                value: "cyan",
                label: "Cyan",
                color: "#18c7d4",
              },
            ].map((item) => (
              <button
                key={item.value}
                className={`theme-card ${theme === item.value ? "active" : ""}`}
                onClick={() => {
                  changeTheme(item.value);
                  setHasUnsavedChanges(true);
                }}
              >
                <span
                  className="theme-color"
                  style={{ background: item.color }}
                />

                <div className="theme-info">
                  <div className="theme-title">{item.label}</div>

                  <div className="theme-subtitle">
                    {
                      {
                        light: "Clean & Bright",
                        dark: "Easy on the Eyes",
                        cyan: "Fresh & Modern",
                        teal: "Calm & Aesthetic",
                      }[item.value]
                    }
                  </div>
                </div>
              </button>
            ))}
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
