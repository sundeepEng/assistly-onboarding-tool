# RevOps end-to-end specs

RevOps is the money side of a home: what comes **in** (Billing & Invoices) and
what goes **out** (Payment), against a **Budget** the home runs to.

Routes: `/revops` (dashboard), `/revops/billing-invoice`, `/revops/budget`,
`/revops/payments`.

## What lives where

| Spec | Covers | Tests |
| --- | --- | --- |
| `revops-billing.cy.ts` | The billing screen itself: the invoices query, stats cards, tab strip, entitlement, role gating, API failures | 42 |
| `revops-invoices.cy.ts` | The invoice lifecycle end to end, plus the Residents and Payment History tabs | 193 |
| `revops-payments.cy.ts` | Payroll: pay stubs, the New/Edit Pay Stub form, Process Payment, the Caregivers roster | 409 |
| `revops-budget.cy.ts` | The budget screen: the metrics query, the four stat cards, role gating, the `/revops` landing route | 50 |
| `revops-budget-ledger.cy.ts` | The budget's working tabs: the period bar, Income, Expenses, Thresholds and Alerts | 440 |
| `revops-budget-overview.cy.ts` | The Overview tab: the category cards, the two rings, the two comparisons, the forecast editor | 185 |
| `stripe-onboarding.cy.ts` | `/stripe/onboard` — the onboarding-link POST contract, the error surface, and the missing-email denial | 3 |
| | **Total (must stay green)** | **1322** |

```bash
npx cypress run --spec "cypress/e2e/revops/*.cy.ts"
npx cypress run --spec cypress/e2e/revops/revops-budget-ledger.cy.ts
```

There is no known-defects file for this module yet.

## The invoice lifecycle

```
Create ──▶ DRAFT ──Finalize──▶ DUE ──Mark as Paid──▶ PAID
             │                  │
             └──── Void ────────┴──▶ VOID
                                │
                                └──Adjust──▶ a NEW DUE invoice,
                                             the original VOIDed
```

The ⋮ menu is built from the status, so each state offers a different set:

| Status | ⋮ offers |
| --- | --- |
| DRAFT | Edit Invoice, Finalize Invoice, Void Invoice |
| DUE / OVERDUE | Adjust Invoice, Mark as Paid, Void Invoice |
| PENDING_APPROVAL | Received Payment |
| VOID | **no menu at all** |

**Every transition is the same `PUT /v1/revops/invoice/{id}`** carrying the
whole invoice with a new `status` — there is no finalize or void endpoint. A
spec that stubs only the GET lets all of them escape to the real API.

**Void asks for no confirmation.** One click on a menu entry voids the invoice
outright, unlike deletes elsewhere in the app.

## Two things the list decides for itself

- **OVERDUE is derived, never stored.** A `DUE` invoice whose `due_date` has
  passed renders as OVERDUE, and the ⋮ menu treats it exactly like DUE. An
  invoice due *today* is still DUE.
- **PAID invoices are filtered out of the Invoices tab entirely.** They move to
  Payment History. A test that looks for a paid invoice on the first tab will
  never find it.

## The flows that are two requests

Three places fire a second request only after the first succeeds. Stub both, and
assert the ordering — it is the whole point in each case.

| Flow | First | Then |
| --- | --- | --- |
| Adjust | `POST` the replacement (status `DUE`, `parent_invoice_id`) | `PUT` the original to `VOID` |
| Mark as Paid | `POST /v1/revops/payment` | `PUT` the invoice to `PAID` |
| Create from a draft | — | `PUT` instead of `POST` (see below) |

**Adjust has three outcomes, not two.** If the create fails, the original is
left alone. If only the *void* half fails, the message is deliberately different
— "Adjustment created but failed to void original invoice." — because the home
now has two live invoices for one period and someone has to void one by hand.

**Adjust refuses a no-op.** Identical items, notes and due date produce "No
changes made…" and no request at all.

## Create quietly becomes Update

Choosing a resident + billing period that **already has a DRAFT** flips the
modal: the title becomes "Update Draft Invoice", a yellow banner explains why,
the existing items load, and submitting `PUT`s the existing invoice instead of
`POST`ing a new one — keeping the original `invoice_item_id`s. Changing either
selection flips it back to Create. This is easy to miss and easy to break.

