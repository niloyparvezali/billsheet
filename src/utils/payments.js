import { buildReversalTransactionRecord, createTransactionStatus, resolveTransactionType } from "./transactions.js";

export const normalizePaymentStatus = (value) => String(value || "").trim().toLowerCase();

export const isActivePayment = (payment) => {
  if (!payment) return false;
  const status = normalizePaymentStatus(payment.status);
  if (payment?.isDeleted || payment?.deletedAt) return false;
  return ![
    "removed",
    "voided",
    "reversed",
    "deleted",
    "cancelled",
    "canceled",
    "failed",
    "declined",
  ].includes(status);
};

export const getActivePayments = (payments = []) => (payments || []).filter(isActivePayment);

export const getPeriodKey = (month, year) => Number(year) * 100 + Number(month);

const normalizeIdentityValue = (value) => String(value || "").trim().toLowerCase();

export const matchesPaymentToUser = (payment, userLike = {}) => {
  const targetValues = [
    userLike?.id,
    userLike?.userId,
    userLike?.name,
    userLike?.userName,
    userLike?.customerId,
    userLike?.customerName,
    userLike?.ownerId,
  ]
    .filter(Boolean)
    .map((value) => normalizeIdentityValue(value));

  if (targetValues.length === 0) return true;

  const paymentValues = [
    payment?.userId,
    payment?.userName,
    payment?.customerId,
    payment?.customerName,
    payment?.ownerId,
  ]
    .filter(Boolean)
    .map((value) => normalizeIdentityValue(value));

  return targetValues.some((value) => paymentValues.includes(value));
};

export const getPaymentMonthYear = (payment) => {
  const explicitMonth = Number(payment?.month);
  const explicitYear = Number(payment?.year);

  if (Number.isFinite(explicitMonth) && explicitMonth >= 1 && explicitMonth <= 12) {
    return {
      month: explicitMonth,
      year: Number.isFinite(explicitYear) ? explicitYear : new Date().getFullYear(),
    };
  }

  const parsedDate = payment?.paymentDate?.toDate
    ? payment.paymentDate.toDate()
    : payment?.paymentDate instanceof Date
      ? payment.paymentDate
      : payment?.createdAt?.toDate
        ? payment.createdAt.toDate()
        : payment?.createdAt instanceof Date
          ? payment.createdAt
          : payment?.timestamp?.toDate
            ? payment.timestamp.toDate()
            : null;

  if (parsedDate instanceof Date && !Number.isNaN(parsedDate.getTime())) {
    return {
      month: parsedDate.getMonth() + 1,
      year: parsedDate.getFullYear(),
    };
  }

  const fallback = payment?.paymentDateText || payment?.createdAtText || payment?.timestampText;
  if (typeof fallback === "string" && fallback.trim()) {
    const fallbackDate = new Date(fallback);
    if (!Number.isNaN(fallbackDate.getTime())) {
      return {
        month: fallbackDate.getMonth() + 1,
        year: fallbackDate.getFullYear(),
      };
    }
  }

  return {
    month: Number(payment?.month) || new Date().getMonth() + 1,
    year: Number(payment?.year) || new Date().getFullYear(),
  };
};

export const filterPaymentsByYear = (payments = [], year) => {
  const safeYear = Number(year);
  if (!Number.isFinite(safeYear)) return [...(payments || [])];

  return (payments || []).filter((payment) => {
    const { year: paymentYear } = getPaymentMonthYear(payment);
    return Number(paymentYear) === safeYear;
  });
};

const parseDateValue = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeLifecycleState = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["active", "enabled", "open", "alive"].includes(normalized)) return "active";
  if (["inactive", "disabled", "closed", "deactivated", "deactive", "archived"].includes(normalized)) return "inactive";
  return null;
};

