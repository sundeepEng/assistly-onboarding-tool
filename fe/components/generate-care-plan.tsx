import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import dayjs from "dayjs";

export type CarePlanPdfResult = {
  pdfBytes: Uint8Array;
  fileName: string;
};

const NOT_PROVIDED = "Not Provided";

export async function GenerateCarePlanPdf(
  data: any,
  month: string,
  options?: { includeSignaturePlaceholder?: boolean },
): Promise<CarePlanPdfResult> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [595, 842];
  const serviceColWidth = 120;
  const dayColWidth = 14;
  const startX = 15;
  const rowHeight = 18;
  const headerRowHeight = 18;
  let page = pdfDoc.addPage(pageSize);
  const { width, height } = page.getSize();
  let y = height - 50;

  const formatted = dayjs(`${month}-01`).format("MMMM YYYY");
  const titleText = "CARE PLAN SERVICES RECORD";
  const titleWidth = boldFont.widthOfTextAtSize(titleText, 14);

  // Header
  page.drawText(titleText, {
    x: (width - titleWidth) / 2,
    y,
    size: 14,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  y -= 18;

  const homeText = `Home: ${data?.home || ""}`;
  const homeWidth = boldFont.widthOfTextAtSize(homeText, 11);
  page.drawText(homeText, {
    x: (width - homeWidth) / 2,
    y,
    size: 11,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  y -= 22;

  const labelFontSize = 9;
  const infoLineHeight = 16;
  const infoColGap = 24;
  const infoColWidth = (width - startX * 2 - infoColGap) / 2;
  const rightColX = startX + infoColWidth + infoColGap;

  const drawInfoLine = (
    label: string,
    value: string,
    x: number,
    lineY: number,
  ) => {
    page.drawText(label, {
      x,
      y: lineY,
      size: labelFontSize,
      font: boldFont,
    });
    const labelWidth = boldFont.widthOfTextAtSize(label, labelFontSize);
    page.drawText(value || "", {
      x: x + labelWidth + 4,
      y: lineY,
      size: labelFontSize,
      font,
    });
  };

  const leftInfo = [
    ["Resident Name:", data?.name || ""],
    ["Medicaid #:", data?.medicaid || ""],
    ["Physician Name:", data?.physicianName || ""],
  ];
  const rightInfo = [
    ["Provider Agency:", data?.providerAgency || ""],
    ["Home Provider:", data?.homeProvider || ""],
    ["Month/Year:", data?.monthLabel || formatted],
  ];

  leftInfo.forEach((row, i) => {
    drawInfoLine(row[0], row[1], startX, y - i * infoLineHeight);
  });
  rightInfo.forEach((row, i) => {
    drawInfoLine(row[0], row[1], rightColX, y - i * infoLineHeight);
  });
  y -= leftInfo.length * infoLineHeight + 6;

  const colCount = 31;
  const tableWidth = serviceColWidth + dayColWidth * colCount;

  const drawCell = (
    text: string,
    x: number,
    cellY: number,
    cellWidth: number,
    fontSize = 8,
    color = rgb(0, 0, 0),
    align: "left" | "right" | "center" = "left",
  ) => {
    const textWidth = font.widthOfTextAtSize(text || "", fontSize);
    let drawX = x + 3;
    if (align === "center") {
      drawX = x + (cellWidth - textWidth) / 2;
    } else if (align === "right") {
      drawX = x + cellWidth - textWidth - 3;
    }
    page.drawText(text || "", {
      x: drawX,
      y: cellY + 4,
      size: fontSize,
      font,
      color,
    });
  };

  const wrapText = (text: string, maxWidth: number, fontSize: number): string[] => {
    if (!text) return [""];
    const words = text.split(" ");
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(test, fontSize) <= maxWidth) {
        current = test;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [""];
  };

  const drawHeaderRow = () => {
    let x = startX;

    // Top border
    page.drawLine({
      start: { x: startX, y: y + headerRowHeight },
      end: { x: startX + tableWidth, y: y + headerRowHeight },
      thickness: 0.5,
    });

    // Service header
    page.drawLine({
      start: { x, y: y + headerRowHeight },
      end: { x, y },
      thickness: 0.5,
    });
    drawCell(
      "SERVICE",
      x,
      y + (headerRowHeight - 9) / 2 - 4,
      serviceColWidth,
      9,
      undefined,
      "center",
    );
    x += serviceColWidth;

    // Day headers
    const dayCellY = y + (headerRowHeight - 7) / 2 - 4;
    for (let day = 1; day <= colCount; day++) {
      page.drawLine({
        start: { x, y: y + headerRowHeight },
        end: { x, y },
        thickness: 0.5,
      });
      drawCell(`${day}`, x, dayCellY, dayColWidth, 7, undefined, "center");
      x += dayColWidth;
    }

    // Right border
    page.drawLine({
      start: { x: startX + tableWidth, y: y + headerRowHeight },
      end: { x: startX + tableWidth, y },
      thickness: 0.5,
    });

    // Bottom border
    page.drawLine({
      start: { x: startX, y: y },
      end: { x: startX + tableWidth, y },
      thickness: 0.5,
    });
  };

  const centeredFirstBaseline = (
    bottomY: number,
    cellHeight: number,
    lineCount: number,
    lineHeight: number,
    fontSize: number,
  ) =>
    bottomY +
    cellHeight / 2 -
    0.4 * fontSize -
    ((lineCount - 1) * lineHeight) / 2;

  const drawServiceRow = (row: any) => {
    const displayName = row.serviceName || "";
    const serviceLines = wrapText(displayName, serviceColWidth - 8, 7);
    const lineHeight = 9;
    const serviceTextHeight = serviceLines.length * lineHeight;
    const currentRowHeight = Math.max(rowHeight, serviceTextHeight + 10);

    checkSpace(currentRowHeight);
    if (drawHeaderOnNewPage) {
      drawHeaderRow();
      drawHeaderOnNewPage = false;
    }
    y -= currentRowHeight;

    const rowTop = y + currentRowHeight;
    let x = startX;

    // Service name
    page.drawLine({
      start: { x, y: rowTop },
      end: { x, y },
      thickness: 0.5,
    });

    const serviceTextY = centeredFirstBaseline(
      y,
      currentRowHeight,
      serviceLines.length,
      lineHeight,
      7,
    );
    serviceLines.forEach((line, i) => {
      page.drawText(line, {
        x: x + 4,
        y: serviceTextY + i * lineHeight,
        size: 7,
        font,
      });
    });
    x += serviceColWidth;

    // Day cells
    for (const dayCell of row.days) {
      const cellX = x;
      page.drawLine({
        start: { x: cellX, y: rowTop },
        end: { x: cellX, y },
        thickness: 0.5,
      });

      const hasValue = dayCell.status || dayCell.value;

      if (hasValue) {
        const centerY = y + currentRowHeight / 2;

        if (row.category === "Vital Signs" && dayCell.value) {
          // Show tiny value for vital signs
          const maxValWidth = dayColWidth - 4;
          let valText = dayCell.value;
          while (
            font.widthOfTextAtSize(valText, 5) > maxValWidth &&
            valText.length > 0
          ) {
            valText = valText.slice(0, -1);
          }
          if (valText.length < dayCell.value.length) valText += "…";
          const valWidth = font.widthOfTextAtSize(valText, 5);
          page.drawText(valText, {
            x: cellX + (dayColWidth - valWidth) / 2,
            y: centerY - 2,
            size: 5,
            font,
          });
        } else if (dayCell.status) {
          const statusText = dayCell.status;
          const isNotProvided = dayCell.providedOrNot === "Not Provided";
          const fontSize = 6;
          const textWidth = font.widthOfTextAtSize(statusText, fontSize);

          if (isNotProvided) {
            // Circle not-provided entries
            page.drawEllipse({
              x: cellX + dayColWidth / 2,
              y: centerY,
              xScale: 6,
              yScale: 6,
              borderColor: rgb(0, 0, 0),
              borderWidth: 0.5,
            });
          }

          page.drawText(statusText, {
            x: cellX + (dayColWidth - textWidth) / 2,
            y: centerY - fontSize / 2,
            size: fontSize,
            font,
          });
        }
      }

      x += dayColWidth;
    }

    // Right border
    page.drawLine({
      start: { x: startX + tableWidth, y: rowTop },
      end: { x: startX + tableWidth, y },
      thickness: 0.5,
    });

    // Bottom border
    page.drawLine({
      start: { x: startX, y },
      end: { x: startX + tableWidth, y },
      thickness: 0.5,
    });
  };

  let drawHeaderOnNewPage = false;

  const checkSpace = (needed: number) => {
    if (y < needed + 60) {
      page = pdfDoc.addPage(pageSize);
      y = height - 50;
      drawHeaderOnNewPage = true;
    }
  };

  drawHeaderRow();

  if (data?.rows?.length > 0) {
    for (const row of data.rows) {
      drawServiceRow(row);
    }
  } else {
    checkSpace(rowHeight);
    page.drawText("No care plan services recorded for this month.", {
      x: startX,
      y,
      size: 10,
      font,
    });
    y -= rowHeight;
  }

  // Vital signs detail section
  if (data?.vitalSignReadings?.length > 0) {
    const detailColWidths = [120, 60, 60, 325];
    const detailRowHeight = 16;
    const detailHeaders = ["Vital Sign", "Date", "Time", "Value"];
    const detailTableRight = startX + detailColWidths.reduce((a, b) => a + b, 0);
    const lineHeight = 10;

    interface DetailRow {
      serviceName: string;
      date: string;
      time: string;
      value: string;
      rowHeight: number;
      serviceGroupHeight: number;
      dateGroupHeight: number;
      isFirstService: boolean;
      isLastService: boolean;
      isFirstDate: boolean;
      isLastDate: boolean;
    }

    // Build hierarchical rows: vital sign -> date -> readings
    const byService: Record<string, Record<string, any[]>> = {};
    data.vitalSignReadings.forEach((reading: any) => {
      if (!byService[reading.serviceName]) byService[reading.serviceName] = {};
      if (!byService[reading.serviceName][reading.date])
        byService[reading.serviceName][reading.date] = [];
      byService[reading.serviceName][reading.date].push(reading);
    });

    const detailRows: DetailRow[] = [];
    const serviceGroups: { start: number; end: number; height: number }[] = [];
    Object.entries(byService).forEach(([serviceName, dates]) => {
      const serviceStartIndex = detailRows.length;
      Object.entries(dates).forEach(([date, readings]) => {
        const dateStartIndex = detailRows.length;
        readings.forEach((r: any) => {
          const timeText = String(r.time || "");
          const valueText = String(r.value || "");
          const timeLines = wrapText(timeText, detailColWidths[2] - 8, 8);
          const valueLines = wrapText(valueText, detailColWidths[3] - 8, 8);
          const lineCount = Math.max(timeLines.length, valueLines.length, 1);
          const rowHeight = Math.max(detailRowHeight, lineCount * lineHeight + 8);
          detailRows.push({
            serviceName,
            date,
            time: timeLines.join(" "),
            value: valueLines.join(" "),
            rowHeight,
            serviceGroupHeight: 0,
            dateGroupHeight: 0,
            isFirstService: false,
            isLastService: false,
            isFirstDate: false,
            isLastDate: false,
          });
        });
        const dateEndIndex = detailRows.length - 1;
        const dateHeight = detailRows
          .slice(dateStartIndex, dateEndIndex + 1)
          .reduce((sum, r) => sum + r.rowHeight, 0);
        for (let i = dateStartIndex; i <= dateEndIndex; i++) {
          detailRows[i].dateGroupHeight = dateHeight;
          detailRows[i].isFirstDate = i === dateStartIndex;
          detailRows[i].isLastDate = i === dateEndIndex;
        }
      });
      const serviceEndIndex = detailRows.length - 1;
      const serviceHeight = detailRows
        .slice(serviceStartIndex, serviceEndIndex + 1)
        .reduce((sum, r) => sum + r.rowHeight, 0);
      for (let i = serviceStartIndex; i <= serviceEndIndex; i++) {
        detailRows[i].serviceGroupHeight = serviceHeight;
        detailRows[i].isFirstService = i === serviceStartIndex;
        detailRows[i].isLastService = i === serviceEndIndex;
      }
      serviceGroups.push({
        start: serviceStartIndex,
        end: serviceEndIndex,
        height: serviceHeight,
      });
    });

    const drawDetailHeader = () => {
      let x = startX;
      const detailTop = y + detailRowHeight;
      page.drawLine({
        start: { x: startX, y: detailTop },
        end: { x: detailTableRight, y: detailTop },
        thickness: 0.5,
      });
      const headerCellY = y + (detailRowHeight - 9) / 2 - 4;
      detailHeaders.forEach((text, i) => {
        page.drawLine({
          start: { x, y: detailTop },
          end: { x, y },
          thickness: 0.5,
        });
        drawCell(text, x, headerCellY, detailColWidths[i], 9, undefined, "center");
        x += detailColWidths[i];
      });
      page.drawLine({
        start: { x, y: detailTop },
        end: { x, y },
        thickness: 0.5,
      });
      page.drawLine({
        start: { x: startX, y },
        end: { x: detailTableRight, y },
        thickness: 0.5,
      });
    };

    const checkDetailPage = (needed: number) => {
      if (y < needed + 60) {
        page = pdfDoc.addPage(pageSize);
        y = height - 50;
        return true;
      }
      return false;
    };

    let needsDetailTopBorder = false;

    // Add breathing room between the main table and the detail section
    const sectionSpacing = 16;

    // Title + header + first group must fit; otherwise start detail section on a new page
    const titleToHeaderGap = 24;
    const firstGroupHeight = serviceGroups[0].height;
    const detailStartNeeded = sectionSpacing + 12 + titleToHeaderGap + detailRowHeight + firstGroupHeight;
    needsDetailTopBorder = checkDetailPage(detailStartNeeded);

    y -= sectionSpacing;

    // Title (gap to header)
    page.drawText("Vital Signs Detail", {
      x: startX,
      y,
      size: 12,
      font: boldFont,
    });
    y -= titleToHeaderGap;

    drawDetailHeader();

    for (const group of serviceGroups) {
      const groupHeight = group.height;
      if (y < groupHeight + 60) {
        page = pdfDoc.addPage(pageSize);
        y = height - 50;
        needsDetailTopBorder = true;
      }

      const serviceGroupEnd = group.end;
      for (let k = group.start; k <= serviceGroupEnd; k++) {
        const row = detailRows[k];
        const rowHeight = row.rowHeight;
        y -= rowHeight;
        const rowTop = y + rowHeight;

        if (needsDetailTopBorder) {
          page.drawLine({
            start: { x: startX, y: rowTop },
            end: { x: detailTableRight, y: rowTop },
            thickness: 0.5,
          });
          needsDetailTopBorder = false;
        }

        // Vertical grid lines
        let x = startX;
        page.drawLine({
          start: { x, y: rowTop },
          end: { x, y },
          thickness: 0.5,
        });
        x += detailColWidths[0];
        page.drawLine({
          start: { x, y: rowTop },
          end: { x, y },
          thickness: 0.5,
        });
        x += detailColWidths[1];
        page.drawLine({
          start: { x, y: rowTop },
          end: { x, y },
          thickness: 0.5,
        });
        x += detailColWidths[2];
        page.drawLine({
          start: { x, y: rowTop },
          end: { x, y },
          thickness: 0.5,
        });
        x += detailColWidths[3];
        page.drawLine({
          start: { x, y: rowTop },
          end: { x, y },
          thickness: 0.5,
        });

        // Service name (merged parent)
        if (row.isFirstService) {
          const serviceBottom = rowTop - row.serviceGroupHeight;
          const serviceLines = wrapText(row.serviceName, detailColWidths[0] - 8, 8);
          const serviceTextY = centeredFirstBaseline(
            serviceBottom,
            row.serviceGroupHeight,
            serviceLines.length,
            lineHeight,
            8,
          );
          serviceLines.forEach((line, n) => {
            page.drawText(line, {
              x: startX + 4,
              y: serviceTextY + n * lineHeight,
              size: 8,
              font,
            });
          });
        }

        // Date (merged child)
        if (row.isFirstDate) {
          const dateBottom = rowTop - row.dateGroupHeight;
          const dateX = startX + detailColWidths[0];
          const dateCellY = centeredFirstBaseline(
            dateBottom,
            row.dateGroupHeight,
            1,
            lineHeight,
            8,
          );
          drawCell(row.date, dateX, dateCellY, detailColWidths[1], 8, undefined, "center");
        }

        // Time
        const timeX = startX + detailColWidths[0] + detailColWidths[1];
        const timeTextY = centeredFirstBaseline(
          y,
          rowHeight,
          1,
          lineHeight,
          8,
        );
        drawCell(row.time, timeX, timeTextY, detailColWidths[2], 8, undefined, "center");

        // Value
        const valueX =
          startX + detailColWidths[0] + detailColWidths[1] + detailColWidths[2];
        const valueTextY = centeredFirstBaseline(
          y,
          rowHeight,
          1,
          lineHeight,
          8,
        );
        drawCell(row.value, valueX, valueTextY, detailColWidths[3], 8, undefined, "center");

        // Bottom separator line - extent depends on group boundaries
        if (row.isLastService) {
          page.drawLine({
            start: { x: startX, y },
            end: { x: detailTableRight, y },
            thickness: 0.5,
          });
        } else if (row.isLastDate) {
          page.drawLine({
            start: { x: startX + detailColWidths[0], y },
            end: { x: detailTableRight, y },
            thickness: 0.5,
          });
        } else {
          page.drawLine({
            start: { x: startX + detailColWidths[0] + detailColWidths[1], y },
            end: { x: detailTableRight, y },
            thickness: 0.5,
          });
        }
      }
    }
  }

  // Signature placeholder (same pattern as EMAR)
  if (options?.includeSignaturePlaceholder) {
    const sigY = y - 40;
    page.drawText("{{Signature}}", {
      x: 120,
      y: sigY + 20,
      size: 18,
      font,
      color: rgb(1, 1, 1),
    });
    page.drawText("Signature: ___________________________", {
      x: 50,
      y: sigY,
      size: 10,
      font,
      color: rgb(0, 0, 0),
    });
    page.drawText("{{Date;type=datenow}}", {
      x: 400,
      y: sigY + 5,
      size: 12,
      font,
      color: rgb(1, 1, 1),
    });
    page.drawText("Date: _______________", {
      x: 350,
      y: sigY,
      size: 10,
      font,
      color: rgb(0, 0, 0),
    });
  }

  const fileName = `${data?.name || "resident"}-${month}-Care Report.pdf`;
  pdfDoc.setTitle(fileName.replace(/\.pdf$/, ""));
  const pdfBytes = await pdfDoc.save();
  return { pdfBytes, fileName };
}

export async function downloadCarePlanPdf(data: any, month: string) {
  const { pdfBytes, fileName } = await GenerateCarePlanPdf(data, month);
  const blob = new Blob([pdfBytes as unknown as BlobPart], {
    type: "application/pdf",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
}