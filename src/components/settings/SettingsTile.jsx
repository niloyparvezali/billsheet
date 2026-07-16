import { ChevronRight } from "lucide-react";

export default function SettingsTile({ icon: Icon, title, description, onClick, disabled = false }) {
  return (
    <button type="button" className={`settings-tile${disabled ? " disabled" : ""}`} onClick={onClick} disabled={disabled}>
      <div className="settings-tile-icon">
        <Icon size={18} />
      </div>
      <div className="settings-tile-copy">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      <ChevronRight size={18} className="settings-tile-arrow" />
    </button>
  );
}
