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
const csvEscape = (value: unknown) =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;

export function exportPayPeriodCsv(
    report: PayPeriodReport,
) {
    const rows: string[][] = [];

    //------------------------------------------------------
    // Report Header
    //------------------------------------------------------

    rows.push([`${(report.homeName || "").toUpperCase()} PAY PERIOD REVIEW`.trim()]);
    rows.push([]);

    rows.push([
        "Pay Period",
        `${toSlashDate(report.startDate)} - ${toSlashDate(report.endDate)}`,
    ]);

    rows.push([
        "Generated On",
        report.generatedAt.toLocaleString(),
    ]);

    rows.push([]);

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

    rows.push(["REPORT SUMMARY"]);

    rows.push([
        "Employees",
        totalEmployees.toString(),
    ]);

    rows.push([
        "Scheduled Hours",
        totalScheduledHours.toFixed(2),
    ]);

    rows.push([
        "Worked Hours",
        totalWorkedHours.toFixed(2),
    ]);

    rows.push([
        "Timecards",
        totalTimecards.toString(),
    ]);

    rows.push([
        "Estimated Payroll",
        currency(totalPayroll),
    ]);

    rows.push([]);
    rows.push([]);

    //------------------------------------------------------
    // Employee Sections
    //------------------------------------------------------

    report.employees.forEach(employee => {

        rows.push([
            "Employee",
            employee.name,
            employee.payFrequency,
            employee.payFrequency.toLowerCase() === "monthly"
                ? `${currency(employee.payRate)}/month`
                : `${currency(employee.payRate)}/hr`,
        ]);

        rows.push([]);

        rows.push([
            "DATE",
            "SCHEDULED SHIFT TIME",
            "ACTUAL SHIFT TIME",
            "SCHEDULED HOURS",
            "WORKED HOURS",
            "SHIFT RATE",
            "ESTIMATED WAGES",
        ]);

        employee.shifts.forEach(shift => {

            const hasClockIn = !!shift.clockIn && shift.clockIn !== "--:--";
            const hasClockOut = !!shift.clockOut && shift.clockOut !== "--:--";
            const actualShiftTime =
                hasClockIn || hasClockOut
                    ? `${shift.clockIn ?? "--:--"} - ${shift.clockOut ?? "--:--"}`
                    : "-";

            rows.push([
                shift.date,

                `${shift.startTime} - ${shift.endTime}`,

                actualShiftTime,

                shift.scheduledHours.toFixed(2),

                shift.workedHours.toFixed(2),

                shift.shiftRate != null ? currency(shift.shiftRate) : "NA",

                currency(shift.estimatedWages),
            ]);

        });

        rows.push([]);

        rows.push(["EMPLOYEE TOTALS"]);

        rows.push([
            "Scheduled Hours",
            employee.totalScheduledHours.toFixed(2),
        ]);

        rows.push([
            "Worked Hours",
            employee.totalWorkedHours.toFixed(2),
        ]);

        rows.push([
            "Timecards",
            employee.totalTimecards.toString(),
        ]);

        rows.push([
            "Estimated Wages",
            currency(employee.totalEstimatedWages),
        ]);

        rows.push([]);
        rows.push([]);
    });

    //------------------------------------------------------
    // CSV
    //------------------------------------------------------

    const csv = rows
        .map(row => row.map(csvEscape).join(","))
        .join("\n");

    const blob = new Blob(
        [csv],
        {
            type: "text/csv;charset=utf-8;",
        },
    );

    saveAs(
        blob,
        `PayPeriodReview_${toDashDate(report.startDate)}_${toDashDate(report.endDate)}.csv`,
    );
}