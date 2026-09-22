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

  if (!periods.length) {
    const explicitActiveState = normalizeLifecycleState(user?.active);
    const explicitActive =
      user?.active === true ||
      explicitActiveState === "active" ||
      user?.active === undefined;
    const joinDate = parseDateValue(
      user?.joinDate || user?.joinedAt || user?.memberSince || null,
    );
    const leaveDate = parseDateValue(
      user?.inactiveDate || user?.leaveDate || user?.archivedAt || user?.deactivatedAt || user?.inactiveAt || null,
    );

    if (joinDate && joinDate > targetEnd) {
      return false;
    }
    if (leaveDate && leaveDate <= targetEnd) {
      return false;
    }
    if (joinDate) {
      return joinDate <= targetEnd;
    }

    return explicitActive;
  }

  return periods.some((periodItem) => {
    const joinDate = parseDateValue(periodItem?.joinDate);
    if (!joinDate) return false;

    const leaveDate = parseDateValue(periodItem?.leaveDate);
    if (joinDate > targetEnd) return false;
    if (leaveDate && leaveDate < targetStart) return false;
    if (leaveDate && leaveDate <= targetEnd) return false;

    return true;
  });
};


const isUserCurrentlyActive = (user = {}) => {
  const explicitStatus = normalizeLifecycleState(user?.status);
  if (explicitStatus) return explicitStatus === "active";
  if (typeof user?.active === "boolean") return user.active;
  const periods = getMembershipPeriods(user);
  const latest = periods[periods.length - 1];
  return Boolean(latest && !latest.leaveDate);
};

const sortAndDeduplicateMembershipPeriods = (periods = []) => {
  const normalized = (periods || [])
    .map(normalizeMembershipPeriod)
    .filter(Boolean)
    .sort((left, right) => {
      const leftTime = parseDateValue(left.joinDate)?.getTime() || 0;
      const rightTime = parseDateValue(right.joinDate)?.getTime() || 0;
      return leftTime - rightTime;
    });

  const result = [];
  normalized.forEach((period) => {
    const previous = result[result.length - 1];
    if (
      previous &&
      previous.joinDate === period.joinDate &&
      previous.leaveDate === period.leaveDate
    ) {
      return;
    }
    result.push(period);
  });
  return result;
};

/**
 * Preserve a user's identity while recording each distinct membership period.
 *
 * This is intentionally additive: historical periods are never overwritten.
 * The returned values are plain ISO date strings so they can safely live in a
 * Firestore array and remain deterministic across later edits.
 */
export const buildUpdatedMembershipHistory = ({
  user = null,
  nextStatus = "Active",
  joinDate = null,
  now = new Date(),
} = {}) => {
  const safeNow =
    now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  const nextLifecycle = normalizeLifecycleState(nextStatus) || "active";
  const wasActive = isUserCurrentlyActive(user || {});
  const periods = getMembershipPeriods(user || {});
  const requestedJoinDate = toDateString(joinDate);

  if (!user?.id && periods.length === 0) {
    const initialJoinDate = requestedJoinDate || toDateString(safeNow);
    return [
      {
        joinDate: initialJoinDate,
        leaveDate:
          nextLifecycle === "active" ? null : toDateString(safeNow),
      },
    ];
  }

  const nextPeriods = periods.map((period) => ({ ...period }));

  if (nextPeriods.length === 0) {
    const fallbackJoinDate =
      requestedJoinDate ||
      toDateString(
        user?.joinDate ||
          user?.joinedAt ||
          user?.memberSince ||
          safeNow,
      );

    nextPeriods.push({
      joinDate: fallbackJoinDate,
      leaveDate: null,
    });
  }

  const latestIndex = nextPeriods.length - 1;
  const latest = nextPeriods[latestIndex];

  if (wasActive && nextLifecycle === "inactive") {
    // Close the current open period. Never replace an already closed period.
    if (!latest.leaveDate) {
      latest.leaveDate = toDateString(safeNow);
    } else {
      nextPeriods.push({
        joinDate:
          requestedJoinDate ||
          toDateString(
            user?.joinDate ||
              user?.joinedAt ||
              user?.memberSince ||
              safeNow,
          ),
        leaveDate: toDateString(safeNow),
      });
    }
  } else if (!wasActive && nextLifecycle === "active") {
    // Rejoin creates a brand-new period while keeping all prior periods intact.
    const lastLeave = parseDateValue(latest.leaveDate);
    let effectiveJoinDate = parseDateValue(requestedJoinDate);

    if (
      !effectiveJoinDate ||
      (lastLeave && effectiveJoinDate < lastLeave)
    ) {
      effectiveJoinDate = safeNow;
    }

    const normalizedJoin = toDateString(effectiveJoinDate);
    const openAlreadyExists =
      !latest.leaveDate &&
      latest.joinDate === normalizedJoin;

    if (!openAlreadyExists) {
      nextPeriods.push({
        joinDate: normalizedJoin,
        leaveDate: null,
      });
    }
  } else if (nextLifecycle === "active") {
    // Normal edits to an active user may still correct the current period's
    // join date, preserving all completed historical periods.
    const currentJoin = parseDateValue(requestedJoinDate);
    const lastClosedLeave = parseDateValue(latest.leaveDate);
    if (
      currentJoin &&
      !latest.leaveDate &&
      (!lastClosedLeave || currentJoin >= lastClosedLeave)
    ) {
      latest.joinDate = toDateString(currentJoin);
    }
  }

  return sortAndDeduplicateMembershipPeriods(nextPeriods);
};
