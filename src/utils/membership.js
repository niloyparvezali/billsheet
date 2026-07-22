const parseDateValue = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const toDateString = (value) => {
  const parsed = parseDateValue(value);
  return parsed ? parsed.toISOString().split("T")[0] : null;
};

const normalizeLifecycleState = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["active", "enabled", "open", "alive"].includes(normalized)) return "active";
  if (["inactive", "disabled", "closed", "deactivated", "deactive", "archived"].includes(normalized)) return "inactive";
  return null;
};

const normalizeMembershipPeriod = (period = {}) => {
  const joinDate = toDateString(period?.joinDate || period?.joinedAt || period?.startDate || period?.start || period?.from || null);
  const leaveDate = toDateString(period?.leaveDate || period?.leftAt || period?.endDate || period?.end || period?.to || null);
  if (!joinDate) return null;

  const joinValue = new Date(joinDate);
  const leaveValue = leaveDate ? new Date(leaveDate) : null;
  if (leaveValue && !Number.isNaN(leaveValue.getTime()) && leaveValue < joinValue) {
    return null;
  }

  return {
    joinDate,
    leaveDate: leaveDate || null,
  };
};

const collectLifecycleEvents = (user = {}) => {
  const events = [];
  const addEvent = (date, status) => {
    const parsedDate = parseDateValue(date);
    if (!parsedDate || !status) return;
    events.push({ date: parsedDate, status });
  };

  const membershipHistory = Array.isArray(user?.membershipHistory) ? user.membershipHistory : [];
  if (membershipHistory.length > 0) {
    membershipHistory.forEach((period) => {
      addEvent(period?.joinDate, "active");
      addEvent(period?.leaveDate, "inactive");
    });
    return events.sort((left, right) => left.date.getTime() - right.date.getTime());
  }

  const statusHistory = Array.isArray(user?.statusHistory) ? user.statusHistory : [];
  statusHistory.forEach((entry) => {
    addEvent(entry?.date || entry?.timestamp || entry?.changedAt || entry?.createdAt || null, normalizeLifecycleState(entry?.status || entry?.value || entry?.type || ""));
  });

  addEvent(user?.joinDate || user?.joinedAt || user?.memberSince || null, "active");
  addEvent(user?.leaveDate || user?.inactiveDate || user?.archivedAt || user?.deactivatedAt || user?.inactiveAt || null, "inactive");

  return events.sort((left, right) => left.date.getTime() - right.date.getTime());
};

const buildPeriodsFromEvents = (events = []) => {
  const periods = [];
  let currentPeriod = null;

  events.forEach((event) => {
    if (event.status === "active") {
      if (!currentPeriod) {
        currentPeriod = {
          joinDate: toDateString(event.date),
          leaveDate: null,
        };
        return;
      }

      const currentJoin = parseDateValue(currentPeriod.joinDate);
      if (currentJoin && event.date < currentJoin) {
        currentPeriod.joinDate = toDateString(event.date);
      }
      return;
    }

    if (event.status === "inactive" && currentPeriod) {
      const currentJoin = parseDateValue(currentPeriod.joinDate);
      if (currentJoin && event.date >= currentJoin) {
        currentPeriod.leaveDate = toDateString(event.date);
        periods.push(currentPeriod);
      }
      currentPeriod = null;
    }
  });

  if (currentPeriod) {
    periods.push(currentPeriod);
  }

  return periods
    .map(normalizeMembershipPeriod)
    .filter(Boolean)
    .sort((left, right) => {
      const leftJoin = parseDateValue(left.joinDate)?.getTime() || 0;
      const rightJoin = parseDateValue(right.joinDate)?.getTime() || 0;
      return leftJoin - rightJoin;
    });
};

export const getMembershipPeriods = (user = {}) => {
  const directPeriods = Array.isArray(user?.membershipHistory)
    ? user.membershipHistory.map(normalizeMembershipPeriod).filter(Boolean)
    : [];
  if (directPeriods.length > 0) {
    return directPeriods;
  }

  const events = collectLifecycleEvents(user);
  return buildPeriodsFromEvents(events);
};

export const isUserActiveForPeriod = (user, period = {}) => {
  if (!user) return false;

  const month = Number(period?.month || 0);
  const year = Number(period?.year || 0);
  if (!Number.isFinite(month) || !Number.isFinite(year) || month < 1 || month > 12) {
    return false;
  }

  const targetStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const targetEnd = new Date(year, month, 0, 23, 59, 59, 999);
  const periods = getMembershipPeriods(user);

  return periods.some((periodItem) => {
    const joinDate = parseDateValue(periodItem?.joinDate);
    if (!joinDate) return false;

    const leaveDate = parseDateValue(periodItem?.leaveDate);
    if (joinDate > targetEnd) return false;
    if (leaveDate && leaveDate < targetStart) return false;

    return true;
  });
};
