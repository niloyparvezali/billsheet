import MonthlyCollectionChart from "../components/MonthlyCollectionChart";
import RecentPayments from "../components/RecentPayments";
import DashboardSummary from "../components/DashboardSummary";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import {
  FiDollarSign,
  FiLayers,
  FiUserCheck,
  FiUsers,
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
import { buildDashboardLedgerSummary, getActivePayments } from "../utils/payments";

export default function Dashboard() {
  const { data: users = [] } = useOwnedCollection("users");
  const { data: payments = [] } = useOwnedCollection("payments");
  const { user } = useAuth();
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const [chartPage, setChartPage] = useState(null);
  const [loadingChartPage, setLoadingChartPage] = useState(true);

  const summary = useMemo(
    () => buildDashboardLedgerSummary({ users, payments, month, year }),
    [users, payments, month, year],
  );

  const activeUsers = summary.activeUsers;
  const inactiveUsers = summary.inactiveUsers;
  const paidCustomers = summary.paidCustomers;
  const pendingCustomers = summary.pendingCustomers;
  const totalCollection = summary.totalCollection;
  const chart = useMemo(
    () => summary.chart.map((item) => ({
      name: item.name.slice(0, 3),
      month: item.month,
      collection: item.collection,
    })),
    [summary.chart],
  );
  const chartPages = [chart.slice(0, 6), chart.slice(6, 12)];
  useEffect(() => {
    if (!user) return;

    const loadPreference = async () => {
      try {
        const snap = await getDoc(doc(db, "settings", user.uid));

        if (snap.exists()) {
          setChartPage(snap.data().dashboardChartPage ?? 0);
        } else {
          setChartPage(0);
        }
      } catch (error) {
        console.error(error);
        setChartPage(0);
      } finally {
        setLoadingChartPage(false);
      }
    };

    loadPreference();
  }, [user]);

  const currentChart = chartPages[chartPage];

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
    () => summary.currentPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    [summary.currentPayments],
  );

  const recentPayments = useMemo(
    () =>
      getActivePayments(payments)
        .filter((p) => Number(p.amount || 0) > 0)
        .sort(
          (a, b) =>
            (b.paymentDate?.seconds || 0) - (a.paymentDate?.seconds || 0),
        )
        .slice(0, 6),
    [payments],
  );
  if (loadingChartPage) {
    return <div className="page">Loading...</div>;
  }

  return (
    <div className="page dashboard-page">
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
          value={summary.totalUsers}
          icon={<FiUsers />}
        />
        <StatCard
          label="Active Users"
          value={activeUsers.length}
          tone="green"
          icon={<FiUserCheck />}
        />
        <StatCard
          label="Inactive Users"
          value={inactiveUsers}
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
        <MonthlyCollectionChart
          currentChart={currentChart}
          chartPage={chartPage}
          setChartPage={setChartPage}
          user={user}
          highestMonth={highestMonth}
          lowestMonth={lowestMonth}
          totalCollection={totalCollection}
          averageCollection={averageCollection}
          year={year}
          money={money}
        />

        <DashboardSummary
          totalCollection={totalCollection}
          averageCollection={averageCollection}
          highestMonth={highestMonth}
          lowestMonth={lowestMonth}
          money={money}
        />
      </div>

      <RecentPayments recentPayments={recentPayments} money={money} />
    </div>
  );
}
