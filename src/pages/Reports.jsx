import React, { useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiArrowRight,
  FiCalendar,
  FiCreditCard,
  FiDollarSign,
  FiDownload,
  FiHash,
  FiSearch,
  FiUser,
} from "react-icons/fi";
import useOwnedCollection from "../hooks/useOwnedCollection";
import { useLanguage } from "../context/LanguageContext";
import { exportAnnualCustomerPdf } from "../utils/pdf";
import { getStoredTheme } from "../utils/theme";
import { formatDate, money } from "../utils/date";
import {
  buildYearlyCustomerReportSummary,
  formatAnnualReportBalanceValue,
  formatBalanceDisplayValue,
  getActivePayments,
  getEffectiveBillForPeriod,
  getPaymentMonthYear,
  matchesPaymentToUser,
} from "../utils/payments";
import { isUserActiveForPeriod } from "../utils/membership";

const resolveReportsBillingStatus = ({ entry }) => {
  const monthNumber = Number(entry?.month || entry?.monthNumber || 0);
  const bill = Number(entry?.bill ?? entry?.monthlyBill ?? 0);
  const paid = Number(entry?.paid ?? 0);
  const endingBalance = Number(entry?.endingBalance ?? entry?.balance ?? 0);
  const isInactiveEntry =
    entry?.status === "Not Joined" ||
    entry?.status === "Inactive" ||
    entry?.status === "N/A" ||
    entry?.status === "na";

  if (isInactiveEntry) {
    return { label: "N/A", tone: "neutral", className: "status-neutral" };
  }

  if (!Number.isFinite(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return { label: "Pending", tone: "pending", className: "status-pending" };
  }

  if (endingBalance < 0) {
    return { label: "Due", tone: "due", className: "status-due" };
  }

  if (endingBalance === 0) {
    return { label: "Paid", tone: "paid", className: "status-paid" };
  }

  return { label: "Advance", tone: "advance", className: "status-advance" };
};

export default function Reports() {
  const {
    t,
    formatMoney,
    formatNumber,
    translateMonth,
    translateStatus,
    toBengaliNumerals,
    language,
  } = useLanguage();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [yearInput, setYearInput] = useState(String(now.getFullYear()));
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const {
    data: users = [],
    loading: usersLoading,
    error: usersError,
  } = useOwnedCollection("users");
  const {
    data: payments = [],
    loading: paymentsLoading,
    error: paymentsError,
  } = useOwnedCollection("payments");

  const customerOptions = useMemo(() => {
    const options = [];
    const seen = new Set();

    (users || []).forEach((user) => {
      const key = user.id || user.name || user.email;
      if (!key || seen.has(key)) return;
      seen.add(key);
      options.push({
        id: user.id,
        name: user.name || user.email || "Customer",
        phone: user.phone || "",
        memberSince: user.createdAt || user.joinedAt || null,
        customerId: user.id,
        user,
      });
    });

    (payments || []).forEach((payment) => {
      const fallbackId = payment.userId || payment.userName || payment.id;
      if (!fallbackId || seen.has(fallbackId)) return;

      const matchingUser = (users || []).find(
        (user) => user.id === payment.userId || user.name === payment.userName,
      );
      seen.add(fallbackId);
      options.push({
        id: fallbackId,
        name: payment.userName || matchingUser?.name || "Customer",
        phone: matchingUser?.phone || payment.phone || "",
        memberSince: matchingUser?.createdAt || matchingUser?.joinedAt || null,
        customerId: payment.userId || payment.id,
        user: matchingUser || null,
      });
    });

    return options.sort((left, right) => left.name.localeCompare(right.name));
  }, [users, payments]);

  const visibleCustomers = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();
    if (!term) return customerOptions;
    return customerOptions.filter((customer) =>
      `${customer.name} ${customer.phone} ${customer.customerId}`
        .toLowerCase()
        .includes(term),
    );
  }, [customerOptions, customerSearch]);

  const selectedCustomer = useMemo(() => {
    return (
      customerOptions.find((customer) => customer.id === selectedCustomerId) ||
      null
    );
  }, [customerOptions, selectedCustomerId]);

  const handleCustomerSelect = (customer) => {
    setSelectedCustomerId(customer.id);
    setCustomerSearch(customer.name || "");
  };

  const handleYearInputChange = (event) => {
    const rawValue = event.target.value.replace(/\D/g, "").slice(0, 4);
    setYearInput(rawValue);

    if (rawValue.length === 4) {
      const numericYear = Number(rawValue);
      if (Number.isFinite(numericYear)) {
        setYear(numericYear);
      }
    }
  };

  const handleYearBlur = () => {
    if (!yearInput || yearInput.length < 4) {
      setYearInput(String(year));
    }
  };

  const activePayments = useMemo(() => getActivePayments(payments), [payments]);

  const yearlySummary = useMemo(() => {
    if (!selectedCustomer) return null;
    return buildYearlyCustomerReportSummary({
      user: selectedCustomer?.user || selectedCustomer,
      payments: payments, // pass all payments so live report can show both active and voided transactions
      year,
    });
  }, [payments, selectedCustomer, year]);

  const previousDue = yearlySummary?.previousDue || 0;
  const previousAdvance = yearlySummary?.previousAdvance || 0;
  const openingBalance = yearlySummary?.openingBalance || 0;
  const paidThisYear = yearlySummary?.totalPaid || 0;
  const annualBill = yearlySummary?.annualBill || 0;
  const outstandingBalance =
    (yearlySummary?.remainingDue ?? yearlySummary?.totalDue) || 0;
  const creditCarryForward =
    (yearlySummary?.remainingAdvance ?? yearlySummary?.totalAdvance) || 0;
  const closingBalance = yearlySummary?.closingBalance || 0;
  const balanceStatus =
    yearlySummary?.closingBalanceStatus || "Account Settled";
  const monthlyHistory = useMemo(() => {
    if (!selectedCustomer || !yearlySummary) return [];
    return yearlySummary.months || [];
  }, [selectedCustomer, yearlySummary]);
  const yearOverview = useMemo(() => {
    const selectedYear = Number(year);
    const today = new Date();
    const yearStart = new Date(selectedYear, 0, 1);
    const yearEnd = new Date(selectedYear, 11, 31, 23, 59, 59);
    const rangeEnd =
      selectedYear === today.getFullYear()
        ? new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate(),
            23,
            59,
            59,
          )
        : yearEnd;

    const getPaymentDateValue = (payment) => {
      if (!payment) return null;
      const candidates = [
        payment?.paymentDate,
        payment?.createdAt,
        payment?.timestamp,
      ];
      for (const candidate of candidates) {
        if (!candidate) continue;
        if (typeof candidate?.toDate === "function") {
          const dateValue = candidate.toDate();
          if (dateValue instanceof Date && !Number.isNaN(dateValue.getTime())) {
            return dateValue;
          }
        }
        if (candidate instanceof Date && !Number.isNaN(candidate.getTime())) {
          return candidate;
        }
        if (typeof candidate === "string") {
          const parsedDate = new Date(candidate);
          if (!Number.isNaN(parsedDate.getTime())) return parsedDate;
        }
      }
      return null;
    };

    const collectionToDate = (activePayments || []).reduce((sum, payment) => {
      const { year: paymentYear } = getPaymentMonthYear(payment);
      if (Number(paymentYear) !== selectedYear) return sum;
      const paymentDate = getPaymentDateValue(payment);
      if (!paymentDate) return sum;
      if (paymentDate < yearStart || paymentDate > rangeEnd) return sum;
      return sum + Number(payment.amount || 0);
    }, 0);

    const annualBillForAllUsers = (users || []).reduce((sum, user) => {
      let monthTotal = 0;
      for (let month = 1; month <= 12; month += 1) {
        if (!isUserActiveForPeriod(user, { month, year: selectedYear }))
          continue;
        const bill = getEffectiveBillForPeriod(user, {
          month,
          year: selectedYear,
        });
        monthTotal += Number(bill || 0);
      }
      return sum + monthTotal;
    }, 0);

    const remainingMonthsStart =
      selectedYear === today.getFullYear() ? today.getMonth() + 1 : 1;
    const remainingToCollect = (users || []).reduce((sum, user) => {
      let monthTotal = 0;
      for (let month = remainingMonthsStart; month <= 12; month += 1) {
        if (!isUserActiveForPeriod(user, { month, year: selectedYear }))
          continue;
        const bill = getEffectiveBillForPeriod(user, {
          month,
          year: selectedYear,
        });
        monthTotal += Number(bill || 0);
      }
      return sum + monthTotal;
    }, 0);

    if (!selectedCustomer) {
      return {
        collection: collectionToDate,
        outstanding: Math.max(0, remainingToCollect - collectionToDate),
        annualBill: annualBillForAllUsers,
      };
    }

    return {
      collection: yearlySummary?.totalPaid || 0,
      outstanding: yearlySummary?.totalDue || 0,
      annualBill: yearlySummary?.annualBill || 0,
    };
  }, [activePayments, selectedCustomer, yearlySummary, users, year]);

  const displayYear = language === "bn" ? toBengaliNumerals(year) : year;
  const displayPrevYear =
    language === "bn" ? toBengaliNumerals(year - 1) : year - 1;

  const summaryCards = useMemo(
    () => [
      {
        label: `${t("from", "From")} ${displayPrevYear}`,
        value: formatMoney(previousDue),
        icon: <FiAlertCircle />,
        accent: "forest",
      },
      {
        label: `${t("annual_bill", "Annual Bill")} ${displayYear}`,
        value: formatMoney(
          selectedCustomer ? annualBill : yearOverview.annualBill || 0,
        ),
        icon: <FiCreditCard />,
        accent: "ocean",
      },
      {
        label: `${t("paid", "Paid")} ${displayYear}`,
        value: formatMoney(
          selectedCustomer ? paidThisYear : yearOverview.collection || 0,
        ),
        icon: <FiDollarSign />,
        accent: "green",
      },
      {
        label: t("due"),
        value: formatMoney(
          selectedCustomer ? outstandingBalance : yearOverview.outstanding || 0,
        ),
        icon: <FiAlertCircle />,
        accent: "amber",
      },
      {
        label: t("advance"),
        value: formatMoney(creditCarryForward),
        icon: <FiArrowRight />,
        accent: "blue",
      },
    ],
    [
      annualBill,
      creditCarryForward,
      displayPrevYear,
      displayYear,
      formatMoney,
      outstandingBalance,
      paidThisYear,
      previousDue,
      selectedCustomer,
      t,
      yearOverview,
    ],
  );

  const exportReport = () => {
    if (!selectedCustomer) return;
    exportAnnualCustomerPdf({
      businessName: "BillSheet",
      customer: selectedCustomer,
      theme: getStoredTheme(),
      year,
      summary: {
        openingBalance,
        previousDue,
        previousAdvance,
        annualBill,
        totalPaid: paidThisYear,
        paidThisYear,
        totalDue: outstandingBalance,
        outstandingBalance,
        totalAdvance: creditCarryForward,
        creditCarryForward,
        carryForward: creditCarryForward,
        remainingDue: outstandingBalance,
        remainingAdvance: creditCarryForward,
        closingBalance,
        balanceStatus,
      },
      history: monthlyHistory,
    });
  };

  return (
    <div className="page reports-page">
      <section className="reports-hero">
        <div>
          <div className="reports-eyebrow">{t("annual_report")}</div>
          <h2>{t("annual_report")}</h2>
          <p>
            {t(
              "annual_report_subtitle",
              "View yearly payment summaries, outstanding balances and carry-forward history.",
            )}
          </p>
        </div>
      </section>

      <section className="reports-summary-grid reports-summary-grid--overview">
        <div className="reports-summary-card reports-summary-card--green">
          <div className="reports-summary-icon">
            <FiDollarSign />
          </div>
          <div className="reports-summary-copy">
            <div className="reports-summary-number">
              {formatMoney(yearOverview.collection)}
            </div>
            <div className="reports-summary-label">
              {selectedCustomer
                ? `${t("collected_in", "Collected in")} ${displayYear}`
                : `${t("total_collected")} ${displayYear}`}
            </div>
          </div>
        </div>
        <div className="reports-summary-card reports-summary-card--amber">
          <div className="reports-summary-icon">
            <FiAlertCircle />
          </div>
          <div className="reports-summary-copy">
            <div className="reports-summary-number">
              {formatMoney(yearOverview.outstanding)}
            </div>
            <div className="reports-summary-label">
              {selectedCustomer
                ? `${t("remaining_unpaid_in", "Remaining unpaid in")} ${displayYear}`
                : `${t("total_due")} ${displayYear}`}
            </div>
          </div>
        </div>
      </section>

      <section className="reports-toolbar">
        <div className="reports-toolbar-row">
          <label className="reports-search-field reports-search-field--wide">
            <FiSearch />
            <input
              value={customerSearch}
              onChange={(event) => setCustomerSearch(event.target.value)}
              placeholder={t(
                "search_customer_placeholder",
                "Search customer by name or phone",
              )}
            />
          </label>

          <label className="reports-year-field">
            <span>{t("year", "Year")}</span>
            <input
              className="reports-year-input"
              type="text"
              inputMode="numeric"
              maxLength="4"
              value={yearInput}
              onChange={handleYearInputChange}
              onBlur={handleYearBlur}
              placeholder={String(now.getFullYear())}
            />
          </label>

          <button
            className="reports-export-btn"
            type="button"
            onClick={exportReport}
          >
            <FiDownload /> {t("export_pdf")}
          </button>
        </div>

        <div className="reports-customer-list-shell">
          {visibleCustomers.length > 0 ? (
            <div className="reports-customer-list" role="listbox">
              {visibleCustomers.map((customer) => {
                const isSelected = selectedCustomerId === customer.id;
                return (
                  <button
                    key={customer.id}
                    type="button"
                    className={`reports-customer-item${
                      isSelected ? " reports-customer-item--active" : ""
                    }`}
                    onClick={() => handleCustomerSelect(customer)}
                  >
                    <span className="reports-customer-avatar">
                      <FiUser />
                    </span>
                    <span className="reports-customer-content">
                      <span className="reports-customer-name">
                        {customer.name}
                      </span>
                      <span className="reports-customer-phone">
                        {customer.phone || "No phone number"}
                      </span>
                    </span>
                    {isSelected ? (
                      <span
                        className="reports-customer-check"
                        aria-hidden="true"
                      >
                        ✓
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="reports-customer-empty">
              <span>No customer found</span>
            </div>
          )}
        </div>
      </section>

      {selectedCustomer ? (
        <>
          {(() => {
            const joinedDate =
              selectedCustomer?.user?.joinDate ||
              selectedCustomer?.user?.createdAt ||
              selectedCustomer?.memberSince;
            const leaveDate =
              selectedCustomer?.user?.leaveDate ||
              selectedCustomer?.user?.archivedAt;
            const hasActiveMonth = (monthlyHistory || []).some(
              (entry) =>
                entry.status !== "Not Joined" &&
                entry.status !== "Inactive" &&
                entry.status !== "N/A",
            );
            const hasActiveWindow = (() => {
              if (!joinedDate && !leaveDate) return true;
              const start = new Date(joinedDate || "");
              const end = leaveDate ? new Date(leaveDate) : null;
              const yearStart = new Date(Number(year), 0, 1);
              const yearEnd = new Date(Number(year), 11, 31, 23, 59, 59);
              if (
                !Number.isNaN(start.getTime()) &&
                !Number.isNaN(yearStart.getTime()) &&
                start > yearEnd
              )
                return false;
              if (end && !Number.isNaN(end.getTime()) && end < yearStart)
                return false;
              return true;
            })();
            if (!hasActiveWindow || !hasActiveMonth) {
              return (
                <section className="reports-empty-state reports-empty-state--notice">
                  <div className="reports-empty-icon">
                    <FiCalendar />
                  </div>
                  <h3>This customer was not active during {year}.</h3>
                  <p>
                    No monthly bills were generated for this year because the
                    customer was outside the active lifecycle window.
                  </p>
                </section>
              );
            }
            return null;
          })()}
          <section className="reports-profile-card">
            <div className="reports-profile-avatar">
              {selectedCustomer.name?.slice(0, 2).toUpperCase() || "CU"}
            </div>
            <div className="reports-profile-details">
              <div className="reports-profile-name">
                {selectedCustomer.name}
              </div>
              <div className="reports-profile-meta">
                <span>
                  <FiUser /> {selectedCustomer.phone || "No phone on file"}
                </span>
                <span>
                  <FiCalendar /> Member since{" "}
                  {formatDate(selectedCustomer.memberSince)}
                </span>
              </div>
            </div>
          </section>

          <section className="reports-summary-grid">
            {summaryCards.map((card) => (
              <div
                key={card.label}
                className={`reports-summary-card reports-summary-card--${card.accent}`}
              >
                <div className="reports-summary-icon">{card.icon}</div>
                <div className="reports-summary-copy">
                  <div className="reports-summary-number">{card.value}</div>
                  <div className="reports-summary-label">{card.label}</div>
                </div>
              </div>
            ))}
          </section>

          <section className="reports-history-card">
            <div className="reports-history-head">
              <div>
                <div className="reports-history-kicker">
                  {t("monthly_sheet")}
                </div>
                <h3>{t("payment_history", "Payment History")}</h3>
              </div>
              <div className="reports-history-chip">
                12 {t("months", "months")}
              </div>
            </div>
            <div className="reports-history-table-wrap">
              <table className="reports-history-table">
                <thead>
                  <tr className="reports-history-row reports-history-row--head">
                    <th scope="col">{t("month", "Month")}</th>
                    <th scope="col">{t("monthly_bill")}</th>
                    <th scope="col">{t("previous_due", "Prev Carried Bal")}</th>
                    <th scope="col">{t("total_required", "Total Required")}</th>
                    <th scope="col">{t("paid")}</th>
                    <th scope="col">{t("ending_bal", "Ending Bal")}</th>
                    <th scope="col">{t("status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyHistory.map((entry) => {
                    const billValue = Number(
                      entry.bill ?? entry.monthlyBill ?? 0,
                    );
                    const paidValue = Number(entry.paid ?? 0);
                    const endingBalanceValue = Number(
                      entry.endingBalance ?? entry.balance ?? 0,
                    );
                    const prevBalanceValue = Number(entry.previousBalance ?? 0);
                    const totalRequiredValue = Number(entry.totalRequired ?? 0);
                    const isInactiveEntry =
                      entry.status === "Not Joined" ||
                      entry.status === "Inactive" ||
                      entry.status === "N/A" ||
                      entry.isInactive;
                    const isPlaceholderRow =
                      entry.isPlaceholder ||
                      (entry.bill == null && entry.endingBalance == null);

                    const prevBalanceLabel =
                      isInactiveEntry || isPlaceholderRow
                        ? "—"
                        : formatBalanceDisplayValue({
                            due:
                              prevBalanceValue < 0
                                ? Math.abs(prevBalanceValue)
                                : 0,
                            carryForward:
                              prevBalanceValue > 0 ? prevBalanceValue : 0,
                          });

                    const endingBalanceLabel =
                      isInactiveEntry || isPlaceholderRow
                        ? "—"
                        : formatBalanceDisplayValue({
                            due:
                              endingBalanceValue < 0
                                ? Math.abs(endingBalanceValue)
                                : 0,
                            carryForward:
                              endingBalanceValue > 0 ? endingBalanceValue : 0,
                          });

                    const statusClass = (
                      entry.status || "pending"
                    ).toLowerCase();
                    const txList = entry.transactions || [];

                    return (
                      <React.Fragment key={entry.month}>
                        <tr className="reports-history-row">
                          <td>
                            <span className="reports-history-month-cell">
                              <span
                                className={`reports-history-status-dot reports-history-status-dot--${
                                  statusClass === "paid"
                                    ? "paid"
                                    : statusClass === "advance"
                                      ? "positive"
                                      : statusClass === "due"
                                        ? "negative"
                                        : statusClass === "partial" ||
                                            statusClass === "pending"
                                          ? "pending"
                                          : "neutral"
                                }`}
                                aria-hidden="true"
                              />
                              <strong>{translateMonth(entry.monthName)}</strong>
                            </span>
                          </td>
                          <td>
                            {isPlaceholderRow || isInactiveEntry
                              ? "—"
                              : formatMoney(billValue)}
                          </td>
                          <td
                            style={
                              prevBalanceValue < 0
                                ? { color: "#EF4444" }
                                : prevBalanceValue > 0
                                  ? { color: "#3B82F6" }
                                  : undefined
                            }
                          >
                            {prevBalanceLabel}
                          </td>
                          <td>
                            {isPlaceholderRow || isInactiveEntry
                              ? "—"
                              : formatMoney(totalRequiredValue)}
                          </td>
                          <td
                            style={{
                              fontWeight: 600,
                              color: paidValue > 0 ? "#10B981" : undefined,
                            }}
                          >
                            {isPlaceholderRow || isInactiveEntry
                              ? "—"
                              : formatMoney(paidValue)}
                          </td>
                          <td
                            style={
                              endingBalanceValue < 0
                                ? { color: "#EF4444" }
                                : endingBalanceValue > 0
                                  ? { color: "#3B82F6" }
                                  : { color: "#059669", fontWeight: 600 }
                            }
                          >
                            {endingBalanceLabel}
                          </td>
                          <td>
                            {isPlaceholderRow || isInactiveEntry ? (
                              <span className="reports-history-status reports-history-status--neutral">
                                —
                              </span>
                            ) : (
                              <span className={`status ${statusClass}`}>
                                {translateStatus(entry.status)}
                              </span>
                            )}
                          </td>
                        </tr>

                        {txList.length > 0 && (
                          <tr className="reports-tx-subrow">
                            <td
                              colSpan="7"
                              style={{
                                padding: "8px 16px 16px 36px",
                                background:
                                  "color-mix(in srgb, var(--surface) 92%, var(--text-primary) 8%)",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "12px",
                                  fontWeight: 700,
                                  color: "var(--text-secondary)",
                                  marginBottom: "6px",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.05em",
                                }}
                              >
                                {t("payment_history", "Payment History")} (
                                {formatNumber(txList.length)})
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "6px",
                                }}
                              >
                                {txList.map((tx, idx) => {
                                  const isVoided =
                                    tx.isDeleted ||
                                    tx.status === "Voided" ||
                                    tx.status === "Reversed" ||
                                    Boolean(tx.voidedBy);
                                  return (
                                    <div
                                      key={tx.id || idx}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        padding: "8px 12px",
                                        borderRadius: "6px",
                                        fontSize: "13px",
                                        background: isVoided
                                          ? "var(--warning-bg)"
                                          : "var(--surface)",
                                        border: "1px solid var(--border)",
                                        borderLeft: isVoided
                                          ? "4px solid var(--danger)"
                                          : "1px solid var(--border)",
                                        borderTop: "1px solid var(--border)",
                                        borderRight: "1px solid var(--border)",
                                        borderBottom: "1px solid var(--border)",
                                      }}
                                    >
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "10px",
                                        }}
                                      >
                                        <span
                                          style={{
                                            fontWeight: 600,
                                            color: "var(--text-secondary)",
                                          }}
                                        >
                                          {formatDate(
                                            tx.paymentDate ||
                                              tx.createdAt ||
                                              tx.timestamp,
                                          )}
                                        </span>
                                        <span
                                          className="tag"
                                          style={{
                                            fontSize: "11px",
                                            padding: "2px 8px",
                                          }}
                                        >
                                          {tx.paymentMethod ||
                                            tx.method ||
                                            "Cash"}
                                        </span>
                                        {tx.notes && (
                                          <span
                                            style={{
                                              color: "var(--text-secondary)",
                                              fontStyle: "italic",
                                              fontSize: "12px",
                                            }}
                                          >
                                            "{tx.notes}"
                                          </span>
                                        )}
                                      </div>

                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "12px",
                                        }}
                                      >
                                        <span
                                          style={{
                                            fontWeight: 700,
                                            textDecoration: isVoided
                                              ? "line-through"
                                              : "none",
                                            color: isVoided
                                              ? "#9CA3AF"
                                              : "#10B981",
                                          }}
                                        >
                                          {formatMoney(tx.amount)}
                                        </span>
                                        {isVoided ? (
                                          <span
                                            className="status voided"
                                            style={{
                                              fontSize: "11px",
                                              padding: "2px 8px",
                                              background: "var(--danger-bg)",
                                              color: "var(--danger)",
                                            }}
                                          >
                                            {t("voided", "Voided")}{" "}
                                            {tx.reason || tx.reversalReason
                                              ? `(${tx.reason || tx.reversalReason})`
                                              : ""}
                                          </span>
                                        ) : (
                                          <span
                                            className="status paid"
                                            style={{
                                              fontSize: "11px",
                                              padding: "2px 8px",
                                            }}
                                          >
                                            {translateStatus(
                                              tx.status || "Paid",
                                            )}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="reports-footer-summary">
            <div>
              <div className="reports-footer-label">
                {t("opening_balance", "Opening Balance")}
              </div>
              <div className="reports-footer-value">
                {formatBalanceDisplayValue({
                  due: previousDue,
                  carryForward: previousAdvance,
                })}
              </div>
            </div>
            <div>
              <div className="reports-footer-label">
                {t("previous_due", "Previous Year Due")}
              </div>
              <div className="reports-footer-value">
                {formatMoney(previousDue)}
              </div>
            </div>
            <div>
              <div className="reports-footer-label">
                {t("previous_advance", "Previous Year Advance")}
              </div>
              <div className="reports-footer-value">
                {formatMoney(previousAdvance)}
              </div>
            </div>
            <div>
              <div className="reports-footer-label">
                {t("annual_bill", "Annual Bill")}
              </div>
              <div className="reports-footer-value">
                {formatMoney(annualBill)}
              </div>
            </div>
            <div>
              <div className="reports-footer-label">
                {t("paid_this_year", "Paid This Year")}
              </div>
              <div className="reports-footer-value">
                {formatMoney(paidThisYear)}
              </div>
            </div>
            <div>
              <div className="reports-footer-label">
                {t("due", "Remaining Due")}
              </div>
              <div className="reports-footer-value reports-footer-value--warning">
                {formatMoney(outstandingBalance)}
              </div>
            </div>
            <div>
              <div className="reports-footer-label">
                {t("advance", "Remaining Advance")}
              </div>
              <div className="reports-footer-value reports-footer-value--credit">
                {formatMoney(creditCarryForward)}
              </div>
            </div>
            <div>
              <div className="reports-footer-label">
                {t("closing_balance", "Closing Balance")}
              </div>
              <div className="reports-footer-value">
                {formatBalanceDisplayValue({
                  due: outstandingBalance,
                  carryForward: creditCarryForward,
                })}
              </div>
            </div>
            <div>
              <div className="reports-footer-label">
                {t("advance", "Carry Forward")}
              </div>
              <div className="reports-footer-value reports-footer-value--credit">
                {formatBalanceDisplayValue({
                  due: 0,
                  carryForward: creditCarryForward,
                })}
              </div>
            </div>
            <p>
              {t("status")}: {translateStatus(balanceStatus)}
            </p>
          </section>
        </>
      ) : (
        <section className="reports-empty-state">
          <div className="reports-empty-icon">
            <FiSearch />
          </div>
          <h3>{t("no_customer_selected", "No customer selected")}</h3>
          <p>
            {t(
              "select_customer_hint",
              "Select a customer to view the annual statement.",
            )}
          </p>
        </section>
      )}
    </div>
  );
}
