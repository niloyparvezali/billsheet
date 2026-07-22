import test from 'node:test';
import assert from 'node:assert/strict';

import { buildMonthlyCollectionSeries, buildMonthlyReportSummary, buildMonthlySheetLedgerRow, buildPaymentRemovalEvent, buildVoidPaymentActionRecords, buildYearlyCustomerReportSummary, computePaymentSummary, createTransactionRowFromPayment, filterPaymentsByYear, formatAnnualReportBalanceValue, formatBalanceDisplayValue, getActivePayments, getDisplayBalanceValues, getDisplayPaymentStatus, getEffectiveBillForPeriod, getMonthPaymentTransactions, getPaymentStatusLabel, getPaymentMonthYear, isUserActiveForPeriod, voidPaymentRecord } from '../src/utils/payments.js';
import { deriveMonthlySheetBillingState } from '../src/hooks/useMonthlySheet.js';
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

test('computePaymentSummary includes additional due in the total payable while keeping monthly status tied to the current bill', () => {
  const summary = computePaymentSummary({
    bill: 1000,
    payments: [{ amount: 400, status: 'active', extraDue: 200 }],
  });

  assert.equal(summary.totalPaid, 400);
  assert.equal(summary.totalReceivable, 1200);
  assert.equal(summary.outstandingBalance, 800);
  assert.equal(summary.carryForward, 0);
  assert.equal(summary.status, 'Partial');
});

test('computePaymentSummary keeps the monthly status paid when the current bill is covered even if extra due remains', () => {
  const summary = computePaymentSummary({
    bill: 500,
    payments: [{ amount: 700, status: 'active', extraDue: 300 }],
  });

  assert.equal(summary.totalPaid, 700);
  assert.equal(summary.totalReceivable, 800);
  assert.equal(summary.outstandingBalance, 100);
  assert.equal(summary.carryForward, 0);
  assert.equal(summary.status, 'Paid');
});

