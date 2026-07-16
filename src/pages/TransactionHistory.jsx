import { FiCalendar, FiFileText, FiSearch } from "react-icons/fi";

import { useEffect, useMemo, useState } from "react";
import useOwnedCollection from "../hooks/useOwnedCollection";
import { money, formatDate, monthNames } from "../utils/date";
import { exportPdf } from "../utils/exports";

const parsePaymentTimestamp = (payment) => {
  const timestamp = payment?.paymentDate;
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

const createTransactionRow = (payment) => {
  const bill = Number(
    payment.bill || payment.monthlyBill || payment.amount || 0,
  );
  const paid = Number(payment.amount || 0);
  const effectiveDue = Number(payment.due ?? bill - paid);
  const isRemoved = Boolean(
    payment?.isDeleted || payment?.deletedAt || payment?.status === "removed",
  );
  return {
    bill,
    paid,
    due: effectiveDue,
    status: isRemoved ? "Removed" : paid > 0 ? "Paid" : "Pending",
    dateTime: parsePaymentTimestamp(payment),
    isRemoved,
  };
};

export default function TransactionHistory() {
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState("date");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const { data: payments, loading } = useOwnedCollection("payments");

  const searchTerm = useMemo(() => search.trim().toLowerCase(), [search]);

  const filteredPayments = useMemo(() => {
    let data = [...payments];

    // Search by customer name
    if (searchTerm) {
      data = data.filter((p) =>
        (p.userName || "").toLowerCase().includes(searchTerm),
      );
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
    // Always newest first
    data.sort((a, b) => getPaymentTime(b) - getPaymentTime(a));

    return data;
  }, [payments, searchTerm, fromDate, toDate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, fromDate, toDate]);

  const TRANSACTIONS_PER_PAGE = 20;

  const pageCount = Math.max(
    1,
    Math.ceil(filteredPayments.length / TRANSACTIONS_PER_PAGE),
  );
  const currentPageIndex = Math.min(currentPage, pageCount);
  const pagePayments = useMemo(
    () =>
      filteredPayments.slice(
        (currentPageIndex - 1) * TRANSACTIONS_PER_PAGE,
        currentPageIndex * TRANSACTIONS_PER_PAGE,
      ),
    [filteredPayments, currentPageIndex],
  );
  const showingFrom =
    filteredPayments.length === 0
      ? 0
      : (currentPageIndex - 1) * TRANSACTIONS_PER_PAGE + 1;

  const showingTo = Math.min(
    currentPageIndex * TRANSACTIONS_PER_PAGE,
    filteredPayments.length,
  );
  const summary = useMemo(() => {
    const totalTransactions = filteredPayments.length;

    const totalCollection = filteredPayments.reduce(
      (sum, p) => sum + Number(p.amount || 0),
      0,
    );

    const totalDue = filteredPayments.reduce((sum, p) => {
      const bill = Number(p.bill || p.monthlyBill || p.amount || 0);
      const paid = Number(p.amount || 0);
      return sum + Number(p.due ?? bill - paid);
    }, 0);

    const averagePayment =
      totalTransactions > 0 ? totalCollection / totalTransactions : 0;

    return {
      totalTransactions,
      totalCollection,
      totalDue,
      averagePayment,
    };
  }, [filteredPayments]);

  const exportRows = useMemo(
    () =>
      filteredPayments.map((payment) => {
        const bill = Number(
          payment.bill || payment.monthlyBill || payment.amount || 0,
        );
        const paid = Number(payment.amount || 0);
        return {
          Date: payment.paymentDate ? formatDate(payment.paymentDate) : "--",
          Customer: payment.userName || "Customer",
          Month: getMonthLabel(payment),
          Bill: bill,
          Paid: paid,
          Due: Number(payment.due ?? bill - paid),
          Status: paid > 0 ? "Paid" : "Pending",
        };
      }),
    [filteredPayments],
  );

  const handleExportPdf = () => exportPdf(exportRows, "Transaction History");

  return (
    <div className="page transaction-history-page">
      <div className="page-title transaction-header">
        <div>
          <h2>📒 Transaction History</h2>

          <p>
            Complete payment history from the first transaction to the latest.
          </p>
        </div>
        <div className="transaction-actions">
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
                👤 Customer
              </button>
            </div>

            <div className="filter-fields transaction-history-filter-fields">
              <div className="transaction-history-control-shell">
                {filterMode === "customer" ? (
                  <div className="search-box transaction-history-search-box">
                    <FiSearch />

                    <input
                      type="text"
                      placeholder="Search customer..."
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
            <div>Customer</div>

            <div>Month</div>

            <div>Bill</div>

            <div>Paid</div>

            <div>Due</div>

            <div>Status</div>
          </div>

          <div className="transaction-body">
            {loading ? (
              <p className="empty">Loading transactions…</p>
            ) : pagePayments.length ? (
              pagePayments.map((payment) => {
                const { bill, paid, due, status, dateTime, isRemoved } =
                  createTransactionRow(payment);
                const monthLabel = getMonthLabel(payment);

                return (
                  <div className="transaction-row" key={payment.id}>
                    <div className="transaction-history-date-cell">
                      <span>
                        {dateTime ? formatDate(dateTime) : "--"}
                      </span>
                      {dateTime ? (
                        <small>
                          {dateTime.toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </small>
                      ) : null}
                    </div>

                    <div>
                      <strong>{payment.userName || "Customer"}</strong>
                    </div>

                    <div>{monthLabel}</div>

                    <div>{money(bill)}</div>

                    <div>{money(paid)}</div>

                    <div>{money(due)}</div>

                    <div>
                      <span
                        className={isRemoved ? "status-pending" : paid > 0 ? "status-paid" : "status-pending"}
                      >
                        {status}
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
        {pageCount > 1 && (
          <div className="transaction-pagination">
            <div className="pagination-info">
              Showing {showingFrom}–{showingTo} of {filteredPayments.length}{" "}
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

          <div className="card summary-box">
            <small>Outstanding Due</small>
            <h3>{money(summary.totalDue)}</h3>
          </div>
        </div>
      </section>
    </div>
  );
}
