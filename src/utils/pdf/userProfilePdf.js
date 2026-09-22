import { autoTable } from "jspdf-autotable";
import { createPdfLayout, downloadPdfDocument } from "./pdfLayout";
import { pdfMoney } from "./pdfHelpers";
import { formatDate, formatTime } from "../date";

const toDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "object" && typeof value.seconds === "number") {
    return new Date(
      value.seconds * 1000 +
        (typeof value.nanoseconds === "number"
          ? Math.floor(value.nanoseconds / 1e6)
          : 0),
    );
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const signedMoney = (value) => {
  const amount = Number(value || 0);
  if (amount < 0) return `- ${pdfMoney(Math.abs(amount))}`;
  if (amount > 0) return `+ ${pdfMoney(amount)}`;
  return pdfMoney(0);
};

const balanceLabel = (value) => {
  const amount = Number(value || 0);
  if (amount < 0) return `Due ${pdfMoney(Math.abs(amount))}`;
  if (amount > 0) return `Advance ${pdfMoney(amount)}`;
  return pdfMoney(0);
};

const safeFilePart = (value) =>
  String(value || "Customer")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80) || "Customer";

const drawSectionTitle = (pdf, colors, title, y) => {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(...colors.primary);
  pdf.text(title, 15, y);
  pdf.setDrawColor(...colors.border);
  pdf.setLineWidth(0.25);
  pdf.line(15, y + 2, pdf.internal.pageSize.getWidth() - 15, y + 2);
  return y + 8;
};

const drawProfileTable = (pdf, colors, { head, body, startY, columnStyles = {} }) => {
  autoTable(pdf, {
    startY,
    head,
    body,
    margin: { top: 15, bottom: 15, left: 15, right: 15 },
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 2.4,
      overflow: "linebreak",
      valign: "middle",
      textColor: colors.text,
      lineColor: colors.border,
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: colors.primary,
      textColor: colors.white,
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250],
    },
    columnStyles,
    rowPageBreak: "avoid",
  });

  return pdf.lastAutoTable?.finalY || startY;
};

