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
    const theme = localStorage.theme || "light";
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <aside className={open ? "sidebar open" : "sidebar"}>
        <div className="brand">
          Bill<span>Sheet</span>
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
              <b>{user?.email?.[0]?.toUpperCase()}</b>
            )}
            <small>{user?.email}</small>
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
