import { PDFDocument, StandardFonts } from "pdf-lib";

import { PdfContext } from "./pdfContext";

export async function createPdfRenderer(): Promise<PdfContext> {

    const pdf = await PDFDocument.create();

    const page = pdf.addPage();

    const font =
        await pdf.embedFont(StandardFonts.Helvetica);

    const bold =
        await pdf.embedFont(StandardFonts.HelveticaBold);

    const { width, height } = page.getSize();

    const ctx: PdfContext = {
        page,
        font,
        bold,
        pageWidth: width,
        pageHeight: height,
        margin: 40,
        cursorY: height - 40,
    };

    return ctx;
}

export function addPage(ctx: PdfContext) {

    const page =
        ctx.page.doc.addPage();

    ctx.page = page;

    ctx.cursorY =
        ctx.pageHeight - 40;
}

export function ensureSpace(ctx: PdfContext, heightNeeded: number) {

    if (
        ctx.cursorY - heightNeeded <
        ctx.margin
    ) {
        addPage(ctx);
    }

}