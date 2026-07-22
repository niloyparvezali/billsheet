export const TRANSACTION_TYPES = {
  PAYMENT: 'payment',
  PAYMENT_REVERSAL: 'payment_reversal',
  PAYMENT_REMOVED: 'payment_removed',
  ADJUSTMENT: 'adjustment',
  CARRY_FORWARD_DUE: 'carry_forward_due',
  CARRY_FORWARD_ADVANCE: 'carry_forward_advance',
  BILL_GENERATED: 'bill_generated',
  OPENING_BALANCE: 'opening_balance',
};

export const TRANSACTION_TYPE_LABELS = {
  [TRANSACTION_TYPES.PAYMENT]: 'Payment',
  [TRANSACTION_TYPES.PAYMENT_REVERSAL]: 'Payment Reversal',
  [TRANSACTION_TYPES.PAYMENT_REMOVED]: 'Payment Removed',
  [TRANSACTION_TYPES.ADJUSTMENT]: 'Adjustment',
  [TRANSACTION_TYPES.CARRY_FORWARD_DUE]: 'Carry Forward Due',
  [TRANSACTION_TYPES.CARRY_FORWARD_ADVANCE]: 'Carry Forward Advance',
  [TRANSACTION_TYPES.BILL_GENERATED]: 'Bill Generated',
  [TRANSACTION_TYPES.OPENING_BALANCE]: 'Opening Balance',
};

const normalizeTransactionType = (value) => {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase();
  const mapping = {
    payment: TRANSACTION_TYPES.PAYMENT,
    'payment reversal': TRANSACTION_TYPES.PAYMENT_REVERSAL,
    reversal: TRANSACTION_TYPES.PAYMENT_REVERSAL,
    'payment removed': TRANSACTION_TYPES.PAYMENT_REMOVED,
    removed: TRANSACTION_TYPES.PAYMENT_REMOVED,
    adjustment: TRANSACTION_TYPES.ADJUSTMENT,
    'carry forward due': TRANSACTION_TYPES.CARRY_FORWARD_DUE,
    'carry-forward-due': TRANSACTION_TYPES.CARRY_FORWARD_DUE,
    carryforwarddue: TRANSACTION_TYPES.CARRY_FORWARD_DUE,
    'carry forward advance': TRANSACTION_TYPES.CARRY_FORWARD_ADVANCE,
    'carry-forward-advance': TRANSACTION_TYPES.CARRY_FORWARD_ADVANCE,
    carryforwardadvance: TRANSACTION_TYPES.CARRY_FORWARD_ADVANCE,
    bill: TRANSACTION_TYPES.BILL_GENERATED,
    'bill generated': TRANSACTION_TYPES.BILL_GENERATED,
    'opening balance': TRANSACTION_TYPES.OPENING_BALANCE,
  };
  return mapping[normalized] || normalized;
};

export const resolveTransactionType = (record = {}) => {
  const explicit = normalizeTransactionType(record.transactionType || record.type || record.paymentType);
  if (explicit) return explicit;

  const status = String(record.status || '').trim().toLowerCase();
  if (status === 'reversed' || status === 'voided') return TRANSACTION_TYPES.PAYMENT_REVERSAL;
  if (status === 'removed' || status === 'deleted') return TRANSACTION_TYPES.PAYMENT_REMOVED;
  if (record.paymentType === 'Payment' || record.paymentType === 'payment') return TRANSACTION_TYPES.PAYMENT;
  return TRANSACTION_TYPES.PAYMENT;
};

export const createTransactionStatus = ({ transactionType, status }) => {
  const normalizedType = normalizeTransactionType(transactionType);
  const normalizedStatus = String(status || '').trim().toLowerCase();
  if (normalizedStatus === 'voided') return 'Voided';
  if (normalizedType === TRANSACTION_TYPES.PAYMENT_REVERSAL || normalizedStatus === 'reversed') return 'Reversed';
  if (normalizedType === TRANSACTION_TYPES.PAYMENT_REMOVED || normalizedStatus === 'removed') return 'Removed';
  if (normalizedType === TRANSACTION_TYPES.CARRY_FORWARD_DUE || normalizedType === TRANSACTION_TYPES.CARRY_FORWARD_ADVANCE) return 'Applied';
  if (normalizedStatus === 'completed') return 'Completed';
  if (normalizedStatus === 'pending') return 'Pending';
  if (normalizedStatus === 'paid') return 'Paid';
  if (normalizedStatus === 'partial') return 'Partial';
  if (normalizedStatus === 'advance') return 'Advance';
  if (normalizedStatus === 'due') return 'Due';
  return normalizedStatus ? String(status).trim() : 'Completed';
};

