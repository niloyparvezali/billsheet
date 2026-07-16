import { ChevronRight } from "lucide-react";

export default function SettingsNavItem({ icon: Icon, label, description, active, onClick }) {
  return (
    <button type="button" className={`settings-v2-nav-item ${active ? "active" : ""}`} onClick={onClick}>
      <div className="settings-v2-nav-leading">
        <span className="settings-v2-nav-icon">
          <Icon size={16} />
        </span>
        <span className="settings-v2-nav-copy">
          <strong>{label}</strong>
          <small>{description}</small>
        </span>
      </div>
      <ChevronRight size={14} />
    </button>
  );
}