## The clock must be frozen

The billing-period options are the current month and the two before it, and the
default due date is the 15th of next month (`getDefaultDueDate`). Both move with
the wall clock, so every test freezes at **Mon 14 Sep 2026**:

```ts
cy.clock(FROZEN_NOW, ["Date"]);
cy.visit("/revops/billing-invoice");
```

## The Residents tab

One card per resident **at the CONTRACT milestone** — a different query from the
Invoices tab, which asks for all seniors. Each card carries three figures
computed from that resident's invoices:

| Figure | How |
| --- | --- |
| Monthly Rate | `senior.monthly_rate` |
| Total Paid | sum of that resident's `PAID` invoices |
| Outstanding | `DUE total − PAID total` |

Two as-built consequences, both pinned:

- **Monthly Rate is always $0.** `residents.tsx` maps only id, name, room,
  status and image — `monthly_rate` is never populated, so every resident in
  every home reads $0.
- **Outstanding goes negative as soon as anything is paid** — not only on an
  over-payment. `DUE total − PAID total` leaves nothing on the DUE side once an
  invoice settles, so a paid $550 invoice reports the resident $550 in credit
  rather than square. The sign lands after the symbol: `$-550`.

Drafts and voided invoices are excluded from both figures — only a finalized
invoice is money owed.

**New Invoice on a card** opens the same Create Invoice modal with that
resident pre-selected (`selectedResident`); everything else is identical.

## The Payment History tab

Asks the API for `status=PAID` directly rather than filtering client-side, so
the query itself is worth asserting. It is a record, not a worklist — no row
actions at all. Empty state: "No payments received yet for this month."

## Payment: money going out

`/revops/payments` is gated on **`REVOPS_PAYROLL` EDIT alone** — unlike Billing
it never checks the home's `authorizedModules`, so a home without the RevOps
licence still reaches it. Only PCHO sees the screen below: PCG holds the same
permission but gets `PCGMyPayroll` (their own pay) instead, and HomeAdmin, Lead
and Senior are redirected away.

### The pay stubs query

`GET /v1/revops/payout?home_id=…&period_start_date=<1st>&period_start_date=<last>`
— two values for one key, so assert with `searchParams.getAll(…)`. The month
filter drives the range and nothing is fetched until it is set on mount.

### Hours and rate are never typed

Both fields are `readOnly`. Where they come from is the whole logic of the form:

| Caregiver | Hours | Rate | Base amount |
| --- | --- | --- | --- |
| `pay_frequency: "Monthly"` | ignored | the roster rate, **halved** for a bi-weekly period | that rate, flat |
| one rate across their shifts | summed from clock in/out | that shift rate | hours x rate |
| several rates | summed | sent as **0** | the per-rate breakdown, summed |

The fixed-rate row is the John Sparrow case: zero hours logged, still $1,750
owed. It is the reason the base amount cannot simply be hours x rate.

A shift only counts if it has **both** timestamps, a positive duration and a
non-zero `pay_rate`; anything else is silently skipped.

Two as-built findings, both pinned:

- **The rate field goes stale on switching caregiver.** Nothing resets
  `hourlyRate` when the new caregiver has an hourly roster and no clocked
  shifts, so the previous caregiver's figure stays — reading "Base Pay (0h x
  $1750/h)" for someone paid $12/hour.
- **Edit rewrites a fixed-rate base from today's roster.** The stored
  `hourly_rate_cents` still fills the read-only field, but the base amount is
  recomputed on open, so a raise silently changes what is owed for a closed
  period.

### One modal, two modes

New Pay Stub and Edit Pay Stub are the same component. `mode="edit"`:

- disables all four selects — **only the expenses are editable**;
- returns `undefined` from `shiftsParams`, so **no shifts query runs at all**
  and the prefilled figures survive;
- `PUT /v1/revops/payout/{id}` instead of `POST /v1/revops/payout`, preserving
  `id`, `payroll_payout_id` and `status`.

Existing items are loaded back into the editor except **`amount_cents <= 0`**
(the editor cannot express a deduction) and anything described as **"base
salary"** (case-insensitive). Items already carrying a `payout_item_id` keep it;
new ones get a fresh `crypto.randomUUID()` and `payout_id: 0` in create mode.

