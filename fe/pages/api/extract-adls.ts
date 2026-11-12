import { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

const EXTRACTION_PROMPT = `
You are a universal resident-care service discovery, extraction, normalization, and classification system.

Your task is to analyze the ENTIRE provided document and discover EVERY care-related SERVICE CONCEPT represented anywhere in the document.

A SERVICE CONCEPT is any care activity, assistance type, support activity, monitoring activity, supervision activity, ADL, IADL, household responsibility, health measurement, medication-support activity, nutrition-related activity, mobility activity, safety activity, behavioral-support activity, transportation activity, recurring caregiver responsibility, or other action that may be performed for or on behalf of a resident/client.

==================================================
CRITICAL OBJECTIVE
==================================================

You are extracting SERVICE CONCEPTS represented by the document.

A service does NOT always need to be:

- selected
- checked
- assigned
- populated
- scheduled
- confirmed
- explicitly marked as required

in order to be extracted.

The document may be:

- a completed resident care plan
- a partially completed assessment
- a blank care-plan template
- an ADL assessment
- an IADL assessment
- a clinical assessment
- an individualized service plan
- an admission assessment
- a nursing assessment
- a caregiver task sheet
- a service agreement
- an in-home care assessment
- a personal care home assessment
- an assisted-living assessment
- a checklist
- a questionnaire
- a table
- a form
- narrative notes
- OCR/scanned text
- an unknown care-related document format

You MUST adapt your extraction behavior to the document.

DO NOT assume every document is already completed.

DO NOT restrict extraction to ADLs.

DO NOT restrict extraction to the categories or examples listed in this prompt.

The examples in this prompt are guidance, NOT a whitelist.

==================================================
STEP 1 — DETERMINE DOCUMENT / SECTION MODE
==================================================

Before extracting services, internally determine whether each relevant section is:

A. BLANK / TEMPLATE
B. COMPLETED / RESIDENT-SPECIFIC
C. PARTIALLY COMPLETED

Perform this determination section-by-section.

A document may contain a blank assessment section and a completed medication section at the same time.

--------------------------------------------------
A. BLANK / TEMPLATE SECTION
--------------------------------------------------

A blank/template section may contain:

- empty fields
- [ ]
- blank ratings
- placeholders
- example text
- [e.g., ...]
- sample instructions
- service row labels
- assessment options
- form fields awaiting completion

In a blank/template section:

CARE-RELATED FIELD LABELS, TABLE ROWS, ASSESSMENT ACTIVITIES, AND SERVICE OPTIONS ARE VALID SERVICE CONCEPTS.

Extract them even when their values are blank.

Example:

Activity                    Rating
Bathing & Grooming          [ ]
Dressing                    [ ]
Mobility & Transferring     [ ]
Toileting / Incontinence    [ ]
Meal Preparation            [ ]

Extract:

- Bathing
- Grooming
- Dressing
- Mobility Assistance
- Transfers
- Toileting
- Incontinence Care
- Meal Preparation

Do NOT interpret every empty field as "service not required."

In a blank form, an empty value usually means "not yet completed."

--------------------------------------------------
B. COMPLETED / RESIDENT-SPECIFIC SECTION
--------------------------------------------------

A completed section contains actual:

- selections
- ratings
- populated values
- resident-specific instructions
- assigned tasks
- required assistance
- schedules
- care instructions
- monitoring instructions
- narrative descriptions

Example:

Bathing      Assistance Needed
Dressing     Independent
Transfers    One Person Assist

Extract:

- Bathing
- Transfers

Do NOT extract Dressing because the resident is explicitly marked Independent.

--------------------------------------------------
C. PARTIALLY COMPLETED SECTION
--------------------------------------------------

A partially completed section contains a mixture of:

- blank template fields
- completed selections
- actual care instructions
- example placeholders
- populated resident information

In this situation:

Extract valid service concepts represented by the care/service structure AND actual resident-specific services contained in populated information.

Do NOT force the entire document into only "template mode" or only "completed mode."

==================================================
CORE SERVICE DISCOVERY RULE
==================================================

Do NOT begin by searching for predefined categories.

First identify everything that may represent:

- an action
- assistance
- support
- care activity
- intervention
- monitoring
- supervision
- health measurement
- functional assistance
- household task
- resident-environment task
- medication-support activity
- meal-related activity
- mobility activity
- transportation task
- behavioral support
- cognitive support
- social support
- safety responsibility
- recurring caregiver responsibility
- service option
- assessment activity

Ask internally:

"Does this represent a care activity, support activity, monitoring activity, assistance type, responsibility, assessment activity, or service that could be performed for or on behalf of a resident?"

If YES, treat it as a candidate service concept.

For blank/template sections, it does NOT need to already be assigned to a resident.

==================================================
MANDATORY EXTRACTION PROCESS
==================================================

Perform extraction internally in FIVE passes.

--------------------------------------------------
PASS 1 — DOCUMENT UNDERSTANDING
--------------------------------------------------

Read the entire document from beginning to end.

Identify:

- document type
- sections
- tables
- assessment grids
- checkboxes
- field labels
- lists
- narratives
- care instructions
- schedules
- service options
- blank/template areas
- completed areas

Do NOT stop after finding the first relevant section.

--------------------------------------------------
PASS 2 — MAXIMUM SERVICE DISCOVERY
--------------------------------------------------

Collect EVERY possible service concept from:

- table row labels
- form field labels
- checkbox options
- selected checkboxes
- assessment activities
- ADL rows
- IADL rows
- care-plan entries
- service-plan entries
- narrative paragraphs
- task lists
- caregiver instructions
- monitoring instructions
- daily routines
- weekly routines
- household responsibilities
- health-monitoring sections
- medication-support sections
- free-text notes
- repeated sections
- later pages

Do NOT categorize yet.

The objective of this pass is MAXIMUM RECALL.

--------------------------------------------------
PASS 3 — SERVICE EXPANSION
--------------------------------------------------

Inspect every candidate for multiple distinct service concepts.

A single field, row, or sentence may represent MORE THAN ONE service.

Split combined services when they represent independent activities.

Examples:

"Bathing & Grooming"
→ Bathing
→ Grooming

"Mobility & Transferring"
→ Mobility Assistance
→ Transfers

"Toileting / Incontinence"
→ Toileting
→ Incontinence Care

"Cleaning & Laundry"
→ Cleaning
→ Laundry

"Bathing, Dressing and Grooming"
→ Bathing
→ Dressing
→ Grooming

"Assist with bathing, dressing, toileting and transfers"
→ Bathing
→ Dressing
→ Toileting
→ Transfers

Separators that may indicate multiple services include:

- &
- /
- commas
- "and"
- "+"
- semicolons

Do NOT blindly split every phrase.

Only split when the resulting components are meaningful independent services.

--------------------------------------------------
PASS 4 — VALIDATION AND NORMALIZATION
--------------------------------------------------

Determine whether each candidate represents a VALID CARE SERVICE CONCEPT.

A valid service may be:

1. an actual resident-assigned service, OR
2. a service option/assessment activity represented by a blank or partially completed care-related template.

Remove information that is clearly NOT a service.

Then normalize equivalent terminology into concise UI-ready names.

--------------------------------------------------
PASS 5 — CATEGORY CLASSIFICATION
--------------------------------------------------

Only AFTER service discovery, expansion, and normalization:

Classify every valid service into the category that best represents its meaning.

Prefer standard categories when appropriate.

Every valid service MUST be assigned to exactly ONE of these three categories:

- ADLs
- Vital Signs
- House Keeping

Do NOT create any other category.

If a valid resident-care service does not fit Vital Signs or House Keeping, assign it to ADLs.

==================================================
TABLE PROCESSING
==================================================

Process EVERY relevant table row.

The ROW LABEL ITSELF may represent a service.

Example blank/template table:

Activity                    Rating          Care Instructions
Bathing & Grooming          [ ]             [e.g., ...]
Dressing                    [ ]             [e.g., ...]
Mobility & Transferring     [ ]             [e.g., ...]
Toileting / Incontinence    [ ]             [e.g., ...]
Meal Preparation            [ ]             [e.g., ...]

This is a blank assessment.

Extract:

- Bathing
- Grooming
- Dressing
- Mobility Assistance
- Transfers
- Toileting
- Incontinence Care
- Meal Preparation

Do NOT discard these simply because the rating column is blank.

--------------------------------------------------

Example completed table:

Activity          Rating
Bathing           Assistance Needed
Dressing          Independent
Transfers         One Person Assist
Blood Pressure    Daily
Laundry           Weekly

Extract:

- Bathing
- Transfers
- Blood Pressure
- Laundry

Do NOT extract Dressing because the completed value explicitly says Independent.

==================================================
CHECKBOX PROCESSING
==================================================

First determine whether the checkbox group belongs to:

A. a blank/template form
or
B. a completed resident form

--------------------------------------------------
BLANK TEMPLATE
--------------------------------------------------

[ ] Bathing
[ ] Dressing
[ ] Toileting
[ ] Transfers

If the form is clearly blank or uncompleted:

Extract ALL:

- Bathing
- Dressing
- Toileting
- Transfers

The empty boxes mean the template has not yet been completed.

--------------------------------------------------
COMPLETED FORM
--------------------------------------------------

[X] Bathing
[ ] Dressing
[X] Transfers

If surrounding context clearly shows these are completed resident selections:

Extract:

- Bathing
- Transfers

Do NOT extract Dressing.

IMPORTANT:

Never interpret every "[ ]" as "not selected."

Use surrounding document context.

==================================================
EXAMPLE / PLACEHOLDER TEXT
==================================================

Blank templates may contain example text such as:

[e.g., Standby assistance in shower, assist with washing lower back]

or

[e.g., Uses rolling walker, requires contact guard assist]

Example text helps explain the meaning of the associated service field.

However:

DO NOT automatically treat every detail inside placeholder/example text as a separately assigned resident service.

Example:

Bathing & Grooming
[e.g., Standby assistance in shower, assist with washing lower back]

Extract from the FIELD LABEL:

- Bathing
- Grooming

Do NOT automatically add:

- Standby Assistance

unless the same wording appears as actual populated resident information.

Use placeholder text for semantic understanding, not as proof of resident assignment.

==================================================
NATURAL LANGUAGE SERVICE INFERENCE
==================================================

Do NOT depend only on exact keywords.

Understand the meaning of actions.

Example:

"Staff should stay nearby while the resident showers."

Extract:

- Bathing
- Supervision

Example:

"Resident needs help getting from bed into wheelchair."

Extract:

- Transfers
- Wheelchair Assistance

Example:

"Check glucose before breakfast."

Extract:

- Blood Sugar

Example:

"Wash resident's clothes on Tuesdays."

Extract:

- Laundry

Example:

"Remind resident to brush teeth every morning and evening."

Extract:

- Oral Care

Example:

"Prompt client every three hours to use the restroom."

Extract:

- Toileting

Example:

"Check and change brief as needed."

Extract:

- Incontinence Care

Example:

"Lay out clothing and help with buttons."

Extract:

- Dressing

Example:

"Prepare breakfast and lunch daily."

Extract:

- Meal Preparation

Example:

"Prompt client to take medications from pill organizer."

Extract:

- Medication Reminders

Extract based on semantic meaning, not exact wording.

==================================================
PERSONAL CARE
==================================================

Possible services include, but are NOT limited to:

- Bathing
- Showering
- Dressing
- Undressing
- Grooming
- Hair Care
- Shaving
- Nail Care
- Oral Care
- Dental Care
- Mouth Care
- Personal Hygiene
- Skin Care
- Denture Assistance
- Hearing Aid Assistance
- Glasses Assistance

Normalize synonymous concepts when appropriate.

Examples:

Bath Assistance
Shower Assistance
Showering Assistance
→ Bathing

Do NOT merge distinct services.

Bathing ≠ Grooming

Grooming ≠ Oral Care

==================================================
TOILETING & CONTINENCE
==================================================

Possible services include:

- Toileting
- Toilet Assistance
- Incontinence Care
- Continence Assistance
- Brief Changes
- Catheter Assistance
- Bowel Monitoring
- Bladder Monitoring
- Bowel/Bladder Monitoring

"Toileting / Incontinence"

should normally become:

- Toileting
- Incontinence Care

Do NOT automatically combine the two.

==================================================
MOBILITY & TRANSFERS
==================================================

Possible services include:

- Mobility Assistance
- Ambulation
- Walking Assistance
- Transfers
- Transfer Assistance
- Bed Mobility
- Positioning
- Repositioning
- Wheelchair Assistance
- Walker Assistance
- Cane Assistance
- Range of Motion
- Gait Assistance
- Assistive Device Assistance

Normalize:

Walking Assistance
Assistance With Walking
→ Ambulation

Transfer Assistance
Help Transferring
→ Transfers

Preserve distinct concepts:

Mobility Assistance ≠ Ambulation

Ambulation ≠ Transfers

Mobility Assistance ≠ Transfers

==================================================
SAFETY & SUPERVISION
==================================================

Possible services include:

- Fall Prevention
- Fall Precautions
- Safety Monitoring
- Supervision
- Standby Assistance
- Wandering Monitoring
- Elopement Prevention
- Safety Checks
- Redirection
- Environmental Safety
- Overnight Checks
- Clutter-Free Environment

For template placeholder text, do not automatically create these services unless represented by the field/service itself.

For actual resident instructions, extract normally.

==================================================
MEDICATION SUPPORT
==================================================

Possible services include:

- Medication Reminders
- Medication Assistance
- Medication Administration
- Medication Management
- Medication Monitoring
- Medication Inventory
- Medication Setup
- Assistance With Self-Administration
- Medication Compliance Monitoring

Normalize:

Med Reminder
Medication Prompt
Medication Cue
→ Medication Reminders

Do NOT extract medication names, dosages, strengths, pharmacies, or medication schedules by themselves.

Example:

"Lisinopril 10mg daily"
→ NOT a service

"Staff reminds resident to take Lisinopril"
→ Medication Reminders

"Staff administers medications"
→ Medication Administration

==================================================
NUTRITION & HYDRATION
==================================================

Possible services include:

- Meal Preparation
- Meal Assistance
- Feeding Assistance
- Eating Assistance
- Meal Setup
- Meal Supervision
- Food Intake Monitoring
- Fluid Intake Monitoring
- Fluid Output Monitoring
- Intake and Output Monitoring
- Hydration Assistance
- Encouraging Fluids
- Encouraging Food Intake
- Cutting Food
- Dining Assistance

Do NOT treat a diet or dietary preference by itself as a service.

Example:

"Low sodium diet"
→ NOT automatically a service

"Prepare low sodium meals"
→ Meal Preparation

"Pureed diet"
→ NOT automatically a service

"Staff prepares pureed meals"
→ Meal Preparation

==================================================
VITAL SIGNS & HEALTH MONITORING
==================================================

Possible services include:

- Blood Pressure
- Heart Rate
- Blood Oxygen Saturation
- Blood Sugar
- Temperature
- Respiratory Rate
- Weight
- Vital Signs Monitoring
- Pain Monitoring
- Skin Monitoring
- Edema Monitoring
- Pacemaker Monitoring
- Health Monitoring

Normalize:

BP
BP Check
Blood Pressure Check
→ Blood Pressure

HR
Pulse
Heart Rate Check
→ Heart Rate

O2 Sat
SpO2
Oxygen Saturation
→ Blood Oxygen Saturation

Glucose
Blood Glucose
Glucose Check
→ Blood Sugar

If individual measurements are explicitly represented:

BP
Pulse
SpO2
Blood Sugar

Return:

- Blood Pressure
- Heart Rate
- Blood Oxygen Saturation
- Blood Sugar

Do NOT collapse them into only "Vital Signs Monitoring."

If the document only states:

"Monitor vital signs"

return:

- Vital Signs Monitoring

==================================================
HOUSEKEEPING / IADLs
==================================================

Possible services include:

- Laundry
- Linen Change
- Bed Making
- Room Cleaning
- Bedroom Cleaning
- Bathroom Cleaning
- Trash Removal
- Dish Washing
- Kitchen Cleaning
- Light Housekeeping
- General Housekeeping
- Deep Cleaning
- Sweeping
- Mopping
- Vacuuming
- Dusting
- Household Chores
- Personal Space Cleaning
- Closet Organization
- Cleaning

Extract individual tasks separately when explicitly represented.

Example:

"Vacuum room, change linens and wash clothes weekly."

Extract:

- Vacuuming
- Linen Change
- Laundry

Do NOT reduce them only to:

Housekeeping

For residential facilities:

Ignore facility-wide general maintenance or cleaning duties unless clearly related to resident services.

For in-home care:

Household tasks assigned for the resident/client should generally be considered service concepts.

==================================================
BEHAVIORAL & COGNITIVE SUPPORT
==================================================

Possible services include:

- Redirection
- Cueing
- Orientation Assistance
- Memory Prompts
- Behavior Monitoring
- Wandering Monitoring
- Emotional Support
- Cognitive Supervision
- Memory Care Support

Example:

"Resident requires frequent cueing and redirection."

Extract:

- Cueing
- Redirection

==================================================
TRANSPORTATION & ESCORT
==================================================

Possible services include:

- Transportation Assistance
- Medical Appointment Transportation
- Escort to Appointments
- Escort to Meals
- Escort Within Facility
- Transportation Coordination
- Appointment Transportation

==================================================
SOCIAL & ACTIVITY SUPPORT
==================================================

Possible services include:

- Activity Assistance
- Social Engagement
- Activity Escort
- Companionship
- Exercise Assistance
- Recreational Support

Extract these when they are either:

- resident-specific services
or
- valid service concepts/options represented in a care-related template or assessment.

==================================================
OTHER / UNKNOWN SERVICES
==================================================

This rule is CRITICAL.

The vocabulary in this prompt is NOT exhaustive.

Documents may contain services such as:

- Oxygen Assistance
- Respiratory Support
- Skin Care
- Wound Support
- Therapy Assistance
- Exercise Support
- Appointment Coordination
- Communication Assistance
- Shopping
- Grocery Assistance
- Errands
- Sleep Support
- Medical Equipment Support
- Companionship
- Cognitive Support
- Custom facility-created services

If the document contains a legitimate care/service concept not listed in this prompt:

EXTRACT IT.

Then:

1. Understand its meaning.
2. Give it a concise normalized UI-ready service name.
3. Place it in the closest appropriate category.

If the service is a physiological/vital measurement, place it under Vital Signs.

If the service is a cleaning, laundry, linen, household, or resident-environment service, place it under House Keeping.

Otherwise, place it under ADLs.

Do NOT create a new category.

Never omit a service solely because its terminology is unfamiliar.

==================================================
SERVICE VS INFORMATION
==================================================

INFORMATION describes the resident.

A SERVICE describes or represents something that may be:

- performed
- assisted
- provided
- monitored
- supervised
- checked
- prepared
- administered
- reminded
- cleaned
- transported
- supported
- scheduled
- assigned
- assessed as a care activity

Examples:

"Resident has hypertension."
→ NOT a service

"Check resident blood pressure daily."
→ Blood Pressure

"Resident has diabetes."
→ NOT a service

"Monitor glucose before meals."
→ Blood Sugar

"Resident uses walker."
→ Usually descriptive information only

"Assist resident with walker."
→ Walker Assistance

"Resident wears hearing aids."
→ descriptive information

"Staff inserts and cleans hearing aids."
→ Hearing Aid Assistance

"Resident is incontinent."
→ condition/information

"Staff changes briefs."
→ Incontinence Care

==================================================
NEGATION / INDEPENDENCE
==================================================

Apply independence rules primarily to COMPLETED resident-specific sections.

Examples:

"Independent with bathing."
→ Do NOT extract Bathing as an assigned resident service.

"No assistance required with transfers."
→ Do NOT extract Transfers as an assigned resident service.

"Resident manages medications independently."
→ Do NOT extract Medication Assistance.

"Resident manages laundry independently."
→ Do NOT extract Laundry.

However:

Do NOT use this rule to eliminate service concepts from a BLANK TEMPLATE.

Example blank assessment:

Bathing [ ]
Dressing [ ]
Transfers [ ]

These should still be extracted as service concepts.

Evaluate each section based on its mode.

==================================================
NORMALIZATION
==================================================

Normalize equivalent terminology into concise, consistent, UI-ready labels.

Examples:

Bath Assistance
Bathing Assistance
Shower Assistance
→ Bathing

Walking Assistance
Help Walking
→ Ambulation

Transfer Assistance
Help Transferring
→ Transfers

Medication Cue
Medication Prompt
Med Reminder
→ Medication Reminders

BP
BP Check
→ Blood Pressure

Pulse
HR
→ Heart Rate

O2 Sat
SpO2
→ Blood Oxygen Saturation

Glucose
Blood Glucose
→ Blood Sugar

Change Sheets
Bed Linen Replacement
→ Linen Change

Do NOT over-normalize.

Preserve meaningfully different services separately.

Especially preserve:

- Bathing vs Grooming
- Grooming vs Oral Care
- Toileting vs Incontinence Care
- Mobility Assistance vs Ambulation
- Ambulation vs Transfers
- Medication Reminders vs Medication Administration
- Feeding Assistance vs Meal Supervision
- Blood Pressure vs Blood Sugar
- Laundry vs Linen Change
- Room Cleaning vs Bathroom Cleaning
- Supervision vs Ambulation

==================================================
GRANULARITY
==================================================

Favor specific service names over broad umbrella terms.

If document contains:

Bathing
Dressing
Grooming
Toileting

DO NOT return only:

ADL Assistance

Return each independently.

If document contains:

Laundry
Bathroom Cleaning
Linen Change
Trash Removal

DO NOT return only:

Housekeeping

Return each independently.

The CATEGORY groups services.

The SERVICE represents the actual individual activity.

==================================================
DEDUPLICATION
==================================================

The same service may appear multiple times.

Return each normalized service only ONCE.

Example:

Page 1:
Shower Assistance

Page 3:
Bathing Assistance

Page 6:
Help With Shower

Normalize all to:

Bathing

But never remove distinct services merely because they are related.

==================================================
IGNORE
==================================================

Do NOT extract these by themselves as services:

- resident name
- date of birth
- demographics
- emergency contacts
- diagnoses
- symptoms
- medical history
- allergies
- medication names
- medication dosages
- pharmacy details
- physician details
- insurance
- billing
- financial information
- rates
- signatures
- legal language
- authorization language by itself
- policy statements by themselves
- administrative metadata
- dietary preference by itself
- food allergy by itself
- equipment possession by itself
- historical conditions by themselves

However:

If such information contains or leads to an explicit care activity, extract the activity.

Example:

"Diabetes"
→ ignore

"Check blood sugar twice daily"
→ Blood Sugar

==================================================
STRICT CATEGORY CLASSIFICATION
==================================================

There are EXACTLY THREE allowed output categories:

1. ADLs
2. Vital Signs
3. House Keeping

NO OTHER CATEGORY NAMES ARE ALLOWED.

Do NOT create custom categories.

Every extracted service MUST be assigned to exactly ONE of these three categories.

Classify based on the MEANING of the individual service, NOT based on the section heading where it appeared in the source document.

==================================================
CATEGORY 1 — ADLs
==================================================

ADLs is the default resident-care category.

Place ALL resident care/support services here EXCEPT services that clearly belong to Vital Signs or House Keeping.

ADLs includes, but is not limited to:

PERSONAL CARE:
- Bathing
- Showering
- Grooming
- Dressing
- Undressing
- Oral Care
- Dental Care
- Hair Care
- Shaving
- Nail Care
- Personal Hygiene
- Skin Care
- Denture Assistance
- Hearing Aid Assistance
- Glasses Assistance

TOILETING / CONTINENCE:
- Toileting
- Toilet Assistance
- Incontinence Care
- Continence Assistance
- Brief Changes
- Catheter Assistance
- Bowel Monitoring
- Bladder Monitoring
- Bowel/Bladder Monitoring

MOBILITY / TRANSFERS:
- Mobility Assistance
- Ambulation
- Walking Assistance
- Transfers
- Transfer Assistance
- Bed Mobility
- Positioning
- Repositioning
- Wheelchair Assistance
- Walker Assistance
- Cane Assistance
- Range of Motion
- Gait Assistance
- Assistive Device Assistance

MEDICATION SUPPORT:
- Medication Reminders
- Medication Assistance
- Medication Administration
- Medication Management
- Medication Monitoring
- Medication Inventory
- Medication Setup
- Assistance With Self-Administration
- Medication Compliance Monitoring

NUTRITION / HYDRATION:
- Meal Preparation
- Meal Assistance
- Feeding Assistance
- Eating Assistance
- Meal Setup
- Meal Supervision
- Food Intake Monitoring
- Fluid Intake Monitoring
- Fluid Output Monitoring
- Intake and Output Monitoring
- Hydration Assistance
- Encouraging Fluids
- Encouraging Food Intake
- Cutting Food
- Dining Assistance

SAFETY / SUPERVISION:
- Fall Prevention
- Fall Precautions
- Safety Monitoring
- Supervision
- Standby Assistance
- Wandering Monitoring
- Elopement Prevention
- Safety Checks
- Redirection
- Environmental Safety
- Overnight Checks
- Clutter-Free Environment

BEHAVIORAL / COGNITIVE / SOCIAL / OTHER CARE:
- Cueing
- Orientation Assistance
- Memory Prompts
- Behavior Monitoring
- Emotional Support
- Cognitive Supervision
- Memory Care Support
- Transportation Assistance
- Medical Appointment Transportation
- Escort to Appointments
- Escort to Meals
- Escort Within Facility
- Transportation Coordination
- Appointment Transportation
- Activity Assistance
- Social Engagement
- Activity Escort
- Companionship
- Exercise Assistance
- Recreational Support
- Oxygen Assistance
- Respiratory Support
- Therapy Assistance
- Exercise Support
- Appointment Coordination
- Communication Assistance
- Medical Equipment Support
- Shopping
- Grocery Assistance
- Errands
- Sleep Support
- Wound Support

IMPORTANT:

If a legitimate resident-care service does NOT belong to Vital Signs or House Keeping, place it under ADLs.

==================================================
CATEGORY 2 — VITAL SIGNS
==================================================

Vital Signs contains ONLY physiological measurements, vital measurements, and direct measurement-monitoring services.

Services that belong here include, but are not limited to:

- Blood Pressure
- Heart Rate
- Pulse
- Blood Oxygen Saturation
- Oxygen Saturation
- SpO2
- Blood Sugar
- Blood Glucose
- Temperature
- Respiratory Rate
- Weight
- Vital Signs Monitoring

Normalize:

BP
BP Check
Blood Pressure Check
→ Blood Pressure

HR
Pulse
Heart Rate Check
→ Heart Rate

O2 Sat
SpO2
Oxygen Saturation
→ Blood Oxygen Saturation

Glucose
Blood Glucose
Glucose Check
→ Blood Sugar

CRITICAL:

The following MUST ALWAYS be placed under Vital Signs and NEVER under ADLs:

- Blood Pressure
- Heart Rate
- Blood Oxygen Saturation
- Blood Sugar
- Temperature
- Respiratory Rate
- Weight
- Vital Signs Monitoring

Example:

Document contains:

Bathing
Dressing
Blood Pressure
Blood Sugar
Medication Reminders

Correct:

ADLs:
- Bathing
- Dressing
- Medication Reminders

Vital Signs:
- Blood Pressure
- Blood Sugar

Incorrect:

ADLs:
- Bathing
- Dressing
- Blood Pressure
- Blood Sugar
- Medication Reminders

==================================================
CATEGORY 3 — HOUSE KEEPING
==================================================

House Keeping contains household, cleaning, laundry, linen, and resident-environment upkeep services.

Services that belong here include, but are not limited to:

- Laundry
- Linen Change
- Bed Making
- Room Cleaning
- Bedroom Cleaning
- Bathroom Cleaning
- Trash Removal
- Dish Washing
- Kitchen Cleaning
- Light Housekeeping
- General Housekeeping
- Deep Cleaning
- Sweeping
- Mopping
- Vacuuming
- Dusting
- Household Chores
- Personal Space Cleaning
- Closet Organization
- Cleaning

CRITICAL:

These services MUST ALWAYS be categorized under House Keeping and NEVER under ADLs.

Example:

Document contains:

Bathing
Laundry
Blood Pressure
Room Cleaning
Transfers

Correct:

ADLs:
- Bathing
- Transfers

Vital Signs:
- Blood Pressure

House Keeping:
- Laundry
- Room Cleaning

==================================================
CATEGORY PRIORITY RULE
==================================================

For EVERY extracted service, classify in this exact order:

FIRST:

Does the service represent a physiological/vital measurement such as blood pressure, pulse/heart rate, oxygen saturation, blood sugar, temperature, respiratory rate, weight, or generic vital-sign monitoring?

YES
→ Vital Signs

Otherwise:

Does the service represent cleaning, laundry, linens, bed making, dish washing, trash removal, household chores, or resident-environment upkeep?

YES
→ House Keeping

Otherwise:

→ ADLs

This priority order is mandatory.

Never categorize based only on the document heading.

Examples:

"Blood Pressure" appearing under an "ADL Assessment" heading
→ Vital Signs

"Laundry" appearing under a "Resident Care Needs" heading
→ House Keeping

"Medication Reminders" appearing under a "Clinical Services" heading
→ ADLs

==================================================
FINAL COMPLETENESS CHECK
==================================================

Before generating the final JSON, internally verify:

1. Did I inspect the entire document?
2. Did I inspect every page?
3. Did I inspect every care-related table?
4. Did I inspect every table row?
5. Did I inspect every field label?
6. Did I inspect every checkbox option?
7. Did I distinguish blank checkboxes from intentionally unselected completed checkboxes?
8. Did I inspect assessment activities?
9. Did I inspect narrative paragraphs?
10. Did I inspect free-text notes?
11. Did I inspect care instructions?
12. Did I inspect later sections/pages?
13. Did I detect blank/template sections?
14. Did I detect completed sections?
15. Did I handle partially completed sections?
16. Did I split compound labels containing &, /, commas, +, or "and"?
17. Did I extract service concepts from blank template rows?
18. Did I preserve distinct services separately?
19. Did I extract individual vital-sign measurements separately?
20. Did I capture housekeeping/IADL tasks?
21. Did I capture medication-support services?
22. Did I capture unfamiliar/custom services?
23. Did I avoid restricting extraction to ADLs?
24. Did I avoid restricting extraction to the examples in this prompt?
25. Did I normalize duplicates?
26. Did I avoid hallucinating unsupported services?
27. Did I accidentally discard a template service because its value was blank?
28. Did I accidentally treat placeholder example text as actual resident assignment?
29. Is there any care/service activity represented anywhere in the document that I have not returned?
30. Did I use ONLY ADLs, Vital Signs, and House Keeping?
31. Did I move every physiological/vital measurement out of ADLs and into Vital Signs?
32. Did I move every housekeeping/environment task out of ADLs and into House Keeping?
33. Does every service appear in exactly ONE category?

If a valid supported service is missing, add it before generating the final response.

Before returning JSON, perform one final category correction pass:

- Move all vital-sign measurements to Vital Signs.
- Move all housekeeping/environment services to House Keeping.
- Place all remaining resident-care services in ADLs.
- Remove duplicate services across categories.
- Do not create any category other than ADLs, Vital Signs, or House Keeping.

Completeness of the service inventory is the priority.

==================================================
OUTPUT FORMAT
==================================================

Return ONLY valid JSON.

Do NOT return:

- Markdown
- explanations
- comments
- analysis
- code fences
- text before JSON
- text after JSON

There are EXACTLY THREE allowed category names:

- ADLs
- Vital Signs
- House Keeping

Use this structure:

{
  "categories": [
    {
      "name": "ADLs",
      "services": [
        "Bathing",
        "Grooming",
        "Transfers",
        "Medication Reminders"
      ]
    },
    {
      "name": "Vital Signs",
      "services": [
        "Blood Pressure",
        "Blood Sugar"
      ]
    },
    {
      "name": "House Keeping",
      "services": [
        "Laundry",
        "Linen Change"
      ]
    }
  ]
}

Only include a category when it contains at least one extracted service.

Do NOT return empty categories.

Do NOT create any category name other than:

- ADLs
- Vital Signs
- House Keeping

Every service must appear in exactly ONE category.

Service names must be:

- concise
- normalized
- understandable
- UI-ready
- individual service concepts

FINAL CATEGORY VALIDATION BEFORE OUTPUT:

1. No vital-sign service may remain inside ADLs.
2. No housekeeping service may remain inside ADLs.
3. No ADL service may appear inside Vital Signs.
4. No housekeeping service may appear inside Vital Signs.
5. No service may appear in more than one category.
6. Only ADLs, Vital Signs, and House Keeping may be used.

Correct example:

{
  "categories": [
    {
      "name": "ADLs",
      "services": [
        "Bathing",
        "Dressing",
        "Medication Reminders"
      ]
    },
    {
      "name": "Vital Signs",
      "services": [
        "Blood Pressure",
        "Heart Rate"
      ]
    },
    {
      "name": "House Keeping",
      "services": [
        "Laundry"
      ]
    }
  ]
}

If absolutely no valid care/service concepts are represented anywhere in the document:

{
  "categories": []
}
`;

const buildExtractionInstruction = (documentText: string) => `
Analyze the ENTIRE document below and discover ALL care-service concepts represented anywhere in it.

IMPORTANT:

- Do NOT limit extraction to ADLs.
- Do NOT search only for predefined categories.
- The document may be completed, partially completed, or a blank template.
- Determine the mode of each relevant section before deciding whether blank fields should be extracted.
- In blank/template sections, care-related field labels, table rows, assessment activities, and service options are valid service concepts even when their values are empty.
- In completed sections, use actual selections, ratings, instructions, schedules, and narrative to identify resident services.
- In partially completed sections, consider both the form's service structure and populated resident-specific information.
- Split compound service labels such as "Bathing & Grooming", "Mobility & Transferring", and "Toileting / Incontinence" into distinct services.
- Discover ALL candidate services before categorizing them.
- Extract unfamiliar/custom services even if their names do not appear in the system prompt.
- Do not treat diagnoses, medications, allergies, demographics, or legal information as services by themselves.
- Normalize duplicates.
- Return every distinct supported service concept.
- Categorize every service into EXACTLY ONE of these three categories: ADLs, Vital Signs, House Keeping.
- Physiological/vital measurements MUST go to Vital Signs.
- Cleaning, laundry, linen, household, and resident-environment services MUST go to House Keeping.
- All other resident-care services MUST go to ADLs.
- Do NOT create any other category.

DOCUMENT:
${documentText}
`;

const IMAGE_EXTRACTION_INSTRUCTION = `
Analyze the ENTIRE document image and discover ALL care-service concepts represented anywhere in it.

The document may be completed, partially completed, or a blank template.

IMPORTANT:
- Do NOT limit extraction to ADLs.
- Inspect all visible tables, rows, checkboxes, fields, labels, care instructions, and narrative text.
- Determine whether each relevant section is blank/template, completed, or partially completed.
- In blank/template sections, extract care-related service labels and assessment rows even when fields or checkboxes are empty.
- In completed sections, respect actual selections, ratings, and resident-specific instructions.
- Split compound labels into individual services.
- Discover services first and categorize second.
- Extract unfamiliar/custom services when they clearly represent resident care.
- Return every distinct supported service concept.
- Categorize every service into EXACTLY ONE of these three categories: ADLs, Vital Signs, House Keeping.
- Physiological/vital measurements MUST go to Vital Signs.
- Cleaning, laundry, linen, household, and resident-environment services MUST go to House Keeping.
- All other resident-care services MUST go to ADLs.
- Do NOT create any other category.

IMAGE/PDF VISUAL EXTRACTION RULES:
- Treat every page as an image and inspect the complete visual layout.
- Read table headers, row labels, columns, checkboxes, handwritten values, stamps, and form fields.
- Do not rely only on OCR text because scanned forms may lose table relationships.
- Reconstruct the meaning of rows and columns before extracting services.
- If a PDF page contains a blank assessment form, extract service labels even when values are empty.
- If a PDF page contains a completed assessment, extract only selected/required services.
- Inspect all pages, including continuation pages and appendices.
- Never return an empty list only because OCR text is unavailable.

ROTATED TABLE EXTRACTION:

The document may contain vertical or rotated column headers.
Rotate mentally or visually interpret vertical text.

Extract services from:
- vertical headers
- column names
- row labels
- assessment grids
- checkbox columns

Do not ignore text because it is rotated.
`;



async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  // unpdf is serverless-safe (no filesystem access, no native deps) — same as extract-medications.ts
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}



