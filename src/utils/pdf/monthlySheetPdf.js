import { createPdfLayout } from "./pdfLayout";
import {
  buildSummary,
  getStatusColor,
  pdfMoney,
  pdfBalance,
} from "./pdfHelpers";
import { money, formatDate, formatTime } from "../date";
import { formatBalanceDisplayValue } from "../payments";

export function exportMonthlySheetPdf({
  rows,
  month,
  year,
  companyName = "Bill Sheet",
  summary,
  theme = "forest",
}) {
  const { pdf, colors, startY, drawSummary, drawTable, drawFooter } =
    createPdfLayout({
      reportTitle: "Monthly Collection Report",
      companyName,
      theme,
      reportInfo: [
        {
          label: "Month",
          value: `${month} ${year}`,
        },
      ],
    });

  // ========= Summary =========

  let currentY = drawSummary(
    buildSummary({
      totalUsers: summary.totalUsers,
      paidUsers: summary.paidUsers,
      pendingUsers: summary.pendingUsers,
      totalBill: pdfMoney(summary.totalBill),
      totalCollection: pdfMoney(summary.totalCollection),
      totalDue: pdfBalance({
        due: summary.due ?? 0,
        carryForward: summary.carryForward ?? 0,
      }),
    }),
    startY,
  );

  // ========= Customer Table =========

  drawTable({
    startY: currentY,

    head: [["SL", "Customer", "Bill", "Paid", "Due", "Status", "Payment Date"]],

    body: rows.map((row, index) => [
      index + 1,
      row.user.name,
      pdfMoney(row.user.monthlyBill),
      pdfMoney(row.currentPaid || 0),
      pdfBalance({
        due: row.due,
        carryForward: row.carryForward,
      }),
      row.status,
      row.payment?.paymentDate
        ? `${formatDate(row.payment.paymentDate)} ${formatTime(
            row.payment.paymentDate,
          )}`
        : "-",
    ]),

    didParseCell(data) {
      if (data.section !== "body") return;

      // Status Column
      if (data.column.index === 5) {
        const status = String(data.cell.raw || "").toLowerCase();

        data.cell.styles.fontStyle = "bold";
        data.cell.styles.halign = "center";

        switch (status) {
          case "paid":
            data.cell.styles.textColor = colors.success;
            break;

          case "partial":
            data.cell.styles.textColor = colors.warning;
            break;

          case "pending":
            data.cell.styles.textColor = colors.danger;
            break;

          case "advance":
            data.cell.styles.textColor = colors.info;
            break;

          default:
            data.cell.styles.textColor = colors.text;
        }
      }
    },
  });

  drawFooter();

  pdf.save(`Monthly Sheet - ${month} ${year}.pdf`);
}