Everything is raised as `status: "DRAFT"`, and `payroll_payout_id` is minted
client-side as `PAY-{yyyy}-{mm}-{Date.now()}`.

### Status is binary

`revopsPayStubStatusFromBackend` maps `PAID` to "Paid" and **everything else**
to "Due" — DRAFT, FINALIZED and PENDING are indistinguishable in the table.
`revopsPayStubPeriodTypeFromBackend` is the same shape: anything that is not
`BIWEEKLY` reads as Monthly.

Paid stubs are **not** filtered out of the worklist the way paid invoices are;
they stay in the list with Edit disabled and a paid-on date where Pay was.

### Process Payment

Stripe is preselected and the CTA reads "Pay with Stripe"; choosing **Record
Manual Payment** flips it to "Mark as Paid" and reveals a method select (seven
options, defaulting to Bank Transfer), a reference field, and a read-only
amount. Only the manual path is driven here.

`POST /v1/revops/payment` with `subject_type: "PAYROLL_PAYOUT"`,
`subject_public_id: payroll_payout_id`, `provider: "MANUAL"`, the mapped
`manual_method`, and `manual_reference` — **`null`, not `""`**, when blank.

`handleConfirm` returns silently if `payroll_payout_id` or `pcho_user_id` is
missing: no request, no message, nothing on screen. Both are pinned.

### The Caregivers tab

The home's active caregivers (`isDeleted` filtered out), with `PCG` spelled as
"Caregiver" and the wage suffixed `/month` or `/hour` from
`roaster[0].pay_frequency`. The ⋮ menu is two navigations, not actions:

| Entry | Goes to |
| --- | --- |
| Log Hours | `/hcm` — the Staff Management dashboard, to add a clock in/out |
| Edit Profile | `/hcm/team/{userId}` — that member's Care Team page |

`View Details` and `Deactivate` are commented out in source, as is the whole
**Summary** tab on the payroll screen.


### Deleting a pay stub

Added to stg after the rest of this spec was written
(`modals/delete-pay-stub-modal.tsx`). A fourth row action, withheld from a PAID
stub by the same `status !== PAID` rule that disables Edit.

- The icon's `title` is lower-case `"delete pay stub"` — the app's own
  spelling, not a typo in the selector.
- `useDelete` builds `${path}/${id}` from the row's **numeric `id`**, not from
  the readable `payroll_payout_id` the modal displays. A row without `id`
  refuses to send at all and says "Pay stub ID is missing."
- The confirmation shows the stub id, caregiver, period label, date range
  (`.slice(0, 10)` of the stored dates) and the amount via `toFixed(2)` — so
  no thousands separator, unlike everywhere else in the module.
- `stubWrites()` is per-describe in this spec, NOT part of `visitPayments`.
  A new block that asserts on `@deletePayout` has to call it.

## Budget: the money the home plans with

`/revops/budget` is gated on **`REVOPS_BUDGET` EDIT**, which only PCHO holds —
PCG, HomeAdmin and Senior are all redirected away. Every figure the metrics
endpoint returns is in **cents**.

### One endpoint, two ledgers

Income and Expenses are the same `GET /v1/revops/budget`, told apart only by
`?transaction_type=`:

| Query | Body | Who asks |
| --- | --- | --- |
| `transaction_type=income` | `{ budgets, income_invoice }` | the Income **tab** |
| `transaction_type=expense` | `{ budgets, expense_payroll }` | the **page** |

So the stubs match on the query parameter, not the path:

```ts
cy.intercept(
  { method: "GET", url: "**/v1/revops/budget*", query: { transaction_type: "income" } },
  { statusCode: 200, body: { budgets, income_invoice } }
).as("getIncome");
```

The expense query lives on the page, so it fires on first paint and the Expenses
tab renders from what is already cached. The income query only fires once the
Income tab is opened — which makes `cy.assertNoRequest("@getIncome")` a real
assertion on the Overview tab.

**Register the metrics intercept last.** `/v1/revops/budget/dashboard/metrics`
does not match `**/v1/revops/budget*` today (minimatch's `*` will not cross a
slash), but the later intercept wins in Cypress, so ordering it last keeps that
true if the glob behaviour ever changes.

