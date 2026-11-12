import { rgb } from "pdf-lib";
import { PdfContext } from "./pdfContext";
import { PayPeriodReport } from "../PdfTypesExport";

const toSlashDate = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${Number(m)}/${Number(d)}/${y}`;
};

export function drawHeader(
    ctx: PdfContext,
    report: PayPeriodReport,
) {
    const { page, bold, font } = ctx;

    page.drawText("ASSISTLY", {
        x: ctx.margin,
        y: ctx.cursorY,
        size: 24,
        font: bold,
        color: rgb(0.36, 0.36, 1),
    });

    ctx.cursorY -= 34;

    page.drawText("Pay Period Report", {
        x: ctx.margin,
        y: ctx.cursorY,
        size: 18,
        font: bold,
    });

    ctx.cursorY -= 26;

    page.drawText(
        `Date Range: ${toSlashDate(report.startDate)} - ${toSlashDate(report.endDate)}`,
        {
            x: ctx.margin,
            y: ctx.cursorY,
            size: 11,
            font,
        },
    );

    ctx.cursorY -= 18;

    page.drawText(
        `Generated: ${report.generatedAt.toLocaleString()}`,
        {
            x: ctx.margin,
            y: ctx.cursorY,
            size: 11,
            font,
        },
    );

    ctx.cursorY -= 28;

    page.drawLine({
        start: {
            x: ctx.margin,
            y: ctx.cursorY,
        },
        end: {
            x: ctx.pageWidth - ctx.margin,
            y: ctx.cursorY,
        },
        thickness: 1,
    });

    ctx.cursorY -= 20;
}