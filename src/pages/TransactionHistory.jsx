import { FiCalendar, FiFileText, FiSearch } from "react-icons/fi";

import { useEffect, useMemo, useState } from "react";
import useOwnedCollection from "../hooks/useOwnedCollection";
import { useLanguage } from "../context/LanguageContext";
import { money, monthNames } from "../utils/date";
import { exportTransactionPdf } from "../utils/pdf";
import { getStoredTheme } from "../utils/theme";
import {
  buildMonthlySheetLedgerRow,
  createTransactionRowFromPayment,
  formatBalanceDisplayValue,
  getDisplayBalanceValues,
  getMonthPaymentTransactions,
  getPaymentMonthYear,
  getPeriodKey,
  matchesPaymentToUser,
} from "../utils/payments";

const parsePaymentTimestamp = (payment) => {
  const timestamp =
    payment?.paymentDate || payment?.createdAt || payment?.timestamp;
  if (!timestamp) return null;
  if (typeof timestamp.toDate === "function") return timestamp.toDate();
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === "string" || typeof timestamp === "number") {
    const parsed = new Date(timestamp);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof timestamp.seconds === "number")
    return new Date(timestamp.seconds * 1000);
  return null;
};

const getPaymentTime = (payment) =>
  parsePaymentTimestamp(payment)?.getTime() || 0;

const getMonthLabel = (payment) => {
  const monthValue = Number(payment?.month);

  if (Number.isFinite(monthValue) && monthValue >= 1 && monthValue <= 12) {
    return monthNames[monthValue - 1] || `Month ${monthValue}`;
  }

  return payment?.month || "--";
};

const getRowDateTime = (row) => {
  const timestampValue =
    row?.dateTime || row?.paymentDate || row?.createdAt || row?.timestamp;
  if (!timestampValue) return null;
  if (typeof timestampValue?.toDate === "function")
    return timestampValue.toDate();
  if (timestampValue instanceof Date) return timestampValue;
  if (
    typeof timestampValue === "string" ||
    typeof timestampValue === "number"
  ) {
    const parsed = new Date(timestampValue);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof timestampValue?.seconds === "number") {
    return new Date(timestampValue.seconds * 1000);
  }
  return null;
};

const getRowMonthSectionKey = (
  row,
  fallbackYear = new Date().getFullYear(),
) => {
  const parsedDate = getRowDateTime(row);
  if (parsedDate) {
    return `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, "0")}`;
  }
  const explicitMonth = Number(row?.month || row?.paymentMonth || 0);
  const explicitYear = Number(
    row?.year || row?.paymentYear || fallbackYear || 0,
  );
  if (
    explicitMonth >= 1 &&
    explicitMonth <= 12 &&
    Number.isFinite(explicitYear)
  ) {
    return `${explicitYear}-${String(explicitMonth).padStart(2, "0")}`;
  }
  return `${fallbackYear}-00`;
};

const getRowMonthSectionLabel = (
  row,
  fallbackYear = new Date().getFullYear(),
) => {
  const parsedDate = getRowDateTime(row);
  if (parsedDate) {
    const monthName = monthNames[parsedDate.getMonth()] || "Month";
    return `${monthName} ${parsedDate.getFullYear()}`;
  }
  const explicitMonth = Number(row?.month || row?.paymentMonth || 0);
  const explicitYear = Number(
    row?.year || row?.paymentYear || fallbackYear || 0,
  );
  if (
    explicitMonth >= 1 &&
    explicitMonth <= 12 &&
    Number.isFinite(explicitYear)
  ) {
    const monthName = monthNames[explicitMonth - 1] || "Month";
    return `${monthName} ${explicitYear}`;
  }
  return `${monthNames[0] || "Month"} ${fallbackYear}`;
};

const isVoidActionRow = (row) => {
  const paymentType = String(row?.paymentType || row?.transactionType || "")
    .trim()
    .toLowerCase();
  const relatedReference =
    row?.relatedPaymentId || row?.relatedTransactionId || "";
  const status = String(row?.status || "")
    .trim()
    .toLowerCase();
  const amount = Number(row?.amount || 0);
  return (
    Boolean(relatedReference) ||
    paymentType === "void payment" ||
    (status === "voided" && amount === 0 && paymentType.includes("reversal"))
  );
};

