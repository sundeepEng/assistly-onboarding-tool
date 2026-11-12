# Business Confirmations — Open Questions

Policy questions found while generating the Gia onboarding knowledge files.
**Unresolved items are already qualified inside the house-type files** — Gia
should not assert them as fact until answered.

## 1. Home-type vocabulary

- The backend enum allows five values: `Personal Care Home`, `In Home Care`,
  `Assisted Living`, `Memory Care`, `Adult Day Center`
  (`be/models/Home/home.model.ts:107`). The product is described as having **two**
  house types (pch + in-home). Confirm the other three are future values, and
  that they should follow Personal-Care-Home guidance until dedicated branches
  exist.
- Cypress fixtures default to `homeType: "Residential"` — a value **not** in the
  backend enum. Confirm whether production data uses `Personal Care Home`,
  `Residential`, or both.

## 2. Is e-sign required before Move to Clinical?

Nothing in `lead-action-cell.tsx` or the backend `update-user.ts` blocks
promotion when the envelope is unsigned. The Gia catalog implies a signed
contract precedes activation. Confirm whether this is policy (guidance text) or
should become an enforced prerequisite.

## 3. Mandatory documents

Verified configuration (`fe/utils/constants.ts`):

- **Senior uploads** (`dl`, `ssn`, `medication_list`,
  `physician_certificate`): all `required: false` — the contract entries in
  `documentRequiredForSenior` are commented out. Gia should describe them as
  expected-but-optional, not mandatory.
- **PCG uploads**: `tb_test`, `cpr_and_first_aid`, `background_check` are
  `required: true` (first two with expiry); `dl`, `ssn`, `resume` optional.
  Contract entries commented out.
- **Nurse**: `hospice_agreement` `required: true`.
- **PCHO own credentials**: TB Test, Resume, CPR & First Aid — all required.
- **Home documents**: mixed per `HOMEDOCUMENTS` (PCH) / `InHomeCareDocuments`
  (IHC — both required).

**Open question:** "required" is enforced only as display state
(`isDocumentRequired`); no server-side gate blocking Onboard / e-sign /
Move to Clinical on a missing upload was found. Confirm whether missing
required documents should block hiring/admission by policy.

## 4. Nurse-lead e-sign

The ⋯ menu on `/crm/nurse` has **no Initiate e-sign** item — commented out in
`nurse-action-cell.tsx` — yet the backend explicitly accepts `NurseLead`/`Nurse`
recipients (`be/services/third-party-integrations/esign/initiate-esign.ts`).
Confirm whether the menu item should be restored or whether nurses intentionally
sign outside the envelope flow.

## 5. "Home Tour" at In Home Care

The same tour modal runs at IHC, but the visit is presumably to the **client's**
home (initial assessment), not a facility tour. Confirm the intended business
meaning — labels are unchanged in code.

## 6. Caregiver promotion vs. clinical record

- Seniors: Move to Clinical does **two writes** (`PUT /v1/clinical/user` then
  `PUT /v1/user`) — the clinical record is created first.
- PCG/Nurse leads: Move to Clinical is a **single** `PUT /v1/user` re-role; no
  clinical record is created.
Earlier drafts conflated these. Confirmed as-built in
`cypress/e2e/crm/care-and-nurse-leads.cy.ts`. Confirm this asymmetry is intended.

## 7. Sequencing inside flows

- `Assign Seniors` for nurses: available on the lead board — should Gia
  recommend it before or after hiring?
- Home Tour is optional in code (no milestone gate on later steps). Confirm it
  stays optional in guidance.
- House-setup items (S3 templates, authorizedModules, homeCapacity) appear to be
  ops-managed with no in-app wizard. Confirm ownership.

## 8. Non-blocking known defects

- The Careplan sub-tab label uses a typographic apostrophe (`ADL’S`) — copy in
  Gia scripts should not depend on the ASCII spelling.
- `assertPopover("Senior Lead moved to clincial!")` — the success message has a
  typo; do not quote it verbatim in Gia scripts.
- These are documented as **as-built** behaviour, not intended product
  behaviour, matching the specs' own framing.
