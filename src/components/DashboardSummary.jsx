export default function DashboardSummary({
  totalCollection,
  averageCollection,
  highestMonth,
  lowestMonth,
  money,
}) {
  return (
    <div className="dashboard-summary">
      <div className="summary-card">
        <small>💰 Total Collection</small>
        <h4>{money(totalCollection)}</h4>
      </div>

      <div className="summary-card">
        <small>📈 Average / Month</small>
        <h4>{money(averageCollection)}</h4>
      </div>

      <div className="summary-card">
        <small>🏆 Highest Month</small>
        <h4>{highestMonth.month}</h4>
        <span>{money(highestMonth.collection)}</span>
      </div>

      <div className="summary-card">
        <small>📉 Lowest Month</small>
        <h4>{lowestMonth.month}</h4>
        <span>{money(lowestMonth.collection)}</span>
      </div>
    </div>
  );
}
