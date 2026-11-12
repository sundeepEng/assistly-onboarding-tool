/// <reference types="cypress" />

/**
 * Staff Management — Care Team
 *
 *   pages/hcm/team/index.tsx                                 the roster
 *   components/hcm/team/team-roster-table.tsx                its table and ⋮ menu
 *   pages/hcm/team/[userId].tsx                              one member
 *   components/hcm/team/index.tsx                            the three tabs
 *   components/hcm/team/job-details/access-roles-wages.tsx   Job Details
 *   components/hcm/team/personal-information/…               Personal Information
 *   components/hcm/team/documents/index.tsx                  Documents
 *
 * THE ⋮ MENU IS A TAB PICKER
 *   "View job details", "View documents" and "View personal information" all
 *   navigate to the same `/hcm/team/{userId}` page; the only difference is
 *   which tab they ask for. The choice is dispatched to Redux
 *   (`teamMemberTab`), not put in the URL, so the route is identical in all
 *   three cases and the assertion has to be on the tab content.
 *
 *   Clicking the NAME does the same thing with a role-dependent default:
 *   `role === "HomeAdmin" ? "Personal Information" : "Job Details"`.
 *
 * SAVING JOB DETAILS IS TWO REQUESTS
 *   `handleSubmitAccessRoleWage` fires both and does not wait for either:
 *
 *     PUT /v1/hcm/roaster      { user_id, pay_rate, pay_frequency, home_id }
 *     PUT /v1/user/{id}        the whole user, with contractCompletedOn
 *
 *   Each pops its own "Updated Successfully!", so a single save produces two.
 *   Stub both — a spec that stubs only the roaster lets the user update escape.
 *
 * WHAT IS ACTUALLY LOCKED
 *   Job Details  Role(s) is `disabled`; start date, wage frequency and wage
 *                rate are editable.
 *   Personal     Email is `readOnly` **only when the member already has one**
 *                (`readOnly={formState.defaultValues.email ? true : false}`),
 *                so a member with no email can be given one here. Name, mobile
 *                and both emergency-contact fields are always editable.
 *
 * The Add Team Member button opens the same Add Care Lead dialog the scheduling
 * board opens; the form itself is covered in scheduling-add-team-member.cy.ts,
 * so only the handover is asserted here.
 */

import { Tags } from "../../framework/utils/tags";
import { buildHome, TEST_HOME_ID } from "../../framework/module-commands";

const TEAM_PATH = "/hcm/team";

/** Tuesday 8 September 2026, 10:00 local — the instant every HCM spec uses. */
const FROZEN_NOW = new Date(2026, 8, 8, 10, 0, 0).getTime();

const MORRIS = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const STUART = "bbbbbbbb-bbbb-4bbb-8bbb-cccccccccccc";
const GONE = "bbbbbbbb-bbbb-4bbb-8bbb-dddddddddddd";

const buildMember = (
  userId: string,
  name: string,
  overrides: Record<string, any> = {}
) => ({
  userId,
  name,
  firstName: name.split(" ")[0],
  lastName: name.split(" ")[1] ?? "",
  email: `${name.split(" ")[0].toLowerCase()}@yopmail.com`,
  mobile: "8585854545",
  role: "PCG",
  home: "Comfort Cove",
  homeId: TEST_HOME_ID,
  contractCompletedOn: "2026-08-17",
  roaster: [{ pay_rate: "10", pay_frequency: "Hourly" }],
  biography: { personalDetails: {} },
  documents: [],
  isDeleted: false,
  ...overrides,
});

const MORRIS_MEMBER = buildMember(MORRIS, "Morris Olsen");
const STUART_MEMBER = buildMember(STUART, "Stuart Comic", {
  roaster: [{ pay_rate: "4500", pay_frequency: "Monthly" }],
});
const DELETED_MEMBER = buildMember(GONE, "Gone Away", { isDeleted: true });

// ── Selectors ────────────────────────────────────────────────────────────────

