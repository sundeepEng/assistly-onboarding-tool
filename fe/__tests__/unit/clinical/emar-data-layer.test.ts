/**
 * EMAR export — utils/emarDataLayer.ts
 *
 * Turns a senior's clinical record into the month grid the MAR PDF is drawn
 * from. It is a pure function apart from the popover it dispatches, so the
 * rules can be pinned exactly rather than inferred through the UI.
 *
 * The two rules worth knowing, both of which changed in the OTC rewrite:
 *
 *   WHAT WARNS   Not "was anything administered" but "was any medication
 *                ACTIVE this month" — `Object.keys(result.emar).length === 0`.
 *                A prescribed course with no doses recorded produces a blank
 *                sheet, which is a real clinical artifact.
 *
 *   OTC vs REGULAR  A regular course is included if its date range overlaps the
 *                month at all. An OTC dose is included only if its `startdate`
 *                falls inside the month — and its pass/refuse is looked up by
 *                `medicationId_time` IGNORING the date, because a one-time dose
 *                may have been recorded on a different day than it was given.
 */

import EmarDataLayer from "../../../utils/emarDataLayer";

const MED_ID = "11111111-1111-4111-8111-111111111111";
const OTC_ID = "99999999-9999-4999-8999-999999999999";
const USER_ID = "22222222-2222-4222-8222-222222222222";

/** The month every fixture is built around. */
const MONTH = "2026-05";

const makeMedication = (overrides: Record<string, any> = {}) => ({
  id: MED_ID,
  name: "Tylenol",
  dosage: "100mg",
  startdate: "2026-05-01",
  enddate: "",
  timings: ["08:00:00"],
  overTheCounter: false,
  ...overrides,
});

const makeOtc = (overrides: Record<string, any> = {}) => ({
  id: OTC_ID,
  name: "Ibuprofen",
  dosage: "200mg",
  startdate: "2026-05-15",
  timings: ["14:00:00"],
  overTheCounter: true,
  ...overrides,
});

const makeService = (overrides: Record<string, any> = {}) => ({
  medicationId: MED_ID,
  passOrRefuse: "Pass",
  remarks: "",
  providedAt: "2026-05-10T08:00:00.000Z",
  providedBy: USER_ID,
  timing: "08:00:00",
  ...overrides,
});

const makeSenior = (
  medication: any[] = [makeMedication()],
  services: any[] = [makeService()]
) => ({
  name: "Arthur Bean",
  home: "Comfort Cove",
  clinical: { medication, medPass: { services } },
});

const USER_MAP = { [USER_ID]: { name: "Danny Ross" } };

/** Runs the layer with a dispatch spy and returns both result and messages. */
const run = (senior: any, month = MONTH) => {
  const dispatch = jest.fn();
  const result = EmarDataLayer(senior, USER_MAP, month, dispatch);
  const messages = dispatch.mock.calls
    .map(([action]: any) => action?.payload)
    .filter((p: any) => typeof p === "string");
  return { result, messages, dispatch };
};

const WARNING = "No medication was administered during selected period";

// ─── When it refuses to build a report ───────────────────────────────────────

describe("EmarDataLayer — when it warns", () => {
  it("warns when the senior has no medication array at all", () => {
    const { result, messages } = run({ clinical: {} });
    expect(result).toBeNull();
    expect(messages).toContain(WARNING);
  });

  it("warns when there is no clinical record", () => {
    const { result, messages } = run({});
    expect(result).toBeNull();
    expect(messages).toContain(WARNING);
  });

  it("warns when the senior has no medPass block", () => {
    const { result, messages } = run({
      clinical: { medication: [makeMedication()] },
    });
    expect(result).toBeUndefined();
    expect(messages).toContain(WARNING);
  });

  it("warns when no medication was active in the chosen month", () => {
    // The course ran in January; May is empty, so result.emar has no keys.
    const senior = makeSenior([
      makeMedication({ startdate: "2026-01-01", enddate: "2026-01-31" }),
    ]);
    const { result, messages } = run(senior);
    expect(result).toBeNull();
    expect(messages).toContain(WARNING);
  });

  it("does NOT warn for a prescribed course with no doses recorded", () => {
    // The rule is "was anything prescribed", not "was anything given" — a blank
    // MAR sheet is the expected artifact. This is the behaviour that changed.
    const { result, messages } = run(makeSenior([makeMedication()], []));
    expect(result).not.toBeNull();
    expect(messages).not.toContain(WARNING);
  });
});

