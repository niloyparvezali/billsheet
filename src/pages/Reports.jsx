import { useEffect, useMemo, useRef, useState } from "react";
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
import { exportAnnualCustomerReport } from "../utils/exports";
import { formatDate, money, monthNames } from "../utils/date";
import { computePaymentSummary, getActivePayments } from "../utils/payments";

export default function Reports() {
  const autocompleteRef = useRef(null);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [yearInput, setYearInput] = useState(String(now.getFullYear()));
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
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

  const filteredCustomers = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();
    if (!term) return [];
    return customerOptions.filter((customer) =>
      `${customer.name} ${customer.phone} ${customer.customerId}`
        .toLowerCase()
        .includes(term),
    );
  }, [customerOptions, customerSearch]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (
        autocompleteRef.current &&
        !autocompleteRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const selectedCustomer = useMemo(() => {
    return (
      customerOptions.find((customer) => customer.id === selectedCustomerId) ||
      null
    );
  }, [customerOptions, selectedCustomerId]);

  const handleCustomerSelect = (customer) => {
    setSelectedCustomerId(customer.id);
    setCustomerSearch(customer.name || "");
    setShowSuggestions(false);
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

  const selectedYearPayments = useMemo(() => {
    if (!selectedCustomer) return [];
    const targetId = selectedCustomer.customerId || selectedCustomer.id;
    return (activePayments || [])
      .filter((payment) => {
        const paymentOwnerId = payment.userId || payment.userName || payment.id;
        return (
          Number(payment.year) === Number(year) &&
          (paymentOwnerId === targetId ||
            payment.userName === selectedCustomer.name ||
            payment.userId === targetId)
        );
      })
      .sort((left, right) => {
        const leftPeriod = Number(left.year || 0) * 100 + Number(left.month || 0);
        const rightPeriod = Number(right.year || 0) * 100 + Number(right.month || 0);
        return leftPeriod - rightPeriod;
      });
  }, [activePayments, selectedCustomer, year]);

  const previousDue = useMemo(() => {
    if (!selectedCustomer) return 0;
    const targetId = selectedCustomer.customerId || selectedCustomer.id;
    const priorPayments = (activePayments || [])
      .filter((payment) => {
        const paymentOwnerId = payment.userId || payment.userName || payment.id;
        return (
          Number(payment.year) < Number(year) &&
          (paymentOwnerId === targetId ||
            payment.userName === selectedCustomer.name ||
            payment.userId === targetId)
        );
      })
      .sort((left, right) => {
        const leftPeriod = Number(left.year || 0) * 100 + Number(left.month || 0);
        const rightPeriod = Number(right.year || 0) * 100 + Number(right.month || 0);
        return rightPeriod - leftPeriod;
      });
    return priorPayments.reduce(
      (sum, payment) => sum + Number(payment.due || 0),
      0,
    );
  }, [activePayments, selectedCustomer, year]);

  const paidThisYear = useMemo(() => {
    return selectedYearPayments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0,
    );
  }, [selectedYearPayments]);

  const yearOverview = useMemo(() => {
    const collection = (activePayments || [])
      .filter((payment) => Number(payment.year) === Number(year))
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const outstanding = (activePayments || [])
      .filter((payment) => Number(payment.year) === Number(year))
      .reduce((sum, payment) => sum + Number(payment.due || 0), 0);
    return {
      collection,
      outstanding,
    };
  }, [activePayments, year]);

  const monthlyHistory = useMemo(() => {
    if (!selectedCustomer) return [];

    const parseDateValue = (value) => {
      if (!value) return null;
      if (typeof value?.toDate === "function") return value.toDate();
      const date = value instanceof Date ? value : new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    };

    const joinedDate = parseDateValue(
      selectedCustomer?.user?.joinDate || selectedCustomer?.user?.createdAt || selectedCustomer?.memberSince || null,
    );
    const leaveDate = parseDateValue(
      selectedCustomer?.user?.leaveDate || selectedCustomer?.user?.archivedAt || null,
    );

    const yearStart = new Date(Number(year), 0, 1);
    const yearEnd = new Date(Number(year), 11, 31, 23, 59, 59);
    const joinWithinYear = joinedDate && joinedDate >= yearStart && joinedDate <= yearEnd;
    const leaveWithinYear = leaveDate && leaveDate >= yearStart && leaveDate <= yearEnd;

    return Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      const monthPayments = selectedYearPayments.filter(
        (entry) => Number(entry.month) === month,
      );
      const monthStart = new Date(Number(year), index, 1);
      const monthEnd = new Date(Number(year), index + 1, 0);
      const beforeJoin =
        !!joinedDate &&
        joinedDate > monthEnd &&
        joinWithinYear;
      const afterLeave =
        !!leaveDate &&
        leaveDate < monthStart &&
        ((leaveWithinYear && leaveDate < monthStart) || (!leaveWithinYear && leaveDate < monthStart));

      const isInactiveMonth = beforeJoin || afterLeave;
      const monthlyBill = isInactiveMonth
        ? null
        : Number(
            monthPayments.find((entry) => Number(entry.monthlyBill || 0) > 0)?.monthlyBill ||
              selectedCustomer?.user?.monthlyBill ||
              0,
          );
      const summary = computePaymentSummary({
        bill: monthlyBill || 0,
        payments: monthPayments,
      });
      const paid = isInactiveMonth ? null : summary.totalPaid;
      const remaining = isInactiveMonth ? null : summary.outstandingBalance;
      const carryForward = isInactiveMonth ? null : summary.carryForward;
      const status = beforeJoin
        ? "Not Joined"
        : afterLeave
          ? "Inactive"
          : summary.status;
      return {
        month,
        monthName: monthNames[index],
        monthlyBill,
        paid,
        remainingDue: remaining,
        carryForward,
        paymentDate: monthPayments.length
          ? monthPayments[monthPayments.length - 1]?.paymentDateText || monthPayments[monthPayments.length - 1]?.paymentDate || null
          : null,
        status,
      };
    });
  }, [selectedCustomer, selectedYearPayments, year]);

  const annualBill = useMemo(() => {
    if (!selectedCustomer) return 0;
    return (monthlyHistory || []).reduce((sum, entry) => {
      if (entry.status === "Not Joined" || entry.status === "Inactive") return sum;
      return sum + Number(entry.monthlyBill || 0);
    }, 0);
  }, [monthlyHistory, selectedCustomer]);

  const totalPayable = previousDue + annualBill;
  const difference = paidThisYear - totalPayable;
  const outstandingBalance = difference < 0 ? Math.abs(difference) : 0;
  const creditCarryForward = difference > 0 ? difference : 0;
  const balanceStatus =
    difference < 0
      ? "Outstanding Balance"
      : difference > 0
        ? "Credit Carry Forward"
        : "Account Settled";

  const summaryCards = useMemo(
    () => [
      {
        label: `From ${year - 1}`,
        value: money(previousDue),
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
        value: money(outstandingBalance),
        icon: <FiAlertCircle />,
        accent: "amber",
      },
      {
        label: "Credit Carry Forward",
        value: money(creditCarryForward),
        icon: <FiArrowRight />,
        accent: "blue",
      },
    ],
    [annualBill, creditCarryForward, outstandingBalance, paidThisYear, previousDue, year],
  );

  const exportReport = () => {
    if (!selectedCustomer) return;
    exportAnnualCustomerReport({
      businessName: "BillSheet",
      customer: selectedCustomer,
      year,
      summary: {
        previousDue,
        annualBill,
        paidThisYear,
        outstandingBalance,
        creditCarryForward,
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
            View yearly payment summaries, outstanding balances and carry-forward history.
          </p>
        </div>
      </section>

      <section className="reports-overview-grid">
        <div className="reports-overview-card">
          <div className="reports-overview-icon">
            <FiDollarSign />
          </div>
          <div className="reports-overview-number">{money(yearOverview.collection)}</div>
          <div className="reports-overview-label">Collected from all customers in {year}</div>
        </div>
        <div className="reports-overview-card reports-overview-card--warning">
          <div className="reports-overview-icon">
            <FiAlertCircle />
          </div>
          <div className="reports-overview-number">{money(yearOverview.outstanding)}</div>
          <div className="reports-overview-label">Remaining unpaid in {year}</div>
        </div>
      </section>

      <section className="reports-toolbar">
        <div className="reports-toolbar-controls">
          <div className="reports-autocomplete" ref={autocompleteRef}>
            <label className="reports-search-field reports-search-field--wide">
              <FiSearch />
              <input
                value={customerSearch}
                onChange={(event) => {
                  setCustomerSearch(event.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(Boolean(customerSearch.trim()))}
                placeholder="Search customer by name or phone..."
              />
            </label>
            {showSuggestions && filteredCustomers.length > 0 && (
              <div className="reports-suggestions">
                {filteredCustomers.map((customer) => (
                  <button
                    type="button"
                    className="reports-suggestion-item"
                    key={customer.id}
                    onMouseDown={() => handleCustomerSelect(customer)}
                  >
                    <span className="reports-suggestion-name">{customer.name}</span>
                    {customer.phone ? (
                      <span className="reports-suggestion-phone">{customer.phone}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </div>

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
        </div>
        <button className="reports-export-btn" type="button" onClick={exportReport}>
          <FiDownload /> PDF
        </button>
      </section>

      {selectedCustomer ? (
        <>
          {(() => {
            const joinedDate = selectedCustomer?.user?.joinDate || selectedCustomer?.user?.createdAt || selectedCustomer?.memberSince;
            const leaveDate = selectedCustomer?.user?.leaveDate || selectedCustomer?.user?.archivedAt;
            const hasActiveMonth = (monthlyHistory || []).some((entry) => entry.status !== "Not Joined" && entry.status !== "Inactive");
            const hasActiveWindow = (() => {
              if (!joinedDate && !leaveDate) return true;
              const start = new Date(joinedDate || "");
              const end = leaveDate ? new Date(leaveDate) : null;
              const yearStart = new Date(Number(year), 0, 1);
              const yearEnd = new Date(Number(year), 11, 31, 23, 59, 59);
              if (!Number.isNaN(start.getTime()) && !Number.isNaN(yearStart.getTime()) && start > yearEnd) return false;
              if (end && !Number.isNaN(end.getTime()) && end < yearStart) return false;
              return true;
            })();
            if (!hasActiveWindow || !hasActiveMonth) {
              return (
                <section className="reports-empty-state reports-empty-state--notice">
                  <div className="reports-empty-icon">
                    <FiCalendar />
                  </div>
                  <h3>This customer was not active during {year}.</h3>
                  <p>No monthly bills were generated for this year because the customer was outside the active lifecycle window.</p>
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
              <div className="reports-profile-name">{selectedCustomer.name}</div>
              <div className="reports-profile-meta">
                <span>
                  <FiUser /> {selectedCustomer.phone || "No phone on file"}
                </span>
                <span>
                  <FiCalendar /> Member since {formatDate(selectedCustomer.memberSince)}
                </span>
                <span>
                  <FiHash /> {selectedCustomer.customerId || selectedCustomer.id}
                </span>
              </div>
            </div>
          </section>

          <section className="reports-summary-grid">
            {summaryCards.map((card) => (
              <div key={card.label} className={`reports-summary-card reports-summary-card--${card.accent}`}>
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
                <div>Carry Forward</div>
                <div>Payment Date</div>
                <div>Status</div>
              </div>
              {monthlyHistory.map((entry) => (
                <div className="reports-history-row" key={entry.month}>
                  <div>{entry.monthName}</div>
                  <div>{entry.status === "Not Joined" || entry.status === "Inactive" ? "—" : money(entry.monthlyBill)}</div>
                  <div>{entry.status === "Not Joined" || entry.status === "Inactive" ? "—" : money(entry.paid)}</div>
                  <div>{entry.status === "Not Joined" || entry.status === "Inactive" ? "—" : money(entry.carryForward ?? entry.remainingDue ?? 0)}</div>
                  <div>{entry.paymentDate ? formatDate(entry.paymentDate) : "—"}</div>
                  <div>
                    <span className={`reports-history-status ${entry.status.toLowerCase()}`}>
                      {entry.status}
                    </span>
                  </div>
                </div>
              ))}
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
              <div className="reports-footer-value reports-footer-value--warning">{money(outstandingBalance)}</div>
            </div>
            <div>
              <div className="reports-footer-label">Credit Carry Forward</div>
              <div className="reports-footer-value reports-footer-value--credit">{money(creditCarryForward)}</div>
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