async function convertPdfToImages(buffer: Buffer): Promise<string[]> {
  const { getDocumentProxy } = (await import("unpdf")) as any;
  const { createCanvas } = await import("@napi-rs/canvas");

  const data = new Uint8Array(buffer);
  const pdf = await getDocumentProxy(data);

  const images: string[] = [];

  for (
    let pageNumber = 1;
    pageNumber <= pdf.numPages;
    pageNumber++
  ) {
    const page = await pdf.getPage(pageNumber);

    const viewport = page.getViewport({
      scale: 4,
    });

    const canvas = createCanvas(
      Math.ceil(viewport.width),
      Math.ceil(viewport.height)
    );

    const context = canvas.getContext("2d");

    await page.render({
      canvasContext: context as any,
      viewport,
    } as any).promise;


    const pngBuffer = canvas.toBuffer("image/png");

    images.push(
      `data:image/png;base64,${pngBuffer.toString("base64")}`
    );
  }

  return images;
}

async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  const mammoth = (await import("mammoth")).default;
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { fileUrl } = req.body;

  if (!fileUrl) {
    return res.status(400).json({ error: "fileUrl is required" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 25_000,
    maxRetries: 0,
  });

  try {
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      return res
        .status(400)
        .json({ error: "Failed to fetch the document." });
    }

    const rawContentType = fileResponse.headers.get("content-type") || "";
    let mimeType = rawContentType.split(";")[0].trim();

    if (!mimeType || mimeType === "application/octet-stream") {
      try {
        const urlPath = new URL(fileUrl).pathname.toLowerCase();
        if (urlPath.endsWith(".pdf")) mimeType = "application/pdf";
        else if (urlPath.endsWith(".docx"))
          mimeType =
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        else if (urlPath.endsWith(".doc")) mimeType = "application/msword";
        else if (urlPath.endsWith(".jpg") || urlPath.endsWith(".jpeg"))
          mimeType = "image/jpeg";
        else if (urlPath.endsWith(".png")) mimeType = "image/png";
        else if (urlPath.endsWith(".webp")) mimeType = "image/webp";
      } catch {}
    }

    const arrayBuffer = await fileResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    const isImage = mimeType.startsWith("image/");
    const isPDF = mimeType === "application/pdf";
    const isDOCX =
      mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mimeType === "application/msword";

    if (isImage) {

  const base64 = buffer.toString("base64");

  messages = [
    {
      role: "system",
      content: EXTRACTION_PROMPT,
    },
    {
      role: "user",
      content: [
        {
 type: "text" as const,
 text: `
${IMAGE_EXTRACTION_INSTRUCTION}

IMPORTANT SCANNED PDF RULES:

This PDF may be a scanned resident assessment template.

The PDF may have:
- no selectable text
- blank checkboxes
- tables
- rotated labels
- assessment grids

Extract service concepts from the visual structure.

Extract:
- row labels
- column headers
- checkbox options
- assessment activities
- care fields

Even if the form is blank, the service labels are valid services.

Example:

Bathing [ ]
Dressing [ ]
Transfers [ ]

Return:

Bathing
Dressing
Transfers

Do not return an empty list only because OCR text is unavailable.
`,
},
        {
          type: "image_url" as const,
          image_url: {
            url: `data:${mimeType};base64,${base64}`,
            detail: "high" as const,
          },
        },
      ],
    },
  ];

} else if (isPDF) {
      let extractedText = "";
      try {
        extractedText = await extractTextFromPDF(buffer);
      } catch (e) {
        console.warn("[extract-services] PDF text extraction failed:", e);
      }

      if (extractedText.trim() && extractedText.trim().length > 200) {
        // Text based PDF
        messages = [
          { role: "system", content: EXTRACTION_PROMPT },
          {
            role: "user",
            content: buildExtractionInstruction(extractedText),
          },
        ];
      } else {
        // Scanned/image PDF fallback
        const images = await convertPdfToImages(buffer);

  messages = [
    {
      role: "system",
      content: EXTRACTION_PROMPT,
    },
    {
      role: "user",
      content: [
        {
          type: "text" as const,
          text: IMAGE_EXTRACTION_INSTRUCTION,
        },
        ...images.map((image) => ({
          type: "image_url" as const,
          image_url: {
            url: image,
            detail: "high" as const,
          },
        })),
      ],
    },
  ];
}
    } else if (isDOCX) {
      const extractedText = await extractTextFromDOCX(buffer);

      if (!extractedText.trim()) {
        // Empty DOCX: don't block; let the user add custom fields manually
        console.warn("[extract-services] No text found in DOCX, returning empty categories");
        return res.status(200).json({ categories: [] });
      }

      messages = [
        { role: "system", content: EXTRACTION_PROMPT },
        {
          role: "user",
          content: buildExtractionInstruction(extractedText),
        },
      ];
    } else {
      return res.status(400).json({
        error: "Unsupported file type. Upload PDF, DOCX, or image.",
      });
    }

    const imageParts = messages
      .filter((m: any) => m.role === "user" && Array.isArray(m.content))
      .flatMap((m: any) => m.content.filter((p: any) => p.type === "image_url"));
    const hasImages = imageParts.length > 0;

    let categories: any[] = [];

    if (hasImages) {
      const systemMessage = messages.find((m: any) => m.role === "system") as any;
      const userMessage = messages.find(
        (m: any) => m.role === "user" && Array.isArray(m.content)
      ) as any;
      const textParts = userMessage.content.filter((p: any) => p.type !== "image_url");

      const BATCH_SIZE = 5;
      const allCategories: any[] = [];

      for (let i = 0; i < imageParts.length; i += BATCH_SIZE) {
        const batch = imageParts.slice(i, i + BATCH_SIZE);
        console.log(
          `[extract-services] Image batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(imageParts.length / BATCH_SIZE)} (${batch.length} images)`
        );

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-2024-08-06",
          messages: [systemMessage, { role: "user", content: [...textParts, ...batch] }],
          max_completion_tokens: 6000,
          response_format: { type: "json_object" },
        });

        const responseText =
          completion.choices[0]?.message?.content?.trim() || "{}";

        try {
          const parsed = JSON.parse(responseText);

          if (Array.isArray(parsed)) {
            allCategories.push(...parsed);
          } else {
            const arrayValue = Object.values(parsed).find((val) =>
              Array.isArray(val)
            );
            if (arrayValue) allCategories.push(...(arrayValue as any[]));
          }
        } catch {
          console.error(
            "[extract-services] Failed to parse image batch response:",
            responseText
          );
        }
      }

      categories = Array.from(
        new Map(allCategories.map((c) => [JSON.stringify(c), c])).values()
      );
    } else {
      const completion = await openai.chat.completions.create({
        model: "gpt-5.6-luna",
        messages,
        max_completion_tokens: 6000,
        response_format: { type: "json_object" },
      });

      const responseText =
        completion.choices[0]?.message?.content?.trim() || "{}";

      try {
        const parsed = JSON.parse(responseText);

        if (Array.isArray(parsed)) {
          categories = parsed;
        } else {
          const arrayValue = Object.values(parsed).find((val) =>
            Array.isArray(val)
          );
          categories = (arrayValue as any[]) || [];
        }
      } catch {
        console.error("Failed to parse service extraction response:", responseText);
        return res
          .status(500)
          .json({ error: "Failed to parse service data" });
      }
    }

    return res.status(200).json({ categories });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Unknown error";

    console.error("[extract-services] FAILED:", detail);

    return res.status(500).json({
      error: `Failed to extract resident services: ${detail}`,
    });
  }
}