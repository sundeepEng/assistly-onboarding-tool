# Staff Management (HCM) end-to-end specs

Routes: `/hcm` (dashboard), `/hcm/scheduling`, `/hcm/team`, `/hcm/timesheet`,
`/hcm/sales-team` (reachable by URL only — it is not in the sidebar).

## What lives where

| Spec | Covers | Tests |
| --- | --- | --- |
| `hcm.cy.ts` | API contracts for all four routes, board and roster contents, access, error handling | 33 |
| `scheduling-navigation.cy.ts` | The scheduling top bar: Today, the date label, the ‹ › arrows, the view select, Copy week | 88 |
| `scheduling-shifts.cy.ts` | Adding, editing and dragging shifts, time off, confirming a week copy, Print | 158 |
| `scheduling-add-team-member.cy.ts` | The Add Team Member button and the Add Care Lead form it opens | 48 |
| `timesheet-daily-review.cy.ts` | Timesheets → Daily review: the date button, the table, and the Edit Time Card modal | 81 |
| `timesheet-pay-period-review.cy.ts` | Timesheets → Pay period review: the range picker, the accordions, Add Clock In / Out, Export Excel | 86 |
| `team-roster.cy.ts` | Care Team: the roster, the ⋮ menu, and a member's Job Details / Personal Information / Documents | 107 |
| `dashboard.cy.ts` | The dashboard: Now & Upcoming / Completed, the clock-in ⋮ menu, and Needs Review | 83 |
| `sales-team.cy.ts` | `/hcm/sales-team` — the two-query roster, Onboard, Assign Sales Reps | 53 |
| `tasks.cy.ts` | `/hcm/tasks` — the library GET, task create/delete writes, and the Task Status daily-tracking query | 5 |
| `team-communication.cy.ts` | Care Team broadcast feed + send, and the communication popup's conversations/messages contracts | 7 |
| | **Total (must stay green)** | **749** |
| `known-defects.cy.ts` | **Fails on purpose** — executable bug reports | 10 |

```bash
# everything that must pass — note known-defects is excluded
npx cypress run --spec "cypress/e2e/hcm/!(known-defects).cy.ts"

# one spec
npx cypress run --spec cypress/e2e/hcm/scheduling-shifts.cy.ts

# the bug list, on its own — expected to be red
npx cypress run --spec cypress/e2e/hcm/known-defects.cy.ts
```


## A clocked shift is frozen for everyone except a PCHO

The stg merge added `&& !isPCHO` to both the cursor and the blocked-attempt
handler in `schedule/{day,week,month}-view.tsx`. A shift carrying a
`clock_in_timestamp` or `clock_out_timestamp` used to be locked for all roles;
the home owner can now correct one after the fact and nobody else can.

| role | cursor | clicking it |
| --- | --- | --- |
| PCHO | `grab` | opens the edit form |
| anyone else | `not-allowed` | "Care Team has already logged time…" and no request |

**HomeAdmin is the control** in the spec: it reaches the board and holds
`HCM_SCHEDULING` EDIT, so the only thing separating it from a PCHO is the role
check itself. Asserting the restriction with a role that could not drag anyway
would prove nothing.

## Unit tests

`__tests__/unit/hcm/` — 331 tests, six suites. Run them with
`npx jest __tests__/unit/hcm`.

| Suite | Covers |
| --- | --- |
| `shift-schemas.test.ts` | the zod schemas behind every shift and time-off form |
| `shift-services.test.tsx` | the five react-query hooks that talk to `/v1/hcm/shift(s)` |
| `hcm-time-formatting.test.ts` | `formatTime`, `getLocalTimeString`, `scheduleTimeOptions`, `getShiftDateTime`, `getUtcDateTimeString`, the three date formatters, `isOvernightShift` |
| `hcm-time-calculations.test.ts` | the payroll arithmetic: hours, wages, `processShiftTimes`, `processMissingSchedulesByDay` |
| `hcm-pay-period-report.test.ts` | `buildPayPeriodReport` — everything the exported workbook says |
| `hcm-role-access.test.ts` | the permission matrix every gate in the module reads |

`timeUtils.ts` had no unit coverage at all before this, and it is where every
figure on the dashboard, the timesheets and the export comes from. Two bugs the
Cypress suite could only see indirectly are now pinned at their source:

