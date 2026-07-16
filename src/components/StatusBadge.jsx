export default function StatusBadge({ status, className = "" }) {
  const value = String(status || "").toLowerCase();

  return (
    <span className={`status ${value} ${className}`.trim()}>● {status}</span>
  );
}
