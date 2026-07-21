import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import toast from "react-hot-toast";

import Modal from "./Modal";
import ConfirmModal from "./ConfirmModal";

import { db } from "../firebase/config";
import useOwnedCollection from "../hooks/useOwnedCollection";
import { money } from "../utils/date";
import { buildBillingLedger, computePaymentSummary, formatBalanceDisplayValue, getMonthPaymentTransactions } from "../utils/payments";
import { buildTransactionRecord, TRANSACTION_TYPES } from "../utils/transactions.js";

export default function PaymentModal({ data, month, year, ownerId, close }) {
  const [amount, setAmount] = useState("");
  const [extraDue, setExtraDue] = useState("");
  const [saving, setSaving] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const bill = Number(data.user.monthlyBill || 0);
  const { data: payments = [] } = useOwnedCollection("payments");

  const paymentSummary = useMemo(() => {
    const monthPayments = getMonthPaymentTransactions({
      payments,
      userId: data.user.id,
      userName: data.user.name,
      month,
      year,
    });
    return computePaymentSummary({ bill, payments: monthPayments });
  }, [bill, data.user.id, data.user.name, month, payments, year]);

  const alreadyPaid = Number(paymentSummary.totalPaid || 0);
  const outstandingBalance = Number(paymentSummary.outstandingBalance || 0);
  const carryForward = Number(paymentSummary.carryForward || 0);

  useEffect(() => {
    const recommendedAmount = Math.max(0, outstandingBalance);
    setAmount(String(recommendedAmount));
    setExtraDue("");
  }, [outstandingBalance, data.user.id, data.user.name, month, year]);

  const validatePaymentInputs = ({ paid, addedDue }) => {
    if (!Number.isFinite(paid) || paid < 0) {
      toast.error("Please enter a valid amount.");
      return false;
    }
    if (!Number.isFinite(addedDue) || addedDue < 0) {
      toast.error("Additional due must be zero or a positive number.");
      return false;
    }
    if (paid <= 0 && addedDue <= 0) {
      toast.error("Enter either a payment amount or an additional due.");
      return false;
    }
    return true;
  };

  const savePayment = async () => {
    setSaving(true);
    const paid = Number(amount || 0);
    const addedDue = Number(extraDue || 0);
    if (!validatePaymentInputs({ paid, addedDue })) {
      setSaving(false);
      return;
    }
    const paymentTimestamp = new Date();
    const paymentDateText = paymentTimestamp.toISOString().split("T")[0];
    const paymentTimeText = paymentTimestamp.toTimeString().split(" ")[0].slice(0, 5);
    const notes = addedDue > 0 ? `Additional due: ${addedDue}` : "";
    const previousPaid = Number(alreadyPaid || 0);
    const billingLedger = buildBillingLedger({
      bill,
      previousDue: outstandingBalance,
      carryForward,
      paid,
      additionalDue: addedDue,
    });
    const currentPaid = billingLedger.currentBillPaid;
    const currentDue = billingLedger.currentBillRemaining + billingLedger.previousDueRemaining;
    const currentAdvance = billingLedger.carryForwardNext;
    const transactionStatus = billingLedger.currentBillPaid === 0
      ? "Pending"
      : billingLedger.currentBillPaid < bill
        ? "Partial"
        : billingLedger.previousDueRemaining === 0 && billingLedger.carryForwardNext > 0
          ? "Advance"
          : "Paid";
    const transaction = buildTransactionRecord({
      userId: data.user.id,
      customerId: data.user.id,
      customerName: data.user.name,
      month,
      year,
      transactionType: TRANSACTION_TYPES.PAYMENT,
      amount: paid,
      billAmount: bill,
      previousPaid,
      currentPaid,
      previousDue: outstandingBalance,
      currentDue,
      previousAdvance: carryForward,
      currentAdvance,
      status: transactionStatus,
      remarks: notes,
      createdBy: ownerId || "",
      createdAt: paymentTimestamp,
      updatedAt: paymentTimestamp,
      metadata: {
        ownerId,
        userName: data.user.name,
        userCategory: data.user.category,
        monthlyBill: bill,
        extraDue: addedDue,
        paymentDateText,
        paymentTime: paymentTimeText,
        paymentType: "Payment",
        createdBy: ownerId || "",
        status: transactionStatus,
        notes,
      },
    });
    const base = {
      ownerId,
      userId: data.user.id,
      userName: data.user.name,
      customerId: data.user.id,
      customerName: data.user.name,
      userCategory: data.user.category,
      monthlyBill: bill,
      month,
      year,
      amount: paid,
      extraDue: addedDue,
      transactionId: transaction.transactionId,
      paymentDateText,
      paymentTime: paymentTimeText,
      paymentType: "Payment",
      createdBy: ownerId || "",
      status: "Completed",
      notes,
      ...transaction,
    };
    try {
      const paymentRef = doc(collection(db, "payments"));
      const batch = writeBatch(db);
      batch.set(paymentRef, {
        ...base,
        transactionId: paymentRef.id,
        paymentDate: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      toast.success(`${data.user.name}'s payment has been saved successfully.`);
      close();
    } catch (error) {
      toast.error(error.message || "Failed to save payment.");
    } finally {
      setSaving(false);
    }
  };

  const attemptSave = (event) => {
    event.preventDefault();
    if (saving) return;

    const paid = Number(amount || 0);
    const addedDue = Number(extraDue || 0);
    if (!validatePaymentInputs({ paid, addedDue })) {
      return;
    }

    setShowSaveConfirm(true);
  };

  return (
    <Modal title={`Payment · ${data.user.name}`} onClose={close}>
      <form className="form" onSubmit={attemptSave}>
        <p className="payment-note">
          Bill Amount: <b>{money(bill)}</b> · Already Paid: <b>{money(alreadyPaid)}</b>
          <br />
          Outstanding Balance: <b style={{ color: "#EF4444" }}>{formatBalanceDisplayValue({ due: outstandingBalance, carryForward: 0 })}</b> · Carry Forward: <b style={{ color: "#3B82F6" }}>{formatBalanceDisplayValue({ due: 0, carryForward })}</b>
        </p>
        <label>
          Payment Amount
          <input
            type="number"
            min="0"
            step="0.01"
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label>
          Additional Due (optional)
          <input
            type="number"
            min="0"
            step="any"
            value={extraDue}
            onChange={(e) => setExtraDue(e.target.value)}
          />
        </label>
        <button className="btn btn-primary" disabled={saving}>
          {saving ? "Saving..." : "Save Payment"}
        </button>
      </form>
      {showSaveConfirm && (
        <ConfirmModal
          title="Save payment"
          message={`Save payment for ${data.user.name}?`}
          confirmText="Save"
          cancelText="Cancel"
          onConfirm={async () => {
            setShowSaveConfirm(false);
            await savePayment();
          }}
          onCancel={() => setShowSaveConfirm(false)}
        />
      )}
    </Modal>
  );
}