- **`calculateTotalWages` throws on a numeric pay rate.** It calls
  `pay_rate.replace(...)` on the override before checking its type, and
  `buildPayPeriodReport` hands it `roaster[0].pay_rate` straight from the API.
  `handleExport` has no catch, so a home whose roster stores the rate
  numerically gets no workbook and no error message. `calculateShiftWage` two
  functions away does `String(...)` first and is fine.
- **The pay-period export reads "monthly" from two different places.** The
  employee total asks the ROSTER (→ `null` → the sheet prints "NA"); each line
  asks `calculateShiftWage`, which reads the SHIFT's own `pay_frequency`. A
  monthly-paid carer whose shift rows still say "Hourly" exports with "NA" as
  the total and 8 × 4500 = $36,000 against every line.

Smaller things pinned as built: `scheduleTimeOptions` covers a full 24 hours
despite a comment claiming it stops at noon; `getHoursDifference` treats the
Unix epoch as "no time" because the guard tests `getTime()` for truthiness;
`isOvernightShift` calls a zero-length shift overnight; `formatToDateWithTime`
strips the comma after the day rather than the one before the time; and
`calculateScheduledTotalWages` has no monthly guard, so it prices a $4500/month
member at 8 × 4500 for a single shift.

**The permission matrix is worth reading before writing an RBAC fixture.** It is
not symmetrical: a HomeAdmin gets the employer dashboard, the daily review and
`HCM_SCHEDULING`, but only VIEW on the roster and no Job Details tab; a PCG gets
the employee dashboard and the pay period review but not the daily one. EDIT
never implies VIEW.

## Scheduling: one date, three views

The schedule date is a single ISO string in Redux
(`redux/slices/schedule-date-slice.ts`), seeded from `new Date()` when the slice
is first imported. Everything in the top bar dispatches to that one slice —
only the step size changes:

| View | ‹ › step | Date label format | Example |
| --- | --- | --- | --- |
| Week | ±7 days | `"MMM d"` – `"MMM d , yyyy"` | `Sep 7 – Sep 13 , 2026` |
| Month | ±1 month | `"MMMM yyyy"` | `September 2026` |
| Day | ±1 day | `"EEEE, MMMM d, yyyy"` | `Tuesday, September 8, 2026` |

Two consequences worth knowing before writing a test here:

- **The date survives a change of view, the view does not survive a reload.**
  Rewind two weeks and switch to Month View and you land on that month. But
  `view` is component state in `schedule-board.tsx`, so a reload puts you back
  in Week View on whatever date the store holds.
- **`Today` is global.** It writes `new Date()` to the slice, so pressing it in
  one view resets all three.

Weeks start on Monday (`weekStartsOn: 1`) everywhere.

## Freeze the clock

`Today`, the blue outline (`isSameDay(date, new Date())`) and the slice's own
initial value are all the wall clock, so nothing on this screen is
deterministic without `cy.clock`. Every test here freezes at **Tue 8 Sep 2026**
before `cy.visit`, so the slice seeds itself from the frozen instant:

```ts
cy.clock(FROZEN_NOW, ["Date"]);
cy.visit("/hcm/scheduling");
```

`["Date"]` fakes only `Date`, leaving React Query's timers alive — the same
pattern the clinical suite uses.

The date was picked deliberately: mid-week so the week does not straddle a year,
and mid-month so `addMonths` never clamps. Freezing on the 29th–31st would make
the month tests assert `addMonths` clamping rather than navigation.

## Two date formats, four lines apart

`schedule-board.tsx` builds the week label with `"MMM d , yyyy"` — a space
**before** the comma — and the Copy week options, forty lines later, with a
normal `"MMM d, yyyy"`:

```
header      Sep 7 – Sep 13 , 2026
copy week   Aug 31 – Sep 6, 2026
```

Both are pinned as built. The separator in both is an en dash (`–`) with spaces
around it, not a hyphen — a test that types `-` will never match.

## Copy week

Only rendered when `view === "week"` **and** the role holds `HCM_SCHEDULING`
EDIT. It lists the six weeks preceding the one on screen, so its options
re-base every time you use the arrows.

Choosing one does not copy anything: it opens a **Confirm Copy Week** modal, and
what that modal shows depends on the source week:

- no `available` shifts in it → "There are no available shifts to copy!" and no
  buttons at all, only the cross;
- otherwise → the banner, Cancel and Confirm.

