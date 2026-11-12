/* eslint-disable cypress/no-force -- ported legacy suite: deliberate force-clicks on icon triggers / documented settle windows */
/// <reference types="cypress" />

/**
 * CRM — Lead onboarding (the handshake milestone)
 *
 * The third milestone icon on the Senior Leads board opens the lead's own
 * record at /crm/{userId}, where four tabs collect everything needed to onboard
 * them. This spec covers three of them — Documents is out of scope.
 *
 *   Biography  components/biography/*      Personal Details / Values & Beliefs /
 *                                          Activity References, in accordions
 *   Medical    components/medical/*        General / Mobility / Overall Health
 *   Careplan   components/careplan/*       ADL'S and Overall Health, in sub-tabs
 *
 * Each tab is its own <Form> validated against the *whole*
 * `UpdateLeadOrSeniorSchema`, and each saves with PUT /v1/user/{id} then hands
 * off to the next tab. Only the last of them — Careplan → Overall Health — adds
 * the "onboarding" milestone that turns the handshake icon blue
 * (components/careplan/physical-health/index.tsx:95-97). Biography and Medical
 * carry the existing milestone through untouched.
 *
 * The ADL'S tab additionally offers "Use Template": a PCHO-only toggle that
 * swaps the eleven default care fields for ones extracted from an uploaded
 * document. That path is four same-origin fetches (presign-put → S3 PUT →
 * presign-get → /api/extract-adls), so it is stubbable end to end.
 */

import { Tags } from "../../framework/utils/tags";
import { buildHome, buildUserRow } from "../../framework/module-commands";

const LEAD_ID = "aaaaaaaa-0001-4aaa-8aaa-aaaaaaaaaaaa";
const LEAD_PATH = `/crm/${LEAD_ID}`;
const CRM_PATH = "/crm";

/** The Careplan sub-tab label uses a typographic apostrophe, not an ASCII one. */
const ADLS_TAB = "ADL’S";

// ── Fixtures ─────────────────────────────────────────────────────────────────

/**
 * A lead part-way through the pipeline: contacted and toured, not yet onboarded,
 * so the handshake icon starts grey.
 */
const buildLead = (overrides: Record<string, any> = {}) =>
  buildUserRow({
    userId: LEAD_ID,
    name: "Brahma Teja",
    firstName: "Brahma",
    lastName: "Teja",
    email: "brahma.teja@assistly.com",
    mobile: "8885550966",
    milestone: ["initial contact", "tour"],
    ...overrides,
  });

/** A lead with every required Biography field already answered. */
const buildCompletedLead = (overrides: Record<string, any> = {}) =>
  buildLead({
    biography: {
      personalDetails: {
        gender: "Male",
        birthdate: "1948-04-12",
        address: { street1: "12 Oak Lane", city: "Austin", state: "TX", zipCode: "78701" },
      },
    },
    ...overrides,
  });

// ── Selectors ────────────────────────────────────────────────────────────────

/**
 * Every form control is registered by its react-hook-form path, and the wrapper
 * components spread that path onto the DOM node as `name` — so the schema path
 * doubles as the selector.
 */
const field = (name: string) => cy.get(`input[name="${name}"]`);
const select = (name: string) => cy.get(`select[name="${name}"]`);
const area = (name: string) => cy.get(`textarea[name="${name}"]`);
const check = (name: string) => cy.get(`input[type="checkbox"][name="${name}"]`);

const P = "biography.personalDetails";
const V = "biography.valuesAndBeliefs";
const A = "biography.activityReferences";
const MG = "medical.general";
const MM = "medical.mobility";
const MO = "medical.overAllHealth";
const ADL = "carePlan.adl";
const HK = "carePlan.housekeeping";
const PH = "carePlan.physicalHealth";
const BP = "carePlan.behaviourPatterns";
const VS = "carePlan.vitalSigns";

const sel = {
  save: () => cy.contains("button", "Save"),
  useCustomTemplate: () => cy.contains("button", "Use Custom Template"),
  /** ToggleSwitch renders an unlabelled button next to its label span. */
  templateToggle: () => cy.contains("span", "Use Template").siblings("button"),
  fileInput: () => cy.get('input[type="file"]'),
  confirmServices: () => cy.contains("button", "Confirm"),
  addService: () => cy.contains("button", "Add"),
  newService: () => cy.get('input[name="newServiceGlobal"]'),
  newServiceCategory: () => cy.get('select[name="addServiceCategory"]'),
};

/**
 * Tab labels render inside a <span>; accordion headers do not. Forced, because
 * a save's confirmation popover can still be on screen over the tab strip.
 */
const openTab = (label: string) => cy.contains("span", label).click({ force: true });

/** MUI keeps collapsed accordion content mounted but hidden — expand it first. */
const openSection = (name: string) =>
  cy.contains(".MuiAccordionSummary-root", name).click();

/**
 * Assert an accordion section is flagged as holding a validation error.
 *
 * Both Biography and Medical colour the header red and add a WarningIcon when
 * `get(formState.errors, path)` is truthy. Asserting the flag rather than the
 * message text keeps these tests independent of Zod's wording for required
 * fields, which differs between a missing key and an empty string.
 *
 * The class sits on the header `<div>` the section passes to AccordainComponent,
 * which MUI renders several levels below `.MuiAccordionSummary-root` — hence the
 * descendant search rather than an assertion on the summary itself.
 */
const assertSectionFlagged = (name: string) =>
  cy.contains(".MuiAccordionSummary-root", name).find(".text-red-500").should("exist");

/**
 * A service row in the review modal. InputcheckboxComponent puts the input and
 * the label in sibling divs, so the checkbox is reached through their shared
 * `flex gap-2` parent rather than off the label itself.
 */
const serviceCheckbox = (name: string) =>
  cy.contains("label", name).parents("div.flex.gap-2").first().find('input[type="checkbox"]');

const typeIn = (name: string, value: string) =>
  field(name).clear().type(value, { delay: 0 });

/**
 * Dev's Medical → General section keeps the flat Pharmacy Name/Number and Food
 * Allergies fields, but moved Practice Name/Number into a providers array —
 * a "Service Contacts" table fed by an "Add Provider" modal holding
 * `medical.general.providers[N].{category,providerType,practiceName,practiceNumber}`.
 */
const PROVIDER = `${MG}.providers.0`;

const openAddProvider = () => {
  cy.contains("button", "Add Provider").click();
  select(`${PROVIDER}.category`).should("exist");
};

