export default function StatsGrid({ children, className = "" }) {
  return <div className={`stats ${className}`.trim()}>{children}</div>;
}