Both branches read the same `GET /v1/hcm/shifts` the board uses. Only the copy
lookup sends `shift_start_time`, which is how `stubCopyableWeek()` answers one
and not the other. Time off is excluded from a copy by design.

**The banner names the wrong week east of Greenwich.** `week-view.tsx:649`
formats `addDays(copyFromWeek, 1)`, where `copyFromWeek` is already the week
start as a `yyyy-MM-dd` string. The string parses as UTC midnight and formats in
local time, so the `+1` cancels the westward shift and reads correctly in the
Americas — and reads the day *after* the week start at UTC+0 and east of it. The
spec derives the expected string the same way rather than hardcoding it, so it
states the behaviour truthfully wherever it runs. Defect 1 in
`known-defects.cy.ts` asserts the intended behaviour.

## The write endpoints are singular

This is the single costliest thing to get wrong in this module, because getting
it wrong looks exactly like "the button does nothing":

| Operation | Endpoint |
| --- | --- |
| List | `GET /v1/hcm/shifts` |
| Create | `POST /v1/hcm/shift` |
| Update | `PUT /v1/hcm/shift/{id}` |
| Delete | `DELETE /v1/hcm/shift/{id}` |

A stub written against `**/v1/hcm/shifts*` catches the list and silently misses
every write, which then escapes to the real API. `hcm-create-shift.ts` also
insists on **201** exactly — it throws on any other 2xx — so a `statusCode: 200`
stub fails the create rather than succeeding.

Creating is sometimes a single object and sometimes an array:

| Flow | Body |
| --- | --- |
| Add shift | array — one entry per weekday under "Apply to" |
| Time off, Multiple Days off | single object |
| Time off, Multiple Days on | array — one entry per day in the range |
| Confirm Copy Week | array — one entry per copyable source shift |

"Apply to" always preselects the clicked day, so the single-object create branch
in `add-shift.tsx` is unreachable from the grid.

## Times on the wire

Times leave the form as local `HH:mm:ss` and are joined to the cell's date by
`getUtcDateTimeString`, so what is sent is a real UTC instant. **Assert on the
local rendering of what was sent, never on a hardcoded `Z` string** — the latter
only passes in one timezone. `localTime()` / `localDay()` in the shifts spec do
this; `cardTime()` is their zero-padded sibling, because the grid prints
`hh:mm a` ("09:30 AM") while the picker prints `h:mm a` ("9:30 AM").

If the end time is at or before the start, the end rolls forward a day — a
10 PM–6 AM night shift, not a validation error.

## Dragging a shift

`onDragEnd` (`week-view.tsx:349`) rebuilds the shift for wherever it landed: the
target member becomes `user_id`, the target column becomes the date, time of day
and duration are preserved, and the pay rate is taken from the **new** member's
roaster. The grid updates optimistically and rolls back if the PUT fails. Only
an `available` shift with no clock entry is draggable at all.

dnd-kit's `PointerSensor` has a 4px activation distance, and three things are
load-bearing when driving it from Cypress — each established by trying the
alternative and watching the drag never start:

1. **The moves go to `body`**, not to the source or target element. dnd-kit
   binds its move/up listeners to the document once the drag activates.
2. **There is a pause between the steps.** The sensor activates asynchronously
   and Cypress fires events back to back; with no gap the drop resolves against
   a `null` `over` and nothing is sent.
3. **Coordinates come from live bounding rects.** `closestCenter` compares real
   geometry, so invented numbers drop the shift nowhere.

`mousedown`/`mousemove` are not a substitute — the sensor listens for pointer
events only. See `dragShiftTo()` for the working sequence.

**The negative drag tests are only meaningful while a positive one passes.**
"will not drag time off", "…a clocked shift", "…without HCM_SCHEDULING" all
assert that no request was sent, and they passed for a whole run while the drag
helper was silently broken. "hands the shift to the member it was dropped on" is
the control: if the helper stops working, that test fails loudly and the three
negatives should not be trusted until it is green again.

## Selectors

`SelectComponent` renders a real `<select>` with the field name as both `id` and
`name`, so `select[name="view"]` and `select[name="copyWeek"]` are stable.

The arrows are bare inline SVGs with no accessible name and identical
dimensions; the click handler sits on the wrapping `div`. Scope to the control
row and take them in DOM order:

```ts
controls: () => cy.contains("div", /^Today$/).parent(),
prev: () => sel.controls().find("svg").eq(0).parent(),
next: () => sel.controls().find("svg").eq(1).parent(),
label: () => sel.controls().find('div[class*="w-[200px]"]'),
```

