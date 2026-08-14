import { useMemo } from "react";
import {
  computePaymentSummary,
  getEffectiveBillForPeriod,
  getMonthPaymentTransactions,
  getPaymentMonthYear,
} from "../utils/payments.js";
import { isUserActiveForPeriod } from "../utils/membership.js";
import { getDisplayPackages } from "../utils/users.js";

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
  //old code change for pdf
  // const payments = useMemo(() => {
  //   const targetMonth = Number(month);
  //   const targetYear = Number(year);

  //   const filtered = (allPayments || []).filter((payment) => {
  //     const isRemoved = Boolean(
  //       payment?.isDeleted ||
  //       payment?.deletedAt ||
  //       payment?.status === "removed",
  //     );

  //     return (
  //       !isRemoved &&
  //       Number(payment.month) === targetMonth &&
  //       Number(payment.year) === targetYear
  //     );
  //   });

  //   return filtered;
  // }, [allPayments, month, year]);
  const payments = useMemo(() => {
    const targetMonth = Number(month);
    const targetYear = Number(year);

    return (allPayments || []).filter((payment) => {
      const isRemoved = Boolean(
        payment?.isDeleted ||
        payment?.deletedAt ||
        payment?.status === "removed",
      );

      if (isRemoved) return false;

      const period = getPaymentMonthYear(payment);

      return (
        Number(period.month) === targetMonth &&
        Number(period.year) === targetYear
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
        const rawPayments = paymentIndex.get(user.customerId || user.id) || [];

        const userPayments = getMonthPaymentTransactions({
          payments: rawPayments,
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

        const joinMonth = joinDate ? joinDate.getMonth() + 1 : null;
        const joinYear = joinDate ? joinDate.getFullYear() : null;
        const joinPeriod = joinMonth && joinYear ? period(joinMonth, joinYear) : null;

        if (joinPeriod && joinPeriod > currentPeriod) {
          return null;
        }

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

        const paymentSummary = computePaymentSummary({
          bill: getEffectiveBillForPeriod(user, { month, year }),
          payments: userPayments,
          openingDue,
          openingAdvance,
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
          bill: isLifecycleActive
            ? getEffectiveBillForPeriod(user, { month, year })
            : 0,
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
    (sum, row) => sum + Number(row.bill || 0),
    0,
  );
  const getStatusPriority = (statusValue) => {
    const normalized = String(statusValue || "").trim().toLowerCase();

    if (!normalized || normalized === "n/a") return 4;
    if (normalized.includes("pending") || normalized.includes("due")) return 0;
    if (normalized.includes("partial")) return 1;
    if (normalized.includes("paid")) return 2;
    if (normalized.includes("advance")) return 3;
    return 4;
  };

  const filteredRows = useMemo(() => {
    const rowsWithStatus = [...rows].sort((a, b) => {
      const statusCompare =
        getStatusPriority(a.status) - getStatusPriority(b.status);

      if (statusCompare !== 0) return statusCompare;

      const compareName = (left, right) =>
        String(left.user?.name || "").localeCompare(
          String(right.user?.name || ""),
          undefined,
          { sensitivity: "base" },
        );

      return nameOrder === "asc"
        ? compareName(a, b)
        : compareName(b, a);
    });

    if (!searchTerm) return rowsWithStatus;

    return rowsWithStatus.filter((row) => {
      const searchableValues = [
        row?.user?.name,
        row?.user?.phone,
        row?.user?.customerPhone,
        row?.user?.category,
        ...getDisplayPackages(row?.user),
      ];

      return searchableValues.some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(searchTerm),
      );
    });
  }, [rows, searchTerm, nameOrder]);
  return {
    rows,
    filteredRows,
    paid,
    total,
    totalDue,
    totalBill,
  };
}
