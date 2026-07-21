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
import { useLanguage } from "../context/LanguageContext";

export default function Layout() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const links = [
    ["/", t("dashboard"), FiHome],
    ["/users", t("users"), FiUsers],
    ["/monthly-sheet", t("monthly_sheet"), FiFileText],
    ["/reports", t("reports"), FiBarChart2],
    ["/history", t("transaction_history"), FiClock],
    ["/settings", t("settings"), FiSettings],
  ];

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
              <small>{user?.companyName || user?.email || "BillSheet"}</small>
            </div>
          </div>
          <button onClick={logout}>
            <FiLogOut /> {t("logout")}
          </button>
        </div>
      </aside>
      {open && <div className="backdrop" onClick={() => setOpen(false)} />}
      <main>
        <header>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              className="mobile-only icon"
              aria-label="Open menu"
              onClick={() => setOpen(true)}
            >
              <FiMenu />
            </button>
            <div>
              <h1>{t("app_title")}</h1>
              <p>{t("stay_on_top", "Stay on top of every monthly collection.")}</p>
            </div>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}

