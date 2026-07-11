import { useMemo, useState } from "react";
import { collection } from "firebase/firestore";
import {
  FiAlertCircle,
  FiDownload,
  FiPrinter,
  FiSearch,
  FiTrendingUp,
} from "react-icons/fi";
import { db } from "../firebase/config";
import useOwnedCollection from "../hooks/useOwnedCollection";
import { exportExcel, exportPdf } from "../utils/exports";
import { money } from "../utils/date";

export default function Reports() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [search, setSearch] = useState("");
  const { data: payments } = useOwnedCollection('payments');
  const yearlyRows = useMemo(() => {
    const totals = new Map();
    payments
      .filter((payment) => +payment.year === +year)
      .forEach((payment) => {
        const id = payment.userId || payment.userName;
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
      });
    return [...totals.values()]
      .map(({ latestPeriod, ...row }) => row)
      .filter((row) => row.Name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.Name.localeCompare(b.Name));
  }, [payments, year, search]);
  const total = yearlyRows.reduce((sum, row) => sum + row["Total Paid"], 0);
  const totalDue = yearlyRows.reduce(
    (sum, row) => sum + row["Outstanding Due"],
    0,
  );
  const paymentCount = payments.filter(
    (payment) => +payment.year === +year && Number(payment.amount) > 0,
  ).length;
  return (
    <div className="page">
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
            className="secondary"
            onClick={() => exportPdf(yearlyRows, `yearly-report-${year}`)}
          >
            <FiDownload /> PDF
          </button>
          <button
            className="secondary"
            onClick={() => exportExcel(yearlyRows, `yearly-report-${year}`)}
          >
            <FiDownload /> Excel
          </button>
          <button className="secondary" onClick={() => print()}>
            <FiPrinter /> Print
          </button>
        </div>
      </div>
      <div className="toolbar filters">
        <input
          type="number"
          min="2024"
          value={year}
          onChange={(e) => setYear(+e.target.value)}
        />
        <label className="search">
          <FiSearch />
          <input
            placeholder="Find a customer"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
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
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Collected in {year}</th>
              <th>Outstanding due</th>
            </tr>
          </thead>
          <tbody>
            {yearlyRows.map((row, i) => (
              <tr key={`${row.Name}-${i}`}>
                <td>
                  <b>{row.Name}</b>
                </td>
                <td>{money(row["Total Paid"])}</td>
                <td
                  className={
                    row["Outstanding Due"] > 0 ? "report-due" : "report-clear"
                  }
                >
                  {row["Outstanding Due"] > 0
                    ? money(row["Outstanding Due"])
                    : "All clear"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!yearlyRows.length && (
          <p className="empty">
            No records yet for {year} — once payments are added, this story will
            come alive.
          </p>
        )}
      </section>
    </div>
  );
}
