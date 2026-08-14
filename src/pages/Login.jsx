import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiEye,
  FiEyeOff,
  FiLock,
  FiMail,
  FiUserPlus,
} from "react-icons/fi";
import toast from "react-hot-toast";
import { useAuth, validateEmail } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

const phoneErrorMessage = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "Enter your mobile number.";
  if (!/^\d*$/.test(raw)) return "Numbers only.";
  const digits = raw.replace(/\D/g, "");
  if (digits.length > 11) return "Only 11 digits are allowed.";
  if (digits.length < 11) {
    return `Enter ${11 - digits.length} more digit${11 - digits.length === 1 ? "" : "s"}.`;
  }
  if (!digits.startsWith("01")) return "Number must start with 01.";
  return "";
};

const emailErrorMessage = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "Enter your email address.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return "Enter a valid email address.";
  return "";
};

const passcodeErrorMessage = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "Enter your passcode.";
  if (!/^\d*$/.test(raw)) return "Digits only.";
  if (raw.length < 6) {
    return `Enter ${6 - raw.length} more digit${6 - raw.length === 1 ? "" : "s"}.`;
  }
  if (raw.length > 6) return "Only 6 digits are allowed.";
  return "";
};

const formatPhoneDisplay = (value = "") => {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, 11);
  if (!digits) return "";
  const first = digits.slice(0, 3);
  const second = digits.slice(3, 7);
  const third = digits.slice(7, 11);
  return [first, second, third].filter(Boolean).join(" ");
};

const sanitizePhoneValue = (value = "") => String(value ?? "").replace(/\D/g, "").slice(0, 11);

const handlePhoneKeyDown = (event) => {
  const allowedKeys = [
    "Backspace",
    "Delete",
    "Tab",
    "ArrowLeft",
    "ArrowRight",
    "Home",
    "End",
    "Enter",
  ];
  if (allowedKeys.includes(event.key) || /^\d$/.test(event.key)) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  event.preventDefault();
};

const handlePasscodeKeyDown = (event) => {
  const allowedKeys = [
    "Backspace",
    "Delete",
    "Tab",
    "ArrowLeft",
    "ArrowRight",
    "Home",
    "End",
    "Enter",
  ];
  if (allowedKeys.includes(event.key) || /^\d$/.test(event.key)) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  event.preventDefault();
};

