import { useMemo } from "react";
import {
  getEffectiveBillForPeriod,
  getMonthPaymentTransactions,
  getPaymentMonthYear,
} from "../utils/payments.js";
import { isUserActiveForPeriod } from "../utils/membership.js";

const period = (month, year) => Number(year) * 12 + Number(month);

const getSafeDate = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value);
  }

  return new Date();
};

const getPeriodType = (month, year, currentDate) => {
  const safeCurrentDate = getSafeDate(currentDate);
  const currentPeriod = period(
    safeCurrentDate.getMonth() + 1,
    safeCurrentDate.getFullYear(),
  );
  const targetPeriod = period(month, year);

  if (targetPeriod > currentPeriod) return "future";
  if (targetPeriod < currentPeriod) return "past";
  return "current";
};

const getMonthlySheetLedger = ({
  bill = 0,
  openingDue = 0,
  openingAdvance = 0,
  currentPayments = [],
} = {}) => {
  const safeBill = Number(bill || 0);
  const safeOpeningDue = Number(openingDue || 0);
  const safeOpeningAdvance = Number(openingAdvance || 0);
  const currentPaid = Array.isArray(currentPayments)
    ? currentPayments.reduce(
        (sum, payment) => sum + Number(payment?.amount || 0),
        0,
      )
    : Number(currentPayments || 0);

  const previousBalance = safeOpeningAdvance - safeOpeningDue;
  const runningBalance = previousBalance + currentPaid - safeBill;
  const currentDue = runningBalance < 0 ? Math.abs(runningBalance) : 0;
  const carryForward = runningBalance > 0 ? runningBalance : 0;

  return {
    bill: safeBill,
    currentPaid,
    previousDue: safeOpeningDue,
    previousAdvance: safeOpeningAdvance,
    previousBalance,
    runningBalance,
    currentDue,
    carryForward,
  };
};

const resolveCurrentMonthPhaseStatus = ({ bill = 0, currentPaid = 0 } = {}) => {
  const safeBill = Number(bill || 0);
  const safePaid = Number(currentPaid || 0);

  if (safePaid === 0) return "Pending";
  if (safePaid > 0 && safePaid < safeBill) return "Partial";
  return "Paid";
};

const finalizeMonthlySheetStatus = ({
  periodType,
  phaseStatus,
  previousDue = 0,
  runningBalance = 0,
} = {}) => {
  const safePreviousDue = Number(previousDue || 0);
  const safeRunningBalance = Number(runningBalance || 0);

  if (periodType === "future") {
    return "Pending";
  }

  if (periodType === "past") {
    if (phaseStatus === "Pending" || phaseStatus === "Partial") {
      return "Due";
    }
    if (safePreviousDue === 0 && safeRunningBalance > 0) {
      return "Advance";
    }
    return "Paid";
  }

  if (phaseStatus === "Pending" || phaseStatus === "Partial") {
    return phaseStatus;
  }

  if (safePreviousDue === 0 && safeRunningBalance > 0) {
    return "Advance";
  }

  return "Paid";
};