const getLifecycleEvents = (user) => {
  const events = [];
  const addEvent = (date, state) => {
    const parsedDate = parseDateValue(date);
    if (!parsedDate || !state) return;
    const duplicate = events.some((entry) => entry.status === state && entry.date.getTime() === parsedDate.getTime());
    if (!duplicate) events.push({ date: parsedDate, status: state });
  };

  const history = Array.isArray(user?.statusHistory) ? user.statusHistory : [];
  history.forEach((entry) => {
    const status = normalizeLifecycleState(entry?.status || entry?.value || entry?.type || "");
    addEvent(entry?.date || entry?.timestamp || entry?.changedAt || entry?.createdAt || null, status);
  });

  const joinDate = parseDateValue(user?.joinDate || user?.joinedAt || user?.memberSince || user?.createdAt || null);
  if (joinDate) addEvent(joinDate, "active");

  const inactiveDate = parseDateValue(user?.inactiveDate || user?.leaveDate || user?.archivedAt || user?.deactivatedAt || user?.inactiveAt || null);
  if (inactiveDate) addEvent(inactiveDate, "inactive");

  return events.sort((left, right) => left.date.getTime() - right.date.getTime());
};

export const isUserActiveForPeriod = (user, period) => {
  if (!user) return false;
  const month = Number(period?.month || 0);
  const year = Number(period?.year || 0);
  const status = String(user?.status || user?.accountStatus || "").trim().toLowerCase();
  const explicitActive = typeof user?.active === "boolean" ? user.active : null;
  if (Number.isFinite(month) && Number.isFinite(year)) {
    const targetStart = new Date(year, month - 1, 1);
    const targetEnd = new Date(year, month, 0, 23, 59, 59);
    const joinDate = parseDateValue(user?.joinDate || user?.joinedAt || user?.memberSince || user?.createdAt || null);
    const leaveDate = parseDateValue(user?.inactiveDate || user?.leaveDate || user?.archivedAt || user?.deactivatedAt || user?.inactiveAt || null);

    if (joinDate && joinDate > targetEnd) return false;
    if (leaveDate && leaveDate < targetStart) return false;
    if (leaveDate && leaveDate <= targetEnd) return false;

    const events = getLifecycleEvents(user)
      .filter((event) => event.date <= targetEnd)
      .filter((event) => event.date >= targetStart || event.date <= targetEnd);
    const activeState = events.length > 0 ? events[events.length - 1].status : null;
    if (activeState) return activeState === "active";

    if (joinDate && joinDate <= targetEnd) return true;
    if (leaveDate && leaveDate >= targetStart) return false;
    if (explicitActive === false && !joinDate && !leaveDate) return false;
    if (status === "active") return true;
    return explicitActive !== false;
  }
  if (explicitActive === false && !user?.inactiveDate && !user?.leaveDate && !user?.joinDate) return false;
  if (status === "active") return true;
  return explicitActive !== false;
};

export const partitionUsersByLifecycle = (users = [], period = {}) => {
  const activeUsers = [];
  const inactiveUsers = [];

  (users || []).forEach((user) => {
    if (isUserActiveForPeriod(user, period)) {
      activeUsers.push(user);
    } else {
      inactiveUsers.push(user);
    }
  });

  return { activeUsers, inactiveUsers };
};

export const getBalanceDisplayValue = ({ due = 0, carryForward = 0 } = {}) => {
  const currentDue = Number(due || 0);
  const currentCarryForward = Number(carryForward || 0);
  return currentDue > 0 ? currentDue : currentCarryForward > 0 ? currentCarryForward : 0;
};

export const formatBalanceDisplayValue = ({ due = 0, carryForward = 0 } = {}) => {
  const currentDue = Number(due || 0);
  const currentCarryForward = Number(carryForward || 0);
  if (currentDue > 0) return `-৳${String(currentDue)}`;
  if (currentCarryForward > 0) return `+৳${String(currentCarryForward)}`;
  return "৳0";
};

export const formatAnnualReportBalanceValue = ({ due = 0, advance = 0, carryForward = 0 } = {}) => {
  const currentDue = Number(due || 0);
  const currentCarryForward = Number(advance || carryForward || 0);
  return formatBalanceDisplayValue({ due: currentDue, carryForward: currentCarryForward });
};

const normalizeBillHistoryEntry = (entry) => {
  if (!entry || typeof entry !== "object") return null;
  const effectiveMonth = Number(entry?.effectiveMonth ?? entry?.month ?? 0);
  const effectiveYear = Number(entry?.effectiveYear ?? entry?.year ?? 0);
  const monthlyBill = Number(entry?.monthlyBill ?? entry?.bill ?? entry?.amount ?? 0);
  if (!Number.isFinite(effectiveMonth) || !Number.isFinite(effectiveYear) || effectiveMonth < 1 || effectiveMonth > 12) {
    return null;
  }
  return {
    monthlyBill,
    effectiveMonth,
    effectiveYear,
  };
};

