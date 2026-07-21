import { memo, useEffect, useMemo, useState } from "react";
import {
  FiArrowLeft,
  FiCalendar,
  FiChevronRight,
  FiClock,
  FiCreditCard,
  FiDollarSign,
  FiEdit2,
  FiPhone,
  FiTag,
  FiTrash2,
  FiUser,
} from "react-icons/fi";
import StatusBadge from "./StatusBadge";
import { getDisplayPackages } from "../utils/users";

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
  money,
  formatDate,
  currentPage,
  setCurrentPage,
  totalPages,
  totalUsers,
  startIndex,
  endIndex,
}) {
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [mobileView, setMobileView] = useState("list");
  const [savedScrollTop, setSavedScrollTop] = useState(0);

  const getUserStatusValue = (user) =>
    user?.status || (user?.active === false ? "Inactive" : "Active");

  const renderPackageChips = (user) => {
    const packageChips = getDisplayPackages(user);
    return packageChips.length > 0 ? (
      packageChips.map((item) => (
        <span className="user-category" key={item}>
          {item}
        </span>
      ))
    ) : (
      <span className="user-category">Uncategorized</span>
    );
  };

  useEffect(() => {
    if (!selectedUserId) return;
    const stillVisible = list.some((user) => user.id === selectedUserId);
    if (!stillVisible) {
      setSelectedUserId(null);
      setMobileView("list");
    }
  }, [list, selectedUserId]);

  const selectedUser = useMemo(
    () => list.find((user) => user.id === selectedUserId) || null,
    [list, selectedUserId],
  );

  const openUserDetails = (userId) => {
    setSelectedUserId(userId);
    setSavedScrollTop(window.scrollY || 0);
    setMobileView("detail");
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  };

  const closeUserDetails = () => {
    setMobileView("list");
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: savedScrollTop, left: 0, behavior: "auto" });
    });
  };

  const detailProfileCards = useMemo(() => {
    if (!selectedUser) return [];
    const monthlyBill = Number(selectedUser.monthlyBill || 0);
    const packages = getDisplayPackages(selectedUser);
    const categoryValue = packages[0] || selectedUser.category || "Uncategorized";
    const phoneValue = selectedUser.phone || "No phone on file";
    const createdValue = formatDate(selectedUser.createdAt || selectedUser.joinDate);

    return [
      {
        label: "Monthly Bill",
        value: money(monthlyBill),
        icon: <FiDollarSign />,
      },
      {
        label: "Phone Number",
        value: phoneValue,
        icon: <FiPhone />,
      },
      {
        label: "Category",
        value: categoryValue,
        icon: <FiTag />,
      },
      {
        label: "Created Date",
        value: createdValue,
        icon: <FiCalendar />,
      },
    ];
  }, [formatDate, money, selectedUser]);

  return (
    <div className="table-wrap">
      <table className="users-table">
        <thead>
          <tr>
            <th style={{ width: "70px" }}>SL</th>
            <th>Name</th>
            <th style={{ width: "230px" }}>Package / Category</th>
            <th style={{ width: "170px" }}>Amount</th>
            <th style={{ width: "140px" }}>Status</th>
            <th style={{ width: "190px" }}>Phone</th>
            <th style={{ width: "170px" }}>Created</th>
            <th className="actions-header">Action</th>
          </tr>
        </thead>
        <tbody>
          {list.map((user, i) => (
            <tr key={user.id}>
              <td data-label="SL">{i + 1}</td>
              <td data-label="Name">
                <strong className="user-name">{user.name}</strong>
              </td>
              <td data-label="Package / Category">
                <div className="user-package-list">{renderPackageChips(user)}</div>
              </td>
              <td data-label="Amount">{money(user.monthlyBill)}</td>
              <td data-label="Status">
                <StatusBadge
                  status={getUserStatusValue(user)}
                  className="user-inline-badge"
                />
              </td>
              <td data-label="Phone">{user.phone || "—"}</td>
              <td data-label="Created">{formatDate(user.createdAt)}</td>
              <td className="actions actions-cell" data-label="Action">
                <button onClick={() => setForm(user)}>
                  <FiEdit2 />
                </button>
                <button className="danger" onClick={() => setDeleteUser(user)}>
                  <FiTrash2 />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="users-mobile-shell">
        {mobileView === "detail" && selectedUser ? (
          <div className="users-mobile-detail-screen" role="dialog" aria-modal="false">
            <button
              type="button"
              className="users-mobile-back-btn"
              onClick={closeUserDetails}
            >
              <FiArrowLeft /> Back
            </button>

            <div className="users-mobile-profile-card">
              <div className="users-mobile-avatar" aria-hidden="true">
                {String(selectedUser.name || "CU")
                  .trim()
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div className="users-mobile-profile-copy">
                <div className="users-mobile-profile-title">
                  <h3>{selectedUser.name}</h3>
                  <StatusBadge
                    status={getUserStatusValue(selectedUser)}
                    className="user-inline-badge user-inline-badge--status"
                  />
                </div>
                <div className="users-mobile-profile-meta">
                  <span>
                    <FiPhone /> {selectedUser.phone || "No phone on file"}
                  </span>
                  <span>
                    <FiTag /> {getDisplayPackages(selectedUser)[0] || selectedUser.category || "Uncategorized"}
                  </span>
                </div>
              </div>
            </div>

            <div className="users-mobile-summary-grid">
              {detailProfileCards.map((item) => (
                <div className="users-mobile-summary-card users-mobile-summary-card--monthly" key={item.label}>
                  <div className="users-mobile-summary-icon-wrap">
                    <div className="users-mobile-summary-icon">{item.icon}</div>
                  </div>
                  <div className="users-mobile-summary-copy">
                    <div className="users-mobile-summary-value">{item.value}</div>
                    <div className="users-mobile-summary-label">{item.label}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="users-mobile-action-row">
              <button
                type="button"
                className="users-mobile-action users-mobile-action--primary"
                onClick={() => setForm(selectedUser)}
              >
                <FiEdit2 /> Edit User
              </button>
              <button
                type="button"
                className="users-mobile-action users-mobile-action--ghost"
                onClick={() => onAddPayment?.(selectedUser)}
              >
                <FiCreditCard /> Add Payment
              </button>
            </div>
            <div className="users-mobile-action-row users-mobile-action-row--secondary">
              <button
                type="button"
                className="users-mobile-action users-mobile-action--ghost"
                onClick={() => onViewHistory?.(selectedUser)}
              >
                <FiCalendar /> Payment History
              </button>
              <button
                type="button"
                className="users-mobile-action users-mobile-action--ghost"
                onClick={() => onViewAnnualReport?.(selectedUser)}
              >
                <FiDollarSign /> Annual Report
              </button>
            </div>
            <div className="users-mobile-action-row">
              <button
                type="button"
                className="users-mobile-action users-mobile-action--danger"
                onClick={() => setDeleteUser(selectedUser)}
              >
                <FiTrash2 /> Delete User
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="users-mobile-list" role="list">
              {list.map((user) => (
                <MobileUserRow
                  key={user.id}
                  user={user}
                  isSelected={selectedUserId === user.id}
                  onSelect={openUserDetails}
                  getUserStatusValue={getUserStatusValue}
                />
              ))}
            </div>

            <div className="table-footer">
              <div className="table-footer-info">
                Showing {startIndex + 1}–{endIndex} of {totalUsers} users
              </div>

              <div className="table-footer-page">
                Page {currentPage} of {totalPages}
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
          </>
        )}
      </div>
      {!list.length && <p className="empty">No users match your search.</p>}
    </div>
  );
}
