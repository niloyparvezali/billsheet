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
    ? currentPayments.reduce(
        (sum, payment) => sum + Number(payment?.amount || 0),
        0,
      )
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
    () =>
      (users || []).filter((user) =>
        isUserActiveForPeriod(user, { month, year }),
      ),
    [month, users, year],
  );
  const payments = useMemo(() => {
    const targetMonth = Number(month);
    const targetYear = Number(year);
    return (allPayments || []).filter((payment) => {
      const isRemoved = Boolean(
        payment?.isDeleted ||
        payment?.deletedAt ||
        payment?.status === "removed",
      );
      return (
        !isRemoved &&
        Number(payment.month) === targetMonth &&
        Number(payment.year) === targetYear
      );
    });
  }, [allPayments, month, year]);
  const paymentsByUser = useMemo(() => {
    const map = new Map();

    (allPayments || []).forEach((payment) => {
      const isRemoved = Boolean(
        payment?.isDeleted ||
        payment?.deletedAt ||
        payment?.status === "removed",
      );

      if (isRemoved) return;

      const key = payment.customerId || payment.userId;
      if (!key) return;

      const existing = map.get(key) || [];
      existing.push(payment);
      map.set(key, existing);
    });

    return map;
  }, [allPayments]);
  const searchTerm = useMemo(() => search.trim().toLowerCase(), [search]);
  const currentPeriod = period(month, year);
  const rows = useMemo(() => {
    const paymentIndex = new Map();
    payments.forEach((payment) => {
      const key = payment.customerId || payment.userId;
      if (!key) return;

      const existing = paymentIndex.get(key) || [];
      existing.push(payment);
      paymentIndex.set(key, existing);
    });

    return activeUsers
      .map((user) => {
        const userPayments = getMonthPaymentTransactions({
          payments: paymentIndex.get(user.customerId || user.id) || [],
          userId: user.id,
          userName: user.name,
          month,
          year,
        });
        const history = (
          paymentsByUser.get(user.customerId || user.id) || []
        ).filter((payment) => {
          const { month: paymentMonth, year: paymentYear } =
            getPaymentMonthYear(payment);

          return period(paymentMonth, paymentYear) < currentPeriod;
        });
        const priorPeriods = [];

        const joinDate = user.joinDate?.toDate
          ? user.joinDate.toDate()
          : user.joinDate
            ? new Date(user.joinDate)
            : null;

        let startMonth = joinDate ? joinDate.getMonth() + 1 : month;
        let startYear = joinDate ? joinDate.getFullYear() : year;

        while (period(startMonth, startYear) < currentPeriod) {
          if (
            isUserActiveForPeriod(user, {
              month: startMonth,
              year: startYear,
            })
          ) {
            priorPeriods.push({
              month: startMonth,
              year: startYear,
              payment: null,
            });
          }

          startMonth++;

          if (startMonth > 12) {
            startMonth = 1;
            startYear++;
          }
        }

        let openingDue = 0;
        let openingAdvance = 0;

        for (const { month: priorMonth, year: priorYear } of priorPeriods) {
          const priorPayments = history.filter((payment) => {
            const p = getPaymentMonthYear(payment);

            return (
              Number(p.month) === Number(priorMonth) &&
              Number(p.year) === Number(priorYear)
            );
          });

          const summary = computePaymentSummary({
            bill: getEffectiveBillForPeriod(user, {
              month: priorMonth,
              year: priorYear,
            }),
            payments: priorPayments,
            openingDue,
            openingAdvance,
            month: priorMonth,
            year: priorYear,
            currentDate,
          });

          openingDue = summary.currentDue;
          openingAdvance = summary.currentAdvance;
        }

        const isLifecycleActive = isUserActiveForPeriod(user, { month, year });
        console.log({
          month,
          year,
          openingDue,
          openingAdvance,
          payments: userPayments,
        });
        const summary = deriveMonthlySheetBillingState({
          bill: isLifecycleActive
            ? getEffectiveBillForPeriod(user, { month, year })
            : 0,
          openingDue: isLifecycleActive ? openingDue : 0,
          openingAdvance: isLifecycleActive ? openingAdvance : 0,
          currentPayments: userPayments || [],
          month,
          year,
          currentDate,
        });
        const latestPayment =
          [...userPayments].sort((left, right) => {
            const leftTime = Number(
              left?.paymentDate?.seconds || left?.createdAt?.seconds || 0,
            );
            const rightTime = Number(
              right?.paymentDate?.seconds || right?.createdAt?.seconds || 0,
            );
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
          totalPayable: isLifecycleActive
            ? Number(getEffectiveBillForPeriod(user, { month, year }) || 0) +
              summary.previousDue
            : 0,
          totalPaid: isLifecycleActive ? summary.currentPaid : 0,
          currentDue: isLifecycleActive ? summary.due : 0,
          currentAdvance: isLifecycleActive ? summary.carryForward : 0,
        };
      })
      .sort((a, b) => a.user.name.localeCompare(b.user.name));
  }, [activeUsers, currentPeriod, month, payments, paymentsByUser, year]);
  const paid = rows.filter((row) =>
    ["Paid", "Advance"].includes(String(row.status || "")),
  );
  const total = rows.reduce(
    (sum, row) => sum + Number(row.currentPaid || 0),
    0,
  );
  const totalDue = rows.reduce((sum, row) => sum + Number(row.due || 0), 0);
  const totalBill = rows.reduce(
    (sum, row) => sum + Number(row.user.monthlyBill || 0),
    0,
  );
  const getStatusPriority = (row) => {
    const isPending =
      String(row.status || "Pending").toLowerCase() === "pending";

    return statusOrder === "pending" ? (isPending ? 0 : 1) : isPending ? 1 : 0;
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
