# Gia Onboarding — Personal Care Home

> House type covered by this file: **`Personal Care Home`** (also treated as the
> application's default / "Residential" behaviour). This file is self-contained:
> every role, module, and flow needed for onboarding guidance is defined here.
>
> Scope: **CRM and Clinical modules**, from the perspective of the onboarding
> **administrators — `PCHO` and `HomeAdmin`**. Other roles appear only as the
> *subjects* of onboarding (the people being onboarded) or for access
> completeness. CRM and Clinical each carry multiple personas — senior leads,
> care leads, nurse leads — and every persona has its own document upload
> checklist, detailed in the flows below and summarized in
> [Document checklists by persona](#document-upload-checklists-by-persona).

```yaml
schema_version: "1.0"
house_type_id: "personal_care_home"
house_type_value: "Personal Care Home"
house_type_name: "Personal Care Home (Residential)"
roles:
  - role_id: "PCHO"
    description: "Personal Care Home Owner — the facility owner/administrator who runs the home and performs all onboarding administration."
    onboarding_responsibility: "administrator"
    represents: "The home owner/operator."
    access_conditions:
      - "Initial route is '/' normally, or the sales dashboard / /crm when home.isSalesRequired is set."
      - "Holds the full CRM + Clinical permission set including CRM_ONBOARD_LEAD, CRM_MOVE_TO_CLINICAL, CRM_INITIATE_ESIGN, CRM_DELETE_LEAD, CRM_MARK_AS_LOST."
    evidence:
      - source: "fe/utils/roles.ts — Permissions.PCHO"
        kind: "frontend_permission"
      - source: "fe/utils/roleAccess.ts — getInitialRoute"
        kind: "implementation"
  - role_id: "HomeAdmin"
    description: "Home administrator — nearly the same CRM/Clinical permissions as a PCHO, minus RevOps/budget items; administers onboarding."
    onboarding_responsibility: "administrator"
    represents: "Staff administrator of the home."
    access_conditions:
      - "Shares the isSalesRequired initial-route rule with PCHO."
      - "Holds CRM_ONBOARD_LEAD, CRM_MOVE_TO_CLINICAL, CRM_INITIATE_ESIGN, CRM_DELETE_LEAD; does NOT hold CRM_MARK_AS_LOST or REVOPS_BUDGET."
    evidence:
      - source: "fe/utils/roles.ts — Permissions.HomeAdmin"
        kind: "frontend_permission"
  - role_id: "SalesRepresentative"
    description: "Sales rep at a sales-enabled home; works the senior-lead pipeline but cannot onboard, e-sign, move to clinical, or delete."
    onboarding_responsibility: "none"
    represents: "Sales staff member."
    access_conditions:
      - "Only exists meaningfully when home.isSalesRequired is true; holds CRM_ACTIONS, CRM_MARK_AS_LOST, CRM_SENIOR_CAMPAIGN only."
    evidence:
      - source: "fe/utils/roles.ts — Permissions.SalesRepresentative"
        kind: "frontend_permission"
      - source: "fe/cypress/e2e/crm/senior-leads-row-actions.cy.ts — 'offers a Sales Representative only the action their role carries'"
        kind: "cypress_spec"
  - role_id: "SalesDirector"
    description: "Sales director — same CRM surface as a representative in the permission map."
    onboarding_responsibility: "none"
    represents: "Sales lead."
    access_conditions:
      - "Same EDIT grants as SalesRepresentative (no onboard/e-sign/move/delete)."
    evidence:
      - source: "fe/utils/roles.ts — Permissions.SalesDirector"
        kind: "frontend_permission"
  - role_id: "Lead"
    description: "A prospective resident (senior lead) before contract completion — the subject of the senior onboarding flow. Receives the portal invite via Onboard."
    onboarding_responsibility: "self_service"
    represents: "Prospective resident / their family."
    access_conditions:
      - "Initial route is their own record /crm/{userId}; can edit Biography, Biography Documents, and Biography Forms on that record."
    evidence:
      - source: "fe/utils/roles.ts — Permissions.Lead"
        kind: "frontend_permission"
  - role_id: "Senior"
    description: "An active resident — created when a Lead is moved to clinical. Views their clinical record, meds, and billing."
    onboarding_responsibility: "self_service"
    represents: "Resident of the home."
    access_conditions:
      - "Views Clinical tabs, MedPass, Careplan, own RevOps billing; edits own Biography and Face Sheet."
    evidence:
      - source: "fe/utils/roles.ts — Permissions.Senior"
        kind: "frontend_permission"
  - role_id: "PCGLead"
    description: "A prospective caregiver (Personal Care Giver applicant) — subject of the caregiver onboarding flow."
    onboarding_responsibility: "self_service"
    represents: "Caregiver applicant."
    access_conditions:
      - "Initial route /crm/pcg/{userId}; edits their CRM_PCG record and care-team documents."
    evidence:
      - source: "fe/utils/roles.ts — Permissions.PCGLead"
        kind: "frontend_permission"
  - role_id: "PCG"
    description: "An active caregiver — created when a PCGLead is moved to clinical (hired)."
    onboarding_responsibility: "self_service"
    represents: "Caregiver / care team member."
    access_conditions:
      - "Sees the clinical senior board and assigned residents, HCM schedules/timesheets, own RevOps payroll; edits incidents, OTC meds, medpass, and own care-team documents."
    evidence:
      - source: "fe/utils/roles.ts — Permissions.PCG"
        kind: "frontend_permission"
  - role_id: "NurseLead"
    description: "A prospective nurse — subject of the nurse onboarding flow."
    onboarding_responsibility: "self_service"
    represents: "Nurse applicant."
    access_conditions:
      - "Initial route /crm/nurse/{userId}; edits their CRM_NURSE record."
    evidence:
      - source: "fe/utils/roles.ts — Permissions.NurseLead"
        kind: "frontend_permission"
  - role_id: "Nurse"
    description: "An active nurse — created when a NurseLead is moved to clinical."
    onboarding_responsibility: "self_service"
    represents: "Nurse staff member."
    access_conditions:
      - "Views the clinical dashboard and residents; edits clinical record, OTC add, eMAR and care-report e-sign."
    evidence:
      - source: "fe/utils/roles.ts — Permissions.Nurse"
        kind: "frontend_permission"
  - role_id: "ComplianceGuest"
    description: "External reviewer (surveyor, consultant, auditor) invited for compliance training; not part of CRM/Clinical onboarding but onboarded via the Compliance Guests board."
    onboarding_responsibility: "self_service"
    represents: "External auditor or consultant."
    access_conditions:
      - "Initial route /compliance/training; view-only on most modules."
    evidence:
      - source: "fe/utils/roles.ts — Permissions.ComplianceGuest"
        kind: "frontend_permission"
module_access:
  - module_id: "crm"
    page_id: "senior_leads_board"
    role_id: "PCHO"
    view: "allowed"
    create: "allowed"
    edit: "allowed"
    other_actions:
      - action: "Onboard (send portal invite)"
        access: "conditional"
        conditions: ["lead must have an email", "lead must not have logged in (lastLoginTimestamp empty)", "lead must not hold the 'lost' milestone"]
      - action: "Move to Clinical"
        access: "conditional"
        conditions: ["home.authorizedModules must include CLINICAL", "lead must not be 'lost'", "refused with 409 when home senior capacity is reached"]
      - action: "Initiate e-sign"
        access: "conditional"
        conditions: ["lead must have an email", "docusignEnvelopeStatus/onboardingESignEnvelopeStatus must not be 'completed'", "lead must not be 'lost'"]
      - action: "Lost (mark as lost)"
        access: "conditional"
        conditions: ["only at sales-enabled homes (home.isSalesRequired)", "requires a lostCategory"]
      - action: "Delete"
        access: "allowed"
        conditions: ["always present on the row menu"]
    conditions: []
    enforcement_locations: ["navigation", "action", "backend"]
    evidence:
      - source: "fe/cypress/e2e/crm/senior-leads-row-actions.cy.ts — menu, Onboard, Move to Clinical, Initiate e-sign, Lost describes"
        kind: "cypress_spec"
      - source: "fe/components/lead-action-cell.tsx:355-365,489-515"
        kind: "implementation"
      - source: "be/services/update-user.ts — 409 capacity refusal"
        kind: "backend"
      - source: "be/services/third-party-integrations/esign/initiate-esign.ts — role/homeId/envelope validations"
        kind: "backend"
  - module_id: "crm"
    page_id: "senior_leads_board"
    role_id: "HomeAdmin"
    view: "allowed"
    create: "allowed"
    edit: "allowed"
    other_actions:
      - action: "Onboard"
        access: "conditional"
        conditions: ["same email/lastLogin/lost gates as PCHO"]
      - action: "Move to Clinical"
        access: "conditional"
        conditions: ["same as PCHO"]
      - action: "Initiate e-sign"
        access: "conditional"
        conditions: ["same as PCHO"]
      - action: "Lost"
        access: "denied"
        conditions: ["HomeAdmin does not hold CRM_MARK_AS_LOST"]
      - action: "Delete"
        access: "allowed"
    conditions: []
    enforcement_locations: ["navigation", "action", "backend"]
    evidence:
      - source: "fe/utils/roles.ts — Permissions.HomeAdmin"
        kind: "frontend_permission"
  - module_id: "crm"
    page_id: "senior_leads_board"
    role_id: "SalesRepresentative"
    view: "allowed"
    create: "unknown"
    edit: "conditional"
    other_actions:
      - action: "Lost"
        access: "allowed"
        conditions: ["sales-enabled homes only"]
      - action: "Onboard / Move to Clinical / Initiate e-sign / Delete"
        access: "denied"
        conditions: ["none of the four permissions are granted"]
    conditions: ["sales-enabled homes only"]
    enforcement_locations: ["navigation", "action"]
    evidence:
      - source: "fe/cypress/e2e/crm/senior-leads-row-actions.cy.ts — 'offers a Sales Representative only the action their role carries'"
        kind: "cypress_spec"
      - source: "fe/utils/roles.ts — Permissions.SalesRepresentative"
        kind: "frontend_permission"
  - module_id: "crm"
    page_id: "senior_leads_board"
    role_id: "SalesDirector"
    view: "allowed"
    create: "unknown"
    edit: "conditional"
    other_actions:
      - action: "Lost"
        access: "allowed"
        conditions: ["sales-enabled homes only"]
    conditions: []
    enforcement_locations: ["navigation", "action"]
    evidence:
      - source: "fe/utils/roles.ts — Permissions.SalesDirector"
        kind: "frontend_permission"
  - module_id: "crm"
    page_id: "lead_record"
    role_id: "Lead"
    view: "allowed"
    create: "denied"
    edit: "conditional"
    other_actions: []
    conditions: ["Sees and edits only their own record at /crm/{userId} — Biography, Documents, and Forms areas."]
    enforcement_locations: ["route", "action"]
    evidence:
      - source: "fe/utils/roles.ts — Permissions.Lead (CRM_BIOGRAPHY, CRM_BIOGRAPHY_DOCUMENTS, CRM_BIOGRAPHY_FORMS)"
        kind: "frontend_permission"
  - module_id: "crm"
    page_id: "care_leads_board"
    role_id: "PCHO"
    view: "allowed"
    create: "allowed"
    edit: "allowed"
    other_actions:
      - action: "Onboard (signup invite)"
        access: "conditional"
        conditions: ["lead must have an email"]
      - action: "Move to Clinical (hire as PCG)"
        access: "conditional"
        conditions: ["single PUT /v1/user re-roles PCGLead → PCG; no clinical write", "routes to /clinical/pcg"]
      - action: "Initiate e-sign"
        access: "conditional"
        conditions: ["email required", "envelope not already completed"]
      - action: "Delete"
        access: "allowed"
    conditions: []
    enforcement_locations: ["navigation", "action", "backend"]
    evidence:
      - source: "fe/cypress/e2e/crm/care-and-nurse-leads.cy.ts — file header contract"
        kind: "cypress_spec"
  - module_id: "crm"
    page_id: "nurse_leads_board"
    role_id: "PCHO"
    view: "allowed"
    create: "allowed"
    edit: "allowed"
    other_actions:
      - action: "Onboard"
        access: "conditional"
        conditions: ["email required"]
      - action: "Move to Clinical (hire as Nurse)"
        access: "conditional"
        conditions: ["single PUT /v1/user re-roles NurseLead → Nurse; routes to /clinical/nurse"]
      - action: "Assign Seniors"
        access: "allowed"
        conditions: ["picker to associate residents with the nurse"]
      - action: "Initiate e-sign"
        access: "denied"
        conditions: ["menu entry is commented out in nurse-action-cell.tsx — backend does accept NurseLead/Nurse recipients (as-built gap)"]
      - action: "Delete"
        access: "allowed"
    conditions: []
    enforcement_locations: ["navigation", "action", "backend"]
    evidence:
      - source: "fe/cypress/e2e/crm/care-and-nurse-leads.cy.ts — file header contract"
        kind: "cypress_spec"
      - source: "be/services/third-party-integrations/esign/initiate-esign.ts — allowed recipient roles include NURSELEAD/NURSE"
        kind: "backend"
  - module_id: "clinical"
    page_id: "seniors_board"
    role_id: "PCHO"
    view: "allowed"
    create: "denied"
    edit: "allowed"
    other_actions:
      - action: "Onboard (resend portal invite)"
        access: "conditional"
        conditions: ["same signup gates as CRM"]
      - action: "Add Medication / MedPass / Incident Report / Initiate e-sign / Delete"
        access: "allowed"
    conditions: ["Shown only when home.authorizedModules includes CLINICAL."]
    enforcement_locations: ["navigation", "action", "backend"]
    evidence:
      - source: "fe/utils/roles.ts — roleNavAllow.PCHO.clinical, Permissions.PCHO CLINICAL_* entries"
        kind: "frontend_permission"
      - source: "ONBOARDING_STEPS.md CS-0/CS-1 (branch sundeep/gia-guided-onboarding)"
        kind: "business_policy"
        note: "verified against pages/clinical/index.tsx and clinicalTabs"
  - module_id: "clinical"
    page_id: "seniors_board"
    role_id: "PCG"
    view: "allowed"
    create: "denied"
    edit: "conditional"
    other_actions:
      - action: "Incident report / OTC add / medpass / careplan service tracking"
        access: "allowed"
    conditions: ["At a Personal Care Home a PCG sees the full senior board and the resident photo carousel."]
    enforcement_locations: ["navigation", "action"]
    evidence:
      - source: "fe/utils/roles.ts — Permissions.PCG"
        kind: "frontend_permission"
      - source: "fe/cypress/e2e/home-types/in-home-care/README.md — Residential column of the delta table"
        kind: "cypress_spec"
  - module_id: "clinical"
    page_id: "seniors_board"
    role_id: "Nurse"
    view: "allowed"
    create: "denied"
    edit: "conditional"
    other_actions:
      - action: "Clinical record edit, OTC add, eMAR/care-report e-sign"
        access: "allowed"
    conditions: []
    enforcement_locations: ["navigation", "action"]
    evidence:
      - source: "fe/utils/roles.ts — Permissions.Nurse"
        kind: "frontend_permission"
  - module_id: "clinical"
    page_id: "care_team_board"
    role_id: "PCHO"
    view: "allowed"
    create: "denied"
    edit: "allowed"
    other_actions: []
    conditions: []
    enforcement_locations: ["navigation"]
    evidence:
      - source: "fe/pages/clinical/pcg/index.tsx; fe/utils/roles.ts — CLINICAL_PCG / CLINICAL_PCG_HOME"
        kind: "frontend_permission"
  - module_id: "clinical"
    page_id: "nurses_board"
    role_id: "PCHO"
    view: "allowed"
    create: "denied"
    edit: "allowed"
    other_actions: []
    conditions: []
    enforcement_locations: ["navigation"]
    evidence:
      - source: "fe/pages/clinical/nurse/index.tsx; fe/utils/roles.ts — CLINICAL_NURSE / CLINICAL_NURSE_HOME"
        kind: "frontend_permission"
flows:
  - flow_id: "house_setup_crm_clinical"
    flow_type: "house_setup"
    title: "Prepare the home for CRM & Clinical onboarding"
    description: "One-time prerequisites the owner/admin (or Cognition ops) must satisfy before any lead can be created, sent for e-sign, or moved to clinical. Not a page-by-page wizard — these are configuration preconditions verified by code paths."
    actor_roles: ["PCHO", "HomeAdmin"]
    subject_type: "home"
    entry_conditions:
      - "Home record exists with homeType 'Personal Care Home' (any non-'In Home Care' value follows this same behaviour)."
    initial_step_id: "confirm_home_modules"
    modules:
      - module_id: "crm"
        display_number: "1"
        title: "CRM readiness"
        description: "Make sure the pipeline and its contract paperwork can run."
        order: 1
        tasks:
          - task_id: "verify_modules_and_capacity"
            display_number: "1.a"
            title: "CRM — module access and capacity"
            description: "Confirm the home is licensed for CRM/Clinical and a resident capacity is set."
            path: "{APP_BASE_URL}/crm"
            actor_roles: ["PCHO", "HomeAdmin"]
            subject_type: "home"
            steps:
              - step_id: "confirm_home_modules"
                display_number: "1.a.1"
                order: 1
                title: "Confirm authorized modules"
                description: "home.authorizedModules must include CRM and CLINICAL or menus and the Move to Clinical action are hidden."
                actor_roles: ["PCHO", "HomeAdmin"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/crm"
                route_parameters: {}
                menu_path: "Side navigation → CRM"
                tab_or_section: null
                ui_action: "none — read-only verification of home record"
                prerequisites: []
                required_fields: []
                instructions:
                  - "GET /v1/home/{homeId} returns authorizedModules; 'Move to Clinical' is absent from the row menu when CLINICAL is not listed."
                gia_message: "Before we start, your home needs the CRM and Clinical modules enabled — if 'Move to Clinical' is missing from a lead's menu, that's the cause."
                completion:
                  description: "authorizedModules includes CRM (and CLINICAL for resident onboarding)."
                  verification_source: "GET /v1/home/{homeId} → home.authorizedModules"
                  verification_rule: "array contains 'CRM' and 'CLINICAL'"
                  limitations: ["Module list is home configuration; there is no in-app editor — changes are made by Cognition ops."]
                transitions:
                  - next_step_id: "confirm_contract_templates"
                    condition: "always"
                skip_conditions: []
                common_errors:
                  - error: "'Move to Clinical' missing from the ⋯ menu"
                    resolution: "home.authorizedModules does not include CLINICAL — contact support to enable it."
                    evidence: "fe/cypress/e2e/crm/senior-leads-row-actions.cy.ts — 'hides Move to Clinical when the home has no Clinical module'"
                escalation_conditions: ["Modules must be enabled by the platform team — not fixable in the UI."]
                evidence:
                  - source: "fe/cypress/e2e/crm/senior-leads-row-actions.cy.ts — 'hides Move to Clinical when the home has no Clinical module'"
                    kind: "cypress_spec"
                unresolved_questions: []
              - step_id: "confirm_contract_templates"
                display_number: "1.a.2"
                order: 2
                title: "Upload contract templates to the home's S3 folder"
                description: "Senior-lead creation and e-sign both read .docx templates from the home's S3 contracts folder ({homeId}/Senior/, {homeId}/PCG/, nurse equivalents). Missing files mean no documents are seeded, and initiate-esign fails server-side with 'Required contract files are missing in S3'."
                actor_roles: ["PCHO", "HomeAdmin"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/crm"
                route_parameters: {}
                menu_path: null
                tab_or_section: null
                ui_action: "none — performed outside the app (S3 contracts bucket) or by ops"
                prerequisites: ["confirm_home_modules"]
                required_fields: []
                instructions:
                  - "Residential senior templates: admission_agreement, house_rules, residents_rights, written_consents, resident_receipt_of_forms, designating_representative (plus advance_directive_checklist, in_the_event_of_death, inventory_list seeded but not sent for e-sign)."
                  - "PCG templates: indemnity_agreement, independent_contractor_offer, residents_rights, staff_receipt_of_forms."
                  - "Nurse template: hospice_agreement."
                gia_message: "The onboarding paperwork comes from your home's contract templates — if e-sign fails with a missing-files error, the templates haven't been uploaded yet."
                completion:
                  description: "All required .docx templates exist in the home's contracts S3 folder."
                  verification_source: "POST /v1/initiate-esign → validateContractFilesExist"
                  verification_rule: "no 404 'Required contract files are missing in S3' response"
                  limitations: ["No in-app template management UI is verified; treated as an ops task."]
                transitions:
                  - next_step_id: "confirm_home_capacity"
                    condition: "always"
                skip_conditions: []
                common_errors:
                  - error: "Popover: 'Please edit all documents before starting e-sign.'"
                    resolution: "Backend could not find the contract files in S3 — upload/confirm templates, or fill the seeded documents first."
                    evidence: "fe/cypress/e2e/crm/senior-leads-row-actions.cy.ts — 'translates a missing file into an instruction to edit the documents'"
                escalation_conditions: ["Template management is outside the application UI."]
                evidence:
                  - source: "fe/utils/createDocumentsFromS3.ts"
                    kind: "implementation"
                  - source: "be/utils/esign-utils.ts — getEnvelopeOptions + validateContractFilesExist"
                    kind: "backend"
                unresolved_questions: ["Who owns template uploads — the home admin or platform ops? (see BUSINESS_CONFIRMATIONS.md)"]
              - step_id: "confirm_home_capacity"
                display_number: "1.a.3"
                order: 3
                title: "Set home capacity"
                description: "homeCapacity caps how many seniors can be moved to clinical; the backend refuses with 409 when full."
                actor_roles: ["PCHO", "HomeAdmin"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/crm"
                route_parameters: {}
                menu_path: null
                tab_or_section: null
                ui_action: "none — home configuration"
                prerequisites: ["confirm_home_modules"]
                required_fields: []
                instructions: ["Set homeCapacity on the home record to the licensed bed count."]
                gia_message: "Your home has a resident capacity limit — hitting it blocks 'Move to Clinical' until a room frees up or the limit is raised."
                completion:
                  description: "homeCapacity is set and active seniors < capacity."
                  verification_source: "PUT /v1/clinical/user → 409 capacity refusal"
                  verification_rule: "no 409 'reached its Senior capacity' response"
                  limitations: []
                transitions:
                  - next_step_id: null
                    condition: "flow complete"
                skip_conditions: []
                common_errors:
                  - error: "'Home Capacity Reached!' modal on Move to Clinical"
                    resolution: "Remove a resident or have the capacity raised; nothing else can proceed."
                    evidence: "fe/cypress/e2e/crm/senior-leads-row-actions.cy.ts — 'Move to Clinical — the home is full'"
                escalation_conditions: ["Capacity changes require support/ops."]
                evidence:
                  - source: "be/services/update-user.ts — activeCount >= effectiveCapacity → 409"
                    kind: "backend"
                unresolved_questions: []
    completion_conditions:
      - "authorizedModules covers CRM + CLINICAL, contract templates exist in S3, homeCapacity set."
    unresolved_questions:
      - "Is there an in-app home-setup wizard planned, or is all of this ops-managed?"
  - flow_id: "senior_onboarding"
    flow_type: "individual_onboarding"
    title: "Onboard a senior (resident)"
    description: "Create a senior lead, collect intake information, prepare and sign the contract paperwork, invite the resident to the portal, then promote them to an active Senior on the clinical side. Independent of staff onboarding — does not require any caregiver or nurse to exist first."
    actor_roles: ["PCHO", "HomeAdmin"]
    subject_type: "senior_lead"
    entry_conditions:
      - "House setup complete (contract templates present, CLINICAL module authorized for the final step)."
      - "Actor holds CRM permissions (PCHO or HomeAdmin; sales roles can only mark leads lost)."
    initial_step_id: "open_add_lead_modal"
    modules:
      - module_id: "crm"
        display_number: "1"
        title: "CRM — Senior Leads"
        description: "The pipeline: create the lead, run the tour, complete the intake tabs, finish the paperwork, then invite, sign, and promote."
        order: 1
        tasks:
          - task_id: "create_senior_lead"
            display_number: "1.a"
            title: "CRM — Add a Senior Lead"
            description: "Create the prospect's record; the app attaches the home's residential contract templates automatically."
            path: "{APP_BASE_URL}/crm"
            actor_roles: ["PCHO", "HomeAdmin"]
            subject_type: "senior_lead"
            steps:
              - step_id: "open_add_lead_modal"
                display_number: "1.a.1"
                order: 1
                title: "Open the Add Lead modal"
                description: "From the Senior Leads board, press 'Add New' to open the lead form (a modal — there is no direct URL)."
                actor_roles: ["PCHO", "HomeAdmin"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/crm"
                route_parameters: {}
                menu_path: "Side navigation → CRM → Senior Leads"
                tab_or_section: null
                ui_action: "Button 'Add New' opens the modal"
                prerequisites: []
                required_fields: []
                instructions:
                  - "Navigate to /crm (Senior Leads)."
                  - "Click 'Add New'; the modal renders firstName/middleName/lastName/email/mobile (+ Lead Owner when the home runs sales)."
                gia_message: "Let's create the new resident prospect — open CRM and press 'Add New'."
                completion:
                  description: "The Add Lead modal is open."
                  verification_source: null
                  verification_rule: null
                  limitations: ["UI state only — no authoritative check; Gia relies on narration/bridge events."]
                transitions:
                  - next_step_id: "fill_lead_details"
                    condition: "modal opened"
                skip_conditions: []
                common_errors: []
                escalation_conditions: []
                evidence:
                  - source: "fe/components/add-lead.tsx"
                    kind: "implementation"
                  - source: "fe/cypress/e2e/crm/senior-leads-board.cy.ts"
                    kind: "cypress_spec"
                unresolved_questions: []
              - step_id: "fill_lead_details"
                display_number: "1.a.2"
                order: 2
                title: "Enter the lead's details and save"
                description: "Collect name and contact details. Email is optional here but required before Onboard or e-sign. Saving POSTs to /v1/user with role 'Lead' and the 'initial contact' milestone."
                actor_roles: ["PCHO", "HomeAdmin"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/crm"
                route_parameters: {}
                menu_path: null
                tab_or_section: "Add Lead modal"
                ui_action: "Button 'Save' submits the form"
                prerequisites: ["open_add_lead_modal"]
                required_fields:
                  - field: "firstName"
                    required: "yes"
                    rules: "alphabets/numbers only"
                  - field: "lastName"
                    required: "yes"
                    rules: "alphabets/numbers only"
                  - field: "email"
                    required: "conditional"
                    rules: "valid email format"
                    condition: "Optional at creation; REQUIRED before Onboard or Initiate e-sign."
                  - field: "mobile"
                    required: "no"
                    rules: "digits only, exactly 10 when provided"
                  - field: "isReferredByUserId (Lead Owner)"
                    required: "conditional"
                    condition: "Shown only when home.isSalesRequired; defaults to the signed-in user."
                instructions:
                  - "Ask for first and last name; middle name optional."
                  - "Strongly encourage an email — it is needed to send the portal invite and e-sign envelope."
                  - "At a sales-enabled home pick the Lead Owner (defaults to you)."
                  - "Press Save; success shows 'New Senior Lead added successfully!' and returns to /crm."
                gia_message: "Give me the prospect's name and a contact email — we'll need the email later to send their signup invite and contracts."
                completion:
                  description: "A new user row exists with role 'Lead' and milestone 'initial contact', with the residential onboarding documents attached."
                  verification_source: "GET /v1/user/{userId} or the /crm board list"
                  verification_rule: "role === 'Lead' and milestone includes 'initial contact'"
                  limitations: []
                transitions:
                  - next_step_id: "schedule_home_tour"
                    condition: "lead created"
                skip_conditions: []
                common_errors:
                  - error: "Server error string shown in popover (e.g. duplicate email)"
                    resolution: "Read the server message; fix the field and retry."
                    evidence: "fe/components/add-lead.tsx — onError popover"
                escalation_conditions: []
                evidence:
                  - source: "fe/components/add-lead.tsx:175-244 — handleSubmitAddLeadData"
                    kind: "implementation"
                  - source: "fe/model/crm/user.model.ts:155-224 — CreateLeadSchema(false)"
                    kind: "schema_validation"
                  - source: "fe/utils/createDocumentsFromS3.ts — seeds allOnboardingDocsForSeniors"
                    kind: "implementation"
                unresolved_questions: []
          - task_id: "home_tour"
            display_number: "1.b"
            title: "CRM — Home Tour"
            description: "Schedule the facility tour (optional) and record its outcome. Scheduling alone does not complete the tour milestone — marking it finished does."
            path: "{APP_BASE_URL}/crm"
            actor_roles: ["PCHO", "HomeAdmin"]
            subject_type: "senior_lead"
            steps:
              - step_id: "schedule_home_tour"
                display_number: "1.b.1"
                order: 1
                title: "Schedule the tour"
                description: "Open the lead's tour modal (house icon on the row) and pick a future date/time; an email invitation is sent via POST /v1/user/home-tour — the lead must have an email."
                actor_roles: ["PCHO", "HomeAdmin"]
                applicability_conditions: ["Optional step — a lead can be onboarded without a tour."]
                path: "{APP_BASE_URL}/crm"
                route_parameters: {}
                menu_path: "Senior Leads row → tour (house) icon in the Milestones column"
                tab_or_section: "Schedule Home Tour modal"
                ui_action: "Tour icon opens screen 1; Save sends the invite"
                prerequisites:
                  - "create_senior_lead completed"
                  - "lead.email set (the invite is emailed)"
                required_fields:
                  - field: "scheduleDate"
                    required: "yes"
                    rules: "must be a future date"
                  - field: "scheduleTime"
                    required: "yes"
                    rules: "combined date+time must be in the future"
                instructions:
                  - "Pick the tour date and time."
                  - "Save — the app emails the invitation and stores tourDateTime on the lead."
                gia_message: "If you're giving a facility tour, pick a date and time — I'll email the invite to the family."
                completion:
                  description: "tourDateTime is stored on the lead; the modal now opens on the 'Home Tour Status' screen."
                  verification_source: "GET /v1/user/{userId} → tourDateTime"
                  verification_rule: "tourDateTime is a non-null ISO datetime"
                  limitations: ["The tour icon stays grey until the tour is marked completed — colour is not proof of scheduling."]
                transitions:
                  - next_step_id: "record_tour_outcome"
                    condition: "tour scheduled"
                  - next_step_id: "fill_biography"
                    condition: "user skips the tour entirely"
                    optional: true
                skip_conditions: ["User chooses not to run tours."]
                common_errors:
                  - error: "Past date/time rejected"
                    resolution: "Pick a future slot."
                    evidence: "fe/cypress/e2e/crm/senior-leads-home-tour.cy.ts"
                escalation_conditions: []
                evidence:
                  - source: "fe/components/home-tour.tsx; fe/cypress/e2e/crm/senior-leads-home-tour.cy.ts"
                    kind: "cypress_spec"
                unresolved_questions: []
              - step_id: "record_tour_outcome"
                display_number: "1.b.2"
                order: 2
                title: "Record the tour outcome"
                description: "After the visit, reopen the tour modal (now 'Home Tour Status'), mark whether it happened, and add notes. Marking it completed adds the 'tour' milestone (icon turns blue)."
                actor_roles: ["PCHO", "HomeAdmin"]
                applicability_conditions: ["Only when a tour was scheduled."]
                path: "{APP_BASE_URL}/crm"
                route_parameters: {}
                menu_path: "Senior Leads row → tour icon"
                tab_or_section: "Home Tour Status modal"
                ui_action: "Yes/No toggle + notes, then Save; 'Reschedule' returns to screen 1"
                prerequisites: ["schedule_home_tour"]
                required_fields:
                  - field: "isTourCompleted"
                    required: "yes"
                    rules: "boolean"
                  - field: "tourNotes"
                    required: "no"
                instructions:
                  - "Answer whether the tour took place."
                  - "Add notes — feedback, concerns, next steps."
                  - "Save; PUT /v1/user/{id} persists the outcome."
                gia_message: "After the visit, tell me if the tour happened and any notes — that's what turns the tour milestone blue."
                completion:
                  description: "isTourCompleted is true and the 'tour' milestone is on the lead."
                  verification_source: "GET /v1/user/{userId} → milestone array"
                  verification_rule: "milestone includes 'tour'"
                  limitations: []
                transitions:
                  - next_step_id: "fill_biography"
                    condition: "outcome saved"
                skip_conditions: ["No tour scheduled."]
                common_errors: []
                escalation_conditions: []
                evidence:
                  - source: "fe/cypress/e2e/crm/senior-leads-home-tour.cy.ts — icon colour vs screen header docstring"
                    kind: "cypress_spec"
                unresolved_questions: []
          - task_id: "intake_record"
            display_number: "1.c"
            title: "CRM — Complete the intake record"
            description: "Fill the lead record's Biography, Medical, and Careplan tabs at /crm/{leadId}. Each tab saves independently via PUT /v1/user/{id}; the Careplan → Overall Health save adds the 'onboarding' milestone (handshake icon turns blue)."
            path: "{APP_BASE_URL}/crm/{leadId}"
            actor_roles: ["PCHO", "HomeAdmin", "Lead"]
            subject_type: "senior_lead"
            steps:
              - step_id: "fill_biography"
                display_number: "1.c.1"
                order: 1
                title: "Complete Biography"
                description: "Personal Details (name, birthdate, gender required; SSN, contacts, address, emergency contact), Values & Beliefs, and Activity References accordions. Save PUTs the whole record."
                actor_roles: ["PCHO", "HomeAdmin", "Lead"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/crm/{leadId}"
                route_parameters:
                  leadId: "the lead's userId from application context"
                menu_path: "Senior Leads row → click the row or handshake icon"
                tab_or_section: "Tab 'Biography' → accordions: Personal Details, Values & Beliefs, Activity References"
                ui_action: "Button 'Save' on the tab"
                prerequisites: ["create_senior_lead"]
                required_fields:
                  - field: "firstName / lastName"
                    required: "yes"
                    rules: "alphabets/numbers only"
                  - field: "biography.personalDetails.birthdate"
                    required: "yes"
                    rules: "date, not in the future"
                  - field: "biography.personalDetails.gender"
                    required: "yes"
                    rules: "Female / Male / Other"
                  - field: "biography.personalDetails.ssn"
                    required: "no"
                    rules: "9 digits when provided; masked input"
                  - field: "biography.personalDetails.emergencyContactNumber"
                    required: "no"
                    rules: "exactly 10 digits when provided"
                  - field: "address.*"
                    required: "no"
                    rules: "Optional at a Personal Care Home."
                instructions:
                  - "Work accordion by accordion: Personal Details → Values & Beliefs → Activity References."
                  - "Save; the form validates UpdateLeadOrSeniorSchema and PUTs /v1/user/{id}."
                  - "A failed section flags its accordion header red with a warning icon — expand it and fix the field."
                gia_message: "On the Biography tab we'll capture who they are — legal name, birthdate, gender are required; everything else we can fill as you learn it."
                completion:
                  description: "Biography PUT succeeded; required personal details present on the record."
                  verification_source: "PUT /v1/user/{id} 200 + GET /v1/user/{id} biography object"
                  verification_rule: "personalDetails.birthdate and personalDetails.gender non-empty"
                  limitations: ["There is no explicit 'biography complete' flag — judged by fields saved."]
                transitions:
                  - next_step_id: "fill_medical"
                    condition: "biography saved (form auto-advances to Medical)"
                skip_conditions: []
                common_errors:
                  - error: "Accordion header turns red / WarningIcon"
                    resolution: "That section holds a validation error — expand and correct the flagged field."
                    evidence: "fe/cypress/e2e/crm/senior-leads-onboarding.cy.ts — assertSectionFlagged"
                escalation_conditions: []
                evidence:
                  - source: "fe/components/biography/*; fe/cypress/e2e/crm/senior-leads-onboarding.cy.ts §3–4"
                    kind: "cypress_spec"
                unresolved_questions: []
              - step_id: "fill_medical"
                display_number: "1.c.2"
                order: 2
                title: "Complete Medical"
                description: "General (Service Contacts providers table via 'Add Provider', pharmacy, food allergies), Mobility (transfer/lift/bedridden/non-ambulatory), and Overall Health flags."
                actor_roles: ["PCHO", "HomeAdmin", "Lead"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/crm/{leadId}"
                route_parameters:
                  leadId: "the lead's userId"
                menu_path: null
                tab_or_section: "Tab 'Medical' → accordions: General, Mobility, Overall Health"
                ui_action: "'Add Provider' modal for each service contact; 'Save' on the tab"
                prerequisites: ["fill_biography (recommended order; tabs can be visited in any order)"]
                required_fields:
                  - field: "medical.general.providers[].practiceNumber"
                    required: "conditional"
                    rules: "10 digits when a provider is added"
                  - field: "medical.mobility / overAllHealth flags"
                    required: "no"
                    rules: "yes/no toggles"
                instructions:
                  - "Add each doctor/provider via 'Add Provider' (category → type → practice name → 10-digit phone → Done)."
                  - "Record pharmacy name/number and food allergies."
                  - "Answer the Mobility and Overall Health yes/no questions; Save."
                gia_message: "Next, their medical picture — who their doctors are, which pharmacy, allergies, and how much physical help they need."
                completion:
                  description: "Medical PUT succeeded."
                  verification_source: "PUT /v1/user/{id} 200"
                  verification_rule: "medical object persisted"
                  limitations: ["No explicit completion flag."]
                transitions:
                  - next_step_id: "fill_careplan"
                    condition: "medical saved (form auto-advances to Careplan)"
                skip_conditions: []
                common_errors: []
                escalation_conditions: []
                evidence:
                  - source: "fe/components/medical/*; fe/cypress/e2e/crm/senior-leads-onboarding.cy.ts — Service Contacts note"
                    kind: "cypress_spec"
                unresolved_questions: []
              - step_id: "fill_careplan"
                display_number: "1.c.3"
                order: 3
                title: "Complete the Careplan (marks onboarding done)"
                description: "ADL'S sub-tab: set each daily-living service level (Independent / Monitor & Cue / Full Assistance), housekeeping preferences, and which vital signs to track. Overall Health sub-tab: behaviour patterns and physical-health levels. Saving Overall Health appends the 'onboarding' milestone."
                actor_roles: ["PCHO", "HomeAdmin", "Lead"]
                applicability_conditions:
                  - "'Use Template' (upload a DOCX/PDF care-plan form to auto-build custom service fields) is PCHO-only."
                path: "{APP_BASE_URL}/crm/{leadId}"
                route_parameters:
                  leadId: "the lead's userId"
                menu_path: null
                tab_or_section: "Tab 'Careplan' → sub-tabs 'ADL’S' and 'Overall Health'"
                ui_action: "Save on ADL'S, then Save on Overall Health"
                prerequisites: ["fill_biography"]
                required_fields:
                  - field: "carePlan.adl service levels"
                    required: "conditional"
                    rules: "one level per service in use"
                  - field: "custom template file"
                    required: "no"
                    rules: "DOCX or PDF, ≤ 20 MB"
                instructions:
                  - "Go service by service on ADL'S (bathing, dressing, eating, grooming, continence, toileting, mobility, oral care, plus any custom services) choosing the assistance level."
                  - "Set housekeeping options and tick the vital signs to monitor."
                  - "Optionally use 'Use Custom Template'/'Use Template' to extract services from the facility's own form."
                  - "Switch to Overall Health, answer behaviour and physical-health questions, Save — this stamps the 'onboarding' milestone."
                gia_message: "Now the care plan — for each daily activity, tell me if they're independent, need monitoring, or full assistance. Saving the health tab finishes intake."
                completion:
                  description: "The lead's milestone array contains 'onboarding' — the handshake icon on the board turns blue."
                  verification_source: "GET /v1/user/{id} → milestone"
                  verification_rule: "milestone includes 'onboarding'"
                  limitations: []
                transitions:
                  - next_step_id: "prepare_documents"
                    condition: "onboarding milestone stamped"
                skip_conditions: []
                common_errors: []
                escalation_conditions: []
                evidence:
                  - source: "fe/components/careplan/physical-health/index.tsx:95-97 — adds 'onboarding' milestone"
                    kind: "implementation"
                  - source: "fe/cypress/e2e/crm/senior-leads-onboarding.cy.ts — file header contract"
                    kind: "cypress_spec"
                unresolved_questions: []
          - task_id: "senior_documents"
            display_number: "1.d"
            title: "CRM — Prepare documents"
            description: "The Documents tab holds auto-seeded residential contract templates plus upload slots for personal documents (ID, SSN card, medication list, physician's certificate). Fill each template's blanks in the editor before e-sign."
            path: "{APP_BASE_URL}/crm/{leadId}"
            actor_roles: ["PCHO", "HomeAdmin", "Lead"]
            subject_type: "senior_lead"
            steps:
              - step_id: "prepare_documents"
                display_number: "1.d.1"
                order: 1
                title: "Fill the contract templates"
                description: "Open each seeded .docx (admission_agreement, house_rules, residents_rights, written_consents, resident_receipt_of_forms, designating_representative, advance_directive_checklist, in_the_event_of_death, inventory_list) and fill its fields in the document editor."
                actor_roles: ["PCHO", "HomeAdmin", "Lead"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/crm/{leadId}"
                route_parameters:
                  leadId: "the lead's userId"
                menu_path: null
                tab_or_section: "Tab 'Documents'"
                ui_action: "Per-document card → open/edit"
                prerequisites: ["create_senior_lead — documents are seeded at creation"]
                required_fields: []
                instructions:
                  - "Open each contract card; the editor shows the fillable fields."
                  - "Complete all six e-sign contracts (the first six listed); the other three are for the resident's file."
                gia_message: "Your contract templates are already on the record — open each one and fill in the blanks so it's ready to sign."
                completion:
                  description: "All contract documents have been opened and edited with required content."
                  verification_source: null
                  verification_rule: null
                  limitations: ["No per-document 'filled' flag is verified — the e-sign step fails server-side ('File not found' → 'Please edit all documents before starting e-sign') if templates are incomplete. Integration gap."]
                transitions:
                  - next_step_id: "upload_personal_documents"
                    condition: "templates filled"
                skip_conditions: []
                common_errors:
                  - error: "'Please edit all documents before starting e-sign.'"
                    resolution: "A contract file is missing/empty — finish the templates and retry e-sign."
                    evidence: "fe/cypress/e2e/crm/senior-leads-row-actions.cy.ts — missing-file translation"
                escalation_conditions: []
                evidence:
                  - source: "fe/components/documents/document-card-ui.tsx; fe/utils/constants.ts:980-990 allOnboardingDocsForSeniors"
                    kind: "implementation"
                unresolved_questions: ["Which of the 9 seeded docs are actually mandatory for admission — no enforcement found (BUSINESS_CONFIRMATIONS)."]
              - step_id: "upload_personal_documents"
                display_number: "1.d.2"
                order: 2
                title: "Upload personal documents"
                description: "Upload the resident's ID/driver's license, Social Security card, current medication list, and physician's certificate. All four are configured OPTIONAL (required: false) in documentRequiredForSenior — they are expected uploads, not enforced blockers. PDF/Word/JPG/PNG up to 50 MB."
                actor_roles: ["PCHO", "HomeAdmin", "Lead"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/crm/{leadId}"
                route_parameters:
                  leadId: "the lead's userId"
                menu_path: null
                tab_or_section: "Tab 'Documents'"
                ui_action: "Per-document card → upload"
                prerequisites: []
                required_fields:
                  - field: "dl / ssn / medication_list / physician_certificate"
                    required: "no"
                    rules: "PDF/DOC(X)/JPG/PNG ≤ 50 MB; all four optional per documentRequiredForSenior"
                instructions:
                  - "Upload DL, SSN card, medication_list, physician_certificate — all optional but expected."
                  - "The dashboard required-docs counters read documentRequiredForSenior; since every entry is required:false, no senior upload is counted as missing."
                gia_message: "Now upload their ID, Social Security card, the medication list, and the physician's certificate — they're optional, but the file should be complete."
                completion:
                  description: "Personal document cards show uploaded files."
                  verification_source: "GET /v1/user/{id} → documents[]"
                  verification_rule: "the four document names have a documentUrl"
                  limitations: ["No senior upload is enforced — nothing blocks Move to Clinical on missing personal docs (verified: documentRequiredForSenior marks all four required:false; no gate in lead-action-cell)."]
                transitions:
                  - next_step_id: "initiate_esign"
                    condition: "paperwork ready"
                skip_conditions: []
                common_errors: []
                escalation_conditions: []
                evidence:
                  - source: "fe/components/documents/document-card-ui.tsx"
                    kind: "implementation"
                  - source: "ONBOARDING_STEPS.md SL-4d (verified against document-card-ui.tsx)"
                    kind: "business_policy"
                unresolved_questions: []
          - task_id: "invite_and_sign"
            display_number: "1.e"
            title: "CRM — Signature and portal invite"
            description: "Send the contract envelope for e-signature and email the portal invite. Order is flexible — most homes sign the contract first, then invite."
            path: "{APP_BASE_URL}/crm"
            actor_roles: ["PCHO", "HomeAdmin"]
            subject_type: "senior_lead"
            steps:
              - step_id: "initiate_esign"
                display_number: "1.e.1"
                order: 1
                title: "Initiate e-sign"
                description: "Row ⋯ menu → 'Initiate e-sign' → Confirm sends POST /v1/initiate-esign for the seeded contract envelope."
                actor_roles: ["PCHO", "HomeAdmin"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/crm"
                route_parameters: {}
                menu_path: "Senior Leads row → ⋯ menu → 'Initiate e-sign'"
                tab_or_section: "confirmation dialog"
                ui_action: "Confirm"
                prerequisites:
                  - "lead.email set"
                  - "Neither docusignEnvelopeStatus nor onboardingESignEnvelopeStatus is 'completed'"
                  - "lead not marked 'lost'"
                required_fields: []
                instructions:
                  - "Choose Initiate e-sign → Confirm."
                  - "Success: 'E-sign initiated. Check dashboard for details.'"
                  - "The family signs in the emailed envelope; the envelope status lands back on the record."
                gia_message: "Ready to send the contract for signature — confirm and the family gets the envelope by email."
                completion:
                  description: "Envelope sent; later becomes 'completed' when signed."
                  verification_source: "GET /v1/user/{id} → onboardingESignEnvelopeStatus"
                  verification_rule: "status transitions pending/sent → completed"
                  limitations: ["Signature completion arrives asynchronously via the eSign processor — Gia must read the record, not assume."]
                transitions:
                  - next_step_id: "send_portal_invite"
                    condition: "envelope sent (or skipped)"
                skip_conditions: ["Contract already signed; home uses paper signatures."]
                common_errors:
                  - error: "'E-sign cannot be initiated without a recipient email.'"
                    resolution: "Add an email to the lead first (Biography tab)."
                    evidence: "fe/cypress/e2e/crm/senior-leads-row-actions.cy.ts"
                  - error: "'This contract has already been signed.'"
                    resolution: "Envelope already completed — nothing to send again."
                    evidence: "fe/cypress/e2e/crm/senior-leads-row-actions.cy.ts"
                  - error: "'Please edit all documents before starting e-sign.'"
                    resolution: "Backend found missing contract files — fill the templates / check S3."
                    evidence: "be/services/third-party-integrations/esign/initiate-esign.ts — validateContractFilesExist 404"
                escalation_conditions: ["Declined/expired envelopes — decide with the family whether to resend."]
                evidence:
                  - source: "fe/components/lead-action-cell.tsx:355-365"
                    kind: "implementation"
                  - source: "be/services/third-party-integrations/esign/initiate-esign.ts"
                    kind: "backend"
                unresolved_questions: []
              - step_id: "send_portal_invite"
                display_number: "1.e.2"
                order: 2
                title: "Onboard — send the portal invite"
                description: "Row ⋯ menu → 'Onboard' → Confirm POSTs /signup, emailing the lead a link to create their account."
                actor_roles: ["PCHO", "HomeAdmin"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/crm"
                route_parameters: {}
                menu_path: "Senior Leads row → ⋯ menu → 'Onboard'"
                tab_or_section: "confirmation dialog"
                ui_action: "Confirm"
                prerequisites:
                  - "lead.email set"
                  - "lead has never logged in (lastLoginTimestamp empty — else the item is greyed out)"
                  - "lead not marked 'lost'"
                required_fields: []
                instructions:
                  - "Choose Onboard → Confirm."
                  - "Success popover: 'Email sent successfully.'"
                  - "The resident/family registers and can then fill their own record."
                gia_message: "This emails the family their signup link so they can complete their side of the paperwork."
                completion:
                  description: "Signup invite sent; registration is proven when the lead's lastLoginTimestamp becomes non-null."
                  verification_source: "POST /signup 201; later GET /v1/user/{id} → lastLoginTimestamp"
                  verification_rule: "lastLoginTimestamp non-null after they register"
                  limitations: ["'Email sent' confirms delivery of the invite, not account activation."]
                transitions:
                  - next_step_id: "move_to_clinical"
                    condition: "invite sent (or contract signed first — order flexible)"
                skip_conditions: ["Lead already registered."]
                common_errors:
                  - error: "'Registration unsuccessful. Email address is required.'"
                    resolution: "Add the lead's email on the Biography tab."
                    evidence: "fe/cypress/e2e/crm/senior-leads-row-actions.cy.ts"
                  - error: "'User already exists'"
                    resolution: "The email already has an account — no invite needed."
                    evidence: "fe/cypress/e2e/crm/senior-leads-row-actions.cy.ts"
                escalation_conditions: []
                evidence:
                  - source: "fe/cypress/e2e/crm/senior-leads-row-actions.cy.ts — Onboard describe"
                    kind: "cypress_spec"
                unresolved_questions: []
              - step_id: "move_to_clinical"
                display_number: "1.e.3"
                order: 3
                title: "Move to Clinical"
                description: "Row ⋯ menu → 'Move to Clinical' → Confirm: PUT /v1/clinical/user/{id} creates the clinical record (status 'In Home'), then PUT /v1/user re-roles the record Lead → Senior, adds the 'contract' milestone, stamps contractCompletedOn, and routes to /clinical."
                actor_roles: ["PCHO", "HomeAdmin"]
                applicability_conditions: ["Hidden unless home.authorizedModules includes CLINICAL."]
                path: "{APP_BASE_URL}/crm"
                route_parameters: {}
                menu_path: "Senior Leads row → ⋯ menu → 'Move to Clinical'"
                tab_or_section: "confirmation dialog"
                ui_action: "Confirm"
                prerequisites:
                  - "CLINICAL in authorizedModules"
                  - "Lead not 'lost'"
                  - "Home under senior capacity (409 otherwise)"
                  - "Recommended: contract signed and intake tabs complete — not enforced in code"
                required_fields: []
                instructions:
                  - "Confirm — expect the success popover and a jump to the Clinical board."
                  - "This is the point of no return: the prospect becomes an active resident."
                gia_message: "Final step on the CRM side — this makes them an active resident and opens their clinical record."
                completion:
                  description: "Record role is 'Senior', milestone includes 'contract', a clinical record exists, and the user lands on /clinical."
                  verification_source: "GET /v1/user/{id} → role/milestone + GET clinical record"
                  verification_rule: "role === 'Senior' && milestone includes 'contract'"
                  limitations: []
                transitions:
                  - next_step_id: "add_first_medications"
                    condition: "success → routed to /clinical"
                skip_conditions: []
                common_errors:
                  - error: "'Home Capacity Reached!' modal"
                    resolution: "Home is at capacity — remove a resident or raise the limit with support."
                    evidence: "fe/cypress/e2e/crm/senior-leads-row-actions.cy.ts; be/services/update-user.ts 409"
                  - error: "Clinical write fails → CRM never updated (no half-promotion)"
                    resolution: "Fix the clinical error and retry."
                    evidence: "fe/cypress/e2e/crm/senior-leads-row-actions.cy.ts — 'never writes the CRM record'"
                escalation_conditions: ["Repeated 409s → capacity/ops issue."]
                evidence:
                  - source: "fe/cypress/e2e/crm/senior-leads-row-actions.cy.ts — Move to Clinical describes"
                    kind: "cypress_spec"
                  - source: "be/services/update-user.ts — capacity check"
                    kind: "backend"
                unresolved_questions: []
      - module_id: "clinical"
        display_number: "2"
        title: "Clinical — new resident"
        description: "Finish onboarding on the clinical side: the resident workspace at /clinical/{seniorId} holds Medication, MedPass, OTC, Care Plan, and Incident Report tabs."
        order: 2
        tasks:
          - task_id: "resident_medication_setup"
            display_number: "2.a"
            title: "Clinical — set up medications"
            description: "Add the resident's medications (manual entry or OCR extraction from the uploaded medication list) so the med-pass schedule can run."
            path: "{APP_BASE_URL}/clinical/{seniorId}"
            actor_roles: ["PCHO", "HomeAdmin", "Nurse"]
            subject_type: "senior"
            steps:
              - step_id: "add_first_medications"
                display_number: "2.a.1"
                order: 1
                title: "Add medications"
                description: "Medication tab → 'Add Medication' per drug (name, dosage, directions, start date, ≥1 timing slot), or use the OCR bulk path on the uploaded medication_list document (requires MEDICATION_OCR_EXTRACTION — PCHO/HomeAdmin)."
                actor_roles: ["PCHO", "HomeAdmin", "Nurse"]
                applicability_conditions: ["Requires medication tab permission; OCR path needs MEDICATION_OCR_EXTRACTION."]
                path: "{APP_BASE_URL}/clinical/{seniorId}?activeTab=Medication"
                route_parameters:
                  seniorId: "the resident's userId (same id as the former lead)"
                menu_path: "Side navigation → Clinical → resident row"
                tab_or_section: "Tab 'Medication'"
                ui_action: "'Add Medication' button; review table for OCR import"
                prerequisites: ["move_to_clinical", "medication_list uploaded (for OCR path)"]
                required_fields:
                  - field: "name"
                    required: "yes"
                  - field: "dosage"
                    required: "yes"
                  - field: "startdate"
                    required: "yes"
                    rules: "not in the past"
                  - field: "timings"
                    required: "yes"
                    rules: "≥ 1 med-pass slot"
                instructions:
                  - "Add each medication or confirm each row of the OCR review table."
                  - "Each row is editable/deletable later."
                gia_message: "Their medication list drives the daily med-pass — add each drug, or let me read the uploaded list and confirm each row."
                completion:
                  description: "The resident's clinical record holds ≥1 medication (or the user confirms none are needed)."
                  verification_source: "GET clinical record → medication[] (loaded on the senior record)"
                  verification_rule: "medication array populated per prescription"
                  limitations: []
                transitions:
                  - next_step_id: "review_face_sheet"
                    condition: "medications entered"
                skip_conditions: ["Resident takes no medications."]
                common_errors: []
                escalation_conditions: []
                evidence:
                  - source: "ONBOARDING_STEPS.md CS-1a; fe/pages/clinical/[seniorId].tsx"
                    kind: "implementation"
                  - source: "fe/utils/roles.ts — MEDICATION_OCR_EXTRACTION on PCHO/HomeAdmin"
                    kind: "frontend_permission"
                unresolved_questions: []
              - step_id: "review_face_sheet"
                display_number: "2.a.2"
                order: 2
                title: "Review the Face Sheet"
                description: "The one-page emergency summary: emergency contacts, allergies, insurance, DNR/advance-directive status, plus uploads for the insurance card, DNR form, and advance directive."
                actor_roles: ["PCHO", "HomeAdmin", "Senior"]
                applicability_conditions: ["Visible once the record is a Senior."]
                path: "{APP_BASE_URL}/clinical/{seniorId}"
                route_parameters:
                  seniorId: "the resident's userId"
                menu_path: null
                tab_or_section: "FaceSheet"
                ui_action: "Save"
                prerequisites: ["move_to_clinical"]
                required_fields:
                  - field: "emergency contacts, insurance details"
                    required: "conditional"
                    rules: "policy-driven; no hard gate verified"
                instructions:
                  - "Verify name, birthdate, room number, emergency contacts, allergies."
                  - "Enter insurance provider/member ID/Medicaid status and DNR/advance-directive status."
                  - "Upload the insurance card, DNR form, and advance directive scans."
                gia_message: "Last thing — the emergency face sheet. Confirm contacts, allergies, insurance, and upload the insurance card and any DNR/advance-directive forms."
                completion:
                  description: "Face sheet saved; uploads attached."
                  verification_source: "GET /v1/user/{id} → facesheet record"
                  verification_rule: "facesheet fields persisted"
                  limitations: ["Which face-sheet fields are mandatory is policy, not enforced validation (unverified)."]
                transitions:
                  - next_step_id: null
                    condition: "senior onboarding complete — ongoing operations (MedPass logging, incident reports, care-plan service tracking) are NOT onboarding"
                skip_conditions: []
                common_errors: []
                escalation_conditions: []
                evidence:
                  - source: "ONBOARDING_STEPS.md SL-4e; fe/utils/constants.ts — FACESHEET_DOC_TYPES"
                    kind: "business_policy"
                unresolved_questions: []
    completion_conditions:
      - "role === 'Senior', milestone includes 'contract', clinical record exists, medications entered (or confirmed none), face sheet saved."
    unresolved_questions:
      - "Is e-signature completion required before Move to Clinical? Code does not enforce it (see BUSINESS_CONFIRMATIONS.md)."
  - flow_id: "caregiver_onboarding"
    flow_type: "individual_onboarding"
    title: "Onboard a caregiver (PCG)"
    description: "Create a care lead, attach hiring paperwork, e-sign, invite, then hire by moving them to clinical. Fully independent of senior and nurse onboarding."
    actor_roles: ["PCHO", "HomeAdmin"]
    subject_type: "caregiver_lead"
    entry_conditions: ["PCG contract templates present in the home's S3 folder."]
    initial_step_id: "create_care_lead"
    modules:
      - module_id: "crm"
        display_number: "1"
        title: "CRM — Care Leads"
        description: "Staff pipeline at /crm/pcg."
        order: 1
        tasks:
          - task_id: "create_care_lead_task"
            display_number: "1.a"
            title: "CRM — Add a Care Lead"
            description: "Create the applicant; the PCG hiring templates are auto-attached."
            path: "{APP_BASE_URL}/crm/pcg"
            actor_roles: ["PCHO", "HomeAdmin"]
            subject_type: "caregiver_lead"
            steps:
              - step_id: "create_care_lead"
                display_number: "1.a.1"
                order: 1
                title: "Add the care lead"
                description: "'Add New' on the Care Leads board; first/last name, email, and 10-digit mobile are all required (staff-lead base schema). Role is created as 'PCGLead'."
                actor_roles: ["PCHO", "HomeAdmin"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/crm/pcg"
                route_parameters: {}
                menu_path: "Side navigation → CRM → Care Leads"
                tab_or_section: "Add modal"
                ui_action: "Button 'Add New' → 'Save'"
                prerequisites: []
                required_fields:
                  - field: "firstName"
                    required: "yes"
                    rules: "alphabets/numbers only"
                  - field: "lastName"
                    required: "yes"
                  - field: "email"
                    required: "yes"
                    rules: "valid email — the invite goes here"
                  - field: "mobile"
                    required: "yes"
                    rules: "exactly 10 digits"
                instructions:
                  - "Fill the four fields; Save."
                  - "The indemnity_agreement, independent_contractor_offer, residents_rights, staff_receipt_of_forms templates seed onto the record."
                gia_message: "Let's add the caregiver applicant — I'll need their name, email, and phone for the invite."
                completion:
                  description: "A PCGLead row exists with the PCG onboarding documents attached."
                  verification_source: "GET /v1/users?userType=PCGLead list"
                  verification_rule: "row present on /crm/pcg"
                  limitations: []
                transitions:
                  - next_step_id: "prepare_pcg_documents"
                    condition: "lead created"
                skip_conditions: []
                common_errors: []
                escalation_conditions: []
                evidence:
                  - source: "fe/model/crm/user.model.ts — baseUsersSchema (email+mobile required); fe/cypress/e2e/crm/care-and-nurse-leads.cy.ts"
                    kind: "cypress_spec"
                unresolved_questions: []
              - step_id: "prepare_pcg_documents"
                display_number: "1.a.2"
                order: 2
                title: "Collect credentials and fill contracts"
                description: "On the care lead's Documents area: fill the four contract templates and upload required credentials — TB test (expiry), CPR & First Aid (expiry), background check — plus optional DL, SSN, resume."
                actor_roles: ["PCHO", "HomeAdmin", "PCGLead"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/crm/pcg/{pcgLeadId}"
                route_parameters:
                  pcgLeadId: "the care lead's userId"
                menu_path: "Care Leads row → record"
                tab_or_section: "Documents"
                ui_action: "document cards"
                prerequisites: ["create_care_lead"]
                required_fields:
                  - field: "tb_test"
                    required: "yes"
                    rules: "with expiry date"
                  - field: "cpr_and_first_aid"
                    required: "yes"
                    rules: "with expiry date"
                  - field: "background_check"
                    required: "yes"
                instructions:
                  - "Upload the three required credentials; optional DL/SSN/resume."
                  - "Fill the contract templates for signature."
                gia_message: "Upload their TB test, CPR/First-Aid card, and background check — those three are required — then we'll send the employment contract."
                completion:
                  description: "Required credential documents uploaded."
                  verification_source: "GET /v1/user/{id} → documents[]"
                  verification_rule: "tb_test, cpr_and_first_aid, background_check present"
                  limitations: ["'required' is per documentRequiredForPCG display config — no hard server gate before Move to Clinical verified."]
                transitions:
                  - next_step_id: "esign_pcg"
                    condition: "credentials in"
                skip_conditions: []
                common_errors: []
                escalation_conditions: []
                evidence:
                  - source: "fe/utils/constants.ts:999-1056 — documentRequiredForPCG, onboardingDocsForPCG"
                    kind: "implementation"
                unresolved_questions: []
              - step_id: "esign_pcg"
                display_number: "1.a.3"
                order: 3
                title: "Send employment contracts for e-sign"
                description: "Row ⋯ → 'Initiate e-sign' sends the PCG envelope (backend accepts PCGLead/PCG recipients)."
                actor_roles: ["PCHO", "HomeAdmin"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/crm/pcg"
                route_parameters: {}
                menu_path: "Care Leads row → ⋯ menu → 'Initiate e-sign'"
                tab_or_section: "confirmation dialog"
                ui_action: "Confirm"
                prerequisites: ["lead email set", "envelope not already completed"]
                required_fields: []
                instructions: ["Confirm; envelope goes to the applicant's email."]
                gia_message: "Sending their employment paperwork for signature now."
                completion:
                  description: "PCG envelope sent; completes when signed."
                  verification_source: "onboardingESignEnvelopeStatus on the record"
                  verification_rule: "→ 'completed'"
                  limitations: []
                transitions:
                  - next_step_id: "onboard_pcg"
                    condition: "envelope sent"
                skip_conditions: []
                common_errors: []
                escalation_conditions: []
                evidence:
                  - source: "fe/cypress/e2e/crm/care-and-nurse-leads.cy.ts; be initiate-esign.ts recipient roles"
                    kind: "cypress_spec"
                unresolved_questions: []
              - step_id: "onboard_pcg"
                display_number: "1.a.4"
                order: 4
                title: "Send the portal invite (Onboard)"
                description: "Row ⋯ → 'Onboard' emails the signup invite (same /signup flow as seniors)."
                actor_roles: ["PCHO", "HomeAdmin"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/crm/pcg"
                route_parameters: {}
                menu_path: "Care Leads row → ⋯ menu → 'Onboard'"
                tab_or_section: "confirmation dialog"
                ui_action: "Confirm"
                prerequisites: ["lead email set", "not previously logged in"]
                required_fields: []
                instructions: ["Confirm; invite emailed."]
                gia_message: "This emails the caregiver their account invite."
                completion:
                  description: "Invite sent; activation proven by lastLoginTimestamp."
                  verification_source: "POST /signup; lastLoginTimestamp"
                  verification_rule: "non-null after registration"
                  limitations: []
                transitions:
                  - next_step_id: "move_pcg_to_clinical"
                    condition: "invite sent"
                skip_conditions: ["Already registered."]
                common_errors: []
                escalation_conditions: []
                evidence:
                  - source: "fe/cypress/e2e/crm/care-and-nurse-leads.cy.ts"
                    kind: "cypress_spec"
                unresolved_questions: []
              - step_id: "move_pcg_to_clinical"
                display_number: "1.a.5"
                order: 5
                title: "Move to Clinical (hire)"
                description: "Row ⋯ → 'Move to Clinical' re-roles PCGLead → PCG with a single PUT /v1/user (no clinical write, unlike seniors) and routes to /clinical/pcg."
                actor_roles: ["PCHO", "HomeAdmin"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/crm/pcg"
                route_parameters: {}
                menu_path: "Care Leads row → ⋯ menu → 'Move to Clinical'"
                tab_or_section: "confirmation dialog"
                ui_action: "Confirm"
                prerequisites: []
                required_fields: []
                instructions: ["Confirm; the caregiver appears on the Care Team board at /clinical/pcg."]
                gia_message: "Confirming hires them — they'll show up on the Care Team board under Clinical."
                completion:
                  description: "role === 'PCG'; record listed at /clinical/pcg."
                  verification_source: "GET /v1/user/{id} → role"
                  verification_rule: "role === 'PCG'"
                  limitations: []
                transitions:
                  - next_step_id: "complete_caregiver_facesheet"
                    condition: "hired"
                skip_conditions: []
                common_errors: []
                escalation_conditions: []
                evidence:
                  - source: "fe/cypress/e2e/crm/care-and-nurse-leads.cy.ts — 'single PUT that re-roles the record'"
                    kind: "cypress_spec"
                unresolved_questions: []
      - module_id: "clinical"
        display_number: "2"
        title: "Clinical — Care Team record"
        description: "Finish the caregiver file at /clinical/pcg/{pcgId}."
        order: 2
        tasks:
          - task_id: "caregiver_record"
            display_number: "2.a"
            title: "Clinical — caregiver face sheet & documents"
            description: "Complete the credential face sheet and verify required documents."
            path: "{APP_BASE_URL}/clinical/pcg/{pcgId}"
            actor_roles: ["PCHO", "HomeAdmin", "PCG"]
            subject_type: "pcg"
            steps:
              - step_id: "complete_caregiver_facesheet"
                display_number: "2.a.1"
                order: 1
                title: "Complete the caregiver Face Sheet"
                description: "Contact details; background-check and TB-test status (Yes/No/Not on file); uploads for background check report, TB result, driver's license, CPR certificates."
                actor_roles: ["PCHO", "HomeAdmin", "PCG"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/clinical/pcg/{pcgId}"
                route_parameters:
                  pcgId: "the caregiver's userId"
                menu_path: "Clinical → Care Team row"
                tab_or_section: "FaceSheet tab + Documents tab"
                ui_action: "Save"
                prerequisites: ["move_pcg_to_clinical"]
                required_fields:
                  - field: "backgroundCheck / tbTestResult / drivingLicense / cprCertificate uploads"
                    required: "conditional"
                    rules: "policy-driven"
                instructions: ["Fill the face sheet and attach credential scans."]
                gia_message: "Finish their credential file — background check and TB status, plus scans of each certificate."
                completion:
                  description: "Face sheet saved with credential uploads."
                  verification_source: "GET /v1/user/{id} facesheet + documents"
                  verification_rule: "fields persisted"
                  limitations: []
                transitions:
                  - next_step_id: null
                    condition: "caregiver onboarding complete — scheduling them for shifts is ongoing HCM work, not onboarding"
                skip_conditions: []
                common_errors: []
                escalation_conditions: []
                evidence:
                  - source: "ONBOARDING_STEPS.md CT-3; fe/utils/constants.ts — CARE_TEAM_FACESHEET_DOC_TYPES"
                    kind: "business_policy"
                unresolved_questions: []
    completion_conditions:
      - "role === 'PCG', required credential docs uploaded, face sheet saved."
    unresolved_questions:
      - "Are the three credentials enforced before a PCG can be scheduled? (see BUSINESS_CONFIRMATIONS.md)"
  - flow_id: "nurse_onboarding"
    flow_type: "individual_onboarding"
    title: "Onboard a nurse"
    description: "Create a nurse lead, complete the hospice agreement, invite, assign seniors, and hire. Differs from caregiver onboarding: only one contract document, no face sheet on the clinical record, and no e-sign menu item (as-built)."
    actor_roles: ["PCHO", "HomeAdmin"]
    subject_type: "nurse_lead"
    entry_conditions: ["hospice_agreement template present in the home's S3 folder."]
    initial_step_id: "create_nurse_lead"
    modules:
      - module_id: "crm"
        display_number: "1"
        title: "CRM — Nurse Leads"
        description: "Nurse hiring pipeline at /crm/nurse."
        order: 1
        tasks:
          - task_id: "create_nurse_lead_task"
            display_number: "1.a"
            title: "CRM — Add and hire a Nurse Lead"
            description: "Create the applicant, complete the hospice agreement, invite them, optionally assign seniors, then move to clinical."
            path: "{APP_BASE_URL}/crm/nurse"
            actor_roles: ["PCHO", "HomeAdmin"]
            subject_type: "nurse_lead"
            steps:
              - step_id: "create_nurse_lead"
                display_number: "1.a.1"
                order: 1
                title: "Add the nurse lead"
                description: "'Add New' on /crm/nurse — first/last name, email, 10-digit mobile required. Role 'NurseLead'; hospice_agreement template seeded."
                actor_roles: ["PCHO", "HomeAdmin"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/crm/nurse"
                route_parameters: {}
                menu_path: "Side navigation → CRM → Nurse Leads"
                tab_or_section: "Add modal"
                ui_action: "'Add New' → 'Save'"
                prerequisites: []
                required_fields:
                  - field: "firstName / lastName / email / mobile"
                    required: "yes"
                    rules: "email + 10-digit mobile (base staff schema)"
                instructions: ["Fill fields; Save."]
                gia_message: "Add the nurse applicant — name, email, and phone."
                completion:
                  description: "NurseLead row exists at /crm/nurse."
                  verification_source: "GET /v1/users?userType=NurseLead"
                  verification_rule: "row present"
                  limitations: []
                transitions:
                  - next_step_id: "complete_hospice_agreement"
                    condition: "created"
                skip_conditions: []
                common_errors: []
                escalation_conditions: []
                evidence:
                  - source: "fe/model/crm/user.model.ts — CreateNurseOrNurseLeadSchema; fe/cypress/e2e/crm/care-and-nurse-leads.cy.ts"
                    kind: "cypress_spec"
                unresolved_questions: []
              - step_id: "complete_hospice_agreement"
                display_number: "1.a.2"
                order: 2
                title: "Complete the Hospice Agreement"
                description: "The only required nurse document — fill/sign the seeded hospice_agreement template on the lead's record."
                actor_roles: ["PCHO", "HomeAdmin", "NurseLead"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/crm/nurse/{nurseLeadId}"
                route_parameters:
                  nurseLeadId: "the nurse lead's userId"
                menu_path: "Nurse Leads row → record"
                tab_or_section: "Documents"
                ui_action: "document card → open/edit"
                prerequisites: ["create_nurse_lead"]
                required_fields:
                  - field: "hospice_agreement"
                    required: "yes"
                instructions: ["Open and complete the hospice agreement document."]
                gia_message: "The only required paper for a nurse is the hospice agreement — let's fill it in."
                completion:
                  description: "hospice_agreement filled/signed."
                  verification_source: "documents[] on the record"
                  verification_rule: "document present with content"
                  limitations: []
                transitions:
                  - next_step_id: "onboard_nurse"
                    condition: "agreement done"
                skip_conditions: []
                common_errors:
                  - error: "No 'Initiate e-sign' item on the nurse-lead ⋯ menu"
                    resolution: "As-built gap — the menu entry is commented out even though the backend accepts NurseLead recipients; sign the document in the editor or via the document card instead."
                    evidence: "fe/cypress/e2e/crm/care-and-nurse-leads.cy.ts file header"
                escalation_conditions: []
                evidence:
                  - source: "fe/utils/constants.ts:1043-1058 — documentRequiredForNurse, onboardingDocsForNurse"
                    kind: "implementation"
                unresolved_questions: ["Should nurse leads get e-sign? Backend supports it; the menu item is commented out (BUSINESS_CONFIRMATIONS)."]
              - step_id: "onboard_nurse"
                display_number: "1.a.3"
                order: 3
                title: "Send the portal invite (Onboard)"
                description: "Row ⋯ → 'Onboard' emails the signup invite."
                actor_roles: ["PCHO", "HomeAdmin"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/crm/nurse"
                route_parameters: {}
                menu_path: "Nurse Leads row → ⋯ menu → 'Onboard'"
                tab_or_section: "confirmation dialog"
                ui_action: "Confirm"
                prerequisites: ["email set", "not previously logged in"]
                required_fields: []
                instructions: ["Confirm; invite emailed."]
                gia_message: "This emails the nurse their account invite."
                completion:
                  description: "Invite sent; activation proven by lastLoginTimestamp."
                  verification_source: "POST /signup; lastLoginTimestamp"
                  verification_rule: "non-null after registration"
                  limitations: []
                transitions:
                  - next_step_id: "assign_seniors_to_nurse"
                    condition: "invite sent"
                skip_conditions: ["Already registered."]
                common_errors: []
                escalation_conditions: []
                evidence:
                  - source: "fe/cypress/e2e/crm/care-and-nurse-leads.cy.ts"
                    kind: "cypress_spec"
                unresolved_questions: []
              - step_id: "assign_seniors_to_nurse"
                display_number: "1.a.4"
                order: 4
                title: "Assign seniors"
                description: "Row ⋯ → 'Assign Seniors' opens a picker choosing which residents this nurse covers (associatedUserIds)."
                actor_roles: ["PCHO", "HomeAdmin"]
                applicability_conditions: ["Optional — a nurse can be hired with no assignments."]
                path: "{APP_BASE_URL}/crm/nurse"
                route_parameters: {}
                menu_path: "Nurse Leads row → ⋯ menu → 'Assign Seniors'"
                tab_or_section: "assignment picker"
                ui_action: "select residents → save"
                prerequisites: []
                required_fields: []
                instructions: ["Pick the residents this nurse is responsible for."]
                gia_message: "Optionally choose which residents this nurse will cover — you can change it later."
                completion:
                  description: "associatedUserIds saved on the nurse record."
                  verification_source: "GET /v1/user/{id} → associatedUserIds"
                  verification_rule: "array updated"
                  limitations: []
                transitions:
                  - next_step_id: "move_nurse_to_clinical"
                    condition: "assignments saved or skipped"
                skip_conditions: ["No assignments yet."]
                common_errors: []
                escalation_conditions: []
                evidence:
                  - source: "ONBOARDING_STEPS.md NL-3; fe/model/crm/user.model.ts — associatedUserIds on UpdateNurseOrNurseLeadSchema"
                    kind: "implementation"
                unresolved_questions: []
              - step_id: "move_nurse_to_clinical"
                display_number: "1.a.5"
                order: 5
                title: "Move to Clinical (hire)"
                description: "Row ⋯ → 'Move to Clinical' re-roles NurseLead → Nurse via a single PUT /v1/user and routes to /clinical/nurse."
                actor_roles: ["PCHO", "HomeAdmin"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/crm/nurse"
                route_parameters: {}
                menu_path: "Nurse Leads row → ⋯ menu → 'Move to Clinical'"
                tab_or_section: "confirmation dialog"
                ui_action: "Confirm"
                prerequisites: []
                required_fields: []
                instructions: ["Confirm; the nurse appears at /clinical/nurse."]
                gia_message: "Confirming hires the nurse — they'll appear on the Clinical nurses board."
                completion:
                  description: "role === 'Nurse'; listed at /clinical/nurse."
                  verification_source: "GET /v1/user/{id} → role"
                  verification_rule: "role === 'Nurse'"
                  limitations: ["Nurse clinical record is documents-only — there is no nurse face sheet (do not promise one)."]
                transitions:
                  - next_step_id: null
                    condition: "nurse onboarding complete"
                skip_conditions: []
                common_errors: []
                escalation_conditions: []
                evidence:
                  - source: "fe/cypress/e2e/crm/care-and-nurse-leads.cy.ts"
                    kind: "cypress_spec"
                unresolved_questions: []
    completion_conditions:
      - "role === 'Nurse', hospice agreement completed, invite sent."
    unresolved_questions:
      - "Is 'Assign Seniors' expected before or after hiring? (see BUSINESS_CONFIRMATIONS.md)"
```

---

## How Gia should use this file

This file describes **rules and routes, not runtime state**. The application must supply: current `homeType`, the signed-in role, the selected home, the active subject record (`leadId`/`userId`), the current flow/step, verified completed steps, and any blockers. Gia reads that context and explains progress; the backend remains the source of truth for permissions, validation, and saved state.

A click, page visit, or the user saying "done" does **not** prove a step completed — check `completion.verification_source` (usually `GET /v1/user/{id}` fields such as `milestone`, `role`, `lastLoginTimestamp`, `documents[]`, `onboardingESignEnvelopeStatus`).

## Roles at a Personal Care Home

| Role | Who they are | In onboarding |
|---|---|---|
| `PCHO` | Home owner | Administers all onboarding |
| `HomeAdmin` | Home administrator | Administers all onboarding (cannot mark leads lost) |
| `SalesRepresentative` / `SalesDirector` | Sales staff (sales-enabled homes only) | Pipeline work; can only mark leads **Lost** |
| `Lead` | Prospective resident | Subject; self-fills own record after invite |
| `Senior` | Resident | Subject post-promotion; edits own record |
| `PCGLead` → `PCG` | Caregiver applicant → caregiver | Subject of caregiver flow |
| `NurseLead` → `Nurse` | Nurse applicant → nurse | Subject of nurse flow |
| `ComplianceGuest` | External reviewer | Onboarded via `/crm/complianceguest`; outside CRM/Clinical scope |

## The three independent onboarding flows

Senior, caregiver, and nurse onboarding are **separate flows**. Hiring a caregiver is *not* a prerequisite for onboarding a resident, and vice versa.

### 1. Senior (resident)

`/crm` → Add New → lead created with residential contract docs → optional home tour → `/crm/{leadId}` tabs (Biography → Medical → Careplan; saving Careplan → Overall Health stamps the `onboarding` milestone) → Documents tab (fill 6 e-sign templates + upload DL/SSN/medication list/physician certificate) → ⋯ menu `Initiate e-sign` → ⋯ `Onboard` (portal invite) → ⋯ `Move to Clinical` (Lead → Senior, `contract` milestone, routes to `/clinical`) → `/clinical/{seniorId}` medications + face sheet.

### 2. Caregiver

`/crm/pcg` → Add New (name/email/mobile all required) → documents (TB, CPR/First Aid, background check required) → `Initiate e-sign` → `Onboard` → `Move to Clinical` (single PUT → role `PCG`, routes to `/clinical/pcg`) → face sheet on `/clinical/pcg/{pcgId}`.

### 3. Nurse

`/crm/nurse` → Add New → hospice agreement (the only required doc) → `Onboard` → optional `Assign Seniors` → `Move to Clinical` (→ role `Nurse`, `/clinical/nurse`). **No e-sign menu item** — commented out in `nurse-action-cell.tsx` though the backend accepts nurse recipients.

## Document upload checklists by persona

CRM and Clinical each carry multiple personas, and **every persona has its own
document checklist** — configured in `fe/utils/constants.ts` and rendered by
`components/actions.tsx` (seniors), `components/pcg/pcg-actions.tsx` (caregivers),
and `components/nurse/nurse-actions.tsx` (nurses). This is the complete matrix
for a Personal Care Home:

| Persona | Record location | Seeded contract templates | Upload checklist | Required? |
|---|---|---|---|---|
| **Senior Lead → Senior** | `/crm/{id}`, then `/clinical/{id}` | `admission_agreement`, `house_rules`, `residents_rights`, `written_consents`, `resident_receipt_of_forms`, `designating_representative` (+ `advance_directive_checklist`, `in_the_event_of_death`, `inventory_list` for the file) | `dl`, `ssn`, `medication_list`, `physician_certificate` | **All optional** (`required: false` — `documentRequiredForSenior`, constants.ts:923-966; contract entries commented out) |
| **PCGLead → PCG** | `/crm/pcg/{id}`, then `/clinical/pcg/{id}` | `indemnity_agreement`, `independent_contractor_offer`, `residents_rights`, `staff_receipt_of_forms` | `tb_test` (expiry, 30-day alert), `cpr_and_first_aid` (expiry, 30-day alert), `background_check`, `dl`, `ssn`, `resume` | **TB / CPR / background check required**; rest optional (`documentRequiredForPCG`, constants.ts:999-1032) |
| **NurseLead → Nurse** | `/crm/nurse/{id}`, then `/clinical/nurse/{id}` | `hospice_agreement` | — (the agreement itself is the checklist) | **hospice_agreement required** (`documentRequiredForNurse`, constants.ts:1043-1049) |
| **PCHO** (own credentials) | profile / compliance area | — | `TB Test` (expiry, 7-day alert), `Resume`, `CPR & First Aid` (expiry, 30-day alert) | **All required** (`PCHODOCUMENTS`, constants.ts:1132-1153) |
| **Home** (facility file) | compliance documents | — | `Fire Alarm Inspection Report`, `State Permit`, `Certificate of Occupancy`, `Fire Drill and Safety Log` required; `Septic Inspection Certificate`, `Exit/Emergency Light Testing`, `Sprinkler Inspection Report` optional — all with expiry | Mixed (`HOMEDOCUMENTS`, constants.ts:1061-1111) — Compliance module, listed for completeness |

**Upload rules everywhere:** PDF / Word / JPG / PNG, ≤ 50 MB; documents with
`expiryDate`/`uploadType: "withExpiration"` ask for an expiry date and get an
automatic reminder inside `alertPeriodInDays`.

**Enforcement caveat:** "required" above is the frontend display config
(`isDocumentRequired` in `utils/documentUtils.ts`, unit-pinned in
`__tests__/unit/compliance/document-validity.test.ts`). No server-side gate
blocking onboarding on a missing upload was verified — treat required as policy
until confirmed (see BUSINESS_CONFIRMATIONS.md).

## Residential-specific document set

Seeded at lead creation (`utils/createDocumentsFromS3.ts` + `utils/constants.ts:980`):
`admission_agreement, house_rules, residents_rights, written_consents, resident_receipt_of_forms, designating_representative, advance_directive_checklist, in_the_event_of_death, inventory_list`.

The backend e-sign envelope (`be/utils/esign-utils.ts`) sends the **first six**; the other three are file documents.

## Milestones

`initial contact` (at creation) → `tour` (tour marked completed) → `onboarding` (Careplan → Overall Health save) → `contract` (Move to Clinical) — or `lost` (sales homes only, requires a lostCategory).

## Common failure messages Gia can explain

| Message | Meaning |
|---|---|
| `Registration unsuccessful. Email address is required.` | Onboard without an email on the record |
| `E-sign cannot be initiated without a recipient email.` | Same, for e-sign |
| `This contract has already been signed.` | Envelope already completed |
| `Please edit all documents before starting e-sign.` | Contract files missing in S3 |
| `Home Capacity Reached!` | 409 from backend — resident capacity full |
| `User already exists` | Email already has an account |
