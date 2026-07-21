import { buildReversalTransactionRecord, createTransactionStatus, derivePaymentLedgerMetrics, resolveTransactionType } from "./transactions.js";

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

  if (targetValues.length === 0) return false;

  const paymentValues = [
    payment?.userId,
    payment?.userName,
    payment?.customerId,
    payment?.customerName,
    payment?.ownerId,
  ]
    .filter(Boolean)
    .map((value) => normalizeIdentityValue(value));

  if (paymentValues.length === 0) return false;

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

export const getDisplayBalanceValues = ({
  due = 0,
  carryForward = 0,
  currentDue = null,
  currentAdvance = null,
  bill = 0,
  amount = 0,
  previousDue = 0,
  previousAdvance = 0,
  previousPaid = 0,
  additionalDue = 0,
} = {}) => {
  const explicitDue = currentDue != null ? Number(currentDue || 0) : due != null ? Number(due || 0) : null;
  const explicitCarryForward = currentAdvance != null ? Number(currentAdvance || 0) : carryForward != null ? Number(carryForward || 0) : null;

  const hasLedgerContext = [
    Number(bill || 0),
    Number(amount || 0),
    Number(previousDue || 0),
    Number(previousAdvance || 0),
    Number(previousPaid || 0),
    Number(additionalDue || 0),
  ].some((value) => value !== 0);

  if (hasLedgerContext) {
    const ledger = derivePaymentLedgerMetrics({
      billAmount: Number(bill || 0),
      amount: Number(amount || 0),
      previousPaid: Number(previousPaid || 0),
      previousDue: Number(previousDue || 0),
      previousAdvance: Number(previousAdvance || 0),
      additionalDue: Number(additionalDue || 0),
    });

    return {
      due: Math.max(0, ledger.currentDue),
      carryForward: Math.max(0, ledger.currentAdvance),
    };
  }

  if (currentDue != null || currentAdvance != null) {
    return {
      due: Math.max(0, Number(explicitDue ?? 0)),
      carryForward: Math.max(0, Number(explicitCarryForward ?? 0)),
    };
  }

  return {
    due: Math.max(0, Number(explicitDue ?? 0)),
    carryForward: Math.max(0, Number(explicitCarryForward ?? 0)),
  };
};

export const buildBillingLedger = ({
  bill = 0,
  previousDue = 0,
  carryForward = 0,
  paid = 0,
  additionalDue = 0,
} = {}) => {
  const safeBill = Number(bill || 0);
  const safePreviousDue = Number(previousDue || 0);
  const safeCarryForward = Number(carryForward || 0);
  const safePaid = Number(paid || 0);
  const safeAdditionalDue = Number(additionalDue || 0);

  const availablePayment = safePaid + safeCarryForward;
  const currentBillPaid = Math.min(availablePayment, safeBill);
  const currentBillRemaining = Math.max(0, safeBill - currentBillPaid);
  const remainingAfterBill = Math.max(0, availablePayment - currentBillPaid);
  const priorDue = safePreviousDue + safeAdditionalDue;
  const previousDuePaid = Math.min(remainingAfterBill, priorDue);
  const previousDueRemaining = Math.max(0, priorDue - previousDuePaid);
  const carryForwardNext = Math.max(0, remainingAfterBill - previousDuePaid);

  return {
    bill: safeBill,
    previousDue: safePreviousDue,
    additionalDue: safeAdditionalDue,
    carryForward: safeCarryForward,
    paid: safePaid,
    availablePayment,
    currentBillPaid,
    currentBillRemaining,
    remainingAfterBill,
    previousDuePaid,
    previousDueRemaining,
    carryForwardNext,
  };
};

const getSafeDate = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value);
  }
  return new Date();
};

const getMonthEndBoundary = (month, year) => {
  const safeMonth = Number(month || 0);
  const safeYear = Number(year || 0);
  if (!Number.isFinite(safeMonth) || !Number.isFinite(safeYear) || safeMonth < 1 || safeMonth > 12) {
    return null;
  }
  return new Date(safeYear, safeMonth, 0, 23, 59, 59, 999);
};

