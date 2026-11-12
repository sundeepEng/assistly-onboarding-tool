import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { format } from "date-fns";
import { Shift } from "../../../types/hcm-types"; // Use the consolidated Shift type

type Member = { userId: string; name: string; roaster?: any[] };
export type UserShifts = { shifts?: Shift[] };

const toDate = (v: string | Date) => (v instanceof Date ? v : new Date(v));
const toLocalDayKey = (d: string | Date) => {
  const dt = toDate(d);
  const local = new Date(
    dt.getFullYear(),
    dt.getMonth(),
    dt.getDate(),
    0,
    0,
    0,
    0,
  );
  return format(local, "yyyy-MM-dd");
};

const hexToRgb01 = (hex?: string): [number, number, number] | null => {
  if (!hex) return null;
  const m = hex.trim().match(/^#?([a-f\d]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

const lighten = (
  c: [number, number, number],
  factor = 0.75,
): [number, number, number] => {
  const [r, g, b] = c;
  return [r + (1 - r) * factor, g + (1 - g) * factor, b + (1 - b) * factor];
};

/** Shrink-to-fit, then truncate with ellipsis if needed. */
const fitTextToWidth = (
  text: string,
  maxWidth: number,
  font: any,
  startSize: number,
  minSize: number,
) => {
  let size = startSize;
  let str = text;

  while (size > minSize && font.widthOfTextAtSize(str, size) > maxWidth) {
    size -= 0.25;
  }

  if (font.widthOfTextAtSize(str, size) > maxWidth) {
    const ell = "…";
    const target = Math.max(0, maxWidth - font.widthOfTextAtSize(ell, size));
    while (str.length && font.widthOfTextAtSize(str, size) > target) {
      str = str.slice(0, -1);
    }
    str = str + ell;
  }

  return { text: str, size };
};

export const generatePDFForWeek = async (
  teamMembers: Member[],
  weekDays: Date[],
  userShifts: UserShifts,
  seniorOptions?: any[],
  isInhomeCare?: boolean,
) => {
  const shifts = userShifts?.shifts ?? [];

  // Index shifts by (userId, dayKey)
  const byUserDay = new Map<string, Shift[]>();
  for (const s of shifts) {
    const k = `${s.user_id}::${toLocalDayKey(s.shift_start_time)}`;
    const arr = byUserDay.get(k);
    if (arr) arr.push(s);
    else byUserDay.set(k, [s]);
  }

  // ---- Layout ----
  const NAME_COL_WIDTH = 100; // Team column width
  const HEADER_HEIGHT = 50; // Header area height
  const MIN_ROW_HEIGHT = 60; // Row minimum height
  const BOX_LINE_HEIGHT = 18;
  const BOX_V_GAP = 6;
  const CELL_PAD_X = 6;
  const CELL_PAD_Y = 6;

  const BOX_FONT_START = 8.5;
  const BOX_FONT_MIN = 7.0;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pageSize: [number, number] = [842, 595]; // A4 landscape
  const marginX = 20;
  const marginY = 30;

  let page = pdfDoc.addPage(pageSize);
  let { width, height } = page.getSize();
  let cursorY = height - marginY;

  const dayColWidth = Math.floor(
    (pageSize[0] - marginX * 2 - NAME_COL_WIDTH) / 7,
  );

  const drawPageHeader = () => {
    const headerY = cursorY - HEADER_HEIGHT / 2;

    // Date range
    page.drawText(
      `${format(weekDays[0], "MMM d, yyyy")} - ${format(
        weekDays[6],
        "MMM d, yyyy",
      )}`,
      { x: marginX + 6, y: headerY + 6, size: 13, font, color: rgb(0, 0, 0) },
    );

    cursorY -= HEADER_HEIGHT + 5; // space below header

    // Column titles
    page.drawText("Team", { x: marginX + 6, y: headerY - 25, size: 12, font });
    weekDays.forEach((d, i) => {
      const x = marginX + NAME_COL_WIDTH + i * dayColWidth + 6;
      page.drawText(format(d, "EEE dd"), {
        x,
        y: headerY - 25,
        size: 12,
        font,
      });
    });

    // Daily wage/hour summary
    weekDays.forEach((date, i) => {
      const dateKey = format(date, "yyyy-MM-dd");
      const shiftsForDay = (shifts || []).filter(
        (shift) =>
          format(toDate(shift.shift_start_time), "yyyy-MM-dd") === dateKey,
      );

      let totalHours = 0;
      let totalWages = 0;

      shiftsForDay
        .filter((shift) => shift.shift_status === "available")
        .forEach((shift) => {
          const start = toDate(shift.shift_start_time);
          const end = toDate(shift.shift_end_time);
          const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          totalHours += hours;

          // Find the team member to get pay frequency
          const member = teamMembers.find((m) => m.userId === shift.user_id);
          // Skip wage calculation for monthly pay frequency
          if (
            shift.pay_rate &&
            member?.roaster?.[0]?.pay_frequency !== "Monthly"
          ) {
            totalWages += hours * shift.pay_rate;
          }
        });

      totalHours = Math.round(totalHours * 100) / 100;
      totalWages = Math.round(totalWages * 100) / 100;

      const x = marginX + NAME_COL_WIDTH + i * dayColWidth + 6;
      page.drawText(`${totalHours} hrs`, {
        x,
        y: headerY - 55,
        size: 10,
        font,
        color: rgb(0, 0, 0),
      });
    });

    cursorY -= MIN_ROW_HEIGHT + 8;
  };

  const needNewPage = (neededHeight: number) => {
    if (cursorY - neededHeight < marginY) {
      page = pdfDoc.addPage(pageSize);
      ({ width, height } = page.getSize());
      cursorY = height - marginY;
      drawPageHeader();
    }
  };

  drawPageHeader();

  for (const member of teamMembers) {
    // Shifts for each day for this member
    const perDayShifts: Shift[][] = [];
    let maxBoxes = 1;

    weekDays.forEach((day) => {
      const key = `${member.userId}::${toLocalDayKey(day)}`;
      const dayShifts = (byUserDay.get(key) ?? []).sort(
        (a, b) =>
          toDate(a.shift_start_time).getTime() -
          toDate(b.shift_start_time).getTime(),
      );
      perDayShifts.push(dayShifts);
      if (dayShifts.length > maxBoxes) maxBoxes = dayShifts.length;
    });

    const BOX_HEIGHT = BOX_LINE_HEIGHT + 6;
    const rowHeight = Math.max(
      MIN_ROW_HEIGHT,
      CELL_PAD_Y * 2 + maxBoxes * BOX_HEIGHT + (maxBoxes - 1) * BOX_V_GAP,
    );
    needNewPage(rowHeight + 8);

    // Row frame
    page.drawRectangle({
      x: marginX,
      y: cursorY - rowHeight,
      width: NAME_COL_WIDTH + dayColWidth * 7,
      height: rowHeight,
      color: undefined,
      borderColor: rgb(0.92, 0.92, 0.92),
      borderWidth: 1,
    });

    // --- TEAM CELL (name + wage rate) ---
    // Name: shrink-to-fit and truncate within NAME_COL_WIDTH
    {
      const nameRaw = member.name ?? "";
      const nameMaxWidth = NAME_COL_WIDTH - 2 * CELL_PAD_X; // respect left/right padding
      const { text: fittedName, size: fittedNameSize } = fitTextToWidth(
        nameRaw,
        nameMaxWidth,
        font,
        10, // start font size
        8, // min font size
      );

      page.drawText(fittedName, {
        x: marginX + CELL_PAD_X,
        y: cursorY - 14,
        size: fittedNameSize,
        font,
        color: rgb(0, 0, 0),
      });
    }

    // Wage Rate directly under the name
    // --- end TEAM CELL ---

    // Vertical separator after Team column
    page.drawLine({
      start: { x: marginX + NAME_COL_WIDTH, y: cursorY },
      end: { x: marginX + NAME_COL_WIDTH, y: cursorY - rowHeight },
      thickness: 1,
      color: rgb(0.86, 0.86, 0.86),
    });

    // Day cells: draw shift chips
    weekDays.forEach((_d, i) => {
      const cellX = marginX + NAME_COL_WIDTH + i * dayColWidth;

      // Right border for the cell
      page.drawLine({
        start: { x: cellX + dayColWidth, y: cursorY },
        end: { x: cellX + dayColWidth, y: cursorY - rowHeight },
        thickness: 1,
        color: rgb(0.92, 0.92, 0.92),
      });

      const dayShifts = perDayShifts[i];
      if (!dayShifts.length) return;

      // available vertical space inside cell
      let boxTop = cursorY - CELL_PAD_Y - BOX_HEIGHT;

      for (const s of dayShifts) {
        const start = toDate(s.shift_start_time);
        const end = toDate(s.shift_end_time);

        const isTimeOff =
          typeof s.shift_status === "string" &&
          s.shift_status.toLowerCase() === "timeoff";
        const t1 = format(start, "hh:mm a");
        const t2 = format(end, "hh:mm a");
        const rawLabel = `${t1} - ${t2}`;

        const base = hexToRgb01(s.shift_color) ?? [0.19, 0.54, 0.67]; // default #3089AB
        const fill = isTimeOff ? [0.96, 0.96, 0.96] : lighten(base, 0.8);
        const border = isTimeOff ? [0.65, 0.65, 0.65] : base;

        const innerW = dayColWidth - 2 * CELL_PAD_X;
        const { text: fitted, size: fittedSize } = fitTextToWidth(
          rawLabel,
          innerW,
          font,
          BOX_FONT_START,
          BOX_FONT_MIN,
        );

        // Box
        const boxY = boxTop;
        page.drawRectangle({
          x: cellX + CELL_PAD_X,
          y: boxY,
          width: dayColWidth - CELL_PAD_X * 2,
          height: BOX_HEIGHT,
          color: rgb(fill[0], fill[1], fill[2]),
          borderColor: rgb(border[0], border[1], border[2]),
          borderWidth: 1.2,
        });
        // Add "Care Team" or "TimeOff" text neatly inside the shift box with 1px space at the top

        let label = isTimeOff ? "X TimeOff" : "Care Team";

        // Check for assigned user in in-home care
        if (!isTimeOff && (s as any)?.assigned_to_user_id) {
          const assignedId = (s as any)?.assigned_to_user_id;
          if (assignedId && seniorOptions) {
            const senior = seniorOptions.find(
              (option: any) => option.value === assignedId,
            );
            label = senior?.option || "Care Team";
          } else if (isInhomeCare && assignedId) {
            label = `Assigned: ${assignedId}`;
          }
        }
        const labelY = boxY + (BOX_HEIGHT - fittedSize) / 2 - 2;
        page.drawText(label, {
          x: cellX + CELL_PAD_X + 4,
          y: labelY,
          size: fittedSize - 1, // Slightly smaller font size for the label
          font,
          color: rgb(0.1, 0.1, 0.1),
        });

        // Text (vertically centered)
        const textY = boxY + (BOX_HEIGHT - fittedSize);
        page.drawText(fitted, {
          x: cellX + CELL_PAD_X + 4,
          y: textY,
          size: fittedSize,
          font,
          color: rgb(0.1, 0.1, 0.1),
        });

        // Next box
        boxTop -= BOX_HEIGHT + BOX_V_GAP;
      }
    });

    cursorY -= rowHeight; // next row
  }

  return pdfDoc.save();
};
