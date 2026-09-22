import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { getPdfTheme } from "./pdfTheme";
import { formatReportDate } from "./pdfHelpers";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function hasPngSignature(bytes) {
  if (!bytes || bytes.length < PNG_SIGNATURE.length) return false;
  return PNG_SIGNATURE.every((value, index) => bytes[index] === value);
}

async function loadLogoDataUrl() {
  if (typeof fetch !== "function") return null;

  // The logo is optional. Try the branded PDF asset first, then the existing
  // application favicon as a bundled fallback. Never pass an unvalidated
  // response to jsPDF: Vercel's SPA rewrite can otherwise return index.html
  // for a missing /bs-logo.png and jsPDF will report "wrong PNG signature".
  const candidates = ["/bs-logo.png", "/favicon.png"];

  for (const assetUrl of candidates) {
    try {
      const response = await fetch(assetUrl, { cache: "no-store" });
      if (!response.ok) continue;

      const contentType = String(
        response.headers?.get?.("content-type") || "",
      )
        .split(";", 1)[0]
        .trim()
        .toLowerCase();

      // A valid image/png response is preferred. If the server omits the
      // content type, the binary signature below remains authoritative.
      if (contentType && contentType !== "image/png") continue;

      const blob = await response.blob();
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      if (!hasPngSignature(bytes)) continue;

      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Failed to read PDF logo."));
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.warn(`Unable to load Bill Sheet PDF logo asset ${assetUrl}:`, error);
    }
  }

  return null;
}