const sortRowsForDisplay = (rows = []) => {
  const copies = [...rows];
  copies.sort((left, right) => {
    const leftTime = getRowDateTime(left)?.getTime?.() || 0;
    const rightTime = getRowDateTime(right)?.getTime?.() || 0;
    const leftRelatedRef =
      left?.relatedPaymentId || left?.relatedTransactionId || "";
    const rightRelatedRef =
      right?.relatedPaymentId || right?.relatedTransactionId || "";
    const leftIsVoidAction = isVoidActionRow(left);
    const rightIsVoidAction = isVoidActionRow(right);

    if (leftIsVoidAction && leftRelatedRef) {
      const matchesOriginal =
        leftRelatedRef === right?.id ||
        leftRelatedRef === right?.transactionId ||
        leftRelatedRef === right?.customerId ||
        leftRelatedRef === right?.paymentId;
      if (matchesOriginal) return 1;
    }

    if (rightIsVoidAction && rightRelatedRef) {
      const matchesOriginal =
        rightRelatedRef === left?.id ||
        rightRelatedRef === left?.transactionId ||
        rightRelatedRef === left?.customerId ||
        rightRelatedRef === left?.paymentId;
      if (matchesOriginal) return -1;
    }

    return rightTime - leftTime;
  });
  return copies;
};

const createTransactionRow = (payment, index, ledgerRow) =>
  createTransactionRowFromPayment(payment, index, ledgerRow);

const normalizeStoredTransactionStatus = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized || null;
};

const normalizeStatusValue = (value) => String(value || "").trim().toLowerCase();

const getPermanentBalanceSnapshot = (payment = {}, row = {}) => ({
  bill: Number(payment?.billAmount ?? payment?.monthlyBill ?? payment?.bill ?? row?.bill ?? row?.monthlyBill ?? 0),
  amount: Number(payment?.currentPaid ?? payment?.amount ?? row?.currentPaid ?? row?.amount ?? 0),
  due: Number(payment?.currentDue ?? payment?.due ?? row?.currentDue ?? row?.due ?? 0),
  carryForward: Number(payment?.currentAdvance ?? payment?.carryForward ?? row?.currentAdvance ?? row?.carryForward ?? 0),
  previousDue: Number(payment?.previousDue ?? row?.previousDue ?? 0),
  previousAdvance: Number(payment?.previousAdvance ?? row?.previousAdvance ?? 0),
  previousPaid: Number(payment?.previousPaid ?? row?.previousPaid ?? 0),
  additionalDue: Number(payment?.additionalDue ?? payment?.extraDue ?? row?.additionalDue ?? row?.extraDue ?? 0),
});

const getPermanentTransactionStatus = (row, payment = null) => {
  const explicitStatus = normalizeStatusValue(
    payment?.status ||
      payment?.originalStatus ||
      payment?.transactionStatus ||
      payment?.paymentStatus ||
      payment?.ledgerStatus ||
      row?.status,
  );

  if (["voided", "reversed", "removed"].includes(explicitStatus)) {
    if (isVoidActionRow(row)) {
      return explicitStatus;
    }
    const originalStatus = normalizeStoredTransactionStatus(payment?.originalStatus || row?.originalStatus);
    if (originalStatus) {
      return originalStatus;
    }
  }

  return explicitStatus || normalizeStoredTransactionStatus(row?.status);
};

const getTransactionStatusDetails = (row, payment = null) => {
  const explicitStatus = getPermanentTransactionStatus(row, payment);

  if (explicitStatus) {
    const label = explicitStatus.charAt(0).toUpperCase() + explicitStatus.slice(1);
    return {
      label,
      tone: explicitStatus,
      className: `status-${explicitStatus}`,
    };
  }

  return {
    label: "—",
    tone: "neutral",
    className: "status-neutral",
  };
};

const getTransactionStatusBadgeClass = (row, payment = null) =>
  getTransactionStatusDetails(row, payment).className;

