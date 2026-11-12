/**
 * Care report export — utils/carePlanDataLayer.ts
 *
 * Turns a senior's care plan plus the month's recorded services into the grid
 * the Care Report PDF is drawn from. Pure — no dispatch, no network — so every
 * rule can be pinned directly.
 *
 * THE ROWS COME FROM THE PLAN, NOT THE RECORDS
 *   `serviceRows` is built from `carePlan.{adl,iadl,housekeeping,vitalSigns}` —
 *   what was *prescribed*. The month's `clinical.carePlan.services` only fill
 *   the cells in. A senior with a plan and no records produces a blank sheet,
 *   not an empty one; only a senior with no plan at all produces nothing.
 *
 * WHAT EARNS A ROW
 *   ADL / IADL     merged. `careLevel: "Independent"` is skipped entirely. For
 *                  any other sub-key, a value of "No" or "Independent" is
 *                  skipped and anything else becomes "Key - Sub Key".
 *   Housekeeping   any value that is truthy and not "Not Required".
 *   Vital Signs    NONE. They were removed from the row list and now appear
 *                  only in the `vitalSignReadings` detail table below the grid.
 *
 * NAMES ARE DISPLAY LABELS, NOT KEYS
 *   `displayServiceName()` maps a stored key through DEFAULT_ADL_FIELDS,
 *   HOUSEKEEPING_LABELS or VITAL_SIGN_LABELS, falling back to title-casing the
 *   key itself. So the row for `laundry` reads "Laundry", and an unknown
 *   `deepClean` reads "Deep Clean". Assert on the label, never the key.
 *
 * CELLS MATCH ON THE NAME PART ONLY
 *   A record's `serviceName` is split at " - " and only the part before it is
 *   compared, normalised to lower-case alphanumerics. This is deliberate: the
 *   care LEVEL can change after a record is written ("Bathing - Assistance"
 *   becoming "Bathing - Full Assistance") and the history has to survive it.
 *
 * ROWS ALSO COME FROM THE MONTH'S RECORDS
 *   A service recorded this month but since removed from the plan still earns
 *   a row, so its history does not silently vanish. Rows are deduped on
 *   `category|matchKey`.
 */

import CarePlanDataLayer from "../../../utils/carePlanDataLayer";

const MONTH = "2026-05";

const makeSenior = (overrides: Record<string, any> = {}) => ({
  name: "Arthur Bean",
  home: "Comfort Cove",
  carePlan: {
    adl: {
      bathing: { careLevel: "Assistance" },
      dressing: { careLevel: "Independent" },
      continence: { bladder: "Yes", bowel: "No" },
    },
    iadl: { medication: { careLevel: "Supervision" } },
    housekeeping: { laundry: "Weekly", deepClean: "Not Required" },
    vitalSigns: { bloodPressure: true, pulse: false },
  },
  clinical: { carePlan: { services: [] } },
  ...overrides,
});

const run = (senior: any, month = MONTH) => CarePlanDataLayer(senior, month);

const rowNames = (result: any) => result.rows.map((r: any) => r.serviceName);
const rowFor = (result: any, name: string) =>
  result.rows.find((r: any) => r.serviceName === name);

// ─── Which services earn a row ───────────────────────────────────────────────

