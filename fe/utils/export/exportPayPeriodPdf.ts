import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { saveAs } from "file-saver";

import { PayPeriodReport } from "./PdfTypesExport";
import { drawHeader } from "./pdf/drawHeader";
import { PdfContext } from "./pdf/pdfContext";
import { drawEmployeeCard } from "./pdf/drawEmployeeCard";
import { drawShiftTable } from "./pdf/drawShiftTable";
import { drawSummary } from "./pdf/drawSummary";
import { ensureSpace } from "./pdf/pdfUtils";
import { drawFooter } from "./pdf/drawFooter";

const toDashDate = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${Number(m)}-${Number(d)}-${y}`;
};

export async function exportPayPeriodPdf(
    report: PayPeriodReport,
) {
    const pdfDoc = await PDFDocument.create();

    const page = pdfDoc.addPage();

    const font = await pdfDoc.embedFont(
        StandardFonts.Helvetica,
    );

    const bold = await pdfDoc.embedFont(
        StandardFonts.HelveticaBold,
    );

    const { width, height } = page.getSize();

    let pageNumber = 1;

    const ctx: PdfContext = {
        page,
        font,
        bold,
        pageWidth: width,
        pageHeight: height,
        margin: 40,
        cursorY: height - 40,
    };

    drawHeader(ctx, report);

    drawSummary(ctx, report);

    let isFirstEmployee = true;

    for (const employee of report.employees) {

        const estimatedHeight =
            140 + employee.shifts.length * 18;

        const newPage = ensureSpace({
            ctx,
            pdfDoc,
            report,
            pageNumber,
            requiredHeight: estimatedHeight,
        });

        if (newPage) {
            pageNumber++;
        }

        if (!isFirstEmployee) {

            ctx.page.drawLine({
                start: {
                    x: ctx.margin,
                    y: ctx.cursorY + 10,
                },
                end: {
                    x: ctx.pageWidth - ctx.margin,
                    y: ctx.cursorY + 10,
                },
                thickness: 1,
                color: rgb(0.88, 0.88, 0.88),
            });

            ctx.cursorY -= 18;
        }



        drawEmployeeCard(ctx, employee);

        drawShiftTable(ctx, employee);

        isFirstEmployee = false;
    }

    drawFooter(ctx, {
        pageNumber,
    });
    const bytes = await pdfDoc.save();

    saveAs(
        new Blob([bytes as BlobPart], {
            type: "application/pdf",
        }),
        `PayPeriodReview_${toDashDate(report.startDate)}_${toDashDate(report.endDate)}.pdf`,
    );
}