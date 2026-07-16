export default function DataTable({ children, className = "" }) {
  return (
    <div className={`table-wrap ${className}`.trim()}>
      <table>{children}</table>
    </div>
  );
}