### Both budget queries fire twice

`selectedPeriod` starts as `""` and is filled in by a mount effect, and neither
query has an `enabled` guard. The first request therefore goes out with no
window at all — and because the serializer stringifies `undefined`, the server
is asked for `?start_date=undefined`. `cy.wait("@getExpenses")` resolves on that
useless call, so every query assertion goes through a retrying helper that picks
the scoped one:

```ts
const scopedExpenses = (startDate = "2026-09-01") =>
  cy.get("@getExpenses.all", { timeout: 10000 })
    .should((calls) => { /* at least one with this start_date */ })
    .then((calls) => calls.find(/* … */));
```

### Two cards share every title

The page header and the Income tab both render a card titled **Total Income**,
and the header's comes first — so `cy.contains("Total Income")` never reaches the
tab's. The tab's card is the only one with a breakdown caption, which makes that
the anchor:

```ts
incomeTotal: () => cy.contains("p", /^\(Billing Invoices/).parent(),
expenseTotal: () => cy.contains("p", /^\(Payroll/).parent(),
```

`Recurring Income`, `One-time Income` and their expense twins are unambiguous.

### The synthetic first row

Both tables prepend a row the user cannot touch: **Billing Invoice** (income
raised through invoicing) and **Payroll** (wages from the pay stubs). Neither
carries a ⋮ menu, and neither is counted in the Recurring/One-time splits —
only in the total, via the breakdown caption. Because that row is
unconditional, `customEmptyMessage` on either table **can never render**.

### Thresholds are not a resource

There is no threshold endpoint. A threshold is a leaf on the home record:

```
home.thresholds[<year>][<monthAbbr>][<category>] = { thresholdName, fixedAmount, isEnabled }
```

Creating, editing and toggling one all `PUT /v1/home` carrying the whole home
back — **with no id in the path**, because they go through `useUpsert` rather
than `useUpdate`. `HOME_PATH_OMIT_FIELDS` (`modifiedAt`, `clinical`,
`lastLoginTimestamp`, `roaster`) is stripped on the way out. Nothing can be
deleted; the only lifecycle is enable/disable.

The month key is a three-letter lower-case abbreviation and the category key is
the lower-cased enum — `thresholds["2026"].sep.groceries`.

### Alerts are derived, never stored

`generateBudgetAlerts` walks every month in the selected window and compares each
enabled cap against `dashboardMetricsData["budget_expense_<category>"] / 100`:

| Condition | Result |
| --- | --- |
| spend ≥ cap | **critical** — "exceeded the budget limit by $X.XX" |
| ≥ 80% of cap | **warning** — "reached N% of the threshold" |
| below 80% | nothing |
| cap ≤ 0, or disabled | nothing, whatever the spend |

Critical sorts above warning. Sitting exactly on the cap is critical, not a
warning, and reports `$0.00` of overspend.

`buildDashboardMetrics()` reports `budget_expense_groceries: 150000` ($1,500) and
`budget_expense_utilities: 90000` ($900), which is what the caps in the spec are
measured against.

### The clock must be frozen

The month options (three ahead, six back), the quarter options (one ahead, four
back), the default period and both modals' default dates all come from
`new Date()`. The ledger spec freezes at **Thu 17 Sep 2026** so "September 2026"
and "Q3 2026" are assertions rather than today's accident. Date *cells* are
still compared against a locally computed expectation — the tables call
`toLocaleDateString()` with no locale, so the format follows the browser's.

### The Overview tab

A read-out, not a worklist — nothing is created here. It pulls **three sources
into one card** and the units differ between them:

| Figure | Source | Unit |
| --- | --- | --- |
| Income Actual | `budget_income_<cat>` **+** `invoice_income_<cat>` | cents |
| Expense Actual | `budget_expense_<cat>` | cents |
| **Payroll** Actual | `expense_payroll` — from the **ledger**, not the metrics | cents |
| Forecasted / Budgeted | `home.budget[year][mon][income\|expense][camelKey]` | **dollars** |

Mixing cents and dollars is the likeliest regression here, so every card
assertion states both numbers.

