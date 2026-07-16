import test from 'node:test';
import assert from 'node:assert/strict';

import { computePaymentSummary, getActivePayments, getMonthPaymentTransactions, getPaymentStatusLabel } from '../src/utils/payments.js';

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

test('getPaymentStatusLabel returns a paid status when a carry exists', () => {
  const status = getPaymentStatusLabel({
    bill: 1000,
    payments: [{ amount: 1400, status: 'active' }],
  });

  assert.equal(status, 'Paid');
});
