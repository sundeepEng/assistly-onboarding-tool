# Clinical end-to-end specs

Eleven specs, named `<area>-<concern>` so alphabetical order groups them by what
they exercise: the `senior-*` files all cover the senior's own page, and
`seniors-board` covers the list they are reached from. Every spec seeds a
session with `cy.setAuthSession()` and stubs its own endpoints — none of them
talk to a real API.

## What lives where

| Spec | Covers | Tests |
| --- | --- | --- |
| `api-contracts.cy.ts` | `/clinical` request contracts: the seniors query, per-role narrowing, module switch, access boundaries | 21 |
| `care-team.cy.ts` | `/clinical/pcg` — the list, the row ⋮ menu, soft delete, and the FaceSheet tab | 124 |
| `nurses.cy.ts` | `/clinical/nurse` — the list, the row ⋮ menu, soft delete, and the Assign Seniors modal | 105 |
| `senior-careplan.cy.ts` | The Care Plan tab: CRM carry-over, services, housekeeping, vital signs, comments, Care Report | 96 |
| `senior-carousel.cy.ts` | The face strip above the tabs: listing, active senior, switching, arrows, access | 25 |
| `senior-incident-report.cy.ts` | The incident tab, the seven-section modal, and the pre-filled fields | 27 |
| `senior-incident-report-details.cy.ts` | Incident types, optional blocks, edge cases, PDF control, access, journeys | 31 |
| `senior-incident-report-validation.cy.ts` | The ten required fields, phone/zip/email rules, the saved payload | 27 |
| `senior-incident-report-edit.cy.ts` | Editing and deleting a report — the row icons, the prefill, the filtered array | 39 |
| `senior-medication.cy.ts` | Add Medication modal, the Medication tab, and what reaches MedPass | 69 |
| `senior-medpass.cy.ts` | The MedPass round: Pass/Refuse, comments, the date picker, Generate EMAR | 57 |
| `senior-over-the-counter.cy.ts` | OTC doses — the modal, the tab, and their part in the EMAR | 48 |
| `senior-profile.cy.ts` | The profile popup from the grid, and the senior page's tab strip + Bulk toggle | 76 |
| `seniors-board.cy.ts` | `/clinical` — grid and list views, the row ⋮ menu, soft delete | 63 |
| | **Total (must stay green)** | **808** |
| `known-defects.cy.ts` | **Fails on purpose** — executable bug reports | 15 |


## What the stg merge changed (Sept 2026)

Three behaviours moved under `feat/homecapacity`, `feat/edit-incident-report`
and the care-plan casing fix. The specs were updated rather than relaxed — in
each case the NEW behaviour is asserted, and the old assertion is gone.

### Service names are display labels now

`carePlanDataLayer.ts` and `careplan.tsx` both run stored keys through a label
map (`DEFAULT_ADL_FIELDS`, `HOUSEKEEPING_LABELS`, `VITAL_SIGN_LABELS`), falling
back to title-casing the key:

| stored | was | is |
| --- | --- | --- |
| `laundry` | `laundry` | `Laundry` |
| `windowCleaning` | `windowCleaning` | `Window Cleaning` |
| `spO2` | `spO2` | `Sp O2` |

Assert on the label, never the key. `formatKeyLabel` splits on the
lower-to-upper boundary only, so a digit stays attached to its letter — hence
`Sp O2` rather than `Sp O 2`.

### Vital signs are no longer grid rows

They were removed from `serviceRows` on purpose: a vital sign has a READING,
not a provided/not-provided status, so it never belonged in a tick-box row. It
renders in the `vitalSignReadings` detail table below the grid instead, and
several readings on one day are now listed separately rather than joined into
one cell.

### Cells match on the name PART only

A record's `serviceName` is split at `" - "` and only the part before it is
compared, normalised to lower-case alphanumerics. This is deliberate: a record
written while the plan said "Assistance" must still show after the plan is
revised to "Full Assistance", or the month's history vanishes on a plan edit.
Rows are deduped on `category|matchKey`, and a service recorded this month but
since removed from the plan still earns a row.

### The Care Report needs RECORDS, not just a plan

The guard tightened from `rows.length > 0` to

```ts
rows.some(r => r.days.some(d => d.status || d.value))
```

