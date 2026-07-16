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
import { computePaymentSummary, getMonthPaymentTransactions } from "../utils/payments";

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

  const savePayment = async () => {
    setSaving(true);
    const paid = Number(amount || 0);
    const addedDue = Number(extraDue || 0);
    if (!Number.isFinite(paid) || paid <= 0) {
      toast.error("Please enter a valid amount.");
      setSaving(false);
      return;
    }
    const paymentTimestamp = new Date();
    const paymentDateText = paymentTimestamp.toISOString().split("T")[0];
    const paymentTimeText = paymentTimestamp.toTimeString().split(" ")[0].slice(0, 5);
    const notes = addedDue > 0 ? `Additional due: ${addedDue}` : "";
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
      transactionId: "",
      paymentDateText,
      paymentTime: paymentTimeText,
      paymentType: "Payment",
      createdBy: ownerId || "",
      status: "Completed",
      notes,
    };
    try {
      const paymentRef = doc(collection(db, "payments"));
      const batch = writeBatch(db);
      batch.set(paymentRef, {
        ...base,
        transactionId: paymentRef.id,
        paymentDate: serverTimestamp(),
        createdAt: serverTimestamp(),
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
    if (!Number.isFinite(paid) || paid <= 0) {
      toast.error("Please enter a valid amount.");
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
          Outstanding Balance: <b>{money(outstandingBalance)}</b> · Carry Forward: <b>{money(carryForward)}</b>
        </p>
        <label>
          Payment Amount
          <input
            type="number"
            min="0.01"
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