describe("CarePlanDataLayer — ADL rows", () => {
  it("lists a service with a care level", () => {
    expect(rowNames(run(makeSenior()))).toContain("Bathing - Assistance");
  });

  it("leaves out a service marked Independent", () => {
    // The rule the product asks for: Independent means the senior needs no
    // help, so it never reaches the clinical round.
    expect(rowNames(run(makeSenior()))).not.toContain("Dressing - Independent");
  });

  it("leaves out Independent whatever its casing in the key", () => {
    const senior = makeSenior({
      carePlan: { adl: { grooming: { careLevel: "Independent" } } },
    });
    expect(run(senior).rows).toHaveLength(0);
  });

  it("merges IADL services in alongside ADL", () => {
    expect(rowNames(run(makeSenior()))).toContain("Medication - Supervision");
  });

  it("lists a sub-value that is not No", () => {
    expect(rowNames(run(makeSenior()))).toContain("Continence - bladder");
  });

  it("leaves out a sub-value of No", () => {
    expect(rowNames(run(makeSenior()))).not.toContain("Continence - bowel");
  });

  it("leaves out a sub-value of Independent", () => {
    const senior = makeSenior({
      carePlan: { adl: { mobility: { transfer: "Independent" } } },
    });
    expect(run(senior).rows).toHaveLength(0);
  });

  it("splits a camelCase sub-key into words", () => {
    const senior = makeSenior({
      carePlan: { adl: { mobility: { wheelChairUse: "Yes" } } },
    });
    expect(rowNames(run(senior))).toContain("Mobility - wheel Chair Use");
  });

  it("capitalises the service key", () => {
    const senior = makeSenior({
      carePlan: { adl: { bathing: { careLevel: "Full" } } },
    });
    expect(rowNames(run(senior))[0]).toBe("Bathing - Full");
  });

  it("ignores the plan's own comments field", () => {
    const senior = makeSenior({
      carePlan: {
        adl: { comments: "Prefers mornings", bathing: { careLevel: "Full" } },
      },
    });
    expect(rowNames(run(senior))).toEqual(["Bathing - Full"]);
  });

  it("categorises them as ADL", () => {
    expect(rowFor(run(makeSenior()), "Bathing - Assistance").category).toBe("ADL");
  });
});

describe("CarePlanDataLayer — housekeeping rows", () => {
  it("lists a housekeeping service under its display label", () => {
    // Stored as `laundry`; HOUSEKEEPING_LABELS turns it into "Laundry".
    expect(rowNames(run(makeSenior()))).toContain("Laundry");
  });

  it("does not list it under its raw key", () => {
    expect(rowNames(run(makeSenior()))).not.toContain("laundry");
  });

  it("title-cases a key the label map does not know", () => {
    const senior = makeSenior({ carePlan: { housekeeping: { deepClean: "Weekly" } } });
    expect(rowNames(run(senior))).toContain("Deep Clean");
  });

  it("leaves out one marked Not Required", () => {
    expect(rowNames(run(makeSenior()))).not.toContain("Deep Clean");
  });

  it("leaves out one with an empty value", () => {
    const senior = makeSenior({ carePlan: { housekeeping: { laundry: "" } } });
    expect(run(senior).rows).toHaveLength(0);
  });

  it("categorises them as House Keeping", () => {
    expect(rowFor(run(makeSenior()), "Laundry").category).toBe("House Keeping");
  });
});

describe("CarePlanDataLayer — vital signs get no row", () => {
  // They were removed from the grid on purpose: a vital sign has a READING,
  // not a provided/not-provided status, so it never belonged in a tick-box
  // row. It renders in the detail table instead.

  it("gives a switched-on vital sign no row", () => {
    expect(rowNames(run(makeSenior()))).not.toContain("Blood Pressure");
  });

  it("gives it no row under its raw key either", () => {
    expect(rowNames(run(makeSenior()))).not.toContain("bloodPressure");
  });

  it("produces no Vital Signs row of any kind", () => {
    const categories = run(makeSenior()).rows.map((r: any) => r.category);
    expect(categories).not.toContain("Vital Signs");
  });

  it("builds the grid from ADL and housekeeping alone", () => {
    expect(new Set(run(makeSenior()).rows.map((r: any) => r.category))).toEqual(
      new Set(["ADL", "House Keeping"])
    );
  });

  it("produces nothing at all for a plan of only vital signs", () => {
    const senior = makeSenior({ carePlan: { vitalSigns: { bloodPressure: true } } });
    expect(run(senior).rows).toHaveLength(0);
  });
});

// ─── The month grid ──────────────────────────────────────────────────────────

