import { useMemo } from "react";
import {
  computePaymentSummary,
  getEffectiveBillForPeriod,
  getMonthPaymentTransactions,
  getPaymentMonthYear,
} from "../utils/payments.js";
import { isUserActiveForPeriod } from "../utils/membership.js";

const period = (month, year) => Number(year) * 12 + Number(month);

export const deriveMonthlySheetBillingState = ({
  bill = 0,
  openingDue = 0,
  openingAdvance = 0,
  currentPayments = [],
  month = null,
  year = null,
  currentDate = null,
} = {}) => {
  const safeBill = Number(bill || 0);
  const safeOpeningDue = Number(openingDue || 0);
  const safeOpeningAdvance = Number(openingAdvance || 0);
  const paymentAmount = Array.isArray(currentPayments)
    ? currentPayments.reduce((sum, payment) => sum + Number(payment?.amount || 0), 0)
    : Number(currentPayments || 0);
  const safeCurrentPayments = Number(paymentAmount || 0);

  const summary = computePaymentSummary({
    bill: safeBill,
    payments: currentPayments,
    openingDue: safeOpeningDue,
    openingAdvance: safeOpeningAdvance,
    month,
    year,
    currentDate,
  });

  return {
    currentPaid: safeCurrentPayments,
    currentBillPaid: summary.currentBillPaid,
    currentBillRemaining: summary.currentBillRemaining,
    previousDue: safeOpeningDue,
    previousAdvance: safeOpeningAdvance,
    previousDuePaid: summary.previousDuePaid,
    previousDueRemaining: summary.previousDueRemaining,
    carryForward: summary.currentAdvance,
    carryForwardNext: summary.currentAdvance,
    due: summary.currentDue,
    status: summary.status,
  };
};

