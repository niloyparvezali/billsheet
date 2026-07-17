import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiBriefcase,
  FiCalendar,
  FiLock,
  FiMail,
  FiPhone,
  FiUser,
  FiUserPlus,
} from "react-icons/fi";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";

const keypadDigits = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

const phoneErrorMessage = (value) => {
  if (!value) return "Phone number is required.";
  if (!/^01\d{9}$/.test(value.replace(/\D/g, ""))) {
    return "Use exactly 11 digits starting with 01.";
  }
  return "";
};

const passcodeErrorMessage = (value) => {
  if (!value) return "Passcode is required.";
  if (!/^(?:\d{4}|\d{6})$/.test(value)) {
    return "Use 4 or 6 numeric digits.";
  }
  return "";
};

const formatPhoneDisplay = (value = "") => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (!digits) return "";
  const head = digits.slice(0, 2);
  const middle = digits.slice(2, 6);
  const tail = digits.slice(6);
  return [head, middle, tail].filter(Boolean).join(" ");
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
  const passcodeDisplayRef = useRef(null);
  const [mode, setMode] = useState("login");
  const [busy, setBusy] = useState(false);
  const [activeInput, setActiveInput] = useState("phone");
  const [phone, setPhone] = useState("");
  const [passcode, setPasscode] = useState("");
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

  useEffect(() => {
    if (mode !== "login") return;
    setActiveInput("phone");
    const frame = window.setTimeout(() => phoneInputRef.current?.focus(), 80);
    return () => window.clearTimeout(frame);
  }, [mode]);

  if (user) return <Navigate to={from} replace />;

  const updatePhone = (value) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    setPhone(digits);
    setErrors((current) => ({
      ...current,
      phone: phoneErrorMessage(digits),
    }));
  };

  const updatePasscode = (value) => {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    setPasscode(digits);
    setErrors((current) => ({
      ...current,
      passcode: passcodeErrorMessage(digits),
    }));
  };

  const attemptLogin = async (nextPhone, nextPasscode) => {
    const nextErrors = {
      phone: phoneErrorMessage(nextPhone),
      passcode: passcodeErrorMessage(nextPasscode),
    };
    setErrors(nextErrors);
    if (nextErrors.phone || nextErrors.passcode) return;

    setBusy(true);
    try {
      await signInWithPhoneAndPasscode(nextPhone, nextPasscode);
      toast.success("Signed in successfully.");
      navigate(from, { replace: true });
    } catch (error) {
      toast.error(error.message || "Unable to sign you in right now.");
    } finally {
      setBusy(false);
    }
  };

  const handleKeypadDigit = (digit) => {
    if (activeInput === "phone") {
      const nextPhone = `${phone}${digit}`.replace(/\D/g, "").slice(0, 11);
      updatePhone(nextPhone);
      if (nextPhone.length === 11) {
        setActiveInput("passcode");
        window.setTimeout(() => passcodeDisplayRef.current?.focus(), 80);
      }
      return;
    }
    if (passcode.length >= 6) return;
    const nextPasscode = `${passcode}${digit}`.replace(/\D/g, "").slice(0, 6);
    updatePasscode(nextPasscode);
    if (nextPasscode.length === 4 || nextPasscode.length === 6) {
      void attemptLogin(phone, nextPasscode);
    }
  };

  const handleKeypadDelete = () => {
    if (activeInput === "phone") {
      updatePhone(phone.slice(0, -1));
      return;
    }
    updatePasscode(passcode.slice(0, -1));
  };

  const handleKeypadClear = () => {
    if (activeInput === "phone") {
      updatePhone("");
      return;
    }
    updatePasscode("");
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
          className={`auth-input ${errors.phone ? "error" : ""} ${activeInput === "phone" ? "active" : ""}`}
        >
          <FiPhone />
          <input
            ref={phoneInputRef}
            type="text"
            inputMode="none"
            readOnly
            autoComplete="off"
            value={formatPhoneDisplay(phone)}
            onFocus={() => setActiveInput("phone")}
            onClick={() => setActiveInput("phone")}
            onKeyDown={(event) => event.preventDefault()}
            onPaste={(event) => event.preventDefault()}
            placeholder="Enter Phone Number"
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
          className={`passcode-display ${passcode.length ? "filled" : ""} ${activeInput === "passcode" ? "active" : ""}`}
          onClick={() => setActiveInput("passcode")}
          onFocus={() => setActiveInput("passcode")}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setActiveInput("passcode");
            }
          }}
        >
          {Array.from({ length: 6 }, (_, index) => (
            <span
              key={index}
              className={index < passcode.length ? "dot filled" : "dot"}
            />
          ))}
        </div>
        <div className="keypad" role="group" aria-label="Numeric keypad">
          {keypadDigits.map((digit) => (
            <button
              key={digit}
              type="button"
              className="keypad-btn keypad-btn-number"
              onClick={() => handleKeypadDigit(digit)}
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            className="keypad-btn keypad-btn-backspace"
            onClick={handleKeypadDelete}
            aria-label="Backspace"
          >
            ⌫
          </button>
          <button
            type="button"
            className="keypad-btn keypad-btn-zero"
            onClick={() => handleKeypadDigit("0")}
          >
            0
          </button>
          <button
            type="button"
            className="keypad-btn keypad-btn-clear"
            onClick={handleKeypadClear}
          >
            Clear
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
        <div className={`auth-input ${errors.phone ? "error" : ""}`}>
          <FiPhone />
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={form.phone}
            onChange={(event) => {
              const digits = event.target.value.replace(/\D/g, "").slice(0, 11);
              setForm({ ...form, phone: digits });
              setErrors((current) => ({
                ...current,
                phone: phoneErrorMessage(digits),
              }));
            }}
            placeholder="01XXXXXXXXX"
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
            placeholder="4 or 6 digits"
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
              ? "Open a secure workspace for your billing team and start managing customers, bills, collections, and reports."
              : mode === "forgot"
                ? "Enter your registered phone number to recover your passcode and get back into your workspace."
                : "Manage customers, Monthly bills, Collections, and reports securely."}
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

            {mode !== "login" && (
              <button
                className="primary auth-submit"
                type="submit"
                disabled={busy}
              >
                {busy ? "Please wait..." : "Sign in"}
              </button>
            )}
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
              <div className={`auth-input ${errors.phone ? "error" : ""}`}>
                <FiPhone />
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) => updatePhone(event.target.value)}
                  placeholder="01XXXXXXXXX"
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
              {busy ? "Please wait..." : "Continue"}
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
              <FiUserPlus />
              <span>Create account</span>
            </button>
          ) : mode === "register" ? (
            <button
              type="button"
              className="auth-pill auth-create"
              onClick={() => setMode("login")}
            >
              <FiArrowLeft />
              <span>Back to sign in</span>
            </button>
          ) : null}

          {mode === "login" ? (
            <button
              type="button"
              className="auth-pill auth-forgot"
              onClick={() => setMode("forgot")}
            >
              Forgot passcode
            </button>
          ) : mode === "forgot" ? (
            <button
              type="button"
              className="auth-pill auth-forgot"
              onClick={() => setMode("login")}
            >
              Back to sign in
            </button>
          ) : null}
        </div>
      </section>
    </main>
  );
}
