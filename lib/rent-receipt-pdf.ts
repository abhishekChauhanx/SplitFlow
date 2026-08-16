import PDFDocument from "pdfkit";

interface ReceiptData {
  receiptId: string;
  tenantName: string;
  landlordName: string;
  landlordPan: string | null;
  propertyAddress: string;
  amountPaise: number;
  paymentPeriodFrom: Date;
  paymentPeriodTo: Date;
  utrNumber: string | null;
  paidAt: Date;
  signedAt: Date | null;
}

const NAVY = "#1e3a5f";
const NAVY_DARK = "#0f2540";
const GREEN = "#16a34a";
const AMBER = "#d97706";
const GRAY_LIGHT = "#f3f4f6";
const GRAY_TEXT = "#6b7280";
const GRAY_BORDER = "#e5e7eb";
const INK = "#111827";

export function generateRentReceiptPdf(data: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageW = doc.page.width;
    const marginX = 50;
    const contentW = pageW - marginX * 2;

    const rupees = (data.amountPaise / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const formatDate = (d: Date) =>
      d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

    // ── Header band ──
    doc.rect(0, 0, pageW, 110).fill(NAVY);
    doc.rect(0, 0, pageW, 110).fillOpacity(1);

    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(22)
      .text("RENT RECEIPT", marginX, 34);
    doc.font("Helvetica").fontSize(9).fillColor("#c7d6e8")
      .text("Auto-generated and verified via SplitFlow", marginX, 62);

    // Status pill, top right
    const isSigned = !!data.signedAt;
    const pillLabel = isSigned ? "SIGNED" : "PENDING SIGNATURE";
    const pillColor = isSigned ? GREEN : AMBER;
    const pillW = doc.widthOfString(pillLabel, { font: "Helvetica-Bold", size: 9 }) + 24;
    const pillX = pageW - marginX - pillW;
    doc.roundedRect(pillX, 36, pillW, 20, 10).fill(pillColor);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(9)
      .text(pillLabel, pillX, 42, { width: pillW, align: "center" });

    doc.fillColor("#c7d6e8").font("Helvetica").fontSize(9)
      .text(`Receipt No. ${data.receiptId}`, pillX - 200, 68, { width: 200 + pillW, align: "right" });

    doc.fillColor(INK);

    let y = 140;

    // ── Intro line ──
    doc.font("Helvetica").fontSize(10.5).fillColor(GRAY_TEXT)
      .text("This receipt certifies rent received for the property and period detailed below.", marginX, y, { width: contentW });
    y += 30;

    // ── Two-column info card: Tenant | Landlord ──
    const colGap = 16;
    const colW = (contentW - colGap) / 2;
    const cardH = 92;

    function infoCard(x: number, title: string, name: string, extraLabel?: string, extraValue?: string) {
      doc.roundedRect(x, y, colW, cardH, 6).fillAndStroke(GRAY_LIGHT, GRAY_BORDER);
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(GRAY_TEXT)
        .text(title.toUpperCase(), x + 14, y + 12, { characterSpacing: 0.5 });
      doc.font("Helvetica-Bold").fontSize(13).fillColor(INK)
        .text(name, x + 14, y + 28, { width: colW - 28 });
      if (extraLabel) {
        doc.font("Helvetica").fontSize(8.5).fillColor(GRAY_TEXT)
          .text(extraLabel, x + 14, y + 58);
        doc.font("Helvetica-Bold").fontSize(10).fillColor(INK)
          .text(extraValue || "—", x + 14, y + 70);
      }
    }

    infoCard(marginX, "Received From (Tenant)", data.tenantName);
    infoCard(marginX + colW + colGap, "Received By (Landlord)", data.landlordName, "PAN", data.landlordPan || "Not provided");

    y += cardH + 24;

    // ── Property address block ──
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(GRAY_TEXT)
      .text("PROPERTY ADDRESS", marginX, y, { characterSpacing: 0.5 });
    y += 14;
    doc.font("Helvetica").fontSize(11).fillColor(INK)
      .text(data.propertyAddress, marginX, y, { width: contentW });
    y += doc.heightOfString(data.propertyAddress, { width: contentW }) + 24;

    // ── Amount hero block ──
    doc.roundedRect(marginX, y, contentW, 64, 6).fill(NAVY_DARK);
    doc.font("Helvetica").fontSize(9).fillColor("#c7d6e8")
      .text("AMOUNT RECEIVED", marginX + 20, y + 14, { characterSpacing: 0.5 });
    doc.font("Helvetica-Bold").fontSize(26).fillColor("#ffffff")
      .text(`Rs. ${rupees}`, marginX + 20, y + 28);

    doc.font("Helvetica").fontSize(9).fillColor("#c7d6e8")
      .text("RENT PERIOD", marginX + 300, y + 14, { characterSpacing: 0.5 });
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#ffffff")
      .text(`${formatDate(data.paymentPeriodFrom)}  -  ${formatDate(data.paymentPeriodTo)}`, marginX + 300, y + 32, { width: contentW - 320 });

    y += 64 + 24;

    // ── Payment detail rows ──
    const rowLabelW = 160;
    function detailRow(label: string, value: string) {
      doc.font("Helvetica").fontSize(9.5).fillColor(GRAY_TEXT).text(label, marginX, y, { width: rowLabelW });
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(INK).text(value, marginX + rowLabelW, y, { width: contentW - rowLabelW });
      y += 20;
      doc.moveTo(marginX, y - 4).lineTo(marginX + contentW, y - 4).strokeColor(GRAY_BORDER).lineWidth(0.5).stroke();
    }

    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(GRAY_TEXT)
      .text("PAYMENT DETAILS", marginX, y, { characterSpacing: 0.5 });
    y += 18;

    detailRow("Payment date", formatDate(data.paidAt));
    detailRow("UTR / Reference no.", data.utrNumber || "N/A — cash payment");
    detailRow("Receipt generated", formatDate(new Date()));

    y += 24;

    // ── Signature block ──
    const sigBoxH = 90;
    doc.roundedRect(marginX, y, contentW, sigBoxH, 6).stroke(GRAY_BORDER);

    doc.font("Helvetica-Bold").fontSize(9).fillColor(GRAY_TEXT)
      .text("LANDLORD SIGNATURE", marginX + 18, y + 14, { characterSpacing: 0.5 });

    if (isSigned) {
      doc.font("Helvetica-BoldOblique").fontSize(16).fillColor(NAVY)
        .text(data.landlordName, marginX + 18, y + 34);
      doc.font("Helvetica-Bold").fontSize(9).fillColor(GREEN)
        .text(`Digitally signed via SplitFlow on ${formatDate(data.signedAt!)}`, marginX + 18, y + 60);
    } else {
      doc.font("Helvetica").fontSize(10).fillColor(AMBER)
        .text("Awaiting landlord's digital signature", marginX + 18, y + 40);
      doc.font("Helvetica").fontSize(8.5).fillColor(GRAY_TEXT)
        .text("This receipt is not yet finalized. Ask your landlord to sign it in their SplitFlow dashboard.", marginX + 18, y + 56, { width: contentW - 36 });
    }

    y += sigBoxH + 20;

    // ── Footer ──
    const footerY = doc.page.height - 70;
    doc.moveTo(marginX, footerY).lineTo(marginX + contentW, footerY).strokeColor(GRAY_BORDER).lineWidth(0.5).stroke();
    doc.font("Helvetica").fontSize(7.5).fillColor(GRAY_TEXT).text(
      "This receipt is generated from a payment verified by both parties on SplitFlow and is intended to support HRA exemption claims under Indian income tax rules. " +
      "For annual rent exceeding Rs. 1,00,000, the landlord's PAN is required per Income Tax Department guidelines. This is a computer-generated document.",
      marginX, footerY + 10, { width: contentW, align: "center", lineGap: 2 }
    );

    doc.end();
  });
}