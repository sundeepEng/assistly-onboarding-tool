# CRM end-to-end specs

Ten specs, named `<board>-<concern>` so alphabetical order groups them by the
board they exercise. Every spec seeds a session with `cy.setAuthSession()` and
stubs its own endpoints — none of them talk to a real API.

## What lives where

| Spec | Covers | Tests |
| --- | --- | --- |
| `api-contracts.cy.ts` | Cross-cutting request/response contracts: payload shape, auth headers, error-status handling | 29 |
| `care-and-nurse-leads.cy.ts` | `/crm/pcg` and `/crm/nurse` — both boards, their Add New forms, and their row menus | 70 |
| `compliance-guests.cy.ts` | `/crm/complianceguest` — the list, Onboard, Delete, and the compliance-partner gate | 53 |
| `referral-agents.cy.ts` | `/crm/referral` — board, Status dropdown, Export Referrals, row menu, Add/Edit, campaign history | 65 |
| `senior-leads-board.cy.ts` | `/crm` — the table, milestone filter, Add Lead, access control | 46 |
| `senior-leads-bulk-campaign.cy.ts` | The three-step Send Bulk Campaign wizard, plus Campaign History | 112 |
| `senior-leads-home-tour.cy.ts` | The house milestone icon — scheduling, status, rescheduling | 81 |
| `senior-leads-onboarding.cy.ts` | The handshake milestone — Biography, Medical and Careplan tabs | 141 |
| `sales-dashboard.cy.ts` | `/crm/sales-dashboard` — the director view: cards, per-rep table, funnel, loss analysis | 67 |
| `senior-leads-row-actions.cy.ts` | The row ⋮ menu: Onboard, Move to Clinical, Initiate e-sign, Lost, Delete | 65 |
| | **Total (must stay green)** | **729** |
| `known-defects.cy.ts` | **Fails on purpose** — executable bug reports across all of the above | 17 |


## Home capacity refuses a Move to Clinical

Added with `feat/homecapacity` (`components/lead-action-cell.tsx`). A home can
only hold so many residents, and the refusal is expressed through the STATUS
CODE rather than the message:

| response | what happens |
| --- | --- |
| **409** | the confirmation modal stays open, retitled **"Home Capacity Reached!"**, showing the API's own message and a **Contact Support** link |
| anything else | the menu closes and the usual error popover appears |

Both halves of the move can raise it. The clinical PUT runs first, and the CRM
PUT only runs inside its `onSuccess` — so a 409 on the first leaves the lead
untouched, while a 409 on the second leaves it half-promoted with the clinical
record already written. Both are covered.

Two details the tests pin:

- The message arrives with a literal `
`, which the component converts to a
  real newline for `whitespace-pre-line`.
- `!Array.isArray(apiError) && apiError` — a validation ARRAY is discarded and
  the generic "Clinical update failed" is shown instead.

## Running them

```bash
# everything that must pass — note known-defects is excluded
npx cypress run --spec "cypress/e2e/crm/!(known-defects).cy.ts"

# one board
npx cypress run --spec "cypress/e2e/crm/senior-leads-*.cy.ts"

# one spec
npx cypress run --spec cypress/e2e/crm/referral-agents.cy.ts

# the bug list, on its own — expected to be red
npx cypress run --spec cypress/e2e/crm/known-defects.cy.ts
```

`cypress/e2e/crm/*.cy.ts` picks up `known-defects.cy.ts` too, so it will always
report failures. Use the negated glob above for a pass/fail gate.

## Demoing

Tests run too fast to follow. `--env slowMo=<ms>` pauses after each command a
viewer can see — `visit`, `click`, `type`, `check`, `select` and friends:

```bash
npx cypress open --env slowMo=400
npx cypress run --headed --env slowMo=400 --spec cypress/e2e/crm/senior-leads-board.cy.ts
```

`--headed` matters more than the delay: headless Electron renders nothing to
watch. `cypress open` also lets you scrub back through the command log, which is
often a better demo than slowing the run down at all.

Measured on `senior-leads-row-actions.cy.ts` (49 tests), back to back:

| slowMo | Result | Duration |
| --- | --- | --- |
| 0 | 48 passing | 58s |
| 800 | 48 passing | 2m44s |

So roughly +2.2s per test at 800ms — about three visible commands each. 300-500ms
reads well for an audience without tripling the runtime.

Off by default (`slowMo` unset means 0), and the command wrapping is skipped
entirely in that case, so CI and normal runs are untouched. The implementation
is in `cypress/support/e2e.ts`; the pause deliberately goes *after* each command,
because pausing before one lets the app re-render and detach the element the
command was about to act on — that broke 21 of 46 tests when it was tried.

If Cypress refuses to start from a VS Code terminal, unset `ELECTRON_RUN_AS_NODE`
first — VS Code sets it, and the Cypress binary reads it as "run me as plain
Node" and exits without opening a browser.

## known-defects.cy.ts

Every test in that file **fails on purpose.** Each asserts the behaviour the UI
advertises — the count it shows, the limit it prints, the action its label
promises — against code that does something else. They are executable bug
reports.