// ─── Which medications reach the sheet ───────────────────────────────────────

describe("EmarDataLayer — regular course inclusion", () => {
  it("includes a course running for the whole month", () => {
    const senior = makeSenior([
      makeMedication({ startdate: "2026-01-01", enddate: "2026-12-31" }),
    ]);
    const { result } = run(senior);
    expect(Object.keys(result.emar)).toContain(MED_ID);
  });

  it("includes a course that starts mid-month", () => {
    const senior = makeSenior([makeMedication({ startdate: "2026-05-20" })]);
    expect(Object.keys(run(senior).result.emar)).toContain(MED_ID);
  });

  it("includes a course that ends mid-month", () => {
    const senior = makeSenior([
      makeMedication({ startdate: "2026-01-01", enddate: "2026-05-10" }),
    ]);
    expect(Object.keys(run(senior).result.emar)).toContain(MED_ID);
  });

  it("includes an open-ended course started before the month", () => {
    // No enddate means "until today", so it covers any month up to now.
    const senior = makeSenior([
      makeMedication({ startdate: "2020-01-01", enddate: "" }),
    ]);
    expect(Object.keys(run(senior).result.emar)).toContain(MED_ID);
  });

  it("excludes a course that finished before the month", () => {
    const senior = makeSenior(
      [makeMedication({ startdate: "2026-01-01", enddate: "2026-02-01" })],
      []
    );
    expect(run(senior).result).toBeNull();
  });

  it("excludes a course that starts after the month", () => {
    const senior = makeSenior([makeMedication({ startdate: "2026-09-01" })], []);
    expect(run(senior).result).toBeNull();
  });

  it("skips a medication with no start date", () => {
    const senior = makeSenior([makeMedication({ startdate: undefined })], []);
    expect(run(senior).result).toBeNull();
  });
});

describe("EmarDataLayer — over-the-counter inclusion", () => {
  it("includes an OTC dose given inside the month", () => {
    const senior = makeSenior([makeOtc()], [makeService({ medicationId: OTC_ID })]);
    expect(Object.keys(run(senior).result.emar)).toContain(OTC_ID);
  });

  it("excludes an OTC dose given in another month", () => {
    // Unlike a regular course, an OTC entry has no range to overlap — it counts
    // only in the month it was prescribed.
    const senior = makeSenior(
      [makeOtc({ startdate: "2026-02-15" })],
      [makeService({ medicationId: OTC_ID })]
    );
    expect(run(senior).result).toBeNull();
  });

  it("includes an OTC dose on the first day of the month", () => {
    const senior = makeSenior(
      [makeOtc({ startdate: "2026-05-01" })],
      [makeService({ medicationId: OTC_ID })]
    );
    expect(Object.keys(run(senior).result.emar)).toContain(OTC_ID);
  });

  it("includes an OTC dose on the last day of the month", () => {
    const senior = makeSenior(
      [makeOtc({ startdate: "2026-05-31" })],
      [makeService({ medicationId: OTC_ID })]
    );
    expect(Object.keys(run(senior).result.emar)).toContain(OTC_ID);
  });

  it("carries a regular course and an OTC dose together", () => {
    const senior = makeSenior(
      [makeMedication(), makeOtc()],
      [makeService(), makeService({ medicationId: OTC_ID, timing: "14:00:00" })]
    );
    const keys = Object.keys(run(senior).result.emar);
    expect(keys).toContain(MED_ID);
    expect(keys).toContain(OTC_ID);
  });
});

// ─── The grid itself ─────────────────────────────────────────────────────────