export const getEffectiveBillForPeriod = (user, period = {}) => {
  const fallbackBill = Number(user?.monthlyBill || 0);
  const history = Array.isArray(user?.billHistory)
    ? user.billHistory
    : [];
  const normalizedEntries = history
    .map(normalizeBillHistoryEntry)
    .filter(Boolean)
    .sort((left, right) => {
      const leftKey = Number(left.effectiveYear) * 100 + Number(left.effectiveMonth);
      const rightKey = Number(right.effectiveYear) * 100 + Number(right.effectiveMonth);
      return leftKey - rightKey;
    });

  const targetMonth = Number(period?.month || 0);
  const targetYear = Number(period?.year || 0);
  if (!Number.isFinite(targetMonth) || !Number.isFinite(targetYear) || targetMonth < 1 || targetMonth > 12) {
    return fallbackBill;
  }

  let effectiveBill = fallbackBill;
  for (const entry of normalizedEntries) {
    const entryKey = Number(entry.effectiveYear) * 100 + Number(entry.effectiveMonth);
    const targetKey = Number(targetYear) * 100 + Number(targetMonth);
    if (entryKey <= targetKey) {
      effectiveBill = Number(entry.monthlyBill || 0);
    }
  }

  return effectiveBill;
};

export const getMonthPaymentTransactions = ({
  payments = [],
  userId,
  userName,
  month,
  year,
}) => {
  const targetMonth = Number(month);
  const targetYear = Number(year);

  return (payments || []).filter((payment) => {
    const matchesUser = matchesPaymentToUser(payment, { id: userId, userId, name: userName, userName });
    const sameMonth = Number(payment?.month) === targetMonth;
    const sameYear = Number(payment?.year) === targetYear;
    return matchesUser && sameMonth && sameYear;
  });
};

export const countRowsByStatus = (rows = []) => {
  const counts = {
    paid: 0,
    partial: 0,
    pending: 0,
    advance: 0,
  };

  (rows || []).forEach((row) => {
    const normalizedStatus = String(row?.status || "").trim().toLowerCase();
    if (normalizedStatus === "paid") {
      counts.paid += 1;
    } else if (normalizedStatus === "partial") {
      counts.partial += 1;
    } else if (normalizedStatus === "advance") {
      counts.advance += 1;
    } else if (normalizedStatus === "pending") {
      counts.pending += 1;
    }
  });

  return counts;
};

export const computePaymentSummary = ({ bill = 0, payments = [], openingDue = 0, openingAdvance = 0 }) => {
  const safeBill = Number(bill || 0);
  const safeOpeningDue = Number(openingDue || 0);
  const safeOpeningAdvance = Number(openingAdvance || 0);
  const activePayments = getActivePayments(payments);
  const totalPaid = activePayments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0,
  );
  const totalReceivable = safeOpeningDue + safeBill;
  const balanceAfterPayments = totalReceivable - totalPaid;
  const outstandingBalance = Math.max(0, balanceAfterPayments);
  const advance = Math.max(0, totalPaid - totalReceivable);
  const carryForward = Math.max(0, totalPaid - safeBill);
  const previousDue = safeOpeningDue;
  const previousAdvance = safeOpeningAdvance;
  const currentDue = outstandingBalance;
  const currentAdvance = advance;
  const status = advance > 0
    ? "Advance"
    : totalPaid === 0
      ? "Pending"
      : outstandingBalance > 0
        ? "Partial"
        : "Paid";
  return {
    totalPaid,
    totalReceivable,
    outstandingBalance,
    advance,
    carryForward,
    previousDue,
    previousAdvance,
    currentDue,
    currentAdvance,
    status,
  };
};

