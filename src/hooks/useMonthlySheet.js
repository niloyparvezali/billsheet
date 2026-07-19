import { useMemo } from "react";
import { buildMonthlySheetLedgerRow, getMonthPaymentTransactions, isUserActiveForPeriod } from "../utils/payments";

const period = (month, year) => Number(year) * 12 + Number(month);
export default function useMonthlySheet({
  users,
  allPayments,
  month,
  year,
  search,
  nameOrder,
  statusOrder,
}) {
  const activeUsers = useMemo(
    () => (users || []).filter((user) => isUserActiveForPeriod(user, { month, year })),
    [month, users, year],
  );
  const payments = useMemo(() => {
    const targetMonth = Number(month);
    const targetYear = Number(year);
    return (allPayments || []).filter((payment) => {
      const isRemoved = Boolean(
        payment?.isDeleted || payment?.deletedAt || payment?.status === "removed",
      );
      return !isRemoved && Number(payment.month) === targetMonth && Number(payment.year) === targetYear;
    });
  }, [allPayments, month, year]);
  const paymentsByUser = useMemo(() => {
    const map = new Map();
    (allPayments || []).forEach((payment) => {
      const isRemoved = Boolean(
        payment?.isDeleted || payment?.deletedAt || payment?.status === "removed",
      );
      if (!payment.userId || isRemoved) return;
      const existing = map.get(payment.userId) || [];
      existing.push(payment);
      map.set(payment.userId, existing);
    });
    return map;
  }, [allPayments]);
  const searchTerm = useMemo(() => search.trim().toLowerCase(), [search]);
  const currentPeriod = period(month, year);
  const rows = useMemo(() => {
    const paymentIndex = new Map();
    payments.forEach((payment) => {
      if (!payment.userId) return;
      const existing = paymentIndex.get(payment.userId) || [];
      existing.push(payment);
      paymentIndex.set(payment.userId, existing);
    });

    return activeUsers
      .map((user) => {
        const userPayments = getMonthPaymentTransactions({
          payments: paymentIndex.get(user.id) || [],
          userId: user.id,
          userName: user.name,
          month,
          year,
        });
        const history = (paymentsByUser.get(user.id) || []).filter(
          (payment) => period(payment.month, payment.year) < currentPeriod,
        );
        const row = buildMonthlySheetLedgerRow({
          user,
          payments: userPayments || [],
          history,
          month,
          year,
        });
        return {
          user,
          payment: row.payment,
          openingDue: row.openingDue,
          openingAdvance: row.openingAdvance,
          currentPaid: row.currentPaid,
          due: row.currentDue,
          carryForward: row.currentAdvance,
          status: row.status,
          totalPayable: row.totalPayable,
          totalPaid: row.totalPaid,
          currentDue: row.currentDue,
          currentAdvance: row.currentAdvance,
        };
      })
      .sort((a, b) => a.user.name.localeCompare(b.user.name));
  }, [activeUsers, currentPeriod, month, payments, paymentsByUser, year]);
  const paid = rows.filter((row) => Number(row.currentPaid || 0) > 0);
  const total = rows.reduce((sum, row) => sum + Number(row.currentPaid || 0), 0);
  const totalDue = rows.reduce((sum, row) => sum + Number(row.due || 0), 0);
  const totalBill = rows.reduce(
    (sum, row) => sum + Number(row.user.monthlyBill || 0),
    0,
  );
  const getStatusPriority = (row) => {
    const isPending = String(row.status || "Pending").toLowerCase() === "pending";

    return statusOrder === "pending"
      ? isPending ? 0 : 1
      : isPending ? 1 : 0;
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
      [row.user.name, row.user.phone].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(searchTerm),
      ),
    );
  }, [rows, searchTerm, nameOrder, statusOrder]);
  return {
    rows,
    filteredRows,
    paid,
    total,
    totalDue,
    totalBill,
  };
}
