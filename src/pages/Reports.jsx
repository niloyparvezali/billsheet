import { useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiArrowRight,
  FiCalendar,
  FiCreditCard,
  FiDollarSign,
  FiDownload,
  FiHash,
  FiSearch,
  FiUser,
} from "react-icons/fi";
import useOwnedCollection from "../hooks/useOwnedCollection";
import { exportAnnualCustomerPdf } from "../utils/pdf";
import { formatDate, money } from "../utils/date";
import {
  buildYearlyCustomerReportSummary,
  formatAnnualReportBalanceValue,
  formatBalanceDisplayValue,
  getActivePayments,
} from "../utils/payments";

export default function Reports() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [yearInput, setYearInput] = useState(String(now.getFullYear()));
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const {
    data: users = [],
    loading: usersLoading,
    error: usersError,
  } = useOwnedCollection("users");
  const {
    data: payments = [],
    loading: paymentsLoading,
    error: paymentsError,
  } = useOwnedCollection("payments");

  const customerOptions = useMemo(() => {
    const options = [];
    const seen = new Set();

    (users || []).forEach((user) => {
      const key = user.id || user.name || user.email;
      if (!key || seen.has(key)) return;
      seen.add(key);
      options.push({
        id: user.id,
        name: user.name || user.email || "Customer",
        phone: user.phone || "",
        memberSince: user.createdAt || user.joinedAt || null,
        customerId: user.id,
        user,
      });
    });

    (payments || []).forEach((payment) => {
      const fallbackId = payment.userId || payment.userName || payment.id;
      if (!fallbackId || seen.has(fallbackId)) return;

      const matchingUser = (users || []).find(
        (user) => user.id === payment.userId || user.name === payment.userName,
      );
      seen.add(fallbackId);
      options.push({
        id: fallbackId,
        name: payment.userName || matchingUser?.name || "Customer",
        phone: matchingUser?.phone || payment.phone || "",
        memberSince: matchingUser?.createdAt || matchingUser?.joinedAt || null,
        customerId: payment.userId || payment.id,
        user: matchingUser || null,
      });
    });

    return options.sort((left, right) => left.name.localeCompare(right.name));
  }, [users, payments]);

  const visibleCustomers = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();
    if (!term) return customerOptions;
    return customerOptions.filter((customer) =>
      `${customer.name} ${customer.phone} ${customer.customerId}`
        .toLowerCase()
        .includes(term),
    );
  }, [customerOptions, customerSearch]);

  const selectedCustomer = useMemo(() => {
    return (
      customerOptions.find((customer) => customer.id === selectedCustomerId) ||
      null
    );
  }, [customerOptions, selectedCustomerId]);

  const handleCustomerSelect = (customer) => {
    setSelectedCustomerId(customer.id);
    setCustomerSearch(customer.name || "");
  };

  const handleYearInputChange = (event) => {
    const rawValue = event.target.value.replace(/\D/g, "").slice(0, 4);
    setYearInput(rawValue);

    if (rawValue.length === 4) {
      const numericYear = Number(rawValue);
      if (Number.isFinite(numericYear)) {
        setYear(numericYear);
      }
    }
  };

  const handleYearBlur = () => {
    if (!yearInput || yearInput.length < 4) {
      setYearInput(String(year));
    }
  };

  const activePayments = useMemo(() => getActivePayments(payments), [payments]);

  const yearlySummary = useMemo(() => {
    if (!selectedCustomer) return null;
    return buildYearlyCustomerReportSummary({
      user: selectedCustomer?.user || selectedCustomer,
      payments: activePayments,
      year,
    });
  }, [activePayments, selectedCustomer, year]);

  const previousDue = yearlySummary?.previousDue || 0;
  const paidThisYear = yearlySummary?.totalPaid || 0;
  const annualBill = yearlySummary?.annualBill || 0;
  const outstandingBalance = yearlySummary?.totalDue || 0;
  const creditCarryForward = yearlySummary?.totalAdvance || 0;
  const balanceStatus =
    yearlySummary?.closingBalanceStatus || "Account Settled";
  const monthlyHistory = yearlySummary?.months || [];
  const yearOverview = useMemo(
    () => ({
      collection: yearlySummary?.totalPaid || 0,
      outstanding: yearlySummary?.totalDue || 0,
    }),
    [yearlySummary],
  );

  const summaryCards = useMemo(
    () => [
      {
        label: `From ${year - 1}`,
        value: formatBalanceDisplayValue({ due: previousDue, carryForward: 0 }),
        icon: <FiAlertCircle />,
        accent: "forest",
      },
      {
        label: `Annual Bill ${year}`,
        value: money(annualBill),
        icon: <FiCreditCard />,
        accent: "ocean",
      },
      {
        label: `Paid ${year}`,
        value: money(paidThisYear),
        icon: <FiDollarSign />,
        accent: "green",
      },
      {
        label: "Outstanding Balance",
        value: formatBalanceDisplayValue({
          due: outstandingBalance,
          carryForward: 0,
        }),
        icon: <FiAlertCircle />,
        accent: "amber",
      },
      {
        label: "Credit Carry Forward",
        value: formatBalanceDisplayValue({
          due: 0,
          carryForward: creditCarryForward,
        }),
        icon: <FiArrowRight />,
        accent: "blue",
      },
    ],
    [
      annualBill,
      creditCarryForward,
      outstandingBalance,
      paidThisYear,
      previousDue,
      year,
    ],
  );

  const exportReport = () => {
    if (!selectedCustomer) return;
    exportAnnualCustomerPdf({
      businessName: "BillSheet",
      customer: selectedCustomer,
      year,
      summary: {
        openingBalance: yearlySummary?.openingBalance || 0,
        previousDue,
        annualBill,
        totalPaid: paidThisYear,
        paidThisYear,
        totalDue: outstandingBalance,
        outstandingBalance,
        totalAdvance: creditCarryForward,
        creditCarryForward,
        carryForward: creditCarryForward,
        closingBalance: yearlySummary?.closingBalance || 0,
        balanceStatus,
      },
      history: monthlyHistory,
    });
  };

  return (
    <div className="page reports-page">
      <section className="reports-hero">
        <div>
          <div className="reports-eyebrow">Annual Statement</div>
          <h2>Annual Customer Report</h2>
          <p>
            View yearly payment summaries, outstanding balances and
            carry-forward history.
          </p>
        </div>
      </section>

      <section className="reports-overview-grid">
        <div className="reports-overview-card">
          <div className="reports-overview-icon">
            <FiDollarSign />
          </div>
          <div className="reports-overview-number">
            {money(yearOverview.collection)}
          </div>
          <div className="reports-overview-label">Collected in {year}</div>
        </div>
        <div className="reports-overview-card reports-overview-card--warning">
          <div className="reports-overview-icon">
            <FiAlertCircle />
          </div>
          <div className="reports-overview-number">
            {money(yearOverview.outstanding)}
          </div>
          <div className="reports-overview-label">
            Remaining unpaid in {year}
          </div>
        </div>
      </section>

      <section className="reports-toolbar">
        <div className="reports-toolbar-row">
          <label className="reports-search-field reports-search-field--wide">
            <FiSearch />
            <input
              value={customerSearch}
              onChange={(event) => setCustomerSearch(event.target.value)}
              placeholder="Search customer..."
            />
          </label>

          <label className="reports-year-field">
            <span>Year</span>
            <input
              className="reports-year-input"
              type="text"
              inputMode="numeric"
              maxLength="4"
              value={yearInput}
              onChange={handleYearInputChange}
              onBlur={handleYearBlur}
              placeholder={String(now.getFullYear())}
            />
          </label>

          <button
            className="reports-export-btn"
            type="button"
            onClick={exportReport}
          >
            <FiDownload /> Export PDF
          </button>
        </div>

        <div className="reports-customer-list-shell">
          {visibleCustomers.length > 0 ? (
            <div className="reports-customer-list" role="listbox">
              {visibleCustomers.map((customer) => {
                const isSelected = selectedCustomerId === customer.id;
                return (
                  <button
                    key={customer.id}
                    type="button"
                    className={`reports-customer-item${
                      isSelected ? " reports-customer-item--active" : ""
                    }`}
                    onClick={() => handleCustomerSelect(customer)}
                  >
                    <span className="reports-customer-avatar">
                      <FiUser />
                    </span>
                    <span className="reports-customer-content">
                      <span className="reports-customer-name">
                        {customer.name}
                      </span>
                      <span className="reports-customer-phone">
                        {customer.phone || "No phone number"}
                      </span>
                    </span>
                    {isSelected ? (
                      <span className="reports-customer-check" aria-hidden="true">
                        ✓
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="reports-customer-empty">
              <span>No customer found</span>
            </div>
          )}
        </div>
      </section>

      {selectedCustomer ? (
        <>
          {(() => {
            const joinedDate =
              selectedCustomer?.user?.joinDate ||
              selectedCustomer?.user?.createdAt ||
              selectedCustomer?.memberSince;
            const leaveDate =
              selectedCustomer?.user?.leaveDate ||
              selectedCustomer?.user?.archivedAt;
            const hasActiveMonth = (monthlyHistory || []).some(
              (entry) =>
                entry.status !== "Not Joined" &&
                entry.status !== "Inactive" &&
                entry.status !== "N/A",
            );
            const hasActiveWindow = (() => {
              if (!joinedDate && !leaveDate) return true;
              const start = new Date(joinedDate || "");
              const end = leaveDate ? new Date(leaveDate) : null;
              const yearStart = new Date(Number(year), 0, 1);
              const yearEnd = new Date(Number(year), 11, 31, 23, 59, 59);
              if (
                !Number.isNaN(start.getTime()) &&
                !Number.isNaN(yearStart.getTime()) &&
                start > yearEnd
              )
                return false;
              if (end && !Number.isNaN(end.getTime()) && end < yearStart)
                return false;
              return true;
            })();
            if (!hasActiveWindow || !hasActiveMonth) {
              return (
                <section className="reports-empty-state reports-empty-state--notice">
                  <div className="reports-empty-icon">
                    <FiCalendar />
                  </div>
                  <h3>This customer was not active during {year}.</h3>
                  <p>
                    No monthly bills were generated for this year because the
                    customer was outside the active lifecycle window.
                  </p>
                </section>
              );
            }
            return null;
          })()}
          <section className="reports-profile-card">
            <div className="reports-profile-avatar">
              {selectedCustomer.name?.slice(0, 2).toUpperCase() || "CU"}
            </div>
            <div className="reports-profile-details">
              <div className="reports-profile-name">
                {selectedCustomer.name}
              </div>
              <div className="reports-profile-meta">
                <span>
                  <FiUser /> {selectedCustomer.phone || "No phone on file"}
                </span>
                <span>
                  <FiCalendar /> Member since{" "}
                  {formatDate(selectedCustomer.memberSince)}
                </span>
              </div>
            </div>
          </section>

          <section className="reports-summary-grid">
            {summaryCards.map((card) => (
              <div
                key={card.label}
                className={`reports-summary-card reports-summary-card--${card.accent}`}
              >
                <div className="reports-summary-icon">{card.icon}</div>
                <div className="reports-summary-number">{card.value}</div>
                <div className="reports-summary-label">{card.label}</div>
              </div>
            ))}
          </section>

          <section className="reports-history-card">
            <div className="reports-history-head">
              <div>
                <div className="reports-history-kicker">Monthly activity</div>
                <h3>Payment History</h3>
              </div>
              <div className="reports-history-chip">All 12 months</div>
            </div>
            <div className="reports-history-table">
              <div className="reports-history-row reports-history-row--head">
                <div>Month</div>
                <div>Monthly Bill</div>
                <div>Paid</div>
                <div>Balance</div>
                <div>Payment Date</div>
                <div>Status</div>
              </div>
              {monthlyHistory.map((entry) => {
                const dueValue = Number(entry.due ?? entry.remainingDue ?? 0);
                const carryForwardValue = Number(entry.advance ?? entry.carryForward ?? 0);
                const balanceStyle =
                  dueValue > 0
                    ? { color: "#fda4af" }
                    : carryForwardValue > 0
                      ? { color: "#4ade80" }
                      : undefined;
                const balanceLabel = formatAnnualReportBalanceValue({
                  due: dueValue,
                  advance: carryForwardValue,
                });

                return (
                  <div className="reports-history-row" key={entry.month}>
                    <div>{entry.monthName}</div>
                    <div>
                      {entry.status === "Not Joined" ||
                      entry.status === "Inactive" ||
                      entry.status === "N/A"
                        ? "—"
                        : money(entry.monthlyBill)}
                    </div>
                    <div>
                      {entry.status === "Not Joined" ||
                      entry.status === "Inactive" ||
                      entry.status === "N/A"
                        ? "—"
                        : money(entry.paid)}
                    </div>
                    <div style={balanceStyle}>
                      {entry.status === "Not Joined" ||
                      entry.status === "Inactive" ||
                      entry.status === "N/A"
                        ? "—"
                        : balanceLabel}
                    </div>
                    <div>
                      {entry.paymentDate ? formatDate(entry.paymentDate) : "—"}
                    </div>
                    <div>
                      <span
                        className={`reports-history-status ${entry.status.toLowerCase()}`}
                      >
                        {entry.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="reports-footer-summary">
            <div>
              <div className="reports-footer-label">Previous Due</div>
              <div className="reports-footer-value">{money(previousDue)}</div>
            </div>
            <div>
              <div className="reports-footer-label">Annual Bill</div>
              <div className="reports-footer-value">{money(annualBill)}</div>
            </div>
            <div>
              <div className="reports-footer-label">Outstanding Balance</div>
              <div className="reports-footer-value reports-footer-value--warning">
                {formatBalanceDisplayValue({
                  due: outstandingBalance,
                  carryForward: 0,
                })}
              </div>
            </div>
            <div>
              <div className="reports-footer-label">Credit Carry Forward</div>
              <div className="reports-footer-value reports-footer-value--credit">
                {formatBalanceDisplayValue({
                  due: 0,
                  carryForward: creditCarryForward,
                })}
              </div>
            </div>
            <p>Status: {balanceStatus}</p>
          </section>
        </>
      ) : (
        <section className="reports-empty-state">
          <div className="reports-empty-icon">
            <FiSearch />
          </div>
          <h3>No customer selected</h3>
          <p>Select a customer to view the annual statement.</p>
        </section>
      )}
    </div>
  );
}
