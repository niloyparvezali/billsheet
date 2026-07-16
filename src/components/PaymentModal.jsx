import { useMemo, useState } from "react";
import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import toast from "react-hot-toast";

import Modal from "./Modal";
import ConfirmModal from "./ConfirmModal";

import { db } from "../firebase/config";
import useOwnedCollection from "../hooks/useOwnedCollection";
import { money } from "../utils/date";
export default function PaymentModal({ data, month, year, ownerId, close }) {
  const [amount, setAmount] = useState(
    data.payment?.amount != null ? data.payment.amount : "",
  );
  const [extraDue, setExtraDue] = useState(
    data.payment?.extraDue != null ? data.payment.extraDue : "",
  );
  const [saving, setSaving] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const bill = Number(data.user.monthlyBill || 0);
  const { data: payments = [] } = useOwnedCollection("payments");

  const paidSoFar = useMemo(() => {
    const isRemoved = (payment) => Boolean(
      payment?.isDeleted || payment?.deletedAt || payment?.status === "removed",
    );
    return (payments || [])
      .filter((payment) => {
        const sameUser = payment.userId === data.user.id || payment.userName === data.user.name;
        return (
          !isRemoved(payment) &&
          sameUser &&
          Number(payment.month) === Number(month) &&
          Number(payment.year) === Number(year)
        );
      })
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  }, [data.user.id, data.user.name, month, payments, year]);

  const savePayment = async () => {
    setSaving(true);
    const paid = Number(amount || 0);
    const addedDue = Number(extraDue || 0);
    if (!Number.isFinite(paid) || paid <= 0) {
      toast.error("Please enter a valid amount.");
      setSaving(false);
      return;
    }
    const runningPaid = paidSoFar + paid;
    const due = Math.max(0, bill + addedDue - runningPaid);
    const base = {
      ownerId,
      userId: data.user.id,
      userName: data.user.name,
      userCategory: data.user.category,
      monthlyBill: bill,
      month,
      year,
      amount: paid,
      extraDue: addedDue,
      due,
      currentPaid: runningPaid,
      status: due > 0 ? "pending" : "paid",
    };
    try {
      await addDoc(collection(db, "payments"), {
        ...base,
        paymentDate: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
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
          Monthly bill: <b>{money(bill)}</b> · Opening due:{" "}
          <b>{money(data.openingDue)}</b>
        </p>
        <label>
          Paid amount
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
          Additional due (optional)
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
