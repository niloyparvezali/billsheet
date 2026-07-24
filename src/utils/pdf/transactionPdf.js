import { createPdfLayout } from "./pdfLayout";
import {
  buildSummary,
  getStatusColor,
  pdfMoney,
  pdfBalance,
} from "./pdfHelpers";
import { money } from "../date";
import { getDisplayBalanceValues, getDisplayPaymentStatus } from "../payments";

export function exportTransactionPdf({
  rows,
  companyName = "Bill Sheet",
  theme = "forest",
  year,
}) {
  const reportYear = Number(year) || new Date().getFullYear();
  const { pdf, colors, startY, drawSummary, drawTable, drawFooter } =
    createPdfLayout({
      reportTitle: "Transaction History",
      companyName,
      theme,
      reportInfo: [
        {
          label: "Year",
          value: reportYear,
        },
        {
          label: "Total Transactions",
          value: rows.length,
        },
      ],
    });

  const totalCollection = rows.reduce(
    (sum, row) => sum + Number(row.Amount || 0),
    0,
  );

  const currentY = drawSummary(
    buildSummary({
      totalUsers: rows.length,
      paidUsers: "-",
      pendingUsers: "-",
      totalBill: "-",
      totalCollection: money(totalCollection),
      totalDue: "-",
    }),
    startY,
  );

  drawTable({
    startY: currentY,

    head: [["Name", "Month", "Amount", "Balance", "Status", "Date"]],

    body: rows.map((row) => {
      const displayBalance = getDisplayBalanceValues({
        due: row.Due,
        carryForward: row.CarryForward,
        currentDue: row.CurrentDue,
        currentAdvance: row.CurrentAdvance,
        bill: Number(row.Bill || 0),
        amount: Number(row.Amount || 0),
        previousDue: Number(row.PreviousDue || 0),
        previousAdvance: Number(row.PreviousAdvance || 0),
        previousPaid: Number(row.PreviousPaid || 0),
        additionalDue: Number(row.AdditionalDue || 0),
      });

      return [
        row.Customer,
        row.Month,
        pdfMoney(row.Amount),
        pdfBalance({
          due: displayBalance.due,
          carryForward: displayBalance.carryForward,
        }),
        getDisplayPaymentStatus({
          status: row.Status,
          bill: Number(row.Bill || 0),
          paid: Number(row.Amount || 0),
          due: Number(displayBalance.due || 0),
          advance: Number(displayBalance.carryForward || 0),
          month: Number(row.Month || 0),
          currentMonth: new Date().getMonth() + 1,
          currentDate: new Date(),
        }).label,
        row.PaymentDate,
      ];
    }),

    didParseCell(data) {
      if (data.section !== "body") return;

      // Amount
      if (data.column.index === 2) {
        data.cell.styles.halign = "right";
      }

      // Balance
      if (data.column.index === 3) {
        data.cell.styles.halign = "right";
      }

      // Status
      if (data.column.index === 4) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.halign = "center";
        data.cell.styles.textColor = getStatusColor(
          colors,
          String(data.cell.raw),
        );
      }
    },
  });

  pdf.setPage(pdf.getNumberOfPages());

drawFooter();

  pdf.save(`Bill Sheet Transaction History ${reportYear}.pdf`);
}
