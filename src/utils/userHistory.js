import {
  computePaymentSummary,
  getActivePayments,
  getEffectiveBillForPeriod,
  getMonthPaymentTransactions,
  getPaymentMonthYear,
  matchesPaymentToUser,
} from "./payments.js";
import { getMembershipPeriods, isUserActiveForPeriod } from "./membership.js";

const parseDateValue = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "object" && typeof value.seconds === "number") {
    const milliseconds =
      value.seconds * 1000 +
      (typeof value.nanoseconds === "number"
        ? Math.floor(value.nanoseconds / 1e6)
        : 0);
    const parsed = new Date(milliseconds);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const dateOnly = (value) => {
  const parsed = parseDateValue(value);
  return parsed ? parsed.toISOString().slice(0, 10) : null;
};

const periodKey = (year, month) => Number(year) * 100 + Number(month);

const monthFromKey = (key) => ({
  year: Math.floor(Number(key) / 100),
  month: Number(key) % 100,
});

const nextMonthKey = (key) => {
  const { year, month } = monthFromKey(key);
  return month === 12 ? periodKey(year + 1, 1) : periodKey(year, month + 1);
};

const previousMonthKey = (key) => {
  const { year, month } = monthFromKey(key);
  return month === 1 ? periodKey(year - 1, 12) : periodKey(year, month - 1);
};

const currentPeriodKey = (date = new Date()) =>
  periodKey(date.getFullYear(), date.getMonth() + 1);

const paymentDate = (payment) =>
  parseDateValue(
    payment?.paymentDate ||
      payment?.createdAt ||
      payment?.timestamp ||
      payment?.paymentDateText ||
      payment?.createdAtText ||
      payment?.timestampText ||
      null,
  );

const getPaymentAdditionalDue = (payment = {}) => {
  const candidates = [
    payment?.extraDue,
    payment?.additionalDue,
    payment?.additionalDueAmount,
    payment?.extraAmountDue,
    payment?.dueAmount,
    payment?.metadata?.extraDue,
    payment?.metadata?.additionalDue,
    payment?.metadata?.additionalDueAmount,
    payment?.metadata?.extraAmountDue,
    payment?.metadata?.dueAmount,
  ];

  for (const candidate of candidates) {
    const numeric = Number(candidate);
    if (Number.isFinite(numeric) && numeric >= 0) return numeric;
  }

  return 0;
};

const paymentBelongsToPeriod = (payment, membershipPeriod) => {
  const date = paymentDate(payment);
  const periodMonthYear = getPaymentMonthYear(payment);
  if (!periodMonthYear?.month || !periodMonthYear?.year) return false;

  if (date) {
    const start = parseDateValue(membershipPeriod.joinDate);
    const leave = parseDateValue(membershipPeriod.leaveDate);
    if (start && date < start) return false;
    if (leave && dateOnly(date) > dateOnly(leave)) return false;
    return true;
  }

  const key = periodKey(periodMonthYear.year, periodMonthYear.month);
  const startDate = parseDateValue(membershipPeriod.joinDate);
  const leaveDate = parseDateValue(membershipPeriod.leaveDate);
  const startKey = startDate
    ? periodKey(startDate.getFullYear(), startDate.getMonth() + 1)
    : key;
  const leaveKey = leaveDate
    ? periodKey(leaveDate.getFullYear(), leaveDate.getMonth() + 1)
    : null;

  return key >= startKey && (!leaveKey || key < leaveKey);
};

const buildMembershipMonthKeys = (membershipPeriod, now) => {
  const joinDate = parseDateValue(membershipPeriod?.joinDate);
  if (!joinDate) return [];

  const startKey = periodKey(joinDate.getFullYear(), joinDate.getMonth() + 1);
  const leaveDate = parseDateValue(membershipPeriod?.leaveDate);
  const lastKey = leaveDate
    ? previousMonthKey(
        periodKey(leaveDate.getFullYear(), leaveDate.getMonth() + 1),
      )
    : currentPeriodKey(now);

  const keys = [];
  for (
    let key = startKey;
    key <= lastKey && key <= currentPeriodKey(now);
    key = nextMonthKey(key)
  ) {
    const { month, year } = monthFromKey(key);
    if (isUserActiveForPeriod({ ...membershipPeriod }, { month, year })) {
      keys.push({ month, year, key });
    }
  }
  return keys;
};

const buildBillingRow = ({
  user,
  membershipPeriod,
  membershipIndex,
  payments,
  month,
  year,
  openingDue,
  openingAdvance,
  currentDate,
}) => {
  const bill = Number(getEffectiveBillForPeriod(user, { month, year }) || 0);
  const monthPayments = getMonthPaymentTransactions({
    payments,
    userId: user?.id,
    userName: user?.name,
    month,
    year,
  });

  const summary = computePaymentSummary({
    bill,
    payments: monthPayments,
    openingDue,
    openingAdvance,
    month,
    year,
    currentDate,
  });

  const additionalDue = Math.max(
    0,
    Number(summary.totalReceivable || 0) -
      Number(bill || 0) -
      Number(summary.previousDue || 0),
  );

  return {
    id: `${membershipIndex}-${year}-${month}`,
    membershipIndex,
    month,
    year,
    periodLabel: new Date(year, month - 1, 1).toLocaleString("en-US", {
      month: "long",
      year: "numeric",
    }),
    bill,
    previousDue: Number(summary.previousDue || 0),
    previousAdvance: Number(summary.previousAdvance || 0),
    additionalDue,
    paid: Number(summary.totalPaid || 0),
    currentDue: Number(summary.currentDue || 0),
    currentAdvance: Number(summary.currentAdvance || 0),
    balance:
      Number(summary.currentAdvance || 0) -
      Number(summary.currentDue || 0),
    status: summary.status || "Pending",
  };
};

export const getUserPayments = (user, payments = []) => {
  return (payments || [])
    .filter((payment) => matchesPaymentToUser(payment, user))
    .sort(
      (left, right) =>
        (paymentDate(right)?.getTime() || 0) -
        (paymentDate(left)?.getTime() || 0),
    );
};

export const buildUserFinancialHistory = (
  user,
  payments = [],
  currentDate = new Date(),
) => {
  if (!user) {
    return {
      memberships: [],
      billingHistory: [],
      paymentHistory: [],
      timeline: [],
      totalBilled: 0,
      totalPaid: 0,
      totalAdditionalDue: 0,
      currentDue: 0,
      currentAdvance: 0,
      currentBalance: 0,
      currentStatus: "N/A",
      currentMonthlyBill: 0,
      paymentCount: 0,
    };
  }

  const memberships = getMembershipPeriods(user);
  const userPayments = getUserPayments(user, payments);
  const billingHistory = [];
  let totalBilled = 0;
  let totalAdditionalDue = 0;

  memberships.forEach((membershipPeriod, membershipIndex) => {
    let openingDue = 0;
    let openingAdvance = 0;

    const periodRows = buildMembershipMonthKeys(membershipPeriod, currentDate);
    periodRows.forEach(({ month, year }) => {
      const row = buildBillingRow({
        user,
        membershipPeriod,
        membershipIndex,
        payments: userPayments,
        month,
        year,
        openingDue,
        openingAdvance,
        currentDate,
      });
      billingHistory.push(row);
      totalBilled += row.bill;
      totalAdditionalDue += row.additionalDue;
      openingDue = row.currentDue;
      openingAdvance = row.currentAdvance;
    });
  });

  const sortedBillingHistory = [...billingHistory].sort((left, right) => {
    const leftKey = periodKey(left.year, left.month);
    const rightKey = periodKey(right.year, right.month);
    return rightKey - leftKey || right.membershipIndex - left.membershipIndex;
  });

  const paymentHistory = userPayments.map((payment, index) => {
    const { month, year } = getPaymentMonthYear(payment);
    const matchedMembershipIndex = memberships.findIndex((period) =>
      paymentBelongsToPeriod(payment, period),
    );

    return {
      ...payment,
      _historyId: payment.id || payment.transactionId || `payment-${index}`,
      displayDate: paymentDate(payment),
      month: Number(month || 0),
      year: Number(year || 0),
      membershipIndex:
        matchedMembershipIndex >= 0 ? matchedMembershipIndex : null,
      additionalDue: getPaymentAdditionalDue(payment),
      amount: Number(payment?.amount || 0),
    };
  });

  const latestBillingRow = sortedBillingHistory[0] || null;
  const activePaymentHistory = paymentHistory.filter((payment) =>
    getActivePayments([payment]).length > 0,
  );
  const totalPaid = activePaymentHistory.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0,
  );

  const overallBalance = getCurrentUserBalance(user, userPayments, currentDate);
  const currentDue = Number(overallBalance.due || 0);
  const currentAdvance = Number(overallBalance.advance || 0);
  const currentBalance = Number(overallBalance.balance || 0);

  const timeline = [];

  memberships.forEach((period, index) => {
    timeline.push({
      id: `membership-join-${index}-${period.joinDate}`,
      type: "joined",
      date: parseDateValue(period.joinDate),
      membershipIndex: index,
      title: index === 0 ? "Joined BillSheet" : "Rejoined",
      description: `Membership period #${index + 1} started.`,
    });

    if (period.leaveDate) {
      timeline.push({
        id: `membership-leave-${index}-${period.leaveDate}`,
        type: "left",
        date: parseDateValue(period.leaveDate),
        membershipIndex: index,
        title: "Left",
        description: `Membership period #${index + 1} ended.`,
      });
    }
  });

  billingHistory.forEach((row) => {
    timeline.push({
      id: `billing-${row.id}`,
      type: "bill",
      date: new Date(row.year, row.month - 1, 1),
      membershipIndex: row.membershipIndex,
      title: `Billed ${row.periodLabel}`,
      description: `Bill ৳${Number(row.bill || 0).toLocaleString()}; balance ${
        row.currentDue > 0
          ? `due ৳${Number(row.currentDue).toLocaleString()}`
          : row.currentAdvance > 0
            ? `advance ৳${Number(row.currentAdvance).toLocaleString()}`
            : "settled"
      }.`,
    });
  });

  paymentHistory.forEach((payment) => {
    const date =
      payment.displayDate ||
      new Date(payment.year, Math.max(0, payment.month - 1), 1);
    const isActive = getActivePayments([payment]).length > 0;
    const paymentStatus = String(payment.status || "").trim();
    timeline.push({
      id: `payment-${payment._historyId}`,
      type: "payment",
      date,
      membershipIndex: payment.membershipIndex,
      title: isActive
        ? `Payment ৳${Number(payment.amount || 0).toLocaleString()}`
        : `Voided payment ৳${Number(payment.amount || 0).toLocaleString()}`,
      description: [
        payment.paymentType || "Payment",
        paymentStatus ? paymentStatus : "",
        payment.notes || payment.reason || "",
        payment.month && payment.year
          ? `For ${new Date(
              payment.year,
              payment.month - 1,
              1,
            ).toLocaleString("en-US", {
              month: "long",
              year: "numeric",
            })}`
          : "",
      ]
        .filter(Boolean)
        .join(" · "),
    });
  });

  timeline.sort(
    (left, right) =>
      (right.date?.getTime() || 0) - (left.date?.getTime() || 0),
  );

  const currentMembership =
    memberships.length > 0 ? memberships[memberships.length - 1] : null;
  const currentStatus = currentMembership?.leaveDate
    ? "Inactive"
    : String(user?.status || "Active");

  return {
    memberships,
    billingHistory: sortedBillingHistory,
    paymentHistory,
    timeline,
    totalBilled,
    totalPaid,
    totalAdditionalDue,
    currentDue,
    currentAdvance,
    currentBalance,
    currentStatus,
    currentMonthlyBill: Number(user?.monthlyBill || 0),
    paymentCount: paymentHistory.length,
    currentBillingRow:
      latestBillingRow &&
      periodKey(latestBillingRow.year, latestBillingRow.month) ===
        currentPeriodKey(currentDate)
        ? latestBillingRow
        : null,
    generatedAt: currentDate,
    getPaymentDate: paymentDate,
    formatDateOnly: dateOnly,
  };
};

