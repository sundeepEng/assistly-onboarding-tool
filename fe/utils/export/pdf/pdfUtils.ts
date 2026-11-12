import { PayPeriodReport } from "../PdfTypesExport";
import { PdfContext } from "./pdfContext";
import { PDFDocument } from "pdf-lib";
import { moveToNextPage } from "./newPage";

type Args = {
    ctx: PdfContext;
    pdfDoc: PDFDocument;
    report: PayPeriodReport;
    pageNumber: number;
    requiredHeight: number;
};

export function ensureSpace({
    ctx,
    pdfDoc,
    report,
    pageNumber,
    requiredHeight,
}) {

    if (ctx.cursorY - requiredHeight > ctx.margin) {
        return false;
    }

    moveToNextPage({
        ctx,
        pdfDoc,
        report,
        pageNumber,
    });

    return true;
}