A test there turning green means the bug is fixed: move it into the spec that
owns the area rather than deleting it. Never weaken an assertion to match the
code. If the current behaviour turns out to be intended, delete the test and
record the decision in the owning spec — as was done for Nurse Leads having no
Initiate e-sign, which is deliberate and is pinned as such in
`care-and-nurse-leads.cy.ts`.

The seventeen, by area:

**Send Bulk Campaign** (6)

1. Review counts only reachable recipients, but the send ships every selected
   lead — including ones with no email and no phone.
2. An email campaign can be sent with an empty subject line.
3. The Email composer advertises a 320-character cap it never enforces.
4. Clicking the already-active side of the Write Myself / Generate with AI
   toggle flips it, throwing the user into the other mode.
5. In AI mode, Next with no draft blocks navigation and renders no error, so the
   button just looks broken.
6. The audience heading reads "Selected (n)" rather than naming the audience.

**Home Tour** (6)

7. A finished tour cannot be reopened: "No" with unchanged notes hits the
   no-change branch, so the modal closes and nothing is sent.
8. Even when the save fires, the `tour` milestone is only ever added, never
   removed — so the icon stays blue on a tour just marked unfinished.
9. A failed status save closes the modal anyway, discarding typed comments:
   `setIsHomeTourModalOpen(false)` runs outside both mutate callbacks.
10. A failed booking closes the schedule modal too, discarding the chosen slot.
11. A lead with no email is only caught on submit — the button stays enabled
    through the whole form.
12. The banner promises "An invitation will be sent to … at ⟨nothing⟩" for a
    lead that has no address.

**Careplan** (2)

13. A failed ADL save shows the raw axios string ("Request failed with status
    code 500") instead of the API's message, unlike every other tab.
14. Confirming a template saves and jumps to Overall Health, so the services the
    user just added are gone before any care level can be set.

**Care & Nurse Leads** (3)

15. A failed Move to Clinical always says "Not able to complete contract! try
    again later!", discarding what the API actually reported.
16. Moving a Care Lead writes no clinical record — Senior Leads writes one —
    yet still redirects to the clinical board.
17. The delete confirmation renders with a doubled space: "Care Lead  deleted
    successfully!".

## Compliance Guests is gated twice, and never redirects

A compliance guest is an outside auditor given a login that reaches the
Compliance module and nothing else. `CRM_COMPLIANCE_HOME` EDIT is only half the
gate — for a PCHO the page also reads its **own** user record and requires
`isCompliancePartner === true`:

| | Result |
| --- | --- |
| holds the feature + partner flag | the list |
| holds the feature, no partner flag | Access Denied, **no redirect** |
| does not hold the feature | Access Denied, **still no redirect** |

The flag defaults to `false` when absent, so a spec that forgets to set it gets
the restricted card and every list assertion fails for the wrong reason.

**The redirect in this page is unreachable.** Its effect opens with
`if (finalRole !== userRoles.PCHO) { …; return; }`, so a non-PCHO never reaches
the `hasAccess` check or the `router.push` below it — `roleAccess` stays at its
initial `false` and the Access Denied card renders *on* the URL. Every other
screen in the app redirects; this one does not, and the four `[as-built]` tests
in `compliance-guests.cy.ts` pin that.

## "Lost" is sales-only

`lead-action-cell.tsx:489` gates the lost-lead workflow on **both**
`CRM_MARK_AS_LOST` **and** an `isSalesRequired` flag, so the action is absent at
a home that does not run sales even for a role holding the permission.

Setting the `isSalesRequired` cookie in a test does not work: `layout.tsx:44`
refetches the home on every page load and overwrites the cookie with
`home.isSalesRequired ?? false`. The flag has to be on the **stubbed home** —
`senior-leads-row-actions.cy.ts` does this in its `openMenu` helper, and both
states are covered.

## Shared helpers

Commands and fixture builders live one level up, in `cypress/support/`:

- `commands.ts` — session seeding (`setAuthSession`, `loginAs`), popover
  assertions, form helpers. Also the `AppRole` union.
- `module-commands.ts` — endpoint stubs (`stubHome`, `stubUsers`, `stubPost`,
  `stubPut`, `stubDelete`), fixture builders (`buildHome`, `buildUserRow`), and
  DOM helpers for the non-semantic table (`openRowMenu`, `settleForm`).

`base-table.tsx` renders rows as nested `div`s rather than a real `<table>`, so
there is no `tr`/`role=row` to scope to — `openRowMenu` finds the nearest
`border-b` ancestor instead. That is why row assertions look indirect.

## Conventions

- **Presence over visibility for step/state assertions.** Several screens scroll
  their own body (the campaign wizard caps at `60vh`, the ADL review modal at
  `55vh`), so content near the fold is clipped and Cypress calls it hidden.
  Assert what is mounted; reserve `should("be.visible")` for cases where the
  user genuinely needs to see the thing.
- **Derive expected dates from the payload, never from `new Date()` locally.**
  The app stamps UTC and some tables render the UTC calendar date, so a locally
  built expectation disagrees for part of every day east or west of UTC.
- **Hold a response open when asserting a transient message.** Popovers get
  overwritten by the next one; against an instant stub the first can vanish
  before it is read. `req.reply({ delay })` makes it deterministic.
