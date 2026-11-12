import { rgb } from "pdf-lib";

import { EmployeeReport } from "../PdfTypesExport";
import { PdfContext } from "./pdfContext";

const ROW_HEIGHT = 20;

function drawTableHeader(
    ctx: PdfContext,
    columns: { title: string; x: number }[],
) {
    const { page, bold } = ctx;

    page.drawRectangle({
        x: ctx.margin,
        y: ctx.cursorY - 18,
        width: ctx.pageWidth - ctx.margin * 2,
        height: 18,
        color: rgb(0.84, 0.91, 1),
    });

    columns.forEach(col => {
        page.drawText(col.title, {
            x: col.x,
            y: ctx.cursorY - 13,
            size: 9,
            font: bold,
        });
    });

    ctx.cursorY -= 28;
}

export function drawShiftTable(
    ctx: PdfContext,
    employee: EmployeeReport,
) {
    const { page, font } = ctx;

    const columns = [
        { title: "Date", x: ctx.margin + 8 },
        { title: "Start", x: ctx.margin + 105 },
        { title: "End", x: ctx.margin + 175 },
        { title: "Sched", x: ctx.margin + 245 },
        { title: "Worked", x: ctx.margin + 315 },
        { title: "Wage", x: ctx.margin + 395 },
    ];

    drawTableHeader(ctx, columns);

    if (employee.shifts.length === 0) {
        page.drawText("No shifts found during this pay period.", {
            x: ctx.margin + 8,
            y: ctx.cursorY,
            size: 10,
            font,
            color: rgb(.45, .45, .45),
        });

        ctx.cursorY -= 30;
        return;
    }

    employee.shifts.forEach((shift, index) => {

        // Zebra striping
        if (index % 2 === 0) {
            page.drawRectangle({
                x: ctx.margin,
                y: ctx.cursorY - 4,
                width: ctx.pageWidth - ctx.margin * 2,
                height: ROW_HEIGHT,
                color: rgb(.985, .985, .985),
            });
        }

        page.drawText(shift.date, {
            x: columns[0].x,
            y: ctx.cursorY,
            size: 9,
            font,
        });

        page.drawText(shift.startTime, {
            x: columns[1].x,
            y: ctx.cursorY,
            size: 9,
            font,
        });

        page.drawText(shift.endTime, {
            x: columns[2].x,
            y: ctx.cursorY,
            size: 9,
            font,
        });

        const scheduled = `${shift.scheduledHours.toFixed(2)}h`;

        page.drawText(scheduled, {
            x:
                columns[3].x +
                36 -
                font.widthOfTextAtSize(scheduled, 9),
            y: ctx.cursorY,
            size: 9,
            font,
        });

        const worked = `${shift.workedHours.toFixed(2)}h`;

        page.drawText(worked, {
            x:
                columns[4].x +
                36 -
                font.widthOfTextAtSize(worked, 9),
            y: ctx.cursorY,
            size: 9,
            font,
        });

        const wage = new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        }).format(shift.estimatedWages);

        page.drawText(wage, {
            x:
                columns[5].x +
                48 -
                font.widthOfTextAtSize(wage, 9),
            y: ctx.cursorY,
            size: 9,
            font,
        });

        page.drawLine({
            start: {
                x: ctx.margin,
                y: ctx.cursorY - 5,
            },
            end: {
                x: ctx.pageWidth - ctx.margin,
                y: ctx.cursorY - 5,
            },
            thickness: .4,
            color: rgb(.88, .88, .88),
        });

        ctx.cursorY -= ROW_HEIGHT;
    });

    ctx.cursorY -= 18;
}