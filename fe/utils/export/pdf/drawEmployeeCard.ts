import { rgb } from "pdf-lib";

import { EmployeeReport } from "../PdfTypesExport";
import { PdfContext } from "./pdfContext";

export function drawEmployeeCard(
    ctx: PdfContext,
    employee: EmployeeReport,
) {
    const { page, bold, font } = ctx;

    const startY = ctx.cursorY;

    // Card background
    // Card background
    page.drawRectangle({
        x: ctx.margin,
        y: startY - 95,
        width: ctx.pageWidth - ctx.margin * 2,
        height: 95,

        // Assistly blue background
        color: rgb(0.95, 0.97, 1),

        borderWidth: 1.2,

        // Assistly blue border
        borderColor: rgb(.72, .82, 1),
    });
    const initials = employee.name
        .split(" ")
        .map(n => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

    page.drawCircle({
        x: ctx.margin + 25,
        y: startY - 26,
        size: 14,
        color: rgb(0.36, 0.36, 1),
    });

    page.drawText(initials, {
        x: ctx.margin + 18,
        y: startY - 31,
        font: bold,
        size: 10,
        color: rgb(1, 1, 1),
    });
    // Employee Name
    page.drawText(employee.name, {
        x: ctx.margin + 50,
        y: startY - 20,
        font: bold,
        size: 16,
        color: rgb(0.15, 0.30, 0.80),
    });

    // Pay Frequency
    page.drawText(employee.payFrequency, {
        x: ctx.margin + 50,
        y: startY - 40,
        font,
        size: 10,
        color: rgb(.4, .4, .4),
    });

    // Summary
    const left = ctx.margin + 250;

    page.drawText("Hourly Rate", {
        x: left,
        y: startY - 18,
        font,
        size: 10,
    });

    const rateText =
        employee.payFrequency === "Hourly"
            ? `$${employee.payRate.toFixed(2)}/hr`
            : employee.payFrequency === "Monthly"
                ? `$${employee.payRate.toFixed(2)}/month`
                : `$${employee.payRate.toFixed(2)}`;

    page.drawText(rateText, {
        x: left,
        y: startY - 35,
        font: bold,
        size: 14,
    });

    page.drawText("Scheduled Hours", {
        x: left + 110,
        y: startY - 18,
        font,
        size: 10,
    });

    page.drawText(
        `${employee.totalScheduledHours.toFixed(2)} hrs`,
        {
            x: left + 110,
            y: startY - 35,
            font: bold,
            size: 14,
        },
    );

    page.drawText("Worked Hours", {
        x: left + 220,
        y: startY - 18,
        font,
        size: 10,
    });

    page.drawText(
        `${employee.totalWorkedHours.toFixed(2)} hrs`,
        {
            x: left + 220,
            y: startY - 35,
            font: bold,
            size: 14,
        },
    );

    page.drawText("Estimated Wages", {
        x: left,
        y: startY - 62,
        font,
        size: 10,
    });

    page.drawText(
        `$${new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        }).format(employee.totalEstimatedWages)}`,
        {
            x: left,
            y: startY - 79,
            font: bold,
            size: 14,
        },
    );

    page.drawText("Timecards", {
        x: left + 170,
        y: startY - 62,
        font,
        size: 10,
    });

    page.drawText(
        employee.totalTimecards.toString(),
        {
            x: left + 170,
            y: startY - 79,
            font: bold,
            size: 14,
        },
    );

    ctx.cursorY -= 110;
}