export const buildMonthlySheetLedgerRow = ({
  user,
  payments = [],
  history = [],
  month,
  year,
}) => {
  const bill = getEffectiveBillForPeriod(user, { month, year });
  const isLifecycleActive = isUserActiveForPeriod(user, { month, year });
  const lifecycleInactive = !isLifecycleActive;
  const monthPayments = (() => {
    const filtered = getMonthPaymentTransactions({
      payments,
      userId: user?.id,
      userName: user?.name,
      month,
      year,
    });
    if (filtered.length > 0) return filtered;

    return (payments || []).filter((payment) => {
      const { month: paymentMonth, year: paymentYear } = getPaymentMonthYear(payment);
      return Number(paymentMonth) === Number(month) && Number(paymentYear) === Number(year);
    });
  })();

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

    const priorSummary = computePaymentSummary({
      bill,
      payments: priorPeriodPayments,
      openingDue,
      openingAdvance,
    });
    openingDue = priorSummary.currentDue;
    openingAdvance = priorSummary.currentAdvance;
  }

  const summary = computePaymentSummary({
    bill: lifecycleInactive ? 0 : bill,
    payments: monthPayments,
    openingDue: lifecycleInactive ? 0 : openingDue,
    openingAdvance: lifecycleInactive ? 0 : openingAdvance,
  });
  const latestPayment = [...monthPayments].sort((left, right) => {
    const leftTime = Number(left?.paymentDate?.seconds || left?.createdAt?.seconds || 0);
    const rightTime = Number(right?.paymentDate?.seconds || right?.createdAt?.seconds || 0);
    return rightTime - leftTime;
  })[0] || null;
  const status = lifecycleInactive
    ? "N/A"
    : summary.status;
  return {
    user,
    payment: lifecycleInactive ? null : latestPayment,
    previousDue: lifecycleInactive ? 0 : summary.previousDue,
    previousAdvance: lifecycleInactive ? 0 : summary.previousAdvance,
    openingDue: lifecycleInactive ? 0 : summary.previousDue,
    openingAdvance: lifecycleInactive ? 0 : summary.previousAdvance,
    currentPaid: lifecycleInactive ? 0 : summary.totalPaid,
    due: lifecycleInactive ? 0 : summary.currentDue,
    carryForward: lifecycleInactive ? 0 : summary.currentAdvance,
    totalPayable: lifecycleInactive ? 0 : summary.totalReceivable,
    totalPaid: lifecycleInactive ? 0 : summary.totalPaid,
    currentDue: lifecycleInactive ? 0 : summary.currentDue,
    currentAdvance: lifecycleInactive ? 0 : summary.currentAdvance,
    status,
  };
};

export const getPaymentStatusLabel = ({ bill = 0, payments = [] }) => {
  const summary = computePaymentSummary({ bill, payments });
  return summary.status;
};

export const buildMonthlyCollectionSeries = ({ year, payments = [] }) => {
  const monthNames = Array.from({ length: 12 }, (_, index) => ({
    name: new Date(2020, index, 1).toLocaleString("en-us", { month: "short" }),
    month: index + 1,
    collection: 0,
  }));

  const activePayments = getActivePayments(payments || []);
  activePayments.forEach((payment) => {
    const derived = getPaymentMonthYear(payment);
    if (Number(derived.year) !== Number(year)) return;
    const monthIndex = Number(derived.month) - 1;
    if (monthIndex < 0 || monthIndex >= 12) return;
    monthNames[monthIndex].collection += Number(payment.amount || 0);
  });

  return monthNames;
};

