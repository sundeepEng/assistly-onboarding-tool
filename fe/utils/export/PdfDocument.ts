// src/utils/export/pdf/PdfDocument.ts

import {
    PDFDocument,
    StandardFonts,
    PDFPage,
    PDFFont,
} from 'pdf-lib';

import { PdfTheme } from './PdfThemeExport';

export interface PdfDocumentContext {
    pdf: PDFDocument;
    page: PDFPage;
    font: PDFFont;
    width: number;
    height: number;
    cursorY: number;
}

export async function createPdfDocument(): Promise<PdfDocumentContext> {
    const pdf = await PDFDocument.create();

    const font = await pdf.embedFont(StandardFonts.Helvetica);

    const page = pdf.addPage();

    const width = page.getWidth();
    const height = page.getHeight();

    return {
        pdf,
        page,
        font,
        width,
        height,
        cursorY: height - PdfTheme.page.margin,
    };
}

export function addPage(ctx: PdfDocumentContext) {
    ctx.page = ctx.pdf.addPage();

    ctx.width = ctx.page.getWidth();
    ctx.height = ctx.page.getHeight();

    ctx.cursorY = ctx.height - PdfTheme.page.margin;
}

export function drawTitle(ctx: PdfDocumentContext, text: string) {
    ctx.page.drawText(text, {
        x: PdfTheme.page.margin,
        y: ctx.cursorY,
        size: PdfTheme.font.title,
        font: ctx.font,
        color: PdfTheme.colors.text,
    });

    ctx.cursorY -= 32;
}

export function drawSubtitle(ctx: PdfDocumentContext, text: string) {
    ctx.page.drawText(text, {
        x: PdfTheme.page.margin,
        y: ctx.cursorY,
        size: PdfTheme.font.subtitle,
        font: ctx.font,
        color: PdfTheme.colors.gray,
    });

    ctx.cursorY -= 22;
}

export function drawText(ctx: PdfDocumentContext, text: string) {
    ctx.page.drawText(text, {
        x: PdfTheme.page.margin,
        y: ctx.cursorY,
        size: PdfTheme.font.body,
        font: ctx.font,
        color: PdfTheme.colors.text,
    });

    ctx.cursorY -= 18;
}

export function drawDivider(ctx: PdfDocumentContext) {
    ctx.page.drawLine({
        start: {
            x: PdfTheme.page.margin,
            y: ctx.cursorY,
        },
        end: {
            x: ctx.width - PdfTheme.page.margin,
            y: ctx.cursorY,
        },
        thickness: 1,
        color: PdfTheme.colors.lightGray,
    });

    ctx.cursorY -= 20;
}

export async function savePdf(ctx: PdfDocumentContext) {
    return ctx.pdf.save();
}