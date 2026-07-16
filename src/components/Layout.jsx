import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  FiBarChart2,
  FiClock,
  FiFileText,
  FiHome,
  FiLogOut,
  FiMenu,
  FiSettings,
  FiUsers,
  FiX,
} from "react-icons/fi";
import { useAuth } from "../context/AuthContext";

const links = [
  ["/", "Dashboard", FiHome],
  ["/users", "Users", FiUsers],
  ["/monthly-sheet", "Monthly Sheet", FiFileText],
  ["/reports", "Reports", FiBarChart2],
  ["/history", "Transaction History", FiClock],
  ["/settings", "Settings", FiSettings],
];
export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <aside className={open ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <div className="brand-text" aria-label="Bill Sheet">
            <span className="brand-word brand-word-bill">Bill</span>
            <span className="brand-word brand-word-sheet">Sheet</span>
          </div>
          <button
            className="mobile-only icon"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          >
            <FiX />
          </button>
        </div>
        <nav>
          {links.map(([to, label, Icon]) => (
            <NavLink
              end={to === "/"}
              to={to}
              key={to}
              onClick={() => setOpen(false)}
            >
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="admin">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" />
            ) : (
              <b>{(user?.displayName || user?.email || "U").slice(0, 1).toUpperCase()}</b>
            )}
            <div className="admin-meta">
              <strong>{user?.displayName || user?.email || "User"}</strong>
              <small>{user?.companyName || user?.email || "No company yet"}</small>
            </div>
          </div>
          <button onClick={logout}>
            <FiLogOut /> Log out
          </button>
        </div>
      </aside>
      {open && <div className="backdrop" onClick={() => setOpen(false)} />}
      <main>
        <header>
          <button
            className="mobile-only icon"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
          >
            <FiMenu />
          </button>
          <div>
            <h1>Billing Management</h1>
            <p>Stay on top of every monthly collection.</p>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
