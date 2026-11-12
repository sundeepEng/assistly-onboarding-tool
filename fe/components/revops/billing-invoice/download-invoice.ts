import { format } from "date-fns";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { formatBillingPeriodMonth } from "../../../utils/billingPeriodUtils";
import { InvoiceStatus } from "../../../utils/constants";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface InvoiceData {
  invoiceNumber: string;
  resident: string;
  type?: string;
  billingPeriod: string;
  dueDate: string;
  amount: number;
  description?: string;
  status: string;
  createdAt: string;
  lineItems: LineItem[];
  roomNumber?: string;
  homeName?: string;
  homeAddress?: string;
  homePhone?: string;
}

// ─── helpers (same style as pay-stub-pdf.ts) ────────────────────────────────

const safe = (v: unknown, fallback = "") =>
  v == null ? fallback : String(v);

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

function truncateToWidth(text: string, maxWidth: number, font: any, size: number) {
  let str = text;
  if (font.widthOfTextAtSize(str, size) <= maxWidth) return str;
  const ell = "…";
  const target = Math.max(0, maxWidth - font.widthOfTextAtSize(ell, size));
  while (str.length && font.widthOfTextAtSize(str, size) > target) {
    str = str.slice(0, -1);
  }
  return str + ell;
}

function drawTextLines(args: {
  page: any;
  x: number;
  y: number;
  lines: string[];
  font: any;
  size: number;
  color: any;
  lineGap?: number;
}) {
  const { page, x, y, lines, font, size, color, lineGap } = args;
  const gap = lineGap ?? 12;
  let currentY = y;
  for (const l of lines) {
    if (!l) continue;
    page.drawText(l, { x, y: currentY, size, font, color });
    currentY -= gap;
  }
  return currentY;
}

// Split a plain address string into up to 2 display lines
function buildAddressLinesFromString(address: string | undefined): string[] {
  if (!address) return [];
  const parts = address.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 1) return parts;
  return [parts[0], parts.slice(1).join(", ")];
}

/**
 * Download invoice as a professional PDF (layout matches pay-stub-pdf.ts)
 */