const sel = {
  addTeamMember: () => cy.contains("button", "Add Team Member"),
  row: (name: string) => cy.contains(name).closest('div[class*="border-b"]'),
  /** ⋮ entries are plain divs, so anchor on the exact label. */
  item: (label: string) => cy.contains("div", new RegExp(`^${label}$`)),
  tab: (label: string) => cy.contains("span", label),

  // Job Details
  editButton: () => cy.contains("button", "Edit"),
  roleSelect: () => cy.get('select[name="role"]'),
  startDate: () => cy.get('input[name="contractCompletedOn"]'),
  wageFrequency: () => cy.get('select[name="pay_frequency"]'),
  wageRate: () => cy.get('input[name="pay_rate"]'),

  // Personal Information
  firstName: () => cy.get('input[name="firstName"]'),
  lastName: () => cy.get('input[name="lastName"]'),
  email: () => cy.get('input[name="email"]'),
  mobile: () => cy.get('input[name="mobile"]'),
  emergencyName: () =>
    cy.get('input[name="biography.personalDetails.emergencyContactName"]'),
  emergencyPhone: () =>
    cy.get('input[name="biography.personalDetails.emergencyContactNumber"]'),

  save: () => cy.contains("button", /^Save$/),
  cancel: () => cy.contains("button", /^Cancel$/),
};

// ── Setup ────────────────────────────────────────────────────────────────────

const stubMembers = (members: any[]) =>
  cy.intercept("GET", "**/v1/users*", (req) => {
    const userType = req.query.userType as string | undefined;
    req.reply({
      statusCode: 200,
      body: { users: userType === "PCG" ? members : [] },
    });
  }).as("getStaff");

const stubMember = (members: any[]) =>
  cy.intercept("GET", "**/v1/user/*", (req) => {
    const id = req.url.split("/").pop()?.split("?")[0];
    req.reply({
      statusCode: 200,
      body: { user: members.find((m) => m.userId === id) ?? members[0] },
    });
  }).as("getMember");

const visitRoster = (
  members: any[] = [MORRIS_MEMBER, STUART_MEMBER],
  opts: { role?: any; home?: any; expectRestricted?: boolean } = {}
) => {
  cy.clearAuthSession();
  cy.setAuthSession(opts.role ?? "PCHO");
  cy.stubHome(opts.home ?? buildHome());
  stubMembers(members);
  stubMember(members);
  cy.intercept("GET", "**/v1/hcm/shifts*", {
    statusCode: 200,
    body: { shifts: [] },
  }).as("getShifts");
  cy.clock(FROZEN_NOW, ["Date"]);
  cy.visit(TEAM_PATH);
  if (opts.expectRestricted) return;
  cy.contains("Care Team").should("be.visible");
};

/** Land on a member's page with a given tab selected from the ⋮ menu. */
const openMemberVia = (label: string, name = "Morris Olsen") => {
  cy.openRowMenu(name);
  sel.item(label).click();
  cy.location("pathname", { timeout: 10000 }).should("contain", "/hcm/team/");
};

const stubRosterSave = (statusCode = 200) => {
  cy.intercept("PUT", "**/v1/hcm/roaster", { statusCode, body: {} }).as(
    "saveRoster"
  );
  // Job Details sends a second request; without this it escapes the stub.
  cy.intercept("PUT", "**/v1/user/*", { statusCode: 200, body: {} }).as(
    "saveUser"
  );
};

