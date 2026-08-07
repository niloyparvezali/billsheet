import { memo } from "react";
import { FiChevronRight, FiEdit2, FiTrash2 } from "react-icons/fi";
import StatusBadge from "./StatusBadge";
import { getDisplayPackages } from "../utils/users";
import { useLanguage } from "../context/LanguageContext";
import { formatDateOrNotAvailable, getCreatedDate } from "../utils/date";

const MobileUserRow = memo(function MobileUserRow({
  user,
  isSelected,
  onSelect,
  getUserStatusValue,
}) {
  const statusValue = getUserStatusValue(user);
  const packages = getDisplayPackages(user);
  const initials = String(user?.name || "CU")
    .trim()
    .slice(0, 2)
    .toUpperCase();

  return (
    <button
      type="button"
      className={`users-mobile-item${isSelected ? " users-mobile-item--active" : ""}`}
      onClick={() => onSelect(user.id)}
    >
      <div className="users-mobile-avatar" aria-hidden="true">
        {initials}
      </div>
      <div className="users-mobile-item-content">
        <div className="users-mobile-item-top">
          <div className="users-mobile-item-title">
            {user.name || "Unnamed customer"}
          </div>
        </div>
        <div className="users-mobile-item-meta">
          <span>{user.phone || "No phone on file"}</span>
          <span>{packages[0] || user.category || "Uncategorized"}</span>
        </div>
      </div>
      <div className="users-mobile-item-status">
        <StatusBadge
          status={statusValue}
          className="user-inline-badge user-inline-badge--status"
        />
      </div>
      <FiChevronRight className="users-mobile-item-chevron" />
    </button>
  );
});

export default function UsersTable({
  list,
  setForm,
  setDeleteUser,
  onAddPayment,
  onViewHistory,
  onViewAnnualReport,
  formatDate,
  currentPage,
  setCurrentPage,
  totalPages,
  totalUsers,
  startIndex,
  endIndex,
  onSelectUser,
  selectedUserId,
}) {
  const { t, formatMoney, formatNumber } = useLanguage();

  const getUserStatusValue = (user) => {
    const rawStatus = user?.status;
    const statusValue = String(
      rawStatus !== undefined && rawStatus !== null
        ? rawStatus
        : user?.active === false
        ? "Inactive"
        : "Active",
    )
      .trim()
      .toLowerCase();

    if (["n/a", "na", "none", "not joined"].includes(statusValue)) {
      return "Inactive";
    }

    return statusValue === "inactive" ? "Inactive" : "Active";
  };

  const getUserStatusBadge = (user) => {
    const status = getUserStatusValue(user);
    return {
      label: status,
      className: `status user-inline-badge status-${status.toLowerCase()}`,
    };
  };

  const renderPackageChips = (user) => {
    const packageChips = getDisplayPackages(user);
    return packageChips.length > 0 ? (
      packageChips.map((item) => (
        <span className="user-category" key={item}>
          {item}
        </span>
      ))
    ) : (
      <span className="user-category">{t("uncategorized", "Uncategorized")}</span>
    );
  };

  return (
    <div className="table-wrap">
      <table className="users-table">
        <thead>
          <tr>
            <th style={{ width: "70px" }}>SL</th>
            <th>{t("name")}</th>
            <th style={{ width: "230px" }}>{t("package_category", "Package / Category")}</th>
            <th style={{ width: "170px" }}>{t("amount")}</th>
            <th style={{ width: "140px" }}>{t("status")}</th>
            <th style={{ width: "190px" }}>{t("phone")}</th>
            <th style={{ width: "170px" }}>{t("created", "Created")}</th>
            <th className="actions-header">{t("actions")}</th>
          </tr>
        </thead>
        <tbody>
          {list.map((user, i) => (
            <tr key={user.id}>
              <td data-label="SL">{formatNumber(i + 1)}</td>
              <td data-label={t("name")}>
                <strong className="user-name">{user.name}</strong>
              </td>
              <td data-label={t("package_category", "Package / Category")}>
                <div className="user-package-list">{renderPackageChips(user)}</div>
              </td>
              <td data-label={t("amount")}>{formatMoney(user.monthlyBill)}</td>
              <td data-label={t("status")}>
                <span className={getUserStatusBadge(user).className}>
                  {getUserStatusBadge(user).label}
                </span>
              </td>
              <td data-label={t("phone")}>{user.phone || "—"}</td>
              <td data-label={t("created", "Created")}>{formatDateOrNotAvailable(getCreatedDate(user))}</td>
              <td className="actions actions-cell" data-label={t("actions")}>
                <button onClick={() => setForm(user)} title={t("Edit")}>
                  <FiEdit2 />
                </button>
                <button className="danger" onClick={() => setDeleteUser(user)} title={t("Delete user")}>
                  <FiTrash2 />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="users-mobile-shell">
        <div className="users-mobile-list" role="list">
          {list.map((user) => (
            <MobileUserRow
              key={user.id}
              user={user}
              isSelected={selectedUserId === user.id}
              onSelect={onSelectUser}
              getUserStatusValue={getUserStatusValue}
            />
          ))}
        </div>

        <div className="table-footer">
          <div className="table-footer-info">
            Showing {formatNumber(startIndex + 1)}–{formatNumber(endIndex)} of {formatNumber(totalUsers)} users
          </div>

          <div className="table-footer-page">
            Page {formatNumber(currentPage)} of {formatNumber(totalPages)}
          </div>

          <div className="table-footer-nav">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              ◀ Previous
            </button>

            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              Next ▶
            </button>
          </div>
        </div>
      </div>
      {!list.length && <p className="empty">{t("no_users_found", "No users match your search.")}</p>}
    </div>
  );
}