**The card list is fixed, not derived.** `ALL_INCOME_CATEGORY_KEYS` and
`ALL_EXPENSE_CATEGORY_KEYS` come from the colour map, so the tab always renders
**six** income cards and **seven** expense cards whether or not any money moved.
The charts do the opposite — they drop anything with no actual, which is what
makes the four empty states reachable.

**The two columns share four names.** Entertainment, Transport, Medical and Misc
are both an income category and an expense one, so every card lookup goes
through its column first:

```ts
incomeCard: (t) => cy.contains("h2", "Income Categories").parent()
                     .contains("h3", new RegExp(`^${t}$`)).closest("div.border"),
```

**The pie keeps forecast-only categories out; the bar chart keeps them in.** A
zero slice is meaningless, but the gap between a forecast and nothing earned is
the whole point of the comparison.

**One forecast anywhere changes every bar label.** With no forecast set the
chart is in single-value mode and prints `150`; the moment any category has one
it switches to grouped mode and prints `$150`. That is exactly what the
screenshots show — bare numbers on the income side, `$`-prefixed on the expense
side, because payroll had a budget.

Axis labels are truncated at **12 characters** (`Entertainmen...`), with the
full text on a `<title>`.

Per-card progress bars are Radix, so assert `aria-valuenow` on
`[role="progressbar"]` — it is `Math.min(utilization, 100)`, or `0` for `NA`.

### Overview findings, all pinned

- **The forecast pencil does exist.** Each card in **monthly** view carries a
  `button[title="Edit category"]` that opens "Edit Income/Expense Category" and
  `PUT`s the home with `budget[year][mon][side][camelKey]`. It is a white 40px
  circle on a pale card and very easy to miss. Quarterly view withdraws it.
- **`Over Forecast` and `Remaining` are absolute values.** `Math.abs(forecast −
  actual)` drops the sign, so $800 spent against a $600 budget reads
  "Remaining: $200.00" — the opposite of what happened. Only the red/green
  colour distinguishes the two directions, which is why the colour is asserted
  alongside every figure.
- **An unbudgeted category reports all of its spend as `Remaining`** (and all of
  its income as `Over Forecast`), in red, against a $0 forecast.
- **The month label is built by string concatenation.** `getMonthYear(dateRange?.startDate + 1)`
  turns `"2026-09-01"` into `"2026-09-011"`, which V8 parses as the 11th of the
  same month — so the heading is *accidentally* correct for every period, since
  `startDate` is always day 01.
- **Quarterly reads the forecast from the quarter's first month only.**
  `getBudgetForecasts` derives its month from `dateRange.startDate`, so a
  September forecast is invisible in the Q3 that contains it and July's stands
  in for all three.
- **Payroll survives a missing `expense_payroll`** here (`payrollAmount || 0`)
  where the Expenses tab renders `$NaN` from the same value.

### Budget findings, all pinned

- **`Button` defaults to `type="submit"`, and five places forget to override
  it.** Cancel on Add/Edit Income, Add/Edit Expense, Add/Edit Threshold and
  Edit Invoice all run `onClose` *and* submit, so a complete form is written by
  the button meant to abandon it. Worse, **Remove** on a pay-stub expense row
  is the same: clicking it PUTs the pay stub and `onSuccess` closes the modal,
  so there is no way to delete one expense line and keep editing. One
  `type="button"` in each fixes all six.
- **Edit Threshold shows the wrong category.** `defaultValues.category` is
  `editThreshold.category?.toLowerCase()` — `"utilities"` — but the select's
  options carry the UPPER-case enum values, so nothing matches and the browser
  falls through to the first enabled option, **Groceries**. The write itself is
  correct (react-hook-form still holds `utilities`), so this is cosmetic — but
  it invites someone to "correct" the dropdown to what they see and retarget a
  cap they never meant to touch.
- **Edit Threshold silently re-enables a disabled cap.** `isEnabled` is seeded
  with `useState(...)` on a modal that is mounted from first paint, so it is
  fixed at `true` before any threshold is chosen.
- **Edit Threshold moves the cap in quarterly view.** The month field is seeded
  from `dateRange.startDate`, not from the threshold — editing a September cap
  while viewing Q3 refiles it under July.
