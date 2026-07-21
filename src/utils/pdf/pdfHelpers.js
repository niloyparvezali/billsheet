/**
 * Bill Sheet PDF Helper Functions
 */

/**
 * Format Report Generated Date
 */
export function formatReportDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/**
 * Get Status Color
 */
export function getStatusColor(theme, status = "") {
  switch (String(status).toLowerCase()) {
    case "paid":
      return theme.success;

    case "partial":
      return theme.warning;

    case "pending":
      return theme.warning;

    case "advance":
      return theme.info;

    case "due":
      return theme.danger;

    default:
      return theme.text;
  }
}

/**
 * Summary Builder
 */
export function buildSummary({
  totalUsers = 0,
  paidUsers = 0,
  pendingUsers = 0,
  totalBill = "",
  totalCollection = "",
  totalDue = "",
}) {
  return [
    ["Total Users", totalUsers],
    ["Paid Users", paidUsers],
    ["Pending Users", pendingUsers],
    ["Total Bill", totalBill],
    ["Collection", totalCollection],
    ["Total Due", totalDue],
  ];
}
export function pdfMoney(value = 0) {
  const amount = Number(value || 0);

  return `Tk ${amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
export function pdfBalance({ due = 0, carryForward = 0 }) {
  if (due > 0) {
    return `- Tk ${Number(due).toLocaleString("en-US")}`;
  }

  if (carryForward > 0) {
    return `+ Tk ${Number(carryForward).toLocaleString("en-US")}`;
  }

  return "Tk 0";
}