export const buildDashboardLedgerSummary = ({
  users = [],
  payments = [],
  month,
  year,
}) => {
  const { activeUsers, inactiveUsers } = partitionUsersByLifecycle(users, { month, year });
  const activePayments = getActivePayments(payments || []);
  const yearPayments = activePayments.filter((payment) => Number(getPaymentMonthYear(payment).year) === Number(year));
  const currentPayments = yearPayments.filter((payment) => Number(getPaymentMonthYear(payment).month) === Number(month));
  const rows = activeUsers.map((user) => buildMonthlySheetLedgerRow({
    user,
    payments: currentPayments,
    history: (payments || []).filter((payment) => matchesPaymentToUser(payment, user)),
    month,
    year,
  }));

  const statusCounts = countRowsByStatus(rows);
  const paidCustomers = statusCounts.paid;
  const partialCustomers = statusCounts.partial;
  const pendingCustomers = statusCounts.pending;
  const advanceCustomers = statusCounts.advance;
  const totalMonthlyBill = activeUsers.reduce((sum, user) => sum + (isUserActiveForPeriod(user, { month, year }) ? Number(user?.monthlyBill || 0) : 0), 0);
  const totalCollection = rows.reduce((sum, row) => sum + Number(row.currentPaid || 0), 0);
  const totalDue = rows.reduce((sum, row) => sum + Number(row.currentDue || 0), 0);
  const totalAdvance = rows.reduce((sum, row) => sum + Number(row.currentAdvance || 0), 0);
  const customerStatus = {
    paid: paidCustomers,
    partial: partialCustomers,
    pending: pendingCustomers,
    advance: advanceCustomers,
  };

  return {
    activeUsers,
    inactiveUsers: inactiveUsers.length,
    totalUsers: (users || []).length,
    totalMonthlyBill,
    totalCollection,
    totalDue,
    totalAdvance,
    paidCustomers,
    partialCustomers,
    pendingCustomers,
    advanceCustomers,
    customerStatus,
    rows,
    currentPayments,
    chart: buildMonthlyCollectionSeries({ year, payments: activePayments }),
  };
};

export const buildMonthlyReportSummary = ({
  users = [],
  payments = [],
  month,
  year,
}) => {
  const { activeUsers, inactiveUsers } = partitionUsersByLifecycle(users, { month, year });
  const activePayments = getActivePayments(payments || []);
  const currentPeriodKey = getPeriodKey(month, year);

  const rows = activeUsers.map((user) => {
    const currentMonthPayments = (activePayments || []).filter((payment) => {
      const { month: paymentMonth, year: paymentYear } = getPaymentMonthYear(payment);
      return matchesPaymentToUser(payment, user) && Number(paymentMonth) === Number(month) && Number(paymentYear) === Number(year);
    });

    const history = (activePayments || []).filter((payment) => {
      const { month: paymentMonth, year: paymentYear } = getPaymentMonthYear(payment);
      const paymentPeriod = getPeriodKey(paymentMonth, paymentYear);
      return matchesPaymentToUser(payment, user) && paymentPeriod < currentPeriodKey;
    });

    const row = buildMonthlySheetLedgerRow({
      user,
      payments: currentMonthPayments,
      history,
      month,
      year,
    });

    return {
      ...row,
      currentPaid: Number(row.currentPaid || 0),
      currentDue: Number(row.currentDue || 0),
      currentAdvance: Number(row.currentAdvance || 0),
    };
  });

  const totalMonthlyBill = activeUsers.reduce((sum, user) => sum + Number(user?.monthlyBill || 0), 0);
  const totalCollection = rows.reduce((sum, row) => sum + Number(row.currentPaid || 0), 0);
  const totalDue = rows.reduce((sum, row) => sum + Number(row.currentDue || 0), 0);
  const totalAdvance = rows.reduce((sum, row) => sum + Number(row.currentAdvance || 0), 0);
  const statusCounts = countRowsByStatus(rows);
  const paidCustomers = statusCounts.paid;
  const partialCustomers = statusCounts.partial;
  const pendingCustomers = statusCounts.pending;
  const advanceCustomers = statusCounts.advance;
  const numberOfPayments = activePayments.filter((payment) => {
    const { month: paymentMonth, year: paymentYear } = getPaymentMonthYear(payment);
    return Number(paymentMonth) === Number(month) && Number(paymentYear) === Number(year);
  }).length;
  const averageCollectionPerCustomer = activeUsers.length > 0 ? totalCollection / activeUsers.length : 0;

  return {
    rows,
    totalMonthlyBill,
    totalCollection,
    totalDue,
    totalAdvance,
    totalActiveCustomers: activeUsers.length,
    paidCustomers,
    partialCustomers,
    pendingCustomers,
    advanceCustomers,
    numberOfPayments,
    averageCollectionPerCustomer,
  };
};

