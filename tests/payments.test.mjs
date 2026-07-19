import test from 'node:test';
import assert from 'node:assert/strict';

import { buildMonthlyCollectionSeries, buildMonthlyReportSummary, buildMonthlySheetLedgerRow, buildPaymentRemovalEvent, buildYearlyCustomerReportSummary, computePaymentSummary, createTransactionRowFromPayment, filterPaymentsByYear, formatAnnualReportBalanceValue, formatBalanceDisplayValue, getActivePayments, getEffectiveBillForPeriod, getMonthPaymentTransactions, getPaymentStatusLabel, getPaymentMonthYear, isUserActiveForPeriod } from '../src/utils/payments.js';
import { buildTransactionRecord, buildReversalTransactionRecord, derivePaymentLedgerMetrics, resolveTransactionType, createTransactionStatus } from '../src/utils/transactions.js';

test('filterPaymentsByYear keeps only transactions from the selected calendar year', () => {
  const payments = [
    { amount: 100, paymentDate: new Date('2026-01-10T10:00:00Z'), status: 'Completed' },
    { amount: 200, paymentDate: new Date('2027-02-10T10:00:00Z'), status: 'Completed' },
    { amount: 300, paymentDate: new Date('2026-12-10T10:00:00Z'), status: 'Completed' },
  ];

  const filtered = filterPaymentsByYear(payments, 2026);

  assert.equal(filtered.length, 2);
  assert.equal(filtered[0].amount, 100);
  assert.equal(filtered[1].amount, 300);
});

test('filterPaymentsByYear falls back to the full dataset when no year is provided', () => {
  const payments = [
    { amount: 100, paymentDate: new Date('2026-01-10T10:00:00Z'), status: 'Completed' },
    { amount: 200, paymentDate: new Date('2027-02-10T10:00:00Z'), status: 'Completed' },
  ];

  const filtered = filterPaymentsByYear(payments);

  assert.equal(filtered.length, 2);
  assert.deepEqual(filtered.map((payment) => payment.amount), [100, 200]);
});

test('computePaymentSummary totals multiple payment events and derives the right balance', () => {
  const summary = computePaymentSummary({
    bill: 1000,
    payments: [
      { amount: 700, status: 'active' },
      { amount: 300, status: 'active' },
    ],
  });

  assert.equal(summary.totalPaid, 1000);
  assert.equal(summary.outstandingBalance, 0);
  assert.equal(summary.carryForward, 0);
  assert.equal(summary.status, 'Paid');
});

test('computePaymentSummary keeps partial balances when payments are smaller than the bill', () => {
  const summary = computePaymentSummary({
    bill: 1000,
    payments: [{ amount: 400, status: 'active' }],
  });

  assert.equal(summary.totalPaid, 400);
  assert.equal(summary.outstandingBalance, 600);
  assert.equal(summary.carryForward, 0);
  assert.equal(summary.status, 'Partial');
});

test('getMonthPaymentTransactions keeps every transaction for the same customer and month before recalculating totals', () => {
  const payments = [
    { userId: 'cust-1', month: 7, year: 2026, amount: 700, status: 'Completed' },
    { userId: 'cust-1', month: 7, year: 2026, amount: 300, status: 'Completed' },
    { userId: 'cust-1', month: 8, year: 2026, amount: 1000, status: 'Completed' },
    { userId: 'cust-2', month: 7, year: 2026, amount: 1000, status: 'Completed' },
  ];

  const monthPayments = getMonthPaymentTransactions({
    payments,
    userId: 'cust-1',
    month: 7,
    year: 2026,
  });
  const summary = computePaymentSummary({ bill: 1000, payments: monthPayments });

  assert.equal(monthPayments.length, 2);
  assert.equal(summary.totalPaid, 1000);
  assert.equal(summary.outstandingBalance, 0);
  assert.equal(summary.carryForward, 0);
  assert.equal(summary.status, 'Paid');
});

