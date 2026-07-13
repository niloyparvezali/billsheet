import {
  FiCalendar,
  FiDownload,
  FiFileText,
  FiPrinter,
  FiSearch,
} from "react-icons/fi";

import { useEffect, useMemo, useState } from "react";
import useOwnedCollection from "../hooks/useOwnedCollection";
import { money, formatDate } from "../utils/date";
import { exportCsv, exportExcel, exportPdf } from "../utils/exports";

const parsePaymentTimestamp = (payment) => {
  const timestamp = payment?.paymentDate;
  if (!timestamp) return null;
  if (typeof timestamp.toDate === "function") return timestamp.toDate();
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === "string" || typeof timestamp === "number") {
    const parsed = new Date(timestamp);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof timestamp.seconds === "number") return new Date(timestamp.seconds * 1000);
  return null;
};

const getPaymentTime = (payment) => parsePaymentTimestamp(payment)?.getTime() || 0;

const createTransactionRow = (payment) => {
  const bill = Number(payment.bill || payment.monthlyBill || payment.amount || 0);
  const paid = Number(payment.amount || 0);
  return {
    bill,
    paid,
    due: Number(payment.due ?? Math.max(0, bill - paid)),
    status: paid > 0 ? "Paid" : "Pending",
    dateTime: parsePaymentTimestamp(payment),
  };
};

export default function TransactionHistory() {

  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

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

    // Status filter
    if (status !== "all") {
      data = data.filter((p) => {
        const paid = Number(p.amount || 0) > 0;
        return status === "paid" ? paid : !paid;
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

    // Sort
    data.sort((a, b) => {
      const aTime = getPaymentTime(a);
      const bTime = getPaymentTime(b);
      return sort === "newest" ? bTime - aTime : aTime - bTime;
    });

    return data;
  }, [payments, searchTerm, status, fromDate, toDate, sort]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, status, fromDate, toDate, sort, pageSize]);

  const pageCount = Math.max(1, Math.ceil(filteredPayments.length / pageSize));
  const currentPageIndex = Math.min(currentPage, pageCount);
  const pagePayments = useMemo(
    () =>
      filteredPayments.slice(
        (currentPageIndex - 1) * pageSize,
        currentPageIndex * pageSize,
      ),
    [filteredPayments, currentPageIndex, pageSize],
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
      return sum + Math.max(0, bill - paid);
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
          Month: `${payment.month} ${payment.year}`,
          Bill: bill,
          Paid: paid,
          Due: Number(payment.due ?? Math.max(0, bill - paid)),
          Status: paid > 0 ? "Paid" : "Pending",
        };
      }),
    [filteredPayments],
  );

  const handleExportCsv = () => exportCsv(exportRows, "Transaction History");
  const handleExportExcel = () =>
    exportExcel(exportRows, "Transaction History");
  const handleExportPdf = () => exportPdf(exportRows, "Transaction History");

  return (
    <div className="page">
      <div className="page-title transaction-header">
        <div>
          <h2>📒 Transaction History</h2>

          <p>
            Complete payment history from the first transaction to the latest.
          </p>
        </div>

        <div className="transaction-actions">
          <button
            className="btn btn-secondary"
            onClick={handleExportCsv}
            disabled={!filteredPayments.length}
          >
            <FiDownload />
            Export CSV
          </button>

          <button
            className="btn btn-secondary"
            onClick={handleExportExcel}
            disabled={!filteredPayments.length}
          >
            <FiDownload />
            Export Excel
          </button>

          <button
            className="btn btn-secondary"
            onClick={handleExportPdf}
            disabled={!filteredPayments.length}
          >
            <FiFileText />
            Download PDF
          </button>

          <button className="btn btn-primary" onClick={() => window.print()}>
            <FiPrinter />
            Print
          </button>
        </div>
      </div>

      <section className="panel">
        <div className="history-toolbar">
          <div className="search-box">
            <FiSearch />

            <input
              type="text"
              placeholder="Search customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="toolbar-group">
            <div className="date-box">
              <FiCalendar />

              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>

            <div className="date-box">
              <FiCalendar />

              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>

            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
            </select>

            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>
        </div>
        <div className="transaction-table">
          <div className="transaction-head">
            <div>Date & Time</div>

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
                const { bill, paid, due, status, dateTime } =
                  createTransactionRow(payment);

                return (
                  <div className="transaction-row" key={payment.id}>
                    <div>{dateTime ? `${formatDate(dateTime)} ${dateTime.toLocaleTimeString()}` : "--"}</div>

                    <div>
                      <strong>{payment.userName || "Customer"}</strong>
                    </div>

                    <div>
                      {payment.month} {payment.year}
                    </div>

                    <div>{money(bill)}</div>

                    <div>{money(paid)}</div>

                    <div>{money(due)}</div>

                    <div>
                      <span
                        className={paid > 0 ? "status-paid" : "status-pending"}
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
        <div className="transaction-pagination">
          <div className="pagination-meta">
            <span>
              Showing {pagePayments.length} of {filteredPayments.length} records
            </span>
            <span>
              Page {currentPageIndex} of {pageCount}
            </span>
          </div>

          <div className="pagination-actions">
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size} per page
                </option>
              ))}
            </select>

            <button
              className="btn btn-secondary"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPageIndex === 1}
            >
              Previous
            </button>
            <button
              className="btn btn-secondary"
              onClick={() =>
                setCurrentPage((page) => Math.min(pageCount, page + 1))
              }
              disabled={currentPageIndex === pageCount}
            >
              Next
            </button>
          </div>
        </div>
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

          <div className="card summary-box">
            <small>Average Payment</small>
            <h3>{money(summary.averagePayment)}</h3>
          </div>
        </div>
      </section>
    </div>
  );
}