**`.shift-card` is on two elements.** For an available shift the class is on
both the draggable wrapper (`week-view.tsx:161`, whose entire class list is
`shift-card`) and the card inside it, which carries the border, the colour and
the click handler. Time off has no wrapper and matches once. Filter on
`border-2` for the card, `.not('[class*="border-2"]')` for the wrapper — the
wrapper owns the cursor and the already-clocked guard, the card owns everything
else. Clicking the wrapper does **not** open the edit modal.

**`DroppableCell` never puts its id in the DOM** — dnd-kit keeps it internally —
so grid cells are found by their `min-h-[60px]` layout class, indexed 0–6 from
Monday within a member's `.contents` row.

**`ToggleSwitch` renders a label span next to the `<button>` that toggles.**
Clicking the words "Multiple Days" does nothing; click the button beside them.

**Read the label through a normalising `should`**, not `have.text` — it is the
only readout of where you are, and JSX whitespace around the expression is not
guaranteed:

```ts
sel.label().should(($el) => {
  expect($el.text().replace(/\s+/g, " ").trim()).to.eq(expected);
});
```

## Copy week reports no value at all

Its placeholder option is `disabled hidden`, so Chrome refuses to make it the
selected option: the select *displays* "⧉ Copy week" while `.val()` returns
`null`, not `""`. Assert `invoke("val").should("not.be.ok")` for "nothing
chosen"; `have.value` never passes.

## known-defects.cy.ts

Every test in that file **fails on purpose**, exactly like its CRM and clinical
counterparts. A test there turning green means the bug is fixed: move it into
the spec that owns the area rather than deleting it. Never weaken an assertion
to match the code.

The ten:

1. **The Confirm Copy Week banner names the wrong week east of Greenwich.**
   `week-view.tsx:649` formats `addDays(copyFromWeek, 1)`, where `copyFromWeek`
   is already the Monday the user picked. The string parses as UTC midnight and
   formats in local time, so the stray `+1` cancels the westward shift and reads
   correctly in the Americas — while London and Bengaluru are asked to confirm
   "the Sep 1, 2026 week", a Tuesday, which is not a week start at all.
2. **End Date's floor never follows the Start Date.** In a multi-day time off,
   `min={nextStartDate}` is computed once from the **cell's** date plus one
   (`time-off.tsx:302`), so picking a later Start Date does not move it.
3. **A backwards range reaches the network.** `TimeOffSchema`'s `superRefine`
   checks that both dates are *present*, never their order, so Start 20 Sep /
   End 15 Sep clears validation, `while (current <= endDate)` never runs, and
   the app POSTs an empty array.
4. The same defect stated so it survives a partial fix: if a range is going to
   be sent at all, it must contain at least one day.
5. **"Hoilday" is misspelled** (`constants.ts:447`) in the label a scheduler
   reads…
6. …and in the value written to `unavailability_reason`, which is the half that
   needs a migration. Fixing the label alone splits holiday reporting across two
   spellings.
7. **The pay-period date picker cannot be cancelled.** An effect calls
   `onChange` the instant `tempRange` has both ends (`date-picker.tsx:115`), so
   the page is re-queried on the **second date click**, before any button is
   pressed. Cancel is only `setIsOpen(false)` (`:846`), so it closes the popup
   and undoes nothing — and never restores `tempRange` either, so even the box
   keeps the abandoned range. A scheduler who misclicks and presses Cancel has
   silently changed the pay period they are reviewing.
8. The same defect from the data side: the table must still be reporting the
   period the user was on after they cancel.
9. And the cause stated without Cancel at all — choosing two dates must not be
   enough; **Apply** should be what changes the period. That also makes
   `applySelection` meaningful again: today it re-sends a range the effect has
   already applied, which is why Apply looks like it works.
10. **Cancel on a Care Team member's Personal Information saves the edit.**
    `Button` defaults to `type="submit"` (`button.tsx:23`) and that Cancel does
    not override it (`contact-information.tsx:175`), so a click closes the
    editor *and* submits the form. The Job Details card two directories away
    passes `type="button"`, which is what makes this an oversight rather than a
    decision. One prop fixes it.

Defect 1 cannot be observed west of Greenwich, where the two errors cancel. Its
test asserts the invariant and then **fails loudly with an explanation** rather
than passing silently — the same treatment the clinical UTC defects get. Run it
with `TZ=Europe/London` to see it fail for the real reason.

