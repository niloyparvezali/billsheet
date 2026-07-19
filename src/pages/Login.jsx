import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiBriefcase,
  FiCalendar,
  FiEye,
  FiEyeOff,
  FiLock,
  FiMail,
  FiPhone,
  FiUser,
  FiUserPlus,
} from "react-icons/fi";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";

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
  const {
    user,
    configured,
    signInWithPhoneAndPasscode,
    registerWithPhoneAndPasscode,
    recoverPasscode,
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const phoneInputRef = useRef(null);
  const passcodeInputRef = useRef(null);
  const passcodeDisplayRef = useRef(null);
  const [mode, setMode] = useState("login");
  const [busy, setBusy] = useState(false);
  const [activeInput, setActiveInput] = useState("phone");
  const [phone, setPhone] = useState("");
  const [passcode, setPasscode] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    companyName: "",
    email: "",
    phone: "",
    passcode: "",
    confirmPasscode: "",
    dob: "",
  });
  const [errors, setErrors] = useState({});
  const from = location.state?.from?.pathname || "/";
  const autoLoginAttemptedRef = useRef("");

  useEffect(() => {
    if (mode !== "login") return;
    setActiveInput("phone");
    const frame = window.setTimeout(() => phoneInputRef.current?.focus(), 80);
    return () => window.clearTimeout(frame);
  }, [mode]);

  useEffect(() => {
    if (mode !== "login" || busy) return;
    const phoneIsValid = !phoneErrorMessage(phone);
    const passcodeIsValid = !passcodeErrorMessage(passcode);
    if (!phoneIsValid || !passcodeIsValid) return;

    const signature = `${phone}|${passcode}`;
    if (autoLoginAttemptedRef.current === signature) return;

    autoLoginAttemptedRef.current = signature;
    void attemptLogin(phone, passcode);
  }, [busy, mode, phone, passcode]);

  if (user) return <Navigate to={from} replace />;

  const updatePhone = (value) => {
    const digits = sanitizePhoneValue(value);
    setPhone(digits);
    setErrors((current) => ({
      ...current,
      phone: phoneErrorMessage(digits),
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

  const attemptLogin = async (nextPhone, nextPasscode) => {
    const nextErrors = {
      phone: phoneErrorMessage(nextPhone),
      passcode: passcodeErrorMessage(nextPasscode),
      login: "",
    };
    setErrors(nextErrors);
    if (nextErrors.phone || nextErrors.passcode) return;

    setBusy(true);
    try {
      await signInWithPhoneAndPasscode(nextPhone, nextPasscode);
      toast.success("Signed in successfully.");
      navigate(from, { replace: true });
    } catch (error) {
      const message = error.message || "Phone number or passcode does not match, or the user does not exist.";
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
    await attemptLogin(phone, passcode);
  };

  const submitRegister = async (event) => {
    event.preventDefault();
    const nextErrors = {
      fullName: form.fullName.trim() ? "" : "Full name is required.",
      companyName: form.companyName.trim() ? "" : "Company name is required.",
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
        ? ""
        : "Use a valid email address.",
      phone: phoneErrorMessage(form.phone),
      passcode: passcodeErrorMessage(form.passcode),
      confirmPasscode:
        form.passcode && form.passcode === form.confirmPasscode
          ? ""
          : "Confirm passcode must match.",
      dob: form.dob ? "" : "Date of birth is required.",
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setBusy(true);
    try {
      await registerWithPhoneAndPasscode({
        fullName: form.fullName,
        companyName: form.companyName,
        email: form.email,
        phone: form.phone,
        passcode: form.passcode,
        confirmPasscode: form.confirmPasscode,
        dob: form.dob,
      });
      toast.success("Account created securely.");
      navigate(from, { replace: true });
    } catch (error) {
      toast.error(error.message || "Unable to create your account.");
    } finally {
      setBusy(false);
    }
  };

  const submitForgot = async (event) => {
    event.preventDefault();
    const nextErrors = {
      phone: phoneErrorMessage(phone),
    };
    setErrors(nextErrors);
    if (nextErrors.phone) return;

    setBusy(true);
    try {
      await recoverPasscode(phone);
      toast.success(
        "If an account exists, verification has been sent to the linked email.",
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
        <span>Phone number</span>
        <div
          className={`auth-input auth-input-phone ${errors.phone ? "error" : ""} ${activeInput === "phone" ? "active" : ""}`}
        >
          <FiPhone />
          <input
            ref={phoneInputRef}
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            maxLength={13}
            pattern="[0-9]*"
            value={formatPhoneDisplay(phone)}
            onFocus={() => setActiveInput("phone")}
            onClick={() => setActiveInput("phone")}
            onKeyDown={handlePhoneKeyDown}
            onChange={(event) => {
              const digits = sanitizePhoneValue(event.target.value);
              updatePhone(digits);
            }}
            onPaste={(event) => {
              event.preventDefault();
              const pasted = sanitizePhoneValue(event.clipboardData?.getData("text") || "");
              updatePhone(pasted);
            }}
            placeholder="01X XXXX XXXX"
            aria-label="Phone number"
          />
        </div>
        {errors.phone ? (
          <small className="auth-error">{errors.phone}</small>
        ) : null}
      </label>

      <div className="auth-field">
        <span>Passcode</span>
        <div
          ref={passcodeDisplayRef}
          role="button"
          tabIndex={0}
          className={`passcode-display ${passcode.length ? "filled" : ""} ${activeInput === "passcode" ? "active" : ""} ${showPasscode ? "revealed" : ""}`}
          onClick={() => {
            setActiveInput("passcode");
            passcodeInputRef.current?.focus();
          }}
          onFocus={() => setActiveInput("passcode")}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setActiveInput("passcode");
              passcodeInputRef.current?.focus();
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
        <span>Full name</span>
        <div className={`auth-input ${errors.fullName ? "error" : ""}`}>
          <FiUser />
          <input
            type="text"
            value={form.fullName}
            onChange={(event) =>
              setForm({ ...form, fullName: event.target.value })
            }
            placeholder="John Doe"
          />
        </div>
        {errors.fullName ? (
          <small className="auth-error">{errors.fullName}</small>
        ) : null}
      </label>
      <label className="auth-field">
        <span>Company name</span>
        <div className={`auth-input ${errors.companyName ? "error" : ""}`}>
          <FiBriefcase />
          <input
            type="text"
            value={form.companyName}
            onChange={(event) =>
              setForm({ ...form, companyName: event.target.value })
            }
            placeholder="ABC Internet Service"
          />
        </div>
        {errors.companyName ? (
          <small className="auth-error">{errors.companyName}</small>
        ) : null}
      </label>
      <label className="auth-field">
        <span>Email</span>
        <div className={`auth-input ${errors.email ? "error" : ""}`}>
          <FiMail />
          <input
            type="email"
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
        <span>Phone number</span>
        <div className={`auth-input auth-input-phone ${errors.phone ? "error" : ""}`}>
          <FiPhone />
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            maxLength={13}
            pattern="[0-9]*"
            value={form.phone}
            onChange={(event) => {
              const digits = sanitizePhoneValue(event.target.value);
              setForm({ ...form, phone: digits });
              setErrors((current) => ({
                ...current,
                phone: phoneErrorMessage(digits),
              }));
            }}
            onKeyDown={handlePhoneKeyDown}
            onPaste={(event) => {
              event.preventDefault();
              const digits = sanitizePhoneValue(event.clipboardData?.getData("text") || "");
              setForm({ ...form, phone: digits });
              setErrors((current) => ({
                ...current,
                phone: phoneErrorMessage(digits),
              }));
            }}
            placeholder="015 6006 0333"
            aria-label="Phone number"
          />
        </div>
        {errors.phone ? (
          <small className="auth-error">{errors.phone}</small>
        ) : null}
      </label>
      <label className="auth-field">
        <span>Passcode</span>
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
        <span>Confirm passcode</span>
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
      <label className="auth-field">
        <span>Date of birth</span>
        <div className={`auth-input ${errors.dob ? "error" : ""}`}>
          <FiCalendar />
          <input
            type="date"
            value={form.dob}
            onChange={(event) => setForm({ ...form, dob: event.target.value })}
          />
        </div>
        {errors.dob ? <small className="auth-error">{errors.dob}</small> : null}
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

          <p className="auth-brand-subtitle">Secure workspace</p>
        </div>
        <div className="auth-intro">
          <h2>
            {mode === "register"
              ? "Create your account"
              : mode === "forgot"
                ? "Recover access"
                : "Welcome back"}
          </h2>

          <p>
            {mode === "register"
              ? "Open a secure workspace for your billing team and start managing customers, bills, and reports."
              : mode === "forgot"
                ? "Enter your registered phone number to recover your passcode and get back into your workspace."
                : "Manage customers, Monthly bills, and reports securely."}
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
              {busy ? "Please wait..." : "Sign in"}
            </button>
            {errors.login ? (
              <small className="auth-error">{errors.login}</small>
            ) : null}
          </form>
        ) : mode === "register" ? (
          <form onSubmit={submitRegister} className="auth-form">
            {renderRegisterFields()}
            <button
              className="primary auth-submit"
              type="submit"
              disabled={busy}
            >
              {busy ? "Please wait..." : "Create account"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitForgot} className="auth-form">
            <label className="auth-field">
              <span>Registered phone number</span>
              <div className={`auth-input auth-input-phone ${errors.phone ? "error" : ""}`}>
                <FiPhone />
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={13}
                  pattern="[0-9]*"
                  value={phone}
                  onChange={(event) => updatePhone(event.target.value)}
                  onKeyDown={handlePhoneKeyDown}
                  onPaste={(event) => {
                    event.preventDefault();
                    updatePhone(event.clipboardData?.getData("text") || "");
                  }}
                  placeholder="015 6006 0333"
                  aria-label="Registered phone number"
                />
              </div>
              {errors.phone ? (
                <small className="auth-error">{errors.phone}</small>
              ) : null}
            </label>
            <button
              className="primary auth-submit"
              type="submit"
              disabled={busy}
            >
              {busy ? "Please wait..." : "Send Reset Link"}
            </button>
          </form>
        )}
        <div className="auth-footer">
          {mode === "login" ? (
            <button
              type="button"
              className="auth-pill auth-create"
              onClick={() => setMode("register")}
            >
              <FiUserPlus className="auth-pill-icon" />
              <span>Create account</span>
            </button>
          ) : mode === "register" ? (
            <button
              type="button"
              className="auth-pill auth-create"
              onClick={() => setMode("login")}
            >
              <FiArrowLeft className="auth-pill-icon" />
              <span>Back to sign in</span>
            </button>
          ) : null}

          {mode === "login" ? (
            <button
              type="button"
              className="auth-pill auth-forgot"
              onClick={() => setMode("forgot")}
            >
              <span>Forgot passcode</span>
            </button>
          ) : mode === "forgot" ? (
            <button
              type="button"
              className="auth-pill auth-forgot"
              onClick={() => setMode("login")}
            >
              <span>Back to sign in</span>
            </button>
          ) : null}
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