test('getActivePayments removes voided and reversed transactions from active totals', () => {
  const payments = [
    { amount: 700, status: 'Completed' },
    { amount: 300, status: 'Voided' },
    { amount: 250, status: 'Reversed' },
  ];

  const activePayments = getActivePayments(payments);

  assert.equal(activePayments.length, 1);
  assert.equal(activePayments[0].amount, 700);
});

test('getActivePayments excludes cancelled and failed statuses even with whitespace', () => {
  const payments = [
    { amount: 700, status: ' Completed ' },
    { amount: 300, status: ' cancelled ' },
    { amount: 250, status: 'FAILED' },
  ];

  const activePayments = getActivePayments(payments);

  assert.equal(activePayments.length, 1);
  assert.equal(activePayments[0].amount, 700);
});

test('computePaymentSummary uses opening due and multiple payments to derive due and advance', () => {
  const summary = computePaymentSummary({
    bill: 1000,
    openingDue: 300,
    payments: [
      { amount: 700, status: 'Completed' },
      { amount: 500, status: 'Completed' },
    ],
  });

  assert.equal(summary.totalPaid, 1200);
  assert.equal(summary.totalReceivable, 1300);
  assert.equal(summary.outstandingBalance, 100);
  assert.equal(summary.advance, 0);
  assert.equal(summary.status, 'Partial');
});

test('getPaymentMonthYear derives month and year from timestamp when month and year fields are missing', () => {
  const payment = {
    amount: 500,
    paymentDate: new Date('2026-07-15T10:00:00Z'),
  };

  const derived = getPaymentMonthYear(payment);

  assert.equal(derived.month, 7);
  assert.equal(derived.year, 2026);
});

test('buildMonthlySheetLedgerRow derives opening due from payment history rather than relying on stored fields', () => {
  const row = buildMonthlySheetLedgerRow({
    user: { id: 'cust-1', name: 'Alice', monthlyBill: 1000 },
    month: 8,
    year: 2026,
    payments: [{ month: 8, year: 2026, amount: 400, status: 'Completed' }],
    history: [{ userId: 'cust-1', month: 7, year: 2026, amount: 300, monthlyBill: 1000, status: 'Completed' }],
  });

  assert.equal(row.previousDue, 700);
  assert.equal(row.previousAdvance, 0);
  assert.equal(row.totalPayable, 1700);
  assert.equal(row.totalPaid, 400);
  assert.equal(row.currentDue, 1300);
  assert.equal(row.currentAdvance, 0);
  assert.equal(row.status, 'Partial');
});

test('buildMonthlyCollectionSeries totals active payments by month while ignoring removed and reversed entries', () => {
  const series = buildMonthlyCollectionSeries({
    year: 2026,
    payments: [
      { amount: 500, month: 1, year: 2026, status: 'Completed' },
      { amount: 250, month: 1, year: 2026, status: 'Reversed' },
      { amount: 300, month: 2, year: 2026, status: 'Completed' },
      { amount: 400, month: 2, year: 2026, status: 'Removed' },
    ],
  });

  assert.equal(series[0].collection, 500);
  assert.equal(series[1].collection, 300);
  assert.equal(series[2].collection, 0);
});

test('buildMonthlySheetLedgerRow keeps pre-activation periods as N/A without carrying prior balances forward', () => {
  const row = buildMonthlySheetLedgerRow({
    user: { id: 'cust-1', name: 'Alice', monthlyBill: 1000, joinDate: '2026-06-20' },
    month: 5,
    year: 2026,
    payments: [{ month: 5, year: 2026, amount: 100, status: 'Completed' }],
    history: [{ userId: 'cust-1', month: 4, year: 2026, amount: 100, monthlyBill: 1000, status: 'Completed' }],
  });

  assert.equal(row.status, 'N/A');
  assert.equal(row.openingDue, 0);
  assert.equal(row.openingAdvance, 0);
  assert.equal(row.currentPaid, 0);
  assert.equal(row.currentDue, 0);
  assert.equal(row.currentAdvance, 0);
});

