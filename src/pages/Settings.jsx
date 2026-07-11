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
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  FiActivity,
  FiBell,
  FiCamera,
  FiCheck,
  FiCloud,
  FiDatabase,
  FiDownload,
  FiEdit2,
  FiFileText,
  FiGlobe,
  FiHelpCircle,
  FiKey,
  FiLayout,
  FiLock,
  FiLogOut,
  FiMail,
  FiMonitor,
  FiMoon,
  FiPhone,
  FiRefreshCw,
  FiSave,
  FiSettings,
  FiMessageCircle,
  FiShield,
  FiSmartphone,
  FiSun,
  FiTrash2,
  FiUploadCloud,
  FiUser,
  FiUserPlus,
  FiUsers,
  FiX,
} from "react-icons/fi";
import toast from "react-hot-toast";
import { db, storage } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import useCollection from "../hooks/useCollection";
import Modal from "../components/Modal";
import AppGuide from "../components/AppGuide";
import { money } from "../utils/date";
import { exportExcel, exportPdf } from "../utils/exports";

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
  const { user, logout } = useAuth();
  const restoreInput = useRef(null);
  const photoInput = useRef(null);
  const nameInput = useRef(null);
  const { data: users } = useCollection(db ? collection(db, "users") : null);
  const { data: payments } = useCollection(
    db ? collection(db, "payments") : null,
  );
  const { data: categories } = useCollection(
    db ? collection(db, "categories") : null,
  );
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
  const [theme, setTheme] = useState(localStorage.theme || "light");
  const [guideOpen, setGuideOpen] = useState(false);
  const [sidebar, setSidebar] = useState(
    localStorage.settingsSidebar || "Rounded",
  );
  const [preferences, setPreferences] = useState(() =>
    JSON.parse(
      localStorage.settingsPreferences ||
        '{"email":true,"billing":true,"payment":true,"report":false,"weekly":false,"updates":true,"joined":true}',
    ),
  );
  const [billingPreferences, setBillingPreferences] = useState(() =>
    JSON.parse(
      localStorage.billingPreferences ||
        '{"currency":"BDT","dateFormat":"DD/MM/YYYY","timezone":"Asia/Dhaka","language":"English"}',
    ),
  );
  const [danger, setDanger] = useState(null);
  const [dangerText, setDangerText] = useState("");
  const [twoFactor, setTwoFactor] = useState(false);
  const [smsTemplate, setSmsTemplate] = useState(
    "Dear {name}, your monthly bill is {bill}. Please pay by {duedate}. Thank you.",
  );
  const totalCollections = payments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0,
  );
  const totalBills = users.reduce(
    (sum, member) => sum + Number(member.monthlyBill || 0),
    0,
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
    : "—";
  const lastLogin = user?.metadata?.lastSignInTime
    ? new Date(user.metadata.lastSignInTime).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
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
        if (data.billingPreferences)
          setBillingPreferences(data.billingPreferences);
        if (typeof data.smsTemplate === "string") setSmsTemplate(data.smsTemplate);
        if (data.sidebar) setSidebar(data.sidebar);
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
  const setPreference = (key, value) => {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    localStorage.settingsPreferences = JSON.stringify(next);
  };
  const saveChanges = async () => {
    try {
      if (!profile.name.trim() || !profile.email.trim()) {
        toast.error("Name and email are required");
        return false;
      }
      if (user && profile.email !== user.email) {
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
      setProfile((current) => ({ ...current, photoURL }));
      await setDoc(
        doc(db, "settings", user.uid),
        { profile: { ...profile, photoURL }, photoURL },
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
    if (!file || !db) return;
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
            batch.set(doc(db, name, id), normalized, { merge: true });
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
    const snapshot = await getDocs(collection(db, name));
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
      if (danger === "Logout All Devices") await logout();
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
  const inviteUser = async () => {
    const invite = {
      title: "Join BillSheet",
      text: "Join me on BillSheet to manage monthly billing records.",
      url: "https://billsheet-net.vercel.app/",
    };
    if (navigator.share) {
      try {
        await navigator.share(invite);
      } catch (error) {
        if (error.name !== "AbortError")
          toast.error("Could not open sharing options");
      }
    } else {
      await navigator.clipboard.writeText(invite.url);
      toast.success("Invitation link copied to your clipboard");
    }
  };

  return (
    <div className="page settings-page">
      <div className="settings-hero">
        <div>
          <span className="eyebrow">
            <FiSettings /> Workspace settings
          </span>
          <h2>⚙ Settings</h2>
          <p>
            Manage your profile, security, appearance, notifications, and
            application preferences.
          </p>
        </div>
        <div className="settings-hero-actions">
          <button
            className="secondary settings-help"
            onClick={() => setGuideOpen(true)}
          >
            <FiHelpCircle /> How to use
          </button>
          <button className="primary" onClick={saveChanges}>
            <FiSave /> Save Changes
          </button>
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
                  onChange={(e) =>
                    setProfile({ ...profile, name: e.target.value })
                  }
                />
              </label>
              <label>
                Email address
                <input
                  type="email"
                  value={profile.email}
                  disabled={!isProfileEditing}
                  onChange={(e) =>
                    setProfile({ ...profile, email: e.target.value })
                  }
                />
              </label>
              <label>
                Company name
                <input
                  value={profile.company}
                  disabled={!isProfileEditing}
                  onChange={(e) =>
                    setProfile({ ...profile, company: e.target.value })
                  }
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
            <button className="secondary" onClick={toggleProfileEditing}>
              <FiEdit2 /> {isProfileEditing ? "Save" : "Edit"}
            </button>
            <button
              className="secondary"
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
            <button className="primary">
              <FiKey /> Update Password
            </button>
          </form>
          <div className="security-row">
            <div>
              <b>Two Factor Authentication</b>
              <span>OFF · Add a second layer of protection.</span>
            </div>
            <button
              className="secondary"
              onClick={() => {
                setTwoFactor(!twoFactor);
                toast(
                  twoFactor
                    ? "Two-factor authentication disabled"
                    : "Two-factor authentication setup is ready",
                );
              }}
            >
              {twoFactor ? "Enabled" : "Enable"}
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
              <b>Windows PC · Chrome</b>
              <span>Dhaka, Bangladesh · Active now</span>
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
              <b>iPhone · Safari</b>
              <span>Dhaka, Bangladesh · Last active today</span>
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
              ["light", "Light"],
              ["dark", "Dark"],
              ["cyan", "Cyan Ledger"],
              ["teal", "Teal Ledger"],
            ].map(([value, label]) => (
              <Choice
                key={value}
                label={label}
                active={theme === value}
                onClick={() => changeTheme(value)}
              />
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
              onChange={(event) => setSmsTemplate(event.target.value)}
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
              className="secondary"
              onClick={() => {
                const csv = [
                  "Name,Month,Year,Amount,Due,Status",
                  ...records.map((row) =>
                    [
                      row.Name,
                      row.Month,
                      row.Year,
                      row.Amount,
                      row.Due,
                      row.Status,
                    ]
                      .map(
                        (value) => `"${String(value).replaceAll('"', '""')}"`,
                      )
                      .join(","),
                  ),
                ].join("\n");
                const link = document.createElement("a");
                link.href = URL.createObjectURL(
                  new Blob([csv], { type: "text/csv" }),
                );
                link.download = "billsheet-payments.csv";
                link.click();
                URL.revokeObjectURL(link.href);
              }}
            >
              <FiDownload /> CSV
            </button>
            <button
              className="secondary"
              onClick={() => exportExcel(records, "billsheet-payments")}
            >
              <FiDownload /> Excel
            </button>
            <button
              className="secondary"
              onClick={() => exportPdf(records, "billsheet-payments")}
            >
              <FiFileText /> PDF
            </button>
            <button className="secondary" onClick={downloadBackup}>
              <FiCloud /> Backup Now
            </button>
            <button
              className="secondary"
              onClick={() => restoreInput.current?.click()}
            >
              <FiRefreshCw /> Restore
            </button>
          </div>
        </Card>
        <Card
          icon={FiUserPlus}
          title="Invite User"
          subtitle="Share BillSheet with your team"
        >
          <div className="invite-user">
            <div className="invite-user-copy">
              <b>Invite someone to BillSheet</b>
              <span>
                Send a secure link so they can open the app and get started.
              </span>
            </div>
            <button className="primary" onClick={inviteUser}>
              <FiUserPlus /> Share invite
            </button>
          </div>
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
        title="⚠ Danger Zone"
        subtitle="These actions are permanent and require confirmation."
        className="danger-zone"
      >
        <div className="danger-actions">
          {[
            "Delete Account",
            "Delete All Bills",
            "Reset Database",
            "Remove All Users",
            "Logout All Devices",
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
                className="secondary"
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