export const deriveMonthlySheetBillingState = ({
  bill = 0,
  openingDue = 0,
  openingAdvance = 0,
  currentPayments = [],
  month = null,
  year = null,
  currentDate = null,
} = {}) => {
  const periodType = getPeriodType(month, year, currentDate);

  const ledger = getMonthlySheetLedger({
    bill,
    openingDue,
    openingAdvance,
    currentPayments,
  });

  // Current month payment
  const currentBillPaid = Math.min(ledger.currentPaid, ledger.bill);

  // Money remaining after paying this month's bill
  const extraPayment = Math.max(0, ledger.currentPaid - ledger.bill);

  // Previous due after applying extra payment
  const previousDueRemaining = Math.max(0, ledger.previousDue - extraPayment);

  // Advance after clearing previous due
  const advanceRemaining = Math.max(0, extraPayment - ledger.previousDue);
  const actualPayable = Math.max(
    0,
    ledger.bill + ledger.previousDue - ledger.previousAdvance,
  );

  const remainingDue = Math.max(0, actualPayable - ledger.currentPaid);

  const remainingAdvance = Math.max(0, ledger.currentPaid - actualPayable);

  const currentBillCovered =
    ledger.currentPaid + ledger.previousAdvance >= ledger.bill;
  let status;

  if (periodType === "future") {
    status = "Pending";
  } else if (periodType === "current") {
    if (ledger.currentPaid === 0) {
      status = "Pending";
    } else if (remainingDue > 0) {
      status = "Partial";
    } else if (remainingAdvance > 0) {
      status = "Advance";
    } else {
      status = "Paid";
    }
  } else {
    if (remainingDue > 0) {
      status = "Due";
    } else if (remainingAdvance > 0) {
      status = "Advance";
    } else {
      status = "Paid";
    }
  }

  return {
    currentPaid: ledger.currentPaid,
    currentMonthPaid: ledger.currentPaid,
    currentBillPaid,
    currentBillRemaining: Math.max(0, ledger.bill - currentBillPaid),

    previousDue: ledger.previousDue,
    previousAdvance: ledger.previousAdvance,
    previousBalance: ledger.previousBalance,

    runningBalance: ledger.runningBalance,

    previousDuePaid: Math.min(extraPayment, ledger.previousDue),
    previousDueRemaining,

    carryForward: ledger.carryForward,
    carryForwardNext: ledger.carryForward,

    due: ledger.currentDue,
    currentDue: ledger.currentDue,

    currentMonthBill: ledger.bill,

    phaseStatus: status,
    status,
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
        let openingDue = 0;
        let openingAdvance = 0;

        // Find the earliest billing month for this user
        let firstMonth = Number(month);
        let firstYear = Number(year);

        (paymentsByUser.get(user.id) || []).forEach((payment) => {
          const { month: paymentMonth, year: paymentYear } =
            getPaymentMonthYear(payment);

          const paymentPeriod = period(paymentMonth, paymentYear);

          if (paymentPeriod < period(firstMonth, firstYear)) {
            firstMonth = Number(paymentMonth);
            firstYear = Number(paymentYear);
          }
        });

        // Walk every month until the selected month
        let walkMonth = firstMonth;
        let walkYear = firstYear;

        while (period(walkMonth, walkYear) < currentPeriod) {
          if (
            isUserActiveForPeriod(user, { month: walkMonth, year: walkYear })
          ) {
            const monthPayments = (paymentsByUser.get(user.id) || []).filter(
              (payment) => {
                const { month, year } = getPaymentMonthYear(payment);

                return Number(month) === walkMonth && Number(year) === walkYear;
              },
            );

            const summary = deriveMonthlySheetBillingState({
              bill: getEffectiveBillForPeriod(user, {
                month: walkMonth,
                year: walkYear,
              }),
              openingDue,
              openingAdvance,
              currentPayments: monthPayments,
              month: walkMonth,
              year: walkYear,
              currentDate,
            });

            openingDue = summary.due;
            openingAdvance = summary.carryForward;
          }

          walkMonth++;

          if (walkMonth > 12) {
            walkMonth = 1;
            walkYear++;
          }
        }

        const isLifecycleActive = isUserActiveForPeriod(user, { month, year });
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
          currentMonthBill: isLifecycleActive ? summary.currentMonthBill : 0,
          runningBalance: isLifecycleActive ? summary.runningBalance : 0,
          due: isLifecycleActive ? summary.due : 0,
          carryForward: isLifecycleActive ? summary.carryForward : 0,
          status: isLifecycleActive ? summary.status : "N/A",
          totalPayable: isLifecycleActive
            ? Math.max(
                0,
                summary.currentMonthBill +
                  summary.previousDue -
                  summary.previousAdvance,
              )
            : 0,
          totalPaid: isLifecycleActive ? summary.currentPaid : 0,
          currentDue: isLifecycleActive ? summary.currentDue : 0,
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