describe("CarePlanDataLayer — the grid", () => {
  it("gives every day of the month a cell", () => {
    expect(rowFor(run(makeSenior()), "Laundry").days).toHaveLength(31);
  });

  it("gives February the right number of cells", () => {
    expect(rowFor(run(makeSenior(), "2026-02"), "Laundry").days).toHaveLength(28);
  });

  it("handles a leap February", () => {
    expect(rowFor(run(makeSenior(), "2024-02"), "Laundry").days).toHaveLength(29);
  });

  it("leaves every cell blank when nothing was recorded", () => {
    const row = rowFor(run(makeSenior()), "Bathing - Assistance");
    expect(row.days.every((d: any) => d.status === "")).toBe(true);
  });

  it("labels the month for the report header", () => {
    expect(run(makeSenior()).monthLabel).toBe("May 2026");
  });

  it("carries the senior's name and home", () => {
    const result = run(makeSenior());
    expect(result.name).toBe("Arthur Bean");
    expect(result.home).toBe("Comfort Cove");
  });

  it("carries the physician from the medical record", () => {
    const senior: any = makeSenior();
    senior.medical = { general: { practiceName: "Dr Patel" } };
    expect(run(senior).physicianName).toBe("Dr Patel");
  });

  it("defaults a missing physician to an empty string", () => {
    expect(run(makeSenior()).physicianName).toBe("");
  });
});

// ─── Recorded services filling the cells ─────────────────────────────────────

describe("CarePlanDataLayer — recorded services", () => {
  const withService = (service: Record<string, any>) =>
    makeSenior({
      clinical: { carePlan: { services: [service] } },
    });

  it("marks the day a service was provided", () => {
    const senior = withService({
      serviceName: "Bathing - Assistance",
      serviceCategory: "ADL",
      providedOrNot: "Provided",
      providedAt: "2026-05-10T12:00:00.000Z",
    });
    const day10 = rowFor(run(senior), "Bathing - Assistance").days.find(
      (d: any) => d.day === 10
    );
    expect(day10.status).toBe("P");
  });

  it("marks a service that was not provided", () => {
    const senior = withService({
      serviceName: "Bathing - Assistance",
      serviceCategory: "ADL",
      providedOrNot: "Not Provided",
      providedAt: "2026-05-10T12:00:00.000Z",
    });
    const day10 = rowFor(run(senior), "Bathing - Assistance").days.find(
      (d: any) => d.day === 10
    );
    expect(day10.status).toBe("NP");
  });

  it("shows the caregiver's initials when the record names who provided it", () => {
    // Cells carry initials ("GH") when providedBy resolves through userMap —
    // "P"/"NP" is only the fallback for records that name nobody.
    const senior = withService({
      serviceName: "Bathing - Assistance",
      serviceCategory: "ADL",
      providedOrNot: "Provided",
      providedAt: "2026-05-10T12:00:00.000Z",
      providedBy: "u-caregiver",
    });
    const result = CarePlanDataLayer(senior, MONTH, {
      "u-caregiver": { firstName: "Grace", lastName: "Hopper" },
    });
    const day10 = rowFor(result, "Bathing - Assistance").days.find(
      (d: any) => d.day === 10
    );
    expect(day10.status).toBe("GH");
  });

  it("leaves the other days alone", () => {
    const senior = withService({
      serviceName: "Bathing - Assistance",
      serviceCategory: "ADL",
      providedOrNot: "Provided",
      providedAt: "2026-05-10T12:00:00.000Z",
    });
    const day11 = rowFor(run(senior), "Bathing - Assistance").days.find(
      (d: any) => d.day === 11
    );
    expect(day11.status).toBe("");
  });

  it("ignores a record from another month", () => {
    const senior = withService({
      serviceName: "Bathing - Assistance",
      serviceCategory: "ADL",
      providedOrNot: "Provided",
      providedAt: "2026-04-10T12:00:00.000Z",
    });
    const marked = rowFor(run(senior), "Bathing - Assistance").days.filter(
      (d: any) => d.status !== ""
    );
    expect(marked).toHaveLength(0);
  });

  it("ignores a record whose category does not match", () => {
    const senior = withService({
      serviceName: "Bathing - Assistance",
      serviceCategory: "House Keeping",
      providedOrNot: "Provided",
      providedAt: "2026-05-10T12:00:00.000Z",
    });
    const marked = rowFor(run(senior), "Bathing - Assistance").days.filter(
      (d: any) => d.status !== ""
    );
    expect(marked).toHaveLength(0);
  });

  it("ignores a record with no providedAt", () => {
    const senior = withService({
      serviceName: "Bathing - Assistance",
      serviceCategory: "ADL",
      providedOrNot: "Provided",
    });
    const marked = rowFor(run(senior), "Bathing - Assistance").days.filter(
      (d: any) => d.status !== ""
    );
    expect(marked).toHaveLength(0);
  });

  it("matches the name part regardless of case", () => {
    // `serviceNamePart` normalises to lower-case alphanumerics, so the record
    // still lands on the row.
    const senior = withService({
      serviceName: "bathing - assistance",
      serviceCategory: "ADL",
      providedOrNot: "Provided",
      providedAt: "2026-05-10T12:00:00.000Z",
    });
    const marked = rowFor(run(senior), "Bathing - Assistance").days.filter(
      (d: any) => d.status !== ""
    );
    expect(marked).toHaveLength(1);
  });

  it("matches even when the care level has since changed", () => {
    // The point of matching on the name part alone: a record written while
    // the plan said "Assistance" must still show after the plan is revised to
    // "Full Assistance", or the month's history disappears on a plan edit.
    const senior = withService({
      serviceName: "Bathing - Full Assistance",
      serviceCategory: "ADL",
      providedOrNot: "Provided",
      providedAt: "2026-05-10T12:00:00.000Z",
    });
    const day10 = rowFor(run(senior), "Bathing - Assistance").days.find(
      (d: any) => d.day === 10
    );
    expect(day10.status).toBe("P");
  });

  it("still refuses a genuinely different service", () => {
    const senior = withService({
      serviceName: "Grooming - Assistance",
      serviceCategory: "ADL",
      providedOrNot: "Provided",
      providedAt: "2026-05-10T12:00:00.000Z",
    });
    const marked = rowFor(run(senior), "Bathing - Assistance").days.filter(
      (d: any) => d.status !== ""
    );
    expect(marked).toHaveLength(0);
  });

  it("reads the day off the stored string rather than a parsed date", () => {
    // `providedAt.slice(0, 10)` is compared directly. That is deliberate:
    // parsing and reformatting shifted the day across timezones, which is the
    // bug the vital-sign readings below still have.
    const senior = withService({
      serviceName: "Bathing - Assistance",
      serviceCategory: "ADL",
      providedOrNot: "Provided",
      providedAt: "2026-05-10T02:00:00.000Z",
    });
    const day10 = rowFor(run(senior), "Bathing - Assistance").days.find(
      (d: any) => d.day === 10
    );
    expect(day10.status).toBe("P");
  });
});

