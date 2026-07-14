import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import {
  FiDollarSign,
  FiLayers,
  FiUserCheck,
  FiUsers,
  FiGrid,
  FiCalendar,
} from "react-icons/fi";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import useOwnedCollection from "../hooks/useOwnedCollection";
import StatCard from "../components/StatCard";
import { money, monthNames, formatDate } from "../utils/date";

export default function Dashboard() {
  const { data: users } = useOwnedCollection("users");
  const { data: payments } = useOwnedCollection("payments");
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const [chartPage, setChartPage] = useState(0);
  const activeUsers = useMemo(
    () => users.filter((user) => user.active !== false),
    [users],
  );

  const yearPayments = useMemo(
    () => payments.filter((p) => +p.year === year),
    [payments, year],
  );

  const current = useMemo(
    () => yearPayments.filter((p) => +p.month === month),
    [yearPayments, month],
  );

  const paidCustomers = useMemo(() => {
    const paidSet = new Set();
    current.forEach((payment) => {
      if (Number(payment.amount || 0) > 0 && payment.userId) {
        paidSet.add(payment.userId);
      }
    });
    return paidSet.size;
  }, [current]);

  const paid = useMemo(
    () => current.filter((p) => Number(p.amount || 0) > 0),
    [current],
  );

  const chart = useMemo(() => {
    const months = monthNames.map((name) => ({
      name: name.slice(0, 3),
      month: name,
      collection: 0,
    }));

    yearPayments.forEach((payment) => {
      const index = Number(payment.month) - 1;

      if (index >= 0 && index < 12) {
        months[index].collection += Number(payment.amount || 0);
      }
    });

    return months;
  }, [yearPayments]);
  const chartPages = [chart.slice(0, 6), chart.slice(6, 12)];

  const currentChart = chartPages[chartPage];

  const totalCollection = useMemo(
    () => chart.reduce((sum, item) => sum + item.collection, 0),
    [chart],
  );

  const averageCollection = useMemo(
    () => totalCollection / 12,
    [totalCollection],
  );

  const highestMonth = useMemo(() => {
    const monthsWithCollection = chart.filter((item) => item.collection > 0);

    if (monthsWithCollection.length === 0) {
      return {
        month: "N/A",
        collection: 0,
      };
    }

    return monthsWithCollection.reduce((highest, item) =>
      item.collection > highest.collection ? item : highest,
    );
  }, [chart]);

  const lowestMonth = useMemo(() => {
    // Keep only months that have a collection
    const monthsWithCollection = chart.filter((item) => item.collection > 0);

    // If there is no collection at all
    if (monthsWithCollection.length === 0) {
      return {
        month: "N/A",
        collection: 0,
      };
    }

    // Find the smallest value greater than 0
    return monthsWithCollection.reduce((lowest, item) =>
      item.collection < lowest.collection ? item : lowest,
    );
  }, [chart]);

  const totalPaidThisMonth = useMemo(
    () => paid.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    [paid],
  );

  const recentPayments = useMemo(
    () =>
      payments
        .filter((p) => Number(p.amount || 0) > 0)
        .sort(
          (a, b) =>
            (b.paymentDate?.seconds || 0) - (a.paymentDate?.seconds || 0),
        )
        .slice(0, 6),
    [payments],
  );

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h2>Overview</h2>
          <p>
            {monthNames[month - 1]} {year}
          </p>
        </div>
        <Link to="/monthly-sheet" className="sheet-circle">
          <FiCalendar size={18} />
        </Link>
      </div>
      <div className="stats">
        <StatCard
          label="Total Users"
          value={activeUsers.length}
          icon={<FiUsers />}
        />
        <StatCard
          label="Paid This Month"
          value={paidCustomers}
          tone="green"
          icon={<FiUserCheck />}
        />
        <StatCard
          label="Pending Users"
          value={Math.max(0, activeUsers.length - paidCustomers)}
          tone="orange"
          icon={<FiLayers />}
        />
        <StatCard
          label="Month Collection"
          value={money(totalPaidThisMonth)}
          tone="purple"
          icon={<FiDollarSign />}
        />
      </div>
      <div className="dashboard-layout">
        <section className="panel monthly-panel">
          <div className="panel-header">
            <div>
              <h3>📊 Monthly Collection</h3>
              <p>{year} Collection Overview</p>
            </div>

            <div className="chart-nav">
              <button
                className={chartPage === 0 ? "active" : ""}
                onClick={() => setChartPage(0)}
              >
                Jan – Jun
              </button>

              <button
                className={chartPage === 1 ? "active" : ""}
                onClick={() => setChartPage(1)}
              >
                Jul – Dec
              </button>
            </div>
          </div>

          <div className="chart">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={currentChart}
                margin={{
                  top: 35,
                  right: 10,
                  left: -15,
                  bottom: 15,
                }}
                barCategoryGap="25%"
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  opacity={0.15}
                />

                <XAxis
                  dataKey="name"
                  interval={0}
                  tick={{
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  width={55}
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `৳${v}`}
                />

                <Tooltip formatter={(v) => money(v)} />

                <Bar
                  dataKey="collection"
                  maxBarSize={55}
                  radius={[12, 12, 0, 0]}
                >
                  <LabelList
                    dataKey="collection"
                    position="top"
                    formatter={(v) => (v ? money(v) : "")}
                  />

                  {currentChart.map((item, index) => (
                    <Cell
                      key={index}
                      fill={
                        item.collection === highestMonth.collection
                          ? "#4F46E5"
                          : "#7C83FF"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="dashboard-summary">
            <div className="summary-card">
              <small>💰 Total Collection</small>
              <h4>{money(totalCollection)}</h4>
            </div>

            <div className="summary-card">
              <small>📈 Average / Month</small>
              <h4>{money(averageCollection)}</h4>
            </div>

            <div className="summary-card">
              <small>🏆 Highest Month</small>
              <h4>{highestMonth.month}</h4>
              <span>{money(highestMonth.collection)}</span>
            </div>

            <div className="summary-card">
              <small>📉 Lowest Month</small>
              <h4>{lowestMonth.month}</h4>
              <span>{money(lowestMonth.collection)}</span>
            </div>
          </div>
        </section>
      </div>
      <section className="panel recent-payments-panel">
        <div className="panel-header">
          <div>
            <h3>Recent Payments</h3>
            <p>Latest successful collections</p>
          </div>

          <Link to="/history" className="text-button">
            View All →
          </Link>
        </div>

        <div className="payment-row payment-row-head">
          <div>Customer</div>
          <div>Amount</div>
          <div>Date</div>
        </div>

        {recentPayments.length > 0 ? (
          recentPayments.map((payment, index) => (
            <div
              key={
                payment.id ||
                payment.userId ||
                payment.paymentDate?.seconds ||
                index
              }
              className="payment-row payment-row-item"
            >
              <div className="payment-name">
                <span className="payment-label">Customer</span>
                <b>{payment.userName || payment.customerName || "Customer"}</b>
              </div>
              <div className="payment-amount">
                <span className="payment-label">Amount</span>
                {money(payment.amount)}
              </div>
              <div className="payment-date">
                <span className="payment-label">Date</span>
                {dayjs(payment.paymentDate?.toDate()).format("DD MMM")}
              </div>
            </div>
          ))
        ) : (
          <p className="empty">No payments recorded yet.</p>
        )}
      </section>
    </div>
  );
}