## Add Team Member is the CRM's Add Care Lead

The button below the schedule grid (`week-view.tsx:1082`) dispatches
`handleOpenAddPCGModal`, and the dialog that answers lives in `nav.tsx:369` —
the same `AddPCG` form the CRM sidebar opens. Nothing about it is
scheduling-specific, and three things follow from that:

- **The button and the dialog disagree.** "Add Team Member" opens
  **"Add Care Lead"**, and what it creates is a `PCGLead` — not a `PCG`, and
  not anything attached to the schedule.
- **A successful save navigates out of the module.** `add-pcg.tsx` ends with
  `router.push("/crm/pcg")`, so adding a team member from the schedule board
  drops the user on the CRM care-lead board. A *failed* save stays put.
- **The modal is rendered by `nav.tsx`**, not by the schedule, so it survives
  independently of anything in `week-view.tsx`.

What `CreatePCHOOrPCGLeadSchema` actually allows is narrower than it looks:

| Field | Rule |
| --- | --- |
| First / Middle / Last | `/^(?=.*[A-Za-z0-9])[A-Za-z0-9 ]+$/` — letters, digits, spaces |
| Email | anchored regex, validated **before** the handler's `.trim()` |
| Phone | digits only, **exactly** 10 — nothing is stripped first |

So "Shaw-Bean" and "O'Brien" are rejected as names, `(555) 123-4567` is rejected
rather than normalised (unlike `phoneDigits10` elsewhere in the codebase), and a
pasted email with a stray space is refused rather than trimmed — the
`email?.trim()` in `handleSubmitPCGData` is dead code for that case, though the
`.toLowerCase()` beside it still works. All pinned `[as-built]`.

The form's onboarding-document lookup (`createDocumentObjectsFromS3Folder`) hits
`/api/s3/list-objects` and returns `[]` on any failure, so it never blocks a
save; it is stubbed only to keep the payload deterministic.

## Timesheets — Daily review

Two tabs, each behind its own permission, so the role decides which you land on:

| Role | Daily review | Pay period review |
| --- | --- | --- |
| PCHO | ✓ | ✓ |
| HomeAdmin | ✓ | — |
| PCG | — | ✓ |

A row is **one shift, not one member** — the same person appears twice if they
are scheduled twice that day. Rows come from `GET /v1/hcm/shifts` narrowed to the
selected day, `shift_status=available`, the home, and the ids of every
non-deleted PCG and HomeAdmin.

**The board queries twice.** Once on first paint with no team ids at all, and
again once the PCG and HomeAdmin lists resolve. Any assertion about the query
must therefore go in a retrying `should` over `@getShifts.all`, never a `then`
over `@getShifts` — a single `cy.get` on a route alias yields whichever
interception happens to be unconsumed, and returns `null` often enough to look
like a real failure. `cy.assertAuthorized` has the same problem here; assert the
header across all interceptions instead.

### The three lines in "Worked"

`processShiftTimes` builds all of them:

| Line | Rule |
| --- | --- |
| Worked | `h:mm a – h:mm a`, `--:--` per side when not clocked |
| Scheduled | same format, always rendered |
| Difference | only when **all four** timestamps exist, and only when non-zero |

So a shift worked exactly to schedule shows **no third line**, and neither does
one still open. The text reads "N min under/over scheduled time" with hours
folded in ("1 hr 30 min") and "hrs" only past one hour.

### The date button

A visible div with a transparent `input[type=date]` over it. `max={today}` is the
entire no-future-dates rule — assert the attribute rather than trying to drive
the native picker, and type into the input with `{ force: true }` since it is
`opacity-0`.

### The Edit Time Card modal

Fields are `input[type=time]`, whose DOM value is 24-hour (`14:00`) whatever the
browser displays. What goes on the wire is the **shift's** date joined to that
time and converted to UTC, so assert the local rendering of what was sent, never
a hardcoded `Z` string.

`Clocked Out` is `disabled` whenever `Clocked In` is empty — and it is a genuine
`disabled`, unlike `InputFieldComponent`'s readOnly mapping elsewhere. Two
consequences for tests: clear the **later** field first, and a clock-out-with-no-
clock-in card cannot be built at all, which is what really enforces that rule
(the `handleSubmit` guard for it only runs for a caregiver editing their own
card).

