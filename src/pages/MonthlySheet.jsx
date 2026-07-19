import { exportMonthlySheetPdf } from "../utils/pdf";
import PaymentModal from "../components/PaymentModal";
import useMonthlySheet from "../hooks/useMonthlySheet";
import StatusBadge from "../components/StatusBadge";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiCreditCard,
  FiDownload,
  FiDollarSign,
  FiEdit2,
  FiSearch,
  FiTrash2,
  FiTrendingUp,
  FiUsers,
} from "react-icons/fi";
import toast from "react-hot-toast";
import { db } from "../firebase/config";
import useOwnedCollection from "../hooks/useOwnedCollection";
import ConfirmModal from "../components/ConfirmModal";
import { useAuth } from "../context/AuthContext";
import { monthNames, money, formatDate, formatTime } from "../utils/date";
import { Send } from "lucide-react";
import {
  buildPaymentRemovalEvent,
  formatBalanceDisplayValue,
} from "../utils/payments";
import { buildReversalTransactionRecord } from "../utils/transactions";

const defaultSmsTemplate =
  "Dear {name}, your monthly bill is {bill}. Please pay by {duedate}. Thank you.";
const createSms = (template, { name, bill, dueDate }) =>
  template
    .replaceAll("{name}", name || "Customer")
    .replaceAll("{bill}", money(bill))
    .replaceAll("{duedate}", dueDate);

