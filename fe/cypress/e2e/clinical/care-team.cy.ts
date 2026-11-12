/// <reference types="cypress" />

/**
 * Clinical — Care Team
 *
 *   pages/clinical/pcg/index.tsx                    the list
 *   components/pcg/pcg-home-page.tsx                its table
 *   components/pcg-action-cell.tsx                  the ⋮ menu
 *   pages/clinical/pcg/[pcgId].tsx                  a member's page
 *   components/pcg/pcg-tabs.tsx                     Documents / FaceSheet
 *   components/face-sheet/care-team-face-sheet.tsx  the FaceSheet itself
 *   commonComponents/inline-form-fields.tsx         UploadRow
 *
 * All as a PCHO. The Documents tab is out of scope by agreement; everything here
 * is the list, the ⋮ menu, and the FaceSheet.
 *
 * THE LIST
 *   Two queries — userType=PCG and userType=HomeAdmin — merged into one table.
 *   The header count is the ACTIVE members only, while the table shows actives
 *   first and soft-deleted members after them.
 *
 * THE ⋮ MENU
 *   Onboard, Initiate e-sign and Delete. "Move to Clinical" is gated on
 *   `data.role === "PCGLead"`, so a Care Team member (role `PCG`) never sees it.
 *   Onboard greys out once `lastLoginTimestamp` exists, and Delete is a SOFT
 *   delete — the record comes back flagged rather than disappearing, which is
 *   the same HIPAA-retention pattern as the seniors board.
 *
 * THE FACESHEET, AS BUILT
 *   Editable:  name, mobile, emergency contacts, compliance answers, documents.
 *   Read-only: role and email — both plain text with no input.
 *
 *   Worth stating plainly, because it is easy to assume otherwise: the NAME IS
 *   EDITABLE. It renders as an InlineInput like every other editable field, and
 *   `buildUpdatePayload` re-splits it into firstName/lastName on save. Role is
 *   the only identity field the FaceSheet holds read-only. The tests below pin
 *   that as built; nothing here asks for it to change.
 *
 * DOCUMENTS ARE STAGED, NOT UPLOADED
 *   Picking a file shows "Pending upload: <name>" and sends nothing. Removing a
 *   stored one shows "Will be removed (pending)" with an undo. Only Save commits
 *   — it presigns, PUTs to S3, then PUTs the user — and the Save bar exists only
 *   while the form is dirty.
 *
 * PRINT
 *   `printFaceSheetOnly` swaps document.body, calls window.print(), restores it
 *   and then calls window.location.reload(). `window.print` is stubbed and the
 *   assertion made immediately, before the reload lands.
 */

import { Tags } from "../../framework/utils/tags";
import { buildHome, TEST_HOME_ID } from "../../framework/module-commands";

const PCG_PATH = "/clinical/pcg";
const MORRIS = "pppppppp-0001-4ppp-8ppp-pppppppppppp";
const STUART = "pppppppp-0002-4ppp-8ppp-pppppppppppp";
const GONE = "pppppppp-0003-4ppp-8ppp-pppppppppppp";

const MORRIS_EMAIL = "morris@yopmail.com";

/** A care team member as GET /v1/users?userType=PCG returns them. */
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
  homeId: TEST_HOME_ID,
  createdAt: "2026-01-02T10:00:00.000Z",
  isDeleted: false,
  documents: [],
  ...overrides,
});

const MORRIS_ROW = buildMember(MORRIS, "Morris Olsen");
const STUART_ROW = buildMember(STUART, "Stuart Comic");
const DELETED_ROW = buildMember(GONE, "Gone Away", { isDeleted: true });
/** Already signed in, so Onboard is greyed out for them. */
const ONBOARDED_ROW = buildMember(MORRIS, "Morris Olsen", {
  lastLoginTimestamp: "2026-02-01T10:00:00.000Z",
});

/**
 * A member whose FaceSheet already carries answers and one stored document.
 * `facesheet.documents.backgroundCheck.fileUrl` is what makes
 * buildDraftFromPCGData mark that UploadRow "existing" rather than "Not on file".
 */
const buildFaceSheetMember = (facesheet: Record<string, any> = {}) =>
  buildMember(MORRIS, "Morris Olsen", {
    facesheet: {
      backgroundCheck: "Yes",
      tbTest: "No",
      documents: {
        backgroundCheck: {
          fileName: "bg.pdf",
          fileUrl: "https://bucket.s3.amazonaws.com/bg.pdf",
          status: "existing",
        },
      },
      ...facesheet,
    },
  });

// ── Selectors ────────────────────────────────────────────────────────────────

const sel = {
  row: (name: string) => cy.contains(name).closest('div[class*="border-b"]'),
  /** Menu entries are plain divs, so anchor on the exact label. */
  item: (label: string) => cy.contains("div", new RegExp(`^${label}$`)),
  confirm: () => cy.contains("button", "Confirm"),
  cancel: () => cy.contains("button", "Cancel"),
  tab: (label: string) => cy.contains("span", label),
  save: () => cy.contains("button", /^(Save|Saving\.\.\.)$/),
  print: () => cy.contains("button", "Print Face Sheet"),
  /**
   * The sticky Save bar. Asserted on presence, never visibility: it sits in a
   * `position: fixed` ancestor and is clipped whenever the page happens to be
   * scrolled, so `be.visible` passes or fails on scroll position alone.
   */
  saveBar: () => cy.contains("Unsaved changes"),

  /** Card is the only `rounded-2xl` block on the FaceSheet. */
  card: (title: string) =>
    cy.contains(title).closest('div[class*="rounded-2xl"]'),
  /** Row renders `<div>{label}</div>` beside `<div>{children}</div>`. */
  rowIn: (title: string, label: string) =>
    sel.card(title).contains("div", new RegExp(`^${label}$`)).parent(),
  answer: (label: string) =>
    sel.rowIn("Compliance Summary", label).find("select"),
  doc: (label: string) => sel.rowIn("Compliance Documents", label),
  docInput: (label: string) => sel.doc(label).find('input[type="file"]'),
  docRemove: (label: string) => sel.doc(label).find('button[title*="Remove"]'),
  docUndo: (label: string) => sel.doc(label).find('button[title="Undo remove"]'),
  docView: (label: string) =>
    sel.doc(label).find('button[title="View document"]'),

  /** The header card's name field; ContactBlock reuses the placeholder. */
  nameInput: () => cy.get('input[placeholder="Name"]').first(),
  mobileInput: () => cy.get('input[type="number"]').first(),
};