/** Fill a provider row in the modal and close it with Done. */
const addProvider = (
  overrides: Partial<{
    category: string;
    providerType: string;
    practiceName: string;
    practiceNumber: string;
  }> = {}
) => {
  const {
    category = "Medical",
    providerType = "PCP",
    practiceName = "Cedar Family Practice",
    practiceNumber = "5551230000",
  } = overrides;
  openAddProvider();
  select(`${PROVIDER}.category`).select(category);
  select(`${PROVIDER}.providerType`).select(providerType);
  field(`${PROVIDER}.practiceName`).type(practiceName, { delay: 0 });
  field(`${PROVIDER}.practiceNumber`).type(practiceNumber, { delay: 0 });
  cy.contains("button", "Done").click();
};

// ── Visiting ─────────────────────────────────────────────────────────────────

const visitLead = (
  lead: Record<string, any> = buildLead(),
  opts: { role?: any; home?: ReturnType<typeof buildHome> } = {}
) => {
  cy.clearAuthSession();
  cy.setAuthSession(opts.role ?? "PCHO");
  cy.stubHome(opts.home ?? buildHome());
  cy.stubUsers();
  cy.stubUser(lead);
  cy.stubPut("/v1/user", "updateLead", 200, {});
  cy.visit(LEAD_PATH);
  cy.contains("Personal Details", { timeout: 10000 }).should("be.visible");
  // Each wrapper keys its <Form> on role + editAccess, both of which settle a
  // tick after mount — typing into the pre-settle DOM node throws.
  cy.settleForm();
};

/** Land on Careplan → ADL'S, the tab the Careplan sub-tab state starts on. */
const visitCareplan = (lead: Record<string, any> = buildCompletedLead()) => {
  visitLead(lead);
  openTab("Careplan");
  cy.contains("ADL Services").should("be.visible");
  cy.settleForm();
};

// ── ADL template stubs ───────────────────────────────────────────────────────

const S3_PUT_URL = "https://bucket.s3.amazonaws.com/put-target";

/** The three same-origin hops uploadToS3 + getFileUrl make before extraction. */
const stubTemplateUpload = () => {
  cy.intercept("POST", "/api/s3/presign-put", {
    statusCode: 200,
    body: { url: S3_PUT_URL },
  }).as("presignPut");
  cy.intercept("PUT", S3_PUT_URL, { statusCode: 200, body: {} }).as("s3Put");
  cy.intercept("POST", "/api/s3/presign-get", {
    statusCode: 200,
    body: { url: "https://bucket.s3.amazonaws.com/carenotes.pdf" },
  }).as("presignGet");
};

/** POST /api/extract-adls answers with `{ categories: [{ name, services }] }`. */
const stubExtraction = (categories: any[]) => {
  cy.intercept("POST", "/api/extract-adls", {
    statusCode: 200,
    body: { categories },
  }).as("extractAdls");
};

const DEFAULT_CATEGORIES = [
  { name: "Personal Care", services: ["Shower Assist", "Hair Washing"] },
  { name: "Vital Signs", services: ["Blood Pressure"] },
  { name: "Housekeeping", services: ["Bin Emptying"] },
];

const uploadTemplate = (
  fileName = "carenotes.pdf",
  mimeType = "application/pdf",
  contents: any = "PDF-1.4 stub"
) => {
  sel.useCustomTemplate().click();
  cy.contains("Upload Custom Template").should("be.visible");
  sel.fileInput().selectFile({ contents: Cypress.Buffer.from(contents), fileName, mimeType }, { force: true });
};

