# Gia Onboarding — In Home Care

> House type covered by this file: **`In Home Care`** (`home.homeType === "In Home Care"`).
> In-Home Care sends caregivers to the client's own home rather than admitting
> residents to a facility — clients, not rooms. This file is self-contained.
>
> Scope: **CRM and Clinical modules**. The flow is the same as a Personal Care
> Home; only the differences below are IHC-specific. Every shared behaviour is
> restated so this file works alone.

```yaml
schema_version: "1.0"
house_type_id: "in_home_care"
house_type_value: "In Home Care"
house_type_name: "In Home Care"
roles:
  - role_id: "PCHO"
    description: "Home owner/administrator of the In-Home Care agency — administers all onboarding."
    onboarding_responsibility: "administrator"
    represents: "The agency owner/operator."
    access_conditions:
      - "Holds the full permission set including INHOME_CARE_SENIORS, CLIENT_RATE, and all CRM/Clinical onboarding actions."
      - "Initial route '/' or sales dashboard / /crm depending on home.isSalesRequired."
    evidence:
      - source: "fe/utils/roles.ts — Permissions.PCHO (INHOME_CARE_SENIORS, CLIENT_RATE)"
        kind: "frontend_permission"
  - role_id: "HomeAdmin"
    description: "Agency administrator — same CRM/Clinical onboarding rights as PCHO, minus lost-lead and most RevOps items."
    onboarding_responsibility: "administrator"
    represents: "Office administrator."
    access_conditions:
      - "Holds INHOME_CARE_SENIORS; does not hold CRM_MARK_AS_LOST or CLIENT_RATE."
    evidence:
      - source: "fe/utils/roles.ts — Permissions.HomeAdmin"
        kind: "frontend_permission"
  - role_id: "SalesRepresentative"
    description: "Sales rep at a sales-enabled agency; pipeline work only."
    onboarding_responsibility: "none"
    represents: "Sales staff."
    access_conditions:
      - "Only Lost on senior-lead rows; no onboard/e-sign/move/delete."
    evidence:
      - source: "fe/utils/roles.ts — Permissions.SalesRepresentative"
        kind: "frontend_permission"
  - role_id: "SalesDirector"
    description: "Sales director — same CRM surface as a representative."
    onboarding_responsibility: "none"
    represents: "Sales lead."
    access_conditions: []
    evidence:
      - source: "fe/utils/roles.ts — Permissions.SalesDirector"
        kind: "frontend_permission"
  - role_id: "Lead"
    description: "Prospective client (senior lead) — subject of the client onboarding flow."
    onboarding_responsibility: "self_service"
    represents: "Prospective client / family."
    access_conditions:
      - "Own record only at /crm/{userId}."
    evidence:
      - source: "fe/utils/roles.ts — Permissions.Lead"
        kind: "frontend_permission"
  - role_id: "Senior"
    description: "An active client receiving care in their own home — created when a Lead is moved to clinical."
    onboarding_responsibility: "self_service"
    represents: "Client receiving in-home services."
    access_conditions:
      - "Views clinical tabs, medpass, careplan, own billing; edits own biography/face sheet."
    evidence:
      - source: "fe/utils/roles.ts — Permissions.Senior"
        kind: "frontend_permission"
  - role_id: "PCGLead"
    description: "Caregiver applicant — subject of the caregiver onboarding flow."
    onboarding_responsibility: "self_service"
    represents: "Caregiver applicant."
    access_conditions:
      - "Own record only at /crm/pcg/{userId}."
    evidence:
      - source: "fe/utils/roles.ts — Permissions.PCGLead"
        kind: "frontend_permission"
  - role_id: "PCG"
    description: "Active caregiver visiting clients' homes. IHC narrows their world: own schedule row only, only today's-shift clients on the senior/clinical boards, no face carousel."
    onboarding_responsibility: "self_service"
    represents: "Caregiver / care team member."
    access_conditions:
      - "IHC-only scoping: schedule board shows only their own row; clinical board shows only seniors assigned to today's shifts (empty → 'No shifts assigned to you today'); senior record hides the photo carousel; senior board shows only caregivers assigned via assigned_to_user_id."
    evidence:
      - source: "fe/cypress/e2e/home-types/in-home-care/inhome-care.cy.ts §§4–6,10; personas.cy.ts — IHC PCG persona"
        kind: "cypress_spec"
      - source: "fe/pages/clinical/index.tsx:44-107 — isInhomeCarePCGUser"
        kind: "implementation"
  - role_id: "NurseLead"
    description: "Nurse applicant — subject of the nurse onboarding flow."
    onboarding_responsibility: "self_service"
    represents: "Nurse applicant."
    access_conditions:
      - "Own record at /crm/nurse/{userId}."
    evidence:
      - source: "fe/utils/roles.ts — Permissions.NurseLead"
        kind: "frontend_permission"
  - role_id: "Nurse"
    description: "Active nurse. The IHC client-scoping rule is a PCG-only contract — the nurse board and filters are unchanged."
    onboarding_responsibility: "self_service"
    represents: "Nurse staff member."
    access_conditions:
      - "Same clinical visibility as at a Personal Care Home; the assignedUserIds filter behaves identically."
    evidence:
      - source: "fe/cypress/e2e/home-types/in-home-care/inhome-care.cy.ts §10 — 'the IHC rule is a PCG-only contract'"
        kind: "cypress_spec"
  - role_id: "ComplianceGuest"
    description: "External reviewer invited for compliance training; outside CRM/Clinical onboarding."
    onboarding_responsibility: "self_service"
    represents: "External auditor."
    access_conditions: []
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
      - action: "Onboard"
        access: "conditional"
        conditions: ["email required", "lastLoginTimestamp empty", "not 'lost'"]
      - action: "Move to Clinical"
        access: "conditional"
        conditions: ["CLINICAL in authorizedModules", "client capacity respected (409)", "backend geocodes the client's address on the senior update"]
      - action: "Initiate e-sign"
        access: "conditional"
        conditions: ["email required", "envelope not completed", "sends the IHC envelope — clinical_assessment, senior_bill_of_rights, service_agreement"]
      - action: "Lost"
        access: "conditional"
        conditions: ["sales-enabled homes only"]
      - action: "Delete"
        access: "allowed"
    conditions: ["'Add New' requires a 10-digit mobile at IHC (optional at PCH)."]
    enforcement_locations: ["navigation", "action", "backend"]
    evidence:
      - source: "fe/model/crm/user.model.ts:205-218 — mobile required when isInHomeCare"
        kind: "schema_validation"
      - source: "be/services/third-party-integrations/esign/initiate-esign.ts + be/utils/esign-utils.ts — IHC document config"
        kind: "backend"
      - source: "be/services/update-user.ts:182-196 — IHC geocoding on Lead/Senior update"
        kind: "backend"
  - module_id: "crm"
    page_id: "senior_leads_board"
    role_id: "HomeAdmin"
    view: "allowed"
    create: "allowed"
    edit: "allowed"
    other_actions:
      - action: "Onboard / Move to Clinical / Initiate e-sign / Delete"
        access: "conditional"
        conditions: ["same as PCHO"]
      - action: "Lost"
        access: "denied"
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
      - action: "Lost only"
        access: "conditional"
        conditions: ["sales-enabled homes only"]
    conditions: []
    enforcement_locations: ["navigation", "action"]
    evidence:
      - source: "fe/utils/roles.ts; fe/cypress/e2e/crm/senior-leads-row-actions.cy.ts"
        kind: "cypress_spec"
  - module_id: "crm"
    page_id: "lead_record"
    role_id: "Lead"
    view: "allowed"
    create: "denied"
    edit: "conditional"
    other_actions: []
    conditions: ["Own record only. At IHC, mobile and full address (street1, city, state, zipCode) are REQUIRED on Biography — schema blocks the save without them."]
    enforcement_locations: ["route", "action", "backend"]
    evidence:
      - source: "fe/model/crm/customer.model.ts:5-84 — PersonalDetails(isInHomeCare)"
        kind: "schema_validation"
      - source: "fe/cypress/e2e/home-types/in-home-care/README.md §8 — address-less biography never PUTs on IHC"
        kind: "cypress_spec"
  - module_id: "crm"
    page_id: "care_leads_board"
    role_id: "PCHO"
    view: "allowed"
    create: "allowed"
    edit: "allowed"
    other_actions:
      - action: "Onboard / Move to Clinical / Initiate e-sign / Delete"
        access: "conditional"
        conditions: ["same as PCH — PCG envelope docs are not home-type dependent"]
    conditions: []
    enforcement_locations: ["navigation", "action", "backend"]
    evidence:
      - source: "fe/cypress/e2e/crm/care-and-nurse-leads.cy.ts; be/utils/esign-utils.ts pcgDocumentConfig"
        kind: "backend"
  - module_id: "crm"
    page_id: "nurse_leads_board"
    role_id: "PCHO"
    view: "allowed"
    create: "allowed"
    edit: "allowed"
    other_actions:
      - action: "Onboard / Move to Clinical / Assign Seniors / Delete"
        access: "conditional"
      - action: "Initiate e-sign"
        access: "denied"
        conditions: ["menu entry commented out — as-built gap, backend supports it"]
    conditions: []
    enforcement_locations: ["navigation", "action", "backend"]
    evidence:
      - source: "fe/cypress/e2e/crm/care-and-nurse-leads.cy.ts — file header"
        kind: "cypress_spec"
  - module_id: "clinical"
    page_id: "seniors_board"
    role_id: "PCHO"
    view: "allowed"
    create: "denied"
    edit: "allowed"
    other_actions: []
    conditions: ["Full client board; no IHC restriction for admins."]
    enforcement_locations: ["navigation", "action"]
    evidence:
      - source: "fe/cypress/e2e/home-types/in-home-care/inhome-care.cy.ts — PCHO persona"
        kind: "cypress_spec"
  - module_id: "clinical"
    page_id: "seniors_board"
    role_id: "PCG"
    view: "conditional"
    create: "denied"
    edit: "conditional"
    other_actions:
      - action: "Incident report / OTC / medpass on assigned clients"
        access: "allowed"
    conditions:
      - "IHC: PCG sees only seniors assigned to today's shifts; empty state is 'No shifts assigned to you today'."
      - "No face carousel on the senior record at IHC."
    enforcement_locations: ["navigation", "action"]
    evidence:
      - source: "fe/pages/clinical/index.tsx:44-107; fe/cypress/e2e/home-types/in-home-care/inhome-care.cy.ts §§5–6"
        kind: "cypress_spec"
  - module_id: "clinical"
    page_id: "seniors_board"
    role_id: "Nurse"
    view: "allowed"
    create: "denied"
    edit: "conditional"
    other_actions: []
    conditions: ["Unchanged by home type — IHC scoping is PCG-only."]
    enforcement_locations: ["navigation", "action"]
    evidence:
      - source: "fe/cypress/e2e/home-types/in-home-care/inhome-care.cy.ts §10"
        kind: "cypress_spec"
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
      - source: "fe/pages/clinical/pcg/index.tsx"
        kind: "implementation"
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
      - source: "fe/pages/clinical/nurse/index.tsx"
        kind: "implementation"
flows:
  - flow_id: "house_setup_crm_clinical"
    flow_type: "house_setup"
    title: "Prepare the agency for CRM & Clinical onboarding"
    description: "One-time configuration preconditions before leads can be created, e-signed, or moved to clinical."
    actor_roles: ["PCHO", "HomeAdmin"]
    subject_type: "home"
    entry_conditions:
      - "Home record exists with homeType 'In Home Care'."
    initial_step_id: "confirm_home_modules"
    modules:
      - module_id: "crm"
        display_number: "1"
        title: "CRM readiness"
        description: "Modules, templates, and capacity."
        order: 1
        tasks:
          - task_id: "verify_modules_and_capacity"
            display_number: "1.a"
            title: "CRM — module access, templates, capacity"
            description: "Confirm licensing, upload IHC contract templates, set capacity."
            path: "{APP_BASE_URL}/crm"
            actor_roles: ["PCHO", "HomeAdmin"]
            subject_type: "home"
            steps:
              - step_id: "confirm_home_modules"
                display_number: "1.a.1"
                order: 1
                title: "Confirm authorized modules"
                description: "authorizedModules must include CRM and CLINICAL for the full flow."
                actor_roles: ["PCHO", "HomeAdmin"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/crm"
                route_parameters: {}
                menu_path: "Side navigation → CRM"
                tab_or_section: null
                ui_action: "none — read-only verification"
                prerequisites: []
                required_fields: []
                instructions: ["GET /v1/home/{homeId} → authorizedModules."]
                gia_message: "Your agency needs CRM and Clinical enabled before we onboard clients."
                completion:
                  description: "authorizedModules includes CRM and CLINICAL."
                  verification_source: "GET /v1/home/{homeId}"
                  verification_rule: "array contains 'CRM' and 'CLINICAL'"
                  limitations: ["Ops-managed — no in-app editor."]
                transitions:
                  - next_step_id: "confirm_contract_templates"
                    condition: "always"
                skip_conditions: []
                common_errors:
                  - error: "'Move to Clinical' absent from the row menu"
                    resolution: "CLINICAL not in authorizedModules — contact support."
                    evidence: "fe/cypress/e2e/crm/senior-leads-row-actions.cy.ts"
                escalation_conditions: ["Platform ops enables modules."]
                evidence:
                  - source: "fe/cypress/e2e/crm/senior-leads-row-actions.cy.ts"
                    kind: "cypress_spec"
                unresolved_questions: []
              - step_id: "confirm_contract_templates"
                display_number: "1.a.2"
                order: 2
                title: "Upload IHC contract templates"
                description: "The IHC senior set is clinical_assessment, senior_bill_of_rights, service_agreement (.docx) in {homeId}/Senior/; PCG and nurse templates are the same as residential. initiate-esign 404s when files are missing."
                actor_roles: ["PCHO", "HomeAdmin"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/crm"
                route_parameters: {}
                menu_path: null
                tab_or_section: null
                ui_action: "none — S3/ops task"
                prerequisites: ["confirm_home_modules"]
                required_fields: []
                instructions:
                  - "Senior (IHC): clinical_assessment.docx, senior_bill_of_rights.docx, service_agreement.docx."
                  - "PCG: indemnity_agreement, independent_contractor_offer, residents_rights, staff_receipt_of_forms."
                  - "Nurse: hospice_agreement."
                gia_message: "Your client paperwork is a different set than a residential home — clinical assessment, bill of rights, and the service agreement must be in the template folder first."
                completion:
                  description: "IHC templates exist in S3."
                  verification_source: "POST /v1/initiate-esign → validateContractFilesExist"
                  verification_rule: "no 404 missing-files response"
                  limitations: []
                transitions:
                  - next_step_id: "confirm_home_capacity"
                    condition: "always"
                skip_conditions: []
                common_errors:
                  - error: "'Please edit all documents before starting e-sign.'"
                    resolution: "Contract files missing in S3 or templates unfilled."
                    evidence: "be initiate-esign.ts — validateContractFilesExist"
                escalation_conditions: ["Template upload is ops-side."]
                evidence:
                  - source: "fe/utils/constants.ts:992-996 inHomeCareOnboardingDocsForSeniors; be/utils/esign-utils.ts inHomeCareSeniorDocumentConfig"
                    kind: "backend"
                unresolved_questions: []
              - step_id: "confirm_home_capacity"
                display_number: "1.a.3"
                order: 3
                title: "Set client capacity"
                description: "homeCapacity gates Move to Clinical with a 409 when full."
                actor_roles: ["PCHO", "HomeAdmin"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/crm"
                route_parameters: {}
                menu_path: null
                tab_or_section: null
                ui_action: "none — configuration"
                prerequisites: ["confirm_home_modules"]
                required_fields: []
                instructions: ["Set homeCapacity to the number of active clients the agency can serve."]
                gia_message: "Capacity limits how many active clients you can take — hitting it blocks the move to clinical."
                completion:
                  description: "homeCapacity set; active clients below it."
                  verification_source: "PUT /v1/clinical/user → no 409"
                  verification_rule: "no capacity 409"
                  limitations: []
                transitions:
                  - next_step_id: null
                    condition: "flow complete"
                skip_conditions: []
                common_errors:
                  - error: "'Home Capacity Reached!' modal"
                    resolution: "Raise the limit or free a client slot."
                    evidence: "be/services/update-user.ts 409"
                escalation_conditions: ["Ops/support raises capacity."]
                evidence:
                  - source: "be/services/update-user.ts"
                    kind: "backend"
                unresolved_questions: []
    completion_conditions: ["Modules authorized, IHC templates in S3, capacity set."]
    unresolved_questions: []
  - flow_id: "senior_onboarding"
    flow_type: "individual_onboarding"
    title: "Onboard a client (senior)"
    description: "Create a client lead, collect intake information (address and phone are mandatory at IHC), complete the IHC contract set, invite, sign, then move to clinical. Independent of staff onboarding."
    actor_roles: ["PCHO", "HomeAdmin"]
    subject_type: "senior_lead"
    entry_conditions:
      - "House setup complete."
      - "IHC lead creation requires a 10-digit mobile; biography requires a full service address — collect both up front."
    initial_step_id: "open_add_lead_modal"
    modules:
      - module_id: "crm"
        display_number: "1"
        title: "CRM — Senior (Client) Leads"
        description: "The client pipeline at /crm."
        order: 1
        tasks:
          - task_id: "create_senior_lead"
            display_number: "1.a"
            title: "CRM — Add a client lead"
            description: "Create the prospect; IHC seeds clinical_assessment, senior_bill_of_rights, service_agreement instead of the residential set."
            path: "{APP_BASE_URL}/crm"
            actor_roles: ["PCHO", "HomeAdmin"]
            subject_type: "senior_lead"
            steps:
              - step_id: "open_add_lead_modal"
                display_number: "1.a.1"
                order: 1
                title: "Open the Add Lead modal"
                description: "'Add New' on /crm (modal, no direct URL)."
                actor_roles: ["PCHO", "HomeAdmin"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/crm"
                route_parameters: {}
                menu_path: "Side navigation → CRM → Senior Leads"
                tab_or_section: null
                ui_action: "Button 'Add New'"
                prerequisites: []
                required_fields: []
                instructions: ["Open /crm, click 'Add New'."]
                gia_message: "Let's add the new client — open CRM and press 'Add New'."
                completion:
                  description: "Modal open."
                  verification_source: null
                  verification_rule: null
                  limitations: ["UI-only state."]
                transitions:
                  - next_step_id: "fill_lead_details"
                    condition: "modal opened"
                skip_conditions: []
                common_errors: []
                escalation_conditions: []
                evidence:
                  - source: "fe/components/add-lead.tsx"
                    kind: "implementation"
                unresolved_questions: []
              - step_id: "fill_lead_details"
                display_number: "1.a.2"
                order: 2
                title: "Enter details and save — phone required at IHC"
                description: "IHC label shows 'Phone Number *' and the schema requires a 10-digit mobile. Email optional now but required for invite/e-sign. Lead Owner select appears at sales-enabled homes."
                actor_roles: ["PCHO", "HomeAdmin"]
                applicability_conditions: ["IHC only: mobile mandatory."]
                path: "{APP_BASE_URL}/crm"
                route_parameters: {}
                menu_path: null
                tab_or_section: "Add Lead modal"
                ui_action: "Button 'Save'"
                prerequisites: ["open_add_lead_modal"]
                required_fields:
                  - field: "firstName / lastName"
                    required: "yes"
                    rules: "alphabets/numbers only"
                  - field: "mobile"
                    required: "yes"
                    rules: "exactly 10 digits — required at IHC (CreateLeadSchema(true))"
                    condition: "In Home Care only"
                  - field: "email"
                    required: "conditional"
                    rules: "valid format; required later for Onboard/e-sign"
                  - field: "isReferredByUserId"
                    required: "conditional"
                    condition: "sales-enabled homes; defaults to signed-in user"
                instructions:
                  - "Collect name, 10-digit phone, and email."
                  - "Save → 'New Senior Lead added successfully!', role 'Lead', milestone 'initial contact', IHC documents seeded."
                gia_message: "For in-home care I need their phone number too — it's required here — plus an email for the invite and contracts."
                completion:
                  description: "Lead row exists with 'initial contact' milestone and the three IHC onboarding docs."
                  verification_source: "GET /v1/user/{id}"
                  verification_rule: "role 'Lead', milestone includes 'initial contact', documents include clinical_assessment/senior_bill_of_rights/service_agreement"
                  limitations: []
                transitions:
                  - next_step_id: "schedule_home_tour"
                    condition: "lead created"
                skip_conditions: []
                common_errors:
                  - error: "'Mobile number must be exactly 10 digits' blocking Save"
                    resolution: "IHC requires the phone at creation — enter a real 10-digit number."
                    evidence: "fe/model/crm/user.model.ts:205-218; fe/components/add-lead.tsx:93-96"
                escalation_conditions: []
                evidence:
                  - source: "fe/components/add-lead.tsx:59-60,93-96,179-184"
                    kind: "implementation"
                  - source: "fe/cypress/e2e/home-types/in-home-care/inhome-care.cy.ts §7 — 'seeds the IHC onboarding documents into the new lead'"
                    kind: "cypress_spec"
                unresolved_questions: []
          - task_id: "home_visit"
            display_number: "1.b"
            title: "CRM — Home visit (tour)"
            description: "Same two-screen tour modal as residential — at IHC it represents the initial home visit/assessment. Optional."
            path: "{APP_BASE_URL}/crm"
            actor_roles: ["PCHO", "HomeAdmin"]
            subject_type: "senior_lead"
            steps:
              - step_id: "schedule_home_tour"
                display_number: "1.b.1"
                order: 1
                title: "Schedule the visit"
                description: "Tour icon → pick future date/time → invite emailed (lead must have an email). POST /v1/user/home-tour."
                actor_roles: ["PCHO", "HomeAdmin"]
                applicability_conditions: ["Optional."]
                path: "{APP_BASE_URL}/crm"
                route_parameters: {}
                menu_path: "Senior Leads row → tour icon"
                tab_or_section: "Schedule Home Tour modal"
                ui_action: "Save"
                prerequisites: ["lead created", "email on record"]
                required_fields:
                  - field: "scheduleDate + scheduleTime"
                    required: "yes"
                    rules: "combined must be future"
                instructions: ["Pick slot; save — invitation emailed."]
                gia_message: "If you do an initial home visit, schedule it here and I'll email the invite."
                completion:
                  description: "tourDateTime stored."
                  verification_source: "GET /v1/user/{id} → tourDateTime"
                  verification_rule: "non-null ISO datetime"
                  limitations: []
                transitions:
                  - next_step_id: "record_tour_outcome"
                    condition: "scheduled"
                  - next_step_id: "fill_biography"
                    condition: "skipped"
                    optional: true
                skip_conditions: ["No visit workflow."]
                common_errors: []
                escalation_conditions: []
                evidence:
                  - source: "fe/components/home-tour.tsx; fe/cypress/e2e/crm/senior-leads-home-tour.cy.ts"
                    kind: "cypress_spec"
                unresolved_questions: ["At IHC, is the 'Home Tour' a facility tour or the client's own home assessment? Label unchanged in code (BUSINESS_CONFIRMATIONS)."]
              - step_id: "record_tour_outcome"
                display_number: "1.b.2"
                order: 2
                title: "Record the outcome"
                description: "Mark whether the visit happened + notes; sets the 'tour' milestone."
                actor_roles: ["PCHO", "HomeAdmin"]
                applicability_conditions: ["Only when scheduled."]
                path: "{APP_BASE_URL}/crm"
                route_parameters: {}
                menu_path: "Senior Leads row → tour icon"
                tab_or_section: "Home Tour Status modal"
                ui_action: "Save"
                prerequisites: ["schedule_home_tour"]
                required_fields:
                  - field: "isTourCompleted"
                    required: "yes"
                  - field: "tourNotes"
                    required: "no"
                instructions: ["Yes/No + notes; Save → PUT /v1/user/{id}."]
                gia_message: "Did the visit happen? Mark it and jot any notes."
                completion:
                  description: "'tour' milestone present."
                  verification_source: "GET /v1/user/{id} → milestone"
                  verification_rule: "includes 'tour'"
                  limitations: []
                transitions:
                  - next_step_id: "fill_biography"
                    condition: "saved"
                skip_conditions: ["No visit scheduled."]
                common_errors: []
                escalation_conditions: []
                evidence:
                  - source: "fe/cypress/e2e/crm/senior-leads-home-tour.cy.ts"
                    kind: "cypress_spec"
                unresolved_questions: []
          - task_id: "intake_record"
            display_number: "1.c"
            title: "CRM — Complete the intake record"
            description: "Same three tabs as residential — but at IHC mobile and the full address (street1, city, state, zip) are enforced by the schema, and the backend geocodes the address on save."
            path: "{APP_BASE_URL}/crm/{leadId}"
            actor_roles: ["PCHO", "HomeAdmin", "Lead"]
            subject_type: "senior_lead"
            steps:
              - step_id: "fill_biography"
                display_number: "1.c.1"
                order: 1
                title: "Complete Biography — address required"
                description: "Personal Details: name, birthdate, gender required everywhere; at IHC mobile AND street1/city/state/zipCode are required and starred — the address is where care happens and the backend converts it to coordinates."
                actor_roles: ["PCHO", "HomeAdmin", "Lead"]
                applicability_conditions: ["IHC: address + mobile mandatory (PersonalDetails(true))."]
                path: "{APP_BASE_URL}/crm/{leadId}"
                route_parameters:
                  leadId: "the lead's userId"
                menu_path: "Senior Leads row → record"
                tab_or_section: "Tab 'Biography'"
                ui_action: "Button 'Save'"
                prerequisites: ["create_senior_lead"]
                required_fields:
                  - field: "firstName / lastName / birthdate / gender"
                    required: "yes"
                  - field: "mobile"
                    required: "yes"
                    rules: "10 digits"
                    condition: "IHC"
                  - field: "address.street1 / city / state / zipCode"
                    required: "yes"
                    rules: "full client address"
                    condition: "IHC only — optional at PCH"
                  - field: "ssn / emergency contacts / values & beliefs / activity references"
                    required: "no"
                instructions:
                  - "Fill Personal Details completely — the client's home address is essential at IHC."
                  - "On save the backend geocodes the address to latitude/longitude on the record."
                  - "Values & Beliefs and Activity References accordions are optional."
                gia_message: "For in-home care their address is required — that's where your caregivers go. The system maps it automatically when you save."
                completion:
                  description: "Biography saved with mobile + address; lat/long populated on the record."
                  verification_source: "GET /v1/user/{id} → biography.personalDetails.address + latitude/longitude"
                  verification_rule: "address fields present; coordinates set after save"
                  limitations: ["Geocoding happens server-side on Lead/Senior updates — a save can succeed while coordinates are absent if geocoding fails silently (not verified)."]
                transitions:
                  - next_step_id: "fill_medical"
                    condition: "saved (auto-advances)"
                skip_conditions: []
                common_errors:
                  - error: "Address fields flagged red / save blocked"
                    resolution: "IHC requires street, city, state, zip — enter the client's service address."
                    evidence: "fe/model/crm/customer.model.ts:74-84; cypress README §8"
                escalation_conditions: []
                evidence:
                  - source: "fe/model/crm/customer.model.ts:74-84; be/services/update-user.ts:182-196"
                    kind: "backend"
                  - source: "fe/cypress/e2e/home-types/in-home-care/inhome-care.cy.ts §8"
                    kind: "cypress_spec"
                unresolved_questions: []
              - step_id: "fill_medical"
                display_number: "1.c.2"
                order: 2
                title: "Complete Medical"
                description: "Identical to residential: providers via 'Add Provider', pharmacy, allergies, mobility, health flags."
                actor_roles: ["PCHO", "HomeAdmin", "Lead"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/crm/{leadId}"
                route_parameters:
                  leadId: "the lead's userId"
                menu_path: null
                tab_or_section: "Tab 'Medical'"
                ui_action: "'Add Provider' + 'Save'"
                prerequisites: ["fill_biography"]
                required_fields:
                  - field: "providers[].practiceNumber"
                    required: "conditional"
                    rules: "10 digits when a provider is added"
                instructions: ["Add providers, pharmacy, allergies; answer mobility/health flags; Save."]
                gia_message: "Same as residential — doctors, pharmacy, allergies, and how much physical help they need."
                completion:
                  description: "Medical saved."
                  verification_source: "PUT /v1/user/{id} 200"
                  verification_rule: "medical persisted"
                  limitations: []
                transitions:
                  - next_step_id: "fill_careplan"
                    condition: "saved"
                skip_conditions: []
                common_errors: []
                escalation_conditions: []
                evidence:
                  - source: "fe/components/medical/*; fe/cypress/e2e/crm/senior-leads-onboarding.cy.ts"
                    kind: "cypress_spec"
                unresolved_questions: []
              - step_id: "fill_careplan"
                display_number: "1.c.3"
                order: 3
                title: "Complete the Careplan (marks onboarding done)"
                description: "ADL'S sub-tab service levels + housekeeping + vitals; Overall Health sub-tab stamps the 'onboarding' milestone. 'Use Template' custom-form extraction is PCHO-only."
                actor_roles: ["PCHO", "HomeAdmin", "Lead"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/crm/{leadId}"
                route_parameters:
                  leadId: "the lead's userId"
                menu_path: null
                tab_or_section: "Tab 'Careplan' → 'ADL’S' + 'Overall Health'"
                ui_action: "Save on each sub-tab"
                prerequisites: ["fill_biography"]
                required_fields:
                  - field: "service levels"
                    required: "conditional"
                    rules: "per service in use"
                instructions:
                  - "Set assistance levels per ADL, housekeeping preferences, vitals to track."
                  - "Overall Health → behaviour + physical health → Save stamps 'onboarding'."
                gia_message: "Tell me how much help they need with each daily activity — saving the health tab finishes intake."
                completion:
                  description: "'onboarding' milestone present; handshake icon blue."
                  verification_source: "GET /v1/user/{id} → milestone"
                  verification_rule: "includes 'onboarding'"
                  limitations: []
                transitions:
                  - next_step_id: "prepare_documents"
                    condition: "milestone stamped"
                skip_conditions: []
                common_errors: []
                escalation_conditions: []
                evidence:
                  - source: "fe/components/careplan/physical-health/index.tsx:95-97"
                    kind: "implementation"
                unresolved_questions: []
          - task_id: "senior_documents"
            display_number: "1.d"
            title: "CRM — Prepare the IHC contract set"
            description: "IHC documents: clinical_assessment, senior_bill_of_rights, service_agreement (the three sent for e-sign) — plus the same personal uploads (ID, SSN, medication list, physician's certificate)."
            path: "{APP_BASE_URL}/crm/{leadId}"
            actor_roles: ["PCHO", "HomeAdmin", "Lead"]
            subject_type: "senior_lead"
            steps:
              - step_id: "prepare_documents"
                display_number: "1.d.1"
                order: 1
                title: "Fill the three IHC contract templates"
                description: "Open clinical_assessment, senior_bill_of_rights, and service_agreement in the editor and complete them."
                actor_roles: ["PCHO", "HomeAdmin", "Lead"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/crm/{leadId}"
                route_parameters:
                  leadId: "the lead's userId"
                menu_path: null
                tab_or_section: "Tab 'Documents'"
                ui_action: "document cards → open/edit"
                prerequisites: ["lead created — docs seeded at creation"]
                required_fields: []
                instructions:
                  - "Fill all three IHC templates."
                  - "Note: for these seeded docs the per-document e-sign icon appears only AFTER the envelope is completed — do not look for it before sending the envelope."
                gia_message: "Your client contract pack is three documents — the clinical assessment, the senior bill of rights, and the service agreement."
                completion:
                  description: "All three templates edited."
                  verification_source: null
                  verification_rule: null
                  limitations: ["No per-doc filled flag — initiate-esign fails server-side if files missing. Integration gap."]
                transitions:
                  - next_step_id: "upload_personal_documents"
                    condition: "templates filled"
                skip_conditions: []
                common_errors:
                  - error: "Expecting a per-document 'e-sign' button on service_agreement before sending"
                    resolution: "By design the seeded docs only expose the per-doc sign action once the envelope is completed."
                    evidence: "fe/components/documents/document-card-ui.tsx:686-699 — isInOnboardingDocsForSeniors ? isEsignEnvelopeCompleted : true"
                escalation_conditions: []
                evidence:
                  - source: "fe/components/documents/document-card-ui.tsx:683-699"
                    kind: "implementation"
                  - source: "fe/cypress/e2e/home-types/in-home-care/inhome-care.cy.ts §9 — 'service_agreement requires a completed envelope'"
                    kind: "cypress_spec"
                unresolved_questions: []
              - step_id: "upload_personal_documents"
                display_number: "1.d.2"
                order: 2
                title: "Upload personal documents"
                description: "Same as residential: ID, SSN card, medication list, physician's certificate (≤50MB, PDF/Word/image). All four configured OPTIONAL in documentRequiredForSenior — expected, not enforced."
                actor_roles: ["PCHO", "HomeAdmin", "Lead"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/crm/{leadId}"
                route_parameters:
                  leadId: "the lead's userId"
                menu_path: null
                tab_or_section: "Tab 'Documents'"
                ui_action: "document cards → upload"
                prerequisites: []
                required_fields:
                  - field: "dl / ssn / medication_list / physician_certificate"
                    required: "no"
                    rules: "PDF/DOCX/JPG/PNG ≤ 50 MB; all optional per documentRequiredForSenior"
                instructions: ["Upload each of the four cards — expected but not enforced."]
                gia_message: "Upload their ID, Social Security card, medication list, and physician's certificate — optional, but keep the file complete."
                completion:
                  description: "Personal uploads present."
                  verification_source: "documents[] on the record"
                  verification_rule: "the four document names have a documentUrl"
                  limitations: ["No server gate blocks Move to Clinical on missing personal docs (verified: all required:false)."]
                transitions:
                  - next_step_id: "initiate_esign"
                    condition: "paperwork ready"
                skip_conditions: []
                common_errors: []
                escalation_conditions: []
                evidence:
                  - source: "fe/components/documents/document-card-ui.tsx"
                    kind: "implementation"
                unresolved_questions: []
          - task_id: "invite_and_sign"
            display_number: "1.e"
            title: "CRM — Signature, invite, promote"
            description: "IHC envelope (3 docs) for e-sign, portal invite, then Move to Clinical which additionally geocodes the client address."
            path: "{APP_BASE_URL}/crm"
            actor_roles: ["PCHO", "HomeAdmin"]
            subject_type: "senior_lead"
            steps:
              - step_id: "initiate_esign"
                display_number: "1.e.1"
                order: 1
                title: "Initiate e-sign (IHC envelope)"
                description: "⋯ menu → 'Initiate e-sign' → Confirm sends the IHC envelope (clinical_assessment, senior_bill_of_rights, service_agreement)."
                actor_roles: ["PCHO", "HomeAdmin"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/crm"
                route_parameters: {}
                menu_path: "Senior Leads row → ⋯ → 'Initiate e-sign'"
                tab_or_section: "confirmation dialog"
                ui_action: "Confirm"
                prerequisites: ["email set", "envelope not completed", "not lost"]
                required_fields: []
                instructions: ["Confirm; family signs via emailed envelope."]
                gia_message: "Sending the three-part client agreement for signature."
                completion:
                  description: "Envelope sent → 'completed' when signed."
                  verification_source: "onboardingESignEnvelopeStatus on the record"
                  verification_rule: "→ 'completed'"
                  limitations: ["Async — read the record."]
                transitions:
                  - next_step_id: "send_portal_invite"
                    condition: "sent"
                skip_conditions: ["Already signed / paper process."]
                common_errors:
                  - error: "'E-sign cannot be initiated without a recipient email.'"
                    resolution: "Add email on Biography."
                    evidence: "fe/cypress/e2e/crm/senior-leads-row-actions.cy.ts"
                  - error: "'This contract has already been signed.'"
                    resolution: "Envelope completed."
                    evidence: "same spec"
                  - error: "'Please edit all documents before starting e-sign.'"
                    resolution: "IHC template files missing in S3 or unfilled."
                    evidence: "be initiate-esign.ts"
                escalation_conditions: []
                evidence:
                  - source: "be/utils/esign-utils.ts — inHomeCareSeniorDocumentConfig"
                    kind: "backend"
                unresolved_questions: []
              - step_id: "send_portal_invite"
                display_number: "1.e.2"
                order: 2
                title: "Onboard — send the portal invite"
                description: "Same /signup invite as residential; client must have email and no prior login."
                actor_roles: ["PCHO", "HomeAdmin"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/crm"
                route_parameters: {}
                menu_path: "Senior Leads row → ⋯ → 'Onboard'"
                tab_or_section: "confirmation dialog"
                ui_action: "Confirm"
                prerequisites: ["email set", "lastLoginTimestamp empty", "not lost"]
                required_fields: []
                instructions: ["Confirm → 'Email sent successfully.'"]
                gia_message: "This emails the client their portal invite."
                completion:
                  description: "Invite sent; lastLoginTimestamp proves activation."
                  verification_source: "POST /signup; lastLoginTimestamp"
                  verification_rule: "non-null after registration"
                  limitations: []
                transitions:
                  - next_step_id: "move_to_clinical"
                    condition: "sent"
                skip_conditions: ["Already registered."]
                common_errors:
                  - error: "'Registration unsuccessful. Email address is required.'"
                    resolution: "Add email first."
                    evidence: "fe/cypress/e2e/crm/senior-leads-row-actions.cy.ts"
                escalation_conditions: []
                evidence:
                  - source: "fe/cypress/e2e/crm/senior-leads-row-actions.cy.ts"
                    kind: "cypress_spec"
                unresolved_questions: []
              - step_id: "move_to_clinical"
                display_number: "1.e.3"
                order: 3
                title: "Move to Clinical"
                description: "⋯ → 'Move to Clinical' → Confirm: clinical write (status 'In Home'), then Lead → Senior + 'contract' milestone + contractCompletedOn, routes to /clinical. At IHC the backend also geocodes the biography address during the update."
                actor_roles: ["PCHO", "HomeAdmin"]
                applicability_conditions: ["CLINICAL in authorizedModules."]
                path: "{APP_BASE_URL}/crm"
                route_parameters: {}
                menu_path: "Senior Leads row → ⋯ → 'Move to Clinical'"
                tab_or_section: "confirmation dialog"
                ui_action: "Confirm"
                prerequisites:
                  - "Biography address present (needed for geocoding; required anyway at IHC)"
                  - "Under capacity"
                required_fields: []
                instructions: ["Confirm; lands on the Clinical board."]
                gia_message: "This makes them an active client — the system also maps their address for scheduling."
                completion:
                  description: "role 'Senior', 'contract' milestone, clinical record exists."
                  verification_source: "GET /v1/user/{id}"
                  verification_rule: "role === 'Senior' && 'contract' in milestone"
                  limitations: []
                transitions:
                  - next_step_id: "add_first_medications"
                    condition: "success"
                skip_conditions: []
                common_errors:
                  - error: "'Home Capacity Reached!'"
                    resolution: "Capacity 409 — free a slot or raise the limit."
                    evidence: "be/services/update-user.ts"
                escalation_conditions: []
                evidence:
                  - source: "fe/cypress/e2e/crm/senior-leads-row-actions.cy.ts; be/services/update-user.ts:182-196"
                    kind: "backend"
                unresolved_questions: []
      - module_id: "clinical"
        display_number: "2"
        title: "Clinical — new client"
        description: "Finish on the clinical side; identical tab set as residential."
        order: 2
        tasks:
          - task_id: "resident_medication_setup"
            display_number: "2.a"
            title: "Clinical — medications & face sheet"
            description: "Add medications then review the face sheet."
            path: "{APP_BASE_URL}/clinical/{seniorId}"
            actor_roles: ["PCHO", "HomeAdmin", "Nurse"]
            subject_type: "senior"
            steps:
              - step_id: "add_first_medications"
                display_number: "2.a.1"
                order: 1
                title: "Add medications"
                description: "Medication tab → 'Add Medication' (name, dosage, start date, ≥1 timing) or OCR from the uploaded medication list."
                actor_roles: ["PCHO", "HomeAdmin", "Nurse"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/clinical/{seniorId}?activeTab=Medication"
                route_parameters:
                  seniorId: "client's userId"
                menu_path: "Clinical → client row"
                tab_or_section: "Tab 'Medication'"
                ui_action: "'Add Medication'"
                prerequisites: ["move_to_clinical"]
                required_fields:
                  - field: "name / dosage / startdate / timings"
                    required: "yes"
                instructions: ["Add each med or confirm OCR rows."]
                gia_message: "Set up their medications so med-pass can run."
                completion:
                  description: "Medications on the clinical record."
                  verification_source: "clinical record medication[]"
                  verification_rule: "populated per prescription"
                  limitations: []
                transitions:
                  - next_step_id: "review_face_sheet"
                    condition: "done"
                skip_conditions: ["No medications."]
                common_errors: []
                escalation_conditions: []
                evidence:
                  - source: "fe/pages/clinical/[seniorId].tsx; ONBOARDING_STEPS.md CS-1a"
                    kind: "implementation"
                unresolved_questions: []
              - step_id: "review_face_sheet"
                display_number: "2.a.2"
                order: 2
                title: "Review the Face Sheet"
                description: "Emergency contacts, allergies, insurance, DNR/advance directive + uploads. Note: on the senior profile the residential 'Room Number' field is replaced by Mobile/Address at IHC."
                actor_roles: ["PCHO", "HomeAdmin", "Senior"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/clinical/{seniorId}"
                route_parameters:
                  seniorId: "client's userId"
                menu_path: null
                tab_or_section: "FaceSheet"
                ui_action: "Save"
                prerequisites: ["move_to_clinical"]
                required_fields: []
                instructions:
                  - "Confirm contacts/allergies/insurance; upload insurance card, DNR, advance directive."
                  - "There is no room number at IHC — the profile shows mobile + address instead."
                gia_message: "Finish the emergency face sheet — at an in-home care agency there's no room number; the client's contact details sit there instead."
                completion:
                  description: "Face sheet saved."
                  verification_source: "facesheet on record"
                  verification_rule: "fields persisted"
                  limitations: []
                transitions:
                  - next_step_id: null
                    condition: "client onboarding complete — assigning caregivers and scheduling shifts is ongoing HCM work, not onboarding"
                skip_conditions: []
                common_errors: []
                escalation_conditions: []
                evidence:
                  - source: "fe/cypress/e2e/clinical/senior-profile.cy.ts — IHC Room Number → Mobile/Address swap; ONBOARDING_STEPS.md SL-4e"
                    kind: "cypress_spec"
                unresolved_questions: []
    completion_conditions:
      - "role 'Senior', 'contract' milestone, address geocoded, medications set, face sheet saved."
    unresolved_questions:
      - "Is e-sign completion required before Move to Clinical? Not enforced in code."
  - flow_id: "caregiver_onboarding"
    flow_type: "individual_onboarding"
    title: "Onboard a caregiver (PCG)"
    description: "Same CRM flow as residential; the IHC difference appears after hiring — the caregiver sees only their own schedule row and today's assigned clients."
    actor_roles: ["PCHO", "HomeAdmin"]
    subject_type: "caregiver_lead"
    entry_conditions: ["PCG templates in S3."]
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
            title: "CRM — Add, sign, invite, hire"
            description: "Add care lead → credentials & contracts → e-sign → invite → Move to Clinical."
            path: "{APP_BASE_URL}/crm/pcg"
            actor_roles: ["PCHO", "HomeAdmin"]
            subject_type: "caregiver_lead"
            steps:
              - step_id: "create_care_lead"
                display_number: "1.a.1"
                order: 1
                title: "Add the care lead"
                description: "'Add New' — first/last name, email, 10-digit mobile required. Role 'PCGLead'; the four PCG contract templates seed."
                actor_roles: ["PCHO", "HomeAdmin"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/crm/pcg"
                route_parameters: {}
                menu_path: "CRM → Care Leads"
                tab_or_section: "Add modal"
                ui_action: "'Add New' → 'Save'"
                prerequisites: []
                required_fields:
                  - field: "firstName / lastName / email / mobile"
                    required: "yes"
                instructions: ["Fill and save."]
                gia_message: "Add the caregiver applicant — name, email, phone."
                completion:
                  description: "PCGLead row exists."
                  verification_source: "users list at /crm/pcg"
                  verification_rule: "row present"
                  limitations: []
                transitions:
                  - next_step_id: "prepare_pcg_documents"
                    condition: "created"
                skip_conditions: []
                common_errors: []
                escalation_conditions: []
                evidence:
                  - source: "fe/model/crm/user.model.ts — baseUsersSchema"
                    kind: "schema_validation"
                unresolved_questions: []
              - step_id: "prepare_pcg_documents"
                display_number: "1.a.2"
                order: 2
                title: "Credentials and contracts"
                description: "Required uploads: TB test (expiry), CPR & First Aid (expiry), background check; fill the four contract templates."
                actor_roles: ["PCHO", "HomeAdmin", "PCGLead"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/crm/pcg/{pcgLeadId}"
                route_parameters:
                  pcgLeadId: "care lead's userId"
                menu_path: "Care Leads row → record"
                tab_or_section: "Documents"
                ui_action: "document cards"
                prerequisites: ["create_care_lead"]
                required_fields:
                  - field: "tb_test / cpr_and_first_aid / background_check"
                    required: "yes"
                    rules: "first two with expiry"
                instructions: ["Upload credentials; fill contracts."]
                gia_message: "Upload their TB, CPR/First-Aid, and background check — required — then we send the contract."
                completion:
                  description: "Required docs uploaded."
                  verification_source: "documents[] on record"
                  verification_rule: "three required docs present"
                  limitations: ["Display-level 'required'; no verified server gate."]
                transitions:
                  - next_step_id: "esign_pcg"
                    condition: "done"
                skip_conditions: []
                common_errors: []
                escalation_conditions: []
                evidence:
                  - source: "fe/utils/constants.ts:999-1032 documentRequiredForPCG"
                    kind: "implementation"
                unresolved_questions: []
              - step_id: "esign_pcg"
                display_number: "1.a.3"
                order: 3
                title: "Initiate e-sign"
                description: "Sends the PCG contract envelope."
                actor_roles: ["PCHO", "HomeAdmin"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/crm/pcg"
                route_parameters: {}
                menu_path: "row ⋯ → 'Initiate e-sign'"
                tab_or_section: "confirmation dialog"
                ui_action: "Confirm"
                prerequisites: ["email set", "envelope not completed"]
                required_fields: []
                instructions: ["Confirm."]
                gia_message: "Sending their employment contract for signature."
                completion:
                  description: "Envelope sent."
                  verification_source: "onboardingESignEnvelopeStatus"
                  verification_rule: "→ 'completed' when signed"
                  limitations: []
                transitions:
                  - next_step_id: "onboard_pcg"
                    condition: "sent"
                skip_conditions: []
                common_errors: []
                escalation_conditions: []
                evidence:
                  - source: "fe/cypress/e2e/crm/care-and-nurse-leads.cy.ts; be initiate-esign.ts"
                    kind: "backend"
                unresolved_questions: []
              - step_id: "onboard_pcg"
                display_number: "1.a.4"
                order: 4
                title: "Send the portal invite"
                description: "⋯ → 'Onboard' emails the signup invite."
                actor_roles: ["PCHO", "HomeAdmin"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/crm/pcg"
                route_parameters: {}
                menu_path: "row ⋯ → 'Onboard'"
                tab_or_section: "confirmation dialog"
                ui_action: "Confirm"
                prerequisites: ["email", "no prior login"]
                required_fields: []
                instructions: ["Confirm."]
                gia_message: "Emailing their account invite."
                completion:
                  description: "Invite sent."
                  verification_source: "POST /signup; lastLoginTimestamp"
                  verification_rule: "non-null after registration"
                  limitations: []
                transitions:
                  - next_step_id: "move_pcg_to_clinical"
                    condition: "sent"
                skip_conditions: []
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
                description: "Single PUT re-roles PCGLead → PCG; routes to /clinical/pcg. After hiring, the IHC scoping applies: the caregiver sees only their own schedule row and only today's-shift clients."
                actor_roles: ["PCHO", "HomeAdmin"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/crm/pcg"
                route_parameters: {}
                menu_path: "row ⋯ → 'Move to Clinical'"
                tab_or_section: "confirmation dialog"
                ui_action: "Confirm"
                prerequisites: []
                required_fields: []
                instructions: ["Confirm; they land on the Care Team board."]
                gia_message: "Confirming hires them — at an in-home care agency they'll only see the clients assigned to their shifts."
                completion:
                  description: "role 'PCG'."
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
                  - source: "fe/cypress/e2e/crm/care-and-nurse-leads.cy.ts; fe/cypress/e2e/home-types/in-home-care/README.md §4–6"
                    kind: "cypress_spec"
                unresolved_questions: []
      - module_id: "clinical"
        display_number: "2"
        title: "Clinical — Care Team record"
        description: "Finish the caregiver file."
        order: 2
        tasks:
          - task_id: "caregiver_record"
            display_number: "2.a"
            title: "Clinical — caregiver face sheet"
            description: "Complete credentials face sheet at /clinical/pcg/{pcgId}."
            path: "{APP_BASE_URL}/clinical/pcg/{pcgId}"
            actor_roles: ["PCHO", "HomeAdmin", "PCG"]
            subject_type: "pcg"
            steps:
              - step_id: "complete_caregiver_facesheet"
                display_number: "2.a.1"
                order: 1
                title: "Complete the caregiver Face Sheet"
                description: "Credential statuses + uploads (background check, TB result, DL, CPR certificate). Then assign the caregiver to clients via shifts — that's how IHC client scoping works (assigned_to_user_id on shifts)."
                actor_roles: ["PCHO", "HomeAdmin", "PCG"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/clinical/pcg/{pcgId}"
                route_parameters:
                  pcgId: "caregiver's userId"
                menu_path: "Clinical → Care Team row"
                tab_or_section: "FaceSheet + Documents"
                ui_action: "Save"
                prerequisites: ["move_pcg_to_clinical"]
                required_fields: []
                instructions:
                  - "Fill the face sheet and uploads."
                  - "IHC note: a caregiver only sees a client once a shift assigns them (HCM scheduling with Select Client — outside CRM/Clinical onboarding)."
                gia_message: "Finish their credential file — then their client list comes from the shifts you assign them."
                completion:
                  description: "Face sheet saved."
                  verification_source: "facesheet + documents on record"
                  verification_rule: "persisted"
                  limitations: []
                transitions:
                  - next_step_id: null
                    condition: "done — shift assignment is HCM, not onboarding"
                skip_conditions: []
                common_errors: []
                escalation_conditions: []
                evidence:
                  - source: "ONBOARDING_STEPS.md CT-3; fe/model/hcm/user-shifts.model.ts — IHC client required on shifts"
                    kind: "schema_validation"
                unresolved_questions: []
    completion_conditions: ["role 'PCG', credentials uploaded, face sheet saved."]
    unresolved_questions: []
  - flow_id: "nurse_onboarding"
    flow_type: "individual_onboarding"
    title: "Onboard a nurse"
    description: "Same as residential: nurse lead → hospice agreement → invite → optional senior assignment → Move to Clinical. Nurse experience is unchanged by home type."
    actor_roles: ["PCHO", "HomeAdmin"]
    subject_type: "nurse_lead"
    entry_conditions: ["hospice_agreement template in S3."]
    initial_step_id: "create_nurse_lead"
    modules:
      - module_id: "crm"
        display_number: "1"
        title: "CRM — Nurse Leads"
        description: "Pipeline at /crm/nurse."
        order: 1
        tasks:
          - task_id: "create_nurse_lead_task"
            display_number: "1.a"
            title: "CRM — Add and hire a Nurse Lead"
            description: "Add → hospice agreement → invite → assign seniors → move to clinical."
            path: "{APP_BASE_URL}/crm/nurse"
            actor_roles: ["PCHO", "HomeAdmin"]
            subject_type: "nurse_lead"
            steps:
              - step_id: "create_nurse_lead"
                display_number: "1.a.1"
                order: 1
                title: "Add the nurse lead"
                description: "'Add New' — name, email, 10-digit mobile required. hospice_agreement seeded."
                actor_roles: ["PCHO", "HomeAdmin"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/crm/nurse"
                route_parameters: {}
                menu_path: "CRM → Nurse Leads"
                tab_or_section: "Add modal"
                ui_action: "'Add New' → 'Save'"
                prerequisites: []
                required_fields:
                  - field: "firstName / lastName / email / mobile"
                    required: "yes"
                instructions: ["Fill and save."]
                gia_message: "Add the nurse applicant — name, email, phone."
                completion:
                  description: "NurseLead row exists."
                  verification_source: "users list at /crm/nurse"
                  verification_rule: "row present"
                  limitations: []
                transitions:
                  - next_step_id: "complete_hospice_agreement"
                    condition: "created"
                skip_conditions: []
                common_errors: []
                escalation_conditions: []
                evidence:
                  - source: "fe/model/crm/user.model.ts — CreateNurseOrNurseLeadSchema"
                    kind: "schema_validation"
                unresolved_questions: []
              - step_id: "complete_hospice_agreement"
                display_number: "1.a.2"
                order: 2
                title: "Complete the Hospice Agreement"
                description: "The only required nurse document. There is no e-sign menu item on nurse leads (commented out) — sign/edit via the document card."
                actor_roles: ["PCHO", "HomeAdmin", "NurseLead"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/crm/nurse/{nurseLeadId}"
                route_parameters:
                  nurseLeadId: "nurse lead's userId"
                menu_path: "Nurse Leads row → record"
                tab_or_section: "Documents"
                ui_action: "document card"
                prerequisites: ["create_nurse_lead"]
                required_fields:
                  - field: "hospice_agreement"
                    required: "yes"
                instructions: ["Open, fill, save the hospice agreement."]
                gia_message: "Only one paper for nurses — the hospice agreement."
                completion:
                  description: "Agreement completed."
                  verification_source: "documents[] on record"
                  verification_rule: "present with content"
                  limitations: []
                transitions:
                  - next_step_id: "onboard_nurse"
                    condition: "done"
                skip_conditions: []
                common_errors:
                  - error: "Looking for 'Initiate e-sign' on the ⋯ menu"
                    resolution: "Not offered for nurse leads — commented out in nurse-action-cell.tsx."
                    evidence: "fe/cypress/e2e/crm/care-and-nurse-leads.cy.ts"
                escalation_conditions: []
                evidence:
                  - source: "fe/utils/constants.ts:1043-1058"
                    kind: "implementation"
                unresolved_questions: ["Should nurse leads have e-sign? Backend accepts NurseLead/Nurse recipients (BUSINESS_CONFIRMATIONS)."]
              - step_id: "onboard_nurse"
                display_number: "1.a.3"
                order: 3
                title: "Send the portal invite"
                description: "⋯ → 'Onboard' → Confirm."
                actor_roles: ["PCHO", "HomeAdmin"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/crm/nurse"
                route_parameters: {}
                menu_path: "row ⋯ → 'Onboard'"
                tab_or_section: "confirmation dialog"
                ui_action: "Confirm"
                prerequisites: ["email", "no prior login"]
                required_fields: []
                instructions: ["Confirm."]
                gia_message: "Emailing the nurse's account invite."
                completion:
                  description: "Invite sent."
                  verification_source: "POST /signup; lastLoginTimestamp"
                  verification_rule: "non-null after registration"
                  limitations: []
                transitions:
                  - next_step_id: "assign_seniors_to_nurse"
                    condition: "sent"
                skip_conditions: []
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
                description: "Optional picker associating clients to this nurse (associatedUserIds). Unchanged by home type."
                actor_roles: ["PCHO", "HomeAdmin"]
                applicability_conditions: ["Optional."]
                path: "{APP_BASE_URL}/crm/nurse"
                route_parameters: {}
                menu_path: "row ⋯ → 'Assign Seniors'"
                tab_or_section: "picker"
                ui_action: "select → save"
                prerequisites: []
                required_fields: []
                instructions: ["Pick the clients this nurse covers."]
                gia_message: "Optionally pick which clients this nurse is responsible for."
                completion:
                  description: "associatedUserIds saved."
                  verification_source: "GET /v1/user/{id}"
                  verification_rule: "array updated"
                  limitations: []
                transitions:
                  - next_step_id: "move_nurse_to_clinical"
                    condition: "done or skipped"
                skip_conditions: ["No assignments."]
                common_errors: []
                escalation_conditions: []
                evidence:
                  - source: "ONBOARDING_STEPS.md NL-3; fe/model/crm/user.model.ts associatedUserIds"
                    kind: "implementation"
                unresolved_questions: []
              - step_id: "move_nurse_to_clinical"
                display_number: "1.a.5"
                order: 5
                title: "Move to Clinical (hire)"
                description: "Single PUT re-roles NurseLead → Nurse; routes to /clinical/nurse."
                actor_roles: ["PCHO", "HomeAdmin"]
                applicability_conditions: []
                path: "{APP_BASE_URL}/crm/nurse"
                route_parameters: {}
                menu_path: "row ⋯ → 'Move to Clinical'"
                tab_or_section: "confirmation dialog"
                ui_action: "Confirm"
                prerequisites: []
                required_fields: []
                instructions: ["Confirm."]
                gia_message: "Confirming hires the nurse."
                completion:
                  description: "role 'Nurse'."
                  verification_source: "GET /v1/user/{id}"
                  verification_rule: "role === 'Nurse'"
                  limitations: ["No nurse face sheet exists — do not promise one."]
                transitions:
                  - next_step_id: null
                    condition: "done"
                skip_conditions: []
                common_errors: []
                escalation_conditions: []
                evidence:
                  - source: "fe/cypress/e2e/crm/care-and-nurse-leads.cy.ts"
                    kind: "cypress_spec"
                unresolved_questions: []
    completion_conditions: ["role 'Nurse', hospice agreement done, invite sent."]
    unresolved_questions: []
```

