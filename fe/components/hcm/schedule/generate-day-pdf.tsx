import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { format } from "date-fns";
import { Shift } from "../../../types/hcm-types";

type Member = {
  userId: string;
  name: string;
  profileImageUrl?: string;
  roaster?: Array<{ pay_rate?: number | string }>;
};

export type UserShifts = { shifts?: Shift[] };

const toDate = (v: string | Date) => (v instanceof Date ? v : new Date(v));
const toLocalDayKey = (d: Date) =>
  format(
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0),
    "yyyy-MM-dd",
  );

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

function payText(member: Member) {
  const rawRates =
    (member.roaster ?? [])
      .map((r) => (r?.pay_rate == null ? null : Number(r.pay_rate)))
      .filter((n): n is number => Number.isFinite(n)) ?? [];

  const top = (member as any)?.pay_rate;
  if (rawRates.length === 0 && Number.isFinite(Number(top))) {
    rawRates.push(Number(top));
  }

  if (!rawRates.length) return "--";
  const dedup = Array.from(new Set(rawRates.map((n) => n.toFixed(2))));

  const payFrequency =
    (member.roaster?.[0] as any)?.pay_frequency === "Monthly" ? "m" : "hr";
  return `$${dedup.join(", ")}/${payFrequency}`;
}