export const buildYearlyCustomerReportSummary = ({ user, payments = [], year }) => {
  const safeYear = Number(year);
  const activePayments = getActivePayments(payments || []);
  const parseDateValue = (value) => {
    if (!value) return null;
    if (typeof value?.toDate === "function") return value.toDate();
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const joinDate = parseDateValue(user?.joinDate || user?.joinedAt || user?.memberSince || user?.createdAt || null);
  const inactiveAt = parseDateValue(user?.inactiveDate || user?.leaveDate || user?.archivedAt || user?.deactivatedAt || user?.inactiveAt || null);
  const yearStart = new Date(safeYear, 0, 1);
  const yearEnd = new Date(safeYear, 11, 31, 23, 59, 59);
  const months = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const monthStart = new Date(safeYear, index, 1);
    const monthEnd = new Date(safeYear, index + 1, 0, 23, 59, 59);
    const isActiveForMonth = isUserActiveForPeriod(user, { month, year: safeYear });
    const beforeJoin = Boolean(joinDate && joinDate >= yearStart && joinDate <= yearEnd && joinDate > monthEnd);
    const afterInactive = Boolean(inactiveAt && inactiveAt >= yearStart && inactiveAt <= yearEnd && inactiveAt < monthStart);
    const isInactiveMonth = !isActiveForMonth || beforeJoin || afterInactive;
    const monthPayments = (activePayments || []).filter((payment) => {
      const { month: paymentMonth, year: paymentYear } = getPaymentMonthYear(payment);
      return matchesPaymentToUser(payment, user) && Number(paymentMonth) === Number(month) && Number(paymentYear) === safeYear;
    });
    const history = (activePayments || []).filter((payment) => {
      const { month: paymentMonth, year: paymentYear } = getPaymentMonthYear(payment);
      const currentPeriod = getPeriodKey(month, safeYear);
      const paymentPeriod = getPeriodKey(paymentMonth, paymentYear);
      return matchesPaymentToUser(payment, user) && paymentPeriod < currentPeriod;
    });
    if (isInactiveMonth) {
      return {
        month,
        monthName: new Date(safeYear, index, 1).toLocaleString("en-us", { month: "long" }),
        bill: null,
        paid: null,
        due: null,
        advance: null,
        status: beforeJoin ? "N/A" : "Inactive",
        paymentDate: null,
      };
    }
    const row = buildMonthlySheetLedgerRow({
      user,
      payments: monthPayments,
      history,
      month,
      year: safeYear,
    });
    const reportingBill = getEffectiveBillForPeriod(user, {
      month: Math.max(1, month - 1),
      year: safeYear,
    });
    return {
      month,
      monthName: new Date(safeYear, index, 1).toLocaleString("en-us", { month: "long" }),
      bill: Number(reportingBill || 0),
      paid: Number(row.currentPaid || 0),
      due: Number(row.currentDue || 0),
      advance: Number(row.currentAdvance || 0),
      status: row.status,
      paymentDate: row.payment?.paymentDate || row.payment?.createdAt || null,
      raw: row,
    };
  });
  const openingRow = buildMonthlySheetLedgerRow({
    user,
    payments: [],
    history: activePayments.filter((payment) => {
      const { year: paymentYear } = getPaymentMonthYear(payment);
      return matchesPaymentToUser(payment, user) && Number(paymentYear) < safeYear;
    }),
    month: 1,
    year: safeYear,
  });
  const openingBalance = Number(openingRow.openingDue || 0) - Number(openingRow.openingAdvance || 0);
  const annualBill = months.reduce((sum, entry) => sum + (entry.bill ? Number(entry.bill || 0) : 0), 0);
  const totalPaid = months.reduce((sum, entry) => sum + (entry.paid != null ? Number(entry.paid || 0) : 0), 0);
  const totalReceivable = Number(openingRow.openingDue || 0) + annualBill;
  const totalDue = Math.max(0, totalReceivable - totalPaid);
  const totalAdvance = Math.max(0, totalPaid - totalReceivable);
  const carryForward = totalAdvance;
  const closingBalance = totalDue > 0 ? totalDue : totalAdvance > 0 ? -totalAdvance : 0;
  const closingBalanceStatus = totalDue > 0 ? "Outstanding Balance" : totalAdvance > 0 ? "Credit Carry Forward" : "Account Settled";
  return {
    months,
    openingBalance,
    openingDue: Number(openingRow.openingDue || 0),
    openingAdvance: Number(openingRow.openingAdvance || 0),
    annualBill,
    totalPaid,
    totalDue,
    totalAdvance,
    carryForward,
    closingBalance,
    closingBalanceStatus,
    previousDue: Number(openingRow.openingDue || 0),
    previousAdvance: Number(openingRow.openingAdvance || 0),
    paidThisYear: totalPaid,
    outstandingBalance: totalDue,
    creditCarryForward: totalAdvance,
    balanceStatus: closingBalanceStatus,
  };
};

