import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

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

// Read our OWN font files as Buffers (not pdfkit's internal ones — this path
// is entirely under our control and Next.js's bundler never touches it,
// because we read it ourselves at request time rather than relying on
// pdfkit's internal `__dirname`-relative fs.readFileSync).
const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
const regularFontBuffer = fs.readFileSync(path.join(FONT_DIR, "NotoSans-Regular.ttf"));
const boldFontBuffer = fs.readFileSync(path.join(FONT_DIR, "NotoSans-Bold.ttf"));
const italicFontBuffer = fs.readFileSync(path.join(FONT_DIR, "NotoSans-Italic.ttf"));

export function generateRentReceiptPdf(data: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // KEY FIX: pass `font` in the constructor options. This overrides
    // PDFKit's internal default ("Helvetica"), so it never tries to
    // fs.readFileSync its own bundled Helvetica.afm at all — the crash
    // in your stack trace happens right here, during construction,
    // before any of our code runs.
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      font: regularFontBuffer,
    });

    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Register the other weights under our own names (no AFM involved —
    // these are our TTF buffers, loaded entirely by us).
    doc.registerFont("Body", regularFontBuffer);
    doc.registerFont("Body-Bold", boldFontBuffer);
    doc.registerFont("Body-Italic", italicFontBuffer);

    const rupees = (data.amountPaise / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const formatDate = (d: Date) =>
      d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

    // ── Header ──
    doc.fontSize(20).font("Body-Bold").text("RENT RECEIPT", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(9).font("Body").fillColor("#666")
      .text("Generated via SplitFlow — verified against a confirmed UPI/cash payment", { align: "center" });
    doc.fillColor("#000");
    doc.moveDown(1.5);

    // ── Receipt meta ──
    doc.fontSize(10).font("Body");
    doc.text(`Receipt No: ${data.receiptId}`, { continued: true });
    doc.text(`   Date issued: ${formatDate(new Date())}`, { align: "right" });
    doc.moveDown(1);

    // ── Divider ──
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#ccc").stroke();
    doc.moveDown(1);

    // ── Body text ──
    doc.fontSize(11).font("Body");
    doc.text(`This is to certify that a sum of `, { continued: true });
    doc.font("Body-Bold").text(`₹${rupees}`, { continued: true });
    doc.font("Body").text(
      ` (Rupees ${numberToWords(Math.round(data.amountPaise / 100))} only) has been received from `,
      { continued: true }
    );
    doc.font("Body-Bold").text(data.tenantName, { continued: true });
    doc.font("Body").text(` towards rent for the property located at:`);
    doc.moveDown(0.5);

    doc.font("Body-Bold").text(data.propertyAddress, { indent: 20 });
    doc.moveDown(0.5);

    doc.font("Body").text(`for the period from `, { continued: true });
    doc.font("Body-Bold").text(formatDate(data.paymentPeriodFrom), { continued: true });
    doc.font("Body").text(` to `, { continued: true });
    doc.font("Body-Bold").text(formatDate(data.paymentPeriodTo), { continued: true });
    doc.font("Body").text(".");
    doc.moveDown(1.5);

    // ── Payment details table ──
    doc.fontSize(10).font("Body-Bold").text("Payment Details");
    doc.moveDown(0.3);

    const detailRows: [string, string][] = [
      ["Amount paid", `₹${rupees}`],
      ["Payment date", formatDate(data.paidAt)],
      ["UTR / Reference number", data.utrNumber || "N/A (Cash payment)"],
      ["Landlord PAN", data.landlordPan || "Not provided"],
    ];

    doc.fontSize(10).font("Body");
    const startY = doc.y + 5;
    detailRows.forEach(([label, value], i) => {
      const y = startY + i * 20;
      doc.text(label, 50, y, { width: 200 });
      doc.text(value, 260, y, { width: 280 });
    });
    doc.y = startY + detailRows.length * 20 + 10;

    doc.moveDown(1.5);

    // ── Signature block ──
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#ccc").stroke();
    doc.moveDown(1.5);

    const sigY = doc.y;
    doc.fontSize(10).font("Body-Bold").text("Landlord", 50, sigY);
    doc.fontSize(10).font("Body").text(data.landlordName, 50, sigY + 15);

    if (data.signedAt) {
      doc.fillColor("#16a34a");
      doc.fontSize(9).font("Body-Bold").text(
        `✓ Digitally signed via SplitFlow on ${formatDate(data.signedAt)}`,
        50, sigY + 32
      );
      doc.fillColor("#000");
    } else {
      doc.fillColor("#f59e0b");
      doc.fontSize(9).font("Body-Italic").text(
        "Pending landlord signature",
        50, sigY + 32
      );
      doc.fillColor("#000");
    }

    doc.moveDown(3);

    // ── Footer ──
    doc.fontSize(8).font("Body").fillColor("#888").text(
      "This receipt is auto-generated based on a two-sided confirmed payment on SplitFlow and is intended to support HRA exemption claims. " +
      "For rent exceeding ₹1,00,000 per annum, the landlord's PAN is mandatory as per Income Tax rules.",
      50, doc.page.height - 80, { width: 495, align: "center" }
    );

    doc.end();
  });
}

// Simple number-to-words for Indian Rupee amounts (up to crores)
function numberToWords(num: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function twoDigits(n: number): string {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  }

  function threeDigits(n: number): string {
    if (n < 100) return twoDigits(n);
    return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + twoDigits(n % 100) : "");
  }

  if (num === 0) return "Zero";

  let result = "";
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const hundred = num;

  if (crore) result += threeDigits(crore) + " Crore ";
  if (lakh) result += threeDigits(lakh) + " Lakh ";
  if (thousand) result += threeDigits(thousand) + " Thousand ";
  if (hundred) result += threeDigits(hundred);

  return result.trim();
}