export async function generatePDFForDay(
  teamMembers: Member[],
  date: Date,
  userShifts: UserShifts,
  seniorOptions?: any[],
  isInhomeCare?: boolean,
) {
  const all = userShifts?.shifts ?? [];
  const dayKey = toLocalDayKey(date);

  // Only this day's shifts
  const shifts = all.filter(
    (s) => format(toDate(s.shift_start_time), "yyyy-MM-dd") === dayKey,
  );

  // Group by user
  const byUser = new Map<string, Shift[]>();
  for (const s of shifts) {
    const uid = String(s.user_id);
    const arr = byUser.get(uid);
    if (arr) arr.push(s);
    else byUser.set(uid, [s]);
  }
  // Use Map.forEach to avoid requiring --downlevelIteration or ES2015+ target
  byUser.forEach((arr, uid) => {
    arr.sort(
      (a, b) =>
        toDate(a.shift_start_time).getTime() -
        toDate(b.shift_start_time).getTime(),
    );
    byUser.set(uid, arr);
  });

  // Determine hour window (+/- 1h padding)
  let minMin = 8 * 60;
  let maxMin = 18 * 60;
  if (shifts.length) {
    const mins = shifts.flatMap((s) => {
      const st = toDate(s.shift_start_time);
      const en = toDate(s.shift_end_time);
      return [
        st.getHours() * 60 + st.getMinutes(),
        en.getHours() * 60 + en.getMinutes(),
      ];
    });
    minMin = Math.min(...mins);
    maxMin = Math.max(...mins);
    minMin = Math.max(minMin - 60, 0);
    maxMin = Math.min(maxMin + 60, 24 * 60);
  }
  minMin = Math.floor(minMin / 60) * 60;
  maxMin = Math.ceil(maxMin / 60) * 60;
  const totalMinutes = Math.max(60, maxMin - minMin);

  // PDF layout
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pageSize: [number, number] = [842, 595]; // A4 landscape
  const marginX = 22;
  const marginY = 26;
  let page = pdfDoc.addPage(pageSize);
  let { width, height } = page.getSize();

  const NAME_COL_WIDTH = 130;
  const HEADER_H = 50;
  const ROW_MIN_H = 44;
  const CHIP_H = 18;
  const CHIP_V_GAP = 6;
  const CELL_PAD_X = 6;

  const timelineX = marginX + NAME_COL_WIDTH;
  const timelineW = width - marginX - timelineX;
  const tickEveryMins = 60;
  const numTicks = Math.floor(totalMinutes / tickEveryMins) + 1;

  let cursorY = height - marginY;

  const drawPageHeader = () => {
    // Title & date
    page.drawText(`Daily Schedule — ${format(date, "EEEE, MMM d, yyyy")}`, {
      x: marginX,
      y: cursorY - 16,
      size: 14,
      font,
      color: rgb(0, 0, 0),
    });

    // Hour tick labels (top timeline)
    for (let i = 0; i < numTicks; i++) {
      const minute = minMin + i * tickEveryMins;
      const pct = (minute - minMin) / totalMinutes;
      const x = timelineX + pct * timelineW;

      const hour = Math.floor(minute / 60);
      const min = minute % 60;
      const label = format(new Date(2000, 0, 1, hour, min, 0), "ha");

      page.drawText(label, {
        x: x - font.widthOfTextAtSize(label, 9) / 2,
        y: cursorY - HEADER_H + 6,
        size: 9,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });

      // tick
      page.drawLine({
        start: { x, y: cursorY - HEADER_H - 2 },
        end: { x, y: marginY + 6 },
        thickness: 0.5,
        color: rgb(0.92, 0.92, 0.92),
      });
    }

    // Column labels
    page.drawText("Team", {
      x: marginX + 4,
      y: cursorY - HEADER_H + 18,
      size: 11,
      font,
    });

    cursorY = height - marginY - HEADER_H - 8;
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

  // Rows
  for (const member of teamMembers) {
    const uid = String(member.userId);
    const ms = byUser.get(uid) ?? [];

    const maxBoxes = Math.max(1, ms.length);

    // Check if any shift has assigned_to_user_id (in-home care)
    const hasInHomeCareShift = ms.some(
      (shift) => isInhomeCare && (shift as any)?.assigned_to_user_id,
    );

    // Adjust chip height for in-home care shifts
    const adjustedChipH = hasInHomeCareShift ? CHIP_H + 6 : CHIP_H;

    const rowH = Math.max(
      ROW_MIN_H,
      12 + maxBoxes * (adjustedChipH + CHIP_V_GAP),
    );

    needNewPage(rowH + 8);

    // row border
    page.drawRectangle({
      x: marginX,
      y: cursorY - rowH,
      width: width - marginX * 2,
      height: rowH,
      borderColor: rgb(0.92, 0.92, 0.92),
      borderWidth: 1,
    });

    // left name cell + wage
    const truncateText = (text, maxWidth, font, fontSize) => {
      let truncated = text;
      while (font.widthOfTextAtSize(truncated, fontSize) > maxWidth) {
        truncated = truncated.slice(0, -1);
      }
      return truncated + (truncated.length < text.length ? "…" : "");
    };

    page.drawText(
      truncateText(member.name ?? "", NAME_COL_WIDTH - 12, font, 10),
      {
        x: marginX + 6,
        y: cursorY - 14,
        size: 10,
        font,
        color: rgb(0, 0, 0),
      },
    );

    // vertical separator
    page.drawLine({
      start: { x: marginX + NAME_COL_WIDTH, y: cursorY },
      end: { x: marginX + NAME_COL_WIDTH, y: cursorY - rowH },
      thickness: 1,
      color: rgb(0.86, 0.86, 0.86),
    });

    // chips
    ms.forEach((s, idx) => {
      const start = toDate(s.shift_start_time);
      const end = toDate(s.shift_end_time);
      const sMin = start.getHours() * 60 + start.getMinutes();
      const eMin = end.getHours() * 60 + end.getMinutes();

      const leftPct = Math.max(0, (sMin - minMin) / totalMinutes);
      const rightPct = Math.max(0, (eMin - minMin) / totalMinutes);
      const chipX = timelineX + leftPct * timelineW + CELL_PAD_X;
      const chipW = Math.max(
        24,
        (rightPct - leftPct) * timelineW - CELL_PAD_X * 2,
      );

      // Check if this shift has assigned_to_user_id (in-home care)
      const hasAssignedUser = isInhomeCare && (s as any)?.assigned_to_user_id;

      // Adjust chip height for in-home care shifts
      const currentChipH = hasAssignedUser ? CHIP_H + 6 : CHIP_H;

      const chipY = cursorY - 10 - (idx + 1) * (currentChipH + CHIP_V_GAP);

      const isTO = String(s.shift_status || "").toLowerCase() !== "available";
      const base = hexToRgb01(s.shift_color) ?? [0.19, 0.54, 0.67]; // #3089AB
      const fill = isTO ? [0.96, 0.96, 0.96] : lighten(base, 0.8);
      const border = isTO ? [0.65, 0.65, 0.65] : base;

      page.drawRectangle({
        x: chipX,
        y: chipY,
        width: chipW,
        height: currentChipH,
        color: rgb(fill[0], fill[1], fill[2]),
        borderColor: rgb(border[0], border[1], border[2]),
        borderWidth: 1.2,
      });

      const labelRaw = isTO
        ? `X ${format(start, "h:mm a")} – ${format(end, "h:mm a")}`
        : `${format(start, "h:mm a")} – ${format(end, "h:mm a")}`;

      const { text: label, size } = fitTextToWidth(
        labelRaw,
        chipW - 6,
        font,
        9,
        7,
      );

      // Position time label based on chip type
      const timeYPosition = hasAssignedUser
        ? chipY + currentChipH - 8 // In-home care: position near top
        : chipY + (currentChipH - size) / 2 - 0.5; // Regular: center position

      page.drawText(label, {
        x: chipX + 3,
        y: timeYPosition,
        size,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });

      // Add senior name below time for in-home care shifts
      if (hasAssignedUser) {
        const assignedId = (s as any)?.assigned_to_user_id;
        let seniorName = "";

        if (assignedId && seniorOptions) {
          const senior = seniorOptions.find(
            (option: any) => option.value === assignedId,
          );
          seniorName = senior?.option || "Care Team";
        } else {
          seniorName = `Assigned: ${assignedId}`;
        }

        if (seniorName) {
          const { text: seniorLabel, size: seniorSize } = fitTextToWidth(
            seniorName,
            chipW - 6,
            font,
            7,
            7,
          );

          page.drawText(seniorLabel, {
            x: chipX + 3,
            y: chipY + 2, // Position at bottom of chip
            size: seniorSize,
            font,
            color: rgb(0.1, 0.1, 0.1),
          });
        }
      }
    });

    cursorY -= rowH;
  }

  return pdfDoc.save();
}
