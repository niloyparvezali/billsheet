export default function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-title">
      <div>
        <h2>{title}</h2>

        {subtitle && <p>{subtitle}</p>}

        {children}
      </div>
    </div>
  );
}