---

## How Gia should use this file

Same contract as every house-type file: this file holds **rules and routes, not runtime state**. The app supplies home type, signed-in role, selected record, current step, verified completions, and blockers. Gia explains progress from that context; the backend owns permissions, validation, and saved state. Check `completion.verification_source` before declaring a step done.

## What makes In Home Care different (verified deltas)

| Area | Personal Care Home | In Home Care | Evidence |
|---|---|---|---|
| Add Lead phone | optional | **required, 10 digits** | `model/crm/user.model.ts:205`, `components/add-lead.tsx:93` |
| Biography address | optional | **required** (street/city/state/zip) | `model/crm/customer.model.ts:74-84`, IHC README §8 |
| Seeded senior docs | 9 residential contracts | `clinical_assessment`, `senior_bill_of_rights`, `service_agreement` | `utils/constants.ts:992`, `utils/createDocumentsFromS3.ts` |
| E-sign envelope | 6 residential contracts | the 3 IHC contracts | `be/utils/esign-utils.ts` |
| Per-doc e-sign icon | shown when the onboarding-envelope list doc has a completed envelope | same rule — visible for `service_agreement` only after the envelope completes | `document-card-ui.tsx:686-699` |
| Backend on senior save | — | geocodes biography address → lat/long | `be/services/update-user.ts:182-196` |
| PCG clinical board | all clients | only today's-shift clients; empty → "No shifts assigned to you today" | `pages/clinical/index.tsx:107`, IHC spec §5, §10 |
| PCG schedule/senior boards | all rows | own row / assigned caregivers only | IHC spec §4 |
| PCG on client record | face carousel | **no carousel** | IHC spec §6 |
| Senior profile | Room Number field | Mobile/Address instead | `clinical/senior-profile.cy.ts` |
| Nurse experience | — | **unchanged** — IHC scoping is PCG-only | IHC spec §10 |
| Compliance home docs | "Home Documents" | "Business Documents" (County Business License, State Permit) | `utils/constants.ts:1114`, IHC README §11 |

