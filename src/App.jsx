import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import MonthlySheet from "./pages/MonthlySheet";
import Reports from "./pages/Reports";
import TransactionHistory from "./pages/TransactionHistory";
import Settings from "./pages/Settings";
function Protected({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="loader">Loading workspace…</div>;
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
        <Route path="/reports" element={<Reports />} />
        <Route path="/history" element={<TransactionHistory />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