export const derivePaymentLedgerMetrics = ({
  billAmount = 0,
  amount = 0,
  previousPaid = 0,
  previousDue = 0,
  previousAdvance = 0,
  additionalDue = 0,
} = {}) => {
  const safeBill = Number(billAmount || 0);
  const safeAmount = Number(amount || 0);
  const safePreviousPaid = Number(previousPaid || 0);
  const safePreviousDue = Number(previousDue || 0);
  const safePreviousAdvance = Number(previousAdvance || 0);
  const safeAdditionalDue = Number(additionalDue || 0);

  const currentPaid = safePreviousPaid + safeAmount;
  const totalReceivable = safePreviousDue + safeBill + safeAdditionalDue;
  const currentDue = Math.max(0, totalReceivable - currentPaid);
  const currentAdvance = Math.max(0, currentPaid - totalReceivable);

  return {
    previousPaid: safePreviousPaid,
    currentPaid,
    previousDue: safePreviousDue,
    currentDue,
    previousAdvance: safePreviousAdvance,
    currentAdvance,
  };
};

export const buildTransactionRecord = ({
  transactionId,
  userId,
  customerId,
  customerName,
  month,
  year,
  transactionType,
  amount = 0,
  billAmount = 0,
  previousPaid = 0,
  currentPaid = 0,
  previousDue = 0,
  currentDue = 0,
  previousAdvance = 0,
  currentAdvance = 0,
  status = 'Completed',
  remarks = '',
  createdBy = '',
  createdAt = null,
  updatedAt = null,
  metadata = {},
} = {}) => {
  const resolvedType = resolveTransactionType({ transactionType, type: transactionType, paymentType: transactionType, status });
  const resolvedStatus = createTransactionStatus({ transactionType: resolvedType, status });

  return {
    transactionId: transactionId || `${resolvedType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId,
    customerId,
    customerName,
    month: Number(month) || null,
    year: Number(year) || null,
    transactionType: resolvedType,
    amount: Number(amount || 0),
    billAmount: Number(billAmount || 0),
    previousPaid: Number(previousPaid || 0),
    currentPaid: Number(currentPaid || 0),
    previousDue: Number(previousDue || 0),
    currentDue: Number(currentDue || 0),
    previousAdvance: Number(previousAdvance || 0),
    currentAdvance: Number(currentAdvance || 0),
    status: resolvedStatus,
    remarks: remarks || '',
    createdBy,
    createdAt: createdAt || new Date(),
    updatedAt: updatedAt || createdAt || new Date(),
    ...metadata,
  };
};

export const buildReversalTransactionRecord = ({
  originalPayment = {},
  reversedBy = '',
  reason = '',
  createdAt = null,
} = {}) => {
  const fallbackTimestamp = createdAt || new Date();
  const paymentId = originalPayment?.id || originalPayment?.paymentId || '';
  const relatedTransactionId = originalPayment?.transactionId || originalPayment?.id || '';
  const originalAmount = Number(originalPayment?.amount || 0);
  const billAmount = Number(originalPayment?.monthlyBill || originalPayment?.billAmount || originalPayment?.bill || 0);

  return buildTransactionRecord({
    transactionId: `reversal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId: originalPayment?.userId || originalPayment?.customerId || '',
    customerId: originalPayment?.customerId || originalPayment?.userId || '',
    customerName: originalPayment?.customerName || originalPayment?.userName || '',
    month: originalPayment?.month || null,
    year: originalPayment?.year || null,
    transactionType: TRANSACTION_TYPES.PAYMENT_REVERSAL,
    amount: 0,
    billAmount,
    previousPaid: originalAmount,
    currentPaid: originalAmount,
    previousDue: 0,
    currentDue: 0,
    previousAdvance: 0,
    currentAdvance: 0,
    status: 'Reversed',
    remarks: reason || 'Reversed',
    createdBy: reversedBy,
    createdAt: fallbackTimestamp,
    updatedAt: fallbackTimestamp,
    metadata: {
      relatedTransactionId,
      relatedPaymentId: paymentId,
      reversalReason: reason || 'Reversed',
      reversedBy,
      originalAmount,
      originalStatus: originalPayment?.status || '',
    },
  });
};
