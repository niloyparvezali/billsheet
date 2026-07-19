import { createPdfLayout } from "./pdfLayout";
import {
  buildSummary,
  getStatusColor,
  pdfMoney,
  pdfBalance,
} from "./pdfHelpers";
import { money } from "../date";

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

    body: rows.map((row) => [
      row.Customer,
      row.Month,
      pdfMoney(row.Amount),
      pdfBalance({
        due: row.Due,
        carryForward: row.CarryForward,
      }),
      row.Status,
      row.PaymentDate,
    ]),

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

  drawFooter();

  pdf.save(`Bill Sheet Transaction History ${reportYear}.pdf`);
}