- **"Update Threshold" confirms "created".** The button text keys off
  `editThreshold || existingThreshold`, but the toast keys off `editThreshold`
  alone — which is null when you update an existing threshold from the Add
  form.
- **A missing `expense_payroll` renders `$NaN`.** `expensesData?.expense_payroll / 100`
  has no guard, and the NaN reaches both the Payroll row and Total Expenses. The
  income side guards the equivalent case (`NaN || 0`), so only expenses are hit.
- **The expense table does not filter on `transaction_type`.** It maps the whole
  `budgets` array and relies on the server honouring the query; an income row in
  that response is listed and counted as an expense. The income table does
  filter.
- **A quarter's spend is compared against each month's cap.** The metrics call is
  scoped to the whole window, so in quarterly view one month of overspend raises
  an identical alert for all three months.
- **The Source/Category column shows the raw enum** — `CARE_FEE`, `GROCERIES` —
  where the form offers "Care Fee" and "Groceries".
- **An entry with no date renders "Invalid Date"**; one with no id makes the
  kebab's Edit open a blank Add form.
- **The unnamed-threshold fallback differs between the two screens:** the table
  builds `"groceries Threshold"` from the raw key, the alert list
  `"Groceries Threshold"`.

## Selector notes

- **Row** — `cy.contains(invoiceNumber).closest('div[class*="border-b"]')`;
  `BaseTable` renders nested divs, not a real table.
- **Modal** — the payroll modals use `CommonModal`, whose title is a plain
  `div`, so scope with react-modal's own `.ReactModal__Content` rather than
  looking for a heading. Its cross is `div[class*="right-6"]`.
- **Pay stub actions** are `<button title="…">`: `View details`,
  `Edit pay stub` / `Paid pay stubs cannot be edited`, `Download pay stub`.
- **Expense inputs** carry no `name` — anchor on their placeholders
  (`Description (e.g., Tips)`, `Amount`), and the add button is the only
  `button` inside that `div.grid`.
- **The hours tooltip** needs `mouseover` on the wrapper *around* the icon:
  `PopoverComponent` puts the handlers there, and React derives `onMouseEnter`
  from `mouseover`.
- **Status badge** — a `span` whose class contains `rounded-full`.
- **View / Download** — divs carrying `title="View Invoice"` and
  `title="Download Invoice"`.
- **⋮ entries** are plain divs with an icon beside the label, so anchor on the
  exact text: `cy.contains("div", /^Void Invoice$/)`.
- **Add Item** is a styled `div`, not a button.
- **Resident card** — `closest('div[class*="w-[400px]"]')`.
- **Mark as Paid** appears twice once the modal is open — the menu entry and the
  confirm button. Use `cy.contains("button", "Mark as Paid").last()`.
- **Budget tabs** are the only `span.text-xl` on the screen, so
  `cy.contains("span.text-xl", /^Income$/)` avoids every "Total Income" on it.
- **The Monthly/Quarterly halves** are bare divs holding only their label;
  the selected one carries `bg-black`. The click handler is on their parent, so
  clicking the label works by bubbling.
- **`SelectComponent`'s first option is its disabled placeholder**, so option
  indexes are off by one — `options[1]` is the newest month.
- **The Enable Threshold toggle** is
  `cy.contains("Enable Threshold").parent().find("button")`; it carries
  `bg-primary` when on and `bg-primary/20` when off, which are different class
  tokens.
- **`FormSingleRadioSelect` renders styled divs**, not radio inputs — the
  selected one is marked `data-state="on"`.
- **Never type a fractional amount into a number field.** `FormInputFieldComponent`
  round-trips through `Number(val)`, so a trailing `.` makes the browser report
  an empty value and the field resets mid-word. Assert fractions only where the
  value is *prefilled*.

## Not covered here

- The senior-facing billing view (`SeniorInvoices`) and the caregiver-facing
  payroll view (`PCGMyPayroll`) — different audiences, different component
  trees. Only that a PCG lands on the latter instead of the former is asserted.
- The Stripe payment path, on either side of the module; only the manual
  "Mark as Paid" flow reaches the API.