test('buildMonthlyReportSummary derives monthly report totals from the shared ledger row builder', () => {
  const summary = buildMonthlyReportSummary({
    users: [
      { id: 'cust-1', name: 'Alice', monthlyBill: 1000, active: true },
      { id: 'cust-2', name: 'Bob', monthlyBill: 800, active: true },
    ],
    payments: [
      { userId: 'cust-1', month: 7, year: 2026, amount: 600, status: 'Completed' },
      { userId: 'cust-1', month: 8, year: 2026, amount: 400, status: 'Completed' },
      { userId: 'cust-2', month: 8, year: 2026, amount: 800, status: 'Completed' },
    ],
    month: 8,
    year: 2026,
  });

  assert.equal(summary.totalMonthlyBill, 1800);
  assert.equal(summary.totalCollection, 1200);
  assert.equal(summary.totalDue, 1000);
  assert.equal(summary.totalAdvance, 0);
  assert.equal(summary.totalActiveCustomers, 2);
  assert.equal(summary.paidCustomers, 1);
  assert.equal(summary.partialCustomers, 1);
  assert.equal(summary.pendingCustomers, 0);
  assert.equal(summary.numberOfPayments, 2);
  assert.equal(summary.averageCollectionPerCustomer, 600);
});

test('formatAnnualReportBalanceValue mirrors monthly sheet balance formatting for advance payments', () => {
  assert.equal(formatAnnualReportBalanceValue({ due: 0, advance: 500 }), '+৳500');
  assert.equal(formatAnnualReportBalanceValue({ due: 1000, advance: 0 }), '-৳1000');
  assert.equal(formatAnnualReportBalanceValue({ due: 0, advance: 0 }), '৳0');
});

test('buildYearlyCustomerReportSummary builds yearly rows from the shared ledger helper', () => {
  const summary = buildYearlyCustomerReportSummary({
    user: { id: 'cust-1', name: 'Alice', monthlyBill: 1000, active: true },
    payments: [
      { userId: 'cust-1', month: 7, year: 2026, amount: 600, status: 'Completed' },
      { userId: 'cust-1', month: 8, year: 2026, amount: 400, status: 'Completed' },
    ],
    year: 2026,
  });

  assert.equal(summary.annualBill, 12000);
  assert.equal(summary.totalPaid, 1000);
  assert.equal(summary.totalDue, 11000);
  assert.equal(summary.totalAdvance, 0);
  assert.equal(summary.months[6].month, 7);
  assert.equal(summary.months[6].paid, 600);
  assert.equal(summary.months[7].month, 8);
  assert.equal(summary.months[7].paid, 400);
});

test('getEffectiveBillForPeriod resolves bill changes from the history timeline', () => {
  const user = {
    id: 'cust-1',
    monthlyBill: 1000,
    billHistory: [
      { monthlyBill: 1000, effectiveMonth: 1, effectiveYear: 2026 },
      { monthlyBill: 1500, effectiveMonth: 6, effectiveYear: 2026 },
      { monthlyBill: 1800, effectiveMonth: 10, effectiveYear: 2026 },
    ],
  };

  assert.equal(getEffectiveBillForPeriod(user, { month: 5, year: 2026 }), 1000);
  assert.equal(getEffectiveBillForPeriod(user, { month: 6, year: 2026 }), 1500);
  assert.equal(getEffectiveBillForPeriod(user, { month: 10, year: 2026 }), 1800);
  assert.equal(getEffectiveBillForPeriod(user, { month: 12, year: 2026 }), 1800);
});