describe("Staff Management — Care Team", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. The roster
  // ──────────────────────────────────────────────────────────────────────────

  describe("The roster", () => {
    beforeEach(() => visitRoster());

    it("names the board", () => {
      cy.contains("Care Team").should("be.visible");
    });

    it("counts the members", () => {
      cy.contains("2 members").should("be.visible");
    });

    it("names the four columns", () => {
      ["Team Member", "Contact Information", "Role", "Wage"].forEach((header) =>
        cy.contains(header).should("be.visible")
      );
    });

    it("lists every member", () => {
      cy.contains("Morris Olsen").should("be.visible");
      cy.contains("Stuart Comic").should("be.visible");
    });

    it("shows each member's email and mobile", () => {
      cy.contains("morris@yopmail.com").should("be.visible");
      cy.contains("8585854545").should("exist");
    });

    it("calls a PCG a Care Team member", () => {
      sel.row("Morris Olsen").should("contain.text", "Care Team");
    });

    it("shows an hourly wage", () => {
      sel.row("Morris Olsen").should("contain.text", "$10/hr");
    });

    it("shows a monthly wage", () => {
      sel.row("Stuart Comic").should("contain.text", "$4500/m");
    });

    it("offers a ⋮ menu on every row", () => {
      cy.openRowMenu("Morris Olsen");
      sel.item("View job details").should("be.visible");
    });

    it("offers the Add Team Member button", () => {
      sel.addTeamMember().should("be.visible");
    });
  });

  describe("Gaps in a member's record", () => {
    it("offers to add a missing email", () => {
      visitRoster([buildMember(MORRIS, "Morris Olsen", { email: "" })]);
      cy.contains("Add Email").should("be.visible");
    });

    it("offers to add a missing phone", () => {
      visitRoster([buildMember(MORRIS, "Morris Olsen", { mobile: "" })]);
      cy.contains("Add Phone").should("be.visible");
    });

    it("offers to add a missing role", () => {
      visitRoster([buildMember(MORRIS, "Morris Olsen", { role: "" })]);
      cy.contains("Add Role").should("be.visible");
    });

    it("offers to add a missing wage", () => {
      visitRoster([buildMember(MORRIS, "Morris Olsen", { roaster: [] })]);
      cy.contains("Add Wage").should("be.visible");
    });

    it("truncates a long name", () => {
      visitRoster([
        buildMember(MORRIS, "Bartholomew Featherstonehaugh Smythe"),
      ]);
      cy.contains("Bartholomew Featherstoneh...").should("be.visible");
    });
  });

  describe("A deleted member", () => {
    beforeEach(() => visitRoster([MORRIS_MEMBER, DELETED_MEMBER]));

    it("is still listed for a role that may see them", () => {
      cy.contains("Gone Away").should("be.visible");
    });

    it("is greyed out", () => {
      sel.row("Gone Away").should("have.class", "opacity-50");
    });

    it("is left out of the count", () => {
      cy.contains("1 members").should("be.visible");
    });

    it("has an inert ⋮ menu", () => {
      sel.row("Gone Away")
        .find('div[class*="pointer-events-none"]')
        .should("exist");
    });

    it("sorts below the active members", () => {
      visitRoster([DELETED_MEMBER, MORRIS_MEMBER]);
      cy.get('div[class*="border-b"]').should(($rows) => {
        const text = [...$rows].map((row) => row.textContent || "");
        const active = text.findIndex((t) => t.includes("Morris Olsen"));
        const deleted = text.findIndex((t) => t.includes("Gone Away"));
        expect(active, "the active member is rendered").to.be.greaterThan(-1);
        expect(deleted, "the deleted member sits below").to.be.greaterThan(active);
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Add Team Member
  // ──────────────────────────────────────────────────────────────────────────

  describe("Add Team Member", () => {
    beforeEach(() => visitRoster());

    it("opens the Add Care Lead dialog", () => {
      // The form itself is covered in scheduling-add-team-member.cy.ts.
      sel.addTeamMember().click();
      cy.contains("Add Care Lead").should("be.visible");
    });

    it("asks for the five fields", () => {
      sel.addTeamMember().click();
      ["firstName", "middleName", "lastName", "email", "mobile"].forEach((name) =>
        cy.get(`input[name="${name}"]`).should("exist")
      );
    });

    it("sends nothing merely by opening", () => {
      cy.intercept("POST", "**/v1/user").as("createUser");
      sel.addTeamMember().click();
      cy.assertNoRequest("@createUser");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Getting to a member
  // ──────────────────────────────────────────────────────────────────────────

  describe("Opening a member", () => {
    beforeEach(() => visitRoster());

    it("opens their page when the name is clicked", () => {
      cy.contains("Morris Olsen").click();
      cy.location("pathname", { timeout: 10000 }).should(
        "eq",
        `${TEAM_PATH}/${MORRIS}`
      );
    });

    it("lands on Job Details by default", () => {
      cy.contains("Morris Olsen").click();
      cy.contains("Access, Roles & Wages", { timeout: 10000 }).should("be.visible");
    });

    it("goes to Job Details from the ⋮ menu", () => {
      openMemberVia("View job details");
      cy.contains("Access, Roles & Wages", { timeout: 10000 }).should("be.visible");
    });

    it("goes to Personal Information from the ⋮ menu", () => {
      openMemberVia("View personal information");
      cy.contains("Contact Information", { timeout: 10000 }).should("be.visible");
    });

    it("goes to Documents from the ⋮ menu", () => {
      openMemberVia("View documents");
      cy.contains("Access, Roles & Wages").should("not.exist");
      cy.contains("Contact Information").should("not.exist");
    });

    it("goes to Personal Information from the Add Email link", () => {
      visitRoster([buildMember(MORRIS, "Morris Olsen", { email: "" })]);
      cy.contains("Add Email").click();
      cy.contains("Contact Information", { timeout: 10000 }).should("be.visible");
    });

    it("goes to Personal Information from the Add Phone link", () => {
      visitRoster([buildMember(MORRIS, "Morris Olsen", { mobile: "" })]);
      cy.contains("Add Phone").click();
      cy.contains("Contact Information", { timeout: 10000 }).should("be.visible");
    });

    it("goes to Job Details from the Add Wage link", () => {
      visitRoster([buildMember(MORRIS, "Morris Olsen", { roaster: [] })]);
      cy.contains("Add Wage").click();
      cy.contains("Access, Roles & Wages", { timeout: 10000 }).should("be.visible");
    });
  });

  describe("The member's page", () => {
    beforeEach(() => {
      visitRoster();
      cy.contains("Morris Olsen").click();
      cy.contains("Access, Roles & Wages", { timeout: 10000 }).should("be.visible");
    });

    it("names them in the header", () => {
      cy.get('div[class*="text-[30px]"]').should("contain.text", "Morris Olsen");
    });

    it("shows their mobile and email in the header", () => {
      cy.contains("8585854545").should("be.visible");
      cy.contains("morris@yopmail.com").should("be.visible");
    });

    it("offers all three tabs", () => {
      ["Job Details", "Personal Information", "Documents"].forEach((label) =>
        sel.tab(label).should("be.visible")
      );
    });

    it("moves between the tabs", () => {
      sel.tab("Personal Information").click();
      cy.contains("Contact Information").should("be.visible");
      sel.tab("Job Details").click();
      cy.contains("Access, Roles & Wages").should("be.visible");
    });
  });

  it("dashes a missing mobile and email in the header", () => {
    visitRoster([buildMember(MORRIS, "Morris Olsen", { mobile: "", email: "" })]);
    cy.contains("Add Phone").click();
    cy.contains("Contact Information", { timeout: 10000 }).should("be.visible");
    cy.get('div[class*="text-[30px]"]')
      .parent()
      .find('div[class*="text-[18px]"]')
      .should("have.length", 2)
      .each(($line) => expect($line.text()).to.eq("-"));
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Job Details — reading
  // ──────────────────────────────────────────────────────────────────────────

  describe("Job Details", () => {
    beforeEach(() => {
      visitRoster();
      openMemberVia("View job details");
      cy.contains("Access, Roles & Wages", { timeout: 10000 }).should("be.visible");
    });

    it("heads the card", () => {
      cy.contains("Access, Roles & Wages").should("be.visible");
    });

    it("names the member on the card", () => {
      cy.get("h3").should("contain.text", "Morris Olsen");
    });

    it("shows the role and the hourly wage together", () => {
      cy.contains("Role(s) & Wages(s):").should("be.visible");
      cy.contains("Care Team 10/hour").should("be.visible");
    });

    it("shows a monthly wage as a monthly one", () => {
      visitRoster([STUART_MEMBER]);
      openMemberVia("View job details", "Stuart Comic");
      cy.contains("Care Team 4500/month", { timeout: 10000 }).should("be.visible");
    });

    it("dashes a wage that was never set", () => {
      visitRoster([buildMember(MORRIS, "Morris Olsen", { roaster: [{}] })]);
      openMemberVia("View job details");
      cy.contains("Care Team --", { timeout: 10000 }).should("be.visible");
    });

    it("shows the start date", () => {
      cy.contains("Start Date:").should("be.visible");
      cy.contains("08/17/2026").should("be.visible");
    });

    it("offers an Edit", () => {
      sel.editButton().should("be.visible");
    });

    it("shows nothing editable until Edit is pressed", () => {
      sel.roleSelect().should("not.exist");
      sel.wageRate().should("not.exist");
      sel.save().should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Job Details — editing
  // ──────────────────────────────────────────────────────────────────────────

  describe("Job Details — editing", () => {
    beforeEach(() => {
      visitRoster();
      openMemberVia("View job details");
      cy.contains("Access, Roles & Wages", { timeout: 10000 }).should("be.visible");
      sel.editButton().click();
    });

    it("opens the four fields", () => {
      sel.roleSelect().should("exist");
      sel.startDate().should("exist");
      sel.wageFrequency().should("exist");
      sel.wageRate().should("exist");
    });

    it("locks the role", () => {
      sel.roleSelect().should("be.disabled");
    });

    it("leaves the start date editable", () => {
      sel.startDate().should("not.be.disabled");
    });

    it("leaves the wage frequency editable", () => {
      sel.wageFrequency().should("not.be.disabled");
    });

    it("leaves the wage rate editable", () => {
      sel.wageRate().should("not.be.disabled");
    });

    it("pre-fills the wage rate", () => {
      sel.wageRate().should("have.value", "10");
    });

    it("pre-fills the wage frequency", () => {
      sel.wageFrequency().should("have.value", "Hourly");
    });

    it("pre-fills the start date", () => {
      sel.startDate().should("have.value", "2026-08-17");
    });

    it("offers Hourly and Monthly and nothing else", () => {
      // FormSelectComponent prepends its own "Select" placeholder.
      sel.wageFrequency()
        .find("option")
        .then(($options) => {
          const labels = [...$options].map((o) => o.textContent);
          expect(labels).to.deep.eq(["Select", "Hourly", "Monthly"]);
        });
    });

    it("hides the Edit button while editing", () => {
      sel.editButton().should("not.exist");
    });

    it("offers Cancel and Save", () => {
      sel.cancel().should("be.visible");
      sel.save().should("be.visible");
    });

    it("returns to the read-only card on Cancel", () => {
      sel.cancel().click();
      sel.wageRate().should("not.exist");
      cy.contains("Role(s) & Wages(s):").should("be.visible");
    });

    it("sends nothing on Cancel", () => {
      cy.intercept("PUT", "**/v1/hcm/roaster").as("saveRoster");
      sel.wageRate().clear().type("15");
      sel.cancel().click();
      cy.assertNoRequest("@saveRoster");
    });

    it("sends nothing merely by opening the editor", () => {
      cy.intercept("PUT", "**/v1/hcm/roaster").as("saveRoster");
      cy.assertNoRequest("@saveRoster");
    });
  });

  describe("Job Details — saving", () => {
    beforeEach(() => {
      stubRosterSave();
      visitRoster();
      openMemberVia("View job details");
      cy.contains("Access, Roles & Wages", { timeout: 10000 }).should("be.visible");
      sel.editButton().click();
    });

    it("saves the wage rate to the roster", () => {
      sel.wageRate().clear().type("15");
      sel.save().click();
      cy.wait("@saveRoster").then(({ request }) => {
        expect(request.body.pay_rate).to.eq(15);
        expect(request.body.user_id).to.eq(MORRIS);
        expect(request.body.home_id).to.eq(TEST_HOME_ID);
      });
    });

    it("saves the wage frequency to the roster", () => {
      sel.wageFrequency().select("Monthly");
      sel.save().click();
      cy.wait("@saveRoster").then(({ request }) => {
        expect(request.body.pay_frequency).to.eq("Monthly");
      });
    });

    it("saves the start date to the user", () => {
      sel.startDate().clear().type("2026-08-10");
      sel.save().click();
      cy.wait("@saveUser").then(({ request }) => {
        expect(request.body.contractCompletedOn).to.eq("2026-08-10");
      });
    });

    it("sends both requests for one save", () => {
      sel.wageRate().clear().type("15");
      sel.save().click();
      cy.wait("@saveRoster");
      cy.wait("@saveUser");
    });

    it("authorises the roster update", () => {
      sel.wageRate().clear().type("15");
      sel.save().click();
      cy.wait("@saveRoster");
      cy.assertAuthorized("@saveRoster");
    });

    it("confirms the update", () => {
      sel.wageRate().clear().type("15");
      sel.save().click();
      cy.wait("@saveRoster");
      cy.assertPopover("Updated Successfully!");
    });

    it("closes the editor", () => {
      sel.wageRate().clear().type("15");
      sel.save().click();
      cy.wait("@saveRoster");
      sel.wageRate().should("not.exist");
    });

    it("reports a rejected update", () => {
      // One save fires two requests, each with its own popover, so a partial
      // failure races — which message wins depends on which reply lands last.
      // Fail both so the reported outcome is unambiguous.
      cy.intercept("PUT", "**/v1/hcm/roaster", { statusCode: 500, body: {} }).as(
        "saveRoster"
      );
      cy.intercept("PUT", "**/v1/user/*", { statusCode: 500, body: {} }).as(
        "saveUser"
      );
      sel.wageRate().clear().type("15");
      sel.save().click();
      cy.wait("@saveRoster");
      cy.assertPopover("Error in updating!");
    });
  });

  describe("Job Details — what it refuses", () => {
    beforeEach(() => {
      cy.intercept("PUT", "**/v1/hcm/roaster").as("saveRoster");
      cy.intercept("PUT", "**/v1/user/*").as("saveUser");
      visitRoster();
      openMemberVia("View job details");
      cy.contains("Access, Roles & Wages", { timeout: 10000 }).should("be.visible");
      sel.editButton().click();
    });

    it("refuses a wage rate of zero", () => {
      sel.wageRate().clear().type("0");
      sel.save().click();
      cy.contains("pay must be positive").should("be.visible");
      cy.assertNoRequest("@saveRoster");
    });

    it("refuses a negative wage rate", () => {
      sel.wageRate().clear().type("-5");
      sel.save().click();
      cy.assertNoRequest("@saveRoster");
    });

    it("refuses an empty wage rate", () => {
      sel.wageRate().clear();
      sel.save().click();
      cy.assertNoRequest("@saveRoster");
    });

    it("accepts a fractional wage rate", () => {
      stubRosterSave();
      sel.wageRate().clear().type("12.5");
      sel.save().click();
      cy.wait("@saveRoster").then(({ request }) => {
        expect(request.body.pay_rate).to.eq(12.5);
      });
    });

    it("[as-built] will not let the start date move forward", () => {
      // `max={defaultValues?.contractCompletedOn}` — the ceiling is the date
      // already stored, so a start date can be corrected earlier but never
      // later. Pinned as built.
      sel.startDate().should("have.attr", "max", "2026-08-17");
    });
  });

  describe("Job Details — a deleted member", () => {
    it("cannot be edited", () => {
      visitRoster([DELETED_MEMBER]);
      cy.contains("Gone Away").click();
      cy.contains("Access, Roles & Wages", { timeout: 10000 }).should("be.visible");
      // The class is on the Button element, not on a wrapping div.
      cy.contains("button", "Edit").should("have.class", "pointer-events-none");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Personal Information
  // ──────────────────────────────────────────────────────────────────────────

  describe("Personal Information", () => {
    beforeEach(() => {
      visitRoster();
      openMemberVia("View personal information");
      cy.contains("Contact Information", { timeout: 10000 }).should("be.visible");
    });

    it("heads the card", () => {
      cy.contains("Contact Information").should("be.visible");
    });

    it("labels all four fields", () => {
      ["Preferred name", "Personal email", "Mobile number", "Emergency contact"].forEach(
        (label) => cy.contains(label).should("be.visible")
      );
    });

    it("shows the stored values", () => {
      cy.contains("Morris Olsen").should("be.visible");
      cy.contains("morris@yopmail.com").should("be.visible");
      cy.contains("8585854545").should("be.visible");
    });

    it("dashes an emergency contact that was never recorded", () => {
      cy.contains("Emergency contact").parent().should("contain.text", "-");
    });

    it("shows a stored emergency contact", () => {
      visitRoster([
        buildMember(MORRIS, "Morris Olsen", {
          biography: {
            personalDetails: {
              emergencyContactName: "Ruth Olsen",
              emergencyContactNumber: "7065183473",
            },
          },
        }),
      ]);
      openMemberVia("View personal information");
      cy.contains("Ruth Olsen 7065183473", { timeout: 10000 }).should("be.visible");
    });

    it("offers an Edit", () => {
      sel.editButton().should("be.visible");
    });

    it("shows nothing editable until Edit is pressed", () => {
      sel.firstName().should("not.exist");
      sel.save().should("not.exist");
    });
  });

  describe("Personal Information — editing", () => {
    beforeEach(() => {
      visitRoster();
      openMemberVia("View personal information");
      cy.contains("Contact Information", { timeout: 10000 }).should("be.visible");
      sel.editButton().click();
    });

    it("opens every field", () => {
      sel.firstName().should("exist");
      sel.lastName().should("exist");
      sel.email().should("exist");
      sel.mobile().should("exist");
      sel.emergencyName().should("exist");
      sel.emergencyPhone().should("exist");
    });

    it("splits the name into two fields", () => {
      sel.firstName().should("have.value", "Morris");
      sel.lastName().should("have.value", "Olsen");
    });

    it("pre-fills the mobile", () => {
      sel.mobile().should("have.value", "8585854545");
    });

    it("locks an email that is already on file", () => {
      sel.email().should("have.attr", "readonly");
    });

    it("[as-built] lets a member with no email be given one", () => {
      // `readOnly` is conditional on there already being an email, so the lock
      // is really "an address cannot be CHANGED", not "cannot be set".
      visitRoster([buildMember(MORRIS, "Morris Olsen", { email: "" })]);
      openMemberVia("View personal information");
      sel.editButton().click();
      sel.email().should("not.have.attr", "readonly");
    });

    it("leaves the name editable", () => {
      sel.firstName().clear().type("Maurice");
      sel.firstName().should("have.value", "Maurice");
    });

    it("leaves the mobile editable", () => {
      sel.mobile().clear().type("9998887777");
      sel.mobile().should("have.value", "9998887777");
    });

    it("leaves the emergency contact editable", () => {
      sel.emergencyName().type("Ruth Olsen");
      sel.emergencyName().should("have.value", "Ruth Olsen");
    });

    it("returns to the read-only card on Cancel", () => {
      sel.cancel().click();
      sel.firstName().should("not.exist");
      cy.contains("Preferred name").should("be.visible");
    });

    it("[as-built] saves the changes when Cancel is pressed", () => {
      // `<Button name="Cancel" buttonClick={...} />` with no `type`, and
      // `Button` defaults to `type="submit"` — so Cancel runs its own handler
      // AND submits the form. Job Details gets this right with `type="button"`;
      // this card does not. The failing test for the intended behaviour is in
      // known-defects.cy.ts.
      cy.intercept("PUT", "**/v1/user/*", { statusCode: 200, body: {} }).as(
        "saveUser"
      );
      sel.mobile().clear().type("9998887777");
      sel.cancel().click();

      cy.wait("@saveUser").then(({ request }) => {
        expect(request.body.mobile).to.eq("9998887777");
      });
    });
  });

  describe("Personal Information — saving", () => {
    beforeEach(() => {
      cy.intercept("PUT", "**/v1/user/*", { statusCode: 200, body: {} }).as(
        "saveUser"
      );
      visitRoster();
      openMemberVia("View personal information");
      cy.contains("Contact Information", { timeout: 10000 }).should("be.visible");
      sel.editButton().click();
    });

    it("saves a changed mobile", () => {
      sel.mobile().clear().type("9998887777");
      sel.save().click();
      cy.wait("@saveUser").then(({ request }) => {
        expect(request.body.mobile).to.eq("9998887777");
      });
    });

    it("recomposes the full name from its parts", () => {
      sel.firstName().clear().type("Maurice");
      sel.save().click();
      cy.wait("@saveUser").then(({ request }) => {
        expect(request.body.firstName).to.eq("Maurice");
        expect(request.body.name).to.eq("Maurice Olsen");
      });
    });

    it("saves an emergency contact", () => {
      sel.emergencyName().type("Ruth Olsen");
      sel.emergencyPhone().type("7065183473");
      sel.save().click();
      cy.wait("@saveUser").then(({ request }) => {
        const details = request.body.biography.personalDetails;
        expect(details.emergencyContactName).to.eq("Ruth Olsen");
        expect(details.emergencyContactNumber).to.eq("7065183473");
      });
    });

    it("confirms the update", () => {
      sel.mobile().clear().type("9998887777");
      sel.save().click();
      cy.wait("@saveUser");
      cy.assertPopover("Updated Successfully!");
    });

    it("closes the editor", () => {
      sel.mobile().clear().type("9998887777");
      sel.save().click();
      cy.wait("@saveUser");
      sel.mobile().should("not.exist");
    });

    it("reports a rejected update", () => {
      cy.intercept("PUT", "**/v1/user/*", { statusCode: 500, body: {} }).as(
        "saveUser"
      );
      sel.mobile().clear().type("9998887777");
      sel.save().click();
      cy.wait("@saveUser");
      cy.assertPopover("Error in updating!");
    });

    it("refuses a mobile that is not ten digits", () => {
      cy.intercept("PUT", "**/v1/user/*").as("blocked");
      sel.mobile().clear().type("55512345");
      sel.save().click();
      cy.assertNoRequest("@blocked");
    });

    it("refuses a name with punctuation in it", () => {
      cy.intercept("PUT", "**/v1/user/*").as("blocked");
      sel.firstName().clear().type("O'Brien");
      sel.save().click();
      cy.assertNoRequest("@blocked");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Documents
  // ──────────────────────────────────────────────────────────────────────────

  describe("Documents", () => {
    beforeEach(() => {
      visitRoster();
      cy.contains("Morris Olsen").click();
      cy.contains("Access, Roles & Wages", { timeout: 10000 }).should("be.visible");
    });

    it("opens when the tab is clicked", () => {
      sel.tab("Documents").click();
      cy.contains("Access, Roles & Wages").should("not.exist");
      cy.contains("Contact Information").should("not.exist");
    });

    it("can be left again", () => {
      sel.tab("Documents").click();
      sel.tab("Job Details").click();
      cy.contains("Access, Roles & Wages").should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. Access
  // ──────────────────────────────────────────────────────────────────────────

  describe("Access", () => {
    it("refuses the roster to a role without HCM_TEAM_ROASTER", () => {
      visitRoster([MORRIS_MEMBER], { role: "Lead", expectRestricted: true });
      cy.assertRestricted();
    });

    it("refuses the roster when the home has no staff management module", () => {
      visitRoster([MORRIS_MEMBER], {
        home: buildHome({ authorizedModules: ["CRM", "CLINICAL"] }),
        expectRestricted: true,
      });
      cy.assertRestricted();
    });

    it("withholds the wage and the ⋮ menu from a view-only role", { tags: [Tags.HOMEADMIN] }, () => {
      // A HomeAdmin holds HCM_TEAM_ROASTER as VIEW, not EDIT, so
      // `filteredTabs` drops both columns.
      visitRoster([MORRIS_MEMBER], { role: "HomeAdmin" });
      cy.contains("Team Member").should("be.visible");
      cy.contains("Wage").should("not.exist");
      cy.contains("$10/hr").should("not.exist");
    });

    it("[as-built] still offers Add Team Member to a view-only role", { tags: [Tags.HOMEADMIN] }, () => {
      // The button is gated on `HCM_SCHEDULING` EDIT, not on the roster
      // permission — and a HomeAdmin holds it. So the same role that cannot
      // see the Wage column or open the ⋮ menu can still add a care lead from
      // this page. Pinned as built; `hcm-role-access.test.ts` states the
      // permission matrix behind it.
      //
      // Asserted on presence with a settle, not absence: this element renders
      // a beat after the heading, so a `not.exist` here passes before the page
      // has finished and proves nothing. That is how this test read as a pass
      // while asserting the opposite.
      visitRoster([MORRIS_MEMBER], { role: "HomeAdmin" });
      cy.contains("Morris Olsen").should("be.visible");
      sel.addTeamMember().should("be.visible");
    });

    it("withholds Job Details from a role that cannot see it", { tags: [Tags.HOMEADMIN] }, () => {
      // HomeAdmin has no HCM_TEAM_JOB_DETAILS, which is why its default tab is
      // Personal Information.
      visitRoster([MORRIS_MEMBER], { role: "HomeAdmin" });
      cy.contains("Morris Olsen").click();
      cy.contains("Contact Information", { timeout: 10000 }).should("be.visible");
      sel.tab("Job Details").should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 9. End-to-end journeys
  // ──────────────────────────────────────────────────────────────────────────

  describe("End-to-end journeys", () => {
    it("E2E — a missing wage is spotted on the roster and filled in", () => {
      stubRosterSave();
      visitRoster([buildMember(MORRIS, "Morris Olsen", { roaster: [] })]);

      cy.contains("Add Wage").click();
      cy.contains("Access, Roles & Wages", { timeout: 10000 }).should("be.visible");

      sel.editButton().click();
      sel.wageRate().clear().type("18");
      sel.wageFrequency().select("Hourly");
      sel.save().click();

      cy.wait("@saveRoster").then(({ request }) => {
        expect(request.body.pay_rate).to.eq(18);
        expect(request.body.pay_frequency).to.eq("Hourly");
      });
      cy.assertPopover("Updated Successfully!");
    });

    it("E2E — a member's mobile is corrected from the roster", () => {
      cy.intercept("PUT", "**/v1/user/*", { statusCode: 200, body: {} }).as(
        "saveUser"
      );
      visitRoster([buildMember(MORRIS, "Morris Olsen", { mobile: "" })]);

      cy.contains("Add Phone").click();
      cy.contains("Contact Information", { timeout: 10000 }).should("be.visible");

      sel.editButton().click();
      sel.mobile().clear().type("9998887777");
      sel.save().click();

      cy.wait("@saveUser").then(({ request }) => {
        expect(request.body.mobile).to.eq("9998887777");
      });
      cy.assertPopover("Updated Successfully!");
    });

    it("E2E — all three tabs are visited from the ⋮ menu", () => {
      visitRoster();

      openMemberVia("View personal information");
      cy.contains("Contact Information", { timeout: 10000 }).should("be.visible");

      sel.tab("Job Details").click();
      cy.contains("Access, Roles & Wages").should("be.visible");

      sel.tab("Documents").click();
      cy.contains("Access, Roles & Wages").should("not.exist");
    });
  });
});