export default function Login() {
  const { t } = useLanguage();
  const {
    user,
    configured,
    signInWithEmailAndPasscode,
    registerWithEmailAndPasscode,
    recoverPasscode,
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const emailInputRef = useRef(null);
  const passcodeInputRef = useRef(null);
  const passcodeDisplayRef = useRef(null);
  const [mode, setMode] = useState("login");
  const [busy, setBusy] = useState(false);
  const [activeInput, setActiveInput] = useState("email");
  const [email, setEmail] = useState("");
  const [passcode, setPasscode] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);
  const [form, setForm] = useState({
    email: "",
    passcode: "",
    confirmPasscode: "",
  });
  const [errors, setErrors] = useState({});
  const from = location.state?.from?.pathname || "/";

  useEffect(() => {
    if (mode !== "login") return;
    setActiveInput("email");
    const frame = window.setTimeout(() => emailInputRef.current?.focus({ preventScroll: true }), 80);
    return () => window.clearTimeout(frame);
  }, [mode]);

  if (user) return <Navigate to={from} replace />;

  const updateEmail = (value) => {
    const trimmed = String(value ?? "").trim();
    setEmail(trimmed);
    setErrors((current) => ({
      ...current,
      email: emailErrorMessage(trimmed),
      login: "",
    }));
  };

  const updatePasscode = (value) => {
    const digits = String(value ?? "").replace(/\D/g, "").slice(0, 6);
    setPasscode(digits);
    setErrors((current) => ({
      ...current,
      passcode: passcodeErrorMessage(digits),
      login: "",
    }));
  };

  const attemptLogin = async (nextEmail, nextPasscode) => {
    const nextErrors = {
      email: emailErrorMessage(nextEmail),
      passcode: passcodeErrorMessage(nextPasscode),
      login: "",
    };
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.passcode) return;

    setBusy(true);
    try {
      await signInWithEmailAndPasscode(nextEmail, nextPasscode);
      toast.success("Signed in successfully.");
      navigate(from, { replace: true });
    } catch (error) {
      const message = error.message || "Email or passcode does not match, or the user does not exist.";
      setErrors((current) => ({
        ...current,
        login: message,
      }));
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const submitLogin = async (event) => {
    event.preventDefault();
    await attemptLogin(email, passcode);
  };

  const submitRegister = async (event) => {
    event.preventDefault();
    const nextErrors = {
      email: emailErrorMessage(form.email),
      passcode: passcodeErrorMessage(form.passcode),
      confirmPasscode:
        form.passcode && form.passcode === form.confirmPasscode
          ? ""
          : "Confirm passcode must match.",
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setBusy(true);
    try {
      await registerWithEmailAndPasscode({
        email: form.email,
        passcode: form.passcode,
        confirmPasscode: form.confirmPasscode,
      });
      setEmail(form.email);
      setPasscode("");
      setMode("login");
      toast.success("Account created successfully. Please login with your email and passcode.");
      navigate("/login", { replace: true });
    } catch (error) {
      toast.error(error.message || "Unable to create your account.");
    } finally {
      setBusy(false);
    }
  };

  const submitForgot = async (event) => {
    event.preventDefault();
    const nextErrors = {
      email: emailErrorMessage(email),
    };
    setErrors(nextErrors);
    if (nextErrors.email) return;

    setBusy(true);
    try {
      await recoverPasscode(email);
      toast.success(
        "If an account exists, a password reset link has been sent to your email.",
      );
      setMode("login");
    } catch (error) {
      toast.error(error.message || "Unable to recover your passcode.");
    } finally {
      setBusy(false);
    }
  };

  const renderLoginFields = () => (
    <>
      <label className="auth-field">
        <span>{t("email", "Email")}</span>
        <div
          className={`auth-input ${errors.email ? "error" : ""} ${activeInput === "email" ? "active" : ""}`}
        >
          <FiMail />
          <input
            ref={emailInputRef}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onFocus={() => setActiveInput("email")}
            onClick={() => setActiveInput("email")}
            onChange={(event) => {
              updateEmail(event.target.value);
            }}
            onPaste={(event) => {
              event.preventDefault();
              const pasted = event.clipboardData?.getData("text") || "";
              updateEmail(pasted);
            }}
            placeholder="you@example.com"
            aria-label="Email address"
          />
        </div>
        {errors.email ? (
          <small className="auth-error">{errors.email}</small>
        ) : null}
      </label>

      <div className="auth-field">
        <span>{t("passcode", "Passcode")}</span>
        <div
          ref={passcodeDisplayRef}
          role="button"
          tabIndex={0}
          className={`passcode-display ${passcode.length ? "filled" : ""} ${activeInput === "passcode" ? "active" : ""} ${showPasscode ? "revealed" : ""}`}
          onClick={() => {
            setActiveInput("passcode");
            passcodeInputRef.current?.focus({ preventScroll: true });
          }}
          onFocus={() => setActiveInput("passcode")}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setActiveInput("passcode");
              passcodeInputRef.current?.focus({ preventScroll: true });
            }
          }}
        >
          <input
            ref={passcodeInputRef}
            type={showPasscode ? "text" : "password"}
            inputMode="numeric"
            autoComplete="current-password"
            maxLength={6}
            pattern="[0-9]*"
            value={passcode}
            onChange={(event) => updatePasscode(event.target.value)}
            onFocus={() => setActiveInput("passcode")}
            onKeyDown={handlePasscodeKeyDown}
            onPaste={(event) => {
              event.preventDefault();
              updatePasscode(event.clipboardData?.getData("text") || "");
            }}
            className={`passcode-input ${showPasscode ? "revealed" : ""}`}
            aria-label="Passcode"
            placeholder="••••••"
          />
          <div className="passcode-visual" aria-hidden="true">
            {Array.from({ length: 6 }, (_, index) => (
              <span
                key={index}
                className={index < passcode.length ? "dot filled" : "dot"}
              />
            ))}
          </div>
          <button
            type="button"
            className="auth-passcode-toggle"
            onClick={(event) => {
              event.stopPropagation();
              setShowPasscode((current) => !current);
            }}
            aria-label={showPasscode ? "Hide passcode" : "Show passcode"}
          >
            {showPasscode ? <FiEye /> : <FiEyeOff />}
          </button>
        </div>
        {errors.passcode ? (
          <small className="auth-error">{errors.passcode}</small>
        ) : null}
      </div>
    </>
  );

  const renderRegisterFields = () => (
    <>
      <label className="auth-field">
        <span>{t("email", "Email")}</span>
        <div className={`auth-input ${errors.email ? "error" : ""}`}>
          <FiMail />
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={form.email}
            onChange={(event) =>
              setForm({ ...form, email: event.target.value })
            }
            placeholder="you@example.com"
          />
        </div>
        {errors.email ? (
          <small className="auth-error">{errors.email}</small>
        ) : null}
      </label>
      <label className="auth-field">
        <span>{t("passcode", "Passcode")}</span>
        <div className={`auth-input ${errors.passcode ? "error" : ""}`}>
          <FiLock />
          <input
            type="password"
            inputMode="numeric"
            value={form.passcode}
            onChange={(event) => {
              const digits = event.target.value.replace(/\D/g, "").slice(0, 6);
              setForm({ ...form, passcode: digits });
              setErrors((current) => ({
                ...current,
                passcode: passcodeErrorMessage(digits),
              }));
            }}
            placeholder="6 digits"
          />
        </div>
        {errors.passcode ? (
          <small className="auth-error">{errors.passcode}</small>
        ) : null}
      </label>
      <label className="auth-field">
        <span>{t("confirm_passcode", "Confirm passcode")}</span>
        <div className={`auth-input ${errors.confirmPasscode ? "error" : ""}`}>
          <FiLock />
          <input
            type="password"
            inputMode="numeric"
            value={form.confirmPasscode}
            onChange={(event) => {
              const digits = event.target.value.replace(/\D/g, "").slice(0, 6);
              setForm({ ...form, confirmPasscode: digits });
              setErrors((current) => ({
                ...current,
                confirmPasscode:
                  form.passcode && digits === form.passcode
                    ? ""
                    : "Confirm passcode must match.",
              }));
            }}
            placeholder="Repeat passcode"
          />
        </div>
        {errors.confirmPasscode ? (
          <small className="auth-error">{errors.confirmPasscode}</small>
        ) : null}
      </label>
    </>
  );

  return (
    <main className="login-shell">
      <section className="auth-panel">
        <div className="auth-brand">
          <div className="logo">
            <span className="logo-line"></span>

            <h1 className="logo-title">
              <span className="logo-bill">Bill</span>
              <span className="logo-sheet">Sheet</span>
            </h1>

            <span className="logo-line"></span>
          </div>

          <p className="auth-brand-subtitle">{t("login_subtitle", "Secure workspace")}</p>
        </div>
        <div className="auth-intro">
          <h2>
            {mode === "register"
              ? t("register")
              : mode === "forgot"
                ? t("forgot_passcode", "Recover access")
                : t("welcome_back", "Welcome back")}
          </h2>

          <p>
            {mode === "register"
              ? t("register_description", "Open a secure workspace for your billing team and start managing customers, bills, and reports.")
              : mode === "forgot"
                ? t("forgot_description", "Enter your registered email address to recover your passcode and get back into your workspace.")
                : t("login_description", "Manage customers, Monthly bills, and reports securely.")}
          </p>
        </div>
        {!configured && (
          <div className="notice auth-notice">
            Authentication is running in demo mode. Your account data will be
            stored locally in this browser.
          </div>
        )}
        {mode === "login" ? (
          <form onSubmit={submitLogin} className="auth-form">
            {renderLoginFields()}
            <button
              className="primary auth-submit auth-submit-login"
              type="submit"
              disabled={busy}
            >
              {busy ? t("loading", "Please wait...") : t("sign_in", "Sign in")}
            </button>
            {errors.login ? (
              <small className="auth-error">{errors.login}</small>
            ) : null}
            
            <div className="auth-inline-actions">
              <button
                type="button"
                className="auth-pill auth-create"
                onClick={() => setMode("register")}
              >
                <FiUserPlus className="auth-pill-icon" />
                <span>{t("create_account", "Create account")}</span>
              </button>
            </div>
          </form>
        ) : mode === "register" ? (
          <form onSubmit={submitRegister} className="auth-form">
            {renderRegisterFields()}
            <button
              className="primary auth-submit"
              type="submit"
              disabled={busy}
            >
              {busy ? t("loading", "Please wait...") : t("create_account", "Create account")}
            </button>
          </form>
        ) : (
          <form onSubmit={submitForgot} className="auth-form">
            <label className="auth-field">
              <span>{t("email", "Registered email address")}</span>
              <div className={`auth-input ${errors.email ? "error" : ""}`}>
                <FiMail />
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => updateEmail(event.target.value)}
                  onPaste={(event) => {
                    event.preventDefault();
                    updateEmail(event.clipboardData?.getData("text") || "");
                  }}
                  placeholder="you@example.com"
                  aria-label="Registered email address"
                />
              </div>
              {errors.email ? (
                <small className="auth-error">{errors.email}</small>
              ) : null}
            </label>
            <button
              className="primary auth-submit"
              type="submit"
              disabled={busy}
            >
              {busy ? t("loading", "Please wait...") : t("send_reset_link", "Send Reset Link")}
            </button>
          </form>
        )}
        <div className="auth-footer">
          {mode === "login" ? (
            <button
              type="button"
              className="auth-pill auth-forgot"
              onClick={() => setMode("forgot")}
            >
              <span>{t("forgot_passcode", "Forgot passcode")}</span>
            </button>
          ) : mode === "register" ? (
            <button
              type="button"
              className="auth-pill auth-create"
              onClick={() => setMode("login")}
            >
              <FiArrowLeft className="auth-pill-icon" />
              <span>{t("back_to_sign_in", "Back to sign in")}</span>
            </button>
          ) : (
            <button
              type="button"
              className="auth-pill auth-forgot"
              onClick={() => setMode("login")}
            >
              <span>{t("back_to_sign_in", "Back to sign in")}</span>
            </button>
          )}
        </div>
        {mode === "forgot" && (
          <p className="auth-help-text">
            Didn't receive the email?
            <br />
            Please check your <strong>Spam/Junk</strong> folder.
          </p>
        )}
      </section>
    </main>
  );
}
