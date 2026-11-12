/// <reference types="cypress" />

/**
 * CRM — Referral Agents
 *
 * The referral board at /crm/referral. Like Senior Leads it carries a
 * Contacts / Campaign History toggle and Send Bulk Campaign, plus two things of
 * its own: an Export Referrals download and a per-row Status dropdown.
 *
 *   components/referral/referral-table.tsx    the board, export, campaign button
 *   components/referral/referral_status.tsx   the Status dropdown + its Save
 *   components/referral/referral-action-cell.tsx   the ⋮ menu (Edit, Delete)
 *   components/referral/add-referral.tsx      the Add / Edit form (one component)
 *   utils/exportToCsv.ts                      builds the CSV client-side
 *
 * The campaign wizard itself is covered by senior-leads-bulk-campaign.cy.ts; here it is
 * only asserted that the referral board can reach it.
 */

import { Tags } from "../../framework/utils/tags";
import { buildHome, buildUserRow } from "../../framework/module-commands";

const REFERRAL_PATH = "/crm/referral";

/** A referral agent as GET /v1/users?userType=Referral returns one. */
const buildReferral = (overrides: Record<string, any> = {}) =>
  buildUserRow({
    userId: "rrrrrrrr-0001-4rrr-8rrr-rrrrrrrrrrrr",
    name: "Neha Srinivasan",
    firstName: "Neha",
    lastName: "Srinivasan",
    email: "neha@yopmail.com",
    mobile: "4155550145",
    role: "Referral",
    referralOrgName: "Community Referrals",
    referralFollowupStatus: "Not Contacted",
    milestone: [],
    ...overrides,
  });

const STATUS_OPTIONS = [
  "Contacted",
  "Not Contacted",
  "Followup Required",
  "Not Interested",
];

const sel = {
  addNew: () => cy.contains("button", "Add New"),
  save: () => cy.contains("button", "Save"),
  update: () => cy.contains("button", "Update"),
  confirm: () => cy.contains("button", "Confirm"),
  cancel: () => cy.contains("button", "Cancel"),
  exportButton: () => cy.contains("button", "Export Referrals"),
  bulkButton: () => cy.contains("button", "Send Bulk Campaign"),
  rowCheckboxes: () => cy.get('input[name="row"]'),
  /** The dropdown trigger carries the current status. */
  statusTrigger: (name: string) =>
    cy.contains(name).closest('div[class*="border-b"]').find("div.bg-blue-100").first(),
  /** Menu entries are plain divs, so anchor on the exact label. */
  item: (label: string) => cy.contains("div", new RegExp(`^${label}$`)),
};

const visitReferrals = (
  users: any[] = [buildReferral()],
  opts: { home?: ReturnType<typeof buildHome>; role?: any } = {}
) => {
  cy.clearAuthSession();
  cy.setAuthSession(opts.role ?? "PCHO");
  cy.stubHome(opts.home ?? buildHome());
  cy.stubUsers(users);
  cy.visit(REFERRAL_PATH);
  cy.wait("@getUsers");
};

/**
 * Capture the CSV the export builds, and the filename it asks the browser for.
 *
 * exportToCsv never touches the network — it makes a Blob, hands it to
 * `URL.createObjectURL` and clicks a hidden anchor. Stubbing createObjectURL is
 * what makes the content assertable without depending on a real download
 * landing on disk, which is slow and platform-dependent; stubbing the anchor's
 * click keeps the browser from acting on the now-fake href at all.
 *
 * The values land in module-scope variables rather than aliases because
 * `blob.text()` resolves outside Cypress's command queue — `assertCsv` below
 * retries until they are populated.
 */
let csvText = "";
let downloadName = "";

const captureCsv = () => {
  csvText = "";
  downloadName = "";
  cy.window().then((win) => {
    cy.stub(win.URL, "createObjectURL").callsFake((blob: Blob) => {
      blob.text().then((text) => {
        csvText = text;
      });
      return "blob:stubbed";
    });
    cy.stub(win.URL, "revokeObjectURL");
    cy.stub(win.HTMLAnchorElement.prototype, "click").callsFake(function (
      this: HTMLAnchorElement
    ) {
      downloadName = this.getAttribute("download") ?? "";
    });
  });
};

