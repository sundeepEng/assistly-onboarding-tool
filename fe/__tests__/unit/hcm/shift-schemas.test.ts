/**
 * Staffing schemas — model/hcm/user-shifts.model.ts
 *
 * Scheduling, time-off requests and timecards all validate here before they
 * reach /v1/hcm/*. The rules that matter most are the ones that differ by home
 * type (In-Home Care shifts must name the senior being visited) and the
 * conditional time-off rules for single vs multi-day requests.
 */

import {
  AddtimeCardSchema,
  createUserShiftSchema,
  createUserShiftSchemaWithHomeType,
  EditTimeCardSchema,
  MonthTeamShiftSchema,
  TimeOffSchema,
  updateUserShiftSchema,
} from "../../../model/hcm/user-shifts.model";
import { TEST_HOME_ID } from "../../test-utils/auth";
import { makeShiftInput, makeTimeOffInput, UUIDS } from "../../test-utils/factories";

const errorFor = (result: any, path: string) =>
  result.success
    ? undefined
    : result.error.issues.find((i: any) => i.path.join(".") === path)?.message;

// ─── Creating a shift ────────────────────────────────────────────────────────

describe("createUserShiftSchema", () => {
  it("accepts a minimal shift", () => {
    expect(createUserShiftSchema.safeParse(makeShiftInput()).success).toBe(true);
  });

  it("requires a start and an end time", () => {
    expect(
      createUserShiftSchema.safeParse(makeShiftInput({ shift_start_time: undefined }))
        .success
    ).toBe(false);
    expect(
      createUserShiftSchema.safeParse(makeShiftInput({ shift_end_time: undefined }))
        .success
    ).toBe(false);
  });

  it.each(["available", "timeoff", "vacation"])(
    "accepts the shift status %p",
    (shift_status) => {
      expect(
        createUserShiftSchema.safeParse(makeShiftInput({ shift_status })).success
      ).toBe(true);
    }
  );

  it("rejects an unknown shift status", () => {
    expect(
      createUserShiftSchema.safeParse(makeShiftInput({ shift_status: "sick" })).success
    ).toBe(false);
  });

  it("defaults the shift colour when none is supplied", () => {
    const result = createUserShiftSchema.safeParse(
      makeShiftInput({ shift_color: undefined })
    );
    expect((result as any).data.shift_color).toBe("#3b82f6");
  });

  it("rejects an empty shift colour", () => {
    expect(
      createUserShiftSchema.safeParse(makeShiftInput({ shift_color: "" })).success
    ).toBe(false);
  });

  it.each(["Hourly", "Monthly"])("accepts the pay frequency %p", (pay_frequency) => {
    expect(
      createUserShiftSchema.safeParse(makeShiftInput({ pay_frequency })).success
    ).toBe(true);
  });

  it("defaults the pay frequency to Hourly", () => {
    const result = createUserShiftSchema.safeParse(
      makeShiftInput({ pay_frequency: undefined })
    );
    expect((result as any).data.pay_frequency).toBe("Hourly");
  });

  it("rejects an unknown pay frequency", () => {
    expect(
      createUserShiftSchema.safeParse(makeShiftInput({ pay_frequency: "Weekly" }))
        .success
    ).toBe(false);
  });

  it("requires the employee and home ids to be UUIDs", () => {
    expect(
      createUserShiftSchema.safeParse(makeShiftInput({ user_id: "pcg-1" })).success
    ).toBe(false);
    expect(
      createUserShiftSchema.safeParse(makeShiftInput({ home_id: "home-1" })).success
    ).toBe(false);
  });

  it("accepts a numeric pay rate", () => {
    expect(
      createUserShiftSchema.safeParse(makeShiftInput({ pay_rate: 18.5 })).success
    ).toBe(true);
  });

  it("rejects a pay rate sent as a string", () => {
    expect(
      createUserShiftSchema.safeParse(makeShiftInput({ pay_rate: "18.5" })).success
    ).toBe(false);
  });

  describe("clock in/out", () => {
    it("accepts ISO clock timestamps", () => {
      expect(
        createUserShiftSchema.safeParse(
          makeShiftInput({
            clock_in_timestamp: "2026-03-02T13:02:00.000Z",
            clock_out_timestamp: "2026-03-02T21:04:00.000Z",
          })
        ).success
      ).toBe(true);
    });

    it("accepts a null clock-out — the caregiver is still on shift", () => {
      expect(
        createUserShiftSchema.safeParse(makeShiftInput({ clock_out_timestamp: null }))
          .success
      ).toBe(true);
    });

    it("rejects a non-ISO clock timestamp", () => {
      expect(
        createUserShiftSchema.safeParse(
          makeShiftInput({ clock_in_timestamp: "2026-03-02 13:02" })
        ).success
      ).toBe(false);
    });
  });

  describe("notes", () => {
    it("accepts an empty note", () => {
      expect(
        createUserShiftSchema.safeParse(makeShiftInput({ notes: "" })).success
      ).toBe(true);
    });

    it("accepts a 500-character note", () => {
      expect(
        createUserShiftSchema.safeParse(makeShiftInput({ notes: "x".repeat(500) }))
          .success
      ).toBe(true);
    });

    it("rejects a note over 500 characters", () => {
      expect(
        createUserShiftSchema.safeParse(makeShiftInput({ notes: "x".repeat(501) }))
          .success
      ).toBe(false);
    });
  });

  it("rejects an unknown field", () => {
    expect(
      createUserShiftSchema.safeParse(makeShiftInput({ break_minutes: 30 })).success
    ).toBe(false);
  });
});

