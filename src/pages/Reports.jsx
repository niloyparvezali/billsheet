import { useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiDownload,
  FiPrinter,
  FiSearch,
  FiTrendingUp,
} from "react-icons/fi";
import useOwnedCollection from "../hooks/useOwnedCollection";
import { exportExcel, exportPdf } from "../utils/exports";
import { money } from "../utils/date";

export default function Reports() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [search, setSearch] = useState("");
  const {
    data: payments,
    loading: paymentsLoading,
    error: paymentsError,
  } = useOwnedCollection("payments");

  const {
    rows: yearlyRows,
    total,
    totalDue,
    customerCount,
    paymentCount,
  } = useMemo(() => {
    const totals = new Map();
    let paymentCount = 0;
    const normalizedYear = +year;
    const searchTerm = search.trim().toLowerCase();

    payments.forEach((payment, index) => {
      if (+payment.year !== normalizedYear) return;

      const id =
        payment.userId || payment.userName || payment.id || String(index);
      const current = totals.get(id) || {
        Name: payment.userName || "Customer",
        "Total Paid": 0,
        "Outstanding Due": 0,
        latestPeriod: -1,
      };

      current["Total Paid"] += Number(payment.amount || 0);
      const period = Number(payment.month || 0);
      if (period >= current.latestPeriod) {
        current["Outstanding Due"] = Number(payment.due || 0);
        current.latestPeriod = period;
      }
      totals.set(id, current);

      if (Number(payment.amount) > 0) {
        paymentCount += 1;
      }
    });

    const rows = [...totals.values()]
      .map(({ latestPeriod, ...row }) => row)
      .filter((row) => row.Name.toLowerCase().includes(searchTerm))
      .sort((a, b) => a.Name.localeCompare(b.Name));

    const total = rows.reduce(
      (sum, row) => sum + Number(row["Total Paid"] || 0),
      0,
    );
    const totalDue = rows.reduce(
      (sum, row) => sum + Number(row["Outstanding Due"] || 0),
      0,
    );
    const customerCount = rows.filter(
      (row) => Number(row["Total Paid"] || 0) > 0,
    ).length;

    return { rows, total, totalDue, customerCount, paymentCount };
  }, [payments, year, search]);
  return (
    <div className="page reports-page">
      <div className="page-title">
        <div>
          <span className="report-kicker">
            <FiTrendingUp /> Annual payment snapshot
          </span>
          <h2>Your {year} collection story</h2>
          <p>
            Celebrate every payment, spot open balances, and keep your billing
            year moving forward.
          </p>
        </div>
        <div className="button-row">
          <button
            className="btn btn-secondary"
            disabled={!yearlyRows.length}
            onClick={() => exportPdf(yearlyRows, `yearly-report-${year}`)}
          >
            <FiDownload /> PDF
          </button>
          <button
            className="btn btn-secondary"
            disabled={!yearlyRows.length}
            onClick={() => exportExcel(yearlyRows, `yearly-report-${year}`)}
          >
            <FiDownload /> Excel
          </button>
          <button className="btn btn-primary" onClick={() => window.print()}>
            <FiPrinter /> Print
          </button>
        </div>
      </div>
      <div className="stats compact report-stats">
        <div className="stat blue">
          <div>
            <p>Collected so far</p>
            <h2>{money(total)}</h2>
          </div>
        </div>

        <div className="stat green">
          <div>
            <p>Customers contributing</p>
            <h2>{yearlyRows.filter((row) => row["Total Paid"] > 0).length}</h2>
          </div>
        </div>

        <div className="stat orange">
          <div>
            <p>Payments captured</p>
            <h2>{paymentCount}</h2>
          </div>
        </div>

        <div className="stat purple">
          <div>
            <p>Open balance</p>
            <h2>{money(totalDue)}</h2>
          </div>
        </div>
      </div>

      <div className="report-filter">
        <input
          type="number"
          min="2024"
          value={year}
          onChange={(e) => setYear(+e.target.value)}
        />
      </div>

      <div className="report-search">
        <label className="search">
          <FiSearch />
          <input
            placeholder="Find a customer"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      <section className="panel table-wrap">
        <div className="report-table-heading">
          <div>
            <h3>Customer balance board</h3>
            <p>
              Collected payments and the latest outstanding balance for {year}.
            </p>
          </div>
          <span>
            <FiAlertCircle /> Due reflects the latest recorded balance
          </span>
        </div>
        <div className="customer-list">
          {yearlyRows.map((row, i) => (
            <div className="customer-card" key={`${row.Name}-${i}`}>
              <div className="customer-card-top">
                <h4>{row.Name}</h4>

                <span
                  className={`balance-status ${
                    row["Outstanding Due"] > 0 ? "due" : "settled"
                  }`}
                >
                  {row["Outstanding Due"] > 0 ? "Balance Due" : "Settled"}
                </span>
              </div>

              <div className="customer-card-body">
                <div className="customer-item">
                  <small>Collected in {year}</small>
                  <strong>{money(row["Total Paid"])}</strong>
                </div>

                <div className="customer-item">
                  <small>Outstanding Due</small>
                  <strong
                    className={
                      row["Outstanding Due"] > 0 ? "report-due" : "report-clear"
                    }
                  >
                    {row["Outstanding Due"] > 0
                      ? money(row["Outstanding Due"])
                      : "All clear"}
                  </strong>
                </div>
              </div>
            </div>
          ))}
        </div>
        {paymentsLoading && <p className="empty">Loading report data…</p>}
        {paymentsError && (
          <p className="empty error">
            Unable to load reports.{" "}
            {paymentsError.message || "Please try again."}
          </p>
        )}
        {!paymentsLoading && !paymentsError && !yearlyRows.length && (
          <p className="empty">
            No records yet for {year} — once payments are added, this story will
            come alive.
          </p>
        )}
      </section>
    </div>
  );
}
