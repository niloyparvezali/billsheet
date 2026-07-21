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
  getEffectiveBillForPeriod,
  getPaymentMonthYear,
  matchesPaymentToUser,
} from "../utils/payments";
import { isUserActiveForPeriod } from "../utils/membership";

const resolveReportsBillingStatus = ({ entry }) => {
  const monthNumber = Number(entry?.month || entry?.monthNumber || 0);
  const bill = Number(entry?.bill ?? entry?.monthlyBill ?? 0);
  const paid = Number(entry?.paid ?? 0);
  const endingBalance = Number(entry?.endingBalance ?? entry?.balance ?? 0);
  const isInactiveEntry =
    entry?.status === "Not Joined" ||
    entry?.status === "Inactive" ||
    entry?.status === "N/A" ||
    entry?.status === "na";

  if (isInactiveEntry) {
    return { label: "N/A", tone: "neutral", className: "status-neutral" };
  }

  if (!Number.isFinite(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return { label: "Pending", tone: "pending", className: "status-pending" };
  }

  if (endingBalance < 0) {
    return { label: "Due", tone: "due", className: "status-due" };
  }

  if (endingBalance === 0) {
    return { label: "Paid", tone: "paid", className: "status-paid" };
  }

  return { label: "Advance", tone: "advance", className: "status-advance" };
};

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
  const previousAdvance = yearlySummary?.previousAdvance || 0;
  const openingBalance = yearlySummary?.openingBalance || 0;
  const paidThisYear = yearlySummary?.totalPaid || 0;
  const annualBill = yearlySummary?.annualBill || 0;
  const outstandingBalance =
    (yearlySummary?.remainingDue ?? yearlySummary?.totalDue) || 0;
  const creditCarryForward =
    (yearlySummary?.remainingAdvance ?? yearlySummary?.totalAdvance) || 0;
  const closingBalance = yearlySummary?.closingBalance || 0;
  const balanceStatus =
    yearlySummary?.closingBalanceStatus || "Account Settled";
  const monthlyHistory = useMemo(() => {
    if (!selectedCustomer) return [];

    const user = selectedCustomer?.user || selectedCustomer;
    const safeYear = Number(year);
    const currentDate = new Date();
    const isCurrentYear = safeYear === currentDate.getFullYear();
    const maxMonth = isCurrentYear ? currentDate.getMonth() + 1 : 12;
    const startingBalance = Number(yearlySummary?.openingBalance || 0);
    let runningBalance = startingBalance;

    return Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      const monthStart = new Date(safeYear, index, 1);
      const monthEnd = new Date(safeYear, index + 1, 0, 23, 59, 59);
      const monthName = monthStart.toLocaleString("en-us", { month: "long" });

      if (isCurrentYear && month > maxMonth) {
        return {
          month,
          monthName,
          bill: null,
          paid: null,
          due: null,
          advance: null,
          balance: null,
          status: null,
          previousBalance: runningBalance,
          endingBalance: runningBalance,
          isPlaceholder: true,
        };
      }

      const isActiveForMonth = isUserActiveForPeriod(user, { month, year: safeYear });
      if (!isActiveForMonth) {
        return {
          month,
          monthName,
          bill: null,
          paid: null,
          due: null,
          advance: null,
          balance: null,
          status: "N/A",
          previousBalance: runningBalance,
          endingBalance: runningBalance,
          isPlaceholder: false,
          isInactive: true,
        };
      }

      const monthPayments = (activePayments || []).filter((payment) => {
        const { month: paymentMonth, year: paymentYear } = getPaymentMonthYear(payment);
        return (
          matchesPaymentToUser(payment, user) &&
          Number(paymentMonth) === month &&
          Number(paymentYear) === safeYear
        );
      });
      const paid = monthPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      const bill = getEffectiveBillForPeriod(user, { month, year: safeYear });
      const previousBalance = runningBalance;
      const endingBalance = previousBalance + paid - bill;
      const computedStatus = resolveReportsBillingStatus({
        entry: {
          month,
          bill,
          paid,
          endingBalance,
          status: "Active",
        },
      });

      runningBalance = endingBalance;

      return {
        month,
        monthName,
        bill: Number(bill || 0),
        paid: Number(paid || 0),
        due: endingBalance < 0 ? Math.abs(endingBalance) : 0,
        advance: endingBalance > 0 ? endingBalance : 0,
        balance: endingBalance,
        status: computedStatus.label,
        previousBalance,
        endingBalance,
        raw: {
          startingBalance: previousBalance,
          endingBalance,
          monthEnded: currentDate.getTime() >= monthEnd.getTime(),
          isCurrentMonth:
            safeYear === currentDate.getFullYear() &&
            month === currentDate.getMonth() + 1,
        },
      };
    });
  }, [activePayments, selectedCustomer, year, yearlySummary?.openingBalance]);
  const yearOverview = useMemo(() => {
    const selectedYear = Number(year);
    const today = new Date();
    const yearStart = new Date(selectedYear, 0, 1);
    const yearEnd = new Date(selectedYear, 11, 31, 23, 59, 59);
    const rangeEnd =
      selectedYear === today.getFullYear()
        ? new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate(),
            23,
            59,
            59,
          )
        : yearEnd;

    const getPaymentDateValue = (payment) => {
      if (!payment) return null;
      const candidates = [
        payment?.paymentDate,
        payment?.createdAt,
        payment?.timestamp,
      ];
      for (const candidate of candidates) {
        if (!candidate) continue;
        if (typeof candidate?.toDate === "function") {
          const dateValue = candidate.toDate();
          if (dateValue instanceof Date && !Number.isNaN(dateValue.getTime())) {
            return dateValue;
          }
        }
        if (candidate instanceof Date && !Number.isNaN(candidate.getTime())) {
          return candidate;
        }
        if (typeof candidate === "string") {
          const parsedDate = new Date(candidate);
          if (!Number.isNaN(parsedDate.getTime())) return parsedDate;
        }
      }
      return null;
    };

    const collectionToDate = (activePayments || []).reduce((sum, payment) => {
      const { year: paymentYear } = getPaymentMonthYear(payment);
      if (Number(paymentYear) !== selectedYear) return sum;
      const paymentDate = getPaymentDateValue(payment);
      if (!paymentDate) return sum;
      if (paymentDate < yearStart || paymentDate > rangeEnd) return sum;
      return sum + Number(payment.amount || 0);
    }, 0);

    const annualBillForAllUsers = (users || []).reduce((sum, user) => {
      let monthTotal = 0;
      for (let month = 1; month <= 12; month += 1) {
        if (!isUserActiveForPeriod(user, { month, year: selectedYear })) continue;
        const bill = getEffectiveBillForPeriod(user, { month, year: selectedYear });
        monthTotal += Number(bill || 0);
      }
      return sum + monthTotal;
    }, 0);

    const remainingMonthsStart =
      selectedYear === today.getFullYear() ? today.getMonth() + 1 : 1;
    const remainingToCollect = (users || []).reduce((sum, user) => {
      let monthTotal = 0;
      for (let month = remainingMonthsStart; month <= 12; month += 1) {
        if (!isUserActiveForPeriod(user, { month, year: selectedYear })) continue;
        const bill = getEffectiveBillForPeriod(user, { month, year: selectedYear });
        monthTotal += Number(bill || 0);
      }
      return sum + monthTotal;
    }, 0);

    if (!selectedCustomer) {
      return {
        collection: collectionToDate,
        outstanding: Math.max(0, remainingToCollect - collectionToDate),
        annualBill: annualBillForAllUsers,
      };
    }

    return {
      collection: yearlySummary?.totalPaid || 0,
      outstanding: yearlySummary?.totalDue || 0,
      annualBill: yearlySummary?.annualBill || 0,
    };
  }, [activePayments, selectedCustomer, yearlySummary, users, year]);

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
        value: money(selectedCustomer ? annualBill : yearOverview.annualBill || 0),
        icon: <FiCreditCard />,
        accent: "ocean",
      },
      {
        label: `Paid ${year}`,
        value: money(selectedCustomer ? paidThisYear : yearOverview.collection || 0),
        icon: <FiDollarSign />,
        accent: "green",
      },
      {
        label: "Outstanding Balance",
        value: formatBalanceDisplayValue({
          due: selectedCustomer ? outstandingBalance : yearOverview.outstanding || 0,
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
      selectedCustomer,
      year,
      yearOverview,
    ],
  );

  const exportReport = () => {
    if (!selectedCustomer) return;
    exportAnnualCustomerPdf({
      businessName: "BillSheet",
      customer: selectedCustomer,
      year,
      summary: {
        openingBalance,
        previousDue,
        previousAdvance,
        annualBill,
        totalPaid: paidThisYear,
        paidThisYear,
        totalDue: outstandingBalance,
        outstandingBalance,
        totalAdvance: creditCarryForward,
        creditCarryForward,
        carryForward: creditCarryForward,
        remainingDue: outstandingBalance,
        remainingAdvance: creditCarryForward,
        closingBalance,
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

      <section className="reports-summary-grid reports-summary-grid--overview">
        <div className="reports-summary-card reports-summary-card--green">
          <div className="reports-summary-icon">
            <FiDollarSign />
          </div>
          <div className="reports-summary-copy">
            <div className="reports-summary-number">{money(yearOverview.collection)}</div>
            <div className="reports-summary-label">
              {selectedCustomer ? `Collected in ${year}` : `Total collection ${year}`}
            </div>
          </div>
        </div>
        <div className="reports-summary-card reports-summary-card--amber">
          <div className="reports-summary-icon">
            <FiAlertCircle />
          </div>
          <div className="reports-summary-copy">
            <div className="reports-summary-number">{money(yearOverview.outstanding)}</div>
            <div className="reports-summary-label">
              {selectedCustomer ? `Remaining unpaid in ${year}` : `Will collect till Dec ${year}`}
            </div>
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
                <div className="reports-summary-copy">
                  <div className="reports-summary-number">{card.value}</div>
                  <div className="reports-summary-label">{card.label}</div>
                </div>
              </div>
            ))}
          </section>

          <section className="reports-history-card">
            <div className="reports-history-head">
              <div>
                <div className="reports-history-kicker">Monthly activity</div>
                <h3>Payment History</h3>
              </div>
              <div className="reports-history-chip">12 months</div>
            </div>
            <div className="reports-history-table-wrap">
              <table className="reports-history-table">
                <thead>
                  <tr className="reports-history-row reports-history-row--head">
                    <th scope="col">Month</th>
                    <th scope="col">Bill</th>
                    <th scope="col">Paid</th>
                    <th scope="col">Balance</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyHistory.map((entry) => {
                    const billValue = Number(entry.bill ?? entry.monthlyBill ?? 0);
                    const paidValue = Number(entry.paid ?? 0);
                    const balanceValue = Number(entry.balance ?? entry.endingBalance ?? 0);
                    const isInactiveEntry =
                      entry.status === "Not Joined" ||
                      entry.status === "Inactive" ||
                      entry.status === "N/A";
                    const isPlaceholderRow = entry.isPlaceholder || entry.balance == null;
                    const balanceLabel = isInactiveEntry || isPlaceholderRow
                      ? "—"
                      : formatBalanceDisplayValue({
                          due: balanceValue < 0 ? Math.abs(balanceValue) : 0,
                          carryForward: balanceValue > 0 ? balanceValue : 0,
                        });
                    const computedStatus = isPlaceholderRow
                      ? { label: "—", tone: "neutral", className: "status-neutral" }
                      : resolveReportsBillingStatus({
                          entry: {
                            ...entry,
                            bill: billValue,
                            paid: paidValue,
                            endingBalance: balanceValue,
                            status: entry.status,
                          },
                          year,
                          currentDate: new Date(),
                        });
                    const computedStatusTone =
                      computedStatus.tone === "paid"
                        ? "paid"
                        : computedStatus.tone === "advance"
                          ? "positive"
                          : computedStatus.tone === "partial"
                            ? "pending"
                            : computedStatus.tone === "due"
                              ? "negative"
                              : computedStatus.tone === "pending"
                                ? "pending"
                                : "neutral";
                    const statusChipClass = `reports-history-status ${computedStatus.label === "N/A" ? "reports-history-status--neutral" : `reports-history-status--${computedStatus.tone}`}`;

                    return (
                      <tr className="reports-history-row" key={entry.month}>
                        <td>
                          <span className="reports-history-month-cell">
                            <span
                              className={`reports-history-status-dot reports-history-status-dot--${computedStatusTone}`}
                              aria-hidden="true"
                            />
                            <span>{entry.monthName}</span>
                          </span>
                        </td>
                        <td>
                          {isPlaceholderRow || isInactiveEntry ? "—" : money(billValue)}
                        </td>
                        <td>
                          {isPlaceholderRow || isInactiveEntry ? "—" : money(paidValue)}
                        </td>
                        <td style={balanceValue < 0 ? { color: "#EF4444" } : balanceValue > 0 ? { color: "#3B82F6" } : undefined}>
                          {balanceLabel}
                        </td>
                        <td>
                          {isPlaceholderRow || isInactiveEntry ? (
                            <span className="reports-history-status reports-history-status--neutral">—</span>
                          ) : (
                            <span className={statusChipClass}>{computedStatus.label}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="reports-footer-summary">
            <div>
              <div className="reports-footer-label">Opening Balance</div>
              <div className="reports-footer-value">
                {formatBalanceDisplayValue({
                  due: previousDue,
                  carryForward: previousAdvance,
                })}
              </div>
            </div>
            <div>
              <div className="reports-footer-label">Previous Year Due</div>
              <div className="reports-footer-value">{money(previousDue)}</div>
            </div>
            <div>
              <div className="reports-footer-label">Previous Year Advance</div>
              <div className="reports-footer-value">{money(previousAdvance)}</div>
            </div>
            <div>
              <div className="reports-footer-label">Annual Bill</div>
              <div className="reports-footer-value">{money(annualBill)}</div>
            </div>
            <div>
              <div className="reports-footer-label">Paid This Year</div>
              <div className="reports-footer-value">{money(paidThisYear)}</div>
            </div>
            <div>
              <div className="reports-footer-label">Remaining Due</div>
              <div className="reports-footer-value reports-footer-value--warning">
                {money(outstandingBalance)}
              </div>
            </div>
            <div>
              <div className="reports-footer-label">Remaining Advance</div>
              <div className="reports-footer-value reports-footer-value--credit">
                {money(creditCarryForward)}
              </div>
            </div>
            <div>
              <div className="reports-footer-label">Closing Balance</div>
              <div className="reports-footer-value">
                {formatBalanceDisplayValue({
                  due: outstandingBalance,
                  carryForward: creditCarryForward,
                })}
              </div>
            </div>
            <div>
              <div className="reports-footer-label">Carry Forward</div>
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
