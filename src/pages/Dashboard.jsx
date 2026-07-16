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
import { getActivePayments } from "../utils/payments";

export default function Dashboard() {
  const { data: users } = useOwnedCollection("users");
  const { data: payments } = useOwnedCollection("payments");
  const { user } = useAuth();
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const [chartPage, setChartPage] = useState(null);
  const [loadingChartPage, setLoadingChartPage] = useState(true);
  const activeUsers = useMemo(
    () => users.filter((user) => user.active !== false),
    [users],
  );

  const activePayments = useMemo(() => getActivePayments(payments), [payments]);

  const yearPayments = useMemo(
    () => activePayments.filter((p) => +p.year === year),
    [activePayments, year],
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
      activePayments
        .filter((p) => Number(p.amount || 0) > 0)
        .sort(
          (a, b) =>
            (b.paymentDate?.seconds || 0) - (a.paymentDate?.seconds || 0),
        )
        .slice(0, 6),
    [activePayments],
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
