/**
 * Staff Management — buildPayPeriodReport
 *
 *   utils/export/pdf/buildPayPeriodReport.ts
 *
 * The data layer behind Export Excel. Everything the workbook contains is
 * decided here; `exportPayPeriodXlsx` only draws it. That makes this the right
 * place to pin what a home's payroll export actually says, without going
 * anywhere near exceljs.
 *
 * The shape it produces is one `EmployeeReport` per user in
 * `groupedShiftsByUser`, each carrying its own `shifts[]`. Two things decide
 * almost every figure:
 *
 *   the ROSTER  — `usersById[userId].roaster[0]` supplies the rate and the
 *                 frequency, and it OVERRIDES whatever each shift carries. A
 *                 user missing from `usersById` therefore falls back to rate 0.
 *   MONTHLY     — `pay_frequency === "monthly"` (case-insensitively) makes
 *                 every wage figure `null` rather than zero, which is what the
 *                 sheet prints as "NA".
 *
 * `first.user_name` is where the employee's name comes from — the SHIFT, not
 * the user record — which is pinned below because the two can disagree.
 */

import { buildPayPeriodReport } from "../../../utils/export/pdf/buildPayPeriodReport";

const AVLON = "user-avlon";
const TEJU = "user-teju";

/** An ISO instant at a local wall-clock time on a given day. */
const at = (year: number, month: number, day: number, hours: number, minutes = 0) =>
  new Date(year, month, day, hours, minutes, 0, 0).toISOString();

const SEP4 = (hours: number, minutes = 0) => at(2026, 8, 4, hours, minutes);

const shift = (overrides: Record<string, any> = {}) => ({
  id: 1,
  user_id: AVLON,
  user_name: "Avlon Regal",
  shift_status: "available",
  notes: "",
  pay_rate: "20",
  pay_frequency: "Hourly",
  shift_start_time: SEP4(9, 0),
  shift_end_time: SEP4(17, 0),
  clock_in_timestamp: null,
  clock_out_timestamp: null,
  ...overrides,
});

/** Punched exactly its eight scheduled hours. */
const worked = (overrides: Record<string, any> = {}) =>
  shift({
    clock_in_timestamp: SEP4(9, 0),
    clock_out_timestamp: SEP4(17, 0),
    ...overrides,
  });

const user = (rate: string | number, frequency = "Hourly") => ({
  roaster: [{ pay_rate: rate, pay_frequency: frequency }],
});

const build = (
  groupedShiftsByUser: Record<string, any[]>,
  usersById: Record<string, any> = { [AVLON]: user("20") }
) =>
  buildPayPeriodReport({
    homeName: "Comfort Cove",
    startDate: "2026-08-31",
    endDate: "2026-09-13",
    groupedShiftsByUser,
    usersById,
  });

// ─── The report as a whole ───────────────────────────────────────────────────

describe("buildPayPeriodReport", () => {
  it("carries the home and the period through", () => {
    const report = build({ [AVLON]: [worked()] });
    expect(report.homeName).toBe("Comfort Cove");
    expect(report.startDate).toBe("2026-08-31");
    expect(report.endDate).toBe("2026-09-13");
  });

  it("stamps when it was generated", () => {
    expect(build({ [AVLON]: [worked()] }).generatedAt).toBeInstanceOf(Date);
  });

  it("falls back to an empty home name", () => {
    const report = buildPayPeriodReport({
      startDate: "2026-08-31",
      endDate: "2026-09-13",
      groupedShiftsByUser: {},
      usersById: {},
    });
    expect(report.homeName).toBe("");
  });

  it("produces one entry per person", () => {
    const report = build(
      { [AVLON]: [worked()], [TEJU]: [worked({ user_id: TEJU, user_name: "Teju Carelead" })] },
      { [AVLON]: user("20"), [TEJU]: user("30") }
    );
    expect(report.employees).toHaveLength(2);
  });

  it("produces nothing for an empty period", () => {
    expect(build({}).employees).toEqual([]);
  });

  it("keeps a person's shifts together", () => {
    const report = build({ [AVLON]: [worked(), worked({ id: 2 })] });
    expect(report.employees[0].shifts).toHaveLength(2);
  });
});

