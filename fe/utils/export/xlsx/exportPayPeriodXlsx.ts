import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { PayPeriodReport } from "../PdfTypesExport";

const toSlashDate = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${Number(m)}/${Number(d)}/${y}`;
};

const toDashDate = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${Number(m)}-${Number(d)}-${y}`;
};

const currency = (value: number | null | undefined) => {
    if (value == null) {
        return "NA";
    }

    return value.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
    });
};

const TABLE_HEADER_FILL: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD9D9D9" },
};

const boldRow = (row: ExcelJS.Row, withFill = false) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
        cell.font = { bold: true };
        if (withFill) {
            cell.fill = TABLE_HEADER_FILL;
        }
    });
};

export async function exportPayPeriodXlsx(
    report: PayPeriodReport,
) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Pay Period Review");

    sheet.columns = [
        { width: 22 },
        { width: 22 },
        { width: 22 },
        { width: 16 },
        { width: 16 },
        { width: 14 },
        { width: 16 },
    ];

    //------------------------------------------------------
    // Report Header
    //------------------------------------------------------

    const titleRow = sheet.addRow([
        `${(report.homeName || "").toUpperCase()} PAY PERIOD REVIEW`.trim(),
    ]);
    boldRow(titleRow);
    sheet.addRow([]);

    sheet.addRow([
        "Pay Period",
        `${toSlashDate(report.startDate)} - ${toSlashDate(report.endDate)}`,
    ]);

    sheet.addRow([
        "Generated On",
        report.generatedAt.toLocaleString(),
    ]);

    sheet.addRow([]);

    //------------------------------------------------------
    // Executive Summary
    //------------------------------------------------------

    const totalEmployees = report.employees.length;

    const totalScheduledHours = report.employees.reduce(
        (sum, e) => sum + e.totalScheduledHours,
        0,
    );

    const totalWorkedHours = report.employees.reduce(
        (sum, e) => sum + e.totalWorkedHours,
        0,
    );

    const totalTimecards = report.employees.reduce(
        (sum, e) => sum + e.totalTimecards,
        0,
    );

    const totalPayroll = report.employees.reduce(
        (sum, e) => sum + e.totalEstimatedWages,
        0,
    );

    boldRow(sheet.addRow(["REPORT SUMMARY"]));

    sheet.addRow(["Employees", totalEmployees.toString()]);
    sheet.addRow(["Scheduled Hours", totalScheduledHours.toFixed(2)]);
    sheet.addRow(["Worked Hours", totalWorkedHours.toFixed(2)]);
    sheet.addRow(["Timecards", totalTimecards.toString()]);
    sheet.addRow(["Estimated Payroll", currency(totalPayroll)]);

    sheet.addRow([]);
    sheet.addRow([]);

    //------------------------------------------------------
    // Employee Sections
    //------------------------------------------------------

    report.employees.forEach(employee => {

        boldRow(sheet.addRow([
            employee.name,
            employee.payFrequency.toLowerCase() === "monthly"
                ? `${currency(employee.payRate)}/month`
                : `${currency(employee.payRate)}/hr`,
        ]));

        sheet.addRow([]);

        // Table header row for this employee — bold + highlighted
        boldRow(
            sheet.addRow([
                "Date",
                "Scheduled Shift Time",
                "Actual Shift Time",
                "Scheduled Hours",
                "Worked Hours",
                "Shift Rate",
                "Estimated Wages",
            ]),
            true,
        );

        employee.shifts.forEach(shift => {
            const hasClockIn = !!shift.clockIn && shift.clockIn !== "--:--";
            const hasClockOut = !!shift.clockOut && shift.clockOut !== "--:--";
            const actualShiftTime =
                hasClockIn || hasClockOut
                    ? `${shift.clockIn ?? "--:--"} - ${shift.clockOut ?? "--:--"}`
                    : "-";

            sheet.addRow([
                shift.date,
                `${shift.startTime} - ${shift.endTime}`,
                actualShiftTime,
                shift.scheduledHours.toFixed(2),
                shift.workedHours.toFixed(2),
                shift.shiftRate != null ? currency(shift.shiftRate) : "NA",
                currency(shift.estimatedWages),
            ]);
        });

        boldRow(
            sheet.addRow([
                "TOTAL",
                "",
                "",
                employee.totalScheduledHours.toFixed(2),
                employee.totalWorkedHours.toFixed(2),
                "",
                currency(employee.totalEstimatedWages),
            ]),
            true,
        );

        sheet.addRow(["Timecards", employee.totalTimecards.toString()]);

        sheet.addRow([]);
        sheet.addRow([]);
    });

    //------------------------------------------------------
    // Write & download
    //------------------------------------------------------

    const buffer = await workbook.xlsx.writeBuffer();

    const blob = new Blob(
        [buffer],
        {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
    );

    saveAs(
        blob,
        `PayPeriodReview_${toDashDate(report.startDate)}_${toDashDate(report.endDate)}.xlsx`,
    );
}