export default function useMonthlySheet({
  users,
  allPayments,
  month,
  year,
  search,
  nameOrder,
  statusOrder,
}) {
  const currentDate = new Date();
  const activeUsers = useMemo(
    () => (users || []).filter((user) => isUserActiveForPeriod(user, { month, year })),
    [month, users, year],
  );
  const payments = useMemo(() => {
    const targetMonth = Number(month);
    const targetYear = Number(year);
    return (allPayments || []).filter((payment) => {
      const isRemoved = Boolean(
        payment?.isDeleted || payment?.deletedAt || payment?.status === "removed",
      );
      return !isRemoved && Number(payment.month) === targetMonth && Number(payment.year) === targetYear;
    });
  }, [allPayments, month, year]);
  const paymentsByUser = useMemo(() => {
    const map = new Map();
    (allPayments || []).forEach((payment) => {
      const isRemoved = Boolean(
        payment?.isDeleted || payment?.deletedAt || payment?.status === "removed",
      );
      if (!payment.userId || isRemoved) return;
      const existing = map.get(payment.userId) || [];
      existing.push(payment);
      map.set(payment.userId, existing);
    });
    return map;
  }, [allPayments]);
  const searchTerm = useMemo(() => search.trim().toLowerCase(), [search]);
  const currentPeriod = period(month, year);
  const rows = useMemo(() => {
    const paymentIndex = new Map();
    payments.forEach((payment) => {
      if (!payment.userId) return;
      const existing = paymentIndex.get(payment.userId) || [];
      existing.push(payment);
      paymentIndex.set(payment.userId, existing);
    });

    return activeUsers
      .map((user) => {
        const userPayments = getMonthPaymentTransactions({
          payments: paymentIndex.get(user.id) || [],
          userId: user.id,
          userName: user.name,
          month,
          year,
        });
        const history = (paymentsByUser.get(user.id) || []).filter(
          (payment) => period(payment.month, payment.year) < currentPeriod,
        );
        const priorPeriods = [...history]
          .map((payment) => {
            const { month: paymentMonth, year: paymentYear } = getPaymentMonthYear(payment);
            return {
              payment,
              month: paymentMonth,
              year: paymentYear,
            };
          })
          .filter((entry) => {
            const paymentMonth = Number(entry.month || 0);
            const paymentYear = Number(entry.year || 0);
            return isUserActiveForPeriod(user, { month: paymentMonth, year: paymentYear });
          })
          .sort((left, right) => {
            const leftKey = Number(left.year) * 100 + Number(left.month);
            const rightKey = Number(right.year) * 100 + Number(right.month);
            return leftKey - rightKey;
          });

        let openingDue = 0;
        let openingAdvance = 0;

        for (const { payment: priorPayment } of priorPeriods) {
          const priorMonth = Number(getPaymentMonthYear(priorPayment).month || 0);
          const priorYear = Number(getPaymentMonthYear(priorPayment).year || 0);
          const priorPeriodPayments = priorPeriods
            .filter((entry) => Number(entry.month) === priorMonth && Number(entry.year) === priorYear)
            .map((entry) => entry.payment);
          const priorSummary = deriveMonthlySheetBillingState({
            bill: getEffectiveBillForPeriod(user, { month: priorMonth, year: priorYear }),
            openingDue,
            openingAdvance,
            currentPayments: priorPeriodPayments,
            month: priorMonth,
            year: priorYear,
            currentDate,
          });
          openingDue = priorSummary.due;
          openingAdvance = priorSummary.carryForward;
        }

        const isLifecycleActive = isUserActiveForPeriod(user, { month, year });
        const summary = deriveMonthlySheetBillingState({
          bill: isLifecycleActive ? getEffectiveBillForPeriod(user, { month, year }) : 0,
          openingDue: isLifecycleActive ? openingDue : 0,
          openingAdvance: isLifecycleActive ? openingAdvance : 0,
          currentPayments: userPayments || [],
          month,
          year,
          currentDate,
        });
        const latestPayment = [...userPayments].sort((left, right) => {
          const leftTime = Number(left?.paymentDate?.seconds || left?.createdAt?.seconds || 0);
          const rightTime = Number(right?.paymentDate?.seconds || right?.createdAt?.seconds || 0);
          return rightTime - leftTime;
        })[0] || null;

        return {
          user,
          payment: isLifecycleActive ? latestPayment : null,
          openingDue: isLifecycleActive ? summary.previousDue : 0,
          openingAdvance: isLifecycleActive ? summary.previousAdvance : 0,
          currentPaid: isLifecycleActive ? summary.currentPaid : 0,
          due: isLifecycleActive ? summary.due : 0,
          carryForward: isLifecycleActive ? summary.carryForward : 0,
          status: isLifecycleActive ? summary.status : "N/A",
          totalPayable: isLifecycleActive ? Number(getEffectiveBillForPeriod(user, { month, year }) || 0) + summary.previousDue : 0,
          totalPaid: isLifecycleActive ? summary.currentPaid : 0,
          currentDue: isLifecycleActive ? summary.due : 0,
          currentAdvance: isLifecycleActive ? summary.carryForward : 0,
        };
      })
      .sort((a, b) => a.user.name.localeCompare(b.user.name));
  }, [activeUsers, currentPeriod, month, payments, paymentsByUser, year]);
  const paid = rows.filter((row) => ["Paid", "Advance"].includes(String(row.status || "")));
  const total = rows.reduce((sum, row) => sum + Number(row.currentPaid || 0), 0);
  const totalDue = rows.reduce((sum, row) => sum + Number(row.due || 0), 0);
  const totalBill = rows.reduce(
    (sum, row) => sum + Number(row.user.monthlyBill || 0),
    0,
  );
  const getStatusPriority = (row) => {
    const isPending = String(row.status || "Pending").toLowerCase() === "pending";

    return statusOrder === "pending"
      ? isPending ? 0 : 1
      : isPending ? 1 : 0;
  };
  const filteredRows = useMemo(() => {
    const rowsWithStatus = [...rows].sort((a, b) => {
      const statusCompare = getStatusPriority(a) - getStatusPriority(b);

      if (statusCompare !== 0) return statusCompare;

      return nameOrder === "asc"
        ? a.user.name.localeCompare(b.user.name)
        : b.user.name.localeCompare(a.user.name);
    });

    if (!searchTerm) return rowsWithStatus;

    return rowsWithStatus.filter((row) =>
      [row.user.name, row.user.phone].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(searchTerm),
      ),
    );
  }, [rows, searchTerm, nameOrder, statusOrder]);
  return {
    rows,
    filteredRows,
    paid,
    total,
    totalDue,
    totalBill,
  };
}
