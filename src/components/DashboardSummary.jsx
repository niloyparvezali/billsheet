import { useLanguage } from "../context/LanguageContext";

export default function DashboardSummary({
  totalCollection,
  averageCollection,
  highestMonth,
  lowestMonth,
}) {
  const { t, formatMoney, translateMonth } = useLanguage();

  return (
    <div className="dashboard-summary">
      <div className="summary-card">
        <small>💰 {t("total_collected")}</small>
        <h4>{formatMoney(totalCollection)}</h4>
      </div>

      <div className="summary-card">
        <small>📈 {t("average")} / {t("month")}</small>
        <h4>{formatMoney(averageCollection)}</h4>
      </div>

      <div className="summary-card">
        <small>🏆 {t("highest")} {t("month")}</small>
        <h4>{translateMonth(highestMonth.month)}</h4>
        <span>{formatMoney(highestMonth.collection)}</span>
      </div>

      <div className="summary-card">
        <small>📉 {t("lowest")} {t("month")}</small>
        <h4>{translateMonth(lowestMonth.month)}</h4>
        <span>{formatMoney(lowestMonth.collection)}</span>
      </div>
    </div>
  );
}