const getMonthKeyRange = (memberships = [], currentDate = new Date()) => {
  const currentKey = currentPeriodKey(currentDate);
  const joinKeys = (memberships || [])
    .map((period) => parseDateValue(period?.joinDate))
    .filter(Boolean)
    .map((date) => periodKey(date.getFullYear(), date.getMonth() + 1));

  if (!joinKeys.length) return { startKey: currentKey, endKey: currentKey };

  return {
    startKey: Math.min(...joinKeys),
    endKey: currentKey,
  };
};

const getUserPaymentsForMonth = (userPayments = [], month, year) => {
  const targetMonth = Number(month);
  const targetYear = Number(year);
  return (userPayments || []).filter((payment) => {
    const paymentPeriod = getPaymentMonthYear(payment);
    return (
      Number(paymentPeriod?.month || 0) === targetMonth &&
      Number(paymentPeriod?.year || 0) === targetYear
    );
  });
};

/**
 * Calculates one live customer balance across the complete lifecycle.
 *
 * Billing is charged only for calendar months where the customer is active
 * under the existing membership rules. Payments remain usable against the
 * running ledger even during a membership gap, which preserves real
 * outstanding dues/credits instead of resetting the account on rejoin.
 */
export const calculateOverallUserBalance = (user, payments = [], currentDate = new Date()) => {
  if (!user) {
    return {
      balance: 0,
      due: 0,
      advance: 0,
      accrued: 0,
      paid: 0,
      additionalDue: 0,
    };
  }

  const safeCurrentDate =
    currentDate instanceof Date && !Number.isNaN(currentDate.getTime())
      ? currentDate
      : new Date();
  const memberships = getMembershipPeriods(user);
  const userPayments = getUserPayments(user, payments);
  const { startKey, endKey } = getMonthKeyRange(memberships, safeCurrentDate);

  let openingDue = 0;
  let openingAdvance = 0;
  let accrued = 0;
  let paid = 0;
  let additionalDue = 0;

  for (let key = startKey; key <= endKey; key = nextMonthKey(key)) {
    const { month, year } = monthFromKey(key);
    const lifecycleActive = isUserActiveForPeriod(user, { month, year });
    const bill = lifecycleActive
      ? Number(getEffectiveBillForPeriod(user, { month, year }) || 0)
      : 0;
    const monthPayments = getUserPaymentsForMonth(userPayments, month, year);

    const summary = computePaymentSummary({
      bill,
      payments: monthPayments,
      openingDue,
      openingAdvance,
      month,
      year,
      currentDate: safeCurrentDate,
    });

    accrued +=
      Number(bill || 0) +
      Math.max(0, Number(summary.totalReceivable || 0) - Number(bill || 0) - Number(summary.previousDue || 0));
    paid += Number(summary.totalPaid || 0);
    additionalDue += Math.max(
      0,
      Number(summary.totalReceivable || 0) -
        Number(bill || 0) -
        Number(summary.previousDue || 0),
    );

    openingDue = Number(summary.currentDue || 0);
    openingAdvance = Number(summary.currentAdvance || 0);
  }

  const balance = openingAdvance - openingDue;
  return {
    balance,
    due: balance < 0 ? Math.abs(balance) : 0,
    advance: balance > 0 ? balance : 0,
    accrued,
    paid,
    additionalDue,
  };
};