// ── Setup ────────────────────────────────────────────────────────────────────

/** The list issues two calls; only the PCG one carries the care team. */
const stubMembers = (members: any[]) =>
  cy
    .intercept("GET", "**/v1/users*", (req) => {
      const userType = req.query.userType as string | undefined;
      req.reply({
        statusCode: 200,
        body: { users: userType === "PCG" ? members : [] },
      });
    })
    .as("getMembers");

const stubMember = (member: Record<string, any>) =>
  cy
    .intercept("GET", "**/v1/user/*", { statusCode: 200, body: { user: member } })
    .as("getMember");

/** Neither S3 route exists against a stubbed API; both are staged-save hops. */
const stubS3 = () => {
  cy.intercept("POST", "/api/s3/presign-put", {
    statusCode: 200,
    body: { url: "https://bucket.s3.amazonaws.com/put?X-Amz-Signature=stub" },
  }).as("presignPut");
  cy.intercept("PUT", "https://bucket.s3.amazonaws.com/**", { statusCode: 200 });
  cy.intercept("POST", "/api/s3/delete-object", {
    statusCode: 200,
    body: { deleted: true },
  }).as("deleteObject");
};

const visitList = (
  members: any[] = [MORRIS_ROW, STUART_ROW],
  role: any = "PCHO"
) => {
  cy.clearAuthSession();
  cy.setAuthSession(role);
  cy.stubHome(buildHome());
  cy.intercept("GET", "**/v1/hcm/shifts*", { statusCode: 200, body: { shifts: [] } });
  stubMembers(members);
  stubMember(members[0] ?? MORRIS_ROW);
  cy.visit(PCG_PATH);
  cy.wait("@getMembers");
};

const visitFaceSheet = (
  member: Record<string, any> = buildFaceSheetMember(),
  role: any = "PCHO"
) => {
  cy.clearAuthSession();
  cy.setAuthSession(role);
  cy.stubHome(buildHome());
  cy.intercept("GET", "**/v1/hcm/shifts*", { statusCode: 200, body: { shifts: [] } });
  stubMembers([member]);
  stubMember(member);
  stubS3();
  cy.visit(`${PCG_PATH}/${member.userId}`);
  sel.tab("FaceSheet").click({ force: true });
  cy.contains("Contact Information", { timeout: 10000 }).should("be.visible");
};

/** A file UploadRow accepts: PDF, comfortably under the 2MB cap. */
const goodFile = {
  contents: Cypress.Buffer.from("%PDF-1.4 stub"),
  fileName: "cpr-card.pdf",
  mimeType: "application/pdf",
};

/** Bigger than the 2MB cap the UploadRow enforces before staging anything. */
const oversizedFile = {
  contents: Cypress.Buffer.alloc(3 * 1024 * 1024, "x"),
  fileName: "too-big.pdf",
  mimeType: "application/pdf",
};

/** An extension the allow-list rejects. */
const wrongTypeFile = {
  contents: Cypress.Buffer.from("MZ"),
  fileName: "installer.exe",
  mimeType: "application/x-msdownload",
};

