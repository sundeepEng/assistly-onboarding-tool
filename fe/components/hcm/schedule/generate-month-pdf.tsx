import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { format } from "date-fns";
import { Shift } from "../../../types/hcm-types";

type Member = { userId: string; name: string };
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
  factor = 0.8,
): [number, number, number] => {
  const [r, g, b] = c;
  return [r + (1 - r) * factor, g + (1 - g) * factor, b + (1 - b) * factor];
};

// --- NEW: helpers for dynamic grid / pagination ---
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function generatePDFForMonth(
  daysInMonth: Date[],
  teamMembers: Member[],
  userShifts: UserShifts,
  monthLabel: string,
  seniorOptions?: any[],
  isInhomeCare?: boolean,
) {
  const shifts = userShifts?.shifts ?? [];

  const byDay = new Map<string, Shift[]>();
  for (const s of shifts) {
    const key = toLocalDayKey(s.shift_start_time);
    (byDay.get(key) ?? (byDay.set(key, []), byDay.get(key)!)).push(s);
  }

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Layout constants
  const pageSize: [number, number] = [842, 595]; // A4 landscape
  const marginX = 18;
  const marginY = 24;
  const headerSize = 16;
  const weekdayHeaderGap = 40; // space under month title
  const weekdayRowHeight = 10; // height for day-of-week labels
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // "Chip" layout constants
  const padX = 4;
  const padY = 4;
  const chipH = 26;
  const chipGap = 4;
  const topDayNumberGap = 14; // space reserved for day number line
  const bottomGap = 12;
  const minDayCellH = 80; // minimum day cell height for aesthetics

  const COLS = 7;
  const weeks = chunk(daysInMonth, COLS);

  function newPage() {
    const page = pdfDoc.addPage(pageSize);
    const { width, height } = page.getSize();

    // Header: month label
    page.drawText(monthLabel, {
      x: marginX,
      y: height - marginY - 10,
      size: headerSize,
      font,
      color: rgb(0, 0, 0),
    });

    // Weekday headers
    const gridTop = height - marginY - weekdayHeaderGap;
    for (let c = 0; c < COLS; c++) {
      page.drawText(weekdays[c], {
        x: marginX + (c * (width - marginX * 2)) / COLS + 4,
        y: gridTop + 8,
        size: 10.5,
        font,
        color: rgb(0.25, 0.25, 0.25),
      });
    }

    return { page, width, height, gridTop };
  }

  // Start first page
  let { page, width, height, gridTop } = newPage();
  let cursorY = gridTop - weekdayRowHeight; // start drawing weeks below weekday labels
  const gridWidth = width - marginX * 2;
  const colW = gridWidth / COLS;

  // Utility to compute needed height for a single day cell
  const calcDayHeight = (day?: Date) => {
    if (!day) return minDayCellH;
    const dayKey = format(day, "yyyy-MM-dd");
    const dayShifts = (byDay.get(dayKey) ?? []).sort(
      (a, b) =>
        toDate(a.shift_start_time).getTime() -
        toDate(b.shift_start_time).getTime(),
    );
    if (!dayShifts.length) return minDayCellH;

    // Check if any shift has assigned_to_user_id (in-home care)
    const hasInHomeCareShift = dayShifts.some(
      (shift) => isInhomeCare && (shift as any)?.assigned_to_user_id,
    );

    // Increase chip height for in-home care shifts to accommodate both names
    const adjustedChipH = hasInHomeCareShift ? chipH + 6 : chipH; // Add 6px for extra line

    const chipsTotal =
      dayShifts.length * adjustedChipH + (dayShifts.length - 1) * chipGap;
    const needed = topDayNumberGap + padY + chipsTotal + bottomGap + padY;
    return Math.max(minDayCellH, needed);
  };

  for (const weekDays of weeks) {
    // Ensure exactly 7 positions per row (fill with undefined if last row is short)
    const rowDays: Array<Date | undefined> = [...weekDays];
    while (rowDays.length < COLS) rowDays.push(undefined);

    // Compute row height as max of day heights
    const heights = rowDays.map((d) => calcDayHeight(d));
    const rowH = Math.max(...heights);

    // If not enough space on this page for the whole row, create a new page
    if (cursorY - rowH < marginY) {
      ({ page, width, height, gridTop } = newPage());
      cursorY = gridTop - weekdayRowHeight;
    }

    // Draw each day cell in the row
    for (let c = 0; c < COLS; c++) {
      const day = rowDays[c];
      const x = marginX + c * colW;
      const y = cursorY - rowH;

      // Cell rectangle
      page.drawRectangle({
        x,
        y,
        width: colW,
        height: rowH,
        borderColor: rgb(0.88, 0.88, 0.88),
        borderWidth: 1,
      });

      if (!day) continue;

      // Day number
      page.drawText(format(day, "d"), {
        x: x + 4,
        y: y + rowH - 14,
        size: 10.5,
        font,
        color: rgb(0, 0, 0),
      });

      // Shifts for this day
      const dayKey = format(day, "yyyy-MM-dd");
      const dayShifts = (byDay.get(dayKey) ?? []).sort(
        (a, b) =>
          toDate(a.shift_start_time).getTime() -
          toDate(b.shift_start_time).getTime(),
      );

      // Chips area
      const innerW = colW - padX * 2;
      let chipTop = y + rowH - 30; // start under day number

      for (const s of dayShifts) {
        const start = toDate(s.shift_start_time);
        const end = toDate(s.shift_end_time);
        const t1 = format(start, "hh:mm a");
        const t2 = format(end, "hh:mm a");
        const memberName =
          teamMembers.find((m) => String(m.userId) === String(s.user_id))
            ?.name ?? "";

        const isTimeOff =
          typeof s.shift_status === "string" &&
          s.shift_status.toLowerCase() === "timeoff";

        // Check if this shift has assigned_to_user_id (in-home care)
        const hasAssignedUser = isInhomeCare && (s as any)?.assigned_to_user_id;

        // Adjust chip height for in-home care shifts
        const currentChipH = hasAssignedUser ? chipH + 6 : chipH;

        const base = hexToRgb01(s.shift_color) ?? [0.19, 0.54, 0.67]; // default #3089AB
        const fill = isTimeOff ? [0.98, 0.98, 0.98] : lighten(base, 0.85);
        const border = isTimeOff ? [0.6, 0.6, 0.6] : base;

        // Chip background
        page.drawRectangle({
          x: x + padX,
          y: chipTop - currentChipH,
          width: innerW,
          height: currentChipH,
          color: rgb(fill[0], fill[1], fill[2]),
          borderColor: rgb(border[0], border[1], border[2]),
          borderWidth: 1,
        });

        // Time line
        const timeLabel = `${isTimeOff ? "X " : ""}${t1} – ${t2}`;
        let timeSize = 8.5;
        while (
          timeSize > 6.5 &&
          font.widthOfTextAtSize(timeLabel, timeSize) > innerW - 6
        ) {
          timeSize -= 0.25;
        }
        page.drawText(timeLabel, {
          x: x + padX + 3,
          y: chipTop - 10, // near top of chip
          size: timeSize,
          font,
          color: rgb(0.1, 0.1, 0.1),
        });

        // Name line
        if (memberName) {
          let nameSize = 8;
          const maxW = innerW - 6;
          let nameOut = memberName;
          while (
            nameSize > 6.25 &&
            font.widthOfTextAtSize(nameOut, nameSize) > maxW
          ) {
            nameSize -= 0.25;
          }
          if (font.widthOfTextAtSize(nameOut, nameSize) > maxW) {
            const ell = "…";
            let maxW2 = maxW - font.widthOfTextAtSize(ell, nameSize);
            while (
              nameOut.length &&
              font.widthOfTextAtSize(nameOut, nameSize) > maxW2
            ) {
              nameOut = nameOut.slice(0, -1);
            }
            nameOut = nameOut + ell;
          }

          // Position PCG name based on chip type
          const pcgYPosition = hasAssignedUser
            ? chipTop - currentChipH + 10 // In-home care: positioned for taller box
            : chipTop - currentChipH + 8; // Regular: original positioning

          page.drawText(nameOut, {
            x: x + padX + 3,
            y: pcgYPosition,
            size: nameSize,
            font,
            color: isTimeOff ? rgb(0.45, 0.45, 0.45) : rgb(0.25, 0.25, 0.25),
          });
        }

        // Senior name below PCG
        let seniorName = "";
        if ((s as any)?.assigned_to_user_id) {
          const assignedId = (s as any)?.assigned_to_user_id;
          if (assignedId && seniorOptions) {
            const senior = seniorOptions.find(
              (option: any) => option.value === assignedId,
            );
            seniorName = senior?.option || "Care Team";
          } else if (isInhomeCare && assignedId) {
            seniorName = `Assigned: ${assignedId}`;
          }
        }

        if (seniorName) {
          let seniorSize = 7; // Slightly smaller for senior name
          const maxW = innerW - 6;
          let seniorOut = seniorName;
          while (
            seniorSize > 6 &&
            font.widthOfTextAtSize(seniorOut, seniorSize) > maxW
          ) {
            seniorSize -= 0.25;
          }
          if (font.widthOfTextAtSize(seniorOut, seniorSize) > maxW) {
            const ell = "…";
            let maxW2 = maxW - font.widthOfTextAtSize(ell, seniorSize);
            while (
              seniorOut.length &&
              font.widthOfTextAtSize(seniorOut, seniorSize) > maxW2
            ) {
              seniorOut = seniorOut.slice(0, -1);
            }
            seniorOut = seniorOut + ell;
          }

          page.drawText(seniorOut, {
            x: x + padX + 3,
            y: chipTop - currentChipH + 3, // Better positioning for senior name with proper spacing
            size: seniorSize,
            font,
            color: rgb(0.1, 0.1, 0.1),
          });
        }

        chipTop -= currentChipH + chipGap;
      }
    }

    // Advance cursor to next week row
    cursorY -= rowH;
  }

  return pdfDoc.save();
}
