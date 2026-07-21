import { exportMonthlySheetPdf } from "../utils/pdf";
import { getStoredTheme } from "../utils/theme";
import PaymentModal from "../components/PaymentModal";
import useMonthlySheet from "../hooks/useMonthlySheet";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCalendar,
  FiCheckCircle,
  FiChevronRight,
  FiClock,
  FiCreditCard,
  FiDownload,
  FiDollarSign,
  FiEdit2,
  FiPhone,
  FiSearch,
  FiTag,
  FiTrash2,
  FiTrendingUp,
  FiUsers,
} from "react-icons/fi";
import toast from "react-hot-toast";
import { db } from "../firebase/config";
import useOwnedCollection from "../hooks/useOwnedCollection";
import ConfirmModal from "../components/ConfirmModal";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { monthNames, money, formatDate, formatTime } from "../utils/date";
import { Send } from "lucide-react";
import {
  buildVoidPaymentActionRecords,
  formatBalanceDisplayValue,
  getDisplayBalanceValues,
  getDisplayPaymentStatus,
  getPaymentMonthYear,
  voidPaymentRecord,
} from "../utils/payments";

const defaultSmsTemplate =
  "Dear {name}, your monthly bill is {bill}. Please pay by {duedate}. Thank you.";
const createSms = (template, { name, bill, dueDate }) =>
  template
    .replaceAll("{name}", name || "Customer")
    .replaceAll("{bill}", money(bill))
    .replaceAll("{duedate}", dueDate);

