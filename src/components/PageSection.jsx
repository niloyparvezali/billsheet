export default function PageSection({
  title,
  subtitle,
  action,
  className = "",
  children,
}) {
  return (
    <section className={`panel ${className}`.trim()}>
      {(title || subtitle || action) && (
        <div className="section-header">
          <div className="section-title">
            {title && <h3>{title}</h3>}

            {subtitle && <p>{subtitle}</p>}
          </div>

          {action && <div className="section-action">{action}</div>}
        </div>
      )}

      {children}
    </section>
  );
}