export const downloadInvoiceAsText = async (invoiceData: InvoiceData) => {
  const formattedDueDate = invoiceData.dueDate
    ? format(new Date(invoiceData.dueDate), "MMM dd, yyyy")
    : "N/A";
  const formattedCreatedDate = invoiceData.createdAt
    ? format(new Date(invoiceData.createdAt), "MMM dd, yyyy")
    : "N/A";
  const formattedBillingPeriod = invoiceData.billingPeriod
    ? formatBillingPeriodMonth(invoiceData.billingPeriod)
    : "N/A";

  const pdfDoc = await PDFDocument.create();
  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([595.28, 841.89]); // A4 portrait
  const { width, height } = page.getSize();

  const marginX = 40;
  const topY    = height - 40;

  // Color palette – same as pay-stub-pdf.ts
  const primary      = rgb(0.3176, 0.2980, 0.9216);
  const textCol      = rgb(0.07, 0.09, 0.13);
  const muted        = rgb(0.42, 0.45, 0.5);
  const border       = rgb(0.9, 0.9, 0.92);
  const white        = rgb(1, 1, 1);
  const greenColor   = rgb(0.13, 0.55, 0.13);
  const redColor     = rgb(0.8, 0.2, 0.2);
  const orangeColor  = rgb(0.9, 0.5, 0.1);

  const status      = safe(invoiceData.status, "PENDING").toUpperCase();
  const statusLower = status.toLowerCase();
  const statusColor =
    statusLower === InvoiceStatus.PAID.toLowerCase()
      ? greenColor
      : statusLower === InvoiceStatus.OVERDUE.toLowerCase()
        ? redColor
        : orangeColor;

  let cursorY = topY;

  // ── Header ──────────────────────────────────────────────────────────────────
  page.drawText("INVOICE", {
    x: marginX,
    y: cursorY - 6,
    size: 18,
    font: fontBold,
    color: primary,
  });

  const rightX   = width - marginX;
  const metaSize = 9;
  const metaTop  = cursorY - 2;

  const invoiceLine = `Invoice #: ${invoiceData.invoiceNumber || "--"}`;
  const dateLine    = `Issue Date: ${formattedCreatedDate}`;

  page.drawText(invoiceLine, {
    x: rightX - font.widthOfTextAtSize(invoiceLine, metaSize),
    y: metaTop,
    size: metaSize,
    font,
    color: muted,
  });
  page.drawText(dateLine, {
    x: rightX - font.widthOfTextAtSize(dateLine, metaSize),
    y: metaTop - 12,
    size: metaSize,
    font,
    color: muted,
  });

  cursorY -= 26;

  // Billing Period (left) | Due Date (right)
  const billingLine = `Billing Period: ${formattedBillingPeriod}`;
  const dueLine     = `Due: ${formattedDueDate}`;
  page.drawText(billingLine, { x: marginX, y: cursorY, size: 9, font, color: muted });
  page.drawText(dueLine, {
    x: rightX - font.widthOfTextAtSize(dueLine, 9),
    y: cursorY,
    size: 9,
    font,
    color: muted,
  });

  cursorY -= 16;
  // Thin horizontal divider
  page.drawRectangle({ x: marginX, y: cursorY, width: width - marginX * 2, height: 1, color: border });

  // ── Parties ──────────────────────────────────────────────────────────────────
  cursorY -= 28;
  const colGap    = 26;
  const partiesW  = width - marginX * 2;
  const partyColW = (partiesW - colGap) / 2;
  const leftColX  = marginX;
  const rightColX = marginX + partyColW + colGap;

  page.drawText("FROM",    { x: leftColX,  y: cursorY, size: 8, font: fontBold, color: muted });
  page.drawText("BILL TO", { x: rightColX, y: cursorY, size: 8, font: fontBold, color: muted });

  cursorY -= 14;

  page.drawText(truncateToWidth(safe(invoiceData.homeName, "--"), partyColW, fontBold, 11), {
    x: leftColX, y: cursorY, size: 11, font: fontBold, color: textCol,
  });
  page.drawText(truncateToWidth(safe(invoiceData.resident, "--"), partyColW, fontBold, 11), {
    x: rightColX, y: cursorY, size: 11, font: fontBold, color: textCol,
  });

  cursorY -= 14;

  const fromLines: string[] = [
    ...buildAddressLinesFromString(invoiceData.homeAddress),
    ...(invoiceData.homePhone ? [`Phone: ${invoiceData.homePhone}`] : []),
  ];
  const toLines: string[] = [
    ...(invoiceData.roomNumber ? [`Room ${invoiceData.roomNumber}`] : []),
    // ...(invoiceData.type       ? [`Type: ${invoiceData.type}`]      : []),
  ];

  const afterFromY = drawTextLines({
    page, x: leftColX, y: cursorY,
    lines: fromLines.slice(0, 3), font, size: 9, color: muted, lineGap: 12,
  });
  drawTextLines({
    page, x: rightColX, y: cursorY,
    lines: toLines.slice(0, 3), font, size: 9, color: muted, lineGap: 12,
  });

  cursorY = Math.min(
    afterFromY,
    cursorY - (Math.max(fromLines.length, toLines.length) || 0) * 12,
  );
  cursorY -= 18;

  // ── Line-items Table ──────────────────────────────────────────────────────────
  const tableX  = marginX;
  const tableW  = width - marginX * 2;
  const headerH = 24;

  // Column widths: DESCRIPTION | QTY | UNIT PRICE | AMOUNT (right-aligned)
  const colQtyW  = 44;
  const colUnitW = 88;
  const colAmtW  = 80;
  const colDescW = tableW - colQtyW - colUnitW - colAmtW;

  page.drawRectangle({
    x: tableX,
    y: cursorY - headerH,
    width: tableW,
    height: headerH,
    color: primary,
  });

  const headerTextY = cursorY - 16;
  page.drawText("DESCRIPTION", { x: tableX + 10, y: headerTextY, size: 9, font: fontBold, color: white });
  page.drawText("QTY", {
    x: tableX + colDescW + (colQtyW - fontBold.widthOfTextAtSize("QTY", 9)) / 2,
    y: headerTextY, size: 9, font: fontBold, color: white,
  });
  page.drawText("UNIT PRICE", {
    x: tableX + colDescW + colQtyW + colUnitW - fontBold.widthOfTextAtSize("UNIT PRICE", 9) - 8,
    y: headerTextY, size: 9, font: fontBold, color: white,
  });
  page.drawText("AMOUNT", {
    x: tableX + tableW - 10 - fontBold.widthOfTextAtSize("AMOUNT", 9),
    y: headerTextY, size: 9, font: fontBold, color: white,
  });

  cursorY -= headerH + 16;

  const rowH     = 24;
  const rowTextY = 7;
  let rowIndex   = 0;

  for (const item of invoiceData.lineItems) {
    if (cursorY < 210) break;

    if (rowIndex === 0) cursorY -= 6;

    if (rowIndex % 2 === 1) {
      page.drawRectangle({
        x: tableX, y: cursorY - 6,
        width: tableW, height: rowH,
        color: rgb(0.98, 0.98, 0.99),
      });
    }

    const descText = truncateToWidth(safe(item.description), colDescW - 10, font, 9);
    const qtyText  = String(item.quantity);
    const unitText = formatMoney(item.unitPrice);
    const amtText  = formatMoney(item.total);

    page.drawText(descText, { x: tableX + 10, y: cursorY + rowTextY, size: 9, font, color: textCol });
    page.drawText(qtyText, {
      x: tableX + colDescW + (colQtyW - font.widthOfTextAtSize(qtyText, 9)) / 2,
      y: cursorY + rowTextY, size: 9, font, color: textCol,
    });
    page.drawText(unitText, {
      x: tableX + colDescW + colQtyW + colUnitW - font.widthOfTextAtSize(unitText, 9) - 8,
      y: cursorY + rowTextY, size: 9, font, color: textCol,
    });
    page.drawText(amtText, {
      x: tableX + tableW - 10 - font.widthOfTextAtSize(amtText, 9),
      y: cursorY + rowTextY, size: 9, font, color: textCol,
    });

    cursorY -= rowH;
    rowIndex += 1;
  }

  // Divider after table rows
  page.drawRectangle({ x: tableX, y: cursorY + 8, width: tableW, height: 1, color: border });
  cursorY -= 18;

  // ── Notes (if any) ────────────────────────────────────────────────────────────
  if (invoiceData.description && cursorY > 260) {
    page.drawText("NOTES", { x: marginX, y: cursorY, size: 8, font: fontBold, color: muted });
    cursorY -= 14;

    const words = invoiceData.description.split(" ");
    let noteLine = "";
    for (const word of words) {
      if (cursorY < 260) break;
      const test = noteLine + word + " ";
      if (font.widthOfTextAtSize(test, 9) > tableW) {
        if (noteLine.trim()) {
          page.drawText(noteLine.trim(), { x: marginX, y: cursorY, size: 9, font, color: muted });
          cursorY -= 13;
        }
        noteLine = word + " ";
      } else {
        noteLine = test;
      }
    }
    if (noteLine.trim() && cursorY > 260) {
      page.drawText(noteLine.trim(), { x: marginX, y: cursorY, size: 9, font, color: muted });
      cursorY -= 13;
    }
    cursorY -= 10;
  }

  // ── Bottom Summary ────────────────────────────────────────────────────────────
  const summaryTopY = cursorY;
  const leftCardW   = 220;
  const leftCardH   = 90;
  const leftCardX   = marginX;
  const leftCardY   = summaryTopY - leftCardH;

  page.drawRectangle({
    x: leftCardX, y: leftCardY,
    width: leftCardW, height: leftCardH,
    borderColor: border, borderWidth: 1, color: rgb(0.99, 0.99, 1),
  });
  page.drawText("PAYMENT STATUS", {
    x: leftCardX + 12, y: leftCardY + leftCardH - 20,
    size: 8, font: fontBold, color: muted,
  });
  page.drawText(status, {
    x: leftCardX + 12, y: leftCardY + leftCardH - 46,
    size: 16, font: fontBold, color: statusColor,
  });
  page.drawText(`Due: ${formattedDueDate}`, {
    x: leftCardX + 12, y: leftCardY + 14,
    size: 9, font, color: muted,
  });

  // Right summary rows
  const rightX2    = marginX + leftCardW + 30;
  const rightW     = width - marginX - rightX2;
  let sy           = leftCardY + leftCardH - 18;

  const drawSummaryRow = (label: string, value?: string, bold?: boolean) => {
    page.drawText(label, { x: rightX2, y: sy, size: 9, font, color: muted });
    if (value) {
      const f    = bold ? fontBold : font;
      const size = bold ? 11 : 9;
      page.drawText(value, {
        x: rightX2 + rightW - f.widthOfTextAtSize(value, size),
        y: sy - (bold ? 2 : 0),
        size, font: f,
        color: bold ? textCol : muted,
      });
    }
    sy -= 18;
  };

  drawSummaryRow("Subtotal",          formatMoney(invoiceData.amount));
  drawSummaryRow("Tax / Adjustments", "");
  sy -= 4;
  page.drawRectangle({ x: rightX2, y: sy + 10, width: rightW, height: 1, color: border });
  sy -= 12;
  drawSummaryRow("Total Due", formatMoney(invoiceData.amount), true);

  // ── Footer ────────────────────────────────────────────────────────────────────
  const footerY = 54;
  page.drawText("Thank you for your business!", {
    x: marginX, y: footerY, size: 8, font, color: muted,
  });
  page.drawText("Assistly", {
    x: width - marginX - fontBold.widthOfTextAtSize("Assistly", 9),
    y: footerY, size: 9, font: fontBold, color: primary,
  });

  // Download
  const pdfBytes = await pdfDoc.save();
  const arrayBuffer = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength,
  );
  const blob = new Blob([new Uint8Array(arrayBuffer as ArrayBuffer)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `invoice-${invoiceData.invoiceNumber}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * Print invoice
 */
export const printInvoice = (invoiceData: InvoiceData) => {
  const formattedDueDate = invoiceData.dueDate 
    ? format(new Date(invoiceData.dueDate), "MMM dd, yyyy") 
    : "N/A";
  const formattedCreatedDate = invoiceData.createdAt 
    ? format(new Date(invoiceData.createdAt), "MMM dd, yyyy") 
    : "N/A";
  const formattedBillingPeriod = invoiceData.billingPeriod 
    ? formatBillingPeriodMonth(invoiceData.billingPeriod)
    : "N/A";

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s === InvoiceStatus.PAID.toLowerCase()) return "green";
    if (s === InvoiceStatus.OVERDUE.toLowerCase()) return "red";
    return "orange";
  };

  const printContent = `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
      <h1 style="text-align: center; margin-bottom: 30px;">INVOICE #${invoiceData.invoiceNumber}</h1>
      
      <div style="margin-bottom: 20px;">
        ${invoiceData.resident ? `<p><strong>Resident:</strong> ${invoiceData.resident}${invoiceData.roomNumber ? ` - Room ${invoiceData.roomNumber}` : ""}</p>` : ""}
        ${invoiceData.type ? `<p><strong>Type:</strong> ${invoiceData.type}</p>` : ""}
        <p><strong>Billing Period:</strong> ${formattedBillingPeriod}</p>
        <p><strong>Due Date:</strong> ${formattedDueDate}</p>
        <p><strong>Status:</strong> <span style="color: ${getStatusColor(invoiceData.status)}">${invoiceData.status.toUpperCase()}</span></p>
        <p><strong>Created:</strong> ${formattedCreatedDate}</p>
      </div>

      <h2 style="border-bottom: 2px solid #333; padding-bottom: 10px;">Line Items</h2>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="border-bottom: 1px solid #ccc;">
            <th style="text-align: left; padding: 10px;">Description</th>
            <th style="text-align: center; padding: 10px;">Quantity</th>
            <th style="text-align: right; padding: 10px;">Unit Price</th>
            <th style="text-align: right; padding: 10px;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${invoiceData.lineItems
            .map(
              (item) => `
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px;">${item.description}</td>
                <td style="text-align: center; padding: 10px;">${item.quantity}</td>
                <td style="text-align: right; padding: 10px;">$${item.unitPrice.toFixed(2)}</td>
                <td style="text-align: right; padding: 10px;">$${item.total.toFixed(2)}</td>
              </tr>
            `
            )
            .join("")}
        </tbody>
      </table>

      <div style="text-align: right; margin-bottom: 20px;">
        <p style="font-size: 18px;"><strong>Total: $${invoiceData.amount.toFixed(2)}</strong></p>
      </div>

      ${invoiceData.description ? `
        <div style="margin-top: 30px;">
          <h3>Notes</h3>
          <p>${invoiceData.description}</p>
        </div>
      ` : ""}
      
      ${invoiceData.homeName || invoiceData.homeAddress || invoiceData.homePhone ? `
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ccc; text-align: center;">
          <p style="font-size: 14px; color: #666;">
            ${invoiceData.homeName ? `<strong>${invoiceData.homeName}</strong><br>` : ""}
            ${invoiceData.homeAddress ? `${invoiceData.homeAddress}<br>` : ""}
            ${invoiceData.homePhone ? `Phone: ${invoiceData.homePhone}` : ""}
          </p>
        </div>
      ` : ""}
    </div>
  `;

  // Open print dialog
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice #${invoiceData.invoiceNumber}</title>
          <style>
            @media print {
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          ${printContent}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  }
};

export type { InvoiceData, LineItem };