// ─── Home-type-aware shift creation ──────────────────────────────────────────

describe("createUserShiftSchemaWithHomeType", () => {
  const residential = createUserShiftSchemaWithHomeType(false);
  const inHomeCare = createUserShiftSchemaWithHomeType(true);

  describe("In-Home Care", () => {
    it("requires the senior the caregiver is visiting", () => {
      const result = inHomeCare.safeParse(makeShiftInput());
      // The custom message is attached to the `.uuid()` check, so a *missing*
      // selection falls through to zod's generic type error instead. Only a
      // badly-formatted id gets the friendly copy (asserted below).
      expect(errorFor(result, "assigned_to_user_id")).toBe("Required");
    });

    it("accepts a shift once a senior is assigned", () => {
      expect(
        inHomeCare.safeParse(makeShiftInput({ assigned_to_user_id: UUIDS.senior }))
          .success
      ).toBe(true);
    });

    it("rejects a non-UUID senior id", () => {
      const result = inHomeCare.safeParse(
        makeShiftInput({ assigned_to_user_id: "senior-1" })
      );
      expect(errorFor(result, "assigned_to_user_id")).toBe(
        "Senior selection is required for InHomeCare"
      );
    });

    it("keeps the assignment on the parsed output", () => {
      const result = inHomeCare.safeParse(
        makeShiftInput({ assigned_to_user_id: UUIDS.senior })
      );
      expect((result as any).data.assigned_to_user_id).toBe(UUIDS.senior);
    });
  });

  describe("residential home", () => {
    it("accepts a shift with no senior assigned", () => {
      expect(residential.safeParse(makeShiftInput()).success).toBe(true);
    });

    it("strips the assignment from the payload entirely", () => {
      // A residential shift covers the whole house; sending a senior id would
      // make the API treat it as a one-to-one visit.
      const result = residential.safeParse(
        makeShiftInput({ assigned_to_user_id: UUIDS.senior })
      );
      expect(result.success).toBe(true);
      expect((result as any).data).not.toHaveProperty("assigned_to_user_id");
    });

    it("ignores a null assignment rather than failing on it", () => {
      expect(
        residential.safeParse(makeShiftInput({ assigned_to_user_id: null })).success
      ).toBe(true);
    });
  });
});

// ─── Time off ────────────────────────────────────────────────────────────────

describe("TimeOffSchema", () => {
  describe("single-day request", () => {
    it("accepts a complete request", () => {
      expect(TimeOffSchema.safeParse(makeTimeOffInput()).success).toBe(true);
    });

    it("requires the date", () => {
      const result = TimeOffSchema.safeParse(
        makeTimeOffInput({ shift_date: undefined })
      );
      expect(errorFor(result, "shift_date")).toBe("Date is required");
    });

    it("requires both a start and an end time", () => {
      expect(
        errorFor(
          TimeOffSchema.safeParse(makeTimeOffInput({ shift_start_time: undefined })),
          "shift_start_time"
        )
      ).toBe("Required");
      expect(
        errorFor(
          TimeOffSchema.safeParse(makeTimeOffInput({ shift_end_time: undefined })),
          "shift_end_time"
        )
      ).toBe("Required");
    });

    it("does not require the multi-day range", () => {
      expect(
        TimeOffSchema.safeParse(makeTimeOffInput({ multi_day_start: undefined })).success
      ).toBe(true);
    });
  });

  describe("multi-day request", () => {
    const multiDay = (overrides: Record<string, any> = {}) => ({
      isMultipleDays: true,
      multi_day_start: "2026-03-05",
      multi_day_end: "2026-03-09",
      unavailability_reason: "Vacation(Paid)",
      ...overrides,
    });

    it("accepts a start-and-end range", () => {
      expect(TimeOffSchema.safeParse(multiDay()).success).toBe(true);
    });

    it("requires the range start", () => {
      const result = TimeOffSchema.safeParse(multiDay({ multi_day_start: undefined }));
      expect(errorFor(result, "multi_day_start")).toBe("Required");
    });

    it("requires the range end", () => {
      const result = TimeOffSchema.safeParse(multiDay({ multi_day_end: undefined }));
      expect(errorFor(result, "multi_day_end")).toBe("Required");
    });

    it("does not require the single-day fields", () => {
      const result = TimeOffSchema.safeParse(multiDay());
      expect(errorFor(result, "shift_date")).toBeUndefined();
      expect(errorFor(result, "shift_start_time")).toBeUndefined();
    });
  });

  describe("reason", () => {
    it("requires a reason", () => {
      const result = TimeOffSchema.safeParse(
        makeTimeOffInput({ unavailability_reason: undefined })
      );
      expect(errorFor(result, "unavailability_reason")).toBe("Reason is required!");
    });

    it.each([
      "Vacation(Unpaid)",
      "Vacation(Paid)",
      "Sick Leave",
      "Jury Duty",
      "Family Medical Emergency",
    ])("accepts the reason %p", (unavailability_reason) => {
      expect(
        TimeOffSchema.safeParse(makeTimeOffInput({ unavailability_reason })).success
      ).toBe(true);
    });

    it("rejects a reason over 500 characters", () => {
      expect(
        TimeOffSchema.safeParse(
          makeTimeOffInput({ unavailability_reason: "x".repeat(501) })
        ).success
      ).toBe(false);
    });
  });

  it("rejects a note over 500 characters", () => {
    expect(
      TimeOffSchema.safeParse(makeTimeOffInput({ notes: "x".repeat(501) })).success
    ).toBe(false);
  });
});