test('billing engine passes all requested scenario rules', () => {
  const currentDateBeforeEnd = new Date('2026-07-15');
  const currentDateBeforeMonthClose = new Date('2026-07-31T23:59:59.999');
  const currentDateAfterEnd = new Date('2026-08-01T00:00:00');
  const currentMonth = 7;

  const scenarios = [
    {
      label: 'Pending when unpaid current month bill',
      input: { bill: 500, openingDue: 0, payments: [] },
      expected: { status: 'Pending', currentBillPaid: 0, currentBillRemaining: 500, carryForward: 0 },
    },
    {
      label: 'Partial when current month partially paid',
      input: { bill: 500, openingDue: 0, payments: [{ amount: 200, status: 'active' }] },
      expected: { status: 'Partial', currentBillPaid: 200, currentBillRemaining: 300, carryForward: 0 },
    },
    {
      label: 'Paid when current bill exactly covered',
      input: { bill: 500, openingDue: 0, payments: [{ amount: 500, status: 'active' }] },
      expected: { status: 'Paid', currentBillPaid: 500, currentBillRemaining: 0, carryForward: 0 },
    },
    {
      label: 'Advance when overpaid without previous due',
      input: { bill: 500, openingDue: 0, payments: [{ amount: 700, status: 'active' }] },
      expected: { status: 'Advance', currentBillPaid: 500, currentBillRemaining: 0, carryForward: 200 },
    },
    {
      label: 'Paid when previous due remains after current bill paid',
      input: { bill: 500, openingDue: 500, payments: [{ amount: 500, status: 'active' }] },
      expected: { status: 'Paid', currentBillPaid: 500, currentBillRemaining: 0, previousDueRemaining: 500, carryForward: 0 },
    },
    {
      label: 'Paid when previous due partially covered',
      input: { bill: 500, openingDue: 500, payments: [{ amount: 800, status: 'active' }] },
      expected: { status: 'Paid', currentBillPaid: 500, currentBillRemaining: 0, previousDueRemaining: 200, carryForward: 0 },
    },
    {
      label: 'Advance when bill and due are fully covered with extra payment',
      input: { bill: 500, openingDue: 200, payments: [{ amount: 1000, status: 'active' }] },
      expected: { status: 'Advance', currentBillPaid: 500, currentBillRemaining: 0, previousDueRemaining: 0, carryForward: 300 },
    },
    {
      label: 'Paid when carry forward covers the remainder of the bill',
      input: { bill: 500, openingDue: 0, payments: [{ amount: 200, status: 'active' }], openingAdvance: 300 },
      expected: { status: 'Paid', currentBillPaid: 500, currentBillRemaining: 0, carryForward: 0 },
    },
  ];

  scenarios.forEach(({ label, input, expected }) => {
    const summary = computePaymentSummary(input);
    assert.equal(summary.status, expected.status, `${label} status`);
    assert.equal(summary.currentBillPaid, expected.currentBillPaid, `${label} currentBillPaid`);
    assert.equal(summary.currentBillRemaining, expected.currentBillRemaining, `${label} currentBillRemaining`);
    assert.equal(summary.carryForward, expected.carryForward, `${label} carryForward`);
    if (expected.previousDueRemaining != null) {
      assert.equal(summary.previousDueRemaining, expected.previousDueRemaining, `${label} previousDueRemaining`);
    }
  });

  const partialStatus = getDisplayPaymentStatus({ bill: 500, paid: 300, due: 0, advance: 0, month: currentMonth, currentMonth, currentDate: currentDateBeforeEnd });
  assert.equal(partialStatus.label, 'Partial');

  const dueAfterEnd = getDisplayPaymentStatus({ bill: 500, paid: 300, due: 200, advance: 0, month: currentMonth, currentMonth, currentDate: currentDateAfterEnd });
  assert.equal(dueAfterEnd.label, 'Due');

  const pendingBeforeEnd = getDisplayPaymentStatus({ bill: 500, paid: 0, due: 0, advance: 0, month: currentMonth, currentMonth, currentDate: currentDateBeforeEnd });
  assert.equal(pendingBeforeEnd.label, 'Pending');

  const pendingAtMonthClose = getDisplayPaymentStatus({ bill: 500, paid: 0, due: 0, advance: 0, month: currentMonth, currentMonth, currentDate: currentDateBeforeMonthClose });
  assert.equal(pendingAtMonthClose.label, 'Pending');

  const dueZeroAfterEnd = getDisplayPaymentStatus({ bill: 500, paid: 0, due: 500, advance: 0, month: currentMonth, currentMonth, currentDate: currentDateAfterEnd });
  assert.equal(dueZeroAfterEnd.label, 'Due');
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

test('getDisplayPaymentStatus normalizes pending, partial, due, and advance states from the same rules', () => {
  const pending = getDisplayPaymentStatus({ bill: 1000, paid: 0, month: 7, currentMonth: 7, currentDate: new Date('2026-07-15') });
  const partial = getDisplayPaymentStatus({ bill: 1000, paid: 400, month: 7, currentMonth: 7, currentDate: new Date('2026-07-15') });
  const due = getDisplayPaymentStatus({ bill: 1000, paid: 0, month: 6, currentMonth: 7, currentDate: new Date('2026-07-15') });
  const advance = getDisplayPaymentStatus({ bill: 1000, paid: 1400, due: 0, month: 7, currentMonth: 7, currentDate: new Date('2026-07-15') });

  assert.deepEqual(pending, { label: 'Pending', tone: 'pending', className: 'status-pending' });
  assert.deepEqual(partial, { label: 'Partial', tone: 'partial', className: 'status-partial' });
  assert.deepEqual(due, { label: 'Due', tone: 'due', className: 'status-due' });
  assert.deepEqual(advance, { label: 'Advance', tone: 'advance', className: 'status-advance' });
});

test('getDisplayPaymentStatus preserves explicit partial status for historical transaction rows', () => {
  const historical = getDisplayPaymentStatus({
    status: 'Partial',
    bill: 1000,
    paid: 400,
    month: 6,
    currentMonth: 7,
    currentDate: new Date('2026-07-31'),
    preserveExplicitStatus: true,
  });

  assert.deepEqual(historical, { label: 'Partial', tone: 'partial', className: 'status-partial' });
});

test('getDisplayBalanceValues recomputes from the payment ledger when a full payment clears the bill', () => {
  const balance = getDisplayBalanceValues({
    due: 1000,
    carryForward: 0,
    currentDue: 1000,
    currentAdvance: 0,
    bill: 1000,
    amount: 1000,
    previousDue: 0,
    previousAdvance: 0,
    previousPaid: 0,
    additionalDue: 0,
  });

  assert.deepEqual(balance, { due: 0, carryForward: 0 });
});

test('getDisplayPaymentStatus only shows pending for future months or current-month periods before month-end', () => {
  const futureMonth = getDisplayPaymentStatus({ bill: 1000, paid: 0, month: 8, currentMonth: 7, currentDate: new Date('2026-07-15') });
  const currentMonthBeforeEnd = getDisplayPaymentStatus({ bill: 1000, paid: 0, month: 7, currentMonth: 7, currentDate: new Date('2026-07-15') });
  const currentMonthAfterEnd = getDisplayPaymentStatus({ bill: 1000, paid: 0, month: 7, currentMonth: 7, currentDate: new Date('2026-08-01T00:00:00') });
  const previousMonth = getDisplayPaymentStatus({ bill: 1000, paid: 0, month: 6, currentMonth: 7, currentDate: new Date('2026-07-15') });

  assert.deepEqual(futureMonth, { label: 'Pending', tone: 'pending', className: 'status-pending' });
  assert.deepEqual(currentMonthBeforeEnd, { label: 'Pending', tone: 'pending', className: 'status-pending' });
  assert.deepEqual(currentMonthAfterEnd, { label: 'Due', tone: 'due', className: 'status-due' });
  assert.deepEqual(previousMonth, { label: 'Due', tone: 'due', className: 'status-due' });
});

test('computePaymentSummary keeps advance status off when an overpayment is only clearing a previous due balance', () => {
  const summary = computePaymentSummary({
    bill: 500,
    payments: [{ amount: 1000, status: 'active' }],
    openingDue: 500,
  });

  assert.equal(summary.status, 'Paid');
  assert.equal(summary.currentAdvance, 0);
  assert.equal(summary.currentDue, 0);
});

test('computePaymentSummary allocates overpayments after clearing prior due and the current bill', () => {
  const summary = computePaymentSummary({
    bill: 1000,
    payments: [{ amount: 1700, status: 'active' }],
    openingDue: 500,
  });

  assert.equal(summary.totalPaid, 1700);
  assert.equal(summary.totalReceivable, 1500);
  assert.equal(summary.currentDue, 0);
  assert.equal(summary.currentAdvance, 200);
  assert.equal(summary.status, 'Advance');
});

test('deriveMonthlySheetBillingState applies current bill before previous due and marks advance only when the surplus remains', () => {
  const exampleOne = deriveMonthlySheetBillingState({
    bill: 500,
    openingDue: 500,
    openingAdvance: 0,
    currentPayments: [{ amount: 800, status: 'active' }],
  });

  assert.equal(exampleOne.status, 'Paid');
  assert.equal(exampleOne.currentBillPaid, 500);
  assert.equal(exampleOne.previousDueRemaining, 200);
  assert.equal(exampleOne.carryForward, 0);

  const exampleTwo = deriveMonthlySheetBillingState({
    bill: 500,
    openingDue: 200,
    openingAdvance: 0,
    currentPayments: [{ amount: 1000, status: 'active' }],
  });

  assert.equal(exampleTwo.status, 'Advance');
  assert.equal(exampleTwo.currentBillPaid, 500);
  assert.equal(exampleTwo.previousDueRemaining, 0);
  assert.equal(exampleTwo.carryForward, 300);

  const exampleThree = deriveMonthlySheetBillingState({
    bill: 500,
    openingDue: 0,
    openingAdvance: 300,
    currentPayments: [{ amount: 200, status: 'active' }],
  });

  assert.equal(exampleThree.status, 'Paid');
  assert.equal(exampleThree.currentBillPaid, 500);
  assert.equal(exampleThree.previousDueRemaining, 0);
  assert.equal(exampleThree.carryForward, 0);
});

test('deriveMonthlySheetBillingState keeps the current month pending until the billing month has fully ended', () => {
  const pendingState = deriveMonthlySheetBillingState({
    bill: 1000,
    openingDue: 0,
    openingAdvance: 0,
    currentPayments: [],
    month: 7,
    year: 2026,
    currentDate: new Date('2026-07-31T23:59:59.999'),
  });

  const dueState = deriveMonthlySheetBillingState({
    bill: 1000,
    openingDue: 0,
    openingAdvance: 0,
    currentPayments: [],
    month: 7,
    year: 2026,
    currentDate: new Date('2026-08-01T00:00:00'),
  });

  assert.equal(pendingState.status, 'Pending');
  assert.equal(dueState.status, 'Due');
});

test('getDisplayPaymentStatus shows paid for the current month even when prior dues remain and due for past months with unpaid balances', () => {
  const currentMonthPaid = getDisplayPaymentStatus({ bill: 500, paid: 500, due: 200, month: 7, currentMonth: 7, currentDate: new Date('2026-07-15') });
  const previousMonthDue = getDisplayPaymentStatus({ bill: 500, paid: 300, due: 200, month: 6, currentMonth: 7, currentDate: new Date('2026-07-15') });

  assert.deepEqual(currentMonthPaid, { label: 'Paid', tone: 'paid', className: 'status-paid' });
  assert.deepEqual(previousMonthDue, { label: 'Due', tone: 'due', className: 'status-due' });
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
  assert.equal(summary.status, 'Paid');
});

test('computePaymentSummary marks paid when previous due plus current bill are exactly covered', () => {
  const summary = computePaymentSummary({
    bill: 1000,
    openingDue: 1000,
    payments: [{ amount: 2000, status: 'Completed' }],
  });

  assert.equal(summary.totalPaid, 2000);
  assert.equal(summary.totalReceivable, 2000);
  assert.equal(summary.currentDue, 0);
  assert.equal(summary.currentAdvance, 0);
  assert.equal(summary.status, 'Paid');
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

test('buildYearlyCustomerReportSummary uses the effective bill for each month when bill history changes mid-year', () => {
  const summary = buildYearlyCustomerReportSummary({
    user: {
      id: 'cust-1',
      name: 'Alice',
      monthlyBill: 500,
      billHistory: [{ effectiveMonth: 2, effectiveYear: 2026, monthlyBill: 700 }],
      active: true,
    },
    payments: [],
    year: 2026,
  });

  assert.equal(summary.months[0].bill, 500);
  assert.equal(summary.months[1].bill, 700);
  assert.equal(summary.months[2].bill, 700);
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
  assert.equal(summary.months[5].bill, 1500);
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

test('voidPaymentRecord preserves a specific void reason and reason type on the target payment record', () => {
  const payment = {
    id: 'pay-2',
    userId: 'cust-1',
    customerId: 'cust-1',
    customerName: 'Alice',
    month: 8,
    year: 2026,
    amount: 500,
    monthlyBill: 1000,
    status: 'Completed',
  };

  const voided = voidPaymentRecord({
    payment,
    voidedBy: 'admin-1',
    reason: 'Client overpaid and requested refund',
    reasonType: 'Customer Refund',
    voidDate: new Date('2026-08-10T12:00:00Z'),
    voidTime: '12:00',
  });

  assert.equal(voided.status, 'Voided');
  assert.equal(voided.isDeleted, true);
  assert.equal(voided.voidedBy, 'admin-1');
  assert.equal(voided.reasonType, 'Customer Refund');
  assert.equal(voided.reason, 'Client overpaid and requested refund');
});

test('buildVoidPaymentActionRecords creates a separate reversal transaction while preserving the original payment audit trail', () => {
  const payment = {
    id: 'pay-2',
    transactionId: 'txn-2',
    userId: 'cust-1',
    customerId: 'cust-1',
    customerName: 'Alice',
    userName: 'Alice',
    userCategory: 'Regular',
    month: 8,
    year: 2026,
    amount: 500,
    monthlyBill: 1000,
    status: 'Completed',
    ownerId: 'owner-1',
  };

  const records = buildVoidPaymentActionRecords({
    payment,
    voidedBy: 'admin-1',
    reason: 'Wrong Amount',
    reasonType: 'Wrong Amount',
    voidDate: new Date('2026-08-10T12:00:00Z'),
    voidTime: '12:00',
    ownerId: 'owner-1',
    paymentDateText: '2026-08-10',
    paymentTime: '12:00',
  });

  assert.equal(records.originalRecord.status, 'Voided');
  assert.equal(records.originalRecord.isDeleted, true);
  assert.equal(records.originalRecord.voidedBy, 'admin-1');
  assert.equal(records.voidActionRecord.relatedPaymentId, 'pay-2');
  assert.equal(records.voidActionRecord.relatedTransactionId, 'txn-2');
  assert.equal(records.voidActionRecord.paymentType, 'Void Payment');
  assert.equal(records.voidActionRecord.status, 'Voided');
  assert.equal(records.voidActionRecord.amount, 0);
  assert.equal(records.voidActionRecord.transactionType, 'payment_reversal');
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

test('createTransactionRowFromPayment uses the ledger-backed advance value for display balance', () => {
  const row = createTransactionRowFromPayment({
    amount: 1700,
    monthlyBill: 1000,
    previousDue: 500,
    currentDue: 0,
    currentAdvance: 200,
    status: 'Completed',
  }, 0);

  assert.equal(row.due, 0);
  assert.equal(row.carryForward, 200);
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