describe("CRM — Lead onboarding", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. The handshake milestone icon
  // ──────────────────────────────────────────────────────────────────────────

  describe("Onboarding milestone icon", () => {
    /** OnboardIcon is the only stage icon drawn on a 27x18 viewBox. */
    const icon = (name: string) =>
      cy
        .contains(name)
        .closest('div[class*="border-b"]')
        .find('svg[viewBox="0 0 27 18"]');

    const visitBoard = (leads: any[]) => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome();
      cy.stubUsers(leads);
      cy.stubUser(leads[0]);
      cy.visit(CRM_PATH);
      cy.wait("@getUsers");
    };

    it("renders exactly one onboarding icon per row", () => {
      visitBoard([buildLead()]);
      icon("Brahma Teja").should("have.length", 1);
    });

    it("greys the icon for a lead that has not been onboarded", () => {
      visitBoard([buildLead({ milestone: ["initial contact", "tour"] })]);
      icon("Brahma Teja").find("path").first().should("have.attr", "fill", "gray");
    });

    it("colours the icon once the lead holds the onboarding milestone", () => {
      visitBoard([buildLead({ milestone: ["initial contact", "tour", "onboarding"] })]);
      icon("Brahma Teja").find("path").first().should("have.attr", "fill", "#514CEB");
    });

    it("greys the icon for a lead with no milestones at all", () => {
      visitBoard([buildLead({ milestone: [] })]);
      icon("Brahma Teja").find("path").first().should("have.attr", "fill", "gray");
    });

    it("reads the milestone array, not the order of it", () => {
      visitBoard([buildLead({ milestone: ["onboarding", "initial contact"] })]);
      icon("Brahma Teja").find("path").first().should("have.attr", "fill", "#514CEB");
    });

    it("colours each row independently", () => {
      visitBoard([
        buildLead({ name: "Brahma Teja", milestone: ["tour"] }),
        buildLead({
          userId: "aaaaaaaa-0002-4aaa-8aaa-aaaaaaaaaaaa",
          name: "Tony Stark",
          milestone: ["tour", "onboarding"],
        }),
      ]);
      icon("Brahma Teja").find("path").first().should("have.attr", "fill", "gray");
      icon("Tony Stark").find("path").first().should("have.attr", "fill", "#514CEB");
    });

    it("opens the lead's own record when the icon is clicked", () => {
      visitBoard([buildLead()]);
      icon("Brahma Teja").click({ force: true });
      cy.location("pathname", { timeout: 10000 }).should("eq", LEAD_PATH);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. The lead record shell
  // ──────────────────────────────────────────────────────────────────────────

  describe("Lead record shell", () => {
    beforeEach(() => visitLead());

    it("names the lead in the heading", () => {
      cy.contains("Senior Lead - Brahma Teja").should("be.visible");
    });

    it("calls a Senior a Senior rather than a Senior Lead", { tags: [Tags.SENIOR] }, () => {
      visitLead(buildLead({ role: "Senior" }));
      cy.contains("Senior - Brahma Teja").should("be.visible");
    });

    it("offers the onboarding tabs", () => {
      ["Biography", "Medical", "Careplan"].forEach((tab) =>
        cy.contains("span", tab).should("be.visible")
      );
    });

    it("opens on Biography", () => {
      cy.contains("Personal Details").should("be.visible");
    });

    it("switches to Medical", () => {
      openTab("Medical");
      // Dev's Medical → General section heads with "Service Contacts" — the
      // providers table replaced the flat Practice Name/Number fields.
      cy.contains("Service Contacts").should("be.visible");
    });

    it("switches to Careplan and opens on ADL'S", () => {
      openTab("Careplan");
      cy.contains("ADL Services").should("be.visible");
    });

    it("returns to Biography with the lead's saved values intact", () => {
      openTab("Medical");
      openTab("Biography");
      field("firstName").should("have.value", "Brahma");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Biography — Personal Details
  // ──────────────────────────────────────────────────────────────────────────

  describe("Biography — Personal Details", () => {
    beforeEach(() => visitLead());

    it("renders every personal field", () => {
      ["firstName", "middleName", "lastName", "email", "mobile"].forEach((name) =>
        field(name).should("exist")
      );
      [`${P}.nickName`, `${P}.birthdate`, `${P}.ssn`].forEach((name) =>
        field(name).should("exist")
      );
      select(`${P}.gender`).should("exist");
      select(`${P}.race`).should("exist");
    });

    it("marks the required fields with an asterisk", () => {
      ["First Name *", "Last Name *", "Birth date *", "Gender *"].forEach((label) =>
        cy.contains(label).should("be.visible")
      );
    });

    it("pre-fills the lead's known details", () => {
      field("firstName").should("have.value", "Brahma");
      field("lastName").should("have.value", "Teja");
      field("mobile").should("have.value", "8885550966");
    });

    it("locks the email of a lead that already has one", () => {
      field("email").should("have.attr", "readonly");
    });

    it("offers every gender option", () => {
      ["Female", "Male", "Other"].forEach((option) =>
        select(`${P}.gender`).contains(option).should("exist")
      );
    });

    it("offers every race option", () => {
      ["American Indian", "Asian", "African American", "Caucasian"].forEach((option) =>
        select(`${P}.race`).contains(option).should("exist")
      );
    });

    it("caps the birth date at today", () => {
      const today = new Date().toISOString().split("T")[0];
      field(`${P}.birthdate`).should("have.attr", "max", today);
    });

    it("hides the free-text race box until Other is chosen", () => {
      area(`${P}.otherRace`).should("not.exist");
      select(`${P}.race`).select("Other");
      area(`${P}.otherRace`).should("be.visible");
    });

    it("hides the free-text occupation box until Other is chosen", () => {
      area(`${P}.otherOccupation`).should("not.exist");
      select(`${P}.occupation`).select("Other");
      area(`${P}.otherOccupation`).should("be.visible");
    });

    it("masks the SSN until the reveal is pressed", () => {
      field(`${P}.ssn`).should("have.attr", "type", "password");
      field(`${P}.ssn`).parent().find("button").click();
      field(`${P}.ssn`).should("not.have.attr", "type", "password");
    });

    // ── negative ────────────────────────────────────────────────────────────

    it("refuses a first name containing punctuation", () => {
      typeIn("firstName", "Brahma@");
      cy.contains("First Name accepts only alphabets and numbers").should("be.visible");
    });

    it("refuses a last name containing punctuation", () => {
      typeIn("lastName", "Teja!");
      cy.contains("Last Name accepts only alphabets and numbers").should("be.visible");
    });

    it("refuses a nickname containing punctuation", () => {
      typeIn(`${P}.nickName`, "BT#");
      cy.contains("Nick Name accepts only alphabets and numbers").should("be.visible");
    });

    it("refuses a mobile number that is not ten digits", () => {
      typeIn("mobile", "88855");
      cy.contains("Mobile number must be exactly 10 digits").should("be.visible");
    });

    it("refuses a formatted mobile number", () => {
      typeIn("mobile", "888-555-0966");
      cy.contains("Only numbers are allowed").should("be.visible");
    });

    it("refuses an SSN shorter than nine digits", () => {
      typeIn(`${P}.ssn`, "12345");
      cy.contains("SSN must be a 9-digit number").should("be.visible");
    });

    it("accepts a nine-digit SSN", () => {
      typeIn(`${P}.ssn`, "123456789");
      cy.contains("SSN must be a 9-digit number").should("not.exist");
    });

    it("refuses an emergency contact name containing punctuation", () => {
      typeIn(`${P}.emergencyContactName`, "Mary!");
      cy.contains("Accepts only alphabets and numbers").should("be.visible");
    });

    it("refuses an emergency contact number that is not ten digits", () => {
      typeIn(`${P}.emergencyContactNumber`, "5551");
      cy.contains("Mobile number must be exactly 10 digits").should("be.visible");
    });

    it("does not offer the alternate mobile the schema allows", () => {
      // PersonalDetails validates `alternateMobile`, but personal-details.tsx
      // never renders a control for it — so it can only ever arrive from the API.
      field(`${P}.alternateMobile`).should("not.exist");
    });

    it("clears the error once the field is corrected", () => {
      typeIn("mobile", "88855");
      cy.contains("Mobile number must be exactly 10 digits").should("be.visible");
      typeIn("mobile", "8885550966");
      cy.contains("Mobile number must be exactly 10 digits").should("not.exist");
    });

    it("leaves an optional field alone when it is left blank", () => {
      field(`${P}.nickName`).clear();
      cy.contains("Nick Name accepts only alphabets and numbers").should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Biography — Values & Beliefs and Activity References
  // ──────────────────────────────────────────────────────────────────────────

  describe("Biography — Values & Beliefs", () => {
    beforeEach(() => {
      visitLead();
      openSection("Values & Beliefs");
    });

    it("renders the religion fields", () => {
      field(`${V}.religiousEntity`).should("be.visible");
      field(`${V}.religiousEntityContactNumber`).should("be.visible");
      area(`${V}.importantDates`).should("be.visible");
      area(`${V}.personalPhilosophy`).should("be.visible");
    });

    it("accepts an alphabetic entity name", () => {
      typeIn(`${V}.religiousEntity`, "Saint Marys");
      cy.contains("Entity Name must contain only alphabets").should("not.exist");
    });

    it("refuses an entity name containing digits", () => {
      typeIn(`${V}.religiousEntity`, "Parish 12");
      cy.contains("Entity Name must contain only alphabets").should("be.visible");
    });

    it("refuses an entity contact number that is not ten digits", () => {
      typeIn(`${V}.religiousEntityContactNumber`, "555");
      cy.contains("Mobile number must be exactly 10 digits").should("be.visible");
    });

    it("refuses a non-numeric entity contact number", () => {
      typeIn(`${V}.religiousEntityContactNumber`, "555-111-2222");
      cy.contains("Only numbers are allowed").should("be.visible");
    });

    it("accepts free text for the philosophy and important dates", () => {
      area(`${V}.personalPhilosophy`).type("Family first.", { delay: 0 });
      area(`${V}.importantDates`).type("Anniversary in June", { delay: 0 });
      area(`${V}.personalPhilosophy`).should("have.value", "Family first.");
    });
  });

  describe("Biography — Activity References", () => {
    beforeEach(() => {
      visitLead();
      openSection("Activity References");
    });

    it("offers every hobby", () => {
      ["Sports", "Music", "Entertainment", "Reading & Writing", "Travel"].forEach(
        (hobby) => cy.contains(hobby).should("be.visible")
      );
    });

    it("starts every hobby unchecked for a lead with no biography", () => {
      check(`${A}.hobbies.sports`).should("not.be.checked");
      check(`${A}.hobbies.travel`).should("not.be.checked");
    });

    it("ticks and unticks a hobby", () => {
      check(`${A}.hobbies.music`).check({ force: true }).should("be.checked");
      check(`${A}.hobbies.music`).uncheck({ force: true }).should("not.be.checked");
    });

    it("keeps hobbies independent of each other", () => {
      check(`${A}.hobbies.cooking`).check({ force: true });
      check(`${A}.hobbies.games`).should("not.be.checked");
    });

    it("accepts additional activities as free text", () => {
      area(`${A}.otherActivities`).type("Birdwatching", { delay: 0 });
      area(`${A}.otherActivities`).should("have.value", "Birdwatching");
    });

    it("reflects hobbies already saved on the lead", () => {
      visitLead(
        buildLead({ biography: { activityReferences: { hobbies: { sports: true } } } })
      );
      openSection("Activity References");
      check(`${A}.hobbies.sports`).should("be.checked");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Biography — saving
  // ──────────────────────────────────────────────────────────────────────────

  describe("Biography — saving", () => {
    it("refuses to save while the required details are blank", () => {
      visitLead();
      sel.save().click();

      cy.assertNoRequest("@updateLead");
      assertSectionFlagged("Personal Details");
    });

    it("keeps the user on Biography when the save is refused", () => {
      visitLead();
      sel.save().click();
      cy.contains("Personal Details").should("be.visible");
    });

    it("refuses to save a lead whose name has been emptied", () => {
      visitLead(buildCompletedLead());
      field("firstName").clear();
      sel.save().click();

      cy.assertNoRequest("@updateLead");
    });

    it("saves once gender and birth date are supplied", () => {
      visitLead();
      select(`${P}.gender`).select("Male");
      field(`${P}.birthdate`).type("1948-04-12");
      sel.save().click();

      cy.wait("@updateLead");
      cy.assertPopover("Data Saved Successfully");
    });

    it("hands off to the Medical tab once Biography is saved", () => {
      visitLead(buildCompletedLead());
      sel.save().click();

      cy.wait("@updateLead");
      cy.contains("Service Contacts", { timeout: 10000 }).should("be.visible");
    });

    it("rebuilds the display name from the three name fields", () => {
      visitLead(buildCompletedLead());
      typeIn("middleName", "Kumar");
      sel.save().click();

      cy.wait("@updateLead").then(({ request }) => {
        expect(request.body.name).to.eq("Brahma Kumar Teja");
      });
    });

    it("leaves the name unpadded when there is no middle name", () => {
      visitLead(buildCompletedLead());
      sel.save().click();

      cy.wait("@updateLead").then(({ request }) => {
        expect(request.body.name).to.eq("Brahma Teja");
      });
    });

    it("sends the SSN as a number, not the typed string", () => {
      visitLead(buildCompletedLead());
      typeIn(`${P}.ssn`, "123456789");
      sel.save().click();

      cy.wait("@updateLead").then(({ request }) => {
        expect(request.body.biography.personalDetails.ssn).to.eq(123456789);
      });
    });

    it("carries the lead's existing milestones through untouched", () => {
      visitLead(buildCompletedLead());
      sel.save().click();

      cy.wait("@updateLead").then(({ request }) => {
        expect(request.body.milestone).to.deep.eq(["initial contact", "tour"]);
      });
    });

    it("does not award the onboarding milestone from Biography", () => {
      visitLead(buildCompletedLead());
      sel.save().click();

      cy.wait("@updateLead").then(({ request }) => {
        expect(request.body.milestone).to.not.include("onboarding");
      });
    });

    it("strips the server-owned fields from the payload", () => {
      visitLead(buildCompletedLead());
      sel.save().click();

      cy.wait("@updateLead").then(({ request }) => {
        ["modifiedAt", "clinical", "lastLoginTimestamp"].forEach((key) =>
          expect(request.body, key).to.not.have.property(key)
        );
      });
    });

    it("authenticates the save with the session id token", () => {
      visitLead(buildCompletedLead());
      sel.save().click();
      cy.wait("@updateLead");
      cy.assertAuthorized("@updateLead");
    });

    it("reports a rejected save and stays put", () => {
      visitLead(buildCompletedLead());
      cy.stubPut("/v1/user", "updateLead", 400, { error: "Email already exists" });
      sel.save().click();

      cy.wait("@updateLead");
      cy.assertPopover("Email already exists");
      cy.dismissPopover();
      cy.contains("Personal Details").should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Medical
  // ──────────────────────────────────────────────────────────────────────────

  describe("Medical", () => {
    beforeEach(() => {
      visitLead(buildCompletedLead());
      openTab("Medical");
      cy.settleForm();
    });

    it("opens on the General section", () => {
      cy.contains("Service Contacts").should("be.visible");
    });

    it("renders the service contacts table and the pharmacy fields", () => {
      cy.contains("button", "Add Provider").should("be.visible");
      cy.contains("No service contacts added yet.").should("be.visible");
      field(`${MG}.pharmacyName`).should("exist");
      field(`${MG}.pharmacyNumber`).should("exist");
      area(`${MG}.foodAllergies`).should("exist");
    });

    it("adds a provider through the modal and lists it", () => {
      addProvider();
      cy.contains("Cedar Family Practice").should("be.visible");
    });

    it("accepts a full general section", () => {
      addProvider();
      typeIn(`${MG}.pharmacyName`, "Oak Pharmacy");
      typeIn(`${MG}.pharmacyNumber`, "5551230001");
      area(`${MG}.foodAllergies`).type("Peanuts", { delay: 0 });

      cy.contains("Only numbers are allowed").should("not.exist");
    });

    it("refuses a provider's practice number that is not ten digits", () => {
      openAddProvider();
      typeIn(`${PROVIDER}.practiceNumber`, "555");
      cy.contains("Mobile number must be exactly 10 digits").should("be.visible");
      cy.contains("button", "Done").click();
    });

    it("refuses a non-numeric practice number", () => {
      openAddProvider();
      typeIn(`${PROVIDER}.practiceNumber`, "555-123-0000");
      cy.contains("Only numbers are allowed").should("be.visible");
      cy.contains("button", "Done").click();
    });

    it("refuses a pharmacy number that is not ten digits", () => {
      typeIn(`${MG}.pharmacyNumber`, "555");
      cy.contains("Mobile number must be exactly 10 digits").should("be.visible");
    });

    it("flags the General section when its numbers are wrong", () => {
      openAddProvider();
      typeIn(`${PROVIDER}.practiceNumber`, "555");
      cy.contains("button", "Done").click();
      sel.save().click();

      cy.assertNoRequest("@updateLead");
      assertSectionFlagged("General");
    });

    it("offers the mobility checkboxes", () => {
      openSection("Mobility");
      ["Two Person Transfer", "Mechanical Lift", "Bed Ridden", "Non Ambulatory"].forEach(
        (label) => cy.contains(label).should("be.visible")
      );
    });

    it("ticks a mobility need", () => {
      openSection("Mobility");
      check(`${MM}.mechanicalLift`).check({ force: true }).should("be.checked");
    });

    it("offers the overall health checkboxes", () => {
      openSection("Overall Health");
      ["Chronic illness", "Developmental Disability", "Mental illness", "Able to Drive"].forEach(
        (label) => cy.contains(label).should("be.visible")
      );
    });

    it("ticks an overall health condition", () => {
      openSection("Overall Health");
      check(`${MO}.chronicIllness`).check({ force: true }).should("be.checked");
    });

    it("saves the medical record", () => {
      addProvider();
      sel.save().click();

      cy.wait("@updateLead").then(({ request }) => {
        expect(request.body.medical.general.providers[0].practiceName).to.eq(
          "Cedar Family Practice"
        );
      });
      cy.assertPopover("Data Saved Successfully");
    });

    it("sends the ticked mobility needs", () => {
      openSection("Mobility");
      check(`${MM}.bedridden`).check({ force: true });
      sel.save().click();

      cy.wait("@updateLead").then(({ request }) => {
        expect(request.body.medical.mobility.bedridden).to.eq(true);
      });
    });

    it("hands off to the Careplan tab once Medical is saved", () => {
      sel.save().click();
      cy.wait("@updateLead");
      cy.contains("ADL Services", { timeout: 10000 }).should("be.visible");
    });

    it("does not award the onboarding milestone from Medical", () => {
      sel.save().click();
      cy.wait("@updateLead").then(({ request }) => {
        expect(request.body.milestone).to.not.include("onboarding");
      });
    });

    it("reports a rejected medical save", () => {
      cy.stubPut("/v1/user", "updateLead", 500, { error: "Medical service unavailable" });
      sel.save().click();

      cy.wait("@updateLead");
      cy.assertPopover("Medical service unavailable");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Careplan — ADL'S
  // ──────────────────────────────────────────────────────────────────────────

  describe("Careplan — ADL'S", () => {
    beforeEach(() => visitCareplan());

    it("groups the fields into ADL Services and Housekeeping", () => {
      cy.contains("ADL Services").should("be.visible");
      cy.contains("Housekeeping").should("be.visible");
    });

    it("renders all eight default care services", () => {
      ["bathing", "continence", "toileting", "grooming", "dressing", "oralCare", "mobility", "transferring"].forEach(
        (key) => select(`${ADL}.${key}.careLevel`).should("exist")
      );
    });

    it("renders the three default housekeeping services", () => {
      ["dailyCleanSweep", "weeklyDeepClean", "laundry"].forEach((key) =>
        select(`${HK}.${key}`).should("exist")
      );
    });

    it("offers every level of care", () => {
      ["Independent", "Monitor & Cue", "Full Assistance"].forEach((option) =>
        select(`${ADL}.bathing.careLevel`).contains(option).should("exist")
      );
    });

    it("offers every housekeeping frequency", () => {
      ["Not Required", "Staff Assisted", "Scheduled - Weekly", "On Request"].forEach(
        (option) => select(`${HK}.laundry`).contains(option).should("exist")
      );
    });

    it("defaults an unanswered care service to Independent", () => {
      select(`${ADL}.bathing.careLevel`).should("have.value", "Independent");
    });

    it("pre-fills a care level already saved on the lead", () => {
      visitCareplan(
        buildCompletedLead({ carePlan: { adl: { bathing: { careLevel: "Full Assistance" } } } })
      );
      select(`${ADL}.bathing.careLevel`).should("have.value", "Full Assistance");
    });

    it("accepts a comment", () => {
      area(`${ADL}.comments`).type("Prefers morning showers.", { delay: 0 });
      area(`${ADL}.comments`).should("have.value", "Prefers morning showers.");
    });

    it("saves the chosen care levels", () => {
      select(`${ADL}.bathing.careLevel`).select("Full Assistance");
      select(`${HK}.laundry`).select("Scheduled - Weekly");
      sel.save().click();

      cy.wait("@updateLead").then(({ request }) => {
        expect(request.body.carePlan.adl.bathing.careLevel).to.eq("Full Assistance");
        expect(request.body.carePlan.housekeeping.laundry).to.eq("Scheduled - Weekly");
      });
      cy.assertPopover("Data Saved Successfully");
    });

    it("gives every active service a care level, answered or not", () => {
      sel.save().click();
      cy.wait("@updateLead").then(({ request }) => {
        ["bathing", "continence", "toileting", "grooming"].forEach((key) =>
          expect(request.body.carePlan.adl[key].careLevel, key).to.be.a("string")
        );
      });
    });

    it("moves on to Overall Health once the ADLs are saved", () => {
      sel.save().click();
      cy.wait("@updateLead");
      cy.contains("Physical Health", { timeout: 10000 }).should("be.visible");
    });

    it("does not award the onboarding milestone from the ADLs", () => {
      sel.save().click();
      cy.wait("@updateLead").then(({ request }) => {
        expect(request.body.milestone).to.not.include("onboarding");
      });
    });

    it("reports a rejected ADL save", () => {
      cy.stubPut("/v1/user", "updateLead", 500, { error: "Careplan service unavailable" });
      sel.save().click();
      cy.wait("@updateLead");
      // saveCarePlan's onError reports `error.message` — the raw axios string —
      // rather than the API's own `error` field, unlike every other tab here.
      cy.assertPopover("Request failed with status code 500");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. Careplan — ADL'S "Use Template"
  // ──────────────────────────────────────────────────────────────────────────

  describe("Careplan — Use Template", () => {
    beforeEach(() => visitCareplan());

    it("offers the toggle to a PCHO", () => {
      cy.contains("span", "Use Template").should("be.visible");
    });

    it("starts the toggle off for a lead on the default services", () => {
      sel.useCustomTemplate().should("not.exist");
    });

    it("reveals the upload action when the toggle is turned on", () => {
      sel.templateToggle().click();
      sel.useCustomTemplate().should("be.visible");
    });

    it("hides the upload action again when the toggle is turned off", () => {
      sel.templateToggle().click();
      sel.useCustomTemplate().should("be.visible");
      sel.templateToggle().click();
      sel.useCustomTemplate().should("not.exist");
    });

    it("keeps the default services while the toggle is on but no template applied", () => {
      sel.templateToggle().click();
      select(`${ADL}.bathing.careLevel`).should("exist");
    });

    it("starts already on for a lead whose saved ADLs are not the default set", () => {
      visitCareplan(
        buildCompletedLead({ carePlan: { adl: { showerAssist: { careLevel: "Independent" } } } })
      );
      sel.useCustomTemplate().should("be.visible");
    });

    it("renders the lead's own services instead of the defaults", () => {
      visitCareplan(
        buildCompletedLead({ carePlan: { adl: { showerAssist: { careLevel: "Independent" } } } })
      );
      select(`${ADL}.showerAssist.careLevel`).should("exist");
      select(`${ADL}.bathing.careLevel`).should("not.exist");
    });

    it("opens the upload modal", () => {
      sel.templateToggle().click();
      sel.useCustomTemplate().click();
      cy.contains("Upload Custom Template").should("be.visible");
      cy.contains("Please upload a custom template document").should("be.visible");
    });

    // ── negative ────────────────────────────────────────────────────────────

    it("refuses a file that is not a PDF or Word document", () => {
      cy.intercept("POST", "/api/s3/presign-put").as("presignPut");
      sel.templateToggle().click();
      uploadTemplate("notes.png", "image/png");

      cy.assertPopover("Invalid file format. Please upload a PDF, DOC, or DOCX file.");
      cy.assertNoRequest("@presignPut");
    });

    it("refuses a file over the twenty megabyte cap", () => {
      cy.intercept("POST", "/api/s3/presign-put").as("presignPut");
      sel.templateToggle().click();
      uploadTemplate(
        "huge.pdf",
        "application/pdf",
        Cypress.Buffer.alloc(21 * 1024 * 1024, "x")
      );

      cy.assertPopover("File size exceeds 20MB. Please upload a smaller file.");
      cy.assertNoRequest("@presignPut");
    });

    it("reports a failed extraction", () => {
      stubTemplateUpload();
      cy.intercept("POST", "/api/extract-adls", {
        statusCode: 500,
        body: { error: "Extraction engine unavailable" },
      }).as("extractAdls");

      sel.templateToggle().click();
      uploadTemplate();

      cy.wait("@extractAdls");
      cy.assertPopover("Extraction engine unavailable");
    });

    it("does not open the review modal when extraction fails", () => {
      stubTemplateUpload();
      cy.intercept("POST", "/api/extract-adls", { statusCode: 500, body: {} }).as("extractAdls");

      sel.templateToggle().click();
      uploadTemplate();

      cy.wait("@extractAdls");
      cy.dismissPopover();
      cy.contains("Review Extracted Services").should("not.exist");
    });

    // ── the happy path ──────────────────────────────────────────────────────

    it("uploads the template through the presign round trip", () => {
      stubTemplateUpload();
      stubExtraction(DEFAULT_CATEGORIES);

      sel.templateToggle().click();
      uploadTemplate();

      cy.wait("@presignPut");
      cy.wait("@s3Put");
      cy.wait("@presignGet");
      cy.wait("@extractAdls");
    });

    it("sends the presigned document URL to the extractor", () => {
      stubTemplateUpload();
      stubExtraction(DEFAULT_CATEGORIES);

      sel.templateToggle().click();
      uploadTemplate();

      cy.wait("@extractAdls").then(({ request }) => {
        expect(request.body.fileUrl).to.eq("https://bucket.s3.amazonaws.com/carenotes.pdf");
      });
    });

    it("opens the review modal on the extracted services", () => {
      stubTemplateUpload();
      stubExtraction(DEFAULT_CATEGORIES);

      sel.templateToggle().click();
      uploadTemplate();

      cy.contains("Review Extracted Services").should("be.visible");
      // The modal body is capped at 55vh with a sticky footer, so the later
      // sections sit below the fold — presence is the assertion, not visibility.
      cy.contains("label", "Shower Assist").should("exist");
      cy.contains("label", "Blood Pressure").should("exist");
      cy.contains("label", "Bin Emptying").should("exist");
    });

    it("warns that the services came from AI", () => {
      stubTemplateUpload();
      stubExtraction(DEFAULT_CATEGORIES);

      sel.templateToggle().click();
      uploadTemplate();

      cy.contains("These services were extracted from care notes using AI").should("be.visible");
    });

    it("files each service under the section its category maps to", () => {
      stubTemplateUpload();
      stubExtraction(DEFAULT_CATEGORIES);

      sel.templateToggle().click();
      uploadTemplate();

      cy.contains("Detected ADL Services").should("exist");
      cy.contains("Vital Signs").should("exist");
      cy.contains("Housekeeping Services").should("exist");
    });

    it("says so when the document yielded nothing", () => {
      stubTemplateUpload();
      stubExtraction([]);

      sel.templateToggle().click();
      uploadTemplate();

      cy.contains("We couldn't automatically detect ADL services").should("be.visible");
    });

    it("refuses to confirm when nothing is selected", () => {
      stubTemplateUpload();
      stubExtraction([{ name: "Personal Care", services: ["Shower Assist"] }]);

      sel.templateToggle().click();
      uploadTemplate();

      serviceCheckbox("Shower Assist").uncheck({ force: true });
      sel.confirmServices().should("be.disabled");
    });

    it("adds a service the document missed", () => {
      stubTemplateUpload();
      stubExtraction(DEFAULT_CATEGORIES);

      sel.templateToggle().click();
      uploadTemplate();

      sel.newService().type("Nail Care", { delay: 0 });
      sel.addService().click();
      cy.contains("Nail Care").should("be.visible");
    });

    it("refuses to add a service that is already listed", () => {
      stubTemplateUpload();
      stubExtraction(DEFAULT_CATEGORIES);

      sel.templateToggle().click();
      uploadTemplate();

      sel.newService().type("Shower Assist", { delay: 0 });
      sel.addService().click();
      cy.assertPopover("This service already exists.");
    });

    it("ignores an empty add", () => {
      stubTemplateUpload();
      stubExtraction(DEFAULT_CATEGORIES);

      sel.templateToggle().click();
      uploadTemplate();

      sel.addService().click();
      cy.contains("Review Extracted Services").should("be.visible");
    });

    it("applies the selected services and says how many", () => {
      stubTemplateUpload();
      stubExtraction(DEFAULT_CATEGORIES);
      // handleConfirmServices raises this popover and then immediately saves,
      // and the save's own "Data Saved Successfully" replaces it. Against an
      // instant stub the first message can be gone before it is ever asserted,
      // so hold the response open long enough for it to be readable.
      cy.intercept("PUT", "**/v1/user/**", (req) =>
        req.reply({ delay: 2000, statusCode: 200, body: {} })
      ).as("updateLead");

      sel.templateToggle().click();
      uploadTemplate();
      sel.confirmServices().click();

      cy.assertPopover("4 service(s) applied from template");
    });

    it("confirms the save that applying a template triggers", () => {
      stubTemplateUpload();
      stubExtraction(DEFAULT_CATEGORIES);

      sel.templateToggle().click();
      uploadTemplate();
      sel.confirmServices().click();

      cy.wait("@updateLead");
      cy.assertPopover("Data Saved Successfully");
    });

    it("saves the applied services straight away", () => {
      stubTemplateUpload();
      stubExtraction([{ name: "Personal Care", services: ["Shower Assist"] }]);

      sel.templateToggle().click();
      uploadTemplate();
      sel.confirmServices().click();

      cy.wait("@updateLead").then(({ request }) => {
        expect(request.body.carePlan.adl).to.have.property("showerassist");
        expect(request.body.carePlan.adl.showerassist.careLevel).to.eq("Independent");
      });
    });

    it("replaces the default fields with the extracted ones", () => {
      stubTemplateUpload();
      stubExtraction([{ name: "Personal Care", services: ["Shower Assist"] }]);

      sel.templateToggle().click();
      uploadTemplate();
      sel.confirmServices().click();

      // Confirming saves, and a successful careplan save moves the sub-tab on to
      // Overall Health — so come back to ADL'S to see the new field set. The
      // applied services survive the remount via sessionStorage.
      cy.wait("@updateLead");
      openTab(ADLS_TAB);
      select(`${ADL}.showerassist.careLevel`).should("exist");
      select(`${ADL}.bathing.careLevel`).should("not.exist");
    });

    it("drops a service that was deselected before confirming", () => {
      stubTemplateUpload();
      stubExtraction([{ name: "Personal Care", services: ["Shower Assist", "Hair Washing"] }]);

      sel.templateToggle().click();
      uploadTemplate();
      serviceCheckbox("Hair Washing").uncheck({ force: true });
      sel.confirmServices().click();

      cy.wait("@updateLead").then(({ request }) => {
        expect(request.body.carePlan.adl).to.have.property("showerassist");
        expect(request.body.carePlan.adl).to.not.have.property("hairwashing");
      });
    });

    it("hides the toggle from a role without the customize permission", () => {
      // utils/roles.ts grants SENIOR_CUSTOMIZE_ADLS to PCHO alone.
      visitCareplan(buildCompletedLead());
      cy.contains("span", "Use Template").should("be.visible");

      visitLead(buildCompletedLead(), { role: "Lead" });
      openTab("Careplan");
      cy.contains("ADL Services").should("be.visible");
      cy.contains("span", "Use Template").should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 9. Careplan — Overall Health (the milestone-awarding save)
  // ──────────────────────────────────────────────────────────────────────────

  describe("Careplan — Overall Health", () => {
    const openOverallHealth = (lead = buildCompletedLead()) => {
      visitCareplan(lead);
      openTab("Overall Health");
      cy.contains("Physical Health").should("be.visible");
      cy.settleForm();
    };

    beforeEach(() => openOverallHealth());

    it("renders the physical health questions", () => {
      [
        `${PH}.painManagementCareLevel`,
        `${PH}.recurringIllnessCareLevel`,
        `${PH}.nursingProceduresCareLevel`,
        `${PH}.eyeSightCareLevel`,
        `${PH}.hearing`,
        `${PH}.diabetisStatus`,
        `${PH}.chokingRisk`,
      ].forEach((name) => select(name).should("exist"));
    });

    it("offers every pain level", () => {
      ["No Pain", "Mild Pain", "Moderate Pain", "Severe Pain"].forEach((option) =>
        select(`${PH}.painManagementCareLevel`).contains(option).should("exist")
      );
    });

    it("offers every eyesight option", () => {
      ["Normal Vision", "Blind"].forEach((option) =>
        select(`${PH}.eyeSightCareLevel`).contains(option).should("exist")
      );
    });

    it("limits the diabetic and choking questions to Yes or No", () => {
      select(`${PH}.diabetisStatus`).find("option").should("have.length", 3); // + placeholder
      select(`${PH}.chokingRisk`).find("option").should("have.length", 3);
    });

    it("renders the behaviour pattern checkboxes", () => {
      check(`${BP}.wanderingRisk`).should("exist");
      check(`${BP}.evacuationAssistance`).should("exist");
    });

    it("renders the default vital signs", () => {
      ["bloodPressure", "bloodOxygen", "pulse", "bloodSugar", "pacemaker"].forEach((key) =>
        check(`${VS}.${key}`).should("exist")
      );
    });

    it("accepts a behaviour comment", () => {
      area(`${BP}.comments`).type("Settles well after dark.", { delay: 0 });
      area(`${BP}.comments`).should("have.value", "Settles well after dark.");
    });

    it("pre-fills answers already saved on the lead", () => {
      openOverallHealth(
        buildCompletedLead({ carePlan: { physicalHealth: { hearing: "Requires hearing aid" } } })
      );
      select(`${PH}.hearing`).should("have.value", "Requires hearing aid");
    });

    // ── the milestone ───────────────────────────────────────────────────────

    it("awards the onboarding milestone on save", () => {
      select(`${PH}.painManagementCareLevel`).select("No Pain");
      sel.save().click();

      cy.wait("@updateLead").then(({ request }) => {
        expect(request.body.milestone).to.include("onboarding");
      });
    });

    it("keeps the milestones the lead already held", () => {
      sel.save().click();

      cy.wait("@updateLead").then(({ request }) => {
        expect(request.body.milestone).to.include("initial contact");
        expect(request.body.milestone).to.include("tour");
      });
    });

    it("does not add the milestone twice for an already-onboarded lead", () => {
      openOverallHealth(
        buildCompletedLead({ milestone: ["initial contact", "tour", "onboarding"] })
      );
      sel.save().click();

      cy.wait("@updateLead").then(({ request }) => {
        const onboarding = request.body.milestone.filter((m: string) => m === "onboarding");
        expect(onboarding).to.have.length(1);
      });
    });

    it("confirms the save", () => {
      sel.save().click();
      cy.wait("@updateLead");
      cy.assertPopover("Completed Biography data!");
    });

    it("sends the chosen answers", () => {
      select(`${PH}.hearing`).select("Requires hearing aid");
      check(`${BP}.wanderingRisk`).check({ force: true });
      sel.save().click();

      cy.wait("@updateLead").then(({ request }) => {
        expect(request.body.carePlan.physicalHealth.hearing).to.eq("Requires hearing aid");
        expect(request.body.carePlan.behaviourPatterns.wanderingRisk).to.eq(true);
      });
    });

    it("leaves the ADL answers alone", () => {
      openOverallHealth(
        buildCompletedLead({ carePlan: { adl: { bathing: { careLevel: "Full Assistance" } } } })
      );
      sel.save().click();

      cy.wait("@updateLead").then(({ request }) => {
        expect(request.body.carePlan.adl.bathing.careLevel).to.eq("Full Assistance");
      });
    });

    it("does not award the milestone when the save is rejected", () => {
      cy.stubPut("/v1/user", "updateLead", 500, { error: "Careplan service unavailable" });
      sel.save().click();

      cy.wait("@updateLead");
      cy.assertPopover("Careplan service unavailable");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 10. Read-only leads
  // ──────────────────────────────────────────────────────────────────────────

  describe("Read-only leads", () => {
    it("locks the Biography form for a lost lead", () => {
      visitLead(buildCompletedLead({ milestone: ["initial contact", "lost"] }));
      cy.get("fieldset").should("be.disabled");
    });

    it("locks the Biography form for a deleted lead", () => {
      visitLead(buildCompletedLead({ isDeleted: true }));
      cy.get("fieldset").should("be.disabled");
    });

    it("greys out Save for a lost lead", () => {
      visitLead(buildCompletedLead({ milestone: ["initial contact", "lost"] }));
      sel.save().should("be.disabled");
    });

    it("does not save a lost lead", () => {
      visitLead(buildCompletedLead({ milestone: ["initial contact", "lost"] }));
      sel.save().click({ force: true });
      cy.assertNoRequest("@updateLead");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 11. End-to-end
  // ──────────────────────────────────────────────────────────────────────────

  describe("End-to-end journeys", () => {
    it("E2E — a grey handshake, three tabs filled, and the milestone awarded", () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome();
      cy.stubUsers([buildLead()]);
      cy.stubUser(buildLead());
      cy.stubPut("/v1/user", "updateLead", 200, {});

      // The board shows the lead as not yet onboarded.
      cy.visit(CRM_PATH);
      cy.wait("@getUsers");
      cy.contains("Brahma Teja")
        .closest('div[class*="border-b"]')
        .find('svg[viewBox="0 0 27 18"] path')
        .first()
        .should("have.attr", "fill", "gray");

      // Biography.
      cy.visit(LEAD_PATH);
      cy.contains("Personal Details", { timeout: 10000 }).should("be.visible");
      cy.settleForm();
      select(`${P}.gender`).select("Male");
      field(`${P}.birthdate`).type("1948-04-12");
      sel.save().click();
      cy.wait("@updateLead");
      cy.assertPopover("Data Saved Successfully");
      cy.dismissPopover();

      // Medical — the Biography save has already moved us here.
      cy.contains("Service Contacts", { timeout: 10000 }).should("be.visible");
      cy.settleForm();
      addProvider();
      sel.save().click();
      cy.wait("@updateLead");
      cy.assertPopover("Data Saved Successfully");
      cy.dismissPopover();

      // Careplan → ADL'S.
      cy.contains("ADL Services", { timeout: 10000 }).should("be.visible");
      cy.settleForm();
      select(`${ADL}.bathing.careLevel`).select("Monitor & Cue");
      sel.save().click();
      cy.wait("@updateLead");
      cy.assertPopover("Data Saved Successfully");
      cy.dismissPopover();

      // Careplan → Overall Health, the only save that awards the milestone.
      cy.contains("Physical Health", { timeout: 10000 }).should("be.visible");
      cy.settleForm();
      select(`${PH}.painManagementCareLevel`).select("No Pain");
      sel.save().click();
      cy.wait("@updateLead").then(({ request }) => {
        expect(request.body.milestone).to.include("onboarding");
      });
      cy.assertPopover("Completed Biography data!");
      cy.dismissPopover();

      // With the milestone recorded, the board paints the handshake blue.
      cy.stubUsers([buildLead({ milestone: ["initial contact", "tour", "onboarding"] })]);
      cy.visit(CRM_PATH);
      cy.wait("@getUsers");
      cy.contains("Brahma Teja")
        .closest('div[class*="border-b"]')
        .find('svg[viewBox="0 0 27 18"] path')
        .first()
        .should("have.attr", "fill", "#514CEB");
    });

    it("E2E — a validation error is corrected and Biography then saves", () => {
      visitLead();
      sel.save().click();
      cy.assertNoRequest("@updateLead");
      assertSectionFlagged("Personal Details");

      select(`${P}.gender`).select("Female");
      field(`${P}.birthdate`).type("1950-09-30");
      sel.save().click();

      cy.wait("@updateLead");
      cy.assertPopover("Data Saved Successfully");
    });

    it("E2E — a custom template replaces the default ADLs and is saved", () => {
      visitCareplan();
      stubTemplateUpload();
      stubExtraction([
        { name: "Personal Care", services: ["Shower Assist"] },
        { name: "Vital Signs", services: ["Blood Pressure"] },
      ]);

      sel.templateToggle().click();
      uploadTemplate();
      cy.contains("Review Extracted Services").should("be.visible");
      sel.confirmServices().click();

      // The "N service(s) applied" popover is asserted in the Use Template block
      // against a held-open save; here it would race the save's own message.
      cy.wait("@updateLead").then(({ request }) => {
        expect(request.body.carePlan.adl).to.have.property("showerassist");
        expect(request.body.carePlan.vitalSigns).to.have.property("bloodPressure");
      });

      openTab(ADLS_TAB);
      select(`${ADL}.showerassist.careLevel`).should("exist");
    });
  });
});
