import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { REFUSE } from "../utils/constants";
import dayjs from "dayjs";

export type EmarPdfResult = {
  pdfBytes: Uint8Array;
  fileName: string;
};

/**
 * Generates the EMAR PDF with an optional {{Signature}} placeholder.
 * Returns the raw PDF bytes + file name so callers can decide to download or e-sign.
 */
export async function GenerateEmarPdf(
  data: any,
  month: string,
  options?: { includeSignaturePlaceholder?: boolean },
): Promise<EmarPdfResult> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pageSize: [number, number] = [595, 842];
  const colWidths = [90, 40, ...Array(31).fill(14)];
  const startX = 15;
  const rowHeight = 15;
  const summaryRowHeight = 25;
  const summaryNumRows = 9;
  const summaryHeight = summaryRowHeight * summaryNumRows + 20;
  const columnTopsPerPage: number[][] = [];

  let page = pdfDoc.addPage(pageSize);
  const { width, height } = page.getSize();
  let y = height - 25;
  let currentPageIndex = 0;
  columnTopsPerPage[currentPageIndex] = [];
  const formatted = dayjs(month).format("MMMM YYYY");

  const drawPageHeader = () => {
    y = height - 25;
    page.drawText(`MEDICATION ADMINISTRATION RECORD - ${formatted}`, {
      x: 150,
      y,
      size: 14,
      font,
      color: rgb(0, 0, 0),
    });
    y -= 20;

    page.drawLine({
      start: { x: 15, y: 10 },
      end: { x: 15, y: height - 35 },
      thickness: 0.5,
    });
    page.drawLine({
      start: { x: width - 15, y: 10 },
      end: { x: width - 15, y: height - 35 },
      thickness: 0.5,
    });
    page.drawLine({
      start: { x: 15, y: 10 },
      end: { x: width - 15, y: 10 },
      thickness: 0.5,
    });
    page.drawLine({
      start: { x: 15, y: y + 10 },
      end: { x: width - 15, y: y + 10 },
      thickness: 0.5,
    });

    const headers = [
      "MEDICATIONS",
      "HOUR",
      ...Array.from({ length: 31 }, (_, i) => `${i + 1}`),
    ];
    let x = startX;
    columnTopsPerPage[currentPageIndex] = [];

    headers?.forEach((text, i) => {
      page.drawText(text, { x: x + 2, y, size: 8, font });
      columnTopsPerPage[currentPageIndex].push(x);
      x += colWidths[i];
    });

    y -= 5;
    page.drawLine({
      start: { x: 15, y },
      end: { x: width - 15, y },
      thickness: 0.5,
    });
    y -= rowHeight;
  };

  const checkSpace = () => {
    if (y < rowHeight + 5) {
      page = pdfDoc.addPage(pageSize);
      currentPageIndex++;
      columnTopsPerPage[currentPageIndex] = [];
      drawPageHeader();
    }
  };

  drawPageHeader();

  Object.values(data?.emar || {}).forEach((medBlock: any) => {
    page.drawText(medBlock.name || "", { x: startX + 2, y, size: 9, font });
    page.drawText(medBlock.dosage || "", { x: startX + 2, y:y-15, size: 9, font });
    medBlock?.med?.forEach((med) => {
      checkSpace();
      let x = startX;
      x += colWidths[0];
      page.drawText(med.hour || "", { x: x + 2, y, size: 9, font });
      x += colWidths[1];

      med?.days?.forEach((day: any) => {
        if (day.passOrRefuse === REFUSE) {
          page.drawEllipse({
            x: x+8,
            y: y+4,
            xScale: 5,
            yScale: 5,
            borderColor: rgb(0, 0, 0),
            borderWidth: 0.5,
          });
        }
        page.drawText(day.initials || "", {
          x: x + 4,
          y: y + 2,
          size: 6,
          font,
        });
        x += 14;
      });

      page.drawLine({
        start: { x: 105, y: y - 2 },
        end: { x: width - 15, y: y - 2 },
        thickness: 0.5,
      });
      y -= rowHeight;
    });

    page.drawLine({
      start: { x: 15, y: y + rowHeight - 2 },
      end: { x: width - 15, y: y + rowHeight - 2 },
      thickness: 0.5,
    });
  });
  // Draw vertical lines for last page
  const pages = pdfDoc.getPages();
  columnTopsPerPage.forEach((cols, i) => {
    const pg = pages[i];
    const topY = height - 25 - 20 + 10;
    const bottomY = i === currentPageIndex ? y : -2;
    cols.forEach((x) => {
      pg.drawLine({
        start: { x, y: topY },
        end: { x, y: bottomY + 13 },
        thickness: 0.5,
        color: rgb(0, 0, 0),
      });
    });
  });

  const drawSummary = (targetPage: any, startY: number) => {
    const tableX = 15;
    const tableWidth = width - 30;
    const rowHeight = summaryRowHeight;
    const halfWidth = tableWidth / 2;
    const fontSize = 9;
    const fields = [
      [
        ["CHARTING FOR MONTH:", dayjs(month).format("MM-YYYY")],
        [`Pages ${pages.length.toString()}`, ""],
      ],
      [
        ["Primary Care Physician:", data?.medical?.general?.practiceName||""],
        ["Telephone No. (Physician):", data?.medical?.general?.practiceNumber || ""],
      ],
      [
        ["Pharmacy:",data?.medical?.general?.pharmacyName|| ""],
        ["Telephone No. (Pharmacy):", data?.medical?.general?.pharmacyNumber|| ""],
      ],
      ["Patient:", data?.name || ""],
      ["Location:", data?.home||""],
      ["Diagnosis:",  ""],
      ["Food /Medical Allergies:", data?.medical?.general?.foodAllergies],
    ];

    targetPage.drawRectangle({
      x: tableX,
      y: startY,
      width: tableWidth,
      height: rowHeight * fields.length,
      borderColor: rgb(0, 0, 0),
      borderWidth: 1,
    });

    fields.forEach((field, i) => {
      const rowY = startY + (fields.length - i) * rowHeight;
      const nextRowY = rowY - rowHeight;

      targetPage.drawLine({
        start: { x: tableX, y: rowY },
        end: { x: tableX + tableWidth, y: rowY },
        thickness: 0.5,
      });

      if (Array.isArray(field[0])) {
        const [[label1, value1], [label2, value2]] = field;
        targetPage.drawLine({
          start: { x: tableX + halfWidth, y: rowY },
          end: { x: tableX + halfWidth, y: nextRowY },
          thickness: 0.5,
        });

        targetPage.drawText(label1, {
          x: tableX + 5,
          y: nextRowY + 8,
          size: fontSize,
          font,
        });
        if (value1) {
          targetPage.drawText(value1, {
            x: tableX + halfWidth - 5 - value1.length * 4.5,
            y: nextRowY + 8,
            size: fontSize,
            font,
          });
        }

        targetPage.drawText(label2, {
          x: tableX + halfWidth + 5,
          y: nextRowY + 8,
          size: fontSize,
          font,
        });
        if (value2) {
          targetPage.drawText(value2, {
            x: tableX + tableWidth - 5 - value2.length * 4.5,
            y: nextRowY + 8,
            size: fontSize,
            font,
          });
        }
      } else {
        const [label, value] = field;
        const col1Width = tableWidth * 0.35;
        targetPage.drawLine({
          start: { x: tableX + col1Width, y: rowY },
          end: { x: tableX + col1Width, y: nextRowY },
          thickness: 0.5,
        });

        targetPage.drawText(label, {
          x: tableX + 5,
          y: nextRowY + 8,
          size: fontSize,
          font,
        });
        if (value) {
          targetPage.drawText(value, {
            x: tableX + col1Width + 5,
            y: nextRowY + 8,
            size: fontSize,
            font,
          });
        }
      }
    });
  };

  // === Place summary ===
  const sigSpaceNeeded = options?.includeSignaturePlaceholder ? 60 : 0;
  const minBottomMargin = 40 + sigSpaceNeeded;
  const summaryFits = y - summaryHeight > minBottomMargin;

  let summaryStartY: number;
  if (summaryFits) {
    summaryStartY = y - summaryHeight;
    drawSummary(page, summaryStartY);
  } else {
    page = pdfDoc.addPage(pageSize);
    summaryStartY = height - 40 - summaryHeight; // top margin on new page
    drawSummary(page, summaryStartY);
  }

  // === Signature + Date placeholders (for DocuSeal auto-field detection) ===
  // Placed directly below the summary table regardless of page content
  if (options?.includeSignaturePlaceholder) {
    const sigPage = page; // summary is always on the current `page`
    const labelY = summaryStartY - 60; // 80px below bottom edge of summary table
    const sigTagY = labelY + 20;

    // Signature field
    sigPage.drawText("{{Signature}}", {
      x: 120,
      y: sigTagY,
      size: 18,
      font,
      color: rgb(1, 1, 1), // white (invisible) — DocuSeal still detects it
    });
    sigPage.drawText("Signature: ___________________________", {
      x: 50,
      y: labelY,
      size: 10,
      font,
      color: rgb(0, 0, 0),
    });

    // Date field
    sigPage.drawText("{{Date;type=datenow}}", {
      x: 400,
      y: labelY + 5,
      size: 12,
      font,
      color: rgb(1, 1, 1), // white (invisible)
    });
    sigPage.drawText("Date: _______________", {
      x: 350,
      y: labelY,
      size: 10,
      font,
      color: rgb(0, 0, 0),
    });
  }

  const fileName = `${data?.name}-${month}-EMAR.pdf`;
  pdfDoc.setTitle(fileName.replace(/\.pdf$/, ""));
  const pdfBytes = await pdfDoc.save();
  return { pdfBytes, fileName };
}

/** Convenience: generates and immediately downloads the EMAR PDF. */
export async function downloadEmarPdf(data: any, month: string) {
  const { pdfBytes, fileName } = await GenerateEmarPdf(data, month);
  const blob = new Blob([pdfBytes as unknown as BlobPart], {
    type: "application/pdf",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
}
