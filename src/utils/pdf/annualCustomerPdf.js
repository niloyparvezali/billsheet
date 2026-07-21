import { createPdfLayout } from "./pdfLayout";
import { pdfMoney, pdfBalance } from "./pdfHelpers";
import { getDisplayBalanceValues, getDisplayPaymentStatus } from "../payments";
import { formatDate } from "../date";
export function exportAnnualCustomerPdf({
  businessName = "Bill Sheet",
  customer,
  year,
  summary,
  history,
  theme = "forest",
}) {
  const { pdf, startY, drawSummary, drawTable, drawFooter } = createPdfLayout({
    reportTitle: "Annual Customer Report",
    companyName: businessName,
    theme,
    reportInfo: [
      {
        label: "Customer",
        value: customer?.name || "Customer",
      },
      {
        label: "Year",
        value: year,
      },
    ],
  });
  let currentY = drawSummary(
    [
      [
        "Opening Balance",
        pdfBalance({
          due: Number(summary.previousDue || 0),
          carryForward: Number(summary.previousAdvance || 0),
        }),
      ],
      ["Previous Year Due", pdfMoney(summary.previousDue || 0)],
      ["Previous Year Advance", pdfMoney(summary.previousAdvance || 0)],
      ["Annual Bill", pdfMoney(summary.annualBill || 0)],
      [
        "Paid This Year",
        pdfMoney(summary.paidThisYear || summary.totalPaid || 0),
      ],
      [
        "Remaining Due",
        pdfBalance({
          due: summary.remainingDue || summary.outstandingBalance || summary.totalDue || 0,
          carryForward: 0,
        }),
      ],
      [
        "Remaining Advance",
        pdfBalance({
          due: 0,
          carryForward:
            summary.remainingAdvance ||
            summary.creditCarryForward ||
            summary.carryForward ||
            summary.totalAdvance ||
            0,
        }),
      ],
      [
        "Closing Balance",
        pdfBalance({
          due: Number(summary.closingBalance || 0) > 0 ? Number(summary.closingBalance || 0) : 0,
          carryForward:
            Number(summary.closingBalance || 0) < 0
              ? Math.abs(Number(summary.closingBalance || 0))
              : 0,
        }),
      ],
      [
        "Carry Forward",
        pdfBalance({
          due: 0,
          carryForward:
            summary.remainingAdvance ||
            summary.creditCarryForward ||
            summary.carryForward ||
            summary.totalAdvance ||
            0,
        }),
      ],
      ["Status", summary.balanceStatus || "Account Settled"],
    ],
    startY,
  );
  drawTable({
    startY: currentY,

    head: [["Month", "Bill", "Paid", "Balance", "Status"]],

    body: history.map((entry) => {
      const balanceValue = Number(entry.balance ?? entry.endingBalance ?? 0);
      const isInactiveEntry =
        entry?.status === "Not Joined" ||
        entry?.status === "Inactive" ||
        entry?.status === "N/A" ||
        entry?.status === "na";

      return [
        entry.monthName || "-",

        isInactiveEntry || entry.bill == null ? "-" : pdfMoney(entry.monthlyBill ?? entry.bill ?? 0),

        isInactiveEntry || entry.paid == null ? "-" : pdfMoney(entry.paid ?? 0),

        isInactiveEntry || entry.balance == null
          ? "-"
          : pdfBalance({
              due: balanceValue < 0 ? Math.abs(balanceValue) : 0,
              carryForward: balanceValue > 0 ? balanceValue : 0,
            }),

        isInactiveEntry ? "-" : entry.status || "-",
      ];
    }),
  });
  drawFooter();

  pdf.save(
    `Annual Customer Report - ${customer?.name || "Customer"} - ${year}.pdf`,
  );
}
