import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { FiEdit2, FiSearch, FiTrash2, FiUsers } from "react-icons/fi";
import toast from "react-hot-toast";
import { db } from "../firebase/config";
import useOwnedCollection from "../hooks/useOwnedCollection";
import Modal from "../components/Modal";
import ConfirmModal from "../components/ConfirmModal";
import { useAuth } from "../context/AuthContext";
import { monthNames, money, formatDate, formatTime } from "../utils/date";
import { Send } from "lucide-react";

const period = (month, year) => Number(year) * 12 + Number(month);
const defaultSmsTemplate =
  "Dear {name}, your monthly bill is {bill}. Please pay by {duedate}. Thank you.";
const createSms = (template, { name, bill, dueDate }) =>
  template
    .replaceAll("{name}", name || "Customer")
    .replaceAll("{bill}", money(bill))
    .replaceAll("{duedate}", dueDate);

export default function MonthlySheet() {
  const { user: signedInUser } = useAuth();
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());

  const [search, setSearch] = useState("");
  const searchRef = useRef(null);

  const [editing, setEditing] = useState(null);
  const [nameOrder, setNameOrder] = useState("asc");
  const [statusOrder, setStatusOrder] = useState("pending");
  const [smsTemplate, setSmsTemplate] = useState(defaultSmsTemplate);
  const { data: users } = useOwnedCollection("users");
  const { data: allPayments } = useOwnedCollection("payments");
  const currentPeriod = period(month, year);

  const activeUsers = useMemo(
    () => users.filter((user) => user.active !== false),
    [users],
  );

  const activeUserIds = useMemo(
    () => new Set(activeUsers.map((user) => user.id)),
    [activeUsers],
  );

  const payments = useMemo(
    () =>
      allPayments.filter(
        (payment) =>
          Number(payment.month) === month && Number(payment.year) === year,
      ),
    [allPayments, month, year],
  );

  const paymentsByUser = useMemo(() => {
    const map = new Map();
    allPayments.forEach((payment) => {
      if (!payment.userId) return;
      const existing = map.get(payment.userId) || [];
      existing.push(payment);
      map.set(payment.userId, existing);
    });
    return map;
  }, [allPayments]);

  const searchTerm = useMemo(() => search.trim().toLowerCase(), [search]);

  useEffect(() => {
    const loadSmsTemplate = async () => {
      if (!signedInUser || !db) return;
      try {
        const saved = await getDoc(doc(db, "settings", signedInUser.uid));
        const template = saved?.data()?.smsTemplate;
        if (typeof template === "string" && template.trim()) {
          setSmsTemplate(template.trim());
        }
      } catch {
        // Ignore SMS template load failures.
      }
    };
    loadSmsTemplate();
  }, [signedInUser]);

  const dueFor = useCallback(
    (user) => {
      const bill = Number(user.monthlyBill || 0);
      const history = paymentsByUser.get(user.id) || [];
      const previous = history
        .filter(
          (payment) => period(payment.month, payment.year) < currentPeriod,
        )
        .sort((a, b) => period(b.month, b.year) - period(a.month, a.year))[0];
      const missedMonths = previous
        ? Math.max(1, currentPeriod - period(previous.month, previous.year))
        : 1;
      return Math.max(0, Number(previous?.due || 0) + bill * missedMonths);
    },
    [currentPeriod, paymentsByUser],
  );
  const rows = useMemo(() => {
    const paymentIndex = new Map();
    payments.forEach((payment) => {
      if (!payment.userId) return;
      paymentIndex.set(payment.userId, payment);
    });

    const currentUsers = activeUsers.map((user) => ({
      user,
      payment: paymentIndex.get(user.id),
    }));
    const archivedUsers = payments
      .filter((payment) => !activeUserIds.has(payment.userId))
      .map((payment) => ({
        user: {
          id: payment.userId,
          name: payment.userName || "Former customer",
          category: payment.userCategory || "—",
          monthlyBill: payment.monthlyBill || 0,
          archived: true,
        },
        payment,
      }));

    return [...currentUsers, ...archivedUsers]
      .sort((a, b) => a.user.name.localeCompare(b.user.name))
      .map(({ user, payment }) => {
        const openingDue = dueFor(user);
        return {
          user,
          payment,
          openingDue,
          due: payment ? Number(payment.due || 0) : openingDue,
        };
      });
  }, [activeUsers, payments, dueFor]);
  const paid = rows.filter((row) => Number(row.payment?.amount || 0) > 0);
  const total = paid.reduce(
    (sum, row) => sum + Number(row.payment?.amount || 0),
    0,
  );
  const totalDue = rows.reduce((sum, row) => sum + Number(row.due || 0), 0);
  const totalBill = rows.reduce(
    (sum, row) => sum + Number(row.user.monthlyBill || 0),
    0,
  );
  const getStatusPriority = (row) => {
    const paid = Number(row.payment?.amount || 0);

    return statusOrder === "pending" ? (paid > 0 ? 1 : 0) : paid > 0 ? 0 : 1;
  };
  const filteredRows = useMemo(() => {
    const rowsWithStatus = [...rows].sort((a, b) => {
      const statusCompare = getStatusPriority(a) - getStatusPriority(b);

      if (statusCompare !== 0) return statusCompare;

      return nameOrder === "asc"
        ? a.user.name.localeCompare(b.user.name)
        : b.user.name.localeCompare(a.user.name);
    });

    if (!searchTerm) return rowsWithStatus;

    return rowsWithStatus.filter((row) =>
      [row.user.name, row.user.category, row.user.phone].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(searchTerm),
      ),
    );
  }, [rows, searchTerm, nameOrder, statusOrder]);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [smsRecipient, setSmsRecipient] = useState(null);

  const remove = async (id) => {
    try {
      await deleteDoc(doc(db, "payments", id));
      toast.success("Payment deleted");
    } catch (error) {
      toast.error(error.message || "Could not delete payment");
    } finally {
      setConfirmDelete(null);
    }
  };
  const handleSms = async (user) => {
    const phone = String(user.phone || "")
      .trim()
      .replace(/[\s()-]/g, "");
    if (!phone) return toast.error(`${user.name} does not have a phone number`);
    if (!/^\+?\d+$/.test(phone))
      return toast.error("Enter a valid phone number before sending an SMS");
    try {
      const dueDate = new Date(year, month - 1, 14).toLocaleDateString(
        "en-GB",
        { day: "numeric", month: "long", year: "numeric" },
      );
      const message = createSms(smsTemplate, {
        name: user.name,
        bill: user.monthlyBill,
        dueDate,
      });

      const smsUrl = `sms:${phone}?body=${encodeURIComponent(message)}`;
      if (navigator.share) {
        await navigator.share({
          title: "Send bill SMS",
          text: message,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(message);
        toast.success("SMS text copied to clipboard");
        window.location.href = smsUrl;
      } else {
        window.location.href = smsUrl;
      }
    } catch (error) {
      toast.error(
        error.name === "AbortError"
          ? "SMS sharing cancelled"
          : error.message || "Could not prepare the SMS",
      );
    } finally {
      setSmsRecipient(null);
    }
  };

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h2>Monthly Sheet</h2>
          <p>Record and review every payment.</p>
        </div>
      </div>
      <div className="toolbar filters">
        <select value={month} onChange={(e) => setMonth(+e.target.value)}>
          {monthNames.map((name, i) => (
            <option value={i + 1} key={name}>
              {name}
            </option>
          ))}
        </select>
        <input
          type="number"
          min="2024"
          value={year}
          onChange={(e) => setYear(+e.target.value)}
        />
        {rows.length > 0 && (
          <span className="customer-count">
            <FiUsers /> {rows.length}{" "}
            {rows.length === 1 ? "customer" : "customers"}
          </span>
        )}
      </div>
      <div className="summary sheet-summary">
        <div>
          Total Users<b>{rows.length}</b>
        </div>
        <div>
          Paid Users<b>{paid.length}</b>
        </div>
        <div>
          Pending Users<b>{rows.length - paid.length}</b>
        </div>
        <div>
          Total Bill<b>{money(totalBill)}</b>
        </div>
        <div>
          Total Collection<b>{money(total)}</b>
        </div>
        <div>
          Total Due<b>{money(totalDue)}</b>
        </div>
      </div>
      <div className="toolbar">
        <label className="search">
          <FiSearch />
          <input
            ref={searchRef}
            placeholder="Search name, category, or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      <section
        className={rows.length ? "panel table-wrap" : "panel sheet-empty"}
      >
        {rows.length ? (
          <table className="monthly-table">
            <thead>
              <tr>
                <th>SL</th>
                <th
                  style={{ cursor: "pointer" }}
                  onClick={() =>
                    setNameOrder(nameOrder === "asc" ? "desc" : "asc")
                  }
                >
                  Customer {nameOrder === "asc" ? "▲" : "▼"}
                </th>
                <th>Bill</th>
                <th>Paid</th>
                <th>Due</th>
                <th
                  style={{ cursor: "pointer" }}
                  onClick={() =>
                    setStatusOrder(
                      statusOrder === "pending" ? "paid" : "pending",
                    )
                  }
                >
                  Status {statusOrder === "pending" ? "▲" : "▼"}
                </th>
                <th>Payment Date & Time</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(({ user, payment, openingDue, due }, i) => {
                const isPaid = Number(payment?.amount) > 0;
                return (
                  <tr
                    className={isPaid ? "paid-row" : "pending-row"}
                    key={user.id}
                  >
                    {/* # */}
                    <td data-label="SL">{i + 1}</td>

                    {/* Customer Name */}
                    <td data-label="Customer">
                      <strong className="customer-name">{user.name}</strong>
                    </td>

                    {/* Bill */}
                    <td data-label="Bill">
                      <strong className="bill-value">
                        {money(user.monthlyBill)}
                      </strong>
                    </td>

                    {/* Paid */}
                    <td data-label="Paid">
                      <strong className="paid-value">
                        {money(payment?.amount)}
                      </strong>
                    </td>

                    {/* Due */}
                    <td data-label="Due">
                      <b className={due > 0 ? "due-value" : ""}>{money(due)}</b>
                    </td>

                    {/* Status */}
                    <td data-label="Status">
                      <span
                        className={isPaid ? "status paid" : "status pending"}
                      >
                        {isPaid ? "● Paid" : "● Pending"}
                      </span>
                    </td>

                    {/* Payment Date & Time */}
                    <td data-label="Payment Date">
                      {payment?.paymentDate ? (
                        <div className="payment-date">
                          <strong>{formatDate(payment.paymentDate)}</strong>

                          <small>{formatTime(payment.paymentDate)}</small>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>

                    {/* Actions */}
                    <td className="actions" data-label="Actions">
                      <button
                        className="sms"
                        onClick={() => setSmsRecipient(user)}
                        title="Send SMS"
                      >
                        <Send size={16} />
                      </button>

                      <button
                        onClick={() =>
                          setEditing({ user, payment, openingDue })
                        }
                        title="Edit"
                      >
                        <FiEdit2 />
                      </button>

                      {payment && (
                        <button
                          className="btn btn-danger"
                          onClick={() => setConfirmDelete(payment.id)}
                          title="Delete"
                        >
                          <FiTrash2 />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="sheet-empty-content">
            <span>
              <FiUsers />
            </span>
            <h3>Start with your first customer</h3>
            <p>
              Add customers from the Users page, then come back to record their
              payments for {monthNames[month - 1]} {year}.
            </p>
            <Link className="btn btn-primary" to="/users">
              Go to Users
            </Link>
          </div>
        )}
        {rows.length > 0 && !filteredRows.length && (
          <p className="empty">No customers match your search.</p>
        )}
      </section>
      {editing && (
        <PaymentModal
          data={editing}
          month={month}
          year={year}
          ownerId={signedInUser?.uid}
          close={() => setEditing(null)}
        />
      )}
      {confirmDelete && (
        <ConfirmModal
          title="Delete payment"
          message="This will delete the payment record. Are you sure?"
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={() => remove(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      {smsRecipient && (
        <ConfirmModal
          title="Send SMS"
          message={`Send SMS to ${smsRecipient.name}? This will open the phone app or sharing options if supported.`}
          confirmText="Open SMS"
          cancelText="Cancel"
          onConfirm={() => {
            handleSms(smsRecipient);
            setSmsRecipient(null);
          }}
          onCancel={() => setSmsRecipient(null)}
        />
      )}
      <button
        className="search-fab"
        title="Search"
        onClick={() => {
          window.scrollTo({
            top: 0,
            behavior: "smooth",
          });

          setTimeout(() => {
            searchRef.current?.focus();
          }, 350);
        }}
      >
        <FiSearch />
      </button>
    </div>
  );
}

function PaymentModal({ data, month, year, ownerId, close }) {
  const [amount, setAmount] = useState(
    data.payment?.amount != null ? data.payment.amount : "",
  );
  const [extraDue, setExtraDue] = useState(
    data.payment?.extraDue != null ? data.payment.extraDue : "",
  );
  const [saving, setSaving] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const bill = Number(data.user.monthlyBill || 0);

  const savePayment = async () => {
    setSaving(true);
    const paid = Number(amount || 0);
    const addedDue = Number(extraDue || 0);
    if (paid < 0 || Number.isNaN(paid)) {
      toast.error("Invalid payment amount");
      setSaving(false);
      return;
    }
    const due = Math.max(0, Number(data.openingDue || 0) + addedDue - paid);
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
      status: paid > 0 ? "paid" : "pending",
    };
    try {
      if (data.payment)
        await updateDoc(doc(db, "payments", data.payment.id), {
          ...base,
          paymentDate: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      else
        await addDoc(collection(db, "payments"), {
          ...base,
          paymentDate: serverTimestamp(),
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
            min="0"
            step="any"
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