export function downloadPdfDocument(pdf, filename) {
  if (!pdf || typeof pdf.output !== "function") {
    throw new Error("PDF document was not created.");
  }

  const safeFilename =
    String(filename || "BillSheet.pdf").replace(/[\\/:*?"<>|]+/g, "-").trim() ||
    "BillSheet.pdf";

  // Generate an ArrayBuffer first so we can verify the actual PDF payload
  // before attempting a browser download.
  const arrayBuffer = pdf.output("arraybuffer");

  if (
    !(arrayBuffer instanceof ArrayBuffer) ||
    arrayBuffer.byteLength < 100
  ) {
    throw new Error("The generated PDF is empty or incomplete.");
  }

  const header = new TextDecoder().decode(
    new Uint8Array(arrayBuffer.slice(0, 5)),
  );

  if (header !== "%PDF-") {
    throw new Error("The generated PDF payload is invalid.");
  }

  const blob = new Blob([arrayBuffer], { type: "application/pdf" });

  if (
    typeof document === "undefined" ||
    typeof URL === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    if (typeof pdf.save === "function") {
      pdf.save(safeFilename);
      return { filename: safeFilename, size: blob.size };
    }
    throw new Error("Browser download APIs are unavailable.");
  }

  // Support legacy Edge environments when present.
  if (typeof navigator !== "undefined" && typeof navigator.msSaveOrOpenBlob === "function") {
    navigator.msSaveOrOpenBlob(blob, safeFilename);
    return { filename: safeFilename, size: blob.size };
  }

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  try {
    link.href = objectUrl;
    link.download = safeFilename;
    link.rel = "noopener";
    link.style.display = "none";
    document.body.appendChild(link);

    if (typeof link.click !== "function") {
      throw new Error("Browser download is not supported.");
    }

    link.click();
  } finally {
    link.remove();
    // Keep the URL alive briefly so mobile browsers have time to consume it.
    const scheduleCleanup =
      typeof globalThis?.setTimeout === "function"
        ? globalThis.setTimeout.bind(globalThis)
        : null;

    if (scheduleCleanup) scheduleCleanup(() => {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        // Cleanup failure does not affect the generated PDF.
      }
    }, 1500);
  }

  return { filename: safeFilename, size: blob.size };
}

export async function createPdfLayout({
  reportTitle,
  companyName = "",
  reportInfo = [],
  theme = "forest",
}) {
  if (typeof autoTable !== "function") {
    throw new Error("PDF table generator is unavailable.");
  }

  const pdf = new jsPDF("p", "mm", "a4");

  const colors = getPdfTheme(theme);

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const logoDataUrl = await loadLogoDataUrl();

  // =============================
  // Header
  // =============================

  const drawHeader = () => {
    // Header Background
    pdf.setFillColor(...colors.primary);
    pdf.rect(0, 0, pageWidth, 34, "F");

    const logoX = 15;
    const logoY = 7;
    const logoWidth = 9;
    const logoHeight = 9;

    let logoRendered = false;

    if (logoDataUrl) {
      try {
        pdf.addImage(logoDataUrl, "PNG", logoX, logoY, logoWidth, logoHeight);
        logoRendered = true;
      } catch (error) {
        // Logo rendering is optional and must never prevent a financial PDF
        // from being generated. The source has already been binary-validated;
        // this protects against browser/jsPDF-specific image decoder issues.
        console.warn("Unable to render Bill Sheet PDF logo; continuing without it:", error);
      }
    }

    const titleX = logoRendered ? logoX + logoWidth + 4 : 15;

    // Brand
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(24);

    pdf.setTextColor(...colors.white);
    pdf.text("Bill", titleX, 15);

    const billWidth = pdf.getTextWidth("Bill ");

    pdf.setTextColor(...colors.accent);
    pdf.text("Sheet", titleX + billWidth, 15);

    // Report Title
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...colors.white);
    pdf.text(reportTitle, 15, 24);

    // Decorative Line
    pdf.setDrawColor(...colors.accent);
    pdf.setLineWidth(1);
    pdf.line(0, 34, pageWidth, 34);
  };

  // =============================
  // Report Information
  // =============================

  const drawReportInfo = () => {
    let y = 44;

    pdf.setFontSize(10);

    const leftX = 15;
    const rightX = 110;

    if (companyName) {
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...colors.text);
      pdf.text("Company", leftX, y);

      pdf.setFont("helvetica", "normal");
      pdf.text(companyName, leftX + 30, y);

      y += 8;
    }

    reportInfo.forEach((item, index) => {
      const x = index % 2 === 0 ? leftX : rightX;

      if (index % 2 === 0 && index !== 0) {
        y += 8;
      }

      pdf.setFont("helvetica", "bold");
      pdf.text(item.label, x, y);

      pdf.setFont("helvetica", "normal");
      pdf.text(String(item.value), x + 30, y);
    });

    y += 10;

    pdf.setFont("helvetica", "bold");
    pdf.text("Generated", leftX, y);

    pdf.setFont("helvetica", "normal");
    pdf.text(formatReportDate(), leftX + 30, y);

    return y + 8;
  };

  // =============================
  // Summary
  // =============================

  const drawSummary = (summaryRows, startY) => {
    autoTable(pdf, {
      startY,

      theme: "grid",

      head: [["Summary", "Value"]],

      body: summaryRows,

      headStyles: {
        fillColor: colors.secondary,
        textColor: colors.white,
      },

      styles: {
        fontSize: 10,
        cellPadding: 3,
      },
    });

    return (pdf.lastAutoTable?.finalY || startY) + 8;
  };
  // =============================
  // Table
  // =============================

  const drawTable = ({
    head,
    body,
    startY,
    didParseCell,
    columnStyles = {},
  }) => {
    autoTable(pdf, {
      margin: {
        top: 15,
        bottom: 15,
        left: 15,
        right: 15,
      },

     startY,

      head,

      body,

      styles: {
        font: "helvetica",
        fontSize: 8.5,

        cellPadding: {
          top: 2.8,
          bottom: 2.8,
          left: 2,
          right: 2,
        },

        valign: "middle",

        overflow: "ellipsize",

        cellWidth: "wrap",

        minCellHeight: 8,

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
      didParseCell,

      didDrawPage: () => {},
    });
  };

  // =============================
  // Footer
  // =============================

  const drawFooter = () => {
    pdf.setFontSize(9);
    pdf.setTextColor(...colors.footer);

    pdf.text("Generated by Bill Sheet", pageWidth / 2, pageHeight - 8, {
      align: "center",
    });

    pdf.setFontSize(8);

    pdf.setTextColor(220, 38, 38);

    pdf.text("Dev.WhiteSauce", pageWidth / 2, pageHeight - 3, {
      align: "center",
    });
  };

  drawHeader();

  const startY = drawReportInfo();

  return {
    pdf,
    colors,
    drawSummary,
    drawTable,
    drawFooter,
    startY,
  };
}
