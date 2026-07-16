import { AnimatePresence, motion } from "framer-motion";
import { Check, Download, RefreshCw, ShieldCheck, Sparkles, UploadCloud } from "lucide-react";

export function SettingsCard({ icon: Icon, title, description, children, action, badge }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="settings-v2-card"
    >
      <div className="settings-v2-card-head">
        <div className="settings-v2-card-icon">
          <Icon size={16} />
        </div>
        <div className="settings-v2-card-copy">
          <div className="settings-v2-card-title-row">
            <h3>{title}</h3>
            {badge ? <span className="settings-v2-badge">{badge}</span> : null}
          </div>
          <p>{description}</p>
        </div>
      </div>
      <div className="settings-v2-card-body">{children}</div>
      {action ? <div className="settings-v2-card-actions">{action}</div> : null}
    </motion.article>
  );
}

export function ToggleControl({ label, description, active, onToggle }) {
  return (
    <label className="settings-v2-row">
      <div>
        <strong>{label}</strong>
        <span>{description}</span>
      </div>
      <button type="button" className={`settings-v2-toggle ${active ? "on" : ""}`} onClick={() => onToggle(!active)}>
        <span />
      </button>
    </label>
  );
}

export function SegmentedControl({ value, options, onChange }) {
  return (
    <div className="settings-v2-segmented">
      {options.map((option) => (
        <button key={option} type="button" className={`settings-v2-segment ${value === option ? "active" : ""}`} onClick={() => onChange(option)}>
          {option}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="settings-v2-field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function EmptyState({ title, description, icon: Icon }) {
  return (
    <div className="settings-v2-empty">
      <div className="settings-v2-empty-icon">
        <Icon size={18} />
      </div>
      <h4>{title}</h4>
      <p>{description}</p>
    </div>
  );
}

export function SectionAnimator({ children, keyValue }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div key={keyValue} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.22, ease: "easeOut" }}>
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export function SectionSkeleton() {
  return (
    <div className="settings-v2-skeleton-grid">
      <div className="settings-v2-skeleton-card large" />
      <div className="settings-v2-skeleton-card" />
      <div className="settings-v2-skeleton-card" />
    </div>
  );
}

export function QuickActionGrid({ children, title }) {
  return (
    <div className="settings-v2-inline-grid">
      <div className="settings-v2-inline-title">{title}</div>
      <div className="settings-v2-pill-row">{children}</div>
    </div>
  );
}

export function ChecklistItem({ icon: Icon, title, subtitle }) {
  return (
    <div className="settings-v2-checklist-item">
      <div className="settings-v2-check-icon">
        <Check size={14} />
      </div>
      <div>
        <strong>{title}</strong>
        <p>{subtitle}</p>
      </div>
      {Icon ? <span className="settings-v2-check-action"><Icon size={14} /></span> : null}
    </div>
  );
}

export function BackupActions() {
  return (
    <div className="settings-v2-action-row">
      <button type="button" className="settings-v2-btn secondary"><Download size={15} /> Export</button>
      <button type="button" className="settings-v2-btn secondary"><UploadCloud size={15} /> Import</button>
      <button type="button" className="settings-v2-btn primary"><RefreshCw size={15} /> Restore</button>
    </div>
  );
}

export function SecurityScore() {
  return (
    <div className="settings-v2-score-card">
      <div>
        <div className="settings-v2-score-label">Security score</div>
        <div className="settings-v2-score-value">94 / 100</div>
        <p>Protected by passcode, threat review, and active device verification.</p>
      </div>
      <div className="settings-v2-score-ring">
        <ShieldCheck size={20} />
        <span>94</span>
      </div>
    </div>
  );
}

export function FeatureBanner() {
  return (
    <div className="settings-v2-banner">
      <div>
        <div className="settings-v2-banner-tag"><Sparkles size={14} /> New</div>
        <h4>Workspace intelligence</h4>
        <p>Adaptive recommendations are now enabled across your team.</p>
      </div>
      <button type="button" className="settings-v2-btn primary">Review</button>
    </div>
  );
}