test('buildYearlyCustomerReportSummary uses bill history for each historical month', () => {
  const summary = buildYearlyCustomerReportSummary({
    user: {
      id: 'cust-1',
      name: 'Alice',
      monthlyBill: 1000,
      active: true,
      billHistory: [
        { monthlyBill: 1000, effectiveMonth: 1, effectiveYear: 2026 },
        { monthlyBill: 1500, effectiveMonth: 6, effectiveYear: 2026 },
      ],
    },
    payments: [],
    year: 2026,
  });

  assert.equal(summary.months[0].bill, 1000);
  assert.equal(summary.months[5].bill, 1000);
  assert.equal(summary.months[5].month, 6);
  assert.equal(summary.months[6].bill, 1500);
  assert.equal(summary.months[11].bill, 1500);
});

test('formatBalanceDisplayValue uses a minus sign for due balances and a plus sign for advance balances', () => {
  assert.equal(formatBalanceDisplayValue({ due: 0, carryForward: 500 }), '+৳500');
  assert.equal(formatBalanceDisplayValue({ due: 1000, carryForward: 0 }), '-৳1000');
  assert.equal(formatBalanceDisplayValue({ due: 0, carryForward: 0 }), '৳0');
});

test('buildYearlyCustomerReportSummary uses joinDate and inactiveDate instead of creation date when shaping lifecycle months', () => {
  const summary = buildYearlyCustomerReportSummary({
    user: {
      id: 'cust-1',
      name: 'Alice',
      monthlyBill: 1000,
      active: true,
      createdAt: '2026-07-18',
      joinDate: '2026-05-15',
      leaveDate: '2026-09-15',
      status: 'Inactive',
    },
    payments: [
      { userId: 'cust-1', month: 7, year: 2026, amount: 600, status: 'Completed' },
      { userId: 'cust-1', month: 8, year: 2026, amount: 400, status: 'Completed' },
    ],
    year: 2026,
  });

  assert.equal(summary.months[0].status, 'N/A');
  assert.equal(summary.months[4].month, 5);
  assert.equal(summary.months[4].bill, 1000);
  assert.equal(summary.months[8].status, 'Inactive');
  assert.equal(summary.months[9].status, 'Inactive');
});

test('isUserActiveForPeriod treats activation and deactivation months as lifecycle boundaries', () => {
  const activatedInJune = isUserActiveForPeriod({
    id: 'cust-1',
    name: 'Alice',
    active: true,
    joinDate: '2026-06-20',
    monthlyBill: 1000,
  }, { month: 5, year: 2026 });

  const deactivatedInJuly = isUserActiveForPeriod({
    id: 'cust-2',
    name: 'Bob',
    active: true,
    leaveDate: '2026-07-15',
    monthlyBill: 1000,
  }, { month: 7, year: 2026 });

  assert.equal(activatedInJune, false);
  assert.equal(deactivatedInJuly, false);
});

test('isUserActiveForPeriod respects reactivation windows from statusHistory', () => {
  const user = {
    id: 'cust-1',
    name: 'Alice',
    active: true,
    joinDate: '2026-05-15',
    statusHistory: [
      { status: 'Active', date: '2026-05-15' },
      { status: 'Inactive', date: '2026-07-15' },
      { status: 'Active', date: '2026-10-10' },
    ],
  };

  assert.equal(isUserActiveForPeriod(user, { month: 6, year: 2026 }), true);
  assert.equal(isUserActiveForPeriod(user, { month: 8, year: 2026 }), false);
  assert.equal(isUserActiveForPeriod(user, { month: 11, year: 2026 }), true);
});

test('getPaymentStatusLabel returns a paid status when a carry exists', () => {
  const status = getPaymentStatusLabel({
    bill: 1000,
    payments: [{ amount: 1400, status: 'active' }],
  });

  assert.equal(status, 'Advance');
});

