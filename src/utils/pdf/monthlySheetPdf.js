import { createPdfLayout, downloadPdfDocument } from "./pdfLayout";
import {
  buildSummary,
  getStatusColor,
  pdfMoney,
  pdfBalance,
} from "./pdfHelpers";
import { formatDate, formatTime } from "../date";
import { getDisplayBalanceValues } from "../payments";

export async function exportMonthlySheetPdf({
  rows,
  month,
  year,
  companyName = "Bill Sheet",
  summary,
  theme = "forest",
}) {
  const { pdf, colors, startY, drawSummary, drawTable, drawFooter } =
    await createPdfLayout({
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

    columnStyles: {
      0: {
        cellWidth: 10,
        halign: "center",
      },

      1: {
        cellWidth: 42,
        halign: "left",
      },

      2: {
        cellWidth: 20,
        halign: "right",
      },

      3: {
        cellWidth: 20,
        halign: "right",
      },

      4: {
        cellWidth: 22,
        halign: "right",
      },

      5: {
        cellWidth: 20,
        halign: "center",
      },

      6: {
        cellWidth: 43,
        halign: "center",
      },
    },
    head: [["SL", "Customer", "Bill", "Paid", "Due", "Status", "Payment Date"]],

    body: [...rows]
      .sort((a, b) =>
        String(a.user?.name || "").localeCompare(
          String(b.user?.name || ""),
          "en",
          { sensitivity: "base" },
        ),
      )
      .map((row, index) => {
        const displayBalance = getDisplayBalanceValues({
          due: row.due,
          carryForward: row.carryForward,
          currentDue: row.currentDue,
          currentAdvance: row.currentAdvance,
          bill: row.bill || row.user?.monthlyBill || 0,
          amount: Number(row.currentPaid || 0),
          previousDue: Number(row.openingDue || row.previousDue || 0),
          previousAdvance: Number(
            row.openingAdvance || row.previousAdvance || 0,
          ),
          previousPaid: Number(row.previousPaid || 0),
          additionalDue: Number(row.additionalDue || 0),
        });

        return [
          index + 1,
          row.user.name,
          pdfMoney(row.bill || row.user?.monthlyBill || 0),
          pdfMoney(row.currentPaid || 0),
          pdfBalance({
            due: displayBalance.due,
            carryForward: displayBalance.carryForward,
          }),
          row.status || "Pending",
          row.payment?.paymentDate
            ? `${formatDate(row.payment.paymentDate)} ${formatTime(
                row.payment.paymentDate,
              )}`
            : "-",
        ];
      }),

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

  pdf.setPage(pdf.getNumberOfPages());

  drawFooter();

  return downloadPdfDocument(pdf, `Billing Sheet - ${month} ${year}.pdf`);
}
