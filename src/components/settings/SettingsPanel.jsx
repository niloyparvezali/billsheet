import { importBackup } from "../../utils/backup/importBackup";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { resetApplicationData } from "../../utils/backup/resetApplicationData";
import { restoreBackup } from "../../utils/backup/restoreBackup";
import { deleteAccount } from "../../utils/deleteAccount";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheckBig,
  CloudUpload,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  FileText,
  Globe,
  LayoutGrid,
  Lock,
  Palette,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  UserRound,
  Users,
  Moon,
  Sun,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { db } from "../../firebase/config";
import { normalizeTheme } from "../../utils/theme";
import SettingsSectionCard from "./SettingsSectionCard";
import SettingsTile from "./SettingsTile";

const themeOptions = [
  {
    id: "midnight",
    label: "🌙 Midnight",
    icon: Moon,
  },
  {
    id: "sunrise",
    label: "☀️ Sunrise",
    icon: Sun,
  },
];

const defaultSmsTemplate = `Hello {{customerName}},

Your bill for {{month}} is ৳{{billAmount}}.

Paid: ৳{{paidAmount}}

Due: ৳{{dueAmount}}

Payment Date: {{paymentDate}}

Thank you.`;

const smsVariables = [
  { token: "{{customerName}}", label: "customerName" },
  { token: "{{phone}}", label: "phone" },
  { token: "{{month}}", label: "month" },
  { token: "{{year}}", label: "year" },
  { token: "{{billAmount}}", label: "billAmount" },
  { token: "{{paidAmount}}", label: "paidAmount" },
  { token: "{{dueAmount}}", label: "dueAmount" },
  { token: "{{carryForward}}", label: "carryForward" },
  { token: "{{paymentDate}}", label: "paymentDate" },
  { token: "{{companyName}}", label: "companyName" },
];

const sampleSmsValues = {
  customerName: "John",
  phone: "01812345678",
  month: "July 2026",
  year: "2026",
  billAmount: "1000",
  paidAmount: "700",
  dueAmount: "300",
  carryForward: "300",
  paymentDate: "16 July 2026",
  companyName: "Northstar Billing",
};

