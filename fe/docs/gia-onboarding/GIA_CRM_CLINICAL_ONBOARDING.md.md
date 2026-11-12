# Gia onboarding and product knowledge: CRM and Clinical

Based on the supplied Assistly walkthrough. Routes use the dashboard origin. Role grants, house-type variations, exact transition rules, and completion APIs require verification against the application.

## How Gia and the portal use this file

- **Gia:** Use the guidance to explain what the user can do. For navigation, return an approved step ID from the portal's available steps. The portal opens the screen; the user performs actions such as sending invitations, initiating signatures, or saving records.
- **Portal:** Parse the single `json` block below. Resolve a step ID to its parent screen's path, authorize it against the current role, home, flow, and selected record, and use the same navigation handler for Gia and checklist clicks. Where an action requires a particular record, tab, or row menu, open the board and show the guidance until that deeper navigation has a verified mapping.
- **Progress:** A screen opening does not complete a step. A null `completion_check_key` means the completion check is unconfigured. Do not auto-complete or auto-advance those steps. Store user progress separately.
- **Scope:** Only flow entries appear on the onboarding checklist. Reference actions remain searchable product help. Sequences are suggested; the application determines applicability and permissions.

## Choose the onboarding flow

| Flow | When to use it |
|---|---|
| New senior lead | Follow the CRM intake path. Use **Onboard** if a portal invitation is needed and **Initiate E-Sign** where applicable. Move to Clinical once the record is eligible. |
| Existing resident migration | For a resident already with the home before it adopted Assistly Care, move the eligible CRM record to Clinical and verify it there. Skip e-sign. If the CRM record does not exist, create or locate it before proceeding. |
| Care lead intake | Create the care lead and manage their documents. Promotion and signature rules are outside this documented flow. |
| Nurse lead intake | Create the nurse lead. Further steps are outside this documented flow. |

**Onboard** invites the person to Assistly and requires an email for senior leads. **Move to Clinical** transfers the record. **Initiate E-Sign** sends documents for signature. Treat them as separate actions.

## CRM

### Senior Leads — `/crm`

- **Add a senior lead:** In Contacts, select **+ Add New**, enter the lead details, and save.
- **Review lead milestones:** Review Initial Contact, Home Tour, biographical information, and document e-sign milestones. Use them to identify what still needs attention.
- **Complete senior intake:** Select the lead’s name. Review Biography, Medical, Care Plan (ADLs and health), and Documents. Enter intake details in the applicable tabs and save.
- **Prepare senior agreements:** Select the lead’s name, open Documents, and add or prepare the applicable agreements. Confirm the required packet with your administrator if unclear.
- **Invite a senior lead:** With an email on the selected lead, open the row’s three-dot menu and select **Onboard** to invite them to the Assistly portal.
- **Initiate senior e-sign:** For a new senior lead using the signing workflow, review the documents attached to the lead before selecting **Initiate E-Sign** from the row menu; this sends the lead’s documents for signature. Skip this step for a resident already with the home before it adopted Assistly Care.
- **Move a senior lead to Clinical:** From the selected lead’s row menu, choose **Move to Clinical** when the record is eligible. For residents already with the home before Assistly Care, use this path without e-sign.
- **Send a bulk message:** In Contacts, use the select-all checkbox or select individual leads, then choose **Send Bulk Message**.
- **Review campaign history:** Open the **Campaigns History** tab to view previous campaigns.

### Referral Agents — `/crm/referral`

- **Add a referral agent:** Select **+ Add New**, enter the referral agent details, and save.
- **Manage referral campaigns:** Select recipients before sending a bulk message. Use campaign history to review prior campaigns where available.
- **Update a referral agent:** Set the status to Contacted, Not Contacted, Follow Up Required, or Not Interested and save. Use the row’s three-dot menu to edit or delete an agent.

### Care Leads — `/crm/pcg`

- **Add a care lead:** Select **+ Add New**, enter the care lead details, and save.
- **Manage care lead documents:** Select the care lead’s name to open their document management area. Add applicable documents; existing documents can be viewed, edited, or deleted by authorized users. Confirm which documents are required for this home.
- **Review available care lead actions:** Open the row’s three-dot menu. Guide users only to actions shown for their role and record; verify each action before adding it to the flow.

### Nurse Leads — `/crm/nurse`

- **Add a nurse lead:** Select **+ Add New**, enter the nurse lead details, and save. Further nurse lead steps need verification.

## Clinical

### Seniors — `/clinical`