const resolveBillingStatus = ({
  bill = 0,
  paid = 0,
  currentBillPaid = 0,
  currentBillRemaining = 0,
  previousDueRemaining = 0,
  carryForwardNext = 0,
  month = null,
  year = null,
  currentDate = null,
} = {}) => {
  const safeBill = Number(bill || 0);
  const safePaid = Number(paid || 0);
  const safeCurrentBillPaid = Number(currentBillPaid || 0);
  const safeCurrentBillRemaining = Number(currentBillRemaining || 0);
  const safePreviousDueRemaining = Number(previousDueRemaining || 0);
  const safeCarryForwardNext = Number(carryForwardNext || 0);
  const normalizedCurrentDate = getSafeDate(currentDate);
  const hasPeriodContext = Number.isFinite(Number(month)) && Number.isFinite(Number(year)) && Number(month) >= 1 && Number(month) <= 12;

  if (!hasPeriodContext) {
    if (safeBill > 0) {
      if (safeCurrentBillPaid === 0) {
        return safeCurrentBillRemaining + safePreviousDueRemaining > 0 ? "Pending" : "Paid";
      }
      if (safeCurrentBillPaid < safeBill) {
        return "Partial";
      }
      if (safePreviousDueRemaining === 0 && safeCarryForwardNext > 0) {
        return "Advance";
      }
      return "Paid";
    }

    if (safePreviousDueRemaining > 0 || safeCurrentBillRemaining > 0) {
      return "Due";
    }
    if (safeCarryForwardNext > 0) {
      return "Advance";
    }
    if (safePaid > 0 || safeCurrentBillPaid > 0) {
      return "Paid";
    }
    return "Pending";
  }

  const targetPeriodKey = getPeriodKey(month, year);
  const currentPeriodKey = getPeriodKey(normalizedCurrentDate.getMonth() + 1, normalizedCurrentDate.getFullYear());
  const monthEndBoundary = getMonthEndBoundary(month, year);
  const isFuturePeriod = targetPeriodKey > currentPeriodKey;
  const isPeriodClosed = targetPeriodKey < currentPeriodKey || Boolean(monthEndBoundary && normalizedCurrentDate.getTime() > monthEndBoundary.getTime());

  if (safeBill > 0) {
    if (safeCurrentBillPaid === 0) {
      if (isFuturePeriod || !isPeriodClosed) {
        return "Pending";
      }
      return "Due";
    }

    if (safeCurrentBillPaid < safeBill) {
      if (isFuturePeriod || !isPeriodClosed) {
        return "Partial";
      }
      return "Due";
    }

    if (safePreviousDueRemaining === 0 && safeCarryForwardNext > 0) {
      return "Advance";
    }

    return "Paid";
  }

  if (safePreviousDueRemaining > 0 || safeCurrentBillRemaining > 0) {
    return isFuturePeriod || !isPeriodClosed ? "Pending" : "Due";
  }

  if (safeCarryForwardNext > 0) {
    return "Advance";
  }

  if (safePaid > 0 || safeCurrentBillPaid > 0) {
    return "Paid";
  }

  return "Pending";
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
  const candidates = (payments || []).filter((payment) => {
    const sameMonth = Number(payment?.month) === targetMonth;
    const sameYear = Number(payment?.year) === targetYear;
    return sameMonth && sameYear;
  });

  if (!userId && !userName) {
    return candidates;
  }

  const filtered = candidates.filter((payment) => {
    return matchesPaymentToUser(payment, {
      id: userId,
      userId,
      name: userName,
      userName,
    });
  });

  if (filtered.length > 0) {
    return filtered;
  }

  const hasExplicitIdentity = candidates.some((payment) => Boolean(
    payment?.userId ||
    payment?.userName ||
    payment?.customerId ||
    payment?.customerName ||
    payment?.ownerId,
  ));

  return hasExplicitIdentity ? [] : candidates;
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

export const getDisplayPaymentStatus = ({
  status = "",
  bill = 0,
  paid = 0,
  due = 0,
  advance = 0,
  month = null,
  currentMonth = null,
  currentDate = null,
  isInactiveEntry = false,
  preserveExplicitStatus = false,
} = {}) => {
  const normalizedStatus = String(status || "").trim().toLowerCase();
  const safeBill = Number(bill || 0);
  const safePaid = Number(paid || 0);
  const safeDue = Number(due || 0);
  const safeAdvance = Number(advance || 0);
  const normalizedMonth = Number(month || 0);
  const normalizedCurrentMonth = Number(currentMonth || 0);
  const hasMonthContext = Number.isFinite(normalizedMonth) && normalizedMonth >= 1 && normalizedMonth <= 12;
  const hasCurrentMonthContext = Number.isFinite(normalizedCurrentMonth) && normalizedCurrentMonth >= 1 && normalizedCurrentMonth <= 12;
  const hasCurrentDateContext = currentDate instanceof Date && !Number.isNaN(currentDate.getTime());
  const normalizedCurrentDate = hasCurrentDateContext ? new Date(currentDate) : null;

  const isFutureMonth = hasMonthContext && hasCurrentMonthContext && normalizedMonth > normalizedCurrentMonth;
  const isCurrentMonth = hasMonthContext && hasCurrentMonthContext && normalizedMonth === normalizedCurrentMonth;
  const isMonthInPast = hasMonthContext && hasCurrentMonthContext && normalizedMonth < normalizedCurrentMonth;
  const lastDayOfCurrentMonth = hasCurrentDateContext ? new Date(normalizedCurrentDate.getFullYear(), normalizedCurrentDate.getMonth() + 1, 0).getDate() : 0;
  const isCurrentMonthActiveWindow = isCurrentMonth && hasCurrentDateContext && normalizedCurrentDate !== null && safePaid === 0 && normalizedCurrentDate.getDate() < lastDayOfCurrentMonth;
  const isCurrentMonthClosed = isCurrentMonth && hasCurrentDateContext && normalizedCurrentDate !== null && normalizedCurrentDate.getDate() >= lastDayOfCurrentMonth;

  if (isInactiveEntry || ["not joined", "inactive", "n/a", "na", "none"].includes(normalizedStatus)) {
    return { label: "N/A", tone: "neutral", className: "status-neutral" };
  }

  if (["active"].includes(normalizedStatus)) {
    return { label: "Active", tone: "active", className: "status-active" };
  }

  if (["inactive"].includes(normalizedStatus)) {
    return { label: "Inactive", tone: "inactive", className: "status-inactive" };
  }

  if (["voided", "reversed", "removed", "deleted", "cancelled", "canceled", "failed", "declined"].includes(normalizedStatus)) {
    return { label: normalizedStatus === "reversed" ? "Reversed" : normalizedStatus === "removed" ? "Removed" : normalizedStatus === "deleted" ? "Deleted" : normalizedStatus === "cancelled" || normalizedStatus === "canceled" ? "Canceled" : normalizedStatus === "failed" ? "Failed" : normalizedStatus === "declined" ? "Declined" : "Voided", tone: "voided", className: "status-voided" };
  }

  if (preserveExplicitStatus && normalizedStatus) {
    const explicitLabel = normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1);
    return {
      label: explicitLabel,
      tone: normalizedStatus,
      className: `status-${normalizedStatus}`,
    };
  }

  const {
    currentBillPaid,
    currentBillRemaining,
    previousDuePaid,
    previousDueRemaining,
    carryForwardNext,
  } = buildBillingLedger({
    bill: safeBill,
    paid: safePaid,
    carryForward: safeAdvance,
    due: safeDue,
  });

  const resolvedStatus = resolveBillingStatus({
    bill: safeBill,
    paid: safePaid,
    currentBillPaid,
    currentBillRemaining,
    previousDueRemaining,
    carryForwardNext,
    month: normalizedMonth,
    year: hasCurrentDateContext && normalizedCurrentDate ? normalizedCurrentDate.getFullYear() : new Date().getFullYear(),
    currentDate: normalizedCurrentDate || new Date(),
  });

  return {
    label: resolvedStatus,
    tone: resolvedStatus.toLowerCase(),
    className: `status-${resolvedStatus.toLowerCase()}`,
  };
};

