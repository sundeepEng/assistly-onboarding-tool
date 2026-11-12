import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { getHomeIdFromToken } from "../../../utils/auth";
import { fetchById } from "../../../services/getById";
import { homePath } from "../../../utils/constants";


type PayStubItem = {
  description?: string;
  amount_cents?: number;
};

type PayStubPayout = {
  id?: number;
  payroll_payout_id?: string;
  pcg_user_id?: string;
  pcg_user_name?: string;
  period_start_date?: string;
  period_end_date?: string;
  created_at?: string;
  updated_at?: string;
  hours_worked_minutes?: number;
  hourly_rate_cents?: number;
  base_amount_cents?: number;
  total_amount_cents?: number;
  status?: string;
  items?: PayStubItem[];
};

type PayStubParty = {
  name?: string;
  addressLines?: string[];
  phone?: string;
  email?: string;
  employeeId?: string;
};
const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);

const safe = (v: unknown, fallback = "") =>
  v == null ? fallback : String(v);

const toDollars = (cents?: number) => (Number(cents) || 0) / 100;

const toHours = (minutes?: number) => ((Number(minutes) || 0) / 60).toFixed(2);

const parseDate = (isoOrDate?: string) => {
  if (!isoOrDate) return null;
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return null;
  return d;
};

const formatShortDate = (isoOrDate?: string) => {
  const d = parseDate(isoOrDate);
  if (!d) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

async function fetchWebpAsPngBytes(publicPath: string): Promise<Uint8Array> {
  if (typeof window === "undefined") {
    throw new Error("PDF generation must run in the browser.");
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to create 2D canvas context."));
          return;
        }
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(
          async (blob) => {
            try {
              if (!blob) {
                reject(new Error("Failed to convert logo image to PNG."));
                return;
              }
              const buf = await blob.arrayBuffer();
              resolve(new Uint8Array(buf));
            } catch (e) {
              reject(e);
            }
          },
          "image/png",
          1,
        );
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${publicPath}`));
    img.src = publicPath;
  });
}

function downloadPdfBytes(pdfBytes: Uint8Array, fileName: string) {
  // IMPORTANT: use the exact bytes for this view, not the whole underlying buffer.
  const arrayBuffer = pdfBytes.buffer.slice(
  pdfBytes.byteOffset,
  pdfBytes.byteOffset + pdfBytes.byteLength
);

const typedArray = new Uint8Array(arrayBuffer as ArrayBuffer); 
const blob = new Blob([typedArray], { type: "application/pdf" });
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = fileName;
a.click();
URL.revokeObjectURL(url);
}
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

function buildAddressLines(address: any | undefined): string[] {
  if (!address) return [];
  const street = safe(address?.street).trim();
  const city = safe(address?.city).trim();
  const state = safe(address?.state).trim();
  const zipCode = safe(address?.zipCode).trim();

  const lines: string[] = [];
  if (street) lines.push(street);

  const cityStateZip = [city, state].filter(Boolean).join(", ");
  const line2 = [cityStateZip, zipCode].filter(Boolean).join(" ").trim();
  if (line2) lines.push(line2);

  return lines;
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

export async function generatePayStubPdfBytes(
  payout: PayStubPayout,
  args?: {
    employer?: PayStubParty;
    employee?: PayStubParty;
  },
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([595.28, 841.89]); // A4 portrait
  const { width, height } = page.getSize();

  const marginX = 40;
  const topY = height - 40;

  const primary = rgb(0.3176, 0.2980, 0.9216);
  const text = rgb(0.07, 0.09, 0.13);
  const muted = rgb(0.42, 0.45, 0.5);
  const border = rgb(0.9, 0.9, 0.92);
  const white = rgb(1, 1, 1);
  const tableHeaderBg = primary;

  const payoutId = payout?.payroll_payout_id || String(payout?.id ?? "");
  const status = safe(payout?.status, "DRAFT");

  const periodStart = safe(payout?.period_start_date);
  const periodEnd = safe(payout?.period_end_date);
  const periodRange =
    periodStart && periodEnd
      ? `${formatShortDate(periodStart)} - ${formatShortDate(periodEnd)}`
      : "";

  const issueDate =
    formatShortDate(payout?.updated_at) ||
    formatShortDate(payout?.created_at) ||
    formatShortDate(payout?.period_end_date) ||
    "";

  const hours = toHours(payout?.hours_worked_minutes);
  const hourlyRate = toDollars(payout?.hourly_rate_cents);
  const basePay = toDollars(payout?.base_amount_cents);
  const totalPay = toDollars(payout?.total_amount_cents);

  const items = Array.isArray(payout?.items) ? payout.items : [];
  const itemsTotal = items.reduce((acc, it) => acc + (Number(it?.amount_cents) || 0), 0) / 100;

  const employer: PayStubParty = {
    name: args?.employer?.name,
    addressLines: args?.employer?.addressLines,
    phone: args?.employer?.phone,
    email: args?.employer?.email,
  };

  const employee: PayStubParty = {
    name: args?.employee?.name ?? payout?.pcg_user_name,
    addressLines: args?.employee?.addressLines,
    phone: args?.employee?.phone,
    email: args?.employee?.email,
    employeeId: args?.employee?.employeeId,
  };

  let cursorY = topY;

  // Header
  page.drawText("EARNINGS STATEMENT", {
    x: marginX,
    y: cursorY - 6,
    size: 18,
    font: fontBold,
    color: primary,
  });

  const rightX = width - marginX;
  const statementLabel = "Statement #";
  const statementValue = payoutId || "--";
  const issueLabel = "Issue Date";
  const issueValue = issueDate || "--";

  const metaSize = 9;
  const metaGap = 12;
  const metaTop = cursorY - 2;

  const statementLine = `${statementLabel}: ${statementValue}`;
  const issueLine = `${issueLabel}: ${issueValue}`;

  page.drawText(statementLine, {
    x: rightX - font.widthOfTextAtSize(statementLine, metaSize),
    y: metaTop,
    size: metaSize,
    font,
    color: muted,
  });
  page.drawText(issueLine, {
    x: rightX - font.widthOfTextAtSize(issueLine, metaSize),
    y: metaTop - metaGap,
    size: metaSize,
    font,
    color: muted,
  });

  cursorY -= 26;

  const payPeriodLine = `Pay Period: ${periodRange || "--"}`;
  page.drawText(payPeriodLine, {
    x: marginX,
    y: cursorY,
    size: 9,
    font,
    color: muted,
  });

  const statusLine = `Status: ${status || "--"}`;
  page.drawText(statusLine, {
    x: rightX - font.widthOfTextAtSize(statusLine, 9),
    y: cursorY,
    size: 9,
    font,
    color: muted,
  });

  cursorY -= 16;
  page.drawRectangle({ x: marginX, y: cursorY, width: width - marginX * 2, height: 1, color: border });

  // Parties
  cursorY -= 28;
  const colGap = 26;
  const partiesW = width - marginX * 2;
  const partyColW = (partiesW - colGap) / 2;
  const leftColX = marginX;
  const rightColX2 = marginX + partyColW + colGap;

  const labelSize = 8;
  const nameSize = 11;
  const addrSize = 9;

  page.drawText("EMPLOYER", { x: leftColX, y: cursorY, size: labelSize, font: fontBold, color: muted });
  page.drawText("EMPLOYEE", { x: rightColX2, y: cursorY, size: labelSize, font: fontBold, color: muted });

  cursorY -= 14;
  page.drawText(truncateToWidth(safe(employer.name, "--"), partyColW, fontBold, nameSize), {
    x: leftColX,
    y: cursorY,
    size: nameSize,
    font: fontBold,
    color: text,
  });
  page.drawText(truncateToWidth(safe(employee.name, "--"), partyColW, fontBold, nameSize), {
    x: rightColX2,
    y: cursorY,
    size: nameSize,
    font: fontBold,
    color: text,
  });

  cursorY -= 14;
  const employerLines = (employer.addressLines || []).slice(0, 3);
  const employeeLines = (employee.addressLines || []).slice(0, 3);

  const afterEmployerY = drawTextLines({
    page,
    x: leftColX,
    y: cursorY,
    lines: employerLines,
    font,
    size: addrSize,
    color: muted,
    lineGap: 12,
  });

  drawTextLines({
    page,
    x: rightColX2,
    y: cursorY,
    lines: employeeLines,
    font,
    size: addrSize,
    color: muted,
    lineGap: 12,
  });

  cursorY = Math.min(afterEmployerY, cursorY - (Math.max(employerLines.length, employeeLines.length) || 0) * 12);
  cursorY -= 18;

  // Items Table
  const tableX = marginX;
  const tableW = width - marginX * 2;
  const headerH = 24;

  // Columns
  const colDateW = 70;
  const colCategoryW = 90;
  const colAmountW = 80;
  const colDescW = tableW - colDateW - colCategoryW - colAmountW;

  page.drawRectangle({
    x: tableX,
    y: cursorY - headerH,
    width: tableW,
    height: headerH,
    color: tableHeaderBg,
  });

  const headerTextY = cursorY - 16;
  page.drawText("DATE", { x: tableX + 10, y: headerTextY, size: 9, font: fontBold, color: white });
  page.drawText("CATEGORY", {
    x: tableX + 10 + colDateW,
    y: headerTextY,
    size: 9,
    font: fontBold,
    color: white,
  });
  page.drawText("DESCRIPTION", {
    x: tableX + 10 + colDateW + colCategoryW,
    y: headerTextY,
    size: 9,
    font: fontBold,
    color: white,
  });
  page.drawText("AMOUNT", {
    x: tableX + tableW - 10 - fontBold.widthOfTextAtSize("AMOUNT", 9),
    y: headerTextY,
    size: 9,
    font: fontBold,
    color: white,
  });

  cursorY -= headerH + 16;

  const lineItems: { date: string; category: string; description: string; amount: number }[] = [];
  lineItems.push({
    date: issueDate || "",
    category: "Base Pay",
    description: "Fixed Monthly Amount",
    amount: basePay,
  });
  for (const it of items) {
    lineItems.push({
      date: "",
      category: "Other",
      description: safe(it?.description, "Additional Expense") || "Additional Expense",
      amount: toDollars(it?.amount_cents),
    });
  }

  const rowH = 24;
  const rowTextY = 7;
  let rowIndex = 0;
  const startRowsY = cursorY;
  for (const li of lineItems) {
    if (cursorY < 210) break;

    if (rowIndex % 2 === 1) {
      page.drawRectangle({
        x: tableX,
        y: cursorY - 6,
        width: tableW,
        height: rowH,
        color: rgb(0.98, 0.98, 0.99),
      });
    }

    const dateText = truncateToWidth(li.date || "", colDateW - 8, font, 9);
    const categoryText = truncateToWidth(li.category || "", colCategoryW - 8, font, 9);
    const descText = truncateToWidth(li.description || "", colDescW - 8, font, 9);
    const amtText = formatMoney(li.amount);

    page.drawText(dateText, { x: tableX + 10, y: cursorY + rowTextY, size: 9, font, color: text });
    page.drawText(categoryText, {
      x: tableX + 10 + colDateW,
      y: cursorY + rowTextY,
      size: 9,
      font,
      color: text,
    });
    page.drawText(descText, {
      x: tableX + 10 + colDateW + colCategoryW,
      y: cursorY + rowTextY,
      size: 9,
      font,
      color: text,
    });
    page.drawText(amtText, {
      x: tableX + tableW - 10 - font.widthOfTextAtSize(amtText, 9),
      y: cursorY + rowTextY,
      size: 9,
      font,
      color: text,
    });

    cursorY -= rowH;
    rowIndex += 1;
  }

  // Divider
  page.drawRectangle({ x: tableX, y: cursorY + 8, width: tableW, height: 1, color: border });
  cursorY -= 18;

  // Bottom Summary
  const summaryTopY = Math.min(cursorY, startRowsY - 18);
  const leftCardW = 240;
  const leftCardH = 110;
  const leftCardX = marginX;
  const leftCardY = summaryTopY - leftCardH;

  page.drawRectangle({ x: leftCardX, y: leftCardY, width: leftCardW, height: leftCardH, borderColor: border, borderWidth: 1, color: rgb(0.99, 0.99, 1) });
  page.drawText("HOURS SUMMARY", { x: leftCardX + 12, y: leftCardY + leftCardH - 20, size: 8, font: fontBold, color: muted });
  page.drawText(`${hours}`, { x: leftCardX + 12, y: leftCardY + leftCardH - 52, size: 20, font: fontBold, color: primary });
  page.drawText("Total Hours", { x: leftCardX + 12, y: leftCardY + leftCardH - 68, size: 9, font, color: muted });
  page.drawText(`Rate: ${formatMoney(hourlyRate)}/hr`, { x: leftCardX + 12, y: leftCardY + 18, size: 9, font, color: muted });

  const rightX2 = marginX + leftCardW + 30;
  const rightW = width - marginX - rightX2;
  const lineYStart = leftCardY + leftCardH - 18;

  const grossPay = basePay + itemsTotal;
  const netPay = grossPay;

  const rowLabelSize = 9;
  const rowValueSize = 9;
  const rowLineGap = 18;
  let sy = lineYStart;

  const drawSummaryRow = (label: string, value?: string, bold?: boolean) => {
    page.drawText(label, { x: rightX2, y: sy, size: rowLabelSize, font, color: muted });
    if (value) {
      const f = bold ? fontBold : font;
      const size = bold ? 11 : rowValueSize;
      page.drawText(value, {
        x: rightX2 + rightW - f.widthOfTextAtSize(value, size),
        y: sy - (bold ? 2 : 0),
        size,
        font: f,
        color: bold ? text : muted,
      });
    }
    sy -= rowLineGap;
  };

  drawSummaryRow("Gross Pay", formatMoney(grossPay));
  drawSummaryRow("Federal Tax Withholding", "");
  drawSummaryRow("State Tax", "");
  drawSummaryRow("Social Security", "");
  drawSummaryRow("Medicare", "");
  sy -= 4;
  page.drawRectangle({ x: rightX2, y: sy + 10, width: rightW, height: 1, color: border });
  sy -= 12;
  drawSummaryRow("Net Pay", formatMoney(netPay), true);

  // Footer
  const footerY = 54;
  page.drawText("This pay stub is generated for the pay period indicated above.", {
    x: marginX,
    y: footerY,
    size: 8,
    font,
    color: muted,
  });
  page.drawText("Assistly", { x: width - marginX - font.widthOfTextAtSize("Assistly", 9), y: footerY, size: 9, font: fontBold, color: primary });

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

export async function downloadPayStubPdf(payout: PayStubPayout) {
  const id = payout?.payroll_payout_id || String(payout?.id ?? "pay_stub");
  const homeId = getHomeIdFromToken();

  let employerName = "Employer";
  let employerAddressLines: string[] = [];

  try {
    if (homeId) {
      const res: any = await fetchById({ id: homeId, path: homePath });
      const home = res?.home ?? res;
      employerName = safe(home?.homeName || home?.name || employerName);
      employerAddressLines = buildAddressLines(home?.homeAddress);
    }
  } catch (e) {
    // If employer fetch fails, we still generate the PDF with fallback employer fields.
  }

  const pdfBytes = await generatePayStubPdfBytes(payout, {
    employer: {
      name: employerName,
      addressLines: employerAddressLines,
    },
    employee: {
      name: payout?.pcg_user_name,
      addressLines: [],
    },
  });
  downloadPdfBytes(pdfBytes, `${id}.pdf`);
}
