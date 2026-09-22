import {
  FiArrowLeft,
  FiCalendar,
  FiChevronDown,
  FiChevronRight,
  FiClock,
  FiCreditCard,
  FiDollarSign,
  FiEdit2,
  FiFileText,
  FiPhone,
  FiRefreshCw,
  FiTag,
  FiTrash2,
  FiTrendingDown,
  FiTrendingUp,
  FiUser,
} from "react-icons/fi";
import { useEffect, useMemo, useState } from "react";
import { formatDate, money } from "../utils/date";
import { getDisplayPackages } from "../utils/users";
import { useLanguage } from "../context/LanguageContext";
import { getMembershipPeriods } from "../utils/membership";
import { buildUserFinancialHistory, buildUserFinancialStatement } from "../utils/userHistory";
import { exportUserProfilePdf } from "../utils/pdf";
import toast from "react-hot-toast";

const formatPeriod = (period, index) => {
  const joined = formatDate(period?.joinDate, "Not available");
  const left = period?.leaveDate ? formatDate(period.leaveDate) : "Currently active";
  return {
    title: `Membership #${index + 1}`,
    joined,
    left,
  };
};

const moneySigned = (value) => {
  const numeric = Number(value || 0);
  if (numeric > 0) return `+${money(numeric)}`;
  if (numeric < 0) return `-${money(Math.abs(numeric))}`;
  return money(0);
};

function SummaryCard({ icon, label, value, tone = "neutral", detail = "" }) {
  return (
    <div className={`user-profile-summary-card tone-${tone}`}>
      <div className="user-profile-summary-icon">{icon}</div>
      <div className="user-profile-summary-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        {detail ? <small>{detail}</small> : null}
      </div>
    </div>
  );
}

function BillingRow({ row, formatMoney }) {
  const balanceLabel =
    row.currentDue > 0
      ? `Due ${formatMoney(row.currentDue)}`
      : row.currentAdvance > 0
        ? `Advance ${formatMoney(row.currentAdvance)}`
        : "Settled";

  return (
    <article className="user-profile-billing-row">
      <div className="user-profile-row-heading">
        <div>
          <strong>{row.periodLabel}</strong>
          <span>Membership #{row.membershipIndex + 1}</span>
        </div>
        <span className={`user-profile-status-pill status-${String(row.status || "pending").toLowerCase()}`}>
          {row.status || "Pending"}
        </span>
      </div>
      <div className="user-profile-financial-grid">
        <div>
          <span>Previous Due</span>
          <strong>{formatMoney(row.previousDue)}</strong>
        </div>
        <div>
          <span>Previous Advance</span>
          <strong>{formatMoney(row.previousAdvance)}</strong>
        </div>
        <div>
          <span>Current Bill</span>
          <strong>{formatMoney(row.bill)}</strong>
        </div>
        <div>
          <span>Additional Due</span>
          <strong>{formatMoney(row.additionalDue)}</strong>
        </div>
        <div>
          <span>Paid</span>
          <strong>{formatMoney(row.paid)}</strong>
        </div>
        <div className="user-profile-financial-grid-highlight">
          <span>Closing Balance</span>
          <strong>{balanceLabel}</strong>
        </div>
      </div>
    </article>
  );
}