const getPaymentAdditionalDueAmount = (payment = {}) => {
  const candidates = [
    payment?.extraDue,
    payment?.additionalDue,
    payment?.additionalDueAmount,
    payment?.extraAmountDue,
    payment?.dueAmount,
  ];

  const metadata = payment?.metadata || {};
  candidates.push(
    metadata?.extraDue,
    metadata?.additionalDue,
    metadata?.additionalDueAmount,
    metadata?.extraAmountDue,
    metadata?.dueAmount,
  );

  for (const candidate of candidates) {
    const numericValue = Number(candidate);
    if (Number.isFinite(numericValue) && numericValue >= 0) {
      return numericValue;
    }
  }

  return 0;
};

export const computePaymentSummary = ({ bill = 0, payments = [], openingDue = 0, openingAdvance = 0, additionalDue = 0, month = null, year = null, currentDate = null } = {}) => {
  const safeBill = Number(bill || 0);
  const safeOpeningDue = Number(openingDue || 0);
  const safeOpeningAdvance = Number(openingAdvance || 0);
  const safeAdditionalDue = Number(additionalDue || 0);
  const activePayments = getActivePayments(payments);
  const totalPaid = activePayments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0,
  );
  const paymentAdditionalDue = activePayments.reduce(
    (sum, payment) => sum + getPaymentAdditionalDueAmount(payment),
    0,
  );
  const totalAdditionalDue = safeAdditionalDue + paymentAdditionalDue;
  const billingLedger = buildBillingLedger({
    bill: safeBill,
    previousDue: safeOpeningDue,
    carryForward: safeOpeningAdvance,
    paid: totalPaid,
    additionalDue: totalAdditionalDue,
  });

  const status = resolveBillingStatus({
    bill: safeBill,
    paid: totalPaid,
    currentBillPaid: billingLedger.currentBillPaid,
    currentBillRemaining: billingLedger.currentBillRemaining,
    previousDueRemaining: billingLedger.previousDueRemaining,
    carryForwardNext: billingLedger.carryForwardNext,
    month,
    year,
    currentDate,
  });

  return {
    totalPaid,
    totalReceivable: safeBill + safeOpeningDue + totalAdditionalDue,
    outstandingBalance: billingLedger.currentBillRemaining + billingLedger.previousDueRemaining,
    advance: billingLedger.carryForwardNext,
    carryForward: billingLedger.carryForwardNext,
    previousDue: safeOpeningDue,
    previousAdvance: safeOpeningAdvance,
    currentDue: billingLedger.currentBillRemaining + billingLedger.previousDueRemaining,
    currentAdvance: billingLedger.carryForwardNext,
    currentBillPaid: billingLedger.currentBillPaid,
    currentBillRemaining: billingLedger.currentBillRemaining,
    previousDuePaid: billingLedger.previousDuePaid,
    previousDueRemaining: billingLedger.previousDueRemaining,
    availablePayment: billingLedger.availablePayment,
    status,
  };
};

