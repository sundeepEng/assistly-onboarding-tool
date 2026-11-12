import { PDFPage, PDFFont } from "pdf-lib";

export interface PdfContext {

    page: PDFPage;

    font: PDFFont;

    bold: PDFFont;

    pageWidth: number;

    pageHeight: number;

    margin: number;

    cursorY: number;
}