// ─── The employee header figures ─────────────────────────────────────────────

describe("buildPayPeriodReport — a person's totals", () => {
  it("takes the rate from the roster", () => {
    const report = build({ [AVLON]: [worked()] }, { [AVLON]: user("25") });
    expect(report.employees[0].payRate).toBe(25);
  });

  it("strips a currency symbol from the roster rate", () => {
    const report = build({ [AVLON]: [worked()] }, { [AVLON]: user("$25") });
    expect(report.employees[0].payRate).toBe(25);
  });

  it("[defect] throws outright when the roster rate is a number", () => {
    // `parseRate` copes with either type, but `totalEstimatedWages` is
    // `calculateTotalWages(shifts, roaster?.pay_rate)`, and that calls
    // `.replace()` on the override before checking it — so the whole report
    // dies rather than one figure being wrong.
    //
    // This is the unit-level cause of a symptom the Cypress suite hits from
    // the other end: `handleExport` has no catch, so a home whose roster
    // stores the rate numerically gets no workbook and no error message. One
    // `String(...)` in calculateTotalWages fixes it.
    expect(() => build({ [AVLON]: [worked()] }, { [AVLON]: user(25) })).toThrow(
      TypeError
    );
  });

  it("reads a numeric roster rate correctly for the rate column itself", () => {
    // `parseRate` is the half that does stringify — which is why the failure
    // above is a crash rather than a visibly wrong number.
    const report = build(
      { [AVLON]: [worked({ pay_frequency: "Monthly" })] },
      { [AVLON]: user(25, "Monthly") }
    );
    expect(report.employees[0].payRate).toBe(25);
  });

  it("falls back to a rate of zero for a user it has no record of", () => {
    const report = build({ [AVLON]: [worked()] }, {});
    expect(report.employees[0].payRate).toBe(0);
  });

  it("carries the pay frequency", () => {
    const report = build({ [AVLON]: [worked()] }, { [AVLON]: user("20", "Monthly") });
    expect(report.employees[0].payFrequency).toBe("Monthly");
  });

  it("counts the timecards", () => {
    const report = build({ [AVLON]: [worked(), shift({ id: 2 })] });
    expect(report.employees[0].totalTimecards).toBe(1);
  });

  it("totals the hours worked", () => {
    const report = build({ [AVLON]: [worked(), worked({ id: 2 })] });
    expect(report.employees[0].totalWorkedHours).toBe(16);
  });

  it("totals the hours scheduled, punched or not", () => {
    const report = build({ [AVLON]: [worked(), shift({ id: 2 })] });
    expect(report.employees[0].totalScheduledHours).toBe(16);
  });

  it("totals the wages at the roster rate", () => {
    // Eight hours at the roster's $25, not the shift's $20.
    const report = build({ [AVLON]: [worked()] }, { [AVLON]: user("25") });
    expect(report.employees[0].totalEstimatedWages).toBe(200);
  });

  it("reports no wages at all for monthly pay", () => {
    // `null`, not 0 — the sheet turns that into "NA".
    const report = build({ [AVLON]: [worked()] }, { [AVLON]: user("4500", "Monthly") });
    expect(report.employees[0].totalEstimatedWages).toBeNull();
  });

  it("still counts a monthly-paid person's hours", () => {
    const report = build({ [AVLON]: [worked()] }, { [AVLON]: user("4500", "Monthly") });
    expect(report.employees[0].totalWorkedHours).toBe(8);
  });

  it("recognises a lower-case monthly frequency", () => {
    const report = build({ [AVLON]: [worked()] }, { [AVLON]: user("4500", "monthly") });
    expect(report.employees[0].totalEstimatedWages).toBeNull();
  });

  it("[as-built] names the person from the shift, not the user record", () => {
    // `first.user_name` — so a stale name on the shift row is what reaches the
    // workbook even when `usersById` holds a corrected one.
    const report = build(
      { [AVLON]: [worked({ user_name: "Old Name" })] },
      { [AVLON]: { ...user("20"), name: "Corrected Name" } }
    );
    expect(report.employees[0].name).toBe("Old Name");
  });

  it("falls back to an empty name when the shift has none", () => {
    const report = build({ [AVLON]: [worked({ user_name: undefined })] });
    expect(report.employees[0].name).toBe("");
  });
});

