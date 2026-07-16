export const normalizePaymentStatus = (value) => String(value || "").toLowerCase();

export const isActivePayment = (payment) => {
  if (!payment) return false;
  const status = normalizePaymentStatus(payment.status);
  if (payment?.isDeleted || payment?.deletedAt) return false;
  return status !== "removed" && status !== "voided" && status !== "reversed" && status !== "deleted";
};

export const getActivePayments = (payments = []) => (payments || []).filter(isActivePayment);

export const getMonthPaymentTransactions = ({
  payments = [],
  userId,
  userName,
  month,
  year,
}) => {
  const targetMonth = Number(month);
  const targetYear = Number(year);
  const identifiers = [userId, userName].filter(Boolean);

  return (payments || []).filter((payment) => {
    const matchesUser = identifiers.length === 0
      ? true
      : identifiers.some((value) => {
          const normalized = String(value || "").trim().toLowerCase();
          return [
            payment?.userId,
            payment?.userName,
            payment?.customerId,
            payment?.customerName,
            payment?.ownerId,
          ]
            .filter(Boolean)
            .some((candidate) => String(candidate).trim().toLowerCase() === normalized);
        });

    const sameMonth = Number(payment?.month) === targetMonth;
    const sameYear = Number(payment?.year) === targetYear;
    return matchesUser && sameMonth && sameYear;
  });
};

export const computePaymentSummary = ({ bill = 0, payments = [] }) => {
  const safeBill = Number(bill || 0);
  const totalPaid = getActivePayments(payments).reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0,
  );
  const outstandingBalance = Math.max(0, safeBill - totalPaid);
  const carryForward = Math.max(0, totalPaid - safeBill);
  const status = carryForward > 0
    ? "Paid"
    : totalPaid === 0
      ? "Pending"
      : outstandingBalance > 0
        ? "Partial"
        : "Paid";
  return {
    totalPaid,
    outstandingBalance,
    carryForward,
    status,
  };
};

export const getPaymentStatusLabel = ({ bill = 0, payments = [] }) => {
  const summary = computePaymentSummary({ bill, payments });
  return summary.status;
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
    status: "reversed",
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
    status: "voided",
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
  const bill = Number(payment?.monthlyBill || payment?.bill || 0);
  const amount = Number(payment?.amount || 0);
  const due = Math.max(0, bill - amount);

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
    status: payment?.status || "Pending",
    notes: payment?.notes || "",
    createdBy: payment?.createdBy || payment?.ownerId || "",
    isRemoved: Boolean(payment?.isDeleted || payment?.deletedAt || payment?.status === "removed"),
  };
};
