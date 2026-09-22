import { NavLink, Outlet } from "react-router-dom";
import {
  FiClock,
  FiFileText,
  FiHome,
  FiLogOut,
  FiSettings,
  FiUsers,
} from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

export default function Layout() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();

  const links = [
    ["/", t("dashboard"), FiHome],
    ["/users", t("users"), FiUsers],
    ["/monthly-sheet", t("monthly_sheet"), FiFileText],
    ["/history", t("transaction_history"), FiClock],
    ["/settings", t("settings"), FiSettings],
  ];

  const mobileLinks = [
    links[0],
    links[2],
    links[1],
    links[3],
    links[4],
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-text" aria-label="Bill Sheet">
            <span className="brand-word brand-word-bill">Bill</span>
            <span className="brand-word brand-word-sheet">Sheet</span>
          </div>
        </div>
        <nav>
          {links.map(([to, label, Icon]) => (
            <NavLink end={to === "/"} to={to} key={to}>
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

      <main>
        <header>
          <div>
            <h1>{t("app_title")}</h1>
            <p>{t("stay_on_top", "Stay on top of every monthly collection.")}</p>
          </div>
        </header>
        <Outlet />
      </main>

      <nav className="mobile-bottom-nav" aria-label="Primary mobile navigation">
        {mobileLinks.map(([to, label, Icon]) => (
          <NavLink
            end={to === "/"}
            to={to}
            key={`mobile-${to}`}
            className={({ isActive }) =>
              isActive ? "mobile-bottom-nav-item active" : "mobile-bottom-nav-item"
            }
            aria-label={label}
            title={label}
          >
            <Icon aria-hidden="true" focusable="false" />
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