// ─── Updating a shift ────────────────────────────────────────────────────────

describe("updateUserShiftSchema", () => {
  const update = (overrides: Record<string, any> = {}) => ({
    id: 101,
    user_id: UUIDS.pcg,
    shift_status: "available" as const,
    // `.datetime({ offset: false })` accepts the UTC "Z" form only.
    shift_start_time: "2026-03-02T13:00:00Z",
    shift_end_time: "2026-03-02T21:00:00Z",
    pay_rate: 12,
    pay_frequency: "Hourly" as const,
    ...overrides,
  });

  it("accepts a well-formed update", () => {
    expect(updateUserShiftSchema.safeParse(update()).success).toBe(true);
  });

  it("requires a positive integer id", () => {
    expect(updateUserShiftSchema.safeParse(update({ id: 0 })).success).toBe(false);
    expect(updateUserShiftSchema.safeParse(update({ id: -1 })).success).toBe(false);
    expect(updateUserShiftSchema.safeParse(update({ id: 1.5 })).success).toBe(false);
  });

  it("rejects an id sent as a string", () => {
    expect(updateUserShiftSchema.safeParse(update({ id: "101" })).success).toBe(false);
  });

  it("rejects a datetime carrying a numeric UTC offset", () => {
    // `offset: false` bars "+05:30" style zones. Sending one would let two homes
    // in different regions write the same wall-clock time and mean different
    // instants, so the roster has to be normalised to UTC before it is saved.
    expect(
      updateUserShiftSchema.safeParse(
        update({ shift_start_time: "2026-03-02T13:00:00+05:30" })
      ).success
    ).toBe(false);
  });

  it("rejects a bare local datetime with no zone at all", () => {
    expect(
      updateUserShiftSchema.safeParse(
        update({ shift_start_time: "2026-03-02T13:00:00" })
      ).success
    ).toBe(false);
  });

  it("accepts fractional seconds on the UTC form", () => {
    expect(
      updateUserShiftSchema.safeParse(
        update({ shift_start_time: "2026-03-02T13:00:00.000Z" })
      ).success
    ).toBe(true);
  });

  it("requires a pay rate", () => {
    expect(updateUserShiftSchema.safeParse(update({ pay_rate: undefined })).success).toBe(
      false
    );
  });

  it("accepts an approval decision on an unavailability request", () => {
    expect(
      updateUserShiftSchema.safeParse(
        update({ shift_status: "timeoff", is_unavailability_approved: true })
      ).success
    ).toBe(true);
  });

  it("accepts an undecided approval as null", () => {
    expect(
      updateUserShiftSchema.safeParse(update({ is_unavailability_approved: null }))
        .success
    ).toBe(true);
  });

  it("accepts the timecard edit fields the form carries", () => {
    expect(
      updateUserShiftSchema.safeParse(
        update({
          clock_in_date: "2026-03-02",
          clock_in_time: "13:02",
          clock_out_time: "21:04",
        })
      ).success
    ).toBe(true);
  });

  it("rejects an unknown field", () => {
    expect(updateUserShiftSchema.safeParse(update({ home_id: TEST_HOME_ID })).success).toBe(
      false
    );
  });
});

// ─── Timecards ───────────────────────────────────────────────────────────────