// ─── Rows recovered from the month's records ─────────────────────────────────

describe("CarePlanDataLayer — services no longer in the plan", () => {
  it("still gives a row to something recorded this month", () => {
    // Removing a service from the plan must not erase the month's history.
    const senior = makeSenior({
      carePlan: { housekeeping: { laundry: "Weekly" } },
      clinical: {
        carePlan: {
          services: [
            {
              serviceName: "dailyCleanSweep",
              serviceCategory: "House Keeping",
              providedOrNot: "Provided",
              providedAt: "2026-05-10T12:00:00.000Z",
            },
          ],
        },
      },
    });
    expect(rowNames(run(senior))).toContain("Daily Clean Sweep");
  });

  it("does not resurrect one recorded in another month", () => {
    const senior = makeSenior({
      carePlan: { housekeeping: { laundry: "Weekly" } },
      clinical: {
        carePlan: {
          services: [
            {
              serviceName: "dailyCleanSweep",
              serviceCategory: "House Keeping",
              providedOrNot: "Provided",
              providedAt: "2026-04-10T12:00:00.000Z",
            },
          ],
        },
      },
    });
    expect(rowNames(run(senior))).not.toContain("Daily Clean Sweep");
  });

  it("does not add a row for a vital sign record", () => {
    const senior = makeSenior({
      carePlan: { housekeeping: { laundry: "Weekly" } },
      clinical: {
        carePlan: {
          services: [
            {
              serviceName: "bloodPressure",
              serviceCategory: "Vital Signs",
              providedAt: "2026-05-10T12:00:00.000Z",
              readings: [],
            },
          ],
        },
      },
    });
    expect(rowNames(run(senior))).not.toContain("Blood Pressure");
  });

  it("gives one row when the plan and the records agree", () => {
    // Deduped on `category|matchKey`, so a service that is both prescribed
    // and recorded does not appear twice.
    const senior = makeSenior({
      carePlan: { housekeeping: { laundry: "Weekly" } },
      clinical: {
        carePlan: {
          services: [
            {
              serviceName: "laundry",
              serviceCategory: "House Keeping",
              providedOrNot: "Provided",
              providedAt: "2026-05-10T12:00:00.000Z",
            },
          ],
        },
      },
    });
    expect(rowNames(run(senior)).filter((n: string) => n === "Laundry")).toHaveLength(1);
  });

  it("gives one row for several records of the same service", () => {
    const record = (day: string) => ({
      serviceName: "dailyCleanSweep",
      serviceCategory: "House Keeping",
      providedOrNot: "Provided",
      providedAt: `2026-05-${day}T12:00:00.000Z`,
    });
    const senior = makeSenior({
      carePlan: {},
      clinical: { carePlan: { services: [record("10"), record("11")] } },
    });
    expect(run(senior).rows).toHaveLength(1);
  });

  it("fills every recorded day on the recovered row", () => {
    const record = (day: string) => ({
      serviceName: "dailyCleanSweep",
      serviceCategory: "House Keeping",
      providedOrNot: "Provided",
      providedAt: `2026-05-${day}T12:00:00.000Z`,
    });
    const senior = makeSenior({
      carePlan: {},
      clinical: { carePlan: { services: [record("10"), record("11")] } },
    });
    const marked = rowFor(run(senior), "Daily Clean Sweep").days.filter(
      (d: any) => d.status !== ""
    );
    expect(marked.map((d: any) => d.day)).toEqual([10, 11]);
  });
});

