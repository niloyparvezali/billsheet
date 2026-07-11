import { createContext, useContext, useEffect, useState } from 'react'
import { GoogleAuthProvider, createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth'
import { auth, firebaseReady } from '../firebase/config'
const AuthContext = createContext(null)
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); const [loading, setLoading] = useState(true)
  useEffect(() => { if (!firebaseReady) { setLoading(false); return } return onAuthStateChanged(auth, u => { setUser(u); setLoading(false) }) }, [])
  const value = { user, loading, configured: firebaseReady, login: (email, password) => signInWithEmailAndPassword(auth, email, password), signup: (email, password) => createUserWithEmailAndPassword(auth, email, password), resetPassword: email => sendPasswordResetEmail(auth, email), google: () => signInWithPopup(auth, new GoogleAuthProvider()), logout: () => signOut(auth) }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export const useAuth = () => useContext(AuthContext)