export default function SettingsPanel({ user, onSave, onExportBackup }) {
  const { changePasscode } = useAuth();
  const { t, language, changeLanguage } = useLanguage();
  const { theme, setThemePreference } = useTheme();
  const [activeView, setActiveView] = useState("overview");
  const [hasChanges, setHasChanges] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [profile, setProfile] = useState({
    name: user?.displayName || "Northstar Admin",
    phone: user?.phoneNumber || "01XXXXXXXXX",
    email: user?.email || "admin@northstar.io",
  });
  const [security, setSecurity] = useState({
    currentDevice: "MacBook Pro",
    lastLogin: "Today • 09:42",
  });
  const [passcodeForm, setPasscodeForm] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [passcodeErrors, setPasscodeErrors] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [showPasscodeFields, setShowPasscodeFields] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [savingPasscode, setSavingPasscode] = useState(false);
  const [smsTemplate, setSmsTemplate] = useState(defaultSmsTemplate);
  const [smsHasChanges, setSmsHasChanges] = useState(false);
  const [importedBackup, setImportedBackup] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const textareaRef = useRef(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const backupInputRef = useRef(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreMode, setRestoreMode] = useState("keep");
  const [showSmsPreviewPopup, setShowSmsPreviewPopup] = useState(false);
  const [showSmsVariablesDrawer, setShowSmsVariablesDrawer] = useState(false);
  const [helpSearch, setHelpSearch] = useState("");
  const [activeGuide, setActiveGuide] = useState("dashboard");
  const [expandedGuide, setExpandedGuide] = useState("dashboard");
  const [activeWorkflowStep, setActiveWorkflowStep] = useState("login");
  const [activeFaq, setActiveFaq] = useState("password");
  const [beginnerMode, setBeginnerMode] = useState("beginner");
  const [recentGuides, setRecentGuides] = useState(["dashboard", "users"]);
  const guideItems = [
    {
      id: "dashboard",
      title: "Dashboard",
      icon: LayoutGrid,
      purpose: "See the big picture",
      why: "Use it daily to review totals, recent activity, and monthly trends.",
      buttons: ["Billing sheet shortcut"],
      tips: ["Check it each morning", "Watch for overdue balances"],
      mistakes: ["Ignoring unpaid balances"],
      time: "2 min",
      keywords: ["overview", "summary", "recent", "payments"],
      overview: "The dashboard gives a quick snapshot of your workspace.",
      fields: ["Summary cards", "Collection chart", "Recent payments"],
      actions: ["Open the billing sheet", "Review recent activity"],
      example:
        "Use the dashboard to spot payment trends before opening the full billing sheet.",
      warning: "Do not rely on it alone for detailed payment history.",
    },
    {
      id: "users",
      title: "Users",
      icon: Users,
      purpose: "Manage customer records",
      why: "Create or update customers, assign categories, and save contact details.",
      buttons: ["Add or edit customer", "Open payment actions"],
      tips: ["Use consistent names", "Keep phone numbers updated"],
      mistakes: ["Leaving the monthly bill empty"],
      time: "3 min",
      keywords: ["customer", "customers", "add user", "edit user"],
      overview:
        "This page is where customer accounts are created and maintained.",
      fields: [
        "Name",
        "Package or category",
        "Monthly bill",
        "Phone",
        "Address",
      ],
      actions: ["Add a customer", "Edit a customer", "Deactivate a customer"],
      example:
        "Add a new customer here before recording any payments for them.",
      warning: "Phone numbers must follow the supported format.",
    },
    {
      id: "monthly-sheet",
      title: "Billing Sheet",
      icon: CreditCard,
      purpose: "Record payments and balances",
      why: "Use this page when you want to save payments and review this month’s collection status.",
      buttons: ["Save payment", "Send SMS", "Void payment"],
      tips: ["Choose the correct month and year", "Double-check the amount"],
      mistakes: ["Forgetting to pick the right month"],
      time: "4 min",
      keywords: ["payment", "monthly", "bill", "collection"],
      overview:
        "This page manages the current month’s customer billing activity.",
      fields: ["Month", "Year", "Search", "Payment amount", "Additional due"],
      actions: ["Record a payment", "View balances", "Send an SMS reminder"],
      example: "Save a payment here to update the customer’s current balance.",
      warning: "Enter either a payment amount or an additional due value.",
    },
    {
      id: "reports",
      title: "Reports",
      icon: BarChart3,
      purpose: "Review year-long billing summaries",
      why: "Use this page to understand yearly bills, paid amounts, and remaining balances.",
      buttons: ["Select a customer", "Export report"],
      tips: ["Pick one customer at a time", "Use the year filter"],
      mistakes: ["Skipping the customer search"],
      time: "3 min",
      keywords: ["report", "yearly", "annual", "summary"],
      overview: "Reports show a yearly view of a customer’s billing history.",
      fields: ["Customer search", "Year", "Monthly history"],
      actions: ["Open a customer report", "Export a PDF"],
      example:
        "Choose a customer and year to review their full annual billing story.",
      warning: "If no customer is selected, the page shows a general overview.",
    },
    {
      id: "transaction-history",
      title: "Transactions",
      icon: FileText,
      purpose: "Browse past payments",
      why: "Use it when you need to review older transactions by month, filter, or customer.",
      buttons: ["Choose month", "Apply filters", "Export PDF"],
      tips: [
        "Use the date range for a specific period",
        "Search by customer name",
      ],
      mistakes: ["Forgetting the filter mode"],
      time: "3 min",
      keywords: ["history", "transactions", "date", "filter"],
      overview:
        "This page lists past transaction activity in a clear timeline.",
      fields: ["Month", "Search", "Date range"],
      actions: [
        "Filter transactions",
        "Review payment details",
        "Export history",
      ],
      example:
        "Open this page when you want to confirm an earlier payment entry.",
      warning: "The date filter changes the visible transaction set instantly.",
    },
    {
      id: "settings",
      title: "Settings",
      icon: ShieldCheck,
      purpose: "Control your workspace preferences",
      why: "Use it to change language, appearance, security, SMS template, and backup options.",
      buttons: ["Save changes", "Export backup", "Restore backup"],
      tips: ["Export a backup regularly", "Keep your passcode private"],
      mistakes: ["Skipping backup export"],
      time: "4 min",
      keywords: ["settings", "language", "theme", "backup", "security"],
      overview: "This page manages account and app preferences.",
      fields: ["Language", "Profile", "Theme", "Passcode", "SMS template"],
      actions: [
        "Switch language",
        "Update passcode",
        "Import or export backup",
      ],
      example:
        "Use Settings if you want to change the app’s theme or save a backup copy.",
      warning:
        "Reset and delete actions are permanent and should be used carefully.",
    },
  ];

  const quickStartSteps = [
    {
      id: "login",
      title: "Login",
      description: "Sign in with your phone number and passcode.",
      target: "dashboard",
    },
    {
      id: "profile",
      title: "Complete profile",
      description: "Update your profile and app preferences in Settings.",
      target: "settings",
    },
    {
      id: "customer",
      title: "Create first customer",
      description: "Add your first customer in the Users page.",
      target: "users",
    },
    {
      id: "payment",
      title: "Record payment",
      description: "Open the Monthly Sheet and save the first payment.",
      target: "monthly-sheet",
    },
    {
      id: "report",
      title: "Generate report",
      description: "Open Reports to review the yearly story.",
      target: "reports",
    },
  ];

  const workflowSteps = [
    { id: "login", label: "Login", guideId: "dashboard" },
    { id: "dashboard", label: "Dashboard", guideId: "dashboard" },
    { id: "users", label: "Customers", guideId: "users" },
    { id: "monthly-sheet", label: "Payment", guideId: "monthly-sheet" },
    { id: "reports", label: "Reports", guideId: "reports" },
  ];

  const faqItems = [
    {
      id: "password",
      question: "How do I change my passcode?",
      answer:
        "Open Settings, go to Security, and update your passcode using the form. Keep the new passcode between 4 and 6 digits.",
    },
    {
      id: "export",
      question: "How do I export reports?",
      answer:
        "Open Reports and click the Export PDF button. You can also export transactions from the Transactions page.",
    },
    {
      id: "customer",
      question: "How do I create a customer?",
      answer: "Go to Users, fill in the customer details, and save the record.",
    },
    {
      id: "backup",
      question: "How do I recover data?",
      answer:
        "Use Settings → Backup & Restore to import a previously exported backup file.",
    },
  ];

  useEffect(() => {
    let cancelled = false;

    const loadSmsTemplate = async () => {
      if (!user?.uid || !db) return;

      try {
        const snapshot = await getDoc(doc(db, "settings", user.uid));
        const savedTemplate = snapshot?.exists
          ? snapshot.data()?.smsTemplate
          : "";

        if (cancelled) return;

        if (typeof savedTemplate === "string" && savedTemplate.trim()) {
          setSmsTemplate(savedTemplate.trim());
        } else {
          setSmsTemplate(defaultSmsTemplate);
        }
        setSmsHasChanges(false);
      } catch (error) {
        console.error("Unable to load SMS template", error);
        if (!cancelled) {
          setSmsTemplate(defaultSmsTemplate);
          setSmsHasChanges(false);
        }
      }
    };

    void loadSmsTemplate();

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const filteredGuides = useMemo(() => {
    const query = helpSearch.trim().toLowerCase();
    if (!query) return guideItems;
    return guideItems.filter((guide) => {
      const haystack = [
        guide.title,
        guide.purpose,
        guide.why,
        guide.overview,
        ...(guide.keywords || []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [helpSearch]);

  const selectedGuide =
    guideItems.find((guide) => guide.id === activeGuide) || guideItems[0];
  const progressValue = Math.round(
    ((guideItems.findIndex((guide) => guide.id === activeGuide) + 1) /
      guideItems.length) *
      100,
  );

  const handleGuideOpen = (guideId) => {
    setActiveGuide(guideId);
    setExpandedGuide(guideId);
    setRecentGuides((current) =>
      [guideId, ...current.filter((item) => item !== guideId)].slice(0, 4),
    );
  };

  const handlePrintGuide = () => {
    window.print();
  };

  const handleRestoreBackup = () => {
    if (!importedBackup) return;

    setRestoreMode("keep");
    setShowRestoreModal(true);
  };
  const handleConfirmRestore = async () => {
    if (!importedBackup || !user) return;

    try {
      setRestoring(true);

      await restoreBackup(importedBackup.backup, user, restoreMode);

      setShowRestoreModal(false);

      toast.success("Backup restored successfully.");

      window.location.reload();
    } catch (error) {
      console.error(error);

      toast.error(error.message || "Restore failed.");
    } finally {
      setRestoring(false);
    }
  };
  const handleImportBackup = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setIsImporting(true);

    try {
      const result = await importBackup(file);

      setImportedBackup(result);

      toast.success("Backup imported successfully.");
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Import failed.");
    } finally {
      setIsImporting(false);

      event.target.value = "";
    }
  };
  const openImportDialog = () => {
    backupInputRef.current?.click();
  };

  const persistThemePreference = async (nextTheme) => {
    const normalizedTheme = normalizeTheme(nextTheme);
    setHasChanges(true);
    await setThemePreference(normalizedTheme);
  };

  const getThemePreview = (themeId) => {
    if (themeId === "sunrise") {
      return {
        shell: "linear-gradient(135deg, #FAF7F2 0%, #E8E2D8 58%, #2563EB 100%)",
        accent: "#2563EB",
        secondary: "#0EA5E9",
        glow: "rgba(37, 99, 235, 0.28)",
      };
    }
    if (themeId === "midnight") {
      return {
        shell: "linear-gradient(135deg, #0B0F19 0%, #111827 58%, #3B82F6 100%)",
        accent: "#3B82F6",
        secondary: "#06B6D4",
        glow: "rgba(59, 130, 246, 0.28)",
      };
    }
    return {
      shell: "linear-gradient(135deg, #0B0F19 0%, #111827 58%, #3B82F6 100%)",
      accent: "#3B82F6",
      secondary: "#06B6D4",
      glow: "rgba(59,130,246,.28)",
    };
  };

  const previewSmsTemplate = useMemo(() => {
    let preview = smsTemplate;
    smsVariables.forEach(({ token, label }) => {
      preview = preview.replaceAll(token, sampleSmsValues[label] || token);
    });
    return preview;
  }, [smsTemplate]);

  const isPasscodeFormValid = useMemo(() => {
    const currentValid = passcodeForm.current.trim().length > 0;
    const newValid = /^\d{4,6}$/.test(passcodeForm.new);
    const confirmValid =
      passcodeForm.confirm.length > 0 &&
      passcodeForm.confirm === passcodeForm.new;
    return currentValid && newValid && confirmValid;
  }, [passcodeForm]);

  const updateProfile = (field, value) => {
    setProfile((current) => ({ ...current, [field]: value }));
    setHasChanges(true);
  };

  const updatePasscodeField = (field, value) => {
    const nextValue = value.replace(/\D/g, "").slice(0, 6);
    setPasscodeForm((current) => ({ ...current, [field]: nextValue }));
    setPasscodeErrors((current) => ({ ...current, [field]: "" }));
  };

  const togglePasscodeVisibility = (field) => {
    setShowPasscodeFields((current) => ({
      ...current,
      [field]: !current[field],
    }));
  };

  const resetPasscodeForm = () => {
    setPasscodeForm({ current: "", new: "", confirm: "" });
    setPasscodeErrors({ current: "", new: "", confirm: "" });
    setShowPasscodeFields({ current: false, new: false, confirm: false });
  };

  const handlePasscodeSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = {
      current: passcodeForm.current.trim()
        ? ""
        : "Current passcode is required.",
      new: /^\d{4,6}$/.test(passcodeForm.new)
        ? ""
        : "Passcode must contain 4–6 digits.",
      confirm:
        passcodeForm.confirm === passcodeForm.new
          ? ""
          : "New passcodes do not match.",
    };
    if (passcodeForm.new && passcodeForm.new === passcodeForm.current) {
      nextErrors.new = "Please choose a different passcode.";
    }
    setPasscodeErrors(nextErrors);
    if (nextErrors.current || nextErrors.new || nextErrors.confirm) return;

    setSavingPasscode(true);
    try {
      await changePasscode({
        currentPasscode: passcodeForm.current,
        newPasscode: passcodeForm.new,
        confirmNewPasscode: passcodeForm.confirm,
      });
      resetPasscodeForm();
      toast.success("Passcode updated successfully.");
    } catch (error) {
      const message = error?.message || "Unable to update passcode.";
      setPasscodeErrors((current) => ({ ...current, current: message }));
    } finally {
      setSavingPasscode(false);
    }
  };

  const handleSmsTemplateChange = (value) => {
    setSmsTemplate(value);
    setSmsHasChanges(true);
  };

  const handleInsertVariable = (token) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart ?? smsTemplate.length;
    const end = textarea.selectionEnd ?? smsTemplate.length;
    const nextValue = `${smsTemplate.slice(0, start)}${token}${smsTemplate.slice(end)}`;
    setSmsTemplate(nextValue);
    setSmsHasChanges(true);
    requestAnimationFrame(() => {
      textarea.focus({ preventScroll: true });
      const caretPosition = start + token.length;
      textarea.setSelectionRange(caretPosition, caretPosition);
    });
  };

  const handleSmsSave = async () => {
    if (!user?.uid || !db) {
      setSmsHasChanges(false);
      onSave?.();
      toast.success("SMS template updated successfully.");
      return;
    }

    try {
      await setDoc(
        doc(db, "settings", user.uid),
        { smsTemplate },
        { merge: true },
      );
      setSmsHasChanges(false);
      onSave?.();
      toast.success("SMS template updated successfully.");
    } catch (error) {
      console.error("Unable to save SMS template", error);
      toast.error(error.message || "Unable to save SMS template.");
    }
  };

  const handleSave = () => {
    setHasChanges(false);
    onSave?.();
  };

  const handleDangerAction = (label) => {
    const confirmed = window.confirm(
      `${label} will permanently affect this admin workspace. Continue?`,
    );
    if (!confirmed) return;
    onSave?.();
  };
  const handleResetApplication = async () => {
    if (!user) return;

    try {
      setResetting(true);

      await resetApplicationData(user);

      setShowResetModal(false);

      toast.success("Application data reset successfully.");

      window.location.reload();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Unable to reset application data.");
    } finally {
      setResetting(false);
    }
  };
  const handleDeleteAccount = async () => {
    if (!user) return;

    try {
      setDeletingAccount(true);

      await deleteAccount(user);

      setShowDeleteAccountModal(false);

      toast.success("Account deleted successfully.");

      window.location.href = "/";
    } catch (error) {
      console.error(error);

      toast.error(error.message || "Unable to delete account.");
    } finally {
      setDeletingAccount(false);
    }
  };

  const renderOverview = () => (
    <div className="settings-overview-grid">
      <SettingsTile
        icon={BookOpen}
        title="Getting Started"
        description="Open the guide and learn the system in 5 minutes."
        onClick={() => setActiveView("guide")}
        featured
      />
      <SettingsTile
        icon={Globe}
        title={t("language")}
        description={language === "en" ? "English 🇺🇸" : "বাংলা 🇧🇩"}
        onClick={() => setActiveView("language")}
      />
      <SettingsTile
        icon={UserRound}
        title={t("profile")}
        description="Manage your account"
        onClick={() => setActiveView("profile")}
      />
      <SettingsTile
        icon={Palette}
        title={t("appearance")}
        description="Adjust visual theme"
        onClick={() => setActiveView("appearance")}
      />
      <SettingsTile
        icon={Lock}
        title={t("security")}
        description="Passcode and device access"
        onClick={() => setActiveView("security")}
      />
      <SettingsTile
        icon={Sparkles}
        title={t("sms_template")}
        description="Reusable message template"
        onClick={() => setActiveView("sms")}
      />
      <SettingsTile
        icon={CloudUpload}
        title={t("backup_restore")}
        description="Export and restore"
        onClick={() => setActiveView("backup")}
      />
      <SettingsTile
        icon={ShieldCheck}
        title={t("role_management")}
        description={t("coming_soon")}
        disabled
        onClick={() => setActiveView("roles")}
      />
      <SettingsTile
        icon={AlertTriangle}
        title={t("danger_zone")}
        description="Sensitive actions"
        onClick={() => setActiveView("danger")}
      />
    </div>
  );

  const renderLanguage = () => (
    <SettingsSectionCard
      title={t("language")}
      description={t("select_language")}
    >
      <div
        style={{
          display: "flex",
          gap: "16px",
          flexWrap: "wrap",
          marginTop: "12px",
          marginBottom: "12px",
        }}
      >
        <button
          type="button"
          className={`settings-inline-btn ${language === "en" ? "primary" : ""}`}
          onClick={() => {
            void changeLanguage("en");
            toast.success("Language set to English");
          }}
          style={{
            padding: "14px 28px",
            fontSize: "15px",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            borderRadius: "10px",
          }}
        >
          <span style={{ fontSize: "18px" }}>🇺🇸</span>
          <span>English</span>
          {language === "en" && (
            <span style={{ marginLeft: "auto", fontWeight: 700 }}>✓</span>
          )}
        </button>

        <button
          type="button"
          className={`settings-inline-btn ${language === "bn" ? "primary" : ""}`}
          onClick={() => {
            void changeLanguage("bn");
            toast.success("ভাষা বাংলা নির্বাচন করা হয়েছে");
          }}
          style={{
            padding: "14px 28px",
            fontSize: "15px",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            borderRadius: "10px",
          }}
        >
          <span style={{ fontSize: "18px" }}>🇧🇩</span>
          <span>বাংলা</span>
          {language === "bn" && (
            <span style={{ marginLeft: "auto", fontWeight: 700 }}>✓</span>
          )}
        </button>
      </div>
    </SettingsSectionCard>
  );

  const renderProfile = () => (
    <SettingsSectionCard
      title="Profile"
      description="Update your personal details for this admin workspace."
    >
      <div className="settings-profile-card">
        <div className="settings-avatar" aria-label="Profile avatar">
          <UserRound size={24} />
        </div>
        <div className="settings-profile-fields">
          <label>
            <span>Name</span>
            <input
              value={profile.name}
              onChange={(event) => updateProfile("name", event.target.value)}
            />
          </label>
          <label>
            <span>Phone Number</span>
            <input
              value={profile.phone}
              onChange={(event) => updateProfile("phone", event.target.value)}
            />
          </label>
          <label>
            <span>Email</span>
            <input
              value={profile.email}
              onChange={(event) => updateProfile("email", event.target.value)}
            />
          </label>
        </div>
      </div>
      <div className="settings-action-row">
        <button type="button" className="settings-inline-btn">
          <Camera size={16} /> Change Profile Picture
        </button>
        <button
          type="button"
          className="settings-inline-btn primary"
          onClick={handleSave}
        >
          <Save size={16} /> Save Changes
        </button>
      </div>
    </SettingsSectionCard>
  );

  const renderAppearance = () => (
    <SettingsSectionCard
      title="Appearance"
      description="Choose a premium palette for the workspace."
    >
      <div className="settings-theme-grid">
        {themeOptions.map((option) => {
          const Icon = option.icon;
          const isActive = theme === option.id;
          const preview = getThemePreview(option.id);
          return (
            <button
              key={option.id}
              type="button"
              className={`settings-theme-option ${isActive ? "active" : ""}`}
              onClick={() => {
                void persistThemePreference(option.id);
              }}
            >
              <div
                className={`settings-theme-preview ${isActive ? "active" : ""}`}
                style={{
                  background: preview.shell,
                  boxShadow: isActive
                    ? `0 0 0 1px ${preview.accent}33, 0 12px 28px ${preview.glow}`
                    : "0 10px 24px rgba(15, 23, 42, 0.14)",
                }}
              >
                <div className="settings-theme-preview-glass" />
                <div
                  className="settings-theme-preview-pill"
                  style={{ background: preview.secondary }}
                />
                <div
                  className="settings-theme-preview-accent"
                  style={{ background: preview.accent }}
                />
                <div
                  className={`settings-theme-preview-check ${isActive ? "visible" : ""}`}
                >
                  ✓
                </div>
              </div>
              <div className="settings-theme-card-meta">
                <span
                  className="settings-theme-indicator"
                  style={{ background: preview.accent }}
                />
                <span className="settings-theme-name">
                  <Icon size={14} /> {option.label}
                </span>
                {isActive ? (
                  <span className="settings-theme-checkmark">✓</span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
      <div className="settings-action-row">
        <button
          type="button"
          className="settings-inline-btn primary"
          onClick={handleSave}
        >
          <Save size={16} /> Save Changes
        </button>
      </div>
    </SettingsSectionCard>
  );

  const renderSecurity = () => (
    <SettingsSectionCard
      title="Security"
      description="Update your passcode using a secure change flow."
    >
      <form className="settings-passcode-form" onSubmit={handlePasscodeSubmit}>
        <label className="settings-passcode-field">
          <span>Current Passcode</span>
          <div className="settings-passcode-input-shell">
            <input
              type={showPasscodeFields.current ? "text" : "password"}
              inputMode="numeric"
              autoComplete="current-password"
              value={passcodeForm.current}
              onChange={(event) =>
                updatePasscodeField("current", event.target.value)
              }
              placeholder="Enter your current passcode"
            />
            <button
              type="button"
              className="settings-passcode-toggle"
              onClick={() => togglePasscodeVisibility("current")}
            >
              {showPasscodeFields.current ? (
                <EyeOff size={16} />
              ) : (
                <Eye size={16} />
              )}
            </button>
          </div>
          {passcodeErrors.current ? (
            <small className="settings-field-error">
              {passcodeErrors.current}
            </small>
          ) : null}
        </label>

        <label className="settings-passcode-field">
          <span>New Passcode</span>
          <div className="settings-passcode-input-shell">
            <input
              type={showPasscodeFields.new ? "text" : "password"}
              inputMode="numeric"
              autoComplete="new-password"
              value={passcodeForm.new}
              onChange={(event) =>
                updatePasscodeField("new", event.target.value)
              }
              placeholder="Enter a new passcode"
            />
            <button
              type="button"
              className="settings-passcode-toggle"
              onClick={() => togglePasscodeVisibility("new")}
            >
              {showPasscodeFields.new ? (
                <EyeOff size={16} />
              ) : (
                <Eye size={16} />
              )}
            </button>
          </div>
          {passcodeErrors.new ? (
            <small className="settings-field-error">{passcodeErrors.new}</small>
          ) : null}
        </label>

        <label className="settings-passcode-field">
          <span>Confirm New Passcode</span>
          <div className="settings-passcode-input-shell">
            <input
              type={showPasscodeFields.confirm ? "text" : "password"}
              inputMode="numeric"
              autoComplete="new-password"
              value={passcodeForm.confirm}
              onChange={(event) =>
                updatePasscodeField("confirm", event.target.value)
              }
              placeholder="Re-enter your new passcode"
            />
            <button
              type="button"
              className="settings-passcode-toggle"
              onClick={() => togglePasscodeVisibility("confirm")}
            >
              {showPasscodeFields.confirm ? (
                <EyeOff size={16} />
              ) : (
                <Eye size={16} />
              )}
            </button>
          </div>
          {passcodeErrors.confirm ? (
            <small className="settings-field-error">
              {passcodeErrors.confirm}
            </small>
          ) : null}
        </label>

        <div className="settings-passcode-hint">
          Requirements: 4–6 numeric digits
        </div>
        <div className="settings-action-row">
          <button
            type="button"
            className="settings-inline-btn"
            onClick={resetPasscodeForm}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="settings-inline-btn primary"
            disabled={!isPasscodeFormValid || savingPasscode}
          >
            <Save size={16} />{" "}
            {savingPasscode ? "Updating…" : "Update Passcode"}
          </button>
        </div>
      </form>
      <div className="settings-info-row">
        <div>
          <strong>Current Device</strong>
          <p>{security.currentDevice}</p>
        </div>
        <div>
          <strong>Last Login</strong>
          <p>{security.lastLogin}</p>
        </div>
      </div>
      <button type="button" className="settings-inline-btn danger">
        <Lock size={16} /> Logout Current Session
      </button>
    </SettingsSectionCard>
  );

  const renderSms = () => (
    <SettingsSectionCard
      title="Universal SMS Template"
      description="Write one reusable message for your billing workflow."
    >
      <div className="settings-sms-card">
        <label className="settings-sms-field">
          <span>Universal SMS Template</span>
          <textarea
            ref={textareaRef}
            value={smsTemplate}
            onChange={(event) => handleSmsTemplateChange(event.target.value)}
            rows={12}
            placeholder="Write your reusable SMS template..."
          />
        </label>
        <div className="settings-sms-variables">
          <div className="settings-preview-label">Available Variables</div>
          <button
            type="button"
            className="settings-inline-btn"
            onClick={() => setShowSmsVariablesDrawer(true)}
          >
            <Eye size={16} /> Show Variables
          </button>
        </div>
        <div className="settings-action-row">
          <button
            type="button"
            className="settings-inline-btn"
            onClick={() => setShowSmsPreviewPopup(true)}
          >
            <Eye size={16} /> Open Live Preview
          </button>
          <button
            type="button"
            className="settings-inline-btn primary"
            disabled={!smsHasChanges}
            onClick={handleSmsSave}
          >
            <Save size={16} /> Save Template
          </button>
        </div>
      </div>
    </SettingsSectionCard>
  );

  const renderBackup = () => (
    <SettingsSectionCard
      title="Backup & Restore"
      description="Export data or restore from a previously saved snapshot."
    >
      <div className="settings-stack">
        <div className="settings-backup-actions">
          <button
            type="button"
            className="settings-inline-btn"
            onClick={onExportBackup}
          >
            <Download size={16} />
            Export Backup
          </button>
          <input
            ref={backupInputRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={handleImportBackup}
          />
          <button
            type="button"
            className="settings-inline-btn"
            onClick={openImportDialog}
            disabled={isImporting}
          >
            <Upload size={16} />
            {isImporting
              ? "Importing..."
              : importedBackup
                ? "Backup Imported"
                : "Import Backup"}
          </button>
        </div>
        {importedBackup && (
          <div className="settings-backup-preview">
            <div className="settings-backup-header">
              <div className="settings-backup-status-dot" />
              <div>
                <h4>Backup Ready to Restore</h4>
                <p>Backup verified successfully</p>
              </div>
            </div>

            <div className="settings-backup-file">
              <strong>📄 {importedBackup.info.fileName}</strong>
            </div>

            <div className="settings-backup-divider" />

            <div className="settings-backup-list">
              <div className="settings-backup-row">
                <span>👥 Users</span>
                <strong>{importedBackup.info.users}</strong>
              </div>

              <div className="settings-backup-row">
                <span>💳 Payments</span>
                <strong>{importedBackup.info.payments}</strong>
              </div>

              <div className="settings-backup-row">
                <span>📂 Categories</span>
                <strong>{importedBackup.info.categories}</strong>
              </div>

              <div className="settings-backup-row">
                <span>⚙ Settings</span>
                <strong>
                  {importedBackup.info.hasSettings ? "Available ✓" : "None"}
                </strong>
              </div>
            </div>

            <div className="settings-backup-divider" />

            <div className="settings-backup-date">
              <span>📅 Created</span>

              <strong>
                {new Date(importedBackup.info.createdAt).toLocaleString()}
              </strong>
            </div>

            <div className="settings-backup-divider" />

            <div className="settings-backup-ready">
              🟢 Verified & Ready to Restore
            </div>
            <div className="settings-action-row">
              <div className="settings-action-row">
                <button
                  type="button"
                  className="settings-inline-btn primary"
                  onClick={handleRestoreBackup}
                  disabled={restoring}
                >
                  {restoring ? "Restoring..." : "Restore Backup"}
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="settings-info-row">
          <div>
            <strong>Last Backup Time</strong>
            <p>Yesterday • 10:30 PM</p>
          </div>
        </div>
      </div>
    </SettingsSectionCard>
  );

  const renderGuide = () => (
    <SettingsSectionCard
      title="Simple User Guide"
      description="A beginner-friendly guide for using this website easily."
    >
      <div style={{ display: "grid", gap: "16px" }}>
        <div
          style={{
            borderRadius: "20px",
            padding: "18px",
            background:
              "linear-gradient(135deg, var(--primary) 0%, var(--accent-hover) 100%)",
            color: "var(--text-primary)",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              opacity: 0.9,
            }}
          >
            Start here
          </div>
          <h3 style={{ margin: "6px 0 8px", fontSize: "22px" }}>
            Use this website in 4 simple steps
          </h3>
          <p style={{ margin: 0, opacity: 0.95 }}>
            Follow these steps and you can manage customers, payments, and
            reports without confusion.
          </p>

          <div style={{ display: "grid", gap: "8px", marginTop: "12px" }}>
            {[
              {
                title: "1. Login",
                text: "Enter your phone number and passcode to open your account.",
              },
              {
                title: "2. Add or view customers",
                text: "Go to Users to create a customer or update their details.",
              },
              {
                title: "3. Record payments",
                text: "Open Billing Sheet and save payments for the selected month.",
              },
              {
                title: "4. Check reports",
                text: "Use Reports to review yearly billing and payment status.",
              },
            ].map((step) => (
              <div
                key={step.title}
                style={{
                  borderRadius: "12px",
                  padding: "10px 12px",
                  background: "rgba(255,255,255,0.16)",
                }}
              >
                <div style={{ fontWeight: 700 }}>{step.title}</div>
                <div
                  style={{ fontSize: "13px", marginTop: "2px", opacity: 0.95 }}
                >
                  {step.text}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            background: "var(--card)",
            borderRadius: "20px",
            padding: "18px",
            border: "1px solid var(--divider)",
          }}
        >
          <strong>Main pages</strong>
          <div
            style={{
              display: "grid",
              gap: "10px",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              marginTop: "10px",
            }}
          >
            {guideItems.slice(0, 5).map((guide) => {
              const Icon = guide.icon;
              return (
                <button
                  key={guide.id}
                  type="button"
                  onClick={() => handleGuideOpen(guide.id)}
                  style={{
                    textAlign: "left",
                    border: "1px solid var(--divider)",
                    borderRadius: "14px",
                    padding: "12px",
                    background: "var(--card)",
                    cursor: "pointer",
                    color: "var(--text)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <div
                      style={{
                        width: "34px",
                        height: "34px",
                        borderRadius: "10px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "var(--primary-shadow)",
                        color: "var(--primary)",
                      }}
                    >
                      <Icon size={16} />
                    </div>
                    <div style={{ fontWeight: 700 }}>{guide.title}</div>
                  </div>
                  <div
                    style={{
                      fontSize: "13px",
                      color: "var(--text-muted)",
                      marginTop: "6px",
                    }}
                  >
                    {guide.purpose}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div
          style={{
            background: "var(--card)",
            borderRadius: "20px",
            padding: "18px",
            border: "1px solid var(--divider)",
          }}
        >
          <strong>Helpful tips</strong>
          <ul
            style={{
              margin: "10px 0 0 18px",
              padding: 0,
              color: "var(--text-muted)",
              display: "grid",
              gap: "6px",
            }}
          >
            <li>Use the Dashboard to see your daily and monthly summary.</li>
            <li>
              Update customer details carefully so later payments are correct.
            </li>
            <li>Save backups regularly so your data stays safe.</li>
            <li>
              If you are unsure, open the related page and follow the simple
              steps.
            </li>
          </ul>
        </div>

        <div
          style={{
            background: "var(--card)",
            borderRadius: "20px",
            padding: "18px",
            border: "1px solid var(--divider)",
          }}
        >
          <strong>Need help?</strong>
          <div
            style={{
              marginTop: "8px",
              fontSize: "14px",
              color: "var(--text-muted)",
            }}
          >
            Open the page you want to use, then follow the steps above. If you
            still need support, contact the admin or check the related section
            again.
          </div>
        </div>
      </div>
    </SettingsSectionCard>
  );

  const renderRoles = () => (
    <SettingsSectionCard
      title="Role Management"
      description="This section is currently being prepared."
    >
      <div className="settings-disabled-card">
        <Eye size={18} />
        <span>Coming Soon</span>
      </div>
    </SettingsSectionCard>
  );

  const renderDanger = () => (
    <SettingsSectionCard
      title="Danger Zone"
      description="Irreversible actions for this admin workspace."
      tone="danger"
    >
      <div className="settings-stack">
        <button
          type="button"
          className="settings-inline-btn danger"
          onClick={() => {
            setShowDeleteAccountModal(false);
            setShowResetModal(true);
          }}
        >
          Reset Application Data
        </button>

        <button
          type="button"
          className="settings-inline-btn danger"
          onClick={() => {
            setShowResetModal(false);
            setShowDeleteAccountModal(true);
          }}
        >
          Delete Account
        </button>
      </div>
    </SettingsSectionCard>
  );

  return (
    <div className="settings-panel">
      <div className="settings-panel-top">
        <div>
          <p className="settings-eyebrow">Preferences</p>
          <h2>Settings</h2>
          <p className="settings-subtitle">
            Manage your account and application preferences.
          </p>
        </div>
        {hasChanges ? (
          <button
            type="button"
            className="settings-inline-btn primary"
            onClick={handleSave}
          >
            <Save size={16} /> Save Changes
          </button>
        ) : null}
      </div>

      {activeView === "overview" ? (
        renderOverview()
      ) : (
        <div className="settings-detail-shell">
          <button
            type="button"
            className="settings-back-btn"
            onClick={() => setActiveView("overview")}
          >
            <ChevronLeft size={16} /> Back
          </button>
          {activeView === "language" ? renderLanguage() : null}
          {activeView === "profile" ? renderProfile() : null}
          {activeView === "appearance" ? renderAppearance() : null}
          {activeView === "security" ? renderSecurity() : null}
          {activeView === "sms" ? renderSms() : null}
          {activeView === "guide" ? renderGuide() : null}
          {activeView === "backup" ? renderBackup() : null}
          {activeView === "roles" ? renderRoles() : null}
          {activeView === "danger" ? renderDanger() : null}
        </div>
      )}
      {showResetModal && (
        <div className="settings-modal-overlay">
          <div className="settings-modal">
            <h3>Reset Application Data</h3>

            <p>This will permanently delete all your:</p>

            <ul>
              <li>Users</li>
              <li>Payments</li>
              <li>Categories</li>
              <li>Settings</li>
            </ul>

            <p>Your account will remain active.</p>

            <div className="settings-action-row">
              <button
                className="settings-inline-btn"
                onClick={() => setShowResetModal(false)}
                disabled={resetting}
              >
                Cancel
              </button>

              <button
                className="settings-inline-btn danger"
                onClick={handleResetApplication}
                disabled={resetting}
              >
                {resetting ? "Resetting..." : "Reset Data"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showDeleteAccountModal && (
        <div className="settings-modal-overlay">
          <div className="settings-modal">
            <h3>Delete Account</h3>

            <p>This action is permanent and cannot be undone.</p>

            <ul>
              <li>Your account will be permanently deleted.</li>
              <li>All users will be deleted.</li>
              <li>All payments will be deleted.</li>
              <li>All categories will be deleted.</li>
              <li>All settings will be deleted.</li>
            </ul>

            <p>Are you sure you want to continue?</p>

            <div className="settings-action-row">
              <button
                className="settings-inline-btn"
                onClick={() => setShowDeleteAccountModal(false)}
                disabled={deletingAccount}
              >
                Cancel
              </button>

              <button
                className="settings-inline-btn danger"
                onClick={handleDeleteAccount}
                disabled={deletingAccount}
              >
                {deletingAccount ? "Deleting..." : "Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showSmsPreviewPopup && (
        <div className="settings-modal-overlay">
          <div className="settings-modal settings-preview-popup">
            <h3>Live SMS Preview</h3>
            <p>
              Open a preview of your current SMS template in a popup window.
            </p>
            <div className="settings-preview">
              <div className="settings-preview-box settings-preview-text">
                {previewSmsTemplate}
              </div>
            </div>
            <div className="settings-action-row">
              <button
                type="button"
                className="settings-inline-btn"
                onClick={() => setShowSmsPreviewPopup(false)}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
      {showSmsVariablesDrawer && (
        <div
          className="settings-preview-drawer-overlay"
          onClick={() => setShowSmsVariablesDrawer(false)}
        >
          <div
            className="settings-preview-drawer"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="settings-preview-drawer-header">
              <div>
                <h3>Available Variables</h3>
                <p>Use these tokens inside your SMS template.</p>
              </div>
              <button
                type="button"
                className="settings-inline-btn"
                onClick={() => setShowSmsVariablesDrawer(false)}
              >
                Close
              </button>
            </div>
            <div className="settings-variable-badges settings-variable-drawer-badges">
              {smsVariables.map((variable) => (
                <button
                  key={variable.token}
                  type="button"
                  className="settings-variable-badge"
                  onClick={() => {
                    handleInsertVariable(variable.token);
                    setShowSmsVariablesDrawer(false);
                  }}
                >
                  {variable.token}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {showRestoreModal && (
        <div className="settings-modal-overlay">
          <div className="settings-modal">
            <h3>Restore Backup</h3>

            <p>
              Choose how the imported backup should be applied to your current
              account.
            </p>

            <div className="settings-restore-options">
              <label className="settings-restore-option">
                <input
                  type="radio"
                  name="restoreMode"
                  value="keep"
                  checked={restoreMode === "keep"}
                  onChange={() => setRestoreMode("keep")}
                />
                <span>
                  Keep existing data and import backup records as a new copy.
                </span>
              </label>
              <label className="settings-restore-option">
                <input
                  type="radio"
                  name="restoreMode"
                  value="replace"
                  checked={restoreMode === "replace"}
                  onChange={() => setRestoreMode("replace")}
                />
                <span>
                  Replace current data with backup data (delete first).
                </span>
              </label>
            </div>

            <ul>
              <li>Users</li>
              <li>Payments</li>
              <li>Categories</li>
              <li>Settings</li>
            </ul>

            <p>
              <strong>This action cannot be undone.</strong>
            </p>

            <div className="settings-action-row">
              <button
                type="button"
                className="settings-inline-btn"
                onClick={() => setShowRestoreModal(false)}
                disabled={restoring}
              >
                Cancel
              </button>

              <button
                type="button"
                className="settings-inline-btn danger"
                onClick={handleConfirmRestore}
                disabled={restoring}
              >
                {restoring ? "Restoring..." : "Restore Backup"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
