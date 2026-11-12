import { rgb } from "pdf-lib";

import { PdfContext } from "./pdfContext";
import { PayPeriodReport } from "../PdfTypesExport";

export function drawSummary(
    ctx: PdfContext,
    report: PayPeriodReport,
) {
    const { page, font, bold } = ctx;

    const totalScheduled = report.employees.reduce(
        (sum, e) => sum + e.totalScheduledHours,
        0,
    );

    const totalWorked = report.employees.reduce(
        (sum, e) => sum + e.totalWorkedHours,
        0,
    );

    const totalPayroll = report.employees.reduce(
        (sum, e) => sum + e.totalEstimatedWages,
        0,
    );

    page.drawRectangle({
        x: ctx.margin,
        y: ctx.cursorY - 95,
        width: ctx.pageWidth - ctx.margin * 2,
        height: 95,
        color: rgb(.96, .98, 1),
        borderWidth: 1,
        borderColor: rgb(.80, .87, 1),
    });

    const left = ctx.margin + 18;
    const right = ctx.margin + 260;

    page.drawText("Employees", {
        x: left,
        y: ctx.cursorY - 22,
        size: 10,
        font,
    });

    page.drawText(
        report.employees.length.toString(),
        {
            x: left,
            y: ctx.cursorY - 42,
            size: 20,
            font: bold,
        },
    );

    page.drawText("Scheduled Hours", {
        x: right,
        y: ctx.cursorY - 22,
        size: 10,
        font,
    });

    page.drawText(
        totalScheduled.toFixed(2),
        {
            x: right,
            y: ctx.cursorY - 42,
            size: 20,
            font: bold,
        },
    );

    page.drawText("Worked Hours", {
        x: left,
        y: ctx.cursorY - 68,
        size: 10,
        font,
    });

    page.drawText(
        totalWorked.toFixed(2),
        {
            x: left,
            y: ctx.cursorY - 88,
            size: 20,
            font: bold,
        },
    );

    page.drawText("Estimated Payroll", {
        x: right,
        y: ctx.cursorY - 68,
        size: 10,
        font,
    });

    page.drawText(
        `$${totalPayroll.toFixed(2)}`,
        {
            x: right,
            y: ctx.cursorY - 88,
            size: 20,
            font: bold,
        },
    );

    ctx.cursorY -= 120;
}