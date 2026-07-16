export default function SummaryCard({
  color = "blue",
  label,
  value,
  icon,
  subtitle,
  onClick,
  className = "",
}) {
  return (
    <div
      className={`stat ${color} ${className}`.trim()}
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      <div>
        <p>{label}</p>

        <h2>{value}</h2>

        {subtitle && <small className="summary-subtitle">{subtitle}</small>}
      </div>

      {icon && <span>{icon}</span>}
    </div>
  );
}
