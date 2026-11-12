# Home dashboard end-to-end specs

Route: `/` — the screen a PCHO, PCG or HomeAdmin lands on after signing in.
Everyone else is redirected by `getInitialRoute`.

| Spec | Covers | Tests |
| --- | --- | --- |
| `home-dashboard.cy.ts` | The seven headcount queries, the metric cards, the five module cards, Recent Activity and Quick Actions | 144 |
| `support-request.cy.ts` | Avatar → Support ticket: `POST /v1/support` payload contract and the client-side schema block | 2 |
| `change-password.cy.ts` | Profile → Change Password: `PUT /update-password` contract plus the mismatch and same-password denials | 3 |
| | **Total (must stay green)** | **149** |

```bash
npx cypress run --spec cypress/e2e/dashboard/home-dashboard.cy.ts
```

## Seven queries, all of them blocking

`isLoading` is `userConfigs.some(config => !usersData[config.key])`, so the
screen shows a spinner until **all seven** `/v1/users` calls have answered:

| Key | `userType` | Extra |
| --- | --- | --- |
| leads | `Lead` | |
| seniors | `Senior` | `milestone=contract` |
| referrals | `Referral` | |
| PCGLeads | `PCGLead` | |
| PCGs | `PCG` | |
| nurseLeads | `NurseLead` | |
| nurses | `Nurse` | |

A spec that answers six of them never gets past the loader, so the stub branches
on `userType` and **always** replies:

```ts
cy.intercept("GET", "**/v1/users*", (req) => {
  const userType = (req.query.userType as string) ?? "";
  req.alias = `get${userType || "Users"}`;          // one alias per role
  req.reply({ statusCode: 200, body: { users: rows[userType] ?? [] } });
});
```

Per-request aliasing is what makes "only the senior query carries a milestone" a
real assertion rather than a race between seven identical calls.

A **failed** query is not the same as an empty one: `isLoading` only clears once
every key is defined, so a 500 leaves the spinner up rather than showing wrong
numbers. That is asserted, because it is the safer of the two behaviours.

## What is filtered and what is not

`dashboard.tsx` rebuilds five of the seven lists to drop `isDeleted`, and drops
`lost` leads as well:

| Card | Deleted excluded? |
| --- | --- |
| Senior Leads | yes — plus `lost` |
| Seniors | yes |
| Care Team | yes |
| Nurse Leads | yes |
| Nurses | yes |
| **Referral Agents** | **no** |
| **Care Leads** | **no** |

Referrals and PCGLeads are passed through untouched, so a deleted referral agent
or care lead still counts on its card. Both directions are pinned.

## The metric cards

Seven cards, each gated on its own `DASHBOARD_*` feature, and two of them —
**Seniors** and **Care Team** — appear only when the home's
`authorizedModules` include `CLINICAL`. The commented-out **Occupancy Rate**
card is asserted absent.

- **The number is the link.** Clicking the value routes to that card's board
  (`/crm`, `/clinical`, `/crm/referral`, `/crm/pcg`, `/clinical/pcg`,
  `/crm/nurse`, `/clinical/nurse`). Care Team is the one that varies by role —
  `/hcm/team` for a PCG, `/clinical/pcg` for everyone else.
- **The plus badge opens a form**, and only four cards have one: Senior Leads,
  Referral Agents, Care Leads and Nurse Leads. Seniors, Care Team and Nurses are
  onboarded from their own boards instead, so their absence is asserted too.

Selector note: the title is the only element carrying a `title` attribute with
that text, so `cy.get('[title="Care Team"]').closest('div[class*="rounded-[10px]"]')`
reaches the card without colliding with the sidebar link of the same name.

## The module cards

Five cards — CRM, Clinical, Staff Management, Compliance, RevOps — each with a
description, four features and an `Access <module>` button.

- **`authorizedModules` decides what the button does.** Licensed → it routes;
  unlicensed → the card dims (`opacity-50`), the button greys
  (`!bg-gray-400`) and clicking opens the upgrade modal instead of navigating.
- `"Staff Management".toUpperCase()` is `"STAFF MANAGEMENT"` — **with a space**.
  A home whose list says `STAFFMANAGEMENT` dims the card.
- A home with **no** module list at all is treated as fully licensed
  (`accessAllModules`), which is asserted so the fallback cannot regress into a
  lockout.
- **CRM's destination is conditional**: `home.isSalesRequired` sends it to
  `/crm/sales-dashboard` instead of `/crm`.
- **HomeAdmin never sees RevOps** — a hard-coded exclusion, separate from RBAC.

Pinned: the RevOps card reuses `DASHBOARD_COMPLIANCE_ACTION` as its `rbacKey`
rather than having one of its own, so RevOps visibility rides on the Compliance
permission plus that HomeAdmin special case.

## Quick Actions is mostly absence

The whole panel returns `null` unless something needs doing, and each section
has its own trigger. With an ordinary stubbed home the two **document** sections
are the ones that show, because "no documents at all" is by definition
incomplete — which makes them the reliable way to prove the panel renders.

| Section | Shows when |
| --- | --- |
| Pending Documents → Home Documents | Compliance licensed **and** the home's required docs incomplete |
| Pending Documents → My Documents | the signed-in user's required docs incomplete |
| Expired / Expiring Documents | any home, user or care-team doc expired or expiring |
| Total Time Off Requests | `HCM_SCHEDULING` EDIT, a timeoff shift **today or later** with `is_unavailability_approved === null` |
| Missing Schedules for next week | `HCM_SCHEDULING` EDIT and a gap in next week's `available` shifts |
| Time-off request! (Request Now) | `HCM_EMPLOYEE_DASHBOARD` — the carer's view, never a PCHO's |

Only one accordion is open at a time (`expanded` is a single string), and that
is asserted.

The two shift queries are told apart by `shift_status` (`timeoff` versus
`available`), so the stub aliases them separately — the next-week query also
carries a repeated `shift_start_time` pair for the Monday→Sunday window.

## The clock is frozen

Quick Actions computes next week from `new Date()` and filters time-off against
`dayjs().startOf("day")`, so every test freezes at **Thu 17 Sep 2026**. Without
it, "a request already in the past" flips to a future one as the week turns.

## Not covered here

- `components/dashboard/pending-contracts.tsx` — imported by Recent Activity but
  commented out; the panel's "Coming Soon.." placeholder is asserted instead.
- The **commented-out** Quick Actions sections: the Lead/Senior and Care
  Lead/Care Team pending-document lists. The expired/expiring equivalents are
  live and are covered.
- The add forms the plus badges open — Add Lead, Add Referral, Add PCG and Add
  Nurse each have their own CRM spec. Only that the right form opens is asserted
  here.
- The PCG and HomeAdmin views of this screen beyond who sees the RevOps card.
