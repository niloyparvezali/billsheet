import { FiCalendar, FiFileText, FiSearch } from "react-icons/fi";

import { useEffect, useMemo, useState } from "react";
import useOwnedCollection from "../hooks/useOwnedCollection";
import { money, formatDate, monthNames } from "../utils/date";
import { exportTransactionPdf } from "../utils/pdf";
import {
  createTransactionRowFromPayment,
  filterPaymentsByYear,
  formatBalanceDisplayValue,
  getPaymentMonthYear,
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

const createTransactionRow = (payment, index) =>
  createTransactionRowFromPayment(payment, index);

const getTransactionStatusBadgeClass = (row) => {
  const normalizedStatus = String(row?.status || "")
    .trim()
    .toLowerCase();

  if (["completed", "paid"].includes(normalizedStatus)) return "status-paid";
  if (["advance"].includes(normalizedStatus)) return "status-advance";
  if (["partial"].includes(normalizedStatus)) return "status-partial";
  if (["due"].includes(normalizedStatus)) return "status-due";
  if (
    [
      "voided",
      "reversed",
      "removed",
      "deleted",
      "cancelled",
      "canceled",
      "failed",
      "declined",
    ].includes(normalizedStatus)
  )
    return "status-voided";

  return row?.isRemoved
    ? "status-voided"
    : row?.amount > 0
      ? "status-paid"
      : "status-pending";
};

export default function TransactionHistory() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState("date");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const { data: payments, loading } = useOwnedCollection("payments");

  const searchTerm = useMemo(() => search.trim().toLowerCase(), [search]);

  const yearOptions = useMemo(() => {
    const years = new Set();
    (payments || []).forEach((payment) => {
      const { year } = getPaymentMonthYear(payment);
      if (Number.isFinite(Number(year))) {
        years.add(Number(year));
      }
    });
    years.add(currentYear);
    return Array.from(years).sort((left, right) => right - left);
  }, [payments, currentYear]);

  const filteredPayments = useMemo(() => {
    let data = filterPaymentsByYear(payments || [], selectedYear);

    // Search by customer name or transaction metadata.
    if (searchTerm) {
      data = data.filter((p) => {
        const haystacks = [
          p.userName,
          p.customerName,
          p.transactionId,
          p.notes,
          p.paymentType,
        ];
        return haystacks.some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(searchTerm),
        );
      });
    }

    // From date
    if (fromDate) {
      const from = new Date(fromDate);
      data = data.filter((p) => {
        const value = getPaymentTime(p);
        return value >= from.getTime();
      });
    }

    // To date
    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      data = data.filter((p) => {
        const value = getPaymentTime(p);
        return value > 0 && value <= to.getTime();
      });
    }
    // Always newest first, preserving each payment as its own immutable transaction row.
    data.sort((a, b) => getPaymentTime(b) - getPaymentTime(a));

    return data;
  }, [payments, searchTerm, fromDate, toDate, selectedYear]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, fromDate, toDate, selectedYear]);

  const TRANSACTIONS_PER_PAGE = 20;

  const transactionRows = useMemo(
    () =>
      filteredPayments.map((payment, index) =>
        createTransactionRow(payment, index),
      ),
    [filteredPayments],
  );

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

  const yearRangeLabel = useMemo(() => {
    const yearStart = new Date(selectedYear, 0, 1);
    const yearEnd = new Date(selectedYear, 11, 31, 23, 59, 59, 999);
    return {
      start: yearStart.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
      end: yearEnd.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    };
  }, [selectedYear]);

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
        CarryForward:
          row.carryForward ||
          Math.max(0, Number(row.amount || 0) - Number(row.bill || 0)),
        PaymentDate: row.paymentDate || "--",
        PaymentTime: row.paymentTime || "--",
        PaymentType: row.paymentType || "Payment",
        CreatedBy: row.createdBy || "--",
        Status: row.status || "Pending",
        Notes: row.notes || "",
      })),
    [transactionRows],
  );

  const handleExportPdf = () =>
    exportTransactionPdf({
      rows: exportRows,
      companyName: "Bill Sheet",
      theme: "forest",
      year: selectedYear,
    });

  return (
    <div className="page transaction-history-page">
      <div className="page-title transaction-header">
        <div>
          <h2>📒 Transaction History</h2>

          <p>
            {`Transactions for ${selectedYear} from ${yearRangeLabel.start} to ${yearRangeLabel.end}.`}
          </p>
        </div>
        <div className="transaction-actions">
          <div className="year-selector-shell">

            <select
              id="year-selector"
              className="year-selector"
              value={selectedYear}
              onChange={(event) => setSelectedYear(Number(event.target.value))}
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleExportPdf}
            disabled={!filteredPayments.length}
          >
            <FiFileText />
            Download PDF
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
                📅 Date
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
                👤 Name
              </button>
            </div>

            <div className="filter-fields transaction-history-filter-fields">
              <div className="transaction-history-control-shell">
                {filterMode === "customer" ? (
                  <div className="search-box transaction-history-search-box">
                    <FiSearch />

                    <input
                      type="text"
                      placeholder="Search name..."
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
            <div>Date</div>
            <div>Name</div>

            <div>Month</div>

            <div>Bill</div>

            <div>Paid</div>

            <div>Balance</div>

            <div>Status</div>
          </div>

          <div className="transaction-body">
            {loading ? (
              <p className="empty">Loading transactions…</p>
            ) : pagePayments.length ? (
              pagePayments.map((row) => {
                const monthLabel = getMonthLabel({
                  month: row.month,
                }).substring(0, 3);
                const dueValue = Number(row.due || 0);
                const carryForwardValue = Number(
                  row.carryForward ??
                    Math.max(
                      0,
                      Number(row.amount || 0) - Number(row.bill || 0),
                    ),
                );
                const balanceStyle =
                  dueValue > 0
                    ? { color: "#fda4af" }
                    : carryForwardValue > 0
                      ? { color: "#4ade80" }
                      : undefined;
                const balanceLabel = formatBalanceDisplayValue({
                  due: dueValue,
                  carryForward: carryForwardValue,
                });

                return (
                  <div
                    className="transaction-row"
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

                    <div>
                      <strong>{row.customerName || "Name"}</strong>
                    </div>

                    <div>{monthLabel}</div>

                    <div>{money(row.bill)}</div>

                    <div>{money(row.amount)}</div>

                    <div style={balanceStyle}>{balanceLabel}</div>

                    <div>
                      <span className={getTransactionStatusBadgeClass(row)}>
                        {row.status}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="empty">No transactions found.</p>
            )}
          </div>
        </div>
        <div className="transaction-mobile-list">
          {pagePayments.map((row) => {
            const dueValue = Number(row.due || 0);

            const carryForwardValue = Number(
              row.carryForward ??
                Math.max(0, Number(row.amount || 0) - Number(row.bill || 0)),
            );

            const balance = formatBalanceDisplayValue({
              due: dueValue,
              carryForward: carryForwardValue,
            });

            return (
              <div
                key={
                  row.transactionId || `${row.customerId}-${row.paymentDate}`
                }
                className="transaction-mobile-item"
              >
                <span className="tm-date">
                  {row.dateTime
                    ? row.dateTime.toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                      })
                    : "--"}
                </span>

                <span className="tm-customer">{row.customerName || "--"}</span>

                <span className="tm-month">
                  {getMonthLabel({ month: row.month }).substring(0, 3)}
                </span>

                <span className="tm-paid">{money(row.amount || 0)}</span>

                <span
                  className={
                    dueValue > 0 ? "tm-balance due" : "tm-balance carry"
                  }
                >
                  {balance}
                </span>
              </div>
            );
          })}
        </div>
        {pageCount > 1 && (
          <div className="transaction-pagination">
            <div className="pagination-info">
              Showing {showingFrom}–{showingTo} of {transactionRows.length}{" "}
              transactions
            </div>

            <div className="pagination-page">
              Page {currentPageIndex} of {pageCount}
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
