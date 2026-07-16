import { useCallback, useMemo } from "react";
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
    () => users.filter((user) => user.active !== false),
    [users],
  );
  const activeUserIds = useMemo(
    () => new Set(activeUsers.map((user) => user.id)),
    [activeUsers],
  );
  const payments = useMemo(
    () =>
      allPayments.filter((payment) => {
        const isRemoved = Boolean(
          payment?.isDeleted || payment?.deletedAt || payment?.status === "removed",
        );
        return (
          !isRemoved &&
          Number(payment.month) === month &&
          Number(payment.year) === year
        );
      }),
    [allPayments, month, year],
  );
  const paymentsByUser = useMemo(() => {
    const map = new Map();
    allPayments.forEach((payment) => {
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
      return Number(previous?.due || 0) + bill * missedMonths;
    },
    [currentPeriod, paymentsByUser],
  );
  const rows = useMemo(() => {
    const paymentIndex = new Map();
    payments.forEach((payment) => {
      if (!payment.userId) return;
      const existing = paymentIndex.get(payment.userId) || [];
      existing.push(payment);
      paymentIndex.set(payment.userId, existing);
    });

    const currentUsers = activeUsers.map((user) => ({
      user,
      payments: paymentIndex.get(user.id) || [],
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
        payments: [payment],
      }));

    return [...currentUsers, ...archivedUsers]
      .sort((a, b) => a.user.name.localeCompare(b.user.name))
      .map(({ user, payments: userPayments }) => {
        const openingDue = dueFor(user);
        const currentPaid = (userPayments || []).reduce(
          (sum, payment) => sum + Number(payment.amount || 0),
          0,
        );
        const bill = Number(user.monthlyBill || 0);
        const due = Math.max(0, bill - currentPaid);
        return {
          user,
          payment: [...userPayments].sort((left, right) => {
            const leftTime = Number(left?.paymentDate?.seconds || left?.createdAt?.seconds || 0);
            const rightTime = Number(right?.paymentDate?.seconds || right?.createdAt?.seconds || 0);
            return rightTime - leftTime;
          })[0] || null,
          openingDue,
          currentPaid,
          due,
        };
      });
  }, [activeUsers, activeUserIds, payments, dueFor]);
  const paid = rows.filter((row) => Number(row.currentPaid || 0) > 0);
  const total = paid.reduce((sum, row) => sum + Number(row.currentPaid || 0), 0);
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
