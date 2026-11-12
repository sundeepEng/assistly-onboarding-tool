# Gia Onboarding Knowledge — Index

Knowledge files for **Gia**, the Lyzr-powered onboarding assistant. Each
house-type file is self-contained: Gia needs exactly one file once the runtime
tells her which house type the signed-in home is.

## Files to upload to Lyzr

| File | Upload? | Purpose |
|---|---|---|
| `house_type_personal_care_home.md` | **Yes** | All guidance for `homeType === "Personal Care Home"` (and any non-IHC value — the frontend treats every non-"In Home Care" home identically). |
| `house_type_in_home_care.md` | **Yes** | All guidance for `homeType === "In Home Care"`. |
| `onboarding-schema.json` | Optional (reference) | JSON Schema Draft 2020-12 contract for the YAML block in each file. |
| `KNOWLEDGE_INDEX.md` | Optional | This index — helps Gia disambiguate house types. |
| `BUSINESS_CONFIRMATIONS.md` | Internal | Open business-policy questions — do not upload as customer-facing truth until resolved. |

## House types discovered

The frontend branches on exactly one condition — `homeType === "In Home Care"`
(`utils/constants.ts:55`, `utils/gethomeType.ts`). Everything else behaves as the
residential/Personal-Care-Home path.

- **`Personal Care Home`** — file: `house_type_personal_care_home.md`
  (note: Cypress fixtures default `homeType: "Residential"`; the backend enum
  uses `"Personal Care Home"`. Same frontend behaviour for both — see
  BUSINESS_CONFIRMATIONS.md.)
- **`In Home Care`** — file: `house_type_in_home_care.md`

The backend enum (`be/models/Home/home.model.ts:107`) also allows `Assisted
Living`, `Memory Care`, and `Adult Day Center`. The frontend has **no** branches
for them — they currently behave as Personal Care Home. Logged in
BUSINESS_CONFIRMATIONS.md rather than invented.

## Runtime context Gia needs (not stored here)

- Current `homeType` (from `GET /v1/home/{homeId}` via the session home id).
- Signed-in role and `userId`.
- Selected subject record (`leadId` / `seniorId` / `pcgId` / `nurseLeadId`).
- Current flow and step, plus verified completed steps (read `milestone[]`,
  `role`, `lastLoginTimestamp`, `onboardingESignEnvelopeStatus`, `documents[]`,
  `tourDateTime` on `GET /v1/user/{id}`).
- Blockers (capacity 409, missing email, completed envelope).

## Source of truth

Generated from `fe/` (Next.js frontend), `cypress/` specs, `be/` (Lambda
backend), and the prior Gia catalog `ONBOARDING_STEPS.md` on branch
`sundeep/gia-guided-onboarding` — verified against code, not copied blindly.
Scope: **CRM and Clinical modules**, written for the **PCHO** and **HomeAdmin**
actors who administer onboarding. Each module carries multiple personas
(senior leads, care leads, nurse leads) — each persona's document upload
checklist is tabulated in the "Document upload checklists by persona" section
of each house-type file.
