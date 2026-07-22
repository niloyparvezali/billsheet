import { getDisplayPaymentStatus } from "../utils/payments";
import { useLanguage } from "../context/LanguageContext";

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
  const { translateStatus } = useLanguage();
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

  const displayLabel = translateStatus(resolved.label);

  return <span className={`status ${resolved.className} ${className}`.trim()}>{displayLabel}</span>;
}