describe("EmarDataLayer — the grid", () => {
  it("names each medication", () => {
    const { result } = run(makeSenior());
    expect(result.emar[MED_ID].name).toBe("Tylenol");
  });

  it("carries the dosage", () => {
    const { result } = run(makeSenior());
    expect(result.emar[MED_ID].dosage).toBe("100mg");
  });

  it("carries the senior's own details", () => {
    const { result } = run(makeSenior());
    expect(result.name).toBe("Arthur Bean");
    expect(result.home).toBe("Comfort Cove");
  });

  it("trims the seconds off each timing", () => {
    const { result } = run(makeSenior());
    expect(result.emar[MED_ID].med[0].hour).toBe("08:00");
  });

  it("sorts the timings", () => {
    const senior = makeSenior(
      [makeMedication({ timings: ["20:00:00", "08:00:00", "14:00:00"] })],
      []
    );
    const hours = run(senior).result.emar[MED_ID].med.map((r: any) => r.hour);
    expect(hours.slice(0, 3)).toEqual(["08:00", "14:00", "20:00"]);
  });

  it("pads the grid to at least four rows", () => {
    // The printed form has four rows per medication whatever the schedule.
    const { result } = run(makeSenior());
    expect(result.emar[MED_ID].med).toHaveLength(4);
  });

  it("leaves the padding rows blank", () => {
    const { result } = run(makeSenior());
    const filler = result.emar[MED_ID].med[3];
    expect(filler.hour).toBe("");
    expect(filler.days.every((d: any) => d.passOrRefuse === "")).toBe(true);
  });

  it("does not pad beyond four when there are more timings", () => {
    const senior = makeSenior(
      [
        makeMedication({
          timings: ["06:00:00", "10:00:00", "14:00:00", "18:00:00", "22:00:00"],
        }),
      ],
      []
    );
    expect(run(senior).result.emar[MED_ID].med).toHaveLength(5);
  });

  it("gives every day of the month a cell", () => {
    const { result } = run(makeSenior());
    // May has 31 days.
    expect(result.emar[MED_ID].med[0].days).toHaveLength(31);
  });

  it("gives February the right number of cells", () => {
    const senior = makeSenior(
      [makeMedication({ startdate: "2026-02-01" })],
      [makeService({ providedAt: "2026-02-10T08:00:00.000Z" })]
    );
    const { result } = run(senior, "2026-02");
    expect(result.emar[MED_ID].med[0].days).toHaveLength(28);
  });
});

// ─── Recorded doses landing in the right cell ────────────────────────────────

describe("EmarDataLayer — recorded doses", () => {
  it("marks the day a dose was passed", () => {
    const { result } = run(makeSenior());
    const day10 = result.emar[MED_ID].med[0].days.find((d: any) => d.day === 10);
    expect(day10.passOrRefuse).toBe("Pass");
  });

  it("records the initials of whoever gave it", () => {
    const { result } = run(makeSenior());
    const day10 = result.emar[MED_ID].med[0].days.find((d: any) => d.day === 10);
    expect(day10.initials).toBe("DR");
  });

  it("leaves the other days blank", () => {
    const { result } = run(makeSenior());
    const day11 = result.emar[MED_ID].med[0].days.find((d: any) => d.day === 11);
    expect(day11.passOrRefuse).toBe("");
  });

  it("marks a refusal as such", () => {
    const senior = makeSenior(
      [makeMedication()],
      [makeService({ passOrRefuse: "Refuse" })]
    );
    const { result } = run(senior);
    const day10 = result.emar[MED_ID].med[0].days.find((d: any) => d.day === 10);
    expect(day10.passOrRefuse).toBe("Refuse");
  });

  it("ignores a dose recorded in a different month", () => {
    const senior = makeSenior(
      [makeMedication({ startdate: "2026-01-01" })],
      [makeService({ providedAt: "2026-01-10T08:00:00.000Z" })]
    );
    const { result } = run(senior);
    const marked = result.emar[MED_ID].med[0].days.filter(
      (d: any) => d.passOrRefuse !== ""
    );
    expect(marked).toHaveLength(0);
  });

  it("leaves initials blank when the giver is not in the user map", () => {
    const senior = makeSenior(
      [makeMedication()],
      [makeService({ providedBy: "someone-else" })]
    );
    const { result } = run(senior);
    const day10 = result.emar[MED_ID].med[0].days.find((d: any) => d.day === 10);
    expect(day10.initials).toBe("");
  });

  it("matches an OTC dose by time regardless of the day it was logged", () => {
    // The OTC lookup is keyed medicationId_time with no date, precisely so a
    // one-time dose logged a day later still shows against its own date.
    const senior = makeSenior(
      [makeOtc({ startdate: "2026-05-15" })],
      [
        makeService({
          medicationId: OTC_ID,
          timing: "14:00:00",
          providedAt: "2026-05-20T14:00:00.000Z",
        }),
      ]
    );
    const { result } = run(senior);
    const day15 = result.emar[OTC_ID].med[0].days.find((d: any) => d.day === 15);
    expect(day15.passOrRefuse).toBe("Pass");
  });
});

