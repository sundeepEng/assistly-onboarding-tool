import { PDFDocument } from "pdf-lib";

import { PdfContext } from "./pdfContext";
import { PayPeriodReport } from "../PdfTypesExport";
import { drawHeader } from "./drawHeader";
import { drawFooter } from "./drawFooter";

type Args = {
    ctx: PdfContext;
    pdfDoc: PDFDocument;
    report: PayPeriodReport;
    pageNumber: number;
};

export function moveToNextPage({
    ctx,
    pdfDoc,
    report,
    pageNumber,
}: Args) {

    // Finish current page
    drawFooter(ctx, {
        pageNumber,
    });

    const page = pdfDoc.addPage();

    const { width, height } = page.getSize();

    ctx.page = page;
    ctx.pageWidth = width;
    ctx.pageHeight = height;
    ctx.cursorY = height - ctx.margin;

    // Start next page
    drawHeader(ctx, report);
}