export const getCurrentUserBalance = (user, payments = [], currentDate = new Date()) => {
  const overall = calculateOverallUserBalance(user, payments, currentDate);
  const balance = Number(overall.balance || 0);
  return {
    balance,
    due: Number(overall.due || 0),
    advance: Number(overall.advance || 0),
    state: balance < 0 ? "due" : balance > 0 ? "advance" : "settled",
  };
};


export const buildUserFinancialStatement = (
  user,
  payments = [],
  currentDate = new Date(),
) => {
  if (!user) {
    return {
      membershipPeriods: [],
      monthRows: [],
      paymentEvents: [],
      totalBilled: 0,
      totalPaid: 0,
      totalAdditionalDue: 0,
      currentBalance: 0,
      currentDue: 0,
      currentAdvance: 0,
    };
  }

  const memberships = getMembershipPeriods(user);
  const userPayments = getUserPayments(user, payments);
  const safeCurrentDate =
    currentDate instanceof Date && !Number.isNaN(currentDate.getTime())
      ? currentDate
      : new Date();

  const { startKey, endKey } = getMonthKeyRange(memberships, safeCurrentDate);
  const monthRows = [];

  let openingDue = 0;
  let openingAdvance = 0;
  let totalBilled = 0;
  let totalPaid = 0;
  let totalAdditionalDue = 0;

  for (let key = startKey; key <= endKey; key = nextMonthKey(key)) {
    const { month, year } = monthFromKey(key);
    const activeForPeriod = isUserActiveForPeriod(user, { month, year });
    const bill = activeForPeriod
      ? Number(getEffectiveBillForPeriod(user, { month, year }) || 0)
      : 0;

    const periodPayments = userPayments
      .filter((payment) => {
        const period = getPaymentMonthYear(payment);
        return (
          Number(period?.month || 0) === month &&
          Number(period?.year || 0) === year
        );
      })
      .sort(
        (left, right) =>
          (paymentDate(left)?.getTime() || 0) -
          (paymentDate(right)?.getTime() || 0),
      );

    const effectivePayments = periodPayments.filter((payment) =>
      getActivePayments([payment]).length > 0,
    );

    const membershipIndex = memberships.findIndex((membership) =>
      isUserActiveForPeriod(
        { membershipHistory: [membership] },
        { month, year },
      ),
    );

    const baseSummary = computePaymentSummary({
      bill,
      payments: [],
      openingDue,
      openingAdvance,
      month,
      year,
      currentDate: safeCurrentDate,
    });

    if (bill > 0) {
      totalBilled += bill;
    }

    const paymentRows = [];
    let cumulativePayments = [];
    let latestSummary = baseSummary;

    if (effectivePayments.length > 0) {
      effectivePayments.forEach((payment, paymentIndex) => {
        cumulativePayments = [...cumulativePayments, payment];

        const summary = computePaymentSummary({
          bill,
          payments: cumulativePayments,
          openingDue,
          openingAdvance,
          month,
          year,
          currentDate: safeCurrentDate,
        });

        const balanceAfter =
          Number(summary.currentAdvance || 0) -
          Number(summary.currentDue || 0);

        const paymentAmount = Number(payment?.amount || 0);
        totalPaid += paymentAmount;

        paymentRows.push({
          rowId:
            payment?.id ||
            payment?.transactionId ||
            `${key}-payment-${paymentIndex}`,
          payment,
          paymentDate: paymentDate(payment),
          paymentAmount,
          balanceAfter,
          dueAfter: Number(summary.currentDue || 0),
          advanceAfter: Number(summary.currentAdvance || 0),
          openingBalance:
            Number(openingAdvance || 0) - Number(openingDue || 0),
          activeForPeriod,
        });

        latestSummary = summary;
      });
    } else {
      latestSummary = baseSummary;
    }

    const periodAdditionalDue = Math.max(
      0,
      Number(latestSummary.totalReceivable || 0) -
        Number(bill || 0) -
        Number(latestSummary.previousDue || 0),
    );
    totalAdditionalDue += periodAdditionalDue;

    const closingBalance =
      Number(latestSummary.currentAdvance || 0) -
      Number(latestSummary.currentDue || 0);

    monthRows.push({
      key,
      month,
      year,
      periodLabel: new Date(year, month - 1, 1).toLocaleString("en-US", {
        month: "long",
        year: "numeric",
      }),
      activeForPeriod,
      membershipIndex: membershipIndex >= 0 ? membershipIndex : null,
      bill,
      openingDue: Number(openingDue || 0),
      openingAdvance: Number(openingAdvance || 0),
      openingBalance:
        Number(openingAdvance || 0) - Number(openingDue || 0),
      paymentRows,
      paymentCount: paymentRows.length,
      paid: Number(latestSummary.totalPaid || 0),
      closingDue: Number(latestSummary.currentDue || 0),
      closingAdvance: Number(latestSummary.currentAdvance || 0),
      closingBalance,
      status: latestSummary.status || "Pending",
    });

    openingDue = Number(latestSummary.currentDue || 0);
    openingAdvance = Number(latestSummary.currentAdvance || 0);
  }

  const paymentEvents = [...userPayments].sort(
    (left, right) =>
      (paymentDate(left)?.getTime() || 0) -
      (paymentDate(right)?.getTime() || 0),
  );

  const finalBalance = openingAdvance - openingDue;

  // The final month result intentionally mirrors calculateOverallUserBalance
  // because both use computePaymentSummary as the financial source of truth.
  const overall = calculateOverallUserBalance(
    user,
    payments,
    safeCurrentDate,
  );

  const normalizedFinalBalance =
    Number(overall.balance) === Number(finalBalance)
      ? finalBalance
      : Number(overall.balance || 0);

  return {
    membershipPeriods: memberships,
    monthRows,
    paymentEvents,
    totalBilled,
    totalPaid,
    totalAdditionalDue,
    currentBalance: normalizedFinalBalance,
    currentDue:
      normalizedFinalBalance < 0 ? Math.abs(normalizedFinalBalance) : 0,
    currentAdvance: normalizedFinalBalance > 0 ? normalizedFinalBalance : 0,
  };
};