function PaymentRow({ payment, formatMoney }) {
  const paymentDate = payment.displayDate || payment.paymentDate || payment.createdAt;
  const periodLabel =
    payment.month && payment.year
      ? new Date(payment.year, payment.month - 1, 1).toLocaleString("en-US", {
          month: "short",
          year: "numeric",
        })
      : "Period unavailable";
  const paymentSnapshotDue = Number(payment.currentDue ?? 0);
  const paymentSnapshotAdvance = Number(payment.currentAdvance ?? 0);
  const hasPaymentSnapshot =
    Object.prototype.hasOwnProperty.call(payment, "currentDue") ||
    Object.prototype.hasOwnProperty.call(payment, "currentAdvance");

  const paymentIsVoided = !["", "paid", "advance", "partial", "pending", "due"].includes(
    String(payment.status || "").trim().toLowerCase(),
  );

  return (
    <article className={`user-profile-payment-row${paymentIsVoided ? " user-profile-payment-row--voided" : ""}`}>
      <div className="user-profile-payment-icon">
        <FiCreditCard />
      </div>
      <div className="user-profile-payment-copy">
        <strong>{formatMoney(payment.amount)}</strong>
        <span>
          {formatDate(paymentDate)} · {periodLabel}
        </span>
        <small>
          {[
            payment.paymentType || "Payment",
            Number(payment.monthlyBill || payment.billAmount || payment.bill || 0) > 0
              ? `Bill ${formatMoney(payment.monthlyBill || payment.billAmount || payment.bill)}`
              : "",
            payment.notes || payment.reason || "",
            payment.transactionId ? `Txn ${payment.transactionId}` : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </small>
      </div>
      {(payment.additionalDue > 0 || hasPaymentSnapshot) ? (
        <div className="user-profile-payment-extra">
          {payment.additionalDue > 0 ? (
            <>
              <span>Additional due</span>
              <strong>{formatMoney(payment.additionalDue)}</strong>
            </>
          ) : null}
          {hasPaymentSnapshot ? (
            <>
              <span>Balance after</span>
              <strong
                className={
                  paymentSnapshotDue > 0
                    ? "tone-due"
                    : paymentSnapshotAdvance > 0
                      ? "tone-advance"
                      : "tone-settled"
                }
              >
                {paymentSnapshotDue > 0
                  ? `Due ${formatMoney(paymentSnapshotDue)}`
                  : paymentSnapshotAdvance > 0
                    ? `Advance ${formatMoney(paymentSnapshotAdvance)}`
                    : formatMoney(0)}
              </strong>
            </>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}


function ProfileSectionButton({ icon, label, count, active, onClick }) {
  const tabId = `user-profile-tab-${label.toLowerCase().replace(/\s+/g, "-")}`;
  const panelId = `user-profile-panel-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <button
      type="button"
      id={tabId}
      className={`user-profile-mobile-tab${active ? " active" : ""}`}
      onClick={onClick}
      aria-selected={active}
      aria-controls={panelId}
      role="tab"
      tabIndex={active ? 0 : -1}
    >
      {icon}
      <span>{label}</span>
      {count > 0 ? <small>{count}</small> : null}
    </button>
  );
}

function MobileHistoryPanel({
  title,
  subtitle,
  records,
  initialCount,
  pageSize,
  emptyText,
  renderRecord,
  onClose,
}) {
  const [visibleCount, setVisibleCount] = useState(
    Math.min(initialCount, records.length),
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const visibleRecords = records.slice(0, visibleCount);
  const hasMore = visibleCount < records.length;

  return (
    <div
      className="user-profile-mobile-history-panel"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="user-profile-mobile-history-header">
        <button
          type="button"
          className="user-profile-mobile-history-back"
          onClick={onClose}
          aria-label="Back to customer profile"
          title="Back"
        >
          <FiArrowLeft />
        </button>
        <div>
          <span className="user-profile-kicker">HISTORY</span>
          <h3>{title}</h3>
          <small>{subtitle}</small>
        </div>
      </div>

      <div className="user-profile-mobile-history-meta">
        <span>
          Showing <strong>{visibleRecords.length}</strong> of{" "}
          <strong>{records.length}</strong>
        </span>
        {hasMore ? <span>Scroll for more</span> : <span>Complete history</span>}
      </div>

      <div className="user-profile-mobile-history-list">
        {visibleRecords.map((record, index) => (
          <div key={record?._historyId || record?.id || `${title}-${index}`}>
            {renderRecord(record, index)}
          </div>
        ))}
        {!records.length ? (
          <div className="user-profile-empty">{emptyText}</div>
        ) : null}
      </div>

      {hasMore ? (
        <button
          type="button"
          className="user-profile-mobile-load-more"
          onClick={() =>
            setVisibleCount((count) =>
              Math.min(count + pageSize, records.length),
            )
          }
        >
          Load more
          <span>
            {Math.min(visibleCount + pageSize, records.length)} of{" "}
            {records.length}
          </span>
          <FiChevronDown />
        </button>
      ) : null}
    </div>
  );
}

function MobileCalculationDetails({ row, formatMoney }) {
  if (!row) {
    return (
      <div className="user-profile-empty">
        No financial calculation is available yet.
      </div>
    );
  }

  const openingBalance =
    Number(row.previousAdvance || 0) - Number(row.previousDue || 0);
  const endingBalance =
    openingBalance +
    Number(row.paid || 0) -
    Number(row.bill || 0) -
    Number(row.additionalDue || 0);

  return (
    <div className="user-profile-mobile-calculation-details">
      <div>
        <span>Previous Due</span>
        <strong>{formatMoney(row.previousDue)}</strong>
      </div>
      <div>
        <span>Previous Advance</span>
        <strong>{formatMoney(row.previousAdvance)}</strong>
      </div>
      <div>
        <span>Current Month Bill</span>
        <strong>{formatMoney(row.bill)}</strong>
      </div>
      <div>
        <span>Additional Due</span>
        <strong>{formatMoney(row.additionalDue)}</strong>
      </div>
      <div className="is-payment">
        <span>Payment</span>
        <strong>{formatMoney(row.paid)}</strong>
      </div>
      <div className="equation">
        <span>Opening balance</span>
        <strong>{moneySigned(openingBalance)}</strong>
        <span>+ Payment − Bill − Additional Due</span>
        <strong>{moneySigned(endingBalance)}</strong>
      </div>
      <div className="result">
        <span>Closing Balance</span>
        <strong
          className={`tone-${
            row.currentDue > 0
              ? "due"
              : row.currentAdvance > 0
                ? "advance"
                : "settled"
          }`}
        >
          {row.currentDue > 0
            ? `Due ${formatMoney(row.currentDue)}`
            : row.currentAdvance > 0
              ? `Advance ${formatMoney(row.currentAdvance)}`
              : formatMoney(0)}
        </strong>
      </div>
    </div>
  );
}

function MobileCalculationHistory({ rows, formatMoney }) {
  const [expandedId, setExpandedId] = useState(rows[0]?.id || null);
  const [visibleCount, setVisibleCount] = useState(Math.min(5, rows.length));

  useEffect(() => {
    if (rows.length && !rows.some((row) => row.id === expandedId)) {
      setExpandedId(rows[0].id);
    }
  }, [rows, expandedId]);

  if (!rows.length) {
    return (
      <div className="user-profile-empty">
        No financial calculation history is available yet.
      </div>
    );
  }

  const visibleRows = rows.slice(0, visibleCount);

  return (
    <div className="user-profile-mobile-calculation-history">
      {visibleRows.map((row) => {
        const expanded = expandedId === row.id;
        return (
          <div
            className={`user-profile-mobile-calc-item${
              expanded ? " expanded" : ""
            }`}
            key={row.id}
          >
            <button
              type="button"
              className="user-profile-mobile-calc-toggle"
              onClick={() =>
                setExpandedId((current) => (current === row.id ? null : row.id))
              }
              aria-expanded={expanded}
            >
              <span>
                <strong>{row.periodLabel}</strong>
                <small>
                  Membership #{row.membershipIndex + 1} ·{" "}
                  {row.currentDue > 0
                    ? `Due ${formatMoney(row.currentDue)}`
                    : row.currentAdvance > 0
                      ? `Advance ${formatMoney(row.currentAdvance)}`
                      : "Settled"}
                </small>
              </span>
              <FiChevronDown />
            </button>
            {expanded ? (
              <MobileCalculationDetails row={row} formatMoney={formatMoney} />
            ) : null}
          </div>
        );
      })}
      {visibleCount < rows.length ? (
        <button
          type="button"
          className="user-profile-mobile-load-more"
          onClick={() =>
            setVisibleCount((count) => Math.min(count + 5, rows.length))
          }
        >
          Load more
          <span>{Math.min(visibleCount + 5, rows.length)} of {rows.length}</span>
          <FiChevronDown />
        </button>
      ) : null}
    </div>
  );
}

function MobileUserProfile({
  user,
  financialHistory,
  memberships,
  membershipSummaries,
  latestBillingRow,
  currentDue,
  currentAdvance,
  currentBalance,
  currentBalanceTone,
  currentBalanceDetail,
  status,
  packages,
  onBack,
  onEdit,
  onAddPayment,
  onPaymentHistory,
  onDelete,
  onExportProfilePdf,
  isExportingPdf,
  formatMoney,
  t,
}) {
  const [activeSection, setActiveSection] = useState("overview");
  const [historyView, setHistoryView] = useState(null);
  const [showOverviewCalculation, setShowOverviewCalculation] = useState(false);

  const recentMemberships = membershipSummaries.slice(0, 3);
  const recentBilling = financialHistory.billingHistory.slice(0, 3);
  const recentPayments = financialHistory.paymentHistory.slice(0, 3);
  const recentActivity = financialHistory.timeline.slice(0, 5);

  const navItems = [
    {
      id: "overview",
      label: "Overview",
      icon: <FiUser />,
      count: 0,
    },
    {
      id: "membership",
      label: "Membership",
      icon: <FiRefreshCw />,
      count: memberships.length,
    },
    {
      id: "billing",
      label: "Billing",
      icon: <FiFileText />,
      count: financialHistory.billingHistory.length,
    },
    {
      id: "payments",
      label: "Payments",
      icon: <FiCreditCard />,
      count: financialHistory.paymentHistory.length,
    },
    {
      id: "activity",
      label: "Activity",
      icon: <FiClock />,
      count: financialHistory.timeline.length,
    },
  ];

  const activityIcon = (event) => {
    if (event.type === "joined") return <FiUser />;
    if (event.type === "left") return <FiArrowLeft />;
    if (event.type === "payment") return <FiCreditCard />;
    return <FiDollarSign />;
  };

  const openHistory = (type) => setHistoryView(type);

  const renderHistoryPanel = () => {
    if (historyView === "membership") {
      return (
        <MobileHistoryPanel
          title="Membership History"
          subtitle={`${memberships.length} membership period${
            memberships.length === 1 ? "" : "s"
          }`}
          records={membershipSummaries}
          initialCount={6}
          pageSize={6}
          emptyText="No membership period has been recorded yet."
          onClose={() => setHistoryView(null)}
          renderRecord={(membership) => (
            <article className="user-profile-membership-card">
              <div className="user-profile-membership-number">
                <span>#{membership.index + 1}</span>
                {membership.index === memberships.length - 1 &&
                !memberships[membership.index]?.leaveDate ? (
                  <span className="user-profile-current-chip">Current</span>
                ) : null}
              </div>
              <div className="user-profile-membership-copy">
                <strong>
                  {membership.joined} → {membership.left}
                </strong>
                <span>
                  {membership.rows.length} billing months · Billed{" "}
                  {formatMoney(membership.billed)} · Paid{" "}
                  {formatMoney(membership.paid)}
                </span>
              </div>
              <div className="user-profile-membership-balance">
                {membership.closingDue > 0 ? (
                  <strong className="tone-due">
                    Due {formatMoney(membership.closingDue)}
                  </strong>
                ) : membership.closingAdvance > 0 ? (
                  <strong className="tone-advance">
                    Advance {formatMoney(membership.closingAdvance)}
                  </strong>
                ) : (
                  <strong className="tone-settled">Settled</strong>
                )}
              </div>
            </article>
          )}
        />
      );
    }

    if (historyView === "billing") {
      return (
        <MobileHistoryPanel
          title="Complete Billing History"
          subtitle={`${financialHistory.billingHistory.length} billing record${
            financialHistory.billingHistory.length === 1 ? "" : "s"
          }`}
          records={financialHistory.billingHistory}
          initialCount={10}
          pageSize={10}
          emptyText="No billing records found for this user."
          onClose={() => setHistoryView(null)}
          renderRecord={(row) => (
            <BillingRow row={row} formatMoney={formatMoney} />
          )}
        />
      );
    }

    if (historyView === "payments") {
      return (
        <MobileHistoryPanel
          title="Complete Payment History"
          subtitle={`${financialHistory.paymentHistory.length} payment${
            financialHistory.paymentHistory.length === 1 ? "" : "s"
          }`}
          records={financialHistory.paymentHistory}
          initialCount={10}
          pageSize={10}
          emptyText="No payment records found for this user."
          onClose={() => setHistoryView(null)}
          renderRecord={(payment) => (
            <PaymentRow payment={payment} formatMoney={formatMoney} />
          )}
        />
      );
    }

    if (historyView === "calculations") {
      return (
        <div
          className="user-profile-mobile-history-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Financial Calculation History"
        >
          <div className="user-profile-mobile-history-header">
            <button
              type="button"
              className="user-profile-mobile-history-back"
              onClick={() => setHistoryView(null)}
              aria-label="Back to customer profile"
              title="Back"
            >
              <FiArrowLeft />
            </button>
            <div>
              <span className="user-profile-kicker">HISTORY</span>
              <h3>Financial Calculation History</h3>
              <small>
                {financialHistory.billingHistory.length} calculation{" "}
                {financialHistory.billingHistory.length === 1
                  ? "record"
                  : "records"}
              </small>
            </div>
          </div>
          <div className="user-profile-mobile-history-meta">
            <span>Latest period opens first</span>
            <span>One detail at a time</span>
          </div>
          <div className="user-profile-mobile-history-list">
            <MobileCalculationHistory
              rows={financialHistory.billingHistory}
              formatMoney={formatMoney}
            />
          </div>
        </div>
      );
    }

    if (historyView === "activity") {
      return (
        <MobileHistoryPanel
          title="Complete Activity History"
          subtitle={`${financialHistory.timeline.length} event${
            financialHistory.timeline.length === 1 ? "" : "s"
          }`}
          records={financialHistory.timeline}
          initialCount={10}
          pageSize={10}
          emptyText="No timeline events are available yet."
          onClose={() => setHistoryView(null)}
          renderRecord={(event) => (
            <div className={`user-profile-timeline-item type-${event.type}`}>
              <div className="user-profile-timeline-icon">
                {activityIcon(event)}
              </div>
              <div className="user-profile-timeline-copy">
                <strong>{event.title}</strong>
                <span>
                  {formatDate(event.date)}
                  {event.membershipIndex != null
                    ? ` · Membership #${event.membershipIndex + 1}`
                    : ""}
                </span>
                <small>{event.description}</small>
              </div>
            </div>
          )}
        />
      );
    }

    return null;
  };

  if (historyView) {
    return (
      <>
        <div className="users-profile users-profile--mobile-compact">
          {renderHistoryPanel()}
        </div>
      </>
    );
  }

  const renderOverview = () => (
    <>
      <section className="user-profile-mobile-card user-profile-mobile-current">
        <div className="user-profile-mobile-card-heading">
          <span className="user-profile-kicker">CURRENT MEMBERSHIP</span>
          {memberships.length > 1 ? (
            <span>{memberships.length} total periods</span>
          ) : null}
        </div>
        <div className="user-profile-mobile-current-line">
          <strong>
            {latestBillingRow?.periodLabel || "Current billing period"}
          </strong>
          <span>
            {memberships.at(-1)
              ? `${formatDate(memberships.at(-1).joinDate)} → ${
                  memberships.at(-1).leaveDate
                    ? formatDate(memberships.at(-1).leaveDate)
                    : "Active"
                }`
              : "Membership date not available"}
          </span>
        </div>
        <button
          type="button"
          className="user-profile-mobile-inline-link"
          onClick={() => setActiveSection("membership")}
        >
          View membership history
          <FiChevronRight />
        </button>
      </section>

      <section className="user-profile-mobile-card">
        <div className="user-profile-mobile-card-heading">
          <span className="user-profile-kicker">RECENT ACTIVITY</span>
          <span>{financialHistory.timeline.length} events</span>
        </div>
        <div className="user-profile-mobile-recent-list user-profile-mobile-recent-timeline">
          {recentActivity.map((event) => (
            <div
              className={`user-profile-mobile-recent-item type-${event.type}`}
              key={event.id}
            >
              <div className="user-profile-mobile-recent-icon">
                {activityIcon(event)}
              </div>
              <div>
                <strong>{event.title}</strong>
                <span>{formatDate(event.date)}</span>
              </div>
            </div>
          ))}
          {!recentActivity.length ? (
            <div className="user-profile-empty">No activity yet.</div>
          ) : null}
        </div>
        {financialHistory.timeline.length > recentActivity.length ? (
          <button
            type="button"
            className="user-profile-mobile-view-all"
            onClick={() => openHistory("activity")}
          >
            View all activity
            <FiChevronRight />
          </button>
        ) : null}
      </section>

      <section className="user-profile-mobile-card user-profile-mobile-calculation-card">
        <div className="user-profile-mobile-card-heading">
          <span className="user-profile-kicker">LATEST CALCULATION</span>
          <span>{latestBillingRow?.periodLabel || "Latest period"}</span>
        </div>
        <div className="user-profile-mobile-calc-summary">
          <strong>
            {latestBillingRow?.currentDue > 0
              ? `Due ${formatMoney(latestBillingRow.currentDue)}`
              : latestBillingRow?.currentAdvance > 0
                ? `Advance ${formatMoney(latestBillingRow.currentAdvance)}`
                : formatMoney(0)}
          </strong>
          <span>
            Bill {formatMoney(latestBillingRow?.bill || 0)} · Paid{" "}
            {formatMoney(latestBillingRow?.paid || 0)}
          </span>
        </div>
        <button
          type="button"
          className="user-profile-mobile-view-all"
          onClick={() => setShowOverviewCalculation((open) => !open)}
          aria-expanded={showOverviewCalculation}
        >
          {showOverviewCalculation ? "Hide calculation details" : "View calculation details"}
          <FiChevronDown
            className={
              showOverviewCalculation ? "user-profile-chevron-open" : ""
            }
          />
        </button>
        {showOverviewCalculation ? (
          <MobileCalculationDetails
            row={latestBillingRow}
            formatMoney={formatMoney}
          />
        ) : null}
        {financialHistory.billingHistory.length > 1 ? (
          <button
            type="button"
            className="user-profile-mobile-inline-link"
            onClick={() => openHistory("calculations")}
          >
            View calculation history
            <FiChevronRight />
          </button>
        ) : null}
      </section>
    </>
  );

  const renderMembership = () => (
    <section className="user-profile-mobile-card">
      <div className="user-profile-mobile-card-heading">
        <div>
          <span className="user-profile-kicker">MEMBERSHIP</span>
          <h3>Membership History</h3>
        </div>
        <span>{memberships.length} periods</span>
      </div>
      <div className="user-profile-mobile-record-list">
        {recentMemberships.map((membership) => (
          <article className="user-profile-membership-card" key={`${membership.index}-${membership.joined}`}>
            <div className="user-profile-membership-number">
              <span>#{membership.index + 1}</span>
              {membership.index === memberships.length - 1 &&
              !memberships[membership.index]?.leaveDate ? (
                <span className="user-profile-current-chip">Current</span>
              ) : null}
            </div>
            <div className="user-profile-membership-copy">
              <strong>
                {membership.joined} → {membership.left}
              </strong>
              <span>
                {membership.rows.length} billing months · Billed{" "}
                {formatMoney(membership.billed)} · Paid{" "}
                {formatMoney(membership.paid)}
              </span>
            </div>
            <div className="user-profile-membership-balance">
              {membership.closingDue > 0 ? (
                <strong className="tone-due">
                  Due {formatMoney(membership.closingDue)}
                </strong>
              ) : membership.closingAdvance > 0 ? (
                <strong className="tone-advance">
                  Advance {formatMoney(membership.closingAdvance)}
                </strong>
              ) : (
                <strong className="tone-settled">Settled</strong>
              )}
            </div>
          </article>
        ))}
      </div>
      {memberships.length > recentMemberships.length ? (
        <button
          type="button"
          className="user-profile-mobile-view-all"
          onClick={() => openHistory("membership")}
        >
          View all membership periods
          <FiChevronRight />
        </button>
      ) : null}
    </section>
  );

  const renderBilling = () => (
    <section className="user-profile-mobile-card">
      <div className="user-profile-mobile-card-heading">
        <div>
          <span className="user-profile-kicker">BILLING</span>
          <h3>Billing History</h3>
        </div>
        <span>{financialHistory.billingHistory.length} records</span>
      </div>
      <div className="user-profile-mobile-record-list">
        {recentBilling.map((row) => (
          <BillingRow key={row.id} row={row} formatMoney={formatMoney} />
        ))}
      </div>
      {financialHistory.billingHistory.length > recentBilling.length ? (
        <button
          type="button"
          className="user-profile-mobile-view-all"
          onClick={() => openHistory("billing")}
        >
          View all billing history
          <FiChevronRight />
        </button>
      ) : null}
    </section>
  );

  const renderPayments = () => (
    <section className="user-profile-mobile-card">
      <div className="user-profile-mobile-card-heading">
        <div>
          <span className="user-profile-kicker">PAYMENTS</span>
          <h3>Payment History</h3>
        </div>
        <span>{financialHistory.paymentHistory.length} records</span>
      </div>
      <div className="user-profile-mobile-record-list">
        {recentPayments.map((payment) => (
          <PaymentRow
            key={payment._historyId}
            payment={payment}
            formatMoney={formatMoney}
          />
        ))}
        {!recentPayments.length ? (
          <div className="user-profile-empty">No payment records found.</div>
        ) : null}
      </div>
      {financialHistory.paymentHistory.length > recentPayments.length ? (
        <button
          type="button"
          className="user-profile-mobile-view-all"
          onClick={() => openHistory("payments")}
        >
          View all payments
          <FiChevronRight />
        </button>
      ) : null}
      <button
        type="button"
        className="user-profile-mobile-inline-link"
        onClick={onPaymentHistory}
      >
        Open transaction history
        <FiChevronRight />
      </button>
    </section>
  );

  const renderActivity = () => (
    <section className="user-profile-mobile-card">
      <div className="user-profile-mobile-card-heading">
        <div>
          <span className="user-profile-kicker">ACTIVITY</span>
          <h3>Complete Activity History</h3>
        </div>
        <span>{financialHistory.timeline.length} events</span>
      </div>
      <div className="user-profile-mobile-recent-list user-profile-mobile-recent-timeline">
        {recentActivity.map((event) => (
          <div
            className={`user-profile-mobile-recent-item type-${event.type}`}
            key={event.id}
          >
            <div className="user-profile-mobile-recent-icon">
              {activityIcon(event)}
            </div>
            <div>
              <strong>{event.title}</strong>
              <span>
                {formatDate(event.date)}
                {event.membershipIndex != null
                  ? ` · Membership #${event.membershipIndex + 1}`
                  : ""}
              </span>
              <small>{event.description}</small>
            </div>
          </div>
        ))}
        {!recentActivity.length ? (
          <div className="user-profile-empty">No timeline events yet.</div>
        ) : null}
      </div>
      {financialHistory.timeline.length > recentActivity.length ? (
        <button
          type="button"
          className="user-profile-mobile-view-all"
          onClick={() => openHistory("activity")}
        >
          View all activity
          <FiChevronRight />
        </button>
      ) : null}
    </section>
  );

  let sectionContent = renderOverview();
  if (activeSection === "membership") sectionContent = renderMembership();
  if (activeSection === "billing") sectionContent = renderBilling();
  if (activeSection === "payments") sectionContent = renderPayments();
  if (activeSection === "activity") sectionContent = renderActivity();

  return (
    <div className="users-profile users-profile--mobile-compact">
      <div className="users-profile-topbar">
        <button
          type="button"
          className="users-mobile-back-btn users-profile-back"
          onClick={onBack}
          aria-label={t("back", "Back")}
          title={t("back", "Back")}
        >
          <FiArrowLeft />
          <span>{t("back", "Back")}</span>
        </button>
        <div className="users-profile-top-actions">
          <button
            type="button"
            className="users-profile-icon-btn"
            onClick={onEdit}
            title={t("Edit")}
            aria-label={t("Edit")}
          >
            <FiEdit2 />
            <span>Edit</span>
          </button>
          <button
            type="button"
            className="users-profile-icon-btn"
            onClick={onAddPayment}
            title={t("add_payment")}
            aria-label={t("add_payment")}
          >
            <FiCreditCard />
            <span>Payment</span>
          </button>
          <button
            type="button"
            className="users-profile-icon-btn users-profile-icon-btn--danger"
            onClick={onDelete}
            title={t("Delete user")}
            aria-label={t("Delete user")}
          >
            <FiTrash2 />
            <span>Delete</span>
          </button>
          <button
            type="button"
            className="users-profile-icon-btn users-profile-icon-btn--pdf"
            onClick={onExportProfilePdf}
            title={isExportingPdf ? "Generating PDF..." : "Download profile PDF"}
            aria-label={isExportingPdf ? "Generating PDF..." : "Download profile PDF"}
            disabled={isExportingPdf}
          >
            <FiFileText />
            <span>{isExportingPdf ? "PDF..." : "Profile PDF"}</span>
          </button>
        </div>
      </div>

      <section className="user-profile-hero">
        <div className="user-profile-avatar">
          {String(user.name || "CU").trim().slice(0, 2).toUpperCase()}
        </div>
        <div className="user-profile-identity">
          <div className="user-profile-title-row">
            <div>
              <span className="user-profile-kicker">CUSTOMER PROFILE</span>
              <h2>{user.name || "Unnamed customer"}</h2>
            </div>
            <span className={`user-profile-status status-${String(status).toLowerCase()}`}>
              {status}
            </span>
          </div>
          <div className="user-profile-contact-row">
            <span><FiPhone /> {user.phone || "No phone on file"}</span>
            <span><FiTag /> {packages.length ? packages.join(" · ") : "Uncategorized"}</span>
            <span>
              <FiCalendar /> First joined{" "}
              {memberships[0] ? formatDate(memberships[0].joinDate) : "Not available"}
            </span>
            <span>
              <FiRefreshCw /> Current join{" "}
              {memberships.at(-1) ? formatDate(memberships.at(-1).joinDate) : "Not available"}
            </span>
          </div>
        </div>
      </section>

      <section className="user-profile-balance-card">
        <div>
          <span className="user-profile-kicker">CURRENT BALANCE</span>
          <strong className={`user-profile-balance-value tone-${currentBalanceTone}`}>
            {currentBalance < 0 ? `-${formatMoney(Math.abs(currentBalance))}` : formatMoney(currentBalance)}
          </strong>
          <small className={`user-profile-balance-detail tone-${currentBalanceTone}`}>
            {currentBalanceDetail}
          </small>
        </div>
        <div className="user-profile-balance-side">
          <span>Current monthly bill</span>
          <strong>{formatMoney(financialHistory.currentMonthlyBill)}</strong>
          <span>{latestBillingRow?.periodLabel || "Latest financial period"}</span>
        </div>
      </section>

      <section className="user-profile-summary-grid">
        <SummaryCard
          icon={<FiDollarSign />}
          label="Total billed"
          value={formatMoney(financialHistory.totalBilled)}
          detail={`${financialHistory.billingHistory.length} billing periods`}
        />
        <SummaryCard
          icon={<FiCreditCard />}
          label="Total paid"
          value={formatMoney(financialHistory.totalPaid)}
          detail={`${financialHistory.paymentCount} recorded payments`}
          tone="paid"
        />
        <SummaryCard
          icon={<FiTrendingDown />}
          label="Current due"
          value={formatMoney(currentDue)}
          tone="due"
        />
        <SummaryCard
          icon={<FiTrendingUp />}
          label="Current advance"
          value={formatMoney(currentAdvance)}
          tone="advance"
        />
      </section>

      <div className="user-profile-mobile-section-nav" role="tablist" aria-label="Customer profile sections">
        {navItems.map((item) => (
          <ProfileSectionButton
            key={item.id}
            icon={item.icon}
            label={item.label}
            count={item.count}
            active={activeSection === item.id}
            onClick={() => setActiveSection(item.id)}
          />
        ))}
      </div>

      <div
        className="user-profile-mobile-section-content"
        id={`user-profile-panel-${activeSection}`}
        role="tabpanel"
        aria-labelledby={`user-profile-tab-${navItems
          .find((item) => item.id === activeSection)
          ?.label.toLowerCase()
          .replace(/\s+/g, "-")}`}
      >
        {sectionContent}
      </div>
    </div>
  );
}

export default function UserProfile({
  user,
  payments,
  onBack,
  onEdit,
  onAddPayment,
  onPaymentHistory,
  onDelete,
  currentDate,
}) {
  const { t, formatMoney } = useLanguage();
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const financialHistory = useMemo(() => {
    if (!user) return null;
    // The Users page supplies already-loaded payments. Profile computation is
    // deliberately local and reuses the shared billing/payment source of truth.
    return buildUserFinancialHistory(user, payments, currentDate);
  }, [currentDate, payments, user]);

  const handleExportProfilePdf = async () => {
    if (isExportingPdf || !user) return;

    setIsExportingPdf(true);
    try {
      const generationDate = new Date();
      const statement = buildUserFinancialStatement(
        user,
        payments,
        generationDate,
      );

      await exportUserProfilePdf({
        user,
        statement,
        generatedAt: generationDate,
        companyName: "Bill Sheet",
      });

      toast.success("Profile PDF downloaded successfully.");
    } catch (error) {
      console.error("Profile PDF generation failed:", error);
      toast.error(
        error?.message || "Could not generate the profile PDF. Please try again.",
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  const [isCompactMobile, setIsCompactMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const update = () => setIsCompactMobile(mediaQuery.matches);
    update();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", update);
      return () => mediaQuery.removeEventListener("change", update);
    }
    mediaQuery.addListener(update);
    return () => mediaQuery.removeListener(update);
  }, []);

  if (!user || !financialHistory) return null;

  const memberships = financialHistory.memberships.length
    ? financialHistory.memberships
    : getMembershipPeriods(user);
  const latestMembership = memberships[memberships.length - 1] || null;
  const packages = getDisplayPackages(user);
  const latestBillingRow = financialHistory.billingHistory[0] || null;
  const currentDue = financialHistory.currentDue;
  const currentAdvance = financialHistory.currentAdvance;
  const currentBalance = financialHistory.currentBalance;
  const currentBalanceTone =
    currentDue > 0 ? "due" : currentAdvance > 0 ? "advance" : "settled";
  const currentBalanceDetail =
    currentDue > 0
      ? "Outstanding due"
      : currentAdvance > 0
        ? "Available advance"
        : "No outstanding balance";
  const status = financialHistory.currentStatus || "Active";

  const membershipSummaries = memberships.map((period, index) => {
    const rows = financialHistory.billingHistory.filter(
      (row) => row.membershipIndex === index,
    );
    const paid = rows.reduce((sum, row) => sum + Number(row.paid || 0), 0);
    const billed = rows.reduce((sum, row) => sum + Number(row.bill || 0), 0);
    const lastRow = [...rows].sort(
      (a, b) =>
        b.year * 100 + b.month - (a.year * 100 + a.month),
    )[0];

    return {
      ...formatPeriod(period, index),
      index,
      rows,
      billed,
      paid,
      closingDue: Number(lastRow?.currentDue || 0),
      closingAdvance: Number(lastRow?.currentAdvance || 0),
    };
  });

  const calculationRow = latestBillingRow || {
    previousDue: 0,
    previousAdvance: 0,
    bill: Number(user.monthlyBill || 0),
    additionalDue: 0,
    paid: 0,
    currentDue,
    currentAdvance,
    balance: currentBalance,
  };

  const calculationOpeningBalance =
    Number(calculationRow.previousAdvance || 0) -
    Number(calculationRow.previousDue || 0);
  const calculationEndingBalance =
    calculationOpeningBalance +
    Number(calculationRow.paid || 0) -
    Number(calculationRow.bill || 0) -
    Number(calculationRow.additionalDue || 0);

  if (isCompactMobile) {
    return (
      <MobileUserProfile
        user={user}
        financialHistory={financialHistory}
        memberships={memberships}
        membershipSummaries={membershipSummaries}
        latestBillingRow={latestBillingRow}
        currentDue={currentDue}
        currentAdvance={currentAdvance}
        currentBalance={currentBalance}
        currentBalanceTone={currentBalanceTone}
        currentBalanceDetail={currentBalanceDetail}
        status={status}
        packages={packages}
        onBack={onBack}
        onEdit={onEdit}
        onAddPayment={onAddPayment}
        onPaymentHistory={onPaymentHistory}
        onDelete={onDelete}
        onExportProfilePdf={handleExportProfilePdf}
        isExportingPdf={isExportingPdf}
        formatMoney={formatMoney}
        t={t}
      />
    );
  }

  return (
    <div className="users-profile">
      <div className="users-profile-topbar">
        <button
          type="button"
          className="users-mobile-back-btn users-profile-back"
          onClick={onBack}
        >
          <FiArrowLeft />
          {t("back", "Back")}
        </button>
        <div className="users-profile-top-actions">
          <button type="button" className="users-profile-icon-btn" onClick={onEdit} title={t("Edit")}>
            <FiEdit2 />
            <span>Edit</span>
          </button>
          <button type="button" className="users-profile-icon-btn" onClick={onAddPayment} title={t("add_payment")}>
            <FiCreditCard />
            <span>Payment</span>
          </button>
          <button
            type="button"
            className="users-profile-icon-btn users-profile-icon-btn--danger"
            onClick={onDelete}
            title={t("Delete user")}
          >
            <FiTrash2 />
            <span>Delete</span>
          </button>
          <button
            type="button"
            className="users-profile-icon-btn users-profile-icon-btn--pdf"
            onClick={handleExportProfilePdf}
            title={isExportingPdf ? "Generating PDF..." : "Download profile PDF"}
            aria-label={isExportingPdf ? "Generating PDF..." : "Download profile PDF"}
            disabled={isExportingPdf}
          >
            <FiFileText />
            <span>{isExportingPdf ? "PDF..." : "Profile PDF"}</span>
          </button>
        </div>
      </div>

      <section className="user-profile-hero">
        <div className="user-profile-avatar">
          {String(user.name || "CU").trim().slice(0, 2).toUpperCase()}
        </div>
        <div className="user-profile-identity">
          <div className="user-profile-title-row">
            <div>
              <span className="user-profile-kicker">CUSTOMER PROFILE</span>
              <h2>{user.name || "Unnamed customer"}</h2>
            </div>
            <span className={`user-profile-status status-${String(status).toLowerCase()}`}>
              {status}
            </span>
          </div>
          <div className="user-profile-contact-row">
            <span><FiPhone /> {user.phone || "No phone on file"}</span>
            <span><FiTag /> {packages.length ? packages.join(" · ") : "Uncategorized"}</span>
            <span><FiCalendar /> First joined {memberships[0] ? formatDate(memberships[0].joinDate) : "Not available"}</span>
            <span><FiRefreshCw /> Current join {latestMembership ? formatDate(latestMembership.joinDate) : "Not available"}</span>
            <span><FiUser /> ID {user.customerId || user.id || "—"}</span>
          </div>
        </div>
      </section>

      <section className="user-profile-balance-card">
        <div>
          <span className="user-profile-kicker">CURRENT BALANCE</span>
          <strong className={`user-profile-balance-value tone-${currentBalanceTone}`}>
            {currentBalance < 0 ? `-${formatMoney(Math.abs(currentBalance))}` : formatMoney(currentBalance)}
          </strong>
          <small className={`user-profile-balance-detail tone-${currentBalanceTone}`}>
            {currentBalanceDetail}
          </small>
        </div>
        <div className="user-profile-balance-side">
          <span>Current monthly bill</span>
          <strong>{formatMoney(financialHistory.currentMonthlyBill)}</strong>
          <span>{latestBillingRow?.periodLabel || "Latest financial period"}</span>
        </div>
      </section>

      <section className="user-profile-summary-grid">
        <SummaryCard
          icon={<FiDollarSign />}
          label="Total billed"
          value={formatMoney(financialHistory.totalBilled)}
          detail={`${financialHistory.billingHistory.length} billing periods`}
        />
        <SummaryCard
          icon={<FiCreditCard />}
          label="Total paid"
          value={formatMoney(financialHistory.totalPaid)}
          detail={`${financialHistory.paymentCount} recorded payments`}
          tone="paid"
        />
        <SummaryCard
          icon={<FiTrendingDown />}
          label="Current due"
          value={formatMoney(currentDue)}
          tone="due"
        />
        <SummaryCard
          icon={<FiTrendingUp />}
          label="Current advance"
          value={formatMoney(currentAdvance)}
          tone="advance"
        />
      </section>

      <section className="user-profile-section">
        <div className="user-profile-section-heading">
          <div>
            <span className="user-profile-kicker">MEMBERSHIP</span>
            <h3>Membership History</h3>
          </div>
          <span>{memberships.length} period{memberships.length === 1 ? "" : "s"}</span>
        </div>

        <div className="user-profile-membership-list">
          {membershipSummaries.map((membership) => (
            <article key={`${membership.index}-${membership.joined}`} className="user-profile-membership-card">
              <div className="user-profile-membership-number">
                <span>#{membership.index + 1}</span>
                {membership.index === memberships.length - 1 && !memberships[membership.index]?.leaveDate ? (
                  <span className="user-profile-current-chip">Current</span>
                ) : null}
              </div>
              <div className="user-profile-membership-copy">
                <strong>{membership.joined} → {membership.left}</strong>
                <span>{membership.rows.length} billing months · Billed {formatMoney(membership.billed)} · Paid {formatMoney(membership.paid)}</span>
              </div>
              <div className="user-profile-membership-balance">
                {membership.closingDue > 0 ? (
                  <strong className="tone-due">Due {formatMoney(membership.closingDue)}</strong>
                ) : membership.closingAdvance > 0 ? (
                  <strong className="tone-advance">Advance {formatMoney(membership.closingAdvance)}</strong>
                ) : (
                  <strong className="tone-settled">Settled</strong>
                )}
              </div>
            </article>
          ))}
          {!membershipSummaries.length ? (
            <div className="user-profile-empty">No membership period has been recorded yet.</div>
          ) : null}
        </div>
      </section>

      <section className="user-profile-section">
        <div className="user-profile-section-heading">
          <div>
            <span className="user-profile-kicker">BILLING</span>
            <h3>Complete Billing History</h3>
          </div>
          <span>{financialHistory.billingHistory.length} records</span>
        </div>
        <div className="user-profile-list">
          {financialHistory.billingHistory.map((row) => (
            <BillingRow key={row.id} row={row} formatMoney={formatMoney} />
          ))}
          {!financialHistory.billingHistory.length ? (
            <div className="user-profile-empty">
              Billing history will appear here when a membership period has a bill.
            </div>
          ) : null}
        </div>
      </section>

      <section className="user-profile-section">
        <div className="user-profile-section-heading">
          <div>
            <span className="user-profile-kicker">PAYMENTS</span>
            <h3>Complete Payment History</h3>
          </div>
          <button type="button" className="user-profile-link-btn" onClick={onPaymentHistory}>
            <FiCalendar />
            Open transaction history
          </button>
        </div>
        <div className="user-profile-list">
          {financialHistory.paymentHistory.map((payment) => (
            <PaymentRow key={payment._historyId} payment={payment} formatMoney={formatMoney} />
          ))}
          {!financialHistory.paymentHistory.length ? (
            <div className="user-profile-empty">No payment records found for this user.</div>
          ) : null}
        </div>
      </section>

      <section className="user-profile-section">
        <div className="user-profile-section-heading">
          <div>
            <span className="user-profile-kicker">CALCULATION</span>
            <h3>Financial Calculation Detail</h3>
          </div>
          <span>{latestBillingRow?.periodLabel || "Latest available period"}</span>
        </div>
        <div className="user-profile-calculation">
          <div className="user-profile-calculation-row">
            <span>Previous Due</span>
            <strong>{formatMoney(calculationRow.previousDue)}</strong>
          </div>
          <div className="user-profile-calculation-row">
            <span>Previous Advance</span>
            <strong>{formatMoney(calculationRow.previousAdvance)}</strong>
          </div>
          <div className="user-profile-calculation-row">
            <span>Current Month Bill</span>
            <strong>{formatMoney(calculationRow.bill)}</strong>
          </div>
          <div className="user-profile-calculation-row">
            <span>Additional Due</span>
            <strong>{formatMoney(calculationRow.additionalDue)}</strong>
          </div>
          <div className="user-profile-calculation-row user-profile-calculation-row--payment">
            <span>Payment</span>
            <strong>{formatMoney(calculationRow.paid)}</strong>
          </div>
          <div className="user-profile-calculation-equation">
            <span>Opening balance</span>
            <strong>{moneySigned(calculationOpeningBalance)}</strong>
            <span>+ Payment − Bill − Additional Due</span>
            <strong>{moneySigned(calculationEndingBalance)}</strong>
          </div>
          <div className="user-profile-calculation-result">
            <span>Closing Balance</span>
            <strong className={`tone-${calculationRow.currentDue > 0 ? "due" : calculationRow.currentAdvance > 0 ? "advance" : "settled"}`}>
              {calculationRow.currentDue > 0
                ? `Due ${formatMoney(calculationRow.currentDue)}`
                : calculationRow.currentAdvance > 0
                  ? `Advance ${formatMoney(calculationRow.currentAdvance)}`
                  : formatMoney(0)}
            </strong>
          </div>
        </div>
      </section>

      <section className="user-profile-section">
        <div className="user-profile-section-heading">
          <div>
            <span className="user-profile-kicker">TIMELINE</span>
            <h3>Complete Activity History</h3>
          </div>
          <span>{financialHistory.timeline.length} events</span>
        </div>
        <details className="user-profile-timeline-details" open>
          <summary>
            <span>Chronological history</span>
            <FiChevronDown />
          </summary>
          <div className="user-profile-timeline">
            {financialHistory.timeline.map((event) => {
              const icon =
                event.type === "joined" ? <FiUser /> :
                event.type === "left" ? <FiArrowLeft /> :
                event.type === "payment" ? <FiCreditCard /> :
                <FiDollarSign />;

              return (
                <div className={`user-profile-timeline-item type-${event.type}`} key={event.id}>
                  <div className="user-profile-timeline-icon">{icon}</div>
                  <div className="user-profile-timeline-copy">
                    <strong>{event.title}</strong>
                    <span>{formatDate(event.date)}{event.membershipIndex != null ? ` · Membership #${event.membershipIndex + 1}` : ""}</span>
                    <small>{event.description}</small>
                  </div>
                </div>
              );
            })}
            {!financialHistory.timeline.length ? (
              <div className="user-profile-empty">No timeline events are available yet.</div>
            ) : null}
          </div>
        </details>
      </section>

      <div className="user-profile-footer-note">
        Historical membership periods and financial records are preserved on the same customer profile.
      </div>
    </div>
  );
}