- **Verify the resident in Clinical:** Switch to List View and locate the resident. Select their name to open details, including the Face Sheet. Verify the intended resident record exists in Clinical after transfer.
- **Find resident actions:** In List View, open the resident’s three-dot menu. Depending on access, look for Onboard, Add Medication, MedPass, Incident Report, or Initiate E-Sign for new documents.
- **Manage medication records:** Authorized staff can add, edit, or delete medication records, or upload a list for bulk extraction. Qualified staff should verify extracted entries before they are used for care. Gia explains navigation and does not change records or give clinical advice.

### Care Team — `/clinical/pcg`

- **Review a care team member:** Select the member’s name to open their record and Face Sheet. The row menu does not include Onboard per the supplied notes; verify other actions separately.

### Nurses — `/clinical/nurse`

- **Review a nurse record:** Select the nurse’s name to open their record and Face Sheet. The row menu does not include Onboard per the supplied notes; verify other actions separately.

## Portal configuration

```json
{
  "schema_version": "1.0.0",
  "house_type_scope": "unverified",
  "default_auto_advance": false,
  "modules": [
    {
      "module_id": "crm",
      "title": "CRM",
      "path": "/crm",
      "screens": [
        {
          "screen_id": "senior_leads",
          "title": "Senior Leads",
          "path": "/crm",
          "actions": [
            {
              "step_id": "crm.senior_leads.add",
              "title": "Add a senior lead",
              "guidance": "In Contacts, select **+ Add New**, enter the lead details, and save.",
              "kind": "onboarding",
              "completion_check_key": "lead_exists"
            },
            {
              "step_id": "crm.senior_leads.milestones",
              "title": "Review lead milestones",
              "guidance": "Review Initial Contact, Home Tour, biographical information, and document e-sign milestones. Use them to identify what still needs attention.",
              "kind": "onboarding",
              "completion_check_key": null
            },
            {
              "step_id": "crm.senior_leads.intake",
              "title": "Complete senior intake",
              "guidance": "Click on the lead\u2019s name. Review Biography, Medical, Care Plan (ADLs and health), and Documents. Enter intake details in the applicable tabs and save.",
              "kind": "onboarding",
              "completion_check_key": null
            },
            {
              "step_id": "crm.senior_leads.documents",
              "title": "Prepare senior agreements",
              "guidance": "Select the lead\u2019s name, open Documents, and add or prepare the applicable agreements. Confirm the required packet with your administrator if unclear.",
              "kind": "onboarding",
              "completion_check_key": null
            },
            {
              "step_id": "crm.senior_leads.invite",
              "title": "Invite a senior lead",
              "guidance": "With an email on the selected lead, open the row\u2019s three-dot menu and select **Onboard** to invite them to the Assistly portal.",
              "kind": "onboarding",
              "completion_check_key": "lead_onboarded"
            },
            {
              "step_id": "crm.senior_leads.esign",
              "title": "Initiate senior e-sign",
              "guidance": "For a new senior lead using the signing workflow, review the documents attached to the lead before selecting **Initiate E-Sign** from the row menu; this sends the lead\u2019s documents for signature. Skip this step for a resident already with the home before it adopted Assistly Care.",
              "kind": "onboarding",
              "completion_check_key": null
            },
            {
              "step_id": "crm.senior_leads.move",
              "title": "Move a senior lead to Clinical",
              "guidance": "From the selected lead\u2019s row menu, choose **Move to Clinical** when the record is eligible. For residents already with the home before Assistly Care, use this path without e-sign.",
              "kind": "onboarding",
              "completion_check_key": "record_in_clinical"
            },
            {
              "step_id": "crm.senior_leads.bulk",
              "title": "Send a bulk message",
              "guidance": "In Contacts, use the select-all checkbox or select individual leads, then choose **Send Bulk Message**.",
              "kind": "reference"
            },
            {
              "step_id": "crm.senior_leads.history",
              "title": "Review campaign history",
              "guidance": "Open the **Campaigns History** tab to view previous campaigns.",
              "kind": "reference"
            }
          ]
        },
        {
          "screen_id": "referral_agents",
          "title": "Referral Agents",
          "path": "/crm/referral",
          "actions": [
            {
              "step_id": "crm.referral_agents.add",
              "title": "Add a referral agent",
              "guidance": "Select **+ Add New**, enter the referral agent details, and save.",
              "kind": "reference"
            },
            {
              "step_id": "crm.referral_agents.campaign",
              "title": "Manage referral campaigns",
              "guidance": "Select recipients before sending a bulk message. Use campaign history to review prior campaigns where available.",
              "kind": "reference"
            },
            {
              "step_id": "crm.referral_agents.manage",
              "title": "Update a referral agent",
              "guidance": "Set the status to Contacted, Not Contacted, Follow Up Required, or Not Interested and save. Use the row\u2019s three-dot menu to edit or delete an agent.",
              "kind": "reference"
            }
          ]
        },
        {
          "screen_id": "care_leads",
          "title": "Care Leads",
          "path": "/crm/pcg",
          "actions": [
            {
              "step_id": "crm.care_leads.add",
              "title": "Add a care lead",
              "guidance": "Select **+ Add New**, enter the care lead details, and save.",
              "kind": "onboarding",
              "completion_check_key": "lead_exists"
            },
            {
              "step_id": "crm.care_leads.documents",
              "title": "Manage care lead documents",
              "guidance": "Select the care lead\u2019s name to open their document management area. Add applicable documents; existing documents can be viewed, edited, or deleted by authorized users. Confirm which documents are required for this home.",
              "kind": "onboarding",
              "completion_check_key": null
            },
            {
              "step_id": "crm.care_leads.menu",
              "title": "Review available care lead actions",
              "guidance": "Open the row\u2019s three-dot menu. Guide users only to actions shown for their role and record; verify each action before adding it to the flow.",
              "kind": "reference"
            }
          ]
        },
        {
          "screen_id": "nurse_leads",
          "title": "Nurse Leads",
          "path": "/crm/nurse",
          "actions": [
            {
              "step_id": "crm.nurse_leads.add",
              "title": "Add a nurse lead",
              "guidance": "Select **+ Add New**, enter the nurse lead details, and save. Further nurse lead steps need verification.",
              "kind": "onboarding",
              "completion_check_key": "lead_exists"
            }
          ]
        }
      ]
    },
    {
      "module_id": "clinical",
      "title": "Clinical",
      "path": "/clinical",
      "screens": [
        {
          "screen_id": "seniors",
          "title": "Seniors",
          "path": "/clinical",
          "actions": [
            {
              "step_id": "clinical.seniors.verify",
              "title": "Verify the resident in Clinical",
              "guidance": "Switch to List View and locate the resident. Select their name to open details, including the Face Sheet. Verify the intended resident record exists in Clinical after transfer.",
              "kind": "onboarding",
              "completion_check_key": "record_in_clinical"
            },
            {
              "step_id": "clinical.seniors.menu",
              "title": "Find resident actions",
              "guidance": "In List View, open the resident\u2019s three-dot menu. Depending on access, look for Onboard, Add Medication, MedPass, Incident Report, or Initiate E-Sign for new documents.",
              "kind": "reference"
            },
            {
              "step_id": "clinical.seniors.medications",
              "title": "Manage medication records",
              "guidance": "Authorized staff can add, edit, or delete medication records, or upload a list for bulk extraction. Qualified staff should verify extracted entries before they are used for care. Gia explains navigation and does not change records or give clinical advice.",
              "kind": "reference"
            }
          ]
        },
        {
          "screen_id": "care_team",
          "title": "Care Team",
          "path": "/clinical/pcg",
          "actions": [
            {
              "step_id": "clinical.care_team.details",
              "title": "Review a care team member",
              "guidance": "Select the member\u2019s name to open their record and Face Sheet. The row menu does not include Onboard per the supplied notes; verify other actions separately.",
              "kind": "reference"
            }
          ]
        },
        {
          "screen_id": "nurses",
          "title": "Nurses",
          "path": "/clinical/nurse",
          "actions": [
            {
              "step_id": "clinical.nurses.details",
              "title": "Review a nurse record",
              "guidance": "Select the nurse\u2019s name to open their record and Face Sheet. The row menu does not include Onboard per the supplied notes; verify other actions separately.",
              "kind": "reference"
            }
          ]
        }
      ]
    }
  ],
  "flows": [
    {
      "flow_id": "new_senior_lead",
      "steps": [
        "crm.senior_leads.add",
        "crm.senior_leads.milestones",
        "crm.senior_leads.intake",
        "crm.senior_leads.documents",
        "crm.senior_leads.invite",
        "crm.senior_leads.esign",
        "crm.senior_leads.move",
        "clinical.seniors.verify"
      ],
      "sequence_status": "suggested",
      "authorization": "server_required"
    },
    {
      "flow_id": "existing_resident_migration",
      "steps": [
        "crm.senior_leads.move",
        "clinical.seniors.verify"
      ],
      "sequence_status": "suggested",
      "authorization": "server_required"
    },
    {
      "flow_id": "care_lead_intake",
      "steps": [
        "crm.care_leads.add",
        "crm.care_leads.documents"
      ],
      "sequence_status": "suggested",
      "authorization": "server_required"
    },
    {
      "flow_id": "nurse_lead_intake",
      "steps": [
        "crm.nurse_leads.add"
      ],
      "sequence_status": "suggested",
      "authorization": "server_required"
    }
  ]
}
```