export const reversePaymentRecord = ({
  payment,
  reversedBy,
  reason,
  reverseDate,
  reverseTime,
}) => {
  if (!payment) return null;
  const timestamp = reverseDate || payment?.reverseDate || new Date();
  const timeValue = reverseTime || payment?.reverseTime || "";
  return {
    ...payment,
    status: "Reversed",
    isDeleted: true,
    deletedAt: timestamp,
    voidedBy: reversedBy || payment?.voidedBy || payment?.reversedBy || "",
    reversedBy: reversedBy || payment?.reversedBy || "",
    reason: reason || payment?.reason || "Reversed by admin",
    voidDate: timestamp,
    voidTime: timeValue,
    reverseDate: timestamp,
    reverseTime: timeValue,
  };
};

export const buildPaymentRemovalEvent = ({
  payment,
  mode = "void",
  actor = "",
  reason = "",
  timestamp = new Date(),
} = {}) => {
  if (!payment) return null;

  const normalizedMode = mode === "reverse" ? "reverse" : "void";
  const createdAt = timestamp || new Date();
  const timeValue = createdAt?.toTimeString?.().split(" ")[0]?.slice(0, 5) || "";
  const baseRecord = normalizedMode === "reverse"
    ? reversePaymentRecord({
        payment,
        reversedBy: actor || payment?.reversedBy || payment?.voidedBy || "",
        reason: reason || payment?.reason || "Reversed by admin",
        reverseDate: createdAt,
        reverseTime: timeValue,
      })
    : voidPaymentRecord({
        payment,
        voidedBy: actor || payment?.voidedBy || payment?.reversedBy || "",
        reason: reason || payment?.reason || "Voided by admin",
        voidDate: createdAt,
        voidTime: timeValue,
      });

  if (!baseRecord) return null;

  const reversalTransaction = buildReversalTransactionRecord({
    originalPayment: payment,
    reversedBy: actor || payment?.reversedBy || payment?.voidedBy || "",
    reason: reason || (normalizedMode === "reverse" ? "Reversed by admin" : "Voided by admin"),
    createdAt,
  });

  const originalRecord = {
    ...payment,
    ...baseRecord,
    id: payment.id,
    transactionId: payment.transactionId || payment.id,
    status: baseRecord.status,
    isDeleted: true,
    deletedAt: createdAt,
    deletedBy: actor || baseRecord.voidedBy || baseRecord.reversedBy || "",
    voidedBy: baseRecord.voidedBy || "",
    reversedBy: baseRecord.reversedBy || "",
    reason: baseRecord.reason || reversalTransaction.reversalReason || "",
    voidDate: baseRecord.voidDate || baseRecord.reverseDate || createdAt,
    voidTime: baseRecord.voidTime || baseRecord.reverseTime || "",
    reverseDate: baseRecord.reverseDate || createdAt,
    reverseTime: baseRecord.reverseTime || "",
    relatedTransactionId: reversalTransaction.relatedTransactionId || payment.transactionId || payment.id,
    relatedPaymentId: reversalTransaction.relatedPaymentId || payment.id,
    reversalReason: reversalTransaction.reversalReason || baseRecord.reason || "",
    originalAmount: reversalTransaction.originalAmount || Number(payment.amount || 0),
    originalStatus: payment.status || "",
  };

  const reversalRecord = {
    ...baseRecord,
    ...reversalTransaction,
    paymentType: normalizedMode === "reverse" ? "Payment Reversal" : "Payment Removed",
    status: baseRecord.status,
    remarks: baseRecord.reason || reversalTransaction.remarks || "",
    reason: baseRecord.reason || reversalTransaction.reversalReason || "",
    voidedBy: baseRecord.voidedBy || baseRecord.reversedBy || "",
    reversedBy: baseRecord.reversedBy || "",
    voidDate: baseRecord.voidDate || baseRecord.reverseDate || createdAt,
    voidTime: baseRecord.voidTime || baseRecord.reverseTime || "",
    reverseDate: baseRecord.reverseDate || createdAt,
    reverseTime: baseRecord.reverseTime || "",
    due: 0,
    carryForward: 0,
    isDeleted: true,
    deletedAt: createdAt,
    paymentDate: createdAt,
    createdAt,
    updatedAt: createdAt,
    relatedTransactionId: reversalTransaction.relatedTransactionId || payment.transactionId || payment.id,
    relatedPaymentId: reversalTransaction.relatedPaymentId || payment.id,
    reversalReason: reversalTransaction.reversalReason || baseRecord.reason || "",
    originalAmount: reversalTransaction.originalAmount || Number(payment.amount || 0),
    originalStatus: payment.status || "",
  };

  return {
    originalRecord,
    reversalRecord,
  };
};