Validation worth knowing: clock-out equal to or before clock-in is refused —
*unless* the editor is not a caregiver **and** the schedule itself is overnight,
in which case the earlier clock-out is read as the next day.

**Scope the modal's identity lines.** "Teju Carelead" is also in the table row
behind the modal and "Care Team" is also a sidebar link, so an unscoped
`cy.contains` finds the wrong one. Go through the name, which is unique:
`cy.get('div[class*="text-[24px]"]')`.

### No Shift Notes field

The Edit Time Card modal renders the date, the member, Clocked In / Clocked Out,
the read-only Scheduled line and Save changes — **nothing else**. There is no
notes field in `edit-time-card.tsx`; "Shift Notes" exists only in the scheduling
board's Add shift form. Nothing is asserted about notes in the daily review spec.

## Timesheets — Pay period review

Where the daily review is one row per shift, this is **one accordion per
person** (`_.groupBy(shifts, "user_id")`). The header totals cover that person's
shifts in the range; the expanded table is one line per shift.

**The accordion is MUI, so collapsed content stays mounted.** Assert
`be.visible` / `not.be.visible`, never `exist` / `not.exist` — the same rule the
clinical suite follows. Only one may be open at a time: `toggleSection` shuts
every other section before opening the clicked one.

### Three different ways of saying "nothing"

| Case | Header | Row |
| --- | --- | --- |
| Monthly pay | `NA` | `NA` |
| Hourly, never punched | `$0` | `-` |

Monthly hides the money, not the time — Timecards and Total Hours are still
counted for a monthly-paid member.

### "Actual vs. scheduled" is not a comparison

Despite the column name it renders `getHoursDifference(clock_in, clock_out)` —
the hours actually worked, with the schedule nowhere in the expression. A shift
nobody punched shows `0` there even when two hours were scheduled. Pinned
as-built.

### The range picker

A custom two-month calendar, not a native input. Everything in it is reachable
by `aria-label`: `Open date picker`, `Date range calendar`, `Select month`,
`Select year`, `Previous month`, `Clear selection`. Day cells are buttons inside
the two `div.p-3` panes, indexed 0 (left month) and 1 (right).

Clicking a day starts a range, a second click completes it (and is reordered if
you click the later day first), and **Apply** is the only thing that tells the
page — it stays `disabled` until both ends are set. The ✕ clears the range
entirely, which **drops `shift_start_time` from the query** and asks for every
available shift in the home.

**Neither Apply nor Cancel does what it says.** An effect fires `onChange` as
soon as `tempRange` has both ends, so the range is applied on the **second date
click** — Apply merely closes the popup and re-sends what was already sent, and
Cancel undoes nothing. The as-built behaviour is pinned in the spec (`applies a
range the moment the second date is clicked`, `cannot be cancelled once both
dates are chosen`); the failing tests for the intended behaviour are defects
7–9 in `known-defects.cy.ts`.

### Export Excel

`exceljs` + `file-saver`, so it is a real download: assert
`cypress/downloads/PayPeriodReview_<M-D-YYYY>_<M-D-YYYY>.xlsx` exists and starts
with the zip magic bytes `PK` (`0x50 0x4b`) — every `.xlsx` is a zip.

**Wait for the button to enable before clicking.** It is
`disabled={isLoading || !usersReady}`, and `usersReady` needs every user behind
a shift, fetched one at a time in an effect *after* the shifts land. Clicking
early is a silent no-op that only shows up later as a missing file.

**`pay_rate` must be a string in fixtures.** `calculateTotalWages` does
`pay_rate.replace(...)` on the override it is handed, and the export hands it
`roaster[0].pay_rate`. A numeric rate therefore throws inside `handleExport` —
which has no catch — and the download simply never appears, with nothing in the
UI to say why. Everything else in the codebase treats the rate as a string, so
the fixtures do too.

## Dashboard

`/hcm` renders **one of two dashboards** depending on the role:
`HCM_EMPLOYER_DASHBOARD` (PCHO, HomeAdmin) or `HCM_EMPLOYEE_DASHBOARD` (PCG). A
role with neither is pushed to its own initial route — not shown Access Denied,
so `cy.assertRestricted()` is the wrong assertion for that case.

**Which tab a shift lands in.** The board fetches a two-day window — yesterday
and today — and sorts it:

