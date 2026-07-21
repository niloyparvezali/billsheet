import { getDisplayPaymentStatus } from "../utils/payments";

export default function StatusBadge({
  status,
  className = "",
  compact = false,
  bill = 0,
  paid = 0,
  due = 0,
  advance = 0,
  month = null,
  currentMonth = null,
  currentDate = new Date(),
  isInactiveEntry = false,
}) {
  const resolved = getDisplayPaymentStatus({
    status,
    bill,
    paid,
    due,
    advance,
    month,
    currentMonth,
    currentDate,
    isInactiveEntry,
  });
  const shortLabel = compact ? resolved.label : resolved.label;

  return <span className={`status ${resolved.className} ${className}`.trim()}>{shortLabel}</span>;
}
