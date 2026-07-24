import { createPdfLayout } from "./pdfLayout";
import {
  buildSummary,
  getStatusColor,
  pdfMoney,
  pdfBalance,
} from "./pdfHelpers";
import { money, formatDate, formatTime } from "../date";
import { getDisplayBalanceValues, getDisplayPaymentStatus } from "../payments";

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

    columnStyles: {
      0: {
        cellWidth: 12,
        halign: "center",
      },

      1: {
        cellWidth: 46,
        halign: "left",
      },

      2: {
        cellWidth: 22,
        halign: "right",
      },

      3: {
        cellWidth: 22,
        halign: "right",
      },

      4: {
        cellWidth: 24,
        halign: "right",
      },

      5: {
        cellWidth: 22,
        halign: "center",
      },

      6: {
        cellWidth: 42,
        halign: "center",
      },
    },

    head: [["SL", "Customer", "Bill", "Paid", "Due", "Status", "Payment Date"]],

    body: rows.map((row, index) => {
      const displayBalance = getDisplayBalanceValues({
        due: row.due,
        carryForward: row.carryForward,
        currentDue: row.currentDue,
        currentAdvance: row.currentAdvance,
        bill: Number(row.user?.monthlyBill || 0),
        amount: Number(row.currentPaid || 0),
        previousDue: Number(row.openingDue || row.previousDue || 0),
        previousAdvance: Number(row.openingAdvance || row.previousAdvance || 0),
        previousPaid: Number(row.previousPaid || 0),
        additionalDue: Number(row.additionalDue || 0),
      });

      return [
        index + 1,
        row.user.name,
        pdfMoney(row.user.monthlyBill),
        pdfMoney(row.currentPaid || 0),
        pdfBalance({
          due: displayBalance.due,
          carryForward: displayBalance.carryForward,
        }),
        getDisplayPaymentStatus({
          status: row.status,
          bill: Number(row.user?.monthlyBill || 0),
          paid: Number(row.currentPaid || 0),
          due: Number(displayBalance.due || 0),
          advance: Number(displayBalance.carryForward || 0),
          month: Number(row.month || 0),
          currentMonth: new Date().getMonth() + 1,
          currentDate: new Date(),
        }).label,
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

  pdf.save(`Monthly Sheet - ${month} ${year}.pdf`);
}