## Document upload checklists by persona

Every persona in CRM/Clinical has its own checklist (`fe/utils/constants.ts`,
rendered by `components/actions.tsx`, `components/pcg/pcg-actions.tsx`,
`components/nurse/nurse-actions.tsx`). The **IHC matrix**:

| Persona | Record location | Seeded contract templates | Upload checklist | Required? |
|---|---|---|---|---|
| **Senior Lead → Senior (client)** | `/crm/{id}`, then `/clinical/{id}` | `clinical_assessment`, `senior_bill_of_rights`, `service_agreement` — all three go in the e-sign envelope | `dl`, `ssn`, `medication_list`, `physician_certificate` | **All optional** (`documentRequiredForSenior`, constants.ts:923-966) |
| **PCGLead → PCG** | `/crm/pcg/{id}`, then `/clinical/pcg/{id}` | `indemnity_agreement`, `independent_contractor_offer`, `residents_rights`, `staff_receipt_of_forms` (same as PCH — not home-type dependent) | `tb_test` (expiry), `cpr_and_first_aid` (expiry), `background_check`, `dl`, `ssn`, `resume` | **TB / CPR / background check required** (`documentRequiredForPCG`) |
| **NurseLead → Nurse** | `/crm/nurse/{id}`, then `/clinical/nurse/{id}` | `hospice_agreement` | — | **hospice_agreement required** (`documentRequiredForNurse`) |
| **PCHO** (own credentials) | profile / compliance area | — | `TB Test`, `Resume`, `CPR & First Aid` (with expiry) | **All required** (`PCHODOCUMENTS`) |
| **Home** (agency file) | compliance documents — labelled **"Business Documents"** at IHC | — | `County Business License`, `State Permit` — both required, with expiry | Both required (`InHomeCareDocuments`, constants.ts:1114-1129) |