// ─── Vital sign readings ─────────────────────────────────────────────────────

describe("CarePlanDataLayer — vital sign readings", () => {
  const withVital = (readings: any[]) =>
    makeSenior({
      clinical: {
        carePlan: {
          services: [
            {
              serviceName: "bloodPressure",
              serviceCategory: "Vital Signs",
              readings,
            },
          ],
        },
      },
    });

  it("puts no reading into the grid — there is no row to put it in", () => {
    const senior = withVital([{ time: "2026-05-10T14:30:00.000Z", value: "120/80" }]);
    expect(rowFor(run(senior), "Blood Pressure")).toBeUndefined();
  });

  it("lists each reading in the detail section", () => {
    const senior = withVital([{ time: "2026-05-10T14:30:00.000Z", value: "120/80" }]);
    const { vitalSignReadings } = run(senior);
    expect(vitalSignReadings).toHaveLength(1);
    expect(vitalSignReadings[0]).toMatchObject({
      // The detail table gets the display label too, not the stored key.
      serviceName: "Blood Pressure",
      date: "2026-05-10",
      day: 10,
      value: "120/80",
    });
  });

  it("lists several readings on one day separately", () => {
    // They are no longer joined into a single cell — each is its own line.
    const senior = withVital([
      { time: "2026-05-10T08:00:00.000Z", value: "120/80" },
      { time: "2026-05-10T20:00:00.000Z", value: "118/76" },
    ]);
    const { vitalSignReadings } = run(senior);
    expect(vitalSignReadings).toHaveLength(2);
    expect(vitalSignReadings.map((r: any) => r.value)).toEqual(["120/80", "118/76"]);
  });

  it("title-cases a vital sign the label map does not know", () => {
    const senior = makeSenior({
      clinical: {
        carePlan: {
          services: [
            {
              serviceName: "respiratoryRate",
              serviceCategory: "Vital Signs",
              readings: [{ time: "2026-05-10T14:30:00.000Z", value: "16" }],
            },
          ],
        },
      },
    });
    expect(run(senior).vitalSignReadings[0].serviceName).toBe("Respiratory Rate");
  });

  it("records the time of each reading in local time", () => {
    // The reading is stored in UTC but `format(parseISO(...), "HH:mm")` renders
    // it in the machine's timezone, so the report shows 10:30 for a 14:30Z
    // reading in New York. Derived rather than hardcoded, or this test would
    // only pass at UTC+0.
    const iso = "2026-05-10T14:30:00.000Z";
    const local = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    const expected = `${pad(local.getHours())}:${pad(local.getMinutes())}`;

    const senior = withVital([{ time: iso, value: "120/80" }]);
    expect(run(senior).vitalSignReadings[0].time).toBe(expected);
  });

  it("buckets a reading by its LOCAL date, unlike the on-screen care plan", () => {
    // A divergence worth knowing about, and the same shape as the Medication
    // tab / MedPass split:
    //
    //   careplan.tsx        getUtcDateFromIso() — slices the ISO string, UTC
    //   carePlanDataLayer   format(parseISO(...)) — the machine's timezone
    //
    // So a reading taken near midnight UTC can appear on one day in the Care
    // Plan tab and the day before or after it on the printed report.
    const iso = "2026-05-10T02:00:00.000Z";
    const utcDay = Number(iso.slice(8, 10));
    const localDay = new Date(iso).getDate();

    const senior = withVital([{ time: iso, value: "120/80" }]);
    const reading = run(senior).vitalSignReadings[0];

    expect(reading.day).toBe(localDay);
    if (utcDay !== localDay) {
      // Only meaningful where the two disagree; states the divergence outright.
      expect(reading.day).not.toBe(utcDay);
    }
  });

  it("leaves out a reading from another month", () => {
    const senior = withVital([{ time: "2026-04-10T14:30:00.000Z", value: "120/80" }]);
    expect(run(senior).vitalSignReadings).toHaveLength(0);
  });

  it("skips a reading with no time", () => {
    const senior = withVital([{ value: "120/80" }]);
    expect(run(senior).vitalSignReadings).toHaveLength(0);
  });

  it("survives a service whose readings are not an array", () => {
    const senior = makeSenior({
      clinical: {
        carePlan: {
          services: [
            { serviceName: "bloodPressure", serviceCategory: "Vital Signs", readings: null },
          ],
        },
      },
    });
    expect(() => run(senior)).not.toThrow();
    expect(run(senior).vitalSignReadings).toHaveLength(0);
  });
});

