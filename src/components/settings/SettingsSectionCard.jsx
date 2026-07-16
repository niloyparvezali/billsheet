export default function SettingsSectionCard({ title, description, children, tone = "default" }) {
  return (
    <section className={`settings-section-card ${tone === "danger" ? "danger" : ""}`}>
      <div className="settings-section-card-head">
        <div>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      <div className="settings-section-card-body">{children}</div>
    </section>
  );
}
