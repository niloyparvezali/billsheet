import { importBackup } from "../../utils/backup/importBackup";
import { useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { doc, setDoc } from "firebase/firestore";
import { resetApplicationData } from "../../utils/backup/resetApplicationData";
import { restoreBackup } from "../../utils/backup/restoreBackup";
import {
  AlertTriangle,
  Camera,
  ChevronLeft,
  CloudUpload,
  Download,
  Eye,
  EyeOff,
  Lock,
  Palette,
  Save,
  ShieldCheck,
  Sparkles,
  UserRound,
  Upload,
  Waves,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { applyTheme, getStoredTheme, normalizeTheme } from "../../utils/theme";
import SettingsSectionCard from "./SettingsSectionCard";
import SettingsTile from "./SettingsTile";

const themeOptions = [
  { id: "forest", label: "🟢 Forest", icon: Waves },
  { id: "ocean", label: "🔵 Ocean", icon: Sparkles },
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
  const [activeView, setActiveView] = useState("overview");
  const [theme, setTheme] = useState(() => getStoredTheme());
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
  const handleRestoreBackup = () => {
    if (!importedBackup) return;

    setShowRestoreModal(true);
  };
  const handleConfirmRestore = async () => {
    if (!importedBackup || !user) return;

    try {
      setRestoring(true);

      await restoreBackup(importedBackup.backup, user);

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
    setTheme(normalizedTheme);
    setHasChanges(true);
    applyTheme(normalizedTheme);
    if (!user?.uid || !db) return;
    try {
      await setDoc(
        doc(db, "settings", user.uid),
        { theme: normalizedTheme },
        { merge: true },
      );
    } catch (error) {
      console.error("Unable to persist theme preference", error);
    }
  };

  const getThemePreview = (themeId) => {
    if (themeId === "ocean") {
      return {
        shell:
          "linear-gradient(135deg, rgba(5, 19, 34, 0.96) 0%, rgba(14, 116, 144, 0.9) 58%, rgba(6, 182, 212, 0.76) 100%)",
        accent: "#22d3ee",
        secondary: "#06b6d4",
        glow: "rgba(34, 211, 238, 0.28)",
      };
    }
    return {
      shell:
        "linear-gradient(135deg, rgba(11, 34, 31, 0.96) 0%, rgba(15, 118, 110, 0.84) 58%, rgba(244, 197, 66, 0.76) 100%)",
      accent: "#f4c542",
      secondary: "#14b8a6",
      glow: "rgba(244, 197, 66, 0.28)",
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
      textarea.focus();
      const caretPosition = start + token.length;
      textarea.setSelectionRange(caretPosition, caretPosition);
    });
  };

  const handleSmsSave = () => {
    setSmsHasChanges(false);
    onSave?.();
    toast.success("SMS template updated successfully.");
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
        icon={UserRound}
        title="Profile"
        description="Manage your account"
        onClick={() => setActiveView("profile")}
      />
      <SettingsTile
        icon={Palette}
        title="Appearance"
        description="Adjust visual theme"
        onClick={() => setActiveView("appearance")}
      />
      <SettingsTile
        icon={Lock}
        title="Security"
        description="Passcode and device access"
        onClick={() => setActiveView("security")}
      />
      <SettingsTile
        icon={Sparkles}
        title="SMS Templates"
        description="Reusable message template"
        onClick={() => setActiveView("sms")}
      />
      <SettingsTile
        icon={CloudUpload}
        title="Backup & Restore"
        description="Export and restore"
        onClick={() => setActiveView("backup")}
      />
      <SettingsTile
        icon={ShieldCheck}
        title="Role Management"
        description="Coming Soon"
        disabled
        onClick={() => setActiveView("roles")}
      />
      <SettingsTile
        icon={AlertTriangle}
        title="Danger Zone"
        description="Sensitive actions"
        onClick={() => setActiveView("danger")}
      />
    </div>
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
          <div className="settings-variable-badges">
            {smsVariables.map((variable) => (
              <button
                key={variable.token}
                type="button"
                className="settings-variable-badge"
                onClick={() => handleInsertVariable(variable.token)}
              >
                {variable.token}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-preview">
          <div className="settings-preview-label">Live Preview</div>
          <div className="settings-preview-box settings-preview-text">
            {previewSmsTemplate}
          </div>
        </div>
        <div className="settings-action-row">
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
          {activeView === "profile" ? renderProfile() : null}
          {activeView === "appearance" ? renderAppearance() : null}
          {activeView === "security" ? renderSecurity() : null}
          {activeView === "sms" ? renderSms() : null}
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
      {showRestoreModal && (
        <div className="settings-modal-overlay">
          <div className="settings-modal">
            <h3>Restore Backup</h3>

            <p>
              This will replace your current application data with the imported
              backup.
            </p>

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
