export interface ShiftReport {
    id: number;

    date: string;

    startTime: string;

    endTime: string;

    scheduledHours: number;

    workedHours: number;

    estimatedWages: number | null;

    clockIn?: string;

    clockOut?: string;

    status: string;

    notes?: string;

    shiftRate?: number | null;
}

export interface EmployeeReport {
    id: string;

    name: string;

    payRate: number;

    payFrequency: string;

    totalTimecards: number;

    totalScheduledHours: number;

    totalWorkedHours: number;

    totalEstimatedWages: number;

    shifts: ShiftReport[];
}

export interface PayPeriodReport {
    homeName: string;

    startDate: string;

    endDate: string;

    generatedAt: Date;

    employees: EmployeeReport[];
}