export default function MonthlySheet() {
  const { user: signedInUser } = useAuth();
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());

  const [search, setSearch] = useState("");
  const searchRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 25;

  const [editing, setEditing] = useState(null);
  const [nameOrder, setNameOrder] = useState("asc");
  const [statusOrder, setStatusOrder] = useState("pending");
  const [smsTemplate, setSmsTemplate] = useState(defaultSmsTemplate);
  const { data: users } = useOwnedCollection("users");
  const { data: allPayments } = useOwnedCollection("payments");
  const { rows, filteredRows, paid, total, totalDue, totalBill } =
    useMonthlySheet({
      users,
      allPayments,
      month,
      year,
      search,
      nameOrder,
      statusOrder,
    });

  useEffect(() => {
    const loadSmsTemplate = async () => {
      if (!signedInUser || !db) return;
      try {
        const saved = await getDoc(doc(db, "settings", signedInUser.uid));
        const template = saved?.data()?.smsTemplate;
        if (typeof template === "string" && template.trim()) {
          setSmsTemplate(template.trim());
        }
      } catch {
        // Ignore SMS template load failures.
      }
    };
    loadSmsTemplate();
  }, [signedInUser]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, month, year, nameOrder, statusOrder]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const pageCount = Math.max(
    1,
    Math.ceil(filteredRows.length / ITEMS_PER_PAGE),
  );
  const currentPageIndex = Math.min(currentPage, pageCount);
  const pagedRows = useMemo(
    () =>
      filteredRows.slice(
        (currentPageIndex - 1) * ITEMS_PER_PAGE,
        currentPageIndex * ITEMS_PER_PAGE,
      ),
    [filteredRows, currentPageIndex],
  );
  const showingFrom =
    filteredRows.length === 0 ? 0 : (currentPageIndex - 1) * ITEMS_PER_PAGE + 1;
  const showingTo = Math.min(
    currentPageIndex * ITEMS_PER_PAGE,
    filteredRows.length,
  );

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [smsRecipient, setSmsRecipient] = useState(null);
  const [voidReason, setVoidReason] = useState("");

  const summaryCards = useMemo(
    () => [
      {
        label: "Total Users",
        value: rows.length,
        accent: "forest",
        icon: <FiUsers />,
      },
      {
        label: "Paid Users",
        value: paid.length,
        accent: "green",
        icon: <FiCheckCircle />,
      },
      {
        label: "Pending Users",
        value: rows.length - paid.length,
        accent: "amber",
        icon: <FiClock />,
      },
      {
        label: "Total Bill",
        value: money(totalBill),
        accent: "ocean",
        icon: <FiCreditCard />,
      },
      {
        label: "Total Collection",
        value: money(total),
        accent: "blue",
        icon: <FiDollarSign />,
      },
      {
        label: "Total Due",
        value: formatBalanceDisplayValue({ due: totalDue, carryForward: 0 }),
        accent: "red",
        icon: <FiAlertCircle />,
      },
    ],
    [paid.length, rows.length, total, totalBill, totalDue],
  );

  const remove = async (payment) => {
    if (!payment?.id) return;
    try {
      const timestamp = new Date();
      const removalEvent = buildPaymentRemovalEvent({
        payment,
        mode: "void",
        actor: signedInUser?.uid || signedInUser?.email || "admin",
        reason: voidReason.trim() || "Voided by admin",
        timestamp,
      });
      if (!removalEvent) throw new Error("No payment record found");

      const batch = writeBatch(db);
      const originalPaymentRef = doc(db, "payments", payment.id);
      const reversalRef = doc(collection(db, "payments"));
      batch.update(originalPaymentRef, {
        ...removalEvent.originalRecord,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(reversalRef, {
        ...removalEvent.reversalRecord,
        id: reversalRef.id,
        transactionId: reversalRef.id,
        deletedAt: serverTimestamp(),
        paymentDate: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      toast.success(`Payment marked as ${removalEvent.reversalRecord.status}`);
    } catch (error) {
      toast.error(error.message || "Could not void payment");
    } finally {
      setConfirmDelete(null);
      setVoidReason("");
    }
  };

  const handleSms = async (user) => {
    const phone = String(user.phone || "")
      .trim()
      .replace(/[\s()-]/g, "");
    if (!phone) return toast.error(`${user.name} does not have a phone number`);
    if (!/^\+?\d+$/.test(phone))
      return toast.error("Enter a valid phone number before sending an SMS");
    try {
      const dueDate = new Date(year, month - 1, 14).toLocaleDateString(
        "en-GB",
        { day: "numeric", month: "long", year: "numeric" },
      );
      const message = createSms(smsTemplate, {
        name: user.name,
        bill: user.monthlyBill,
        dueDate,
      });

      const smsUrl = `sms:${phone}?body=${encodeURIComponent(message)}`;
      window.location.href = smsUrl;
      toast.success("Opening your phone’s SMS app…");
    } catch (error) {
      toast.error(
        error.name === "AbortError"
          ? "SMS sharing cancelled"
          : error.message || "Could not prepare the SMS",
      );
    } finally {
      setSmsRecipient(null);
    }
  };

  const getInitials = (name = "") =>
    String(name)
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  const handleExportPDF = () => {
    exportMonthlySheetPdf({
      rows: filteredRows,

      month: monthNames[month - 1],

      year,

      summary: {
        totalUsers: rows.length,
        paidUsers: paid.length,
        pendingUsers: rows.length - paid.length,
        totalBill,
        totalCollection: total,
        totalDue: formatBalanceDisplayValue({
          due: totalDue,
          carryForward: 0,
        }),
      },

      // We'll replace this with the company name from Settings later
      companyName: "Bill Sheet",

      // We'll replace this with the current selected theme later
      theme: "forest",
    });
  };

  return (
    <div className="page monthly-sheet-page">
      <section className="monthly-sheet-hero">
        <div className="monthly-sheet-header-copy">
          <h2>Monthly Sheet</h2>
          <p>View and manage monthly collections.</p>
        </div>
      </section>

      <div className="monthly-sheet-header-actions">
        <div className="monthly-sheet-control">
          <select
            className="monthly-sheet-mini-select"
            value={month}
            onChange={(e) => setMonth(+e.target.value)}
          >
            {monthNames.map((name, i) => (
              <option value={i + 1} key={name}>
                {name}
              </option>
            ))}
          </select>
          <input
            className="monthly-sheet-mini-input"
            type="number"
            min="2024"
            value={year}
            onChange={(e) => setYear(+e.target.value)}
          />
        </div>
        <button
          className="monthly-sheet-export-btn"
          type="button"
          onClick={handleExportPDF}
        >
          <FiDownload /> Export
        </button>
      </div>

      <div className="monthly-sheet-summary-grid">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className={`summary-card summary-card--${card.accent}`}
          >
            <div className="summary-card-icon">{card.icon}</div>
            <div className="summary-card-number">{card.value}</div>
            <div className="summary-card-label">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="monthly-sheet-search-shell">
        <label className="search-field">
          <FiSearch />
          <input
            ref={searchRef}
            placeholder="Search customer by name or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>

      <section
        className={
          rows.length ? "panel monthly-table-panel" : "panel sheet-empty"
        }
      >
        {rows.length ? (
          <>
            <div className="monthly-table-topbar">
              <div>
                <div className="monthly-table-kicker">Collection overview</div>
                <h3>
                  {monthNames[month - 1]} {year}
                </h3>
              </div>
              <div className="monthly-table-topbar-meta">
                <span>{filteredRows.length} visible</span>
                <span>{rows.length} total</span>
              </div>
            </div>
            <table className="monthly-table">
              <thead>
                <tr>
                  <th>SL</th>
                  <th
                    className="sortable-th"
                    onClick={() =>
                      setNameOrder(nameOrder === "asc" ? "desc" : "asc")
                    }
                  >
                    Customer {nameOrder === "asc" ? "▲" : "▼"}
                  </th>
                  <th>Bill</th>
                  <th>Paid</th>
                  <th>Due</th>
                  <th
                    className="sortable-th"
                    onClick={() =>
                      setStatusOrder(
                        statusOrder === "pending" ? "paid" : "pending",
                      )
                    }
                  >
                    Status {statusOrder === "pending" ? "▲" : "▼"}
                  </th>
                  <th>Payment Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map(
                  (
                    {
                      user,
                      payment,
                      openingDue,
                      openingAdvance,
                      due,
                      carryForward,
                      currentPaid,
                      status,
                    },
                    i,
                  ) => {
                    const isPaid =
                      Number(currentPaid || payment?.amount || 0) > 0;
                    const rowIndex =
                      (currentPageIndex - 1) * ITEMS_PER_PAGE + (i + 1);
                    const badgeStatus =
                      status ||
                      (isPaid && Number(due) > 0
                        ? "Partial"
                        : isPaid
                          ? "Paid"
                          : "Pending");
                    const balanceLabel = formatBalanceDisplayValue({
                      due,
                      carryForward,
                    });
                    const balanceClassName =
                      due > 0
                        ? "due-pill"
                        : carryForward > 0
                          ? "balance-pill balance-pill--advance"
                          : "balance-pill";
                    return (
                      <tr className="monthly-row" key={user.id}>
                        <td data-label="SL">{rowIndex}</td>
                        <td data-label="Customer">
                          <div className="customer-cell">
                            <div className="customer-avatar">
                              {getInitials(user.name)}
                            </div>
                            <div>
                              <div className="customer-name">{user.name}</div>
                              <div className="customer-phone">
                                {user.phone || "No phone saved"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td data-label="Bill">
                          <div className="bill-pill">
                            {money(user.monthlyBill)}
                          </div>
                        </td>
                        <td data-label="Paid">
                          <div className="balance-pill">
                            {money(currentPaid || payment?.amount || 0)}
                          </div>
                        </td>
                        <td data-label="Balance">
                          <div className={balanceClassName}>{balanceLabel}</div>
                        </td>
                        <td data-label="Status">
                          <StatusBadge status={badgeStatus} />
                        </td>
                        <td data-label="Payment Date">
                          {payment?.paymentDate ? (
                            <div className="payment-date-group">
                              <strong>{formatDate(payment.paymentDate)}</strong>
                              <small>{formatTime(payment.paymentDate)}</small>
                            </div>
                          ) : (
                            <span className="muted-pill">No payment</span>
                          )}
                        </td>
                        <td className="actions-cell" data-label="Actions">
                          <button
                            className="action-btn action-btn--sms"
                            onClick={() => setSmsRecipient(user)}
                            title="Send SMS"
                            type="button"
                          >
                            <Send size={16} />
                          </button>
                          <button
                            className="action-btn action-btn--edit"
                            onClick={() =>
                              setEditing({ user, payment, openingDue })
                            }
                            title="Edit"
                            type="button"
                          >
                            <FiEdit2 />
                          </button>
                          {payment && (
                            <button
                              className="action-btn action-btn--delete"
                              onClick={() => setConfirmDelete(payment)}
                              title="Void"
                              type="button"
                            >
                              <FiTrash2 />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
            <div className="monthly-sheet-mobile-list" role="list">
              {pagedRows.map(
                ({
                  user,
                  payment,
                  openingDue,
                  openingAdvance,
                  due,
                  carryForward,
                  currentPaid,
                  status,
                }) => {
                  const isPaid =
                    Number(currentPaid || payment?.amount || 0) > 0;
                  const badgeStatus =
                    status ||
                    (isPaid && Number(due) > 0
                      ? "Partial"
                      : isPaid
                        ? "Paid"
                        : "Pending");
                  const balanceLabel = formatBalanceDisplayValue({
                    due,
                    carryForward,
                  });
                  const balanceClassName =
                    due > 0
                      ? "due-pill"
                      : carryForward > 0
                        ? "balance-pill balance-pill--advance"
                        : "balance-pill";
                  return (
                    <article
                      className="monthly-sheet-customer-card"
                      key={user.id}
                    >
                      <div className="monthly-sheet-customer-card-header">
                        <div className="customer-cell">
                          <div className="customer-avatar">
                            {getInitials(user.name)}
                          </div>
                          <div>
                            <div className="customer-name">{user.name}</div>
                            <div className="customer-phone">
                              {user.phone || "No phone saved"}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="monthly-sheet-customer-card-grid">
                        <div className="monthly-sheet-customer-card-item">
                          <span className="monthly-sheet-customer-card-label">
                            Bill
                          </span>
                          <div className="monthly-sheet-customer-card-value">
                            <span className="bill-pill">
                              {money(user.monthlyBill)}
                            </span>
                          </div>
                        </div>
                        <div className="monthly-sheet-customer-card-item">
                          <span className="monthly-sheet-customer-card-label">
                            Paid
                          </span>
                          <div className="monthly-sheet-customer-card-value">
                            <span className="balance-pill">
                              {money(currentPaid || payment?.amount || 0)}
                            </span>
                          </div>
                        </div>
                        <div className="monthly-sheet-customer-card-item">
                          <span className="monthly-sheet-customer-card-label">
                            Balance
                          </span>
                          <div className="monthly-sheet-customer-card-value">
                            <span className={balanceClassName}>
                              {balanceLabel}
                            </span>
                          </div>
                        </div>
                        <div className="monthly-sheet-customer-card-item">
                          <span className="monthly-sheet-customer-card-label">
                            Status
                          </span>
                          <div className="monthly-sheet-customer-card-value">
                            <StatusBadge status={badgeStatus} />
                          </div>
                        </div>
                        <div className="monthly-sheet-customer-card-item monthly-sheet-customer-card-item--wide">
                          <span className="monthly-sheet-customer-card-label">
                            Payment Date
                          </span>
                          <div className="monthly-sheet-customer-card-value">
                            {payment?.paymentDate ? (
                              <div className="payment-date-group">
                                <strong>
                                  {formatDate(payment.paymentDate)}
                                </strong>
                                <small>{formatTime(payment.paymentDate)}</small>
                              </div>
                            ) : (
                              <span className="muted-pill">No payment</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="monthly-sheet-customer-card-actions">
                        <button
                          className="monthly-card-action-btn monthly-card-action-btn--sms"
                          onClick={() => setSmsRecipient(user)}
                          type="button"
                        >
                          <Send size={16} />
                          <span>SMS</span>
                        </button>
                        <button
                          className="monthly-card-action-btn monthly-card-action-btn--edit"
                          onClick={() =>
                            setEditing({ user, payment, openingDue })
                          }
                          type="button"
                        >
                          <FiEdit2 />
                          <span>Edit</span>
                        </button>
                        {payment && (
                          <button
                            className="monthly-card-action-btn monthly-card-action-btn--delete"
                            onClick={() => setConfirmDelete(payment)}
                            type="button"
                          >
                            <FiTrash2 />
                            <span>Void</span>
                          </button>
                        )}
                      </div>
                    </article>
                  );
                },
              )}
            </div>
          </>
        ) : (
          <div className="sheet-empty-content">
            <span>
              <FiUsers />
            </span>
            <h3>Start with your first customer</h3>
            <p>
              Add customers from the Users page, then come back to record their
              payments for {monthNames[month - 1]} {year}.
            </p>
            <Link className="btn btn-primary" to="/users">
              Go to Users
            </Link>
          </div>
        )}
        {rows.length > 0 && !filteredRows.length && (
          <p className="empty">No customers match your search.</p>
        )}
        {rows.length > 0 && filteredRows.length > 0 && pageCount > 1 && (
          <div className="table-footer monthly-sheet-footer">
            <div className="table-footer-info monthly-sheet-footer-info">
              Showing {showingFrom}–{showingTo} of {filteredRows.length} records
            </div>
            <div className="table-footer-page monthly-sheet-footer-page">
              Page {currentPageIndex} of {pageCount}
            </div>
            <div className="table-footer-nav monthly-sheet-footer-nav">
              <button
                disabled={currentPageIndex === 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                type="button"
              >
                ◀ Previous
              </button>
              <button
                disabled={currentPageIndex === pageCount}
                onClick={() =>
                  setCurrentPage((page) => Math.min(pageCount, page + 1))
                }
                type="button"
              >
                Next ▶
              </button>
            </div>
          </div>
        )}
      </section>
      {editing && (
        <PaymentModal
          data={editing}
          month={month}
          year={year}
          ownerId={signedInUser?.uid}
          close={() => setEditing(null)}
        />
      )}
      {confirmDelete && (
        <ConfirmModal
          title="Void payment"
          message={`Mark ${confirmDelete.userName || confirmDelete.customerName || "this payment"} as voided? This preserves the original transaction record and recalculates totals from active transactions.`}
          confirmText="Void"
          cancelText="Cancel"
          onConfirm={() => remove(confirmDelete)}
          onCancel={() => {
            setConfirmDelete(null);
            setVoidReason("");
          }}
        >
          <div className="form" style={{ marginTop: 12 }}>
            <label>
              Reason
              <input
                type="text"
                value={voidReason}
                onChange={(event) => setVoidReason(event.target.value)}
                placeholder="Enter a reason"
              />
            </label>
            <label>
              Action
              <div style={{ marginTop: 6, fontWeight: 600 }}>Voided</div>
            </label>
          </div>
        </ConfirmModal>
      )}
      {smsRecipient && (
        <ConfirmModal
          title="Send SMS"
          message={`Send SMS to ${smsRecipient.name}? This will open the phone app or sharing options if supported.`}
          confirmText="Open SMS"
          cancelText="Cancel"
          onConfirm={() => {
            handleSms(smsRecipient);
            setSmsRecipient(null);
          }}
          onCancel={() => setSmsRecipient(null)}
        />
      )}
    </div>
  );
}