describe("AddtimeCardSchema", () => {
  const timecard = (overrides: Record<string, any> = {}) => ({
    user_id: UUIDS.pcg,
    clock_in_date: "2026-03-02",
    ...overrides,
  });

  it("accepts an employee and a date", () => {
    expect(AddtimeCardSchema.safeParse(timecard()).success).toBe(true);
  });

  it("requires an employee", () => {
    // "Employee is required" is attached to the `.uuid()` check, so an untouched
    // dropdown reports zod's generic message instead of that copy.
    const result = AddtimeCardSchema.safeParse(timecard({ user_id: undefined }));
    expect(errorFor(result, "user_id")).toBe("Required");
  });

  it("shows the friendly message for a non-UUID employee", () => {
    const result = AddtimeCardSchema.safeParse(timecard({ user_id: "pcg-1" }));
    expect(errorFor(result, "user_id")).toBe("Employee is required");
  });

  it("requires the date", () => {
    const result = AddtimeCardSchema.safeParse(timecard({ clock_in_date: undefined }));
    expect(errorFor(result, "clock_in_date")).toBe("Date is required");
  });

  it("accepts clock in and out times", () => {
    expect(
      AddtimeCardSchema.safeParse(
        timecard({ clock_in_time: "13:02", clock_out_time: "21:04" })
      ).success
    ).toBe(true);
  });

  it("accepts an optional role label", () => {
    expect(AddtimeCardSchema.safeParse(timecard({ role: "PCG" })).success).toBe(true);
  });

  it("rejects a role label over 100 characters", () => {
    expect(
      AddtimeCardSchema.safeParse(timecard({ role: "x".repeat(101) })).success
    ).toBe(false);
  });
});

describe("EditTimeCardSchema", () => {
  it("accepts an edit of both times", () => {
    expect(
      EditTimeCardSchema.safeParse({ clock_in_time: "13:02", clock_out_time: "21:04" })
        .success
    ).toBe(true);
  });

  it("accepts an empty edit — every field is optional", () => {
    expect(EditTimeCardSchema.safeParse({}).success).toBe(true);
  });

  /**
   * `notes` arrived with the stg merge, alongside the note field added to
   * `timesheet/edit-time-card.tsx`. It is the only nullable field on the
   * schema: the form can clear a note by sending null, where the two time
   * fields would have to be omitted instead.
   */
  it("accepts a note alongside the times", () => {
    expect(
      EditTimeCardSchema.safeParse({
        clock_in_time: "13:02",
        clock_out_time: "21:04",
        notes: "Covered the late round",
      }).success
    ).toBe(true);
  });

  it("accepts a note on its own", () => {
    expect(
      EditTimeCardSchema.safeParse({ notes: "Covered the late round" }).success
    ).toBe(true);
  });

  it("accepts an empty note", () => {
    expect(EditTimeCardSchema.safeParse({ notes: "" }).success).toBe(true);
  });

  it("accepts a null note — the form clears it that way", () => {
    expect(EditTimeCardSchema.safeParse({ notes: null }).success).toBe(true);
  });

  it("accepts an omitted note", () => {
    expect(EditTimeCardSchema.safeParse({ clock_in_time: "13:02" }).success).toBe(
      true
    );
  });

  it("[boundary] accepts a note of exactly 500 characters", () => {
    expect(
      EditTimeCardSchema.safeParse({ notes: "x".repeat(500) }).success
    ).toBe(true);
  });

  it("[boundary] refuses a note of 501 characters", () => {
    expect(
      EditTimeCardSchema.safeParse({ notes: "x".repeat(501) }).success
    ).toBe(false);
  });

  it("refuses a note that is not a string", () => {
    expect(EditTimeCardSchema.safeParse({ notes: 42 }).success).toBe(false);
  });

  it("[as-built] does not trim a note of only spaces", () => {
    // `max(500)` counts characters, not content, so whitespace is a valid
    // note and saves as one.
    expect(EditTimeCardSchema.safeParse({ notes: "   " }).success).toBe(true);
  });

  it("strips unknown keys rather than refusing them", () => {
    const result = EditTimeCardSchema.safeParse({ notes: "ok", stray: 1 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).not.toHaveProperty("stray");
  });
});

describe("MonthTeamShiftSchema", () => {
  it("requires an employee to view the month roster for", () => {
    // As with AddtimeCardSchema, an absent value reports the generic message.
    expect(errorFor(MonthTeamShiftSchema.safeParse({}), "user_id")).toBe("Required");
    expect(
      errorFor(MonthTeamShiftSchema.safeParse({ user_id: "pcg-1" }), "user_id")
    ).toBe("Employee is required");
  });

  it("accepts a UUID employee", () => {
    expect(MonthTeamShiftSchema.safeParse({ user_id: UUIDS.pcg }).success).toBe(true);
  });
});