export default function TransactionHistory() {
  const { t, formatMoney, formatNumber, translateMonth, translateStatus, toBengaliNumerals, language } = useLanguage();
  const currentYear = new Date().getFullYear();
  const currentMonth = `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState("date");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const { data: payments, loading } = useOwnedCollection("payments");
  const { data: users = [] } = useOwnedCollection("users");

  const searchTerm = useMemo(() => search.trim().toLowerCase(), [search]);
  const selectedMonthValue = useMemo(() => {
    if (!selectedMonth) return null;
    const [yearValue, monthValue] = selectedMonth.split("-");
    return {
      year: Number(yearValue) || currentYear,
      month: Number(monthValue) || 1,
    };
  }, [selectedMonth, currentYear]);

  const filteredPayments = useMemo(() => {
    const allPayments = payments || [];
    let data = [...allPayments];

    const hasExplicitRange = Boolean(fromDate || toDate);
    const shouldUseMonthFilter = !(searchTerm || hasExplicitRange);

    if (shouldUseMonthFilter && selectedMonthValue) {
      data = allPayments.filter((payment) => {
        const { month: paymentMonth, year: paymentYear } =
          getPaymentMonthYear(payment);
        return (
          Number(paymentYear) === Number(selectedMonthValue.year) &&
          Number(paymentMonth) === Number(selectedMonthValue.month)
        );
      });
    }

    if (searchTerm) {
      data = data.filter((p) => {
        const haystacks = [
          p.userName,
          p.customerName,
          p.transactionId,
          p.notes,
          p.paymentType,
          p.reason,
          p.reasonType,
        ];
        return haystacks.some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(searchTerm),
        );
      });
    }

    if (fromDate) {
      const from = new Date(fromDate);
      data = data.filter((p) => {
        const value = getPaymentTime(p);
        return value >= from.getTime();
      });
    }

    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      data = data.filter((p) => {
        const value = getPaymentTime(p);
        return value > 0 && value <= to.getTime();
      });
    }

    data.sort((a, b) => getPaymentTime(b) - getPaymentTime(a));

    return data;
  }, [filterMode, payments, searchTerm, fromDate, toDate, selectedMonthValue]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterMode, searchTerm, fromDate, toDate, selectedMonth]);

  const TRANSACTIONS_PER_PAGE = 20;

  const transactionRows = useMemo(
    () =>
      sortRowsForDisplay(
        filteredPayments.map((payment, index) => {
          const user = (users || []).find((candidate) => matchesPaymentToUser(payment, candidate)) || {
            id: payment?.userId || payment?.customerId || payment?.id || "",
            userId: payment?.userId || payment?.customerId || payment?.id || "",
            name: payment?.userName || payment?.customerName || "Customer",
            userName: payment?.userName || payment?.customerName || "Customer",
            customerId: payment?.customerId || payment?.userId || payment?.id || "",
            customerName: payment?.customerName || payment?.userName || "Customer",
            monthlyBill: Number(payment?.monthlyBill || payment?.bill || payment?.billAmount || 0),
          };
          const { month: paymentMonth, year: paymentYear } = getPaymentMonthYear(payment);
          const resolvedMonth = Number(paymentMonth || 0);
          const resolvedYear = Number(paymentYear || 0);
          const currentPeriodKey = getPeriodKey(resolvedMonth, resolvedYear);
          const currentPeriodPayments = getMonthPaymentTransactions({
            payments: payments || [],
            userId: user?.id || user?.userId || user?.customerId || "",
            userName: user?.name || user?.userName || user?.customerName || "",
            month: resolvedMonth,
            year: resolvedYear,
          });
          const history = (payments || []).filter((candidate) => {
            if (!matchesPaymentToUser(candidate, user)) return false;
            const { month: candidateMonth, year: candidateYear } = getPaymentMonthYear(candidate);
            return getPeriodKey(candidateMonth, candidateYear) < currentPeriodKey;
          });
          const ledgerRow = buildMonthlySheetLedgerRow({
            user,
            payments: currentPeriodPayments,
            history,
            month: resolvedMonth,
            year: resolvedYear,
          });
          const row = createTransactionRow(payment, index, ledgerRow);

          const permanentSnapshot = getPermanentBalanceSnapshot(payment, row);
          const permanentStatus = getPermanentTransactionStatus(row, payment);

          row.bill = permanentSnapshot.bill;
          row.amount = permanentSnapshot.amount;
          row.due = permanentSnapshot.due;
          row.carryForward = permanentSnapshot.carryForward;
          row.currentDue = permanentSnapshot.due;
          row.currentAdvance = permanentSnapshot.carryForward;
          row.previousDue = permanentSnapshot.previousDue;
          row.previousAdvance = permanentSnapshot.previousAdvance;
          row.previousPaid = permanentSnapshot.previousPaid;
          row.additionalDue = permanentSnapshot.additionalDue;

          if (permanentStatus) {
            row.status = permanentStatus;
            row.ledgerStatus = permanentStatus;
            row.transactionStatus = permanentStatus;
          }

          return row;
        }),
      ),
    [filteredPayments, payments, users],
  );

  const voidedOriginalReferences = useMemo(() => {
    const references = new Set();

    transactionRows.forEach((row) => {
      if (!isVoidActionRow(row)) return;
      const relatedReference = row.relatedPaymentId || row.relatedTransactionId || "";
      if (relatedReference) {
        references.add(String(relatedReference));
      }
    });

    return references;
  }, [transactionRows]);

  const isVoidedOriginalTransaction = (row) => {
    const identifiers = [row?.id, row?.transactionId, row?.paymentId, row?.customerId]
      .filter(Boolean)
      .map((value) => String(value));
    return identifiers.some((value) => voidedOriginalReferences.has(value));
  };

  const pageCount = Math.max(
    1,
    Math.ceil(transactionRows.length / TRANSACTIONS_PER_PAGE),
  );
  const currentPageIndex = Math.min(currentPage, pageCount);
  const pagePayments = useMemo(
    () =>
      transactionRows.slice(
        (currentPageIndex - 1) * TRANSACTIONS_PER_PAGE,
        currentPageIndex * TRANSACTIONS_PER_PAGE,
      ),
    [transactionRows, currentPageIndex],
  );
  const groupedPagePayments = useMemo(() => {
    const groups = new Map();
    pagePayments.forEach((row) => {
      const sectionKey = getRowMonthSectionKey(
        row,
        selectedMonthValue?.year || currentYear,
      );
      if (!groups.has(sectionKey)) {
        groups.set(sectionKey, {
          key: sectionKey,
          label: getRowMonthSectionLabel(
            row,
            selectedMonthValue?.year || currentYear,
          ),
          rows: [],
        });
      }
      groups.get(sectionKey).rows.push(row);
    });
    return Array.from(groups.values());
  }, [pagePayments, selectedMonthValue, currentYear]);
  const showingFrom =
    transactionRows.length === 0
      ? 0
      : (currentPageIndex - 1) * TRANSACTIONS_PER_PAGE + 1;

  const showingTo = Math.min(
    currentPageIndex * TRANSACTIONS_PER_PAGE,
    transactionRows.length,
  );
  const summary = useMemo(() => {
    const totalTransactions = transactionRows.length;
    const revenueRows = transactionRows.filter(
      (row) => row.contributesToRevenue !== false,
    );

    const totalCollection = revenueRows.reduce(
      (sum, row) => sum + Number(row.amount || 0),
      0,
    );

    const averagePayment =
      totalTransactions > 0 ? totalCollection / totalTransactions : 0;

    return {
      totalTransactions,
      totalCollection,
      averagePayment,
    };
  }, [transactionRows]);

  const historyHeaderLabel = useMemo(() => {
    if (filterMode === "date" && (fromDate || toDate)) {
      const startLabel = fromDate
        ? new Date(fromDate).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : "Start";
      const endLabel = toDate
        ? new Date(toDate).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : "End";
      return `Transactions from ${startLabel} to ${endLabel}.`;
    }

    if (selectedMonthValue) {
      const monthName = monthNames[selectedMonthValue.month - 1] || "Month";
      return `Transactions for ${monthName} ${selectedMonthValue.year}.`;
    }

    return "Showing transactions across all months.";
  }, [filterMode, fromDate, toDate, selectedMonthValue]);

  const exportRows = useMemo(
    () =>
      transactionRows.map((row) => ({
        TransactionID: row.transactionId || "--",
        CustomerID: row.customerId || "--",
        Customer: row.customerName || "Customer",
        Month: getMonthLabel({ month: row.month }),
        Year: row.year || "--",
        Amount: row.amount || 0,
        Due: row.due || 0,
        CarryForward: getDisplayBalanceValues({
          due: row.due,
          carryForward: row.carryForward,
          currentDue: row.currentDue,
          currentAdvance: row.currentAdvance,
          bill: Number(row.bill || 0),
          amount: Number(row.amount || 0),
          previousDue: Number(row.previousDue || 0),
          previousAdvance: Number(row.previousAdvance || 0),
          previousPaid: Number(row.previousPaid || 0),
          additionalDue: Number(row.additionalDue ?? row.extraDue ?? 0),
        }).carryForward,
        PaymentDate: row.paymentDate || "--",
        PaymentTime: row.paymentTime || "--",
        PaymentType: row.paymentType || "Payment",
        CreatedBy: row.createdBy || "--",
        Status: getTransactionStatusDetails(row, row).label,
        Notes: row.notes || "",
      })),
    [transactionRows],
  );

  const handleExportPdf = () =>
    exportTransactionPdf({
      rows: exportRows,
      companyName: "Bill Sheet",
      theme: getStoredTheme(),
      year: selectedMonthValue?.year || currentYear,
    });

  return (
    <div className="page transaction-history-page">
      <div className="page-title transaction-header">
        <div>
          <h2>📒 {t("transaction_history")}</h2>

          <p>{t("transaction_history_subtitle", "Browse transactions by month, date range, or customer name.")}</p>
        </div>
        <div className="transaction-actions">
          <div className="year-selector-shell">
            <label className="year-selector-shell">
              <input
                id="month-selector"
                className="year-selector"
                type="month"
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
              />
            </label>
          </div>
          <button
            className="btn btn-primary transaction-history-pdf-btn"
            onClick={handleExportPdf}
            disabled={!filteredPayments.length}
          >
            <FiFileText />
            <span>{t("export_pdf")}</span>
          </button>
        </div>
      </div>

      <section className="panel transaction-history-panel">
        <div className="history-toolbar transaction-history-toolbar">
          <div className="filter-toolbar transaction-history-filter-toolbar">
            <div className="filter-mode transaction-history-filter-mode">
              <button
                className={filterMode === "date" ? "active" : ""}
                onClick={() => {
                  setFilterMode("date");
                  setSearch("");
                  setFromDate("");
                  setToDate("");
                }}
              >
                📅 {t("date")}
              </button>

              <button
                className={filterMode === "customer" ? "active" : ""}
                onClick={() => {
                  setFilterMode("customer");
                  setSearch("");
                  setFromDate("");
                  setToDate("");
                }}
              >
                👤 {t("name")}
              </button>
            </div>

            <div className="filter-fields transaction-history-filter-fields">
              <div className="transaction-history-control-shell">
                {filterMode === "customer" ? (
                  <div className="search-box transaction-history-search-box">
                    <FiSearch />

                    <input
                      type="text"
                      placeholder={t("search_customer_placeholder", "Search customer by name or phone")}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="toolbar-group transaction-history-toolbar-group">
                    <div className="date-box transaction-history-date-box">
                      <FiCalendar />
                      <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                      />
                    </div>

                    <div className="date-box transaction-history-date-box">
                      <FiCalendar />
                      <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="transaction-table">
          <div className="transaction-head">
            <div>{t("date")}</div>
            <div>{t("name")}</div>
            <div>{t("monthly_bill")}</div>
            <div>{t("paid")}</div>
            <div>{t("due")}</div>
            <div>{t("status")}</div>
          </div>

          <div className="transaction-body">
            {loading ? (
              <p className="empty">Loading transactions…</p>
            ) : groupedPagePayments.length ? (
              groupedPagePayments.map((group) => (
                <div key={group.key} className="transaction-month-group">
                  <div className="transaction-month-group-body">
                    {group.rows.map((row) => {
                      const displayBalance = getDisplayBalanceValues({
                        due: row.due,
                        carryForward: row.carryForward,
                        currentDue: row.currentDue,
                        currentAdvance: row.currentAdvance,
                        bill: Number(row.bill || row.monthlyBill || 0),
                        amount: Number(row.amount || 0),
                        previousDue: Number(row.previousDue || 0),
                        previousAdvance: Number(row.previousAdvance || 0),
                        previousPaid: Number(row.previousPaid || 0),
                        additionalDue: Number(row.additionalDue ?? row.extraDue ?? 0),
                      });
                      const dueValue = Number(displayBalance.due || 0);
                      const carryForwardValue = Number(displayBalance.carryForward || 0);
                      const balanceStyle =
                        dueValue > 0
                          ? { color: "#fda4af" }
                          : carryForwardValue > 0
                            ? { color: "#3B82F6" }
                            : undefined;
                      const balanceLabel = formatBalanceDisplayValue({
                        due: dueValue,
                        carryForward: carryForwardValue,
                      });

                      const isVoidedRow =
                        isVoidActionRow(row) ||
                        ["voided", "reversed"].includes(
                          String(row.status || "")
                            .trim()
                            .toLowerCase(),
                        );
                      const voidReasonLabel = isVoidedRow
                        ? String(
                            row.reason ||
                              row.remarks ||
                              row.reversalReason ||
                              row.voidReason ||
                              row.reasonType ||
                              "",
                          ).trim()
                        : "";
                      const shouldShowReason = Boolean(
                        voidReasonLabel &&
                        voidReasonLabel.toLowerCase() !== "voided",
                      );
                      const isHighlightedVoidedOriginal = isVoidedOriginalTransaction(row);
                      const paidValue = Number(row.amount || 0);

                      const showPaidRow = paidValue > 0;

                      const showBalanceRow =
                        dueValue !== 0 || carryForwardValue !== 0;
                      return (
                        <div
                          className={`transaction-row${isHighlightedVoidedOriginal ? " transaction-row--voided-original" : ""}`}
                          key={
                            row.transactionId ||
                            row.customerId ||
                            row.paymentDate ||
                            row.amount
                          }
                        >
                          <div className="transaction-history-date-cell">
                            <span>
                              {row.dateTime
                                ? row.dateTime.toLocaleDateString("en-GB", {
                                    day: "2-digit",
                                    month: "short",
                                  })
                                : "--"}
                            </span>
                            {row.dateTime ? (
                              <small>
                                {row.paymentTime ||
                                  row.dateTime.toLocaleTimeString([], {
                                    hour: "numeric",
                                    minute: "2-digit",
                                  })}
                              </small>
                            ) : null}
                          </div>

                          <div className="transaction-history-customer-cell">
                            <strong>{row.customerName || "Name"}</strong>
                            {shouldShowReason ? (
                              <div className="transaction-history-reason">
                                <small>{voidReasonLabel}</small>
                              </div>
                            ) : null}
                          </div>

                          <div className="transaction-history-bill-cell">
                            {formatMoney(row.bill)}
                          </div>

                          <div className="transaction-history-paid-cell">
                            {formatMoney(row.amount)}
                          </div>

                          <div
                            className="transaction-history-balance-cell"
                            style={balanceStyle}
                          >
                            {balanceLabel}
                          </div>

                          <div className="transaction-history-status-cell">
                            <span
                              className={getTransactionStatusBadgeClass(row, row)}
                            >
                              {translateStatus(getTransactionStatusDetails(row, row).label)}
                            </span>
                          </div>

                          <div className="transaction-mobile-amounts">
                            {showPaidRow ? (
                              <div className="transaction-mobile-amount-row">
                                <span className="transaction-mobile-amount-label">
                                  {t("paid")}
                                </span>
                                <span className="transaction-mobile-amount-value transaction-mobile-paid-value">
                                  {formatMoney(row.amount)}
                                </span>
                              </div>
                            ) : null}
                            {showBalanceRow ? (
                              <div className="transaction-mobile-amount-row">
                                <span className="transaction-mobile-amount-label">
                                  {t("due")}
                                </span>
                                <span
                                  className="transaction-mobile-amount-value transaction-mobile-balance-value"
                                  style={balanceStyle}
                                >
                                  {balanceLabel}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <p className="empty">{t("no_transactions_found", "No transactions found.")}</p>
            )}
          </div>
        </div>
        {pageCount > 1 && (
          <div className="transaction-pagination">
            <div className="pagination-info">
              Showing {formatNumber(showingFrom)}–{formatNumber(showingTo)} of {formatNumber(transactionRows.length)}{" "}
              transactions
            </div>

            <div className="pagination-page">
              Page {formatNumber(currentPageIndex)} of {formatNumber(pageCount)}
            </div>

            <div className="pagination-buttons">
              <button
                className="btn btn-secondary"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPageIndex === 1}
              >
                ◀ Previous
              </button>

              <button
                className="btn btn-secondary"
                onClick={() =>
                  setCurrentPage((page) => Math.min(pageCount, page + 1))
                }
                disabled={currentPageIndex === pageCount}
              >
                Next ▶
              </button>
            </div>
          </div>
        )}
        <div className="transaction-summary">
          <div className="card summary-box">
            <small>Total Transactions</small>
            <h3>{summary.totalTransactions}</h3>
          </div>

          <div className="card summary-box">
            <small>Total Collection</small>
            <h3>{money(summary.totalCollection)}</h3>
          </div>
        </div>
      </section>
    </div>
  );
}
