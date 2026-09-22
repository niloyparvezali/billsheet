import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { useThemeReady } from "./context/ThemeContext";
import Layout from "./components/Layout";
import LoadingScreen from "./components/LoadingScreen";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import MonthlySheet from "./pages/MonthlySheet";
import TransactionHistory from "./pages/TransactionHistory";
import Settings from "./pages/Settings";
import { firebaseReady, firebaseInitError, firebaseConfigMissingKeys } from "./firebase/config";

function FirebaseUnavailableScreen() {
  const missing = firebaseConfigMissingKeys.length;
  return (
    <div className="app-error">
      <section>
        <h1>Cloud data connection is unavailable</h1>
        <p>BillSheet could not initialize Firebase, so live customer and financial data is unavailable.</p>
        {missing > 0 ? (
          <p>Check the Vercel production environment for the required VITE_FIREBASE_* configuration variables.</p>
        ) : null}
        {firebaseInitError ? (
          <code className="error-detail">Firebase initialization failed. Check the deployment configuration.</code>
        ) : null}
      </section>
    </div>
  );
}

function Protected({ children }) {
  const { user, loading, configured } = useAuth();
  const themeReady = useThemeReady();
  const location = useLocation();
  if (import.meta.env.PROD && !firebaseReady) {
    return <FirebaseUnavailableScreen />;
  }
  if (loading || !themeReady) {
    return <LoadingScreen />;
  }
  if (!configured && import.meta.env.PROD) {
    return <FirebaseUnavailableScreen />;
  }
  return user ? (
    children
  ) : (
    <Navigate to="/login" replace state={{ from: location }} />
  );
}
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/users" element={<Users />} />
        <Route path="/monthly-sheet" element={<MonthlySheet />} />
        <Route path="/history" element={<TransactionHistory />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