// ─── Empty and malformed plans ───────────────────────────────────────────────

describe("CarePlanDataLayer — empty and malformed", () => {
  it("produces no rows for a senior with no care plan", () => {
    const result = run({ name: "Arthur Bean", clinical: {} });
    expect(result.rows).toHaveLength(0);
    expect(result.vitalSignReadings).toHaveLength(0);
  });

  it("produces no rows for an empty care plan", () => {
    expect(run(makeSenior({ carePlan: {} })).rows).toHaveLength(0);
  });

  it("survives a senior with nothing at all", () => {
    expect(() => run({})).not.toThrow();
  });

  it("defaults the name and home to empty strings", () => {
    const result = run({});
    expect(result.name).toBe("");
    expect(result.home).toBe("");
  });

  it("survives a plan section that is null", () => {
    const senior = makeSenior({
      carePlan: { adl: null, housekeeping: null, vitalSigns: null },
    });
    expect(() => run(senior)).not.toThrow();
  });

  it("still labels the month for an empty plan", () => {
    expect(run({}, "2026-12").monthLabel).toBe("December 2026");
  });

  it("survives services being absent entirely", () => {
    const senior = makeSenior({ clinical: {} });
    expect(() => run(senior)).not.toThrow();
    expect(rowFor(run(senior), "Laundry").days).toHaveLength(31);
  });
});
