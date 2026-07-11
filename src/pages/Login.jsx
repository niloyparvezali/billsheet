import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { FcGoogle } from 'react-icons/fc'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
const message = e => ({
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/user-not-found': 'No account exists with this email. Create one below.',
  'auth/email-already-in-use': 'An account already exists with this email. Please sign in.',
  'auth/weak-password': 'Use a password with at least 6 characters.',
  'auth/operation-not-allowed': 'Enable this sign-in method in Firebase Authentication.',
  'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
  'auth/popup-blocked': 'Your browser blocked the Google window. Allow popups and try again.',
  'auth/too-many-requests': 'Too many attempts. Please wait a few minutes, then try once.'
}[e.code] || e.message.replace('Firebase: ', ''))
export default function Login() {
  const { login, signup, resetPassword, google, user, configured } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' }); const [busy, setBusy] = useState(false); const [register, setRegister] = useState(false)
  if (user) return <Navigate to="/" />
  const submit = async e => { e.preventDefault(); setBusy(true); try { await (register ? signup : login)(form.email, form.password); toast.success(register ? 'Account created. You are signed in.' : 'Signed in successfully.') } catch (e) { toast.error(message(e)) } finally { setBusy(false) } }
  const googleLogin = async () => { setBusy(true); try { await google(); toast.success('Signed in with Google.') } catch (e) { toast.error(message(e)) } finally { setBusy(false) } }
  const forgot = async () => { if (!form.email) return toast.error('Enter your email address first.'); try { await resetPassword(form.email); toast.success('Password-reset email sent.') } catch (e) { toast.error(message(e)) } }
  return <div className="login"><section><div className="brand">Bill<span>Sheet</span></div><h1>{register ? 'Create account' : 'Welcome back'}</h1><p>{register ? 'Create an account to manage your billing records.' : 'Sign in to manage your billing records.'}</p>{!configured && <div className="notice">Add Firebase values to <code>.env.local</code>, then restart the dev server.</div>}<form onSubmit={submit}><label>Email<input type="email" autoComplete="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label><label>Password<input type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength="6" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></label><button className="primary" disabled={busy || !configured}>{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</button></form>{!register && <button className="text-button" type="button" onClick={forgot}>Forgot password?</button>}<div className="or">or</div><button className="google" disabled={busy || !configured} onClick={googleLogin}><FcGoogle /> Continue with Google</button><button className="switch-auth" type="button" onClick={() => setRegister(!register)}>{register ? 'Already have an account? Sign in' : 'New here? Create an account'}</button><small className="hint">Google sign-in requires the Google provider to be enabled in Firebase Authentication.</small></section></div>
}