export default function MonthlySheet() {
  const location = useLocation();
  const { user: signedInUser } = useAuth();
  const { t, formatMoney, formatNumber, translateMonth, translateStatus, toBengaliNumerals, language } = useLanguage();
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());

  const [search, setSearch] = useState("");
  const searchRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 30;

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
        const target = searchRef.current;
        if (!target) return;
        target.focus({ preventScroll: true });
        target.select();
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

  const [paymentAction, setPaymentAction] = useState(null);
  const [smsRecipient, setSmsRecipient] = useState(null);
  const [voidReasonType, setVoidReasonType] = useState("Wrong Amount");
  const [customReasonText, setCustomReasonText] = useState("");
  const [voidError, setVoidError] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [mobileView, setMobileView] = useState("list");
  const routedCustomerId = location?.state?.selectedCustomerId || location?.state?.customerId || null;
  const [savedScrollTop, setSavedScrollTop] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateIsMobile = () => setIsMobile(window.innerWidth <= 768);
    updateIsMobile();
    window.addEventListener("resize", updateIsMobile);
    return () => window.removeEventListener("resize", updateIsMobile);
  }, []);

  const totalAdvance = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.currentAdvance || 0), 0),
    [rows],
  );

  const getMonthlySheetStatusMeta = (status, bill, paidValue, dueValue, carryForwardValue) =>
    getDisplayPaymentStatus({
      status,
      bill,
      paid: paidValue,
      due: dueValue,
      advance: carryForwardValue,
      month,
      currentMonth: month,
      currentDate: new Date(),
      preserveExplicitStatus: true,
    });

  const summaryCards = useMemo(
    () => [
      {
        label: t("total_users"),
        value: formatNumber(rows.length),
        accent: "forest",
        icon: <FiUsers />,
      },
      {
        label: t("paid_customers", "Paid Users"),
        value: formatNumber(paid.length),
        accent: "green",
        icon: <FiCheckCircle />,
      },
      {
        label: t("pending_customers", "Pending Users"),
        value: formatNumber(rows.length - paid.length),
        accent: "amber",
        icon: <FiClock />,
      },
      {
        label: t("total_bill", "Total Bill"),
        value: formatMoney(totalBill),
        accent: "ocean",
        icon: <FiCreditCard />,
      },
      {
        label: t("total_collected"),
        value: formatMoney(total),
        accent: "blue",
        icon: <FiDollarSign />,
      },
      {
        label: t("total_due"),
        value: formatMoney(totalDue),
        accent: "red",
        icon: <FiAlertCircle />,
      },
    ],
    [paid.length, rows.length, total, totalBill, totalDue, t, formatNumber, formatMoney],
  );
  const mobileSummaryCards = summaryCards.slice(0, 3);
  const mobileFinancialCards = summaryCards.slice(3);

  useEffect(() => {
    if (!selectedCustomerId) return;
    const stillVisible = filteredRows.some(({ user }) => user.id === selectedCustomerId);
    if (!stillVisible) {
      setSelectedCustomerId(null);
      setMobileView("list");
    }
  }, [filteredRows, selectedCustomerId]);

  const selectedCustomer = useMemo(
    () => filteredRows.find(({ user }) => user.id === selectedCustomerId) || null,
    [filteredRows, selectedCustomerId],
  );
  useEffect(() => {
    if (!routedCustomerId) return;
    const targetUser = filteredRows.find(({ user }) => user.id === routedCustomerId);
    if (targetUser) {
      setSelectedCustomerId(routedCustomerId);
      setMobileView("detail");
      setCurrentPage(1);
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      });
    }
  }, [filteredRows, routedCustomerId]);

  const showStandaloneMobileDetail =
    isMobile && mobileView === "detail" && Boolean(selectedCustomer);

  const openCustomerDetails = (userId) => {
    setSelectedCustomerId(userId);
    setSavedScrollTop(window.scrollY || 0);
    setMobileView("detail");
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  };

  const closeCustomerDetails = () => {
    setMobileView("list");
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: savedScrollTop, left: 0, behavior: "auto" });
    });
  };

  const detailProfileCards = useMemo(() => {
    if (!selectedCustomer) return [];
    const currentPaidValue = Number(
      selectedCustomer.currentPaid || selectedCustomer.payment?.amount || 0,
    );
    const openingDueValue = Number(selectedCustomer.openingDue || 0);
    const carryForwardValue = Number(selectedCustomer.carryForward || 0);
    const currentDueValue = Number(selectedCustomer.due || 0);
    const displayBalance = getDisplayBalanceValues({
      due: currentDueValue,
      carryForward: carryForwardValue,
      currentDue: currentDueValue,
      currentAdvance: carryForwardValue,
      bill: Number(selectedCustomer.user.monthlyBill || 0),
      amount: currentPaidValue,
      previousDue: Number(selectedCustomer.openingDue || 0),
      previousAdvance: Number(selectedCustomer.openingAdvance || 0),
    });

    return [
      {
        label: "Monthly Bill",
        value: money(selectedCustomer.user.monthlyBill),
        icon: <FiDollarSign />,
      },
      {
        label: "Paid This Month",
        value: money(currentPaidValue),
        icon: <FiCreditCard />,
      },
      {
        label: "Current Balance",
        value: formatBalanceDisplayValue({
          due: displayBalance.due,
          carryForward: displayBalance.carryForward,
        }),
        icon: <FiAlertCircle />,
      },
      {
        label: "Additional Due",
        value: money(openingDueValue),
        icon: <FiTrendingUp />,
      },
      {
        label: "Carry Forward",
        value: money(carryForwardValue),
        icon: <FiDollarSign />,
      },
      {
        label: "Outstanding Balance",
        value: formatBalanceDisplayValue({
          due: displayBalance.due,
          carryForward: displayBalance.carryForward,
        }),
        icon: <FiAlertCircle />,
      },
      {
        label: "Payment Date",
        value: selectedCustomer.payment?.paymentDate
          ? `${formatDate(selectedCustomer.payment.paymentDate)} • ${formatTime(selectedCustomer.payment.paymentDate)}`
          : "No payment",
        icon: <FiCalendar />,
      },
    ];
  }, [formatBalanceDisplayValue, money, selectedCustomer]);

  const closePaymentAction = () => {
    setPaymentAction(null);
    setVoidReasonType("Wrong Amount");
    setCustomReasonText("");
    setVoidError("");
  };

  const submitVoidPayment = async (payment) => {
    if (!payment?.id) return;
    const finalReason =
      voidReasonType === "Other"
        ? customReasonText.trim()
        : voidReasonType;

    if (voidReasonType === "Other" && !finalReason) {
      setVoidError("Please enter a custom reason before marking this payment as voided.");
      return;
    }
    try {
      const timestamp = new Date();
      const voidRecords = buildVoidPaymentActionRecords({
        payment,
        voidedBy: signedInUser?.uid || signedInUser?.email || "admin",
        reason: finalReason,
        reasonType: voidReasonType,
        voidDate: timestamp,
        voidTime: timestamp.toTimeString().split(" ")[0].slice(0, 5),
        ownerId: signedInUser?.uid || payment?.ownerId || "",
        paymentDateText: payment?.paymentDateText || "",
        paymentTime: payment?.paymentTime || timestamp.toTimeString().split(" ")[0].slice(0, 5),
      });
      if (!voidRecords) throw new Error("No payment record found");
      const originalRef = doc(db, "payments", payment.id);
      const voidRef = doc(collection(db, "payments"));
      const batch = writeBatch(db);
      batch.update(originalRef, {
        ...voidRecords.originalRecord,
        reason: finalReason,
        reasonType: voidReasonType,
        status: "Voided",
        isDeleted: true,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(voidRef, {
        ...voidRecords.voidActionRecord,
        reason: finalReason,
        reasonType: voidReasonType,
        status: "Voided",
        isDeleted: true,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        paymentDate: serverTimestamp(),
        ownerId: signedInUser?.uid || payment?.ownerId || "",
        transactionId: voidRef.id,
      });
      await batch.commit();
      toast.success("Payment marked as voided.");
    } catch (error) {
      toast.error(error.message || "Could not void payment");
    } finally {
      closePaymentAction();
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
        due: totalDue,
        carryForward: totalAdvance,
        totalDue: formatBalanceDisplayValue({
          due: totalDue,
          carryForward: totalAdvance,
        }),
      },

      // We'll replace this with the company name from Settings later
      companyName: "Bill Sheet",

      theme: getStoredTheme(),
    });
  };

  return (
    <div className="page monthly-sheet-page">
      {!showStandaloneMobileDetail && (
        <>
          <section className="monthly-sheet-hero">
            <div className="monthly-sheet-header-copy">
              <h2>{t("monthly_sheet")}</h2>
              <p>{t("monthly_sheet_subtitle", "View and manage monthly collections.")}</p>
            </div>
          </section>

          <div className="monthly-sheet-header-actions">
            <select
              className="monthly-sheet-mini-select"
              value={month}
              onChange={(e) => setMonth(+e.target.value)}
            >
              {monthNames.map((name, i) => (
                <option key={name} value={i + 1}>
                  {translateMonth(name)}
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

            <button
              className="monthly-sheet-export-btn"
              type="button"
              onClick={handleExportPDF}
            >
              <FiDownload />
              {t("export_pdf")}
            </button>
          </div>

          <div className="monthly-sheet-summary-mobile-card" aria-label="Summary">
            {mobileSummaryCards.map((card) => (
              <div
                key={card.label}
                className={`monthly-sheet-summary-mobile-column summary-card--${card.accent}`}
              >
                <div className="summary-card-icon">{card.icon}</div>
                <div className="summary-card-number">{card.value}</div>
                <div className="summary-card-label">{card.label}</div>
              </div>
            ))}
          </div>

          <div className="monthly-sheet-financial-mobile-card" aria-label="Financial Summary">
            {mobileFinancialCards.map((card) => (
              <div key={card.label} className="monthly-sheet-financial-mobile-item">
                <div className="monthly-sheet-financial-mobile-icon">{card.icon}</div>
                <div className="monthly-sheet-financial-mobile-copy">
                  <div className="monthly-sheet-financial-mobile-value">{card.value}</div>
                  <div className="monthly-sheet-financial-mobile-label">{card.label}</div>
                </div>
              </div>
            ))}
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
                placeholder={t("search_customer_placeholder", "Search customer by name or phone")}
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
                <div className="monthly-table-topbar" aria-label="Collection overview">
                  <div className="monthly-table-topbar-copy">
                    <div className="monthly-table-kicker">{t("collection_list_of", "Collection List of")}</div>
                    <h3>{translateMonth(monthNames[month - 1])} {language === "bn" ? toBengaliNumerals(year) : year}</h3>
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
                        {t("name")} {nameOrder === "asc" ? "▲" : "▼"}
                      </th>
                      <th>{t("monthly_bill")}</th>
                      <th>{t("paid", "Pay")}</th>
                      <th>{t("due")}</th>
                      <th
                        className="sortable-th"
                        onClick={() =>
                          setStatusOrder(
                            statusOrder === "pending" ? "paid" : "pending",
                          )
                        }
                      >
                        {t("status")} {statusOrder === "pending" ? "▲" : "▼"}
                      </th>
                      <th>{t("date")}</th>
                      <th>{t("actions")}</th>
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
                        const badgeMeta = getMonthlySheetStatusMeta(
                          badgeStatus,
                          Number(user?.monthlyBill || 0),
                          Number(currentPaid || payment?.amount || 0),
                          Number(due || 0),
                          Number(carryForward || 0),
                        );
                        const displayBalance = getDisplayBalanceValues({
                          due,
                          carryForward,
                          currentDue: due,
                          currentAdvance: carryForward,
                          bill: Number(user?.monthlyBill || 0),
                          amount: Number(currentPaid || payment?.amount || 0),
                          previousDue: Number(openingDue || 0),
                          previousAdvance: Number(openingAdvance || 0),
                        });
                        const balanceLabel = formatBalanceDisplayValue({
                          due: displayBalance.due,
                          carryForward: displayBalance.carryForward,
                        });
                        const balanceClassName =
                          displayBalance.due > 0
                            ? "due-pill"
                            : displayBalance.carryForward > 0
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
                              <span
                                className={`status ${badgeMeta.className} user-inline-badge user-inline-badge--status`}
                              >
                                {badgeMeta.label}
                              </span>
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
                                  onClick={() => {
                                    setSelectedCustomerId(user.id);
                                    setPaymentAction({ payment, mode: "void" });
                                  }}
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
                {mobileView === "detail" && selectedCustomer ? (
                  <div className="users-mobile-detail-screen" role="dialog" aria-modal="false">
                    <button
                      type="button"
                      className="users-mobile-back-btn"
                      onClick={closeCustomerDetails}
                    >
                      <FiArrowLeft /> Back
                    </button>

                    <div className="users-mobile-profile-card">
                      <div className="users-mobile-avatar" aria-hidden="true">
                        {getInitials(selectedCustomer.user.name)}
                      </div>
                      <div className="users-mobile-profile-copy">
                        <div className="users-mobile-profile-title">
                          <h3>{selectedCustomer.user.name || "Unnamed customer"}</h3>
                          <span
                            className={`status ${(() => {
                              const selectedStatus = selectedCustomer.status ||
                                (Number(
                                  selectedCustomer.currentPaid ||
                                    selectedCustomer.payment?.amount ||
                                    0,
                                ) > 0 && Number(selectedCustomer.due) > 0
                                  ? "Partial"
                                  : Number(
                                      selectedCustomer.currentPaid ||
                                        selectedCustomer.payment?.amount ||
                                        0,
                                    ) > 0
                                    ? "Paid"
                                    : "Pending");
                              return getMonthlySheetStatusMeta(
                                selectedStatus,
                                Number(selectedCustomer.user?.monthlyBill || 0),
                                Number(
                                  selectedCustomer.currentPaid ||
                                    selectedCustomer.payment?.amount ||
                                    0,
                                ),
                                Number(selectedCustomer.due || 0),
                                Number(selectedCustomer.carryForward || 0),
                              ).className;
                            })()} user-inline-badge user-inline-badge--status`}
                          >
                            {(() => {
                              const selectedStatus = selectedCustomer.status ||
                                (Number(
                                  selectedCustomer.currentPaid ||
                                    selectedCustomer.payment?.amount ||
                                    0,
                                ) > 0 && Number(selectedCustomer.due) > 0
                                  ? "Partial"
                                  : Number(
                                      selectedCustomer.currentPaid ||
                                        selectedCustomer.payment?.amount ||
                                        0,
                                    ) > 0
                                    ? "Paid"
                                    : "Pending");
                              return getMonthlySheetStatusMeta(
                                selectedStatus,
                                Number(selectedCustomer.user?.monthlyBill || 0),
                                Number(
                                  selectedCustomer.currentPaid ||
                                    selectedCustomer.payment?.amount ||
                                    0,
                                ),
                                Number(selectedCustomer.due || 0),
                                Number(selectedCustomer.carryForward || 0),
                              ).label;
                            })()}
                          </span>
                        </div>
                        <div className="users-mobile-profile-meta">
                          <span>
                            <FiPhone /> {selectedCustomer.user.phone || "No phone on file"}
                          </span>
                          <span>
                            <FiTag /> {selectedCustomer.user.category || "Uncategorized"}
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
                        onClick={() => setSmsRecipient(selectedCustomer.user)}
                      >
                        <Send size={16} /> Send SMS
                      </button>
                      <button
                        type="button"
                        className="users-mobile-action users-mobile-action--ghost"
                        onClick={() =>
                          setEditing({
                            user: selectedCustomer.user,
                            payment: selectedCustomer.payment,
                            openingDue: selectedCustomer.openingDue,
                          })
                        }
                      >
                        <FiEdit2 /> Edit Payment
                      </button>
                    </div>
                    <div className="users-mobile-action-row users-mobile-action-row--secondary">
                      {selectedCustomer.payment && (
                        <button
                          type="button"
                          className="users-mobile-action users-mobile-action--ghost"
                          onClick={() => setPaymentAction({ payment: selectedCustomer.payment, mode: "void" })}
                        >
                          <FiTrash2 /> Void Payment
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="monthly-sheet-mobile-list" role="list">
                    {pagedRows.map((row) => {
                      const {
                        user,
                        payment,
                        openingDue,
                        openingAdvance,
                        due,
                        carryForward,
                        currentPaid,
                        status,
                      } = row;
                      const isPaid =
                        Number(currentPaid || payment?.amount || 0) > 0;
                      const badgeStatus =
                        status ||
                        (isPaid && Number(due) > 0
                          ? "Partial"
                          : isPaid
                            ? "Paid"
                            : "Pending");
                      const badgeMeta = getMonthlySheetStatusMeta(
                        badgeStatus,
                        Number(user?.monthlyBill || 0),
                        Number(currentPaid || payment?.amount || 0),
                        Number(due || 0),
                        Number(carryForward || 0),
                      );
                      const displayBalance = getDisplayBalanceValues({
                        due,
                        carryForward,
                        currentDue: due,
                        currentAdvance: carryForward,
                        bill: Number(user?.monthlyBill || 0),
                        amount: Number(currentPaid || payment?.amount || 0),
                        previousDue: Number(openingDue || 0),
                        previousAdvance: Number(openingAdvance || 0),
                      });
                      const isSelected = selectedCustomerId === user.id;
                      return (
                        <div
                          role="button"
                          tabIndex={0}
                          className={`users-mobile-item monthly-sheet-mobile-item${isSelected ? " users-mobile-item--active" : ""}`}
                          onClick={() => openCustomerDetails(user.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openCustomerDetails(user.id);
                            }
                          }}
                          key={user.id}
                        >
                          <div className="users-mobile-avatar" aria-hidden="true">
                            {getInitials(user.name)}
                          </div>
                          <div className="users-mobile-item-content">
                            <div className="users-mobile-item-top">
                              <div className="users-mobile-item-title">
                                {user.name || "Unnamed customer"}
                              </div>
                              <div className="users-mobile-item-status">
                                <span
                                  className={`status ${badgeMeta.className} user-inline-badge user-inline-badge--status`}
                                >
                                  {badgeMeta.label}
                                </span>
                              </div>
                            </div>
                            <div className="users-mobile-item-bottom">
                              <div className="users-mobile-item-meta">
                                <span>{user.phone || "No phone on file"}</span>
                              </div>
                              <div className="users-mobile-item-actions">
                                <button
                                  type="button"
                                  className="monthly-sheet-mobile-sms-btn"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setSmsRecipient(user);
                                  }}
                                >
                                  <Send size={22} />
                                </button>
                                <button
                                  type="button"
                                  className="users-mobile-item-chevron-btn"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openCustomerDetails(user.id);
                                  }}
                                  aria-label={`Open ${user.name || "customer"} details`}
                                >
                                  <FiChevronRight className="users-mobile-item-chevron" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="sheet-empty-content">
                <span>
                  <FiUsers />
                </span>
                <h3>{t("start_with_first_customer", "Start with your first customer")}</h3>
                <p>
                  {t("add_customers_hint", "Add customers from the Users page, then come back to record their payments for")} {translateMonth(monthNames[month - 1])} {language === "bn" ? toBengaliNumerals(year) : year}.
                </p>
                <Link className="btn btn-primary" to="/users">
                  {t("users")}
                </Link>
              </div>
            )}
            {rows.length > 0 && !filteredRows.length && (
              <p className="empty">{t("no_customers_found", "No customers match your search.")}</p>
            )}
            {rows.length > 0 && filteredRows.length > 0 && pageCount > 1 && (
              <div className="table-footer monthly-sheet-footer">
                <div className="table-footer-info monthly-sheet-footer-info">
                  Showing {formatNumber(showingFrom)}–{formatNumber(showingTo)} of {formatNumber(filteredRows.length)} records
                </div>
                <div className="table-footer-page monthly-sheet-footer-page">
                  Page {formatNumber(currentPageIndex)} of {formatNumber(pageCount)}
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
        </>
      )}
      {showStandaloneMobileDetail && (
        <div className="users-mobile-detail-screen" role="dialog" aria-modal="false">
          <button
            type="button"
            className="users-mobile-back-btn"
            onClick={closeCustomerDetails}
          >
            <FiArrowLeft /> Back
          </button>

          <div className="users-mobile-profile-card">
            <div className="users-mobile-avatar" aria-hidden="true">
              {getInitials(selectedCustomer.user.name)}
            </div>
            <div className="users-mobile-profile-copy">
              <div className="users-mobile-profile-title">
                <h3>{selectedCustomer.user.name || "Unnamed customer"}</h3>
                <span
                  className={`status ${(() => {
                    const selectedStatus = selectedCustomer.status ||
                      (Number(
                        selectedCustomer.currentPaid ||
                          selectedCustomer.payment?.amount ||
                          0,
                      ) > 0 && Number(selectedCustomer.due) > 0
                        ? "Partial"
                        : Number(
                            selectedCustomer.currentPaid ||
                              selectedCustomer.payment?.amount ||
                              0,
                          ) > 0
                          ? "Paid"
                          : "Pending");
                    return getMonthlySheetStatusMeta(
                      selectedStatus,
                      Number(selectedCustomer.user?.monthlyBill || 0),
                      Number(
                        selectedCustomer.currentPaid ||
                          selectedCustomer.payment?.amount ||
                          0,
                      ),
                      Number(selectedCustomer.due || 0),
                      Number(selectedCustomer.carryForward || 0),
                    ).className;
                  })()} user-inline-badge user-inline-badge--status`}
                >
                  {(() => {
                    const selectedStatus = selectedCustomer.status ||
                      (Number(
                        selectedCustomer.currentPaid ||
                          selectedCustomer.payment?.amount ||
                          0,
                      ) > 0 && Number(selectedCustomer.due) > 0
                        ? "Partial"
                        : Number(
                            selectedCustomer.currentPaid ||
                              selectedCustomer.payment?.amount ||
                              0,
                          ) > 0
                          ? "Paid"
                          : "Pending");
                    return getMonthlySheetStatusMeta(
                      selectedStatus,
                      Number(selectedCustomer.user?.monthlyBill || 0),
                      Number(
                        selectedCustomer.currentPaid ||
                          selectedCustomer.payment?.amount ||
                          0,
                      ),
                      Number(selectedCustomer.due || 0),
                      Number(selectedCustomer.carryForward || 0),
                    ).label;
                  })()}
                </span>
              </div>
              <div className="users-mobile-profile-meta">
                <span>
                  <FiPhone /> {selectedCustomer.user.phone || "No phone on file"}
                </span>
                <span>
                  <FiTag /> {selectedCustomer.user.category || "Uncategorized"}
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
              onClick={() => setSmsRecipient(selectedCustomer.user)}
            >
              <Send size={16} /> Send SMS
            </button>
            <button
              type="button"
              className="users-mobile-action users-mobile-action--ghost"
              onClick={() =>
                setEditing({
                  user: selectedCustomer.user,
                  payment: selectedCustomer.payment,
                  openingDue: selectedCustomer.openingDue,
                })
              }
            >
              <FiEdit2 /> Edit Payment
            </button>
          </div>
          <div className="users-mobile-action-row users-mobile-action-row--secondary">
            {selectedCustomer.payment && (
              <button
                type="button"
                className="users-mobile-action users-mobile-action--ghost"
                onClick={() => setPaymentAction({ payment: selectedCustomer.payment, mode: "void" })}
              >
                <FiTrash2 /> Void Payment
              </button>
            )}
          </div>
        </div>
      )}
      {editing && (
        <PaymentModal
          data={editing}
          month={month}
          year={year}
          ownerId={signedInUser?.uid}
          close={() => setEditing(null)}
        />
      )}
      {paymentAction && paymentAction.mode === "void" && (
        <ConfirmModal
          title="Void payment"
          message="Select a payment from the current month and provide a reason to void it. Only the selected payment will be excluded from financial calculations."
          confirmText="Mark as Voided"
          cancelText="Cancel"
          modalClassName="void-payment-modal"
          onConfirm={() => submitVoidPayment(paymentAction.payment)}
          onCancel={closePaymentAction}
        >
          <div className="form void-payment-form">
            <label className="void-payment-field">
              <span className="void-payment-label">Select Payment</span>
              <div className="payment-list-select">
                {allPayments
                  .filter((payment) => {
                    const { month: paymentMonth, year: paymentYear } = getPaymentMonthYear(payment);
                    const isCurrentMonth = Number(paymentMonth) === Number(month) && Number(paymentYear) === Number(year);
                    const sameUser = payment.userId === selectedCustomer?.user?.id || payment.userName === selectedCustomer?.user?.name || payment.customerId === selectedCustomer?.user?.id || payment.customerName === selectedCustomer?.user?.name;
                    return isCurrentMonth && sameUser && !payment.isDeleted && !payment.deletedAt;
                  })
                  .sort((left, right) => Number(right.amount || 0) - Number(left.amount || 0))
                  .map((payment, index) => {
                    const isSelected = paymentAction.payment?.id === payment.id;
                    const paymentDateLabel = payment.paymentDateText || formatDate(payment.paymentDate || payment.createdAt);
                    const shortDate = (() => {
                      const baseDate = payment.paymentDate || payment.createdAt;
                      const dateValue = baseDate?.toDate ? baseDate.toDate() : baseDate instanceof Date ? baseDate : new Date(baseDate);
                      if (Number.isNaN(dateValue?.getTime?.() ?? NaN)) return paymentDateLabel;
                      return new Intl.DateTimeFormat("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      }).format(dateValue);
                    })();
                    const additionalDue = Number(payment.additionalDue || payment.extraDue || payment.extraAmountDue || 0);
                    return (
                      <button
                        key={payment.id || `${payment.userId}-${index}`}
                        type="button"
                        className={`payment-option${isSelected ? " payment-option--selected" : ""}`}
                        onClick={() => setPaymentAction({ ...paymentAction, payment })}
                      >
                        <div className="payment-option__top">
                          <span className="payment-option__title">Payment #{index + 1}</span>
                          {isSelected ? <span className="payment-option__check">✓</span> : null}
                        </div>
                        <span className="payment-option__line">📅 {shortDate}</span>
                        <span className="payment-option__line">💰 Payment: {money(payment.amount || 0)}</span>
                        {additionalDue > 0 ? (
                          <span className="payment-option__line payment-option__line--muted">➕ Additional Due: {money(additionalDue)}</span>
                        ) : null}
                      </button>
                    );
                  })}
              </div>
            </label>
            <label className="void-payment-field">
              <span className="void-payment-label">Reason Type</span>
              <select value={voidReasonType} onChange={(event) => setVoidReasonType(event.target.value)}>
                <option value="Wrong Amount">Wrong Amount</option>
                <option value="Duplicate Entry">Duplicate Entry</option>
                <option value="Customer Refund">Customer Refund</option>
                <option value="Transferred Customer">Transferred Customer</option>
                <option value="Entered by Mistake">Entered by Mistake</option>
                <option value="Other">Other</option>
              </select>
            </label>
            {voidReasonType === "Other" ? (
              <label className="void-payment-field void-payment-field--inline">
                <input
                  type="text"
                  value={customReasonText}
                  onChange={(event) => setCustomReasonText(event.target.value)}
                  placeholder="Enter custom reason..."
                />
              </label>
            ) : null}
            {voidError ? <p className="payment-action-error">{voidError}</p> : null}
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
