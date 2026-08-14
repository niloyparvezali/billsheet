import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPdf = {
  internal: {
    pageSize: {
      getWidth: () => 210,
      getHeight: () => 297,
    },
  },
  setFillColor: vi.fn(),
  rect: vi.fn(),
  setFont: vi.fn(),
  setFontSize: vi.fn(),
  setTextColor: vi.fn(),
  text: vi.fn(),
  getTextWidth: vi.fn((value) => value.length * 2.5),
  setDrawColor: vi.fn(),
  setLineWidth: vi.fn(),
  line: vi.fn(),
  addImage: vi.fn(),
  setPage: vi.fn(),
  lastAutoTable: { finalY: 40 },
  save: vi.fn(),
};

const jsPDFMock = vi.fn(function () {
  return mockPdf;
});

vi.mock("jspdf", () => ({
  default: jsPDFMock,
}));

vi.mock("jspdf-autotable", () => ({
  default: vi.fn(),
}));

describe("pdfLayout header branding", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () =>
        new Blob(["fake-logo"], {
          type: "image/png",
        }),
    });
  });

  it("adds the Bill Sheet logo before the Bill Sheet title in the header", async () => {
    const { createPdfLayout } = await import("./pdfLayout");

    await createPdfLayout({
      reportTitle: "Monthly Collection Report",
    });

    expect(mockPdf.addImage).toHaveBeenCalledTimes(1);
    expect(mockPdf.addImage.mock.calls[0][0]).toContain("data:image/png;base64,");
    expect(mockPdf.text.mock.calls.some(([value]) => value === "Bill")).toBe(true);
    expect(mockPdf.text.mock.calls.some(([value]) => value === "Sheet")).toBe(true);
  });
});
