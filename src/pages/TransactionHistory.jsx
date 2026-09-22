import { FiCalendar, FiFileText, FiSearch } from "react-icons/fi";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { where } from "firebase/firestore";
import toast from "react-hot-toast";

import FloatingSearch from "../components/FloatingSearch";
import useOwnedCollection from "../hooks/useOwnedCollection";
import { useLanguage } from "../context/LanguageContext";
import { money, monthNames } from "../utils/date";
import { exportTransactionPdf } from "../utils/pdf";
import { getStoredTheme } from "../utils/theme";
import {
  createTransactionRowFromPayment,
  getPaymentMonthYear,
  matchesPaymentToUser,
} from "../utils/payments";

export const TRANSACTIONS_PER_PAGE = 20;

const getCurrentMonthValue = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const getMonthRange = (value) => {
  const [yearValue, monthValue] = String(value || "").split("-");
  const year = Number(yearValue);
  const month = Number(monthValue);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    month < 1 ||
    month > 12
  ) {
    return null;
  }

  return {
    year,
    month,
    start: new Date(year, month - 1, 1, 0, 0, 0, 0),
    end: new Date(year, month, 1, 0, 0, 0, 0),
  };
};

const getTimestampDate = (record = {}) => {
  const timestamp =
    record?.paymentDate ??
    record?.createdAt ??
    record?.timestamp ??
    record?.paymentDateText ??
    record?.createdAtText ??
    record?.timestampText;

  if (!timestamp) return null;
  if (typeof timestamp?.toDate === "function") return timestamp.toDate();
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === "number" || typeof timestamp === "string") {
    const parsed = new Date(timestamp);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof timestamp?.seconds === "number") {
    return new Date(
      timestamp.seconds * 1000 +
        (typeof timestamp.nanoseconds === "number"
          ? Math.floor(timestamp.nanoseconds / 1e6)
          : 0),
    );
  }

  return null;
};

const getTimestampMillis = (record = {}) =>
  getTimestampDate(record)?.getTime() || 0;

const isRecordInMonth = (record, monthRange) => {
  if (!monthRange) return false;

  const date = getTimestampDate(record);
  if (date) {
    const timestamp = date.getTime();
    return timestamp >= monthRange.start.getTime() &&
      timestamp < monthRange.end.getTime();
  }

  const { month, year } = getPaymentMonthYear(record);
  return Number(month) === monthRange.month && Number(year) === monthRange.year;
};

const sortNewestFirst = (records = []) =>
  [...records].sort(
    (left, right) => getTimestampMillis(right) - getTimestampMillis(left),
  );

const uniquePayments = (records = []) => {
  const byId = new Map();

  records.forEach((record) => {
    const key =
      record?.id ||
      record?.transactionId ||
      `${record?.customerId || record?.userId || ""}-${getTimestampMillis(
        record,
      )}-${record?.amount || 0}`;

    if (!byId.has(String(key))) {
      byId.set(String(key), record);
    }
  });

  return Array.from(byId.values());
};

const getMonthTitle = (range, translateMonth) => {
  if (!range) return "";
  const label = monthNames[range.month - 1] || "Month";
  return `${translateMonth(label)} ${range.year}`;
};

const getPaymentDescription = (row) => {
  const explicitType =
    row?.transactionType ||
    row?.type ||
    row?.paymentType ||
    "Payment";

  const normalized = String(explicitType).trim().toLowerCase();

  if (normalized === "payment_reversal" || normalized === "payment reversal") {
    return "Payment Reversal";
  }
  if (normalized === "payment_removed" || normalized === "payment removed") {
    return "Payment Removed";
  }
  if (normalized === "adjustment") {
    return "Adjustment";
  }
  if (normalized === "bill_generated" || normalized === "bill generated") {
    return "Bill Generated";
  }
  if (
    normalized === "carry_forward_due" ||
    normalized === "carry forward due"
  ) {
    return "Carry Forward Due";
  }
  if (
    normalized === "carry_forward_advance" ||
    normalized === "carry forward advance"
  ) {
    return "Carry Forward Advance";
  }

  return "Payment Received";
};