// ─── Edge cases ──────────────────────────────────────────────────────────────

describe("EmarDataLayer — edge cases", () => {
  it("survives a medication with no timings", () => {
    const senior = makeSenior([makeMedication({ timings: undefined })], []);
    const { result } = run(senior);
    // Still listed, padded to four blank rows.
    expect(result.emar[MED_ID].med).toHaveLength(4);
  });

  it("survives a medication with an empty timings array", () => {
    const senior = makeSenior([makeMedication({ timings: [] })], []);
    expect(run(senior).result.emar[MED_ID].med).toHaveLength(4);
  });

  it("[defect] throws on a medPass service with no timing", () => {
    // emarDataLayer.ts:38 — `pass?.timing.slice(0, 5)`. The optional chain
    // guards `pass`, not `timing`, so one malformed service takes the whole
    // export down with a TypeError rather than being skipped.
    //
    // The OTC loop twelve lines below DOES guard (`if (pass?.timing)`), so the
    // same record is safe in one loop and fatal in the other. Fix is
    // `pass?.timing?.slice(0, 5)`.
    //
    // Pinned as-built so the suite stays green; flip to `.not.toThrow()` when
    // the guard is added.
    const senior = makeSenior(
      [makeMedication()],
      [makeService({ timing: undefined })]
    );
    expect(() => run(senior)).toThrow(TypeError);
  });

  it("[defect] throws even for an OTC dose, whose own loop guards correctly", () => {
    // The OTC lookup at line 55 does check `if (pass?.timing)` — but it never
    // runs, because the unguarded loop at line 38 iterates the SAME services
    // first and throws. The guard is unreachable, which is why the defect
    // cannot be worked around by only recording OTC doses.
    const senior = {
      name: "Arthur Bean",
      clinical: {
        medication: [makeOtc()],
        medPass: {
          services: [
            {
              medicationId: OTC_ID,
              passOrRefuse: "Pass",
              providedAt: "2026-05-15T14:00:00.000Z",
            },
          ],
        },
      },
    };
    expect(() => run(senior)).toThrow(TypeError);
  });

  it("survives an empty medication array", () => {
    const { result } = run(makeSenior([], []));
    expect(result).toBeNull();
  });

  it("defaults a missing dosage to an empty string", () => {
    const senior = makeSenior([makeMedication({ dosage: undefined })], []);
    expect(run(senior).result.emar[MED_ID].dosage).toBe("");
  });

  it("keeps two medications separate", () => {
    const second = makeMedication({ id: "33333333-3333-4333-8333-333333333333", name: "Aspirin" });
    const { result } = run(makeSenior([makeMedication(), second], []));
    expect(result.emar[MED_ID].name).toBe("Tylenol");
    expect(result.emar[second.id].name).toBe("Aspirin");
  });

  it("carries biography and medical through when present", () => {
    const senior: any = makeSenior();
    senior.biography = { personalDetails: { birthdate: "1948-03-15" } };
    senior.medical = { general: { practiceName: "Dr Patel" } };
    const { result } = run(senior);
    expect(result.biography.personalDetails.birthdate).toBe("1948-03-15");
    expect(result.medical.general.practiceName).toBe("Dr Patel");
  });

  it("defaults biography and medical to empty objects", () => {
    const { result } = run(makeSenior());
    expect(result.biography).toEqual({});
    expect(result.medical).toEqual({});
  });
});
