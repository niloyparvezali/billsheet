import { createPdfLayout } from "./pdfLayout";

export function exportUsersPdf({
  users,
  companyName = "Bill Sheet",
  theme = "forest",
}) {
  const { pdf, startY, drawSummary, drawTable, drawFooter } = createPdfLayout({
    reportTitle: "Customer List",
    companyName,
    theme,
    reportInfo: [
      {
        label: "Total Customers",
        value: users.length,
      },
    ],
  });

  let currentY = drawSummary([["Total Customers", users.length]], startY);

  drawTable({
    startY: currentY,

    head: [["SL", "Customer", "Phone", "Monthly Bill", "Status", "Join Date"]],

    body: users.map((user, index) => [
      index + 1,
      user.name,
      user.phone,
      user.monthlyBill,
      user.active ? "Active" : "Inactive",
      user.joinDate || "-",
    ]),
  });

  drawFooter();

  pdf.save("Customer List.pdf");
}