export const voidPaymentRecord = ({
  payment,
  voidedBy,
  reason,
  voidDate,
  voidTime,
}) => {
  if (!payment) return null;
  const timestamp = voidDate || payment?.voidDate || new Date();
  const timeValue = voidTime || payment?.voidTime || "";
  return {
    ...payment,
    status: "Voided",
    isDeleted: true,
    deletedAt: timestamp,
    voidedBy: voidedBy || payment?.voidedBy || "",
    reversedBy: payment?.reversedBy || "",
    reason: reason || payment?.reason || "Voided by admin",
    voidDate: timestamp,
    voidTime: timeValue,
    reverseDate: payment?.reverseDate || timestamp,
    reverseTime: payment?.reverseTime || timeValue,
  };
};

export const createTransactionRowFromPayment = (payment, index = 0) => {
  if (!payment) return null;

  const timestampValue = payment?.paymentDate || payment?.createdAt || payment?.timestamp;
  let dateTime = null;

  if (timestampValue?.toDate) {
    dateTime = timestampValue.toDate();
  } else if (timestampValue instanceof Date) {
    dateTime = timestampValue;
  } else if (typeof timestampValue === "string" || typeof timestampValue === "number") {
    const parsed = new Date(timestampValue);
    dateTime = Number.isNaN(parsed.getTime()) ? null : parsed;
  } else if (timestampValue?.seconds) {
    dateTime = new Date(timestampValue.seconds * 1000);
  }

  const paymentDate = payment?.paymentDateText || (dateTime ? dateTime.toISOString().split("T")[0] : "");
  const paymentTime = payment?.paymentTime || (dateTime ? dateTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "");
  const bill = Number(payment?.monthlyBill || payment?.bill || payment?.billAmount || 0);
  const amount = Number(payment?.amount || 0);
  const due = Math.max(0, bill - amount);
  const resolvedType = resolveTransactionType(payment);
  const resolvedStatus = createTransactionStatus({ transactionType: resolvedType, status: payment?.status || payment?.transactionStatus });
  const normalizedStatus = String(resolvedStatus || payment?.status || "Pending").trim().toLowerCase();
  const contributesToRevenue = ![
    "removed",
    "voided",
    "reversed",
    "deleted",
    "cancelled",
    "canceled",
    "failed",
    "declined",
  ].includes(normalizedStatus) && !Boolean(payment?.isDeleted || payment?.deletedAt);

  return {
    ...payment,
    transactionId: payment?.transactionId || payment?.id || `txn-${index + 1}`,
    customerId: payment?.customerId || payment?.userId || payment?.id || `customer-${index + 1}`,
    customerName: payment?.customerName || payment?.userName || "Customer",
    month: payment?.month || "",
    year: payment?.year || "",
    amount,
    bill,
    due,
    paymentDate,
    paymentTime,
    dateTime,
    transactionType: resolvedType,
    ledgerStatus: resolvedStatus,
    status: resolvedStatus || payment?.status || "Pending",
    notes: payment?.notes || payment?.remarks || "",
    createdBy: payment?.createdBy || payment?.ownerId || "",
    isRemoved: Boolean(payment?.isDeleted || payment?.deletedAt || payment?.status === "removed"),
    contributesToRevenue,
  };
};
