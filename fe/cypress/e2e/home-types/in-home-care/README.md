# In-Home Care end-to-end specs

**This folder is a home-type dimension, not a module.** `e2e/` holds the
canonical module coverage — which IS the residential (Personal Care Home)
coverage, since every spec defaults to `homeType: "Residential"`. What
lives here is only the *delta*: every place the app behaves differently
when the home is In-Home Care.

Home type: `home.homeType = "In Home Care"` (vs `"Residential"`). Every
component that branches on it reads it through `useGetHomeType()` — so the
whole surface is stub-driven by what `GET /v1/home/{id}` returns.

## What differs from a Residential home

| Area | Residential | In-Home Care | Pinned by |
| --- | --- | --- | --- |
| Add Shift | caregiver + times only | **Select Client** required + read-only **Shift Rate** | §1–3 |
| Shift rate | caregiver's `roaster[].pay_rate` | client's `payRate`, caregiver wage as fallback | §2 |
| Shift payload | no client key | `assigned_to_user_id` on `POST /v1/hcm/shift` | §3 |
| Schedule board | all member rows | PCG sees **only their own** row | §4 |
| Senior board view | all member rows | only caregivers assigned via `assigned_to_user_id`; empty → "No shifts assigned in this week" | §4 |
| Clinical board | all seniors | PCG sees only seniors their today's shifts assign | §5 |
| Senior record | face carousel | PCG gets **no** carousel | §6 |
| New lead documents | `allOnboardingDocsForSeniors` | `inHomeCareOnboardingDocsForSeniors` — clinical_assessment, senior_bill_of_rights, service_agreement | §7 |
| Biography fields | Mobile/address optional — save succeeds without them | starred **and** enforced — an address-less biography never PUTs on IHC, the same record saves on Residential | §8 |
| Document e-sign | shows unless doc is listed & envelope incomplete | `service_agreement` requires a **completed** envelope | §9 |
| Copy Week | bulk POST, no client key | `assigned_to_user_id` survives the copy | §9b |
| Save failure | — | server `error` string reaches the popover | §9c |
| Clinical board empty | generic "Nothing added yet." | PCG gets "No shifts assigned to you today" | §10 |
| Nurse board | assignedUserIds filter | **same** — the IHC rule is a PCG-only contract | §10 |
| Dashboard docs | "Home Documents" | "Business Documents" | §11 |
| Document sections | onboarding docs in main list | **same** — the priority sort uses the residential list but only reorders within the section (cosmetic) | §12 |

Already pinned elsewhere (not duplicated here): the IHC compliance document
set (`compliance/compliance.cy.ts`), the mandatory phone on Add Lead
(`crm/api-contracts.cy.ts`), the IHC Room Number → Mobile/Address swap on the
profile (`clinical/senior-profile.cy.ts`), and the PCG persona's IHC carousel
checks (`personas/pcg.cy.ts`).

As-built notes: the required-client error renders the generic "Required",
not the zod message; `assigned_to_user_id` exists in the task-tracking
model but no task UI assigns clients yet; RevOps consumes `pay_rate` per
shift generically — there is no home-type branch inside RevOps itself, so
the invoice-side difference is pinned at the shift payload (§3).

## The persona layer

`personas.cy.ts` is the journey counterpart — 13 tests, one describe per
role, tagged so the CI persona lanes sweep them alongside the Residential
journeys: the PCG's scoped day (own row → assigned clients → no carousel),
the Senior's assigned-caregiver board, the Nurse's *unchanged* world, and
the PCHO's unfiltered one. HomeAdmin has no home-type branch — nothing to
journey, deliberately absent.

## Run it

```bash
npx cypress run --spec "cypress/e2e/home-types/in-home-care/*.cy.ts"
```

All 41 module tests are must-pass — Residential contrast cases are in the same file
so a regression shows up as a flip on the paired assertion, not a new file.