export default function TransactionHistory() {
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const location = useLocation();
  const {
    t,
    formatMoney,
    formatNumber,
    translateMonth,
  } = useLanguage();

  const routedCustomerId =
    location?.state?.selectedCustomerId || location?.state?.customerId || null;
  const routedCustomerName =
    location?.state?.selectedCustomerName || location?.state?.customerName || "";

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthValue());
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const searchRef = useRef(null);
  const lastAutoMonthRef = useRef(getCurrentMonthValue());

  const selectedMonthRange = useMemo(
    () => getMonthRange(selectedMonth),
    [selectedMonth],
  );

  const monthQueryConstraints = useMemo(() => {
    if (!selectedMonthRange) return [];

    return [
      where("paymentDate", ">=", selectedMonthRange.start),
      where("paymentDate", "<", selectedMonthRange.end),
    ];
  }, [selectedMonthRange]);

  const legacyMonthQueryConstraints = useMemo(() => {
    if (!selectedMonthRange) return [];

    return [
      where("month", "==", selectedMonthRange.month),
      where("year", "==", selectedMonthRange.year),
    ];
  }, [selectedMonthRange]);

  const createdAtMonthQueryConstraints = useMemo(() => {
    if (!selectedMonthRange) return [];

    return [
      where("createdAt", ">=", selectedMonthRange.start),
      where("createdAt", "<", selectedMonthRange.end),
    ];
  }, [selectedMonthRange]);

  const {
    data: timestampedPayments = [],
    loading: timestampedLoading,
  } = useOwnedCollection("payments", monthQueryConstraints);

  const {
    data: legacyPayments = [],
    loading: legacyLoading,
  } = useOwnedCollection("payments", legacyMonthQueryConstraints);

  const {
    data: createdAtPayments = [],
    loading: createdAtLoading,
  } = useOwnedCollection("payments", createdAtMonthQueryConstraints);

  const { data: users = [] } = useOwnedCollection("users");

  useEffect(() => {
    const syncCurrentMonth = () => {
      const nextMonth = getCurrentMonthValue();
      if (nextMonth !== lastAutoMonthRef.current) {
        lastAutoMonthRef.current = nextMonth;
        setSelectedMonth(nextMonth);
        setCurrentPage(1);
      }
    };

    syncCurrentMonth();
    const interval = window.setInterval(syncCurrentMonth, 60 * 1000);
    return () => window.clearInterval(interval);
  }, []);

  const monthPayments = useMemo(() => {
    if (!selectedMonthRange) return [];

    return sortNewestFirst(
      uniquePayments([
        ...timestampedPayments,
        ...createdAtPayments,
        ...legacyPayments,
      ]).filter((payment) => isRecordInMonth(payment, selectedMonthRange)),
    );
  }, [
    createdAtPayments,
    legacyPayments,
    selectedMonthRange,
    timestampedPayments,
  ]);

  const usersByIdentity = useMemo(() => {
    const map = new Map();
    (users || []).forEach((user) => {
      [user?.id, user?.userId, user?.customerId].filter(Boolean).forEach((id) => {
        map.set(String(id), user);
      });
    });
    return map;
  }, [users]);

  const resolvePaymentUser = (payment) => {
    const directIdentity = [
      payment?.userId,
      payment?.customerId,
    ].find(Boolean);

    if (directIdentity && usersByIdentity.has(String(directIdentity))) {
      return usersByIdentity.get(String(directIdentity));
    }

    return (
      (users || []).find((candidate) =>
        matchesPaymentToUser(payment, candidate),
      ) || null
    );
  };

  const normalizedSearch = search.trim().toLowerCase();

  const filteredPayments = useMemo(() => {
    return monthPayments.filter((payment) => {
      const matchingUser = resolvePaymentUser(payment);

      if (routedCustomerId || routedCustomerName) {
        const normalizedRouteName = String(routedCustomerName || "")
          .trim()
          .toLowerCase();

        const userIdMatches =
          Boolean(routedCustomerId) &&
          [
            payment?.userId,
            payment?.customerId,
            matchingUser?.id,
          ].some(
            (value) =>
              String(value || "") === String(routedCustomerId),
          );

        const userNameMatches =
          Boolean(normalizedRouteName) &&
          [
            payment?.userName,
            payment?.customerName,
            matchingUser?.name,
          ].some((value) =>
            String(value || "").toLowerCase().includes(normalizedRouteName),
          );

        if (!userIdMatches && !userNameMatches) {
          return false;
        }
      }

      if (!normalizedSearch) return true;

      const haystacks = [
        payment?.userName,
        payment?.customerName,
        matchingUser?.name,
        matchingUser?.phone,
        payment?.transactionId,
        payment?.id,
        payment?.notes,
        payment?.remarks,
        payment?.paymentType,
        payment?.transactionType,
        payment?.reason,
        payment?.reasonType,
      ];

      return haystacks.some((value) =>
        String(value || "").toLowerCase().includes(normalizedSearch),
      );
    });
  }, [
    monthPayments,
    normalizedSearch,
    routedCustomerId,
    routedCustomerName,
    users,
    usersByIdentity,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [normalizedSearch, selectedMonth, routedCustomerId, routedCustomerName]);

  const pageCount = Math.max(
    1,
    Math.ceil(filteredPayments.length / TRANSACTIONS_PER_PAGE),
  );
  const currentPageIndex = Math.min(currentPage, pageCount);

  const pagePayments = useMemo(() => {
    const start = (currentPageIndex - 1) * TRANSACTIONS_PER_PAGE;
    return filteredPayments.slice(start, start + TRANSACTIONS_PER_PAGE);
  }, [currentPageIndex, filteredPayments]);

  const currentRows = useMemo(() => {
    return pagePayments
      .map((payment, index) => {
        const user = resolvePaymentUser(payment);
        const row = createTransactionRowFromPayment(
          {
            ...payment,
            customerName:
              user?.name ||
              payment?.customerName ||
              payment?.userName ||
              "Customer",
            customerId:
              user?.id ||
              payment?.customerId ||
              payment?.userId ||
              "",
            userName:
              user?.name ||
              payment?.userName ||
              payment?.customerName ||
              "Customer",
          },
          index,
        );

        return {
          ...row,
          customerName:
            user?.name ||
            payment?.customerName ||
            payment?.userName ||
            "Customer",
          customerPhone: user?.phone || payment?.phone || "",
          description: getPaymentDescription(row),
        };
      });
  }, [pagePayments, users, usersByIdentity]);

  const monthSummary = useMemo(() => {
    const revenueTransactions = monthPayments.filter((payment) => {
      const row = createTransactionRowFromPayment(payment, 0);
      return row?.contributesToRevenue !== false;
    });

    const totalCollection = revenueTransactions.reduce(
      (sum, payment) => sum + Number(payment?.amount || 0),
      0,
    );

    return {
      totalTransactions: monthPayments.length,
      totalCollection,
    };
  }, [monthPayments]);

  const filteredFrom =
    filteredPayments.length === 0
      ? 0
      : (currentPageIndex - 1) * TRANSACTIONS_PER_PAGE + 1;
  const filteredTo = Math.min(
    currentPageIndex * TRANSACTIONS_PER_PAGE,
    filteredPayments.length,
  );

  const monthTitle = getMonthTitle(selectedMonthRange, translateMonth);

  const handleExportPdf = async () => {
    if (!monthPayments.length || isExportingPdf) return;

    setIsExportingPdf(true);
    try {
      const exportRows = filteredPayments.map((payment, index) => {
      const user = resolvePaymentUser(payment);
      const row = createTransactionRowFromPayment(
        {
          ...payment,
          customerName:
            user?.name ||
            payment?.customerName ||
            payment?.userName ||
            "Customer",
          customerId:
            user?.id ||
            payment?.customerId ||
            payment?.userId ||
            "",
          userName:
            user?.name ||
            payment?.userName ||
            payment?.customerName ||
            "Customer",
        },
        index,
      );

      return {
        TransactionID: row.transactionId || "--",
        CustomerID: row.customerId || "--",
        Customer: row.customerName || "Customer",
        Month: monthTitle,
        Year: selectedMonthRange?.year || "--",
        Amount: row.amount || 0,
        Due: row.due || 0,
        CarryForward: row.carryForward || 0,
        PaymentDate: row.paymentDate || "--",
        PaymentTime: row.paymentTime || "--",
        PaymentType: row.paymentType || row.transactionType || "Payment",
        CreatedBy: row.createdBy || "--",
        Status: row.status || "",
        Notes: row.notes || "",
        CurrentDue: row.currentDue || 0,
        CurrentAdvance: row.currentAdvance || 0,
        PreviousDue: row.previousDue || 0,
        PreviousAdvance: row.previousAdvance || 0,
        PreviousPaid: row.previousPaid || 0,
        AdditionalDue: row.additionalDue || row.extraDue || 0,
        Bill: row.bill || row.monthlyBill || 0,
      };
    });

      await exportTransactionPdf({
        rows: exportRows,
        companyName: "Bill Sheet",
        theme: getStoredTheme(),
        month: monthTitle,
        year: selectedMonthRange?.year || new Date().getFullYear(),
      });
      toast.success("Transaction PDF downloaded successfully.");
    } catch (error) {
      console.error("Transaction PDF generation failed:", error);
      toast.error(error?.message || "Could not generate the transaction PDF.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="page transaction-history-page">
      <div className="ledger-header">
        <div className="ledger-title-copy">
          <h2>{t("transaction_history")}</h2>
          <p>
            {t(
              "transaction_history_subtitle",
              "Permanent transaction ledger organized by calendar month.",
            )}
          </p>
        </div>

        <div className="ledger-actions">
          <label className="ledger-month-picker">
            <FiCalendar aria-hidden="true" focusable="false" />
            <span className="sr-only">
              {t("select_month", "Select month")}
            </span>
            <input
              id="transaction-month-selector"
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              aria-label={t("select_month", "Select month")}
            />
          </label>

          <button
            className="ledger-export-btn"
            type="button"
            onClick={handleExportPdf}
            disabled={!monthPayments.length || isExportingPdf}
          >
            <FiFileText aria-hidden="true" focusable="false" />
            <span>{isExportingPdf ? "Generating PDF..." : t("export_pdf")}</span>
          </button>
        </div>
      </div>

      <section className="ledger-panel">
        <div className="ledger-summary">
          <div>
            <strong>{monthTitle}</strong>
            <span>
              {formatNumber(monthSummary.totalTransactions)}{" "}
              {t("transactions", "Transactions")}
            </span>
          </div>
          <div className="ledger-summary-total">
            <span>{t("total_collected", "Total Collection")}</span>
            <strong>{money(monthSummary.totalCollection)}</strong>
          </div>
        </div>

        <div className="ledger-search">
          <FiSearch aria-hidden="true" focusable="false" />
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t(
              "search_transaction_placeholder",
              "Search customer, phone, transaction ID, or reference",
            )}
            aria-label={t(
              "search_transaction_placeholder",
              "Search transactions",
            )}
          />
        </div>

        {timestampedLoading || createdAtLoading || legacyLoading ? (
          <div className="ledger-empty">
            {t("loading_transactions", "Loading transactions…")}
          </div>
        ) : pagePayments.length ? (
          <>
            <div className="ledger-list" role="list">
              {currentRows.map((row) => {
                const date = getTimestampDate(row);
                const relatedPeriod =
                  Number(row?.month) >= 1 && Number(row?.year) > 0
                    ? `${monthNames[Number(row.month) - 1] || "Month"} ${
                        row.year
                      }`
                    : "";

                return (
                  <article
                    className="ledger-row"
                    role="listitem"
                    key={
                      row.transactionId ||
                      row.id ||
                      `${row.customerId}-${row.paymentDate}-${row.amount}`
                    }
                  >
                    <div className="ledger-row-top">
                      <time dateTime={date ? date.toISOString() : undefined}>
                        {date
                          ? date.toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "--"}
                        {" · "}
                        {date
                          ? date.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : row.paymentTime || "--"}
                      </time>
                      <strong>{formatMoney(row.amount)}</strong>
                    </div>

                    <div className="ledger-customer">{row.customerName}</div>

                    <div className="ledger-row-meta">
                      <span>{row.description}</span>
                      {relatedPeriod ? <span>{relatedPeriod}</span> : null}
                      {row.transactionId ? (
                        <span className="ledger-reference">
                          Ref {String(row.transactionId).slice(0, 16)}
                        </span>
                      ) : null}
                    </div>

                    {row.notes ? (
                      <div className="ledger-note">{row.notes}</div>
                    ) : null}
                  </article>
                );
              })}
            </div>

            <div className="ledger-pagination">
              <span>
                {t("showing", "Showing")} {formatNumber(filteredFrom)}–
                {formatNumber(filteredTo)} {t("of", "of")}{" "}
                {formatNumber(filteredPayments.length)}
              </span>

              {pageCount > 1 ? (
                <div className="ledger-pagination-buttons">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((page) => Math.max(1, page - 1))
                    }
                    disabled={currentPageIndex === 1}
                  >
                    {t("previous", "Previous")}
                  </button>
                  <span>
                    {formatNumber(currentPageIndex)} / {formatNumber(pageCount)}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((page) =>
                        Math.min(pageCount, page + 1),
                      )
                    }
                    disabled={currentPageIndex === pageCount}
                  >
                    {t("next", "Next")}
                  </button>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <div className="ledger-empty">
            <strong>{monthTitle}</strong>
            <span>
              {search
                ? t(
                    "no_transactions_found",
                    "No transactions match your search in this month.",
                  )
                : t(
                    "no_transactions_found",
                    "No transactions recorded for this month yet.",
                  )}
            </span>
          </div>
        )}
      </section>

      <FloatingSearch targetRef={searchRef} />
    </div>
  );
}
