import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { FcGoogle } from 'react-icons/fc'
import { FiArrowRight, FiLock, FiMail } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

const message = (error) => {
  const errorMap = {
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/user-not-found': 'No account exists with this email. Create one below.',
    'auth/wrong-password': 'Incorrect email or password.',
    'auth/email-already-in-use': 'An account already exists with this email. Please sign in.',
    'auth/weak-password': 'Use a password with at least 6 characters.',
    'auth/operation-not-allowed': 'Enable this sign-in method in Firebase Authentication.',
    'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
    'auth/popup-blocked': 'Your browser blocked the Google window. Allow popups and try again.',
    'auth/too-many-requests': 'Too many attempts. Please wait a few minutes, then try once more.',
    'auth/user-disabled': 'This user account has been disabled.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
  }

  if (!error) return 'An unknown authentication error occurred.'
  const fallback = typeof error.message === 'string' ? error.message.replace('Firebase: ', '') : 'An unexpected error occurred.'
  return errorMap[error.code] || fallback
}

export default function Login() {
  const { login, signup, resetPassword, google, user, configured } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [register, setRegister] = useState(false)
  const from = location.state?.from?.pathname || '/'

  if (user) return <Navigate to={from} replace />

  const submit = async event => {
    event.preventDefault()
    setBusy(true)
    try {
      await (register ? signup : login)(form.email, form.password)
      toast.success(register ? 'Account created. You are signed in.' : 'Signed in successfully.')
      navigate(from, { replace: true })
    } catch (error) {
      toast.error(message(error))
    } finally {
      setBusy(false)
    }
  }
  const googleLogin = async () => {
    setBusy(true)
    try {
      await google()
      toast.success('Signed in with Google.')
      navigate(from, { replace: true })
    } catch (error) {
      toast.error(message(error))
    } finally {
      setBusy(false)
    }
  }

  const forgot = async () => {
    if (!configured) return toast.error('Firebase is not configured.')
    if (!form.email) return toast.error('Enter your email address first.')
    try {
      await resetPassword(form.email)
      toast.success('Password-reset email sent.')
    } catch (error) {
      toast.error(message(error))
    }
  }

  return <main className="login login-minimal">
    <section className="auth-card">
      <div className="auth-brand"><b>Bill</b><b>Sheet</b></div>
      <div className="auth-heading"><span>{register ? 'CREATE ACCOUNT' : 'WELCOME BACK'}</span><h1>{register ? 'Start managing with clarity.' : 'Sign in to your workspace.'}</h1><p>{register ? 'Your billing records, all in one place.' : 'Your customers, payments, and reports are waiting.'}</p></div>
      {!configured && <div className="notice">Add Firebase values to <code>.env.local</code>, then restart the dev server.</div>}
      <form onSubmit={submit}>
        <label>Email address<div className="auth-input"><FiMail /><input type="email" autoComplete="email" placeholder="you@example.com" required value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></div></label>
        <label>Password<div className="auth-input"><FiLock /><input type="password" autoComplete={register ? 'new-password' : 'current-password'} placeholder="Enter your password" minLength="6" required value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} /></div></label>
        <button className="primary auth-submit" disabled={busy || !configured}>{busy ? 'Please wait...' : register ? 'Create account' : <>Sign in <FiArrowRight /></>}</button>
      </form>
      {!register && (
        <button
          className="text-button auth-forgot"
          type="button"
          disabled={busy || !configured}
          onClick={forgot}
        >
          Forgot password?
        </button>
      )}
      <div className="or">or</div>
      <button
        className="google"
        disabled={busy || !configured}
        onClick={googleLogin}
      >
        <FcGoogle /> Continue with Google
      </button>
      <p className="auth-switch">{register ? 'Already have an account?' : 'New to BillSheet?'} <button type="button" onClick={() => setRegister(!register)}>{register ? 'Sign in' : 'Create account'}</button></p>
      <small className="hint">Google sign-in requires the Google provider to be enabled in Firebase Authentication.</small>
    </section>
  </main>
}