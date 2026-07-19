import { createPdfLayout } from "./pdfLayout";
import { pdfMoney, pdfBalance } from "./pdfHelpers";
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
      ["Previous Due", pdfMoney(summary.previousDue || 0)],
      ["Annual Bill", pdfMoney(summary.annualBill || 0)],
      [
        "Paid This Year",
        pdfMoney(summary.paidThisYear || summary.totalPaid || 0),
      ],
      [
        "Remaining Due",
        pdfBalance({
          due: summary.outstandingBalance || summary.totalDue || 0,
          carryForward: 0,
        }),
      ],
      [
        "Carry Forward",
        pdfBalance({
          due: 0,
          carryForward:
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

    head: [["Month", "Bill", "Paid", "Remaining", "Payment Date", "Status"]],

    body: history.map((entry) => [
      entry.monthName || "-",

      pdfMoney(entry.monthlyBill ?? entry.bill ?? 0),

      pdfMoney(entry.paid ?? 0),

      pdfBalance({
        due: entry.remainingDue ?? entry.due ?? 0,
        carryForward: entry.advance ?? entry.carryForward ?? 0,
      }),

      entry.paymentDate ? formatDate(entry.paymentDate) : "-",

      entry.status || "-",
    ]),
  });
  drawFooter();

  pdf.save(
    `Annual Customer Report - ${customer?.name || "Customer"} - ${year}.pdf`,
  );
}