test('buildPaymentRemovalEvent marks the original payment as deleted and preserves reversal context', () => {
  const payment = {
    id: 'pay-1',
    userId: 'cust-1',
    customerId: 'cust-1',
    customerName: 'Alice',
    month: 8,
    year: 2026,
    amount: 500,
    monthlyBill: 1000,
    status: 'Completed',
  };

  const event = buildPaymentRemovalEvent({
    payment,
    mode: 'reverse',
    actor: 'admin-1',
    reason: 'Reversed by admin',
    timestamp: new Date('2026-08-10T12:00:00Z'),
  });

  assert.equal(event.originalRecord.status, 'Reversed');
  assert.equal(event.originalRecord.isDeleted, true);
  assert.equal(event.originalRecord.reversedBy, 'admin-1');
  assert.equal(event.reversalRecord.relatedPaymentId, 'pay-1');
  assert.equal(event.reversalRecord.status, 'Reversed');
});

test('createTransactionRowFromPayment flags voided payments as non-revenue contributors', () => {
  const row = createTransactionRowFromPayment({
    id: 'pay-2',
    customerName: 'Alice',
    amount: 1000,
    monthlyBill: 1000,
    status: 'Voided',
    isDeleted: true,
    deletedAt: new Date('2026-09-01T00:00:00Z'),
  }, 1);

  assert.equal(row.status, 'Voided');
  assert.equal(row.amount, 1000);
  assert.equal(row.isRemoved, true);
  assert.equal(row.contributesToRevenue, false);
});

test('buildTransactionRecord captures ledger state for a payment event', () => {
  const record = buildTransactionRecord({
    userId: 'cust-1',
    customerId: 'cust-1',
    customerName: 'Alice',
    month: 7,
    year: 2026,
    transactionType: 'payment',
    amount: 200,
    billAmount: 500,
    previousPaid: 300,
    currentPaid: 500,
    previousDue: 0,
    currentDue: 0,
    previousAdvance: 0,
    currentAdvance: 0,
    status: 'Completed',
    remarks: 'Payment received',
    createdBy: 'owner-1',
  });

  assert.equal(record.transactionType, 'payment');
  assert.equal(record.amount, 200);
  assert.equal(record.previousPaid, 300);
  assert.equal(record.currentPaid, 500);
  assert.equal(record.currentDue, 0);
  assert.equal(record.status, 'Completed');
});

test('resolveTransactionType normalizes legacy payment metadata into a ledger transaction type', () => {
  const resolved = resolveTransactionType({
    paymentType: 'Payment',
    status: 'Completed',
  });

  assert.equal(resolved, 'payment');
});

test('createTransactionStatus returns a visible status for reversed transactions', () => {
  const status = createTransactionStatus({ transactionType: 'payment_reversal', status: 'Completed' });

  assert.equal(status, 'Reversed');
});

test('derivePaymentLedgerMetrics aggregates multiple payments in the same month', () => {
  const metrics = derivePaymentLedgerMetrics({
    billAmount: 1000,
    amount: 300,
    previousPaid: 400,
  });

  assert.equal(metrics.previousPaid, 400);
  assert.equal(metrics.currentPaid, 700);
  assert.equal(metrics.currentDue, 300);
  assert.equal(metrics.currentAdvance, 0);
});

test('buildReversalTransactionRecord preserves the original payment reference and audit reason', () => {
  const record = buildReversalTransactionRecord({
    originalPayment: {
      id: 'payment-1',
      transactionId: 'txn-1',
      userId: 'cust-1',
      customerId: 'cust-1',
      customerName: 'Alice',
      month: 7,
      year: 2026,
      amount: 500,
      monthlyBill: 1000,
      status: 'Completed',
    },
    reversedBy: 'owner-1',
    reason: 'Duplicate entry',
    createdAt: new Date('2026-07-10T10:30:00Z'),
  });

  assert.equal(record.transactionType, 'payment_reversal');
  assert.equal(record.status, 'Reversed');
  assert.equal(record.amount, 0);
  assert.equal(record.relatedTransactionId, 'txn-1');
  assert.equal(record.relatedPaymentId, 'payment-1');
  assert.equal(record.reversalReason, 'Duplicate entry');
  assert.equal(record.reversedBy, 'owner-1');
});