so a month with a plan but nothing recorded now WARNS ("No care plan services
recorded during selected period") instead of producing a blank sheet. The old
"generates a blank sheet" test asserted the opposite and was inverted.

### Incident reports can be edited and deleted

Two icon buttons at the end of every row, covered by
`senior-incident-report-edit.cy.ts`. Both are the same
`PUT /v1/clinical/user/{id}` carrying the whole clinical record — an edit
replaces one entry in `clinical.incidentReport`, a delete filters it out — so
asserting on the ARRAY in the request body is the only way to tell them apart.

Two traps worth knowing:

- The details field is prefilled but sits inside the **collapsed**
  "Resident(s) & Incident Details" accordion. It is in the DOM and not visible;
  expand the section before typing.
- The edited entry is rebuilt into the API shape, where the field is
  `incidentDetails`. `detailsOfIncident` is the FORM's name and does not
  survive the save — untouched entries keep whatever shape they already had,
  so one payload can carry both spellings.

A deleted senior gets `pointer-events-none` on the delete icon rather than
`disabled`, and `handleDeleteClick` returns early as well.

## Running them

```bash
# everything that must pass — note known-defects is excluded
npx cypress run --spec "cypress/e2e/clinical/!(known-defects).cy.ts"

# one area
npx cypress run --spec "cypress/e2e/clinical/senior-*.cy.ts"

# one spec
npx cypress run --spec cypress/e2e/clinical/senior-medpass.cy.ts

# the bug list, on its own — expected to be red
npx cypress run --spec cypress/e2e/clinical/known-defects.cy.ts
```

`cypress/e2e/clinical/*.cy.ts` picks up `known-defects.cy.ts` too, so it will
always report failures. Use the negated glob above for a pass/fail gate.

### Why the incident report is three files

`senior-incident-report{,-validation,-details}.cy.ts` were one 85-test file that
took **56 minutes**. Split into three, with one fixture change, the same 85
tests run in **~7.5 minutes**. Two independent causes, both worth knowing before
writing another form-heavy spec:

**1. Page visits per browser session.** Every test re-visits the page and
re-opens the modal. Cost climbed with a test's *position* in the run: the same
test took ~7 s in isolation, ~22 s alone in the real spec, and ~48 s late in the
run. Splitting the file cut each session from ~85 visits to ~27 and the tail
disappeared.

**2. Keystrokes.** The form revalidates its whole seven-section Zod schema on
every character, so runtime scales with characters typed — not with the number
of commands. In the validation spec, read-only tests ran in ~650 ms while typing
tests took 63–67 s, and `accepts a very long description` was among the slowest
in the file. `fillRequired` now types with `{ delay: 0 }` and its default
description is four characters; tests that genuinely need long text still use
it.

Measured, in order:

| | Passing | Failing | Runtime |
| --- | --- | --- | --- |
| One file | 72 | 12 | 56 min |
| Three files | 78 | 7 | ~26 min |
| Three files + short typing | 85 | 0 | ~7.5 min |

**`numTestsKeptInMemory=0` was NOT the cause.** It was tried first and appeared
to work, because the early tests of the new run were compared against the late
tests of the old one — early tests were always fast. Keep that in mind when
measuring this suite: compare like for like, or the numbers will agree with
whatever you already believe.

If a form-heavy spec starts taking tens of seconds per test, look at how much it
types and how many times it visits the page, in that order.

If Cypress refuses to start from a VS Code terminal, unset `ELECTRON_RUN_AS_NODE`
first — VS Code sets it, and the Cypress binary reads it as "run me as plain
Node" and exits without opening a browser.

### If a whole spec fails at `cy.visit`, restart the dev server first

Two separate infrastructure failures have masqueraded as broken specs:

- **The server was not running.** Cypress retries four times, then exits 1
  having run **nothing**. The output looks like a catastrophic failure but
  contains no test results at all — check for "Cypress could not verify that
  this server is running" before believing any of it.
- **The server was running but had degraded.** After a long session of HMR
  cycles, `next dev` began returning **404 for `/clinical/{seniorId}`** while
  still serving `/clinical` with a 200 — a route it had served correctly
  earlier in its own life. Every test in a spec failed in its `beforeEach`.
  `taskkill` on the dev server and a fresh `npx next dev` fixed it.

The tell for both: failures in *every* `describe` at once, all in `beforeEach`,
with `cy.visit` in the stack. No spec change causes that.

## known-defects.cy.ts

Every test in that file **fails on purpose**, exactly like its CRM counterpart.
A test there turning green means the bug is fixed: move it into the spec that
owns the area rather than deleting it. Never weaken an assertion to match the
code.

The fifteen:

1. **The Medication tab reads the clock in UTC** (`toISOString()`) while MedPass
   reads local (`getYYYYMMDDString()`), so for part of every day the two tabs
   disagree about which courses are current. One-line fix in
   `medication.tsx:184`.
2. The same divergence stated as the invariant that matters: the Medication tab
   should list exactly what MedPass will administer.
3. **The EMAR month dropdown repeats months and skips others.** `emarOptions`
   mutates one `Date` in a loop with `setMonth(getMonth() - i)`, so on the
   29th–31st the short months overflow: five values appear twice and five are
   unreachable. Run on the 31st, five months of records cannot be exported.
4. Stated as the user-facing consequence: the month before last is offered.
5. **`Dosage *` accepts an empty string** — `z.string()` permits `""`, so a
   field that is focused and cleared saves a medication with no dose. Fix is
   `.min(1)` in `clinical.model.ts:21`.
6. And that the user is told why.
7. **Care Plan comments are invisible to a Personal Care Giver.** The section is
   gated on `hasAccess(role, "CLINICAL_CAREPLAN", "VIEW")`, and `hasAccess`
   checks the exact list — EDIT does **not** imply VIEW. A PCG holds it as EDIT
   only, so the carer who works the round cannot leave a note about it.
8. The same gate hides comments from PCHO, which holds
   `CLINICAL_COMMENTS_HISTORY_EDIT` — a permission to edit historical comments
   it can never reach. That mismatch is the clearest evidence the gate is wrong.
9. **The Care Report month dropdown repeats months**, the same bug as 3 in a
   second place (`clinical-tabs.tsx:210`, `carePlanOptions`). Fixing one site
   and not the other leaves half the defect in place.
10. **The Care Team FaceSheet name field cannot hold a space.** Its value is
    re-derived through `toTitleCase()` on every render
    (`care-team-face-sheet.tsx:696`), and `toTitleCase` trims and collapses
    whitespace — so the space is erased before the next character is typed and
    "Maurice Olsen" is entered as "Mauriceolsen".
11. The consequence that matters: `buildUpdatePayload` runs `splitName()` over
    that value, so correcting a surname from the FaceSheet saves a one-word
    name and a `firstName` that swallowed the surname.
12. **A successful save does not clear the "Unsaved changes" bar.**
    `markCurrentAsClean()` assigns `initialRef.current` (`inline-form.tsx:128`)
    but `isDirty` is `useMemo(..., [values])` (`inline-form.tsx:132`) and never
    watches that ref, so marking the form clean is a no-op for the UI. It is
    masked whenever the post-save refetch happens to return a different record,
    which is why the test stubs the refetch to echo the record back unchanged.
13. **A discharged senior stays assigned to their nurse, namelessly.** The two
    halves of Assign Seniors disagree about deleted seniors: `All Seniors`
    filters `isDeleted` (`assign-users-modal.tsx:155`), so there is no record
    left to resolve a name from, while `Currently Assigned` maps over the raw id
    list and falls back to `{ userId, name: "" }` (`:194`) — a chip with an
    avatar, a × and no name, counted in the "N seniors" badge. Every nurse who
    cared for a discharged resident shows an overstated caseload.
14. The same defect stated as the chip the user actually sees.
15. And the consequence that outlives the screen: `selectedUserIds` still holds
    the id, so **every** save writes the discharged senior back onto the record.
    The assignment can never age out on its own. Filtering only the chip would
    fix 13 and 14 and leave this one — the fix belongs in
    `coerceInitialSelectedIds` or `currentlyAssigned`.

Defects 1 and 2 freeze the clock at an hour where UTC and local dates are
guaranteed to differ, and adapt the fixture to the machine's timezone — so they
fail deterministically rather than depending on when the suite runs. They cannot
express the bug at UTC+0 and say so out loud rather than passing silently.

**Defects 3, 4 and 9 do not have that guard and are green for most of the
month.** The rolling-`setMonth` overflow only manifests on the 29th–31st, so on
any other date those three tests pass — which reads, wrongly, as "the bug is
fixed". They need the same `cy.clock` treatment as 1 and 2 before the green
means anything.

## Time and dates

More of this module turns on the clock than any other, so:

- **Freeze the clock whenever a test depends on "now".** `senior-medpass.cy.ts`
  pins local noon with `cy.clock(ts, ["Date"])` so the 8:00 AM dose is
  unambiguously actionable and the 8:00 PM one unambiguously early. Without it a
  run at 00:05 finds nothing actionable and one at 23:55 finds everything.
- **Build date fixtures from local time**, matching the app: the modals use
  date-fns `format(new Date(), "yyyy-MM-dd")` and MedPass uses
  `getYYYYMMDDString()`, both local. The one exception is the Medication tab,
  which is UTC — that is defect 1 above, not something to mirror.
- **The date rules are mirror images.** Add Medication floors the start date at
  today (`min`); Add OTC caps the date at today (`max`). One plans a course, the
  other records a dose already given.

## Times in the UI are formatted two different ways

The same instant renders differently depending on where you look:

| Source | 14:00 renders as |
| --- | --- |
| `timeOptions24H` — the timings dropdown | `02:00 PM` (zero-padded) |
| `timeFormat()` — every table | `2:00 PM` (not padded) |

So the string used to pick an option is not the string to assert on afterwards.
Worse, `cy.contains` matches substrings and `"12:00 PM"` contains `"2:00 PM"` —
asking for the latter silently ticks midday. The `chooseTimings` helpers use an
anchored regex against the **padded** label for that reason.

## Shared helpers

Commands and fixture builders live two levels up, in `cypress/support/`:

- `commands.ts` — session seeding (`setAuthSession`, `loginAs`), popover
  assertions, form helpers, the `AppRole` union, and the opt-in `slowMo` demo
  mode (`--env slowMo=400`).
- `module-commands.ts` — endpoint stubs (`stubHome`, `stubUsers`, `stubUser`,
  `stubPut`…), fixture builders, and DOM helpers for the non-semantic table
  (`openRowMenu`, `settleForm`).

`base-table.tsx` renders rows as nested `div`s rather than a real `<table>`, so
there is no `tr`/`role=row` to scope to — row lookups go through the nearest
`border-b` ancestor.

## Conventions

- **Presence over visibility for anything in a scrolling container.** The OTC
  table is wider than the viewport and several modals cap their body height, so
  content near the fold is clipped and Cypress calls it hidden. Assert what is
  mounted; reserve `should("be.visible")` for cases where the user genuinely
  needs to see the thing.
- **Read fields, not labels.** `InputFieldComponent` maps its `disabled` prop to
  `readOnly`, so `should("be.disabled")` never passes however locked a field
  looks — use `have.attr("readonly")`.
- **Assert payloads, not mechanisms.** A test that waits on a request a fixed
  build would never make stays red forever and looks like the bug survived.
- **Assert row ORDER in one pass, inside `should`.** Looking up two rows in
  nested `then`s leaves a re-render window between the queries; the first
  element detaches and its `getBoundingClientRect()` comes back zeroed, so the
  test passes on a fast machine and fails on a slow one. Grab every row with one
  `cy.get`, compare their indices in a `should` callback, and let Cypress retry
  the whole thing. Both soft-delete ordering tests were flaky until they were
  written this way.

## The Care Team FaceSheet

`care-team.cy.ts` covers `/clinical/pcg` and one of a member's two tabs. The
Documents tab is out of scope by agreement; the FaceSheet is the whole of the
rest.

**What is actually editable.** The user-facing description of this screen is
"everything except the name and the role". The code disagrees on half of that:

| Field | As built |
| --- | --- |
| Name | **Editable** — an `InlineInput` like any other |
| Role | Read-only — plain text, no input |
| Email | Read-only — plain text, no input (not mentioned in the description) |
| Mobile, emergency contacts, compliance answers, documents | Editable |

So role is the only identity field the FaceSheet holds back, and email is
read-only without anyone having asked for it. The spec pins all four as built
and marks the name tests `[as-built]`; the two defects the name field *does*
have (it cannot hold a space, and that corrupts what gets saved) are in
`known-defects.cy.ts`, not softened here.

**Documents are staged, never uploaded on pick.** Choosing a file only sets
`status: "new"` and renders `Pending upload: <name>`; removing a stored one sets
`status: "remove"` and renders `Will be removed (pending)` with an undo. Save is
the only thing that presigns, PUTs to S3, deletes from S3, and PUTs the user.
Tests that assert "nothing was sent yet" use `cy.assertNoRequest`, which has the
500 ms settle.

**The Save bar is asserted on presence, not visibility.** It is `sticky` inside a
`position: fixed` ancestor, so whether it is "visible" depends only on how far
the page happens to be scrolled — `be.visible` passed or failed test by test for
that reason alone.

**The refetch has to differ for the form to reset.** React Query's structural
sharing hands the component back the *same* object when a refetch is deeply
equal to what it already had, and the FaceSheet's `isDirty` cannot clear itself
(defect 12). So a test that expects the Save bar to go away after saving must
re-stub `GET /v1/user/{id}` with the saved record first — a stub that echoes the
old record leaves the bar up, which is real behaviour, not a test artifact.

**Print.** `printFaceSheetOnly` replaces `document.body.innerHTML`, calls
`window.print()`, restores it and then calls `window.location.reload()`. Stub
`window.print` and assert immediately; the reload lands afterwards and is
harmless as the last command in a test.

## Nurses and Assign Seniors

`nurses.cy.ts` covers `/clinical/nurse`. The board is the Care Team board with a
different query behind it, so the list, the soft delete and the greyed-out
Onboard behave identically — what is new is the ⋮ menu and one modal.

**The menu has three entries, not five.** Onboard, Assign Seniors, Delete.
`Initiate e-sign` is commented out in `nurse-action-cell.tsx`, and
`Move to Clinical` is gated on `data.role === "NurseLead"`, which a clinical
Nurse is not. Assign Seniors is the mirror image — gated on
`router.pathname.startsWith("/clinical")` — so it appears here and nowhere else;
the CRM half of that gate is already pinned in
`cypress/e2e/crm/care-and-nurse-leads.cy.ts`.

**Assign Seniors is two views of one array.** `selectedUserIds` drives both
sections: Currently Assigned renders a removable chip per id, All Seniors
renders a checkbox per fetched senior and ticks the ones in the array. Ticking a
box adds a chip; clicking a chip's × unticks the box. Every test asserts both
ends, because either can drift from the other.

Nothing is sent until **Save Changes**, which PUTs the whole nurse record with
`associatedUserIds` replaced — there is no dirty check, so pressing Save without
touching anything still re-sends the current assignment. **Cancel** discards
everything: the modal reloads its selection from the row each time it opens, so
reopening after a cancel is the assertion that proves nothing stuck.

**Selectors.** The seniors list is `max-h-[320px] overflow-y-auto`, so rows below
the fold are clipped — assert `contain.text` on the list rather than
`be.visible` on a row. Checkboxes carry the senior's `userId` as their `name`
attribute, which is the only stable hook in the modal:
`input[type="checkbox"][name="${seniorId}"]`.

**Strings that say "Nurse Lead" on the Nurses board.** An empty list reads
"No Nurse Leads added yet."; deleting offers to "permanently delete this Nurse
Lead" and reports "Nurse Lead deleted successfully!" — while performing a soft
delete. All three are as built and pinned with `[as-built]` rather than matched
silently. The name cell is likewise inert: `navigateToNurse` exists in
`nurse-cell.tsx` but its `onClick` is commented out, so a nurse row does not
open.

**A deleted senior who is still assigned keeps a nameless chip**, and Save
re-sends the id. That is a bug rather than a decision, so it is not pinned here
— defects 13–15 in `known-defects.cy.ts` assert the intended behaviour and fail.

## Reports are built from the plan, not from the records

Both report layers ask "was anything **prescribed** this month", not "was
anything **done**":

- `emarDataLayer.ts:149` warns only when `result.emar` is empty, i.e. no
  medication was *active* in the month. A prescribed course with no doses
  recorded yields a blank MAR sheet — a real clinical artifact, not an empty
  report. (It used to check `medPassMap.size`; the OTC rewrite changed it.)
- `carePlanDataLayer.ts` builds its rows from the CRM care plan, so a senior
  with a plan and no recorded services still produces a sheet. Only a senior
  with **no care plan at all** gets "No care plan services recorded during
  selected period".

Tests that expected the old "nothing was done → warn" behaviour were updated
rather than pinned as defects: the new rule is deliberate and better.

## Not covered

- **PDF generation.** The EMAR and Care Report tests stop at their modal. That
  an OTC dose *reaches* the EMAR is asserted indirectly — a senior with only an
  OTC dose can still generate a report — but whether the PDF prints an OTC row
  is only observable by reading the PDF.
- **E-Sign PDF**, for the same reason.
- **The CRM → Clinical hand-off end to end.** `senior-careplan.cy.ts` asserts
  the Clinical Care Plan renders a CRM-shaped `carePlan` correctly, which is
  where entries actually get dropped. It does not drive the CRM Careplan form
  and Move to Clinical first — there is no copy step between them (the plan
  lives on the user record and the move only re-roles it), but the CRM form's
  own output shape is taken on trust.