**Upload rules:** PDF / Word / JPG / PNG, ≤ 50 MB; expiry-dated docs get reminder
alerts inside `alertPeriodInDays`.

**Enforcement caveat:** "required" is the frontend display config
(`isDocumentRequired`, `utils/documentUtils.ts`); no server gate blocking
onboarding on a missing upload was verified (BUSINESS_CONFIRMATIONS.md).

## The three independent onboarding flows

Same flows as a Personal Care Home — senior (client), caregiver, nurse — none depends on the other.

### 1. Client (senior)

`/crm` → Add New (**phone required**) → IHC contract docs seeded → optional home visit → `/crm/{leadId}` tabs (Biography **with required address** → Medical → Careplan → `onboarding` milestone) → Documents → `Initiate e-sign` (3-doc envelope) → `Onboard` → `Move to Clinical` (address geocoded) → `/clinical/{seniorId}` meds + face sheet.

### 2. Caregiver

`/crm/pcg` → Add New → credentials (TB, CPR/First Aid, background check) + contracts → e-sign → `Onboard` → `Move to Clinical` → `/clinical/pcg/{pcgId}` face sheet. After hiring, the caregiver sees only shift-assigned clients.

### 3. Nurse

`/crm/nurse` → Add New → hospice agreement → `Onboard` → optional `Assign Seniors` → `Move to Clinical`. Unchanged by home type; no e-sign menu item.

## Milestones

Identical to residential: `initial contact` → `tour` → `onboarding` → `contract` / `lost`.