- What the invoice or pay stub PDF contains — both Downloads are asserted down
  to a real `%PDF-` file with the right name, in line with the rest of the
  suite.
- The commented-out Summary tab, and the `revopsPayrollMock` fixture the payroll
  screen still imports but no longer renders from.
- The budget's **Overview** tab and its charts — the shell spec asserts it is
  the landing tab and nothing more.
- Receipt **uploading** on a budget entry. The staged-file lifecycle goes
  through `uploadToS3`, which needs a real bucket; viewing and downloading an
  already-stored receipt are driven end to end.
- The commented-out budget row actions: `Delete` and `Stop Recurring` on both
  ledgers, and `Delete` on a threshold. Each is asserted **absent** so the tests
  fail loudly if one is switched back on untested.

## Findings the first full run turned up

Everything below was discovered by executing the suite, not by reading the code
— each one is now pinned by a test.

- **Editing a second ledger entry prefills the first one's values.** `Form`
  captures `defaultValues` at mount and its `key` is `editIncome?.home_id` —
  the *home's* id, identical for every entry. So the form is never re-keyed
  between two edits and never re-reads its defaults: opening entry B shows
  entry A's description, category, amount and date, and saving writes A's
  figures over B. Keying on `editIncome?.id` fixes it. **The most damaging
  finding in the module.**
- **Paying an invoice drives the resident's Outstanding balance negative.**
  Outstanding is `DUE total − PAID total`, and a settled invoice leaves nothing
  on the DUE side — so a paid $550 invoice reports the resident $550 in credit
  rather than square. This is the ordinary payment path, not an over-payment.
  The sign also lands after the symbol: `$-550`.
- **Add Item does nothing when the description was never touched.**
  `handleAddLineItem` calls `.trim()` on `getValues("newItemDescription")`, and
  that field has no entry in `defaultValues` — so an untouched one is
  `undefined` and the handler throws before reaching its own validation. No
  warning, no item, no clue. The guard only fires once the field has been typed
  into and cleared.
- **The Create Invoice modal rounds its total to whole dollars.** Its
  `formatCurrency` runs with `maximumFractionDigits: 0`, so an invoice for
  $12.50 is shown to the resident as $13 while the payload keeps 12.5.
- **The Mark as Paid amount is `readOnly`, not `disabled`.**
  `InputFieldComponent` maps its `disabled` prop onto `readOnly`, so the field
  still focuses and still submits.

## Traps this suite had to be written around

None of these are app bugs; all of them cost a run to find.

- **1280x800 is too small for this module.** Taller modals push their submit row
  below the fold and wider tables push the Actions column outside the horizontal
  scroll window, so Cypress refuses to call those elements visible. The visit
  helpers set `cy.viewport(1600, 1400)` rather than reaching for `force: true`,
  which would hide a genuine coverage bug.
- **The billing screen's header button is also labelled "Create Invoice"**, and
  it comes first in the DOM — so an unscoped `cy.contains("button", …)` finds
  the one *behind* the modal overlay, which can never be clicked. Scope modal
  buttons to `.ReactModal__Content`.
- **`have.value ""` fails on a select with a disabled placeholder.** Chrome
  selects nothing at all, so `.val()` is `null`. Use
  `invoke("val").should("not.be.ok")`.
- **`.clear()` on a controlled number input parks the cursor at the start.**
  React re-renders the field as `"0"`, so typing `650` over a prefilled `500`
  yields `6500`. Use `type("{selectall}650")`.
- **Form error containers render unconditionally**, empty when there is no
  complaint — so `should("not.exist")` never holds. Assert
  `not.contain.text`.
- **The month placeholder and the month validation message are the same
  string** ("Select month"), and the placeholder `<option>` never leaves the
  DOM. Read the message off `div.text-red-500`.
- **Radix's `Progress` does not render `aria-valuenow`** in this build. Assert
  the indicator's `translateX(-N%)` transform instead — and note the browser
  normalises `-0%` to `0%`.
- **A default parameter value applies to `undefined`**, so a fixture option
  written `thresholdName: undefined` can never omit the key. Use a `null`
  sentinel.
- **The page stat cards round to whole dollars** (`charts/chart-utils`
  `maximumFractionDigits: 0`) while the Overview cards keep cents.
