export const normalizePackages = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmedValue = value.trim();
    return trimmedValue ? [trimmedValue] : [];
  }
  return [];
};

export const getDisplayPackages = (user = {}) => {
  const fromPackages = normalizePackages(user?.packages);
  if (fromPackages.length > 0) return fromPackages;
  const fromCategory = String(user?.category || "").trim();
  return fromCategory ? [fromCategory] : [];
};

export const getPrimaryPackage = (user = {}) => {
  const packages = getDisplayPackages(user);
  return packages[0] || "";
};

export const normalizeBangladeshPhone = (value = "") => {
  const digits = String(value || "")
    .replace(/\D/g, "")
    .replace(/^880/, "")
    .replace(/^0/, "");
  if (!digits) return "";
  return `+880${digits}`;
};

export const isValidBangladeshPhone = (value = "") => {
  const normalized = normalizeBangladeshPhone(value);
  if (!normalized) return false;
  return /^\+8801[3-9]\d{8}$/.test(normalized);
};
