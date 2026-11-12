import {
    EmployeeReport,
    PayPeriodReport,
    ShiftReport,
} from "../PdfTypesExport";

import {
    calculateTotalWorkedHours,
    calculateTotalScheduledHours,
    calculateScheduledTotalWages,
    getNumberOfTimeCards,
    formatTime,
    formatToLocalLongDate,
    getHoursDifference,
    calculateShiftWage,
    calculateTotalWages,
} from "../../../components/hcm/utils/timeUtils";

const parseRate = (value: unknown): number | null => {
    if (value == null || value === "") return null;
    const parsed = parseFloat(String(value).replace(/[^0-9.-]+/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
};

type Params = {
    homeName?: string;
    startDate: string;
    endDate: string;
    groupedShiftsByUser: Record<string, any[]>;
    usersById: Record<string, any>;
};

export function buildPayPeriodReport({
    homeName,
    startDate,
    endDate,
    groupedShiftsByUser,
    usersById,
}: Params): PayPeriodReport {
    const employees: EmployeeReport[] = [];

    Object.entries(groupedShiftsByUser).forEach(
        ([userId, shifts]) => {

            const first = shifts[0];
            const user = usersById[userId];
            const roaster = user?.roaster?.[0];

            const isMonthly =
                roaster?.pay_frequency?.toLowerCase() === "monthly";

            const employee: EmployeeReport = {
                id: userId,
                name: first.user_name ?? "",
                payRate: Number(
                    String(roaster?.pay_rate ?? 0).replace(/[^0-9.-]+/g, ""),
                ),
                payFrequency: roaster?.pay_frequency ?? "",

                totalTimecards: getNumberOfTimeCards(shifts),

                totalWorkedHours: calculateTotalWorkedHours(shifts),

                totalScheduledHours: calculateTotalScheduledHours(shifts),

                totalEstimatedWages: isMonthly
                    ? null
                    : calculateTotalWages(shifts, roaster?.pay_rate),

                shifts: [],
            };

            for (const shift of shifts) {

                employee.shifts.push({
                    id: shift.id,

                    date: formatToLocalLongDate(shift.shift_start_time),

                    startTime: formatTime(shift.shift_start_time),

                    endTime: formatTime(shift.shift_end_time),

                    scheduledHours: getHoursDifference(
                        shift.shift_start_time,
                        shift.shift_end_time,
                    ),

                    workedHours:
                        shift.clock_in_timestamp && shift.clock_out_timestamp
                            ? getHoursDifference(
                                shift.clock_in_timestamp,
                                shift.clock_out_timestamp,
                            )
                            : 0,

                    estimatedWages: calculateShiftWage(shift, roaster?.pay_rate),

                    clockIn: formatTime(shift.clock_in_timestamp),

                    clockOut: formatTime(shift.clock_out_timestamp),

                    status: shift.shift_status,

                    notes: shift.notes,

                    shiftRate: parseRate(
                        shift.client_rate ?? shift.pay_rate ?? shift.base_rate,
                    ),
                });

            }

            employees.push(employee);

        },
    );

    return {
        homeName: homeName ?? "",
        startDate,
        endDate,
        generatedAt: new Date(),
        employees,
    };
}