export async function exportUserProfilePdf({
  user,
  statement,
  generatedAt = new Date(),
  companyName = "Bill Sheet",
  theme = "forest",
}) {
  if (!user) {
    throw new Error("Customer information is unavailable.");
  }

  if (!statement) {
    throw new Error("Customer financial history is unavailable.");
  }

  const memberships = Array.isArray(statement.membershipPeriods)
    ? statement.membershipPeriods
    : [];
  const monthRows = Array.isArray(statement.monthRows)
    ? statement.monthRows
    : [];
  const paymentEvents = Array.isArray(statement.paymentEvents)
    ? statement.paymentEvents
    : [];

  const firstJoin = memberships[0]?.joinDate || user?.joinDate || user?.joinedAt;
  const latestMembership = memberships[memberships.length - 1] || null;
  const leaveDate =
    latestMembership?.leaveDate ||
    (memberships.length === 1 ? user?.leaveDate : null);

  const { pdf, colors, startY, drawSummary, drawFooter } = await createPdfLayout({
    reportTitle: "Customer Financial Profile",
    companyName,
    theme,
    reportInfo: [
      { label: "Customer", value: user?.name || "Unnamed customer" },
      { label: "User ID", value: user?.customerId || user?.id || "-" },
      { label: "Phone", value: user?.phone || "Not available" },
      { label: "First Joined", value: formatDate(firstJoin, "Not available") },
      {
        label: "Status",
        value: latestMembership?.leaveDate ? "Inactive" : user?.status || "Active",
      },
      {
        label: "Leave Date",
        value: leaveDate ? formatDate(leaveDate) : "Active",
      },
      {
        label: "Monthly Bill",
        value: pdfMoney(statement?.monthRows?.find((row) => row.activeForPeriod)?.bill || user?.monthlyBill || 0),
      },
      {
        label: "Current Date",
        value: formatDate(generatedAt, "Not available"),
      },
    ],
  });

  let currentY = drawSummary(
    [
      ["Total Bill", pdfMoney(statement.totalBilled)],
      ["Total Paid", pdfMoney(statement.totalPaid)],
      ["Additional Due", pdfMoney(statement.totalAdditionalDue)],
      ["Current Balance", signedMoney(statement.currentBalance)],
      ["Financial State", balanceLabel(statement.currentBalance)],
      ["Payment Events", paymentEvents.length],
    ],
    startY,
  );

  currentY = drawSectionTitle(pdf, colors, "MEMBERSHIP HISTORY", currentY);

  const membershipBody = memberships.length
    ? memberships.map((period, index) => [
        `Period ${index + 1}`,
        formatDate(period.joinDate, "Not available"),
        period.leaveDate ? formatDate(period.leaveDate) : "Active",
      ])
    : [["-", "Not available", "Active"]];

  currentY =
    drawProfileTable(pdf, colors, {
      startY: currentY,
      head: [["Period", "Joined", "Left / State"]],
      body: membershipBody,
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 55 },
        2: { cellWidth: 58 },
      },
    }) + 10;

  currentY = drawSectionTitle(pdf, colors, "MONTHLY FINANCIAL HISTORY", currentY);

  const financialBody = [];
  monthRows.forEach((monthRow) => {
    if (monthRow.paymentRows.length) {
      monthRow.paymentRows.forEach((paymentRow) => {
        const timestamp = paymentRow.paymentDate;
        const dateText = timestamp
          ? `${formatDate(timestamp)} ${formatTime(timestamp)}`
          : "-";
        financialBody.push([
          monthRow.periodLabel,
          monthRow.activeForPeriod ? pdfMoney(monthRow.bill) : "Inactive",
          dateText,
          pdfMoney(paymentRow.paymentAmount),
          signedMoney(paymentRow.balanceAfter),
        ]);
      });
      return;
    }

    financialBody.push([
      monthRow.periodLabel,
      monthRow.activeForPeriod ? pdfMoney(monthRow.bill) : "Inactive",
      "-",
      pdfMoney(0),
      signedMoney(monthRow.closingBalance),
    ]);
  });

  if (!financialBody.length) {
    financialBody.push(["-", pdfMoney(0), "-", pdfMoney(0), pdfMoney(0)]);
  }

  currentY =
    drawProfileTable(pdf, colors, {
      startY: currentY,
      head: [["Month", "Bill", "Payment Date / Time", "Paid", "Balance After"]],
      body: financialBody,
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 25, halign: "right" },
        2: { cellWidth: 49 },
        3: { cellWidth: 25, halign: "right" },
        4: { cellWidth: 38, halign: "right" },
      },
    }) + 10;

  if (paymentEvents.length) {
    currentY = drawSectionTitle(pdf, colors, "PAYMENT HISTORY", currentY);

    const paymentBody = paymentEvents.map((payment) => {
      const date = toDate(
        payment?.paymentDate ||
          payment?.createdAt ||
          payment?.timestamp ||
          payment?.paymentDateText,
      );
      const isActive = !payment?.isDeleted && !payment?.deletedAt &&
        !["removed", "voided", "reversed", "deleted", "cancelled", "canceled", "failed", "declined"]
          .includes(String(payment?.status || "").trim().toLowerCase());

      return [
        date ? formatDate(date) : "-",
        date ? formatTime(date) : payment?.paymentTime || "-",
        payment?.paymentType || payment?.transactionType || "Payment",
        pdfMoney(payment?.amount || 0),
        isActive ? "Active" : "Voided / excluded",
        payment?.transactionId || payment?.id || "-",
      ];
    });

    currentY =
      drawProfileTable(pdf, colors, {
        startY: currentY,
        head: [["Date", "Time", "Type", "Amount", "State", "Transaction ID"]],
        body: paymentBody,
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 22 },
          2: { cellWidth: 34 },
          3: { cellWidth: 25, halign: "right" },
          4: { cellWidth: 34 },
          5: { cellWidth: 40 },
        },
      }) + 10;
  }

  currentY = drawSectionTitle(pdf, colors, "FINAL FINANCIAL SUMMARY", currentY);

  drawSummary(
    [
      ["Total Bill", pdfMoney(statement.totalBilled)],
      ["Total Paid", pdfMoney(statement.totalPaid)],
      ["Current Due", pdfMoney(statement.currentDue)],
      ["Current Advance", pdfMoney(statement.currentAdvance)],
      ["Current Balance", signedMoney(statement.currentBalance)],
      ["Status", balanceLabel(statement.currentBalance)],
    ],
    currentY,
  );

  pdf.setPage(pdf.getNumberOfPages());
  drawFooter();

  const filename = `BillSheet-${safeFilePart(user.name)}-Profile.pdf`;
  downloadPdfDocument(pdf, filename);
}
