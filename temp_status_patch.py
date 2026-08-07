from pathlib import Path
p = Path(r'e:\WebDEV\billsheet\src\styles\users.css')
text = p.read_text(encoding='utf-8')
needle = """.users-mobile-list {
  display: none;
}

.user-name {
  display: block;
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
}

.user-category {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--primary) 14%, transparent);
  color: var(--primary);
  font-size: 13px;
  font-weight: 600;
}

.user-package-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.package-search {
  width: 100%;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--input-border);
  background: var(--input-bg);
  color: var(--text);
}

.package-search::placeholder {
  color: var(--text-muted);
}
"""
replace = """.users-mobile-list {
  display: none;
}

.user-name {
  display: block;
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
}

.user-category {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--primary) 14%, transparent);
  color: var(--primary);
  font-size: 13px;
  font-weight: 600;
}

.user-package-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.user-status-cell {
  text-align: right;
}

.user-status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 30px;
  min-height: 30px;
  padding: 0 12px;
  gap: 8px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  border: 1px solid transparent;
  transition: background-color 200ms ease, color 200ms ease, border-color 200ms ease, transform 200ms ease;
  white-space: nowrap;
}

.user-status-pill::before {
  content: "";
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}

.user-status-pill.status-active {
  color: var(--status-paid-text);
  background: var(--status-paid-bg);
  border-color: var(--status-paid-text);
}

.user-status-pill.status-active::before {
  background: var(--status-paid-text);
}

.user-status-pill.status-inactive {
  color: var(--status-due-text);
  background: var(--status-due-bg);
  border-color: var(--status-due-text);
}

.user-status-pill.status-inactive::before {
  background: var(--status-due-text);
}

.package-search {
  width: 100%;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--input-border);
  background: var(--input-bg);
  color: var(--text);
}

.package-search::placeholder {
  color: var(--text-muted);
}
"""
count = text.count(needle)
if count != 1:
    raise SystemExit(f'Expected 1 exact match, found {count}')
text = text.replace(needle, replace)
p.write_text(text, encoding='utf-8')
print('patched')
