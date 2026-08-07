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
      <div className="dashboard-summary-card dashboard-summary-card--highest">
        <div className="dashboard-summary-card-header">
          <div className="dashboard-summary-card-title">
            <span>🏆</span>
            <span>{t("highest")} {t("month")}</span>
          </div>
          <div className="dashboard-summary-card-month">
            {translateMonth(highestMonth.month).toUpperCase()}
          </div>
        </div>
        <div className="dashboard-summary-card-divider" />
        <div className="dashboard-summary-card-amount">
          {formatMoney(highestMonth.collection)}
        </div>
      </div>

      <div className="dashboard-summary-card dashboard-summary-card--lowest">
        <div className="dashboard-summary-card-header">
          <div className="dashboard-summary-card-title">
            <span>📉</span>
            <span>{t("lowest")} {t("month")}</span>
          </div>
          <div className="dashboard-summary-card-month">
            {translateMonth(lowestMonth.month).toUpperCase()}
          </div>
        </div>
        <div className="dashboard-summary-card-divider" />
        <div className="dashboard-summary-card-amount">
          {formatMoney(lowestMonth.collection)}
        </div>
      </div>
    </div>
  );
}