// ─── One line per shift ──────────────────────────────────────────────────────

describe("buildPayPeriodReport — a person's shifts", () => {
  const firstShift = (shifts: any[], users?: Record<string, any>) =>
    build({ [AVLON]: shifts }, users).employees[0].shifts[0];

  it("dates each line", () => {
    expect(firstShift([worked()]).date).toBe("Fri, Sep 4");
  });

  it("carries the scheduled times", () => {
    const line = firstShift([worked()]);
    expect(line.startTime).toBe("9:00 AM");
    expect(line.endTime).toBe("5:00 PM");
  });

  it("carries the punched times", () => {
    const line = firstShift([worked()]);
    expect(line.clockIn).toBe("9:00 AM");
    expect(line.clockOut).toBe("5:00 PM");
  });

  it("dashes a punch that never happened", () => {
    const line = firstShift([shift()]);
    expect(line.clockIn).toBe("--:--");
    expect(line.clockOut).toBe("--:--");
  });

  it("counts the scheduled hours", () => {
    expect(firstShift([worked()]).scheduledHours).toBe(8);
  });

  it("counts the hours worked", () => {
    expect(firstShift([worked()]).workedHours).toBe(8);
  });

  it("counts an unpunched shift as no hours worked", () => {
    expect(firstShift([shift()]).workedHours).toBe(0);
  });

  it("counts a half-punched shift as no hours worked", () => {
    // Both timestamps are required before the hours are computed at all.
    expect(firstShift([shift({ clock_in_timestamp: SEP4(9, 0) })]).workedHours).toBe(0);
  });

  it("values the line at the roster rate", () => {
    expect(firstShift([worked()], { [AVLON]: user("25") }).estimatedWages).toBe(200);
  });

  it("reports no wages for a line whose SHIFT is monthly", () => {
    expect(
      firstShift([worked({ pay_frequency: "Monthly" })], {
        [AVLON]: user("4500", "Monthly"),
      }).estimatedWages
    ).toBeNull();
  });

  it("[defect] values a monthly person's line when only the ROSTER says monthly", () => {
    // The two halves of the report disagree about where "monthly" is read
    // from. The employee total asks the ROSTER
    // (`isMonthly` → `totalEstimatedWages: null` → the sheet prints "NA"),
    // while each line asks `calculateShiftWage`, which checks the SHIFT's own
    // `pay_frequency`.
    //
    // So a monthly-paid carer whose shift rows still say "Hourly" exports with
    // "NA" as their total and 8 × 4500 = $36,000 against every single line.
    // Both should read the roster.
    const line = firstShift([worked()], { [AVLON]: user("4500", "Monthly") });
    expect(line.estimatedWages).toBe(36000);
  });

  it("reports no wages for an unpunched line", () => {
    expect(firstShift([shift()]).estimatedWages).toBeNull();
  });

  it("carries the shift status", () => {
    expect(firstShift([worked()]).status).toBe("available");
  });

  it("carries the notes", () => {
    expect(firstShift([worked({ notes: "Covered for Priya" })]).notes).toBe(
      "Covered for Priya"
    );
  });

  it("carries the shift's own rate separately from the roster's", () => {
    // `shiftRate` is what the shift was booked at; `payRate` above is what the
    // person is on now. The export shows both, and they can differ.
    const line = firstShift([worked({ pay_rate: "18" })], { [AVLON]: user("25") });
    expect(line.shiftRate).toBe(18);
  });

  it("prefers a client rate over the shift rate when there is one", () => {
    expect(firstShift([worked({ client_rate: "40" })]).shiftRate).toBe(40);
  });

  it("nulls the shift rate when there is none to report", () => {
    expect(firstShift([worked({ pay_rate: null })]).shiftRate).toBeNull();
  });

  it("nulls a shift rate that is not a number", () => {
    expect(firstShift([worked({ pay_rate: "n/a" })]).shiftRate).toBeNull();
  });

  it("keeps the shift id", () => {
    expect(firstShift([worked({ id: 9001 })]).id).toBe(9001);
  });
});