/** Run `check` against the captured CSV, retrying until the blob has resolved. */
const assertCsv = (check: (text: string) => void) =>
  cy
    .wrap(null, { log: false })
    .should(() => expect(csvText, "captured CSV").to.not.eq(""))
    .then(() => check(csvText));

describe("CRM — Referral Agents", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. The board
  // ──────────────────────────────────────────────────────────────────────────

  describe("The board", () => {
    beforeEach(() => visitReferrals());

    it("names the board", () => {
      cy.contains("Referral Agents").should("be.visible");
    });

    it("counts the agents the home has", () => {
      cy.contains("1 Team members").should("be.visible");
    });

    it("renders every column header", () => {
      ["Name", "Email", "Phone", "Referral Agency", "Status"].forEach((header) =>
        cy.contains(header).should("be.visible")
      );
    });

    it("renders the agent's details", () => {
      cy.contains("Neha Srinivasan").should("be.visible");
      cy.contains("4155550145").should("be.visible");
      cy.contains("Community Referrals").should("be.visible");
    });

    it("offers the Contacts / Campaign History toggle", () => {
      cy.contains("Contacts").should("be.visible");
      cy.contains("Campaign History").should("be.visible");
    });

    it("offers Add New", () => {
      sel.addNew().should("be.visible");
    });

    it("truncates a long email address", () => {
      cy.stubUsers([
        buildReferral({ email: "an.extremely.long.address@referrals.example.com" }),
      ]);
      cy.visit(REFERRAL_PATH);
      cy.wait("@getUsers");

      // referral-table.tsx cuts at substring(0, 22) before appending the ellipsis.
      cy.contains("an.extremely.long.addr...").should("be.visible");
    });

    it("dashes out the details an agent does not have", () => {
      cy.stubUsers([
        buildReferral({ email: "", mobile: "", referralOrgName: "" }),
      ]);
      cy.visit(REFERRAL_PATH);
      cy.wait("@getUsers");

      cy.contains("Neha Srinivasan").should("be.visible");
      cy.get("p").contains("-").should("exist");
    });

    it("says so when the home has no referrals", () => {
      cy.stubUsers([]);
      cy.visit(REFERRAL_PATH);
      cy.wait("@getUsers");

      cy.contains("No Referrals added yet.").should("be.visible");
    });

    it("hides the Add New action from a role without SMART_CRM", () => {
      // SalesRepresentative holds CRM_REFERRAL but not SMART_CRM.
      visitReferrals([buildReferral()], { role: "SalesRepresentative" });
      cy.contains("Referral Agents").should("be.visible");
      sel.addNew().should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Export Referrals
  // ──────────────────────────────────────────────────────────────────────────

  describe("Export Referrals", () => {
    it("offers the export when the board has rows", () => {
      visitReferrals();
      sel.exportButton().should("not.be.disabled");
    });

    it("disables the export when there is nothing to export", () => {
      visitReferrals([]);
      sel.exportButton().should("be.disabled");
    });

    it("builds the CSV with the documented header row", () => {
      visitReferrals();
      captureCsv();
      sel.exportButton().click();

      assertCsv((csv) =>
        expect(csv).to.contain("S.No,Name,Email,Phone,Referral Agency")
      );
    });

    it("writes one numbered line per agent", () => {
      visitReferrals([
        buildReferral(),
        buildReferral({
          userId: "rrrrrrrr-0002-4rrr-8rrr-rrrrrrrrrrrr",
          name: "Thomas Gray",
          email: "thomas@yopmail.com",
          mobile: "4155550144",
          referralOrgName: "SummitPath",
        }),
      ]);
      captureCsv();
      sel.exportButton().click();

      assertCsv((csv) => {
        const lines = csv.trim().split("\n");
        expect(lines, "header + two rows").to.have.length(3);
        expect(lines[1]).to.contain("1,Neha Srinivasan");
        expect(lines[2]).to.contain("2,Thomas Gray");
      });
    });

    it("quotes a field containing a comma", () => {
      visitReferrals([
        buildReferral({ referralOrgName: "Community Referrals, Inc" }),
      ]);
      captureCsv();
      sel.exportButton().click();

      assertCsv((csv) => expect(csv).to.contain('"Community Referrals, Inc"'));
    });

    it("leaves a missing field empty rather than writing undefined", () => {
      visitReferrals([buildReferral({ referralOrgName: undefined })]);
      captureCsv();
      sel.exportButton().click();

      assertCsv((csv) => expect(csv).to.not.contain("undefined"));
    });

    it("names the download referrals.csv", () => {
      visitReferrals();
      captureCsv();
      sel.exportButton().click();

      cy.wrap(null, { log: false })
        .should(() => expect(downloadName, "download attribute").to.not.eq(""))
        .then(() => expect(downloadName).to.eq("referrals.csv"));
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Status dropdown
  // ──────────────────────────────────────────────────────────────────────────

  describe("Status", () => {
    beforeEach(() => visitReferrals());

    it("shows the agent's current status", () => {
      cy.contains("Not Contacted").should("be.visible");
    });

    it("offers all four statuses", () => {
      sel.statusTrigger("Neha Srinivasan").click();
      STATUS_OPTIONS.forEach((option) => cy.contains(option).should("be.visible"));
    });

    it("closes again when the trigger is clicked twice", () => {
      sel.statusTrigger("Neha Srinivasan").click();
      cy.contains("Followup Required").should("be.visible");
      sel.statusTrigger("Neha Srinivasan").click();
      cy.contains("Followup Required").should("not.exist");
    });

    it("sends nothing until Save is pressed", () => {
      cy.intercept("PUT", "**/v1/user/**").as("updateStatus");
      sel.statusTrigger("Neha Srinivasan").click();
      cy.contains("Followup Required").click();
      cy.assertNoRequest("@updateStatus");
    });

    it("saves the chosen status against the agent", () => {
      cy.stubPut("/v1/user", "updateStatus", 200, {});
      sel.statusTrigger("Neha Srinivasan").click();
      cy.contains("Followup Required").click();
      sel.save().click();

      cy.wait("@updateStatus").then(({ request }) => {
        expect(request.body.referralFollowupStatus).to.eq("Followup Required");
        expect(request.body.userId).to.eq(buildReferral().userId);
      });
    });

    it("stamps the moment the agent was contacted", () => {
      cy.stubPut("/v1/user", "updateStatus", 200, {});
      sel.statusTrigger("Neha Srinivasan").click();
      cy.contains(/^Contacted$/).click();
      sel.save().click();

      cy.wait("@updateStatus").then(({ request }) => {
        expect(request.body.referralContactedOn, "referralContactedOn").to.match(
          /^\d{4}-\d{2}-\d{2}T/
        );
      });
    });

    it("closes the dropdown once the status is saved", () => {
      cy.stubPut("/v1/user", "updateStatus", 200, {});
      sel.statusTrigger("Neha Srinivasan").click();
      cy.contains("Not Interested").click();
      sel.save().click();

      cy.wait("@updateStatus");
      cy.contains("Followup Required").should("not.exist");
    });

    it("reports a rejected status change", () => {
      cy.intercept("PUT", "**/v1/user/**", {
        statusCode: 500,
        body: { message: "Status update failed" },
      }).as("updateStatus");
      sel.statusTrigger("Neha Srinivasan").click();
      cy.contains("Not Interested").click();
      sel.save().click();

      cy.wait("@updateStatus");
      cy.assertPopover("Status update failed");
    });

    it("ages a contacted agent rather than repeating the bare status", () => {
      cy.stubUsers([
        buildReferral({
          referralFollowupStatus: "Contacted",
          referralContactedOn: new Date(Date.now() - 3 * 86400000).toISOString(),
        }),
      ]);
      cy.visit(REFERRAL_PATH);
      cy.wait("@getUsers");

      cy.contains("Contacted 3 days ago").should("be.visible");
    });

    it("keeps each agent's dropdown to itself", () => {
      cy.stubUsers([
        buildReferral(),
        buildReferral({
          userId: "rrrrrrrr-0002-4rrr-8rrr-rrrrrrrrrrrr",
          name: "Thomas Gray",
          referralFollowupStatus: "Not Interested",
        }),
      ]);
      cy.visit(REFERRAL_PATH);
      cy.wait("@getUsers");

      cy.contains("Not Contacted").should("be.visible");
      cy.contains("Not Interested").should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Row menu — Edit
  // ──────────────────────────────────────────────────────────────────────────

  describe("Edit", () => {
    const openEdit = () => {
      cy.openRowMenu("Neha Srinivasan");
      sel.item("Edit").click();
    };

    beforeEach(() => visitReferrals());

    it("offers Edit and Delete", () => {
      cy.openRowMenu("Neha Srinivasan");
      sel.item("Edit").should("be.visible");
      sel.item("Delete").should("be.visible");
    });

    it("opens the edit form", () => {
      openEdit();
      cy.contains("Edit Referral Agent").should("be.visible");
    });

    it("pre-fills the agent's saved details", () => {
      openEdit();
      cy.get('input[name="firstName"]').should("have.value", "Neha");
      cy.get('input[name="lastName"]').should("have.value", "Srinivasan");
      cy.get('input[name="email"]').should("have.value", "neha@yopmail.com");
      cy.get('input[name="mobile"]').should("have.value", "4155550145");
      cy.get('input[name="referralOrgName"]').should(
        "have.value",
        "Community Referrals"
      );
    });

    it("offers Update rather than Save", () => {
      openEdit();
      sel.update().should("be.visible");
    });

    it("updates the agent", () => {
      cy.stubPut("/v1/user", "updateReferral", 200, {});
      openEdit();
      cy.typeField("referralOrgName", "SummitPath Referral Services");
      sel.update().click();

      cy.wait("@updateReferral").then(({ request }) => {
        expect(request.body.referralOrgName).to.eq("SummitPath Referral Services");
        expect(request.body.userId).to.eq(buildReferral().userId);
      });
      cy.assertPopover("Referral Updated Successfully");
    });

    it("rebuilds the display name from the name fields", () => {
      cy.stubPut("/v1/user", "updateReferral", 200, {});
      openEdit();
      cy.typeField("firstName", "Nehaa");
      sel.update().click();

      cy.wait("@updateReferral").then(({ request }) => {
        expect(request.body.name).to.eq("Nehaa Srinivasan");
      });
    });

    it("leaves the follow-up status untouched", () => {
      cy.stubPut("/v1/user", "updateReferral", 200, {});
      cy.stubUsers([buildReferral({ referralFollowupStatus: "Followup Required" })]);
      cy.visit(REFERRAL_PATH);
      cy.wait("@getUsers");

      openEdit();
      cy.typeField("firstName", "Nehaa");
      sel.update().click();

      cy.wait("@updateReferral").then(({ request }) => {
        expect(request.body.referralFollowupStatus).to.eq("Followup Required");
      });
    });

    it("reports a rejected update", () => {
      cy.stubPut("/v1/user", "updateReferral", 400, { error: "Email already in use" });
      openEdit();
      cy.typeField("firstName", "Nehaa");
      sel.update().click();

      cy.wait("@updateReferral");
      cy.assertPopover("Email already in use");
    });

    it("refuses an update that empties a required field", () => {
      cy.intercept("PUT", "**/v1/user/**").as("updateReferral");
      openEdit();
      cy.get('input[name="firstName"]').clear();
      sel.update().click();

      cy.assertNoRequest("@updateReferral");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Row menu — Delete
  // ──────────────────────────────────────────────────────────────────────────

  describe("Delete", () => {
    const openDelete = () => {
      cy.openRowMenu("Neha Srinivasan");
      sel.item("Delete").click();
    };

    beforeEach(() => visitReferrals());

    it("asks for confirmation first", () => {
      openDelete();
      cy.contains("Are you sure you want to permanently delete this Referral?").should(
        "be.visible"
      );
    });

    it("sends nothing until the delete is confirmed", () => {
      cy.intercept("DELETE", "**/v1/user/**").as("deleteReferral");
      openDelete();
      cy.assertNoRequest("@deleteReferral");
    });

    it("abandons the delete on Cancel", () => {
      cy.intercept("DELETE", "**/v1/user/**").as("deleteReferral");
      openDelete();
      sel.cancel().click();
      cy.assertNoRequest("@deleteReferral");
    });

    it("deletes the agent by id", () => {
      cy.stubDelete("/v1/user", "deleteReferral", 200, {});
      openDelete();
      sel.confirm().click();

      cy.wait("@deleteReferral").then(({ request }) => {
        expect(request.url).to.contain(buildReferral().userId);
      });
      cy.assertPopover("Referral deleted successfully!");
    });

    it("reports a rejected delete", () => {
      cy.stubDelete("/v1/user", "deleteReferral", 500, { error: "Delete failed" });
      openDelete();
      sel.confirm().click();

      cy.wait("@deleteReferral");
      cy.assertPopover("Delete failed");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Add New
  // ──────────────────────────────────────────────────────────────────────────

  describe("Add New", () => {
    const openAdd = () => {
      sel.addNew().click();
      cy.contains("Add Referral Agent").should("be.visible");
      cy.settleForm();
    };

    const fill = ({
      firstName = "Kevin",
      lastName = "Brooks",
      email = "kevin@yopmail.com",
      mobile = "4155550142",
      referralOrgName = "CedarHill Senior Advisors",
    } = {}) => {
      cy.typeField("firstName", firstName);
      cy.typeField("lastName", lastName);
      cy.typeField("email", email);
      cy.typeField("mobile", mobile);
      if (referralOrgName) cy.typeField("referralOrgName", referralOrgName);
    };

    beforeEach(() => {
      visitReferrals();
      openAdd();
    });

    it("renders every field", () => {
      ["firstName", "middleName", "lastName", "email", "mobile", "referralOrgName"].forEach(
        (name) => cy.get(`input[name="${name}"]`).should("exist")
      );
    });

    it("marks the required fields", () => {
      ["First Name *", "Last Name *", "Email *", "Phone Number *"].forEach((label) =>
        cy.contains(label).should("be.visible")
      );
    });

    it("refuses an empty form", () => {
      cy.intercept("POST", "**/v1/user").as("createReferral");
      sel.save().click();
      cy.assertNoRequest("@createReferral");
    });

    it("refuses a malformed email", () => {
      fill({ email: "not-an-email" });
      sel.save().click();
      cy.contains("Invalid email").should("be.visible");
    });

    it("refuses a phone number that is not ten digits", () => {
      fill({ mobile: "41555" });
      sel.save().click();
      cy.contains("Mobile number must be exactly 10 digits").should("be.visible");
    });

    it("refuses a non-numeric phone number", () => {
      fill({ mobile: "415-555-0142" });
      sel.save().click();
      cy.contains("Only numbers are allowed").should("be.visible");
    });

    it("refuses a name containing punctuation", () => {
      fill({ firstName: "Kevin@" });
      sel.save().click();
      cy.contains("First Name accepts only alphabets and numbers").should("be.visible");
    });

    it("refuses an organisation name containing digits", () => {
      fill({ referralOrgName: "CedarHill 123" });
      sel.save().click();
      cy.contains("only alphabets are allowed").should("be.visible");
    });

    it("accepts an agent with no organisation name", () => {
      cy.stubPost("/v1/user", "createReferral", 201, {});
      fill({ referralOrgName: "" });
      sel.save().click();

      cy.wait("@createReferral");
      cy.assertPopover("Referral Added Successfully");
    });

    it("creates the agent", () => {
      cy.stubPost("/v1/user", "createReferral", 201, {});
      fill();
      sel.save().click();

      cy.wait("@createReferral").then(({ request }) => {
        expect(request.body.name).to.eq("Kevin Brooks");
        expect(request.body.role).to.eq("Referral");
        expect(request.body.referralOrgName).to.eq("CedarHill Senior Advisors");
      });
      cy.assertPopover("Referral Added Successfully");
    });

    it("starts a new agent off as Not Contacted", () => {
      cy.stubPost("/v1/user", "createReferral", 201, {});
      fill();
      sel.save().click();

      cy.wait("@createReferral").then(({ request }) => {
        expect(request.body.referralFollowupStatus).to.eq("Not Contacted");
      });
    });

    it("lowercases and trims the email before sending it", () => {
      cy.stubPost("/v1/user", "createReferral", 201, {});
      fill({ email: "Kevin@Yopmail.com" });
      sel.save().click();

      cy.wait("@createReferral").then(({ request }) => {
        expect(request.body.email).to.eq("kevin@yopmail.com");
      });
    });

    it("reports a rejected create", () => {
      cy.stubPost("/v1/user", "createReferral", 400, { error: "Email already exists" });
      fill();
      sel.save().click();

      cy.wait("@createReferral");
      cy.assertPopover("Email already exists");
    });

    it("clears the error once the field is corrected", () => {
      fill({ email: "bad" });
      sel.save().click();
      cy.contains("Invalid email").should("be.visible");

      cy.typeField("email", "kevin@yopmail.com");
      cy.contains("Invalid email").should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Campaigns
  // ──────────────────────────────────────────────────────────────────────────

  describe("Campaigns", () => {
    beforeEach(() => visitReferrals());

    it("disables Send Bulk Campaign until an agent is selected", () => {
      sel.bulkButton().should("be.disabled");
    });

    it("enables Send Bulk Campaign once an agent is selected", () => {
      sel.rowCheckboxes().first().check({ force: true });
      sel.bulkButton().should("not.be.disabled");
    });

    it("opens the campaign wizard from the referral board", () => {
      sel.rowCheckboxes().first().check({ force: true });
      sel.bulkButton().click();
      cy.contains("Audience Summary").should("be.visible");
    });

    it("switches to Campaign History", () => {
      cy.contains("Campaign History").click();
      cy.contains("Nothing added yet.").should("be.visible");
    });

    it("lists the home's referral campaigns", () => {
      cy.stubHome(
        buildHome({
          campaigns: [
            {
              campaignType: "REFERRAL",
              campaignChannel: "EMAIL",
              campaignCreatedByUserId: "user-123",
              campaignMetadata: { subject: "Partner update" },
              campaignUsers: [{ userName: "Neha Srinivasan" }],
              createdAt: "2026-04-20T10:00:00.000Z",
            },
          ],
        })
      );
      cy.visit(REFERRAL_PATH);
      cy.wait("@getUsers");

      cy.contains("Campaign History").click();
      cy.contains("Partner update").should("be.visible");
      cy.contains("04/20/2026").should("be.visible");
    });

    it("keeps a senior campaign off the referral history", () => {
      cy.stubHome(
        buildHome({
          campaigns: [
            {
              campaignType: "SENIOR",
              campaignChannel: "EMAIL",
              campaignCreatedByUserId: "user-123",
              campaignMetadata: { subject: "Spring open house" },
              campaignUsers: [],
              createdAt: "2026-04-20T10:00:00.000Z",
            },
          ],
        })
      );
      cy.visit(REFERRAL_PATH);
      cy.wait("@getUsers");

      cy.contains("Campaign History").click();
      cy.contains("Spring open house").should("not.exist");
      cy.contains("Nothing added yet.").should("be.visible");
    });

    it("takes the Add New action away on Campaign History", () => {
      cy.contains("Campaign History").click();
      sel.addNew().should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. End-to-end journeys
  // ──────────────────────────────────────────────────────────────────────────

  describe("End-to-end journeys", () => {
    it("E2E — an agent is added, then appears on the board", () => {
      visitReferrals([]);
      cy.contains("No Referrals added yet.").should("be.visible");
      cy.stubPost("/v1/user", "createReferral", 201, {});

      sel.addNew().click();
      cy.settleForm();
      cy.typeField("firstName", "Kevin");
      cy.typeField("lastName", "Brooks");
      cy.typeField("email", "kevin@yopmail.com");
      cy.typeField("mobile", "4155550142");

      // Swap the list response so the refetch returns the new agent.
      cy.stubUsers([buildReferral({ name: "Kevin Brooks" })]);
      sel.save().click();

      cy.wait("@createReferral");
      cy.assertPopover("Referral Added Successfully");
      cy.contains("Kevin Brooks", { timeout: 10000 }).should("be.visible");
    });

    it("E2E — a validation error is corrected and the agent is then created", () => {
      visitReferrals();
      sel.addNew().click();
      cy.settleForm();

      cy.typeField("firstName", "Kevin");
      cy.typeField("lastName", "Brooks");
      cy.typeField("email", "bademail");
      cy.typeField("mobile", "4155550142");
      sel.save().click();
      cy.contains("Invalid email").should("be.visible");

      cy.stubPost("/v1/user", "createReferral", 201, {});
      cy.typeField("email", "kevin@yopmail.com");
      sel.save().click();

      cy.wait("@createReferral");
      cy.assertPopover("Referral Added Successfully");
    });

    it("E2E — an agent is contacted, the status is saved, and the board is exported", () => {
      visitReferrals();
      cy.stubPut("/v1/user", "updateStatus", 200, {});

      sel.statusTrigger("Neha Srinivasan").click();
      cy.contains(/^Contacted$/).click();
      sel.save().click();
      cy.wait("@updateStatus").then(({ request }) => {
        expect(request.body.referralFollowupStatus).to.eq("Contacted");
      });

      captureCsv();
      sel.exportButton().click();
      assertCsv((csv) => expect(csv).to.contain("Neha Srinivasan"));
    });
  });
});