export const buildMonthlySheetLedgerRow = ({
  user,
  payments = [],
  history = [],
  month,
  year,
  isActiveForPeriod = isUserActiveForPeriod,
  currentDate = new Date(),
}) => {
  const bill = getEffectiveBillForPeriod(user, { month, year });
  const isLifecycleActive = isActiveForPeriod(user, { month, year });
  const lifecycleInactive = !isLifecycleActive;
  const monthPayments = getMonthPaymentTransactions({
    payments,
    userId: user?.id,
    userName: user?.name,
    month,
    year,
  });

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
      return isActiveForPeriod(user, { month: paymentMonth, year: paymentYear });
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
      bill: getEffectiveBillForPeriod(user, { month: priorMonth, year: priorYear }),
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
    month,
    year,
    currentDate,
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
  const joinDate = parseDateValue(user?.joinDate || user?.joinedAt || user?.memberSince || user?.createdAt || null);
  const leaveDate = parseDateValue(user?.inactiveDate || user?.leaveDate || user?.archivedAt || user?.deactivatedAt || user?.inactiveAt || null);
  const months = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const monthStart = new Date(safeYear, index, 1);
    const monthEnd = new Date(safeYear, index + 1, 0, 23, 59, 59);
    const isActiveForMonth = isUserActiveForPeriod(user, { month, year: safeYear });
    const beforeJoin = Boolean(joinDate && joinDate > monthEnd);
    const afterLeave = Boolean(leaveDate && leaveDate < monthStart);
    const isInactiveMonth = !isActiveForMonth || beforeJoin || afterLeave;
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
      isActiveForPeriod: isUserActiveForPeriod,
    });
    const reportingBill = getEffectiveBillForPeriod(user, {
      month,
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
    isActiveForPeriod: isUserActiveForPeriod,
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
    remainingDue: totalDue,
    remainingAdvance: totalAdvance,
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

export const buildVoidPaymentActionRecords = ({
  payment,
  voidedBy = "",
  reason = "",
  reasonType = "",
  voidDate = null,
  voidTime = "",
  ownerId = "",
  paymentDateText = "",
  paymentTime = "",
} = {}) => {
  if (!payment) return null;
  const timestamp = voidDate || payment?.voidDate || new Date();
  const timeValue = voidTime || payment?.voidTime || "";
  const relatedTransactionId = payment?.transactionId || payment?.id || "";
  const relatedPaymentId = payment?.id || "";

  const originalRecord = {
    ...payment,
    status: "Voided",
    isDeleted: true,
    deletedAt: timestamp,
    voidedBy: voidedBy || payment?.voidedBy || "",
    reversedBy: payment?.reversedBy || "",
    reason: reason || payment?.reason || "Voided by admin",
    reasonType: reasonType || payment?.reasonType || payment?.voidReasonType || "",
    voidDate: timestamp,
    voidTime: timeValue,
    reverseDate: payment?.reverseDate || timestamp,
    reverseTime: payment?.reverseTime || timeValue,
    updatedAt: timestamp,
    paymentType: payment?.paymentType || "Payment",
    transactionType: payment?.transactionType || "payment",
  };

  const voidActionRecord = {
    ownerId: ownerId || payment?.ownerId || "",
    userId: payment?.userId || payment?.customerId || "",
    userName: payment?.userName || payment?.customerName || "",
    customerId: payment?.customerId || payment?.userId || "",
    customerName: payment?.customerName || payment?.userName || "",
    userCategory: payment?.userCategory || "",
    monthlyBill: Number(payment?.monthlyBill || payment?.billAmount || payment?.bill || 0),
    month: Number(payment?.month || 0),
    year: Number(payment?.year || 0),
    amount: 0,
    extraDue: Number(payment?.extraDue || payment?.additionalDue || 0),
    paymentDateText: paymentDateText || payment?.paymentDateText || "",
    paymentTime: paymentTime || payment?.paymentTime || timeValue,
    paymentType: "Void Payment",
    transactionType: "payment_reversal",
    transactionId: relatedTransactionId || "",
    relatedPaymentId: relatedPaymentId,
    relatedTransactionId: relatedTransactionId,
    status: "Voided",
    remarks: reason || payment?.reason || "Voided by admin",
    reason: reason || payment?.reason || "Voided by admin",
    reasonType: reasonType || payment?.reasonType || payment?.voidReasonType || "",
    voidedBy: voidedBy || payment?.voidedBy || "",
    reversedBy: payment?.reversedBy || "",
    voidDate: timestamp,
    voidTime: timeValue,
    reverseDate: payment?.reverseDate || timestamp,
    reverseTime: payment?.reverseTime || timeValue,
    isDeleted: true,
    deletedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    originalAmount: Number(payment?.amount || 0),
    originalStatus: payment?.status || "",
  };

  return {
    originalRecord,
    voidActionRecord,
  };
};

export const voidPaymentRecord = ({
  payment,
  voidedBy,
  reason,
  reasonType,
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
    reasonType: reasonType || payment?.reasonType || payment?.voidReasonType || "",
    voidDate: timestamp,
    voidTime: timeValue,
    reverseDate: payment?.reverseDate || timestamp,
    reverseTime: payment?.reverseTime || timeValue,
  };
};

export const createTransactionRowFromPayment = (payment, index = 0, ledgerRow = null) => {
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
  const due = Number(ledgerRow?.currentDue ?? payment?.currentDue ?? payment?.due ?? 0);
  const carryForward = Number(ledgerRow?.currentAdvance ?? payment?.currentAdvance ?? payment?.carryForward ?? 0);
  const resolvedType = resolveTransactionType(payment);
  const resolvedStatus = createTransactionStatus({ transactionType: resolvedType, status: payment?.status || payment?.transactionStatus });
  const normalizedStatus = String(resolvedStatus || payment?.status || "Pending").trim().toLowerCase();
  const ledgerStatus = ledgerRow?.status || payment?.status || payment?.ledgerStatus || "Pending";
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
    carryForward,
    currentDue: due,
    currentAdvance: carryForward,
    previousDue: Number(ledgerRow?.previousDue ?? payment?.previousDue ?? 0),
    previousAdvance: Number(ledgerRow?.previousAdvance ?? payment?.previousAdvance ?? 0),
    paymentDate,
    paymentTime,
    dateTime,
    transactionType: resolvedType,
    ledgerStatus: resolvedStatus,
    status: ["voided", "reversed", "removed", "deleted", "cancelled", "canceled", "failed", "declined"].includes(normalizedStatus)
      ? resolvedStatus || payment?.status || "Pending"
      : ledgerStatus,
    notes: payment?.notes || payment?.remarks || "",
    createdBy: payment?.createdBy || payment?.ownerId || "",
    isRemoved: Boolean(payment?.isDeleted || payment?.deletedAt || payment?.status === "removed"),
    contributesToRevenue,
  };
};