describe("Clinical — Care Team", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. The list
  // ──────────────────────────────────────────────────────────────────────────

  describe("The list", () => {
    beforeEach(() => visitList());

    it("names the board", () => {
      cy.contains("Care Team").should("be.visible");
    });

    it("counts the members", () => {
      cy.contains("2 Team members").should("be.visible");
    });

    it("renders the column headers", () => {
      ["Name", "Email", "Phone"].forEach((header) =>
        cy.contains(header).should("exist")
      );
    });

    it("does not offer the CRM-only Contract Status column", () => {
      // `isCRM` is false off /crm, so the column is filtered out.
      cy.contains("Contract Status").should("not.exist");
    });

    it("lists every member", () => {
      cy.contains("Morris Olsen").should("be.visible");
      cy.contains("Stuart Comic").should("be.visible");
    });

    it("shows each member's email", () => {
      cy.contains(MORRIS_EMAIL).should("be.visible");
    });

    it("shows each member's phone", () => {
      cy.contains("8585854545").should("exist");
    });

    it("queries the care team scoped to the home", { tags: [Tags.PCG] }, () => {
      // The page issues two calls — PCG and HomeAdmin — so the alias holds both.
      cy.get("@getMembers.all").then((interceptions: any) => {
        const queries = interceptions.map(
          (i: any) => new URL(i.request.url).searchParams
        );
        const pcg = queries.find((q: URLSearchParams) => q.get("userType") === "PCG");
        expect(pcg, "a userType=PCG query was sent").to.exist;
        expect(pcg.get("homeId")).to.eq(TEST_HOME_ID);
      });
    });

    it("also queries the home admins that share the board", { tags: [Tags.HOMEADMIN] }, () => {
      cy.get("@getMembers.all").then((interceptions: any) => {
        const types = interceptions.map(
          (i: any) => new URL(i.request.url).searchParams.get("userType")
        );
        expect(types).to.include("HomeAdmin");
      });
    });

    it("sends the session token with the list query", () => {
      cy.assertAuthorized("@getMembers");
    });

    it("dashes a member with no phone", () => {
      visitList([buildMember(MORRIS, "Morris Olsen", { mobile: "" })]);
      sel.row("Morris Olsen").should("contain.text", "-");
    });

    it("dashes a member with no email", () => {
      visitList([buildMember(MORRIS, "Morris Olsen", { email: "" })]);
      sel.row("Morris Olsen").should("contain.text", "-");
    });

    it("says so when the home has no care team yet", () => {
      visitList([]);
      cy.contains("No Personal Care Givers added yet.").should("be.visible");
    });

    it("counts an empty care team as zero", () => {
      visitList([]);
      cy.contains("0 Team members").should("be.visible");
    });

    it("offers a ⋮ menu on every row", () => {
      cy.openRowMenu("Morris Olsen");
      sel.item("Delete").should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Access
  // ──────────────────────────────────────────────────────────────────────────

  describe("Access", () => {
    it("refuses the board to a role without CRM_PCG_HOME", () => {
      visitList([MORRIS_ROW], "Lead");
      cy.assertRestricted();
    });

    it("refuses the board when the home has no clinical module", () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome(buildHome({ authorizedModules: ["CRM"] }));
      stubMembers([MORRIS_ROW]);
      cy.visit(PCG_PATH);
      cy.assertRestricted();
    });

    it("refuses a member's page to a role without CLINICAL_PCG", () => {
      cy.clearAuthSession();
      cy.setAuthSession("Lead");
      cy.stubHome(buildHome());
      stubMember(MORRIS_ROW);
      cy.visit(`${PCG_PATH}/${MORRIS}`);
      cy.assertRestricted();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. The ⋮ menu
  // ──────────────────────────────────────────────────────────────────────────

  describe("The ⋮ menu", () => {
    it("offers Onboard, Initiate e-sign and Delete", () => {
      visitList();
      cy.openRowMenu("Morris Olsen");
      ["Onboard", "Initiate e-sign", "Delete"].forEach((label) =>
        sel.item(label).should("be.visible")
      );
    });

    it("does not offer Move to Clinical for a Care Team member", () => {
      // Gated on `role === "PCGLead"`; these rows are role PCG and are already
      // in clinical.
      visitList();
      cy.openRowMenu("Morris Olsen");
      sel.item("Move to Clinical").should("not.exist");
    });

    it("greys out Onboard for a member who has already signed in", () => {
      visitList([ONBOARDED_ROW]);
      cy.openRowMenu("Morris Olsen");
      sel.item("Onboard").should("have.class", "cursor-not-allowed");
    });

    it("keeps Onboard active for a member who has never signed in", () => {
      visitList();
      cy.openRowMenu("Morris Olsen");
      sel.item("Onboard").should("have.class", "cursor-pointer");
    });

    it("does not even confirm when a greyed-out Onboard is clicked", () => {
      visitList([ONBOARDED_ROW]);
      cy.openRowMenu("Morris Olsen");
      sel.item("Onboard").click();
      cy.contains("Are you sure you want to onboard").should("not.exist");
    });

    it("sends nothing when a greyed-out Onboard is clicked", () => {
      cy.intercept("POST", "**/signup").as("signup");
      visitList([ONBOARDED_ROW]);
      cy.openRowMenu("Morris Olsen");
      sel.item("Onboard").click();
      cy.assertNoRequest("@signup");
    });

    it("leaves a deleted member's actions inert", () => {
      // PCGHomePage passes `pointer-events-none` for a deleted row, so the ⋮
      // cannot be reached at all.
      visitList([MORRIS_ROW, DELETED_ROW]);
      sel.row("Gone Away")
        .find('div[class*="pointer-events-none"]')
        .should("exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Onboard
  // ──────────────────────────────────────────────────────────────────────────

  describe("Onboard", () => {
    const startOnboard = (members: any[] = [MORRIS_ROW]) => {
      visitList(members);
      cy.openRowMenu("Morris Olsen");
      sel.item("Onboard").click();
    };

    it("asks for confirmation first", () => {
      startOnboard();
      cy.contains("Are you sure you want to onboard this").should("be.visible");
    });

    it("titles the dialog for a Care Team member", () => {
      startOnboard();
      cy.contains("Onboard Care Team").should("be.visible");
    });

    it("warns that an email will be sent", () => {
      startOnboard();
      cy.contains("An email will be sent to the").should("be.visible");
    });

    it("sends nothing until confirmed", () => {
      cy.intercept("POST", "**/signup").as("signup");
      startOnboard();
      cy.assertNoRequest("@signup");
    });

    it("abandons the action on Cancel", () => {
      cy.intercept("POST", "**/signup").as("signup");
      startOnboard();
      sel.cancel().click();
      cy.assertNoRequest("@signup");
    });

    it("invites the member to register", { tags: [Tags.PCG] }, () => {
      cy.stubPost("/signup", "signup", 200, {});
      startOnboard();
      sel.confirm().click();

      cy.wait("@signup").then(({ request }) => {
        expect(request.body.email).to.eq(MORRIS_EMAIL);
        expect(request.body.role).to.eq("PCG");
      });
      cy.assertPopover("Email sent successfully.");
    });

    it("authorises the signup with the session token", () => {
      cy.stubPost("/signup", "signup", 200, {});
      startOnboard();
      sel.confirm().click();
      cy.wait("@signup");
      cy.assertAuthorized("@signup");
    });

    it("refuses a member with no email address", () => {
      cy.intercept("POST", "**/signup").as("signup");
      startOnboard([buildMember(MORRIS, "Morris Olsen", { email: "" })]);
      sel.confirm().click();

      cy.assertPopover("Registration unsuccessful. Email address is required.");
      cy.assertNoRequest("@signup");
    });

    it("reports a rejected signup", () => {
      cy.stubPost("/signup", "signup", 400, { error: "User already exists" });
      startOnboard();
      sel.confirm().click();

      cy.wait("@signup");
      cy.assertPopover("User already exists");
    });

    it("falls back to a generic message when the API gives no reason", () => {
      cy.stubPost("/signup", "signup", 500, {});
      startOnboard();
      sel.confirm().click();

      cy.wait("@signup");
      cy.assertPopover("Signup failed");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Initiate e-sign
  // ──────────────────────────────────────────────────────────────────────────

  describe("Initiate e-sign", () => {
    const startESign = (members: any[] = [MORRIS_ROW]) => {
      visitList(members);
      cy.openRowMenu("Morris Olsen");
      sel.item("Initiate e-sign").click();
    };

    it("asks for confirmation first", () => {
      startESign();
      cy.contains("Are you sure you want to initiate e-sign").should("be.visible");
    });

    it("sends nothing until confirmed", () => {
      cy.intercept("POST", "**/docusign**").as("esign");
      startESign();
      cy.assertNoRequest("@esign");
    });

    it("refuses a member with no email address", () => {
      cy.intercept("POST", "**/docusign**").as("esign");
      startESign([buildMember(MORRIS, "Morris Olsen", { email: "" })]);
      sel.confirm().click();

      cy.assertPopover("E-sign cannot be initiated without a recipient email.");
      cy.assertNoRequest("@esign");
    });

    it("refuses a contract that has already been signed", () => {
      cy.intercept("POST", "**/docusign**").as("esign");
      startESign([
        buildMember(MORRIS, "Morris Olsen", {
          docusignEnvelopeStatus: "completed",
        }),
      ]);
      sel.confirm().click();

      cy.assertPopover("This contract has already been signed.");
      cy.assertNoRequest("@esign");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Delete — a soft delete
  // ──────────────────────────────────────────────────────────────────────────

  describe("Delete", () => {
    const startDelete = (members: any[] = [MORRIS_ROW]) => {
      visitList(members);
      cy.openRowMenu("Morris Olsen");
      sel.item("Delete").click();
    };

    it("asks for confirmation first", () => {
      startDelete();
      cy.contains("delete this Care Team").should("be.visible");
    });

    it("titles the dialog for a Care Team member", () => {
      startDelete();
      cy.contains("Delete Care Team").should("be.visible");
    });

    it("sends nothing until confirmed", () => {
      cy.intercept("DELETE", "**/v1/user/**").as("deleteMember");
      startDelete();
      cy.assertNoRequest("@deleteMember");
    });

    it("abandons the delete on Cancel", () => {
      cy.intercept("DELETE", "**/v1/user/**").as("deleteMember");
      startDelete();
      sel.cancel().click();
      cy.assertNoRequest("@deleteMember");
    });

    it("deletes the member by id", () => {
      cy.stubDelete("/v1/user", "deleteMember", 200, {});
      startDelete();
      sel.confirm().click();

      cy.wait("@deleteMember").then(({ request }) => {
        expect(request.url).to.contain(MORRIS);
      });
      cy.assertPopover("deleted successfully!");
    });

    it("authorises the delete with the session token", () => {
      cy.stubDelete("/v1/user", "deleteMember", 200, {});
      startDelete();
      sel.confirm().click();
      cy.wait("@deleteMember");
      cy.assertAuthorized("@deleteMember");
    });

    it("reports a rejected delete", () => {
      cy.stubDelete("/v1/user", "deleteMember", 500, { error: "Delete failed" });
      startDelete();
      sel.confirm().click();

      cy.wait("@deleteMember");
      cy.assertPopover("Delete failed");
    });
  });

  describe("Soft delete — what a deleted member looks like", () => {
    beforeEach(() => visitList([MORRIS_ROW, DELETED_ROW]));

    it("keeps the deleted member on the board rather than removing them", () => {
      // HIPAA retention: the record is flagged, never dropped.
      cy.contains("Gone Away").should("be.visible");
    });

    it("greys the deleted member's row", () => {
      sel.row("Gone Away").should("have.class", "opacity-50");
    });

    it("leaves an active member's row untouched", () => {
      sel.row("Morris Olsen").should("not.have.class", "opacity-50");
    });

    it("drops the deleted member from the header count", () => {
      cy.contains("1 Team members").should("be.visible");
    });

    it("sorts the deleted member below the active ones", () => {
      // The page rebuilds the list as [...active, ...deleted] whatever order
      // the API returned — here the deleted one comes back first.
      //
      // Read every row in ONE pass inside `should` rather than looking the two
      // rows up in nested `then`s: a re-render between the two queries detaches
      // the first and hands back a zeroed rect. `should` re-runs the callback.
      visitList([DELETED_ROW, MORRIS_ROW]);

      cy.get('div[class*="border-b"]').should(($rows) => {
        const text = [...$rows].map((row) => row.textContent || "");
        const active = text.findIndex((t) => t.includes("Morris Olsen"));
        const deleted = text.findIndex((t) => t.includes("Gone Away"));

        expect(active, "the active member's row is rendered").to.be.greaterThan(-1);
        expect(deleted, "the deleted member sits below the active one").to.be.greaterThan(
          active
        );
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Opening a member
  // ──────────────────────────────────────────────────────────────────────────

  describe("Opening a member", () => {
    it("navigates to the member's own page", () => {
      visitList();
      cy.contains("Morris Olsen").click();
      cy.location("pathname", { timeout: 10000 }).should(
        "eq",
        `${PCG_PATH}/${MORRIS}`
      );
    });

    it("offers the Documents and FaceSheet tabs", () => {
      visitFaceSheet();
      sel.tab("Documents").should("exist");
      sel.tab("FaceSheet").should("exist");
    });

    it("fetches the member by id", () => {
      visitFaceSheet();
      cy.get("@getMember").then((interception: any) => {
        expect(interception.request.url).to.contain(MORRIS);
      });
    });

    it("says so while the FaceSheet is still loading", () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome(buildHome());
      stubMembers([MORRIS_ROW]);
      cy.intercept("GET", "**/v1/user/*", (req) =>
        req.reply({ statusCode: 200, body: { user: MORRIS_ROW }, delay: 1500 })
      );
      cy.visit(`${PCG_PATH}/${MORRIS}`);
      sel.tab("FaceSheet").click({ force: true });
      cy.contains("Loading FaceSheet...").should("be.visible");
    });

    it("says so when the FaceSheet cannot be loaded", () => {
      // react-query retries three times before the error state settles.
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome(buildHome());
      stubMembers([MORRIS_ROW]);
      cy.intercept("GET", "**/v1/user/*", {
        statusCode: 500,
        body: { error: "boom" },
      }).as("getMember");
      cy.visit(`${PCG_PATH}/${MORRIS}`);
      sel.tab("FaceSheet").click({ force: true });
      cy.contains("Unable to load FaceSheet details.", { timeout: 30000 }).should(
        "be.visible"
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. The FaceSheet — what it shows
  // ──────────────────────────────────────────────────────────────────────────

  describe("FaceSheet contents", () => {
    beforeEach(() => visitFaceSheet());

    it("shows the member's name", () => {
      sel.nameInput().should("have.value", "Morris Olsen");
    });

    it("title-cases a shouted name", () => {
      visitFaceSheet(buildMember(MORRIS, "MORRIS OLSEN", { facesheet: {} }));
      sel.nameInput().should("have.value", "Morris Olsen");
    });

    it("shows the member's role", () => {
      cy.contains("div", /^PCG$/).should("be.visible");
    });

    it("shows the member's email", () => {
      sel.card("Contact Information").should("contain.text", MORRIS_EMAIL);
    });

    it("shows the member's mobile", () => {
      sel.mobileInput().should("have.value", "8585854545");
    });

    it("shows the emergency contacts section", () => {
      cy.contains("Emergency contacts").should("be.visible");
      cy.contains("Primary").should("be.visible");
    });

    it("pre-fills a stored emergency contact", () => {
      visitFaceSheet(
        buildFaceSheetMember({
          emergencyContactName: "Ruth Olsen",
          emergencyContactRelationship: "Sister",
          emergencyContactPhone: "7065183473",
        })
      );
      cy.get('input[placeholder="Relationship"]').should("have.value", "Sister");
      cy.get('input[type="tel"]').should("have.value", "7065183473");
    });

    it("shows the compliance summary", () => {
      cy.contains("Compliance Summary").should("be.visible");
    });

    it("shows the compliance documents", () => {
      cy.contains("Compliance Documents").should("be.visible");
    });

    it("lists all four compliance documents", () => {
      ["Background Check", "TB Test Results", "Driving License", "CPR Certificates"].forEach(
        (label) => sel.doc(label).should("exist")
      );
    });

    it("offers the print action", () => {
      sel.print().should("be.visible");
    });

    it("hides the Save bar until something changes", () => {
      sel.saveBar().should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 9. What can and cannot be edited
  // ──────────────────────────────────────────────────────────────────────────

  describe("Editability", () => {
    beforeEach(() => visitFaceSheet());

    it("lets a PCHO edit the mobile number", () => {
      sel.mobileInput().clear().type("9998887777");
      sel.mobileInput().should("have.value", "9998887777");
    });

    it("lets a PCHO edit the emergency contact", () => {
      cy.get('input[placeholder="Relationship"]').type("Sister");
      cy.get('input[placeholder="Relationship"]').should("have.value", "Sister");
    });

    it("leaves the email as text with no input", () => {
      cy.get("input").each(($input) =>
        expect($input.val(), "no input holds the email").not.to.eq(MORRIS_EMAIL)
      );
    });

    it("leaves the role as text with no input", { tags: [Tags.PCG] }, () => {
      cy.get("input").each(($input) =>
        expect($input.val(), "no input holds the role").not.to.eq("PCG")
      );
    });

    it("[as-built] lets the name be edited", () => {
      // The name renders as an InlineInput like any other editable field, so it
      // CAN be changed from the FaceSheet. Role is the only identity field held
      // read-only here. Pinned as built.
      sel.nameInput().clear().type("Maurice");
      sel.nameInput().should("have.value", "Maurice");
      sel.saveBar().should("exist");
    });

    it("[as-built] the name field cannot be given a space", () => {
      // The input's value is piped through toTitleCase() on EVERY render, and
      // toTitleCase trims and collapses whitespace. So the trailing space is
      // erased the instant it is typed, and the next character lands against
      // the previous word — "Morris Olsen" arrives as "Morrisolsen" (the same
      // pass also lower-cases everything after the first letter).
      //
      // The practical consequence: an edited name can only ever be one word, so
      // splitName() cannot recover a surname from it. Pinned as built; the
      // failing test for the intended behaviour is in known-defects.cy.ts.
      sel.nameInput().clear().type("Morris Olsen");
      sel.nameInput().should("have.value", "Morrisolsen");
    });

    it("[as-built] an edited name reaches the API collapsed to one word", () => {
      cy.stubPut("/v1/user", "saveFaceSheet", 200, {});
      sel.nameInput().clear().type("Maurice");
      sel.save().click();

      cy.wait("@saveFaceSheet").then(({ request }) => {
        expect(request.body.name).to.eq("Maurice");
        expect(request.body.firstName).to.eq("Maurice");
      });
    });

    it("raises the Save bar once a field is touched", () => {
      sel.mobileInput().clear().type("9998887777");
      sel.saveBar().should("exist");
    });

    it("drops the Save bar when a field is changed back", () => {
      sel.mobileInput().clear().type("9998887777");
      sel.saveBar().should("exist");
      sel.mobileInput().clear().type("8585854545");
      sel.saveBar().should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 10. Compliance summary answers
  // ──────────────────────────────────────────────────────────────────────────

  describe("Compliance summary answers", () => {
    beforeEach(() => visitFaceSheet());

    it("offers exactly Yes, No and Not on file for the background check", () => {
      sel
        .answer("Background Check")
        .find("option")
        .then(($options) => {
          const labels = [...$options].map((o) => o.textContent);
          expect(labels).to.deep.eq(["Yes", "No", "Not on file"]);
        });
    });

    it("offers the same three answers for the TB test", () => {
      sel
        .answer("TB Test")
        .find("option")
        .then(($options) => {
          const labels = [...$options].map((o) => o.textContent);
          expect(labels).to.deep.eq(["Yes", "No", "Not on file"]);
        });
    });

    it("pre-selects the stored background check answer", () => {
      sel.answer("Background Check").should("have.value", "Yes");
    });

    it("pre-selects the stored TB test answer", () => {
      sel.answer("TB Test").should("have.value", "No");
    });

    it("defaults to Not on file when nothing is stored", () => {
      visitFaceSheet(buildMember(MORRIS, "Morris Olsen", { facesheet: {} }));
      sel.answer("Background Check").should("have.value", "Not on file");
      sel.answer("TB Test").should("have.value", "Not on file");
    });

    it("lets the background check answer be changed", () => {
      sel.answer("Background Check").select("No");
      sel.answer("Background Check").should("have.value", "No");
      sel.saveBar().should("exist");
    });

    it("sends nothing until Save is pressed", () => {
      cy.intercept("PUT", "**/v1/user/**").as("saveFaceSheet");
      sel.answer("Background Check").select("No");
      cy.assertNoRequest("@saveFaceSheet");
    });

    it("saves the changed background check answer", () => {
      cy.stubPut("/v1/user", "saveFaceSheet", 200, {});
      sel.answer("Background Check").select("No");
      sel.save().click();

      cy.wait("@saveFaceSheet").then(({ request }) => {
        expect(request.body.facesheet.backgroundCheck).to.eq("No");
      });
      cy.assertPopover("FaceSheet updated successfully");
    });

    it("saves the changed TB test answer", () => {
      cy.stubPut("/v1/user", "saveFaceSheet", 200, {});
      sel.answer("TB Test").select("Yes");
      sel.save().click();

      cy.wait("@saveFaceSheet").then(({ request }) => {
        expect(request.body.facesheet.tbTest).to.eq("Yes");
      });
    });

    it("PUTs to the member's own record", () => {
      cy.stubPut("/v1/user", "saveFaceSheet", 200, {});
      sel.answer("TB Test").select("Yes");
      sel.save().click();

      cy.wait("@saveFaceSheet").then(({ request }) => {
        expect(request.url).to.contain(MORRIS);
      });
    });

    it("clears the Save bar once the saved record comes back", () => {
      cy.stubPut("/v1/user", "saveFaceSheet", 200, {});
      sel.answer("TB Test").select("Yes");

      // The save invalidates the user query. React Query only hands the form a
      // NEW object when the refetched record actually differs, so the refetch
      // is stubbed with the saved answer — which is what a real API returns.
      stubMember(buildFaceSheetMember({ tbTest: "Yes" }));
      sel.save().click();

      cy.wait("@saveFaceSheet");
      sel.saveBar().should("not.exist");
    });

    it("[as-built] leaves the Save bar up when the refetch echoes the old record", () => {
      // `markCurrentAsClean()` moves a ref, but `isDirty` is
      // `useMemo(..., [values])` — it does not watch that ref, so marking the
      // form clean cannot re-render the bar away. The bar only disappears when
      // the refetch brings back a genuinely different record and resetForm
      // replaces `values`. Stub the refetch with the unchanged record and the
      // bar survives a successful save.
      //
      // Pinned as built; the failing test for the intended behaviour is in
      // known-defects.cy.ts.
      cy.stubPut("/v1/user", "saveFaceSheet", 200, {});
      sel.answer("TB Test").select("Yes");
      sel.save().click();

      cy.wait("@saveFaceSheet");
      cy.assertPopover("FaceSheet updated successfully");
      cy.dismissPopover();
      sel.saveBar().should("exist");
    });

    it("reports a rejected save", () => {
      cy.intercept("PUT", "**/v1/user/**", { statusCode: 500, body: {} }).as(
        "saveFaceSheet"
      );
      sel.answer("Background Check").select("No");
      sel.save().click();

      cy.wait("@saveFaceSheet");
      cy.assertPopover("Error in updating user details");
    });

    it("keeps the unsaved changes on screen after a failed save", () => {
      cy.intercept("PUT", "**/v1/user/**", { statusCode: 500, body: {} }).as(
        "saveFaceSheet"
      );
      sel.answer("Background Check").select("No");
      sel.save().click();
      cy.wait("@saveFaceSheet");

      cy.dismissPopover();
      sel.saveBar().should("exist");
      sel.answer("Background Check").should("have.value", "No");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 11. Compliance documents
  // ──────────────────────────────────────────────────────────────────────────

  describe("Compliance documents", () => {
    beforeEach(() => visitFaceSheet());

    it("says Not on file for a document that was never uploaded", () => {
      sel.doc("CPR Certificates").should("contain.text", "Not on file");
    });

    it("offers no view control for a document that was never uploaded", () => {
      sel
        .doc("CPR Certificates")
        .find('button[title="View document"]')
        .should("not.exist");
    });

    it("offers no remove control for a document that was never uploaded", () => {
      sel
        .doc("CPR Certificates")
        .find('button[title*="Remove"]')
        .should("not.exist");
    });

    it("offers an upload control for every document", () => {
      ["Background Check", "TB Test Results", "Driving License", "CPR Certificates"].forEach(
        (label) => sel.docInput(label).should("exist")
      );
    });

    it("offers view and remove for a stored document", () => {
      sel.docView("Background Check").should("exist");
      sel.docRemove("Background Check").should("exist");
    });

    it("keeps the upload control available after a document exists", () => {
      // Upload stays so a stored document can be replaced.
      sel.docInput("Background Check").should("exist");
    });

    it("opens a stored document through a presigned URL", () => {
      cy.stubPresign();
      cy.window().then((win) => cy.stub(win, "open").as("open"));
      sel.docView("Background Check").click();

      cy.wait("@presign");
      cy.get("@open").should("have.been.called");
    });

    it("reports a presign failure rather than opening a blank tab", () => {
      cy.intercept("POST", "/api/s3/presign-get", { statusCode: 500, body: {} });
      cy.intercept("GET", "**/v1/s3-pre-signed-url*", { statusCode: 500, body: {} });
      sel.docView("Background Check").click();
      cy.assertPopover("Unable to load File. Please try again.");
    });

    it("stages a picked file rather than uploading it", () => {
      cy.intercept("PUT", "**/v1/user/**").as("saveFaceSheet");
      sel.docInput("CPR Certificates").selectFile(goodFile, { force: true });

      sel
        .doc("CPR Certificates")
        .should("contain.text", "Pending upload: cpr-card.pdf");
      cy.assertNoRequest("@saveFaceSheet");
    });

    it("does not presign until Save is pressed", () => {
      sel.docInput("CPR Certificates").selectFile(goodFile, { force: true });
      cy.assertNoRequest("@presignPut");
    });

    it("raises the Save bar once a file is staged", () => {
      sel.docInput("CPR Certificates").selectFile(goodFile, { force: true });
      sel.saveBar().should("exist");
    });

    it("lets a staged file be dropped before saving", () => {
      sel.docInput("CPR Certificates").selectFile(goodFile, { force: true });
      sel.docRemove("CPR Certificates").click();
      sel.doc("CPR Certificates").should("contain.text", "Not on file");
    });

    it("uploads the staged file on Save", () => {
      cy.stubPut("/v1/user", "saveFaceSheet", 200, {});
      sel.docInput("CPR Certificates").selectFile(goodFile, { force: true });
      sel.save().click();

      cy.wait("@presignPut");
      cy.wait("@saveFaceSheet");
      cy.assertPopover("FaceSheet updated successfully");
    });

    it("presigns against the file's own content type", () => {
      cy.stubPut("/v1/user", "saveFaceSheet", 200, {});
      sel.docInput("CPR Certificates").selectFile(goodFile, { force: true });
      sel.save().click();

      cy.wait("@presignPut").then(({ request }) => {
        expect(request.body.contentType).to.eq("application/pdf");
      });
    });

    it("marks a stored document for removal rather than deleting it", () => {
      cy.intercept("PUT", "**/v1/user/**").as("saveFaceSheet");
      sel.docRemove("Background Check").click();

      sel
        .doc("Background Check")
        .should("contain.text", "Will be removed (pending)");
      cy.assertNoRequest("@saveFaceSheet");
      cy.assertNoRequest("@deleteObject");
    });

    it("hides the view control while a document is marked for removal", () => {
      sel.docRemove("Background Check").click();
      sel
        .doc("Background Check")
        .find('button[title="View document"]')
        .should("not.exist");
    });

    it("offers an undo for a document marked for removal", () => {
      sel.docRemove("Background Check").click();
      sel.docUndo("Background Check").should("exist");
    });

    it("restores a document when the removal is undone", () => {
      sel.docRemove("Background Check").click();
      sel.docUndo("Background Check").click();
      sel.doc("Background Check").should("not.contain.text", "Will be removed");
      sel.docView("Background Check").should("exist");
    });

    it("deletes from S3 only once the removal is saved", () => {
      cy.stubPut("/v1/user", "saveFaceSheet", 200, {});
      sel.docRemove("Background Check").click();
      sel.save().click();

      cy.wait("@deleteObject");
      cy.wait("@saveFaceSheet");
      cy.assertPopover("FaceSheet updated successfully");
    });

    it("refuses a file over two megabytes", () => {
      sel.docInput("CPR Certificates").selectFile(oversizedFile, { force: true });
      cy.assertPopover("File size must be less than 2MB");
    });

    it("names the offending size in the too-large message", () => {
      sel.docInput("CPR Certificates").selectFile(oversizedFile, { force: true });
      cy.assertPopover("Selected file is 3.00MB.");
    });

    it("does not stage a file it refused for size", () => {
      sel.docInput("CPR Certificates").selectFile(oversizedFile, { force: true });
      cy.dismissPopover();
      sel.doc("CPR Certificates").should("contain.text", "Not on file");
      sel.saveBar().should("not.exist");
    });

    it("refuses a file type it does not accept", () => {
      sel.docInput("CPR Certificates").selectFile(wrongTypeFile, { force: true });
      cy.assertPopover("Invalid file type");
    });

    it("does not stage a file it refused for type", () => {
      sel.docInput("CPR Certificates").selectFile(wrongTypeFile, { force: true });
      cy.dismissPopover();
      sel.doc("CPR Certificates").should("contain.text", "Not on file");
    });

    it("accepts an image", () => {
      sel.docInput("CPR Certificates").selectFile(
        {
          contents: Cypress.Buffer.from("\x89PNG"),
          fileName: "cert.png",
          mimeType: "image/png",
        },
        { force: true }
      );
      sel.doc("CPR Certificates").should("contain.text", "Pending upload: cert.png");
    });

    it("accepts a Word document", () => {
      sel.docInput("Driving License").selectFile(
        {
          contents: Cypress.Buffer.from("PK"),
          fileName: "licence.docx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
        { force: true }
      );
      sel
        .doc("Driving License")
        .should("contain.text", "Pending upload: licence.docx");
    });

    it("stages each document independently", () => {
      sel.docInput("Driving License").selectFile(goodFile, { force: true });
      sel.doc("Driving License").should("contain.text", "Pending upload");
      sel.doc("CPR Certificates").should("contain.text", "Not on file");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 12. Print Face Sheet
  // ──────────────────────────────────────────────────────────────────────────

  describe("Print Face Sheet", () => {
    it("offers the print action to a PCHO", () => {
      visitFaceSheet();
      sel.print().should("be.visible");
    });

    it("asks the browser to print", () => {
      visitFaceSheet();
      // printFaceSheetOnly() swaps document.body and then reloads the page, so
      // print is stubbed and asserted before the reload lands.
      cy.window().then((win) => cy.stub(win, "print").as("print"));
      sel.print().click();
      cy.get("@print").should("have.been.calledOnce");
    });

    it("sends nothing to the API when printing", () => {
      visitFaceSheet();
      cy.intercept("PUT", "**/v1/user/**").as("saveFaceSheet");
      cy.window().then((win) => cy.stub(win, "print").as("print"));
      sel.print().click();
      cy.assertNoRequest("@saveFaceSheet");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 13. End-to-end journeys
  // ──────────────────────────────────────────────────────────────────────────

  describe("End-to-end journeys", () => {
    it("E2E — an answer, a contact and a document are changed and saved together", () => {
      cy.stubPut("/v1/user", "saveFaceSheet", 200, {});
      visitFaceSheet();

      sel.answer("TB Test").select("Yes");
      cy.get('input[placeholder="Relationship"]').type("Sister");
      sel.docInput("TB Test Results").selectFile(goodFile, { force: true });
      sel.saveBar().should("exist");

      // The refetch has to bring back a different record for the form to reset
      // — see "[as-built] leaves the Save bar up when the refetch echoes the
      // old record" for why.
      stubMember(
        buildFaceSheetMember({
          tbTest: "Yes",
          emergencyContactRelationship: "Sister",
        })
      );
      sel.save().click();
      cy.wait("@presignPut");
      cy.wait("@saveFaceSheet").then(({ request }) => {
        expect(request.body.facesheet.tbTest).to.eq("Yes");
        expect(request.body.facesheet.emergencyContactRelationship).to.eq("Sister");
      });
      cy.assertPopover("FaceSheet updated successfully");
      cy.dismissPopover();
      sel.saveBar().should("not.exist");
    });

    it("E2E — the list, a member's FaceSheet, and back", () => {
      visitList();
      stubS3();
      cy.contains("Morris Olsen").click();

      sel.tab("FaceSheet").click({ force: true });
      cy.contains("Contact Information", { timeout: 10000 }).should("be.visible");

      cy.go("back");
      cy.contains("Care Team", { timeout: 10000 }).should("be.visible");
      cy.contains("Stuart Comic").should("be.visible");
    });

    it("E2E — a member is deleted and returns as an inactive row", () => {
      cy.stubDelete("/v1/user", "deleteMember", 200, {});
      visitList([MORRIS_ROW, STUART_ROW]);
      cy.contains("2 Team members").should("be.visible");

      cy.openRowMenu("Morris Olsen");
      sel.item("Delete").click();

      // The API soft-deletes, so the refetch returns the same member flagged.
      stubMembers([
        buildMember(MORRIS, "Morris Olsen", { isDeleted: true }),
        STUART_ROW,
      ]);
      sel.confirm().click();

      cy.wait("@deleteMember");
      cy.assertPopover("deleted successfully!");
      cy.dismissPopover();

      cy.contains("1 Team members", { timeout: 10000 }).should("be.visible");
      cy.contains("Morris Olsen").should("be.visible");
      sel.row("Morris Olsen").should("have.class", "opacity-50");
    });
  });
});