| Tab | Rule |
| --- | --- |
| Completed | clock-in **and** clock-out set, **and** clocked out today |
| Now & Upcoming | anything not completed that starts today **or ends today** |

That second clause keeps a night shift begun yesterday on the board, labelled
"Started yesterday at …". A shift carrying `isOverlap` is dropped from both tabs
before either rule runs, so a conflict disappears rather than being flagged.

**Paid Hours and Wages count completed shifts only** — a shift still running
contributes nothing. Wages is additionally gated on `role === PCHO`, so a
HomeAdmin sees the employer dashboard with Paid Hours but no money.

**The ⋮ menu is one action wearing two labels.** "Add Clock In" and "Add Clock
Out" both dispatch the same `handleOpenEditTimeCardModal(shift)`; there is no
clock-out-only flow. Each label flips to "Edit …" once that timestamp exists, so
a half-punched shift shows one of each. Pinned as built.

**Needs Review** lists time-off shifts starting today or later whose
`is_unavailability_approved` is still `null`. The whole panel is absent when
there is nothing outstanding, and the card is collapsed on first paint. Approve
and Reject are the same `PUT /v1/hcm/shift/{id}` with a different boolean, and
report "Timeoff Approved/Rejected successfully".

**Two shift queries share one endpoint.** Only the time-off one sends
`shift_status=timeoff`; the working one sends `available` plus the two-day
`shift_start_time` window. That parameter is how a stub tells them apart.

## Care Team

`/hcm/team` is the roster; `/hcm/team/{userId}` is one member behind three tabs.

**The ⋮ menu is a tab picker.** "View job details", "View documents" and "View
personal information" all navigate to the *same* page — the only difference is
which tab they ask for, and that choice goes to Redux (`teamMemberTab`), not the
URL. The route is identical in all three cases, so assert on the tab content,
never the path. Clicking the NAME does the same with a role-dependent default:
`role === "HomeAdmin" ? "Personal Information" : "Job Details"`.

**Saving Job Details is two requests, and neither waits for the other:**

| | |
| --- | --- |
| `PUT /v1/hcm/roaster` | `{ user_id, pay_rate, pay_frequency, home_id }` |
| `PUT /v1/user/{id}` | the whole user, with `contractCompletedOn` |

Each pops its own "Updated Successfully!", so one save produces two popovers —
and a *partial* failure races, because which message survives depends on which
reply lands last. Stub both: a spec that stubs only the roaster lets the user
update escape to the real API.

**What is actually locked:**

| Card | Locked | Editable |
| --- | --- | --- |
| Job Details | `Role(s)` (`disabled`) | start date, wage frequency, wage rate |
| Personal Information | email — *only if one is already stored* | name, mobile, both emergency-contact fields |

That email condition is `readOnly={formState.defaultValues.email ? true : false}`,
so the rule is "an address cannot be **changed**", not "cannot be set" — a member
with no email can be given one here. Pinned as-built.

**Start Date can only move backwards.** `max={defaultValues?.contractCompletedOn}`
is the date already stored, so a start date can be corrected earlier but never
later. Pinned as-built.

**`pay_rate` must be a positive number** (`updateHcmTeamMember`), so 0, a
negative and an empty field are all refused with "pay must be positive".

**A view-only role loses two columns.** `HCM_TEAM_ROASTER` as VIEW rather than
EDIT drops Wage and the ⋮ menu from the table entirely (`filteredTabs`), and
HomeAdmin — which also lacks `HCM_TEAM_JOB_DETAILS` — gets no Job Details tab at
all. Both are useful RBAC fixtures.

**Selector notes.** `FormSelectComponent` prepends its own `"Select"`
placeholder option, so an exact option-list assertion must include it. And the
deleted-member guard puts `pointer-events-none` on the **Button element**, not
on a wrapping div.

## Other as-built oddities, pinned in place rather than treated as bugs

- **Two date formats four lines apart** in the header — see above.
- **Copy week reports `null`, not `""`,** for "nothing chosen" — see below.

## Not covered here

- Deleting a shift, the right-click Copy/Delete menu, and pasting a single
  copied shift ("Finish Pasting" mode).
- Month-view and day-view shift editing; this spec drives the week view.
- In-home-care specific fields (Select Client, Shift Rate), which only render
  when the home type is In Home Care.
- PDF and XLSX **contents** — Print and Export Excel are asserted down to a real
  file with the right name and the right magic bytes, but not what is written
  inside them, in line with the rest of the suite.
