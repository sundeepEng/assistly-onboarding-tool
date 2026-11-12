/// <reference types="cypress" />

/**
 * Clinical — the senior carousel
 *
 *   components/clinical/clinicalTabs/profile-carousel.tsx
 *
 * The row of faces above the tabs on /clinical/{seniorId}. It lists every
 * senior on the same query the board uses (`userType=Senior`,
 * `milestone=contract`), dims all but the one being viewed, and switching to
 * another senior routes to their page AND resets the tab strip to the first tab.
 *
 * Two gates decide whether it renders at all:
 *   CLINICAL_CAROUSEL   PCHO, HomeAdmin and PCG hold it; a Nurse does not.
 *   isInhomeCarePCGUser an In-Home-Care caregiver never sees it, because their
 *                       round is defined by today's shifts rather than the home.
 *
 * The active senior is derived from the URL's last segment, not from React
 * state, so a direct visit to a senior's page highlights the right face.
 */

import { Tags } from "../../framework/utils/tags";
import { buildHome, TEST_HOME_ID } from "../../framework/module-commands";

const ARTHUR = "cccccccc-0001-4ccc-8ccc-cccccccccccc";
const MARY = "cccccccc-0002-4ccc-8ccc-cccccccccccc";
const IVAN = "cccccccc-0003-4ccc-8ccc-cccccccccccc";

const buildSenior = (userId: string, name: string, overrides: Record<string, any> = {}) => ({
  userId,
  name,
  role: "Senior",
  home: "Comfort Cove",
  homeId: TEST_HOME_ID,
  milestone: ["initial contact", "tour", "onboarding", "contract"],
  createdAt: "2026-01-02T10:00:00.000Z",
  isDeleted: false,
  documents: [],
  clinical: { roomNumber: 12, status: "In Home", medication: [] },
  ...overrides,
});

const SENIORS = [
  buildSenior(ARTHUR, "Arthur Bean"),
  buildSenior(MARY, "Mary Shaw"),
  buildSenior(IVAN, "Ivan Petrov"),
];

const sel = {
  /** Each face is a 138px circle; the name sits under it. */
  faces: () => cy.get('div[class*="w-[138px]"]'),
  face: (name: string) => cy.contains("p", name).parent(),
  leftArrow: () => cy.get("button.bg-transparent").first(),
  arrows: () => cy.get("button.bg-transparent"),
};

const visitSenior = (
  seniorId: string,
  opts: { role?: any; users?: any[]; home?: ReturnType<typeof buildHome> } = {}
) => {
  const users = opts.users ?? SENIORS;
  cy.clearAuthSession();
  cy.setAuthSession(opts.role ?? "PCHO");
  cy.stubHome(opts.home ?? buildHome());
  cy.intercept("GET", "**/v1/hcm/shifts*", { statusCode: 200, body: { shifts: [] } }).as(
    "getShifts"
  );
  cy.intercept("GET", "**/v1/users*", { statusCode: 200, body: { users } }).as("getUsers");
  cy.intercept("GET", "**/v1/user/*", (req) => {
    const id = req.url.split("?")[0].split("/").pop();
    req.reply({
      statusCode: 200,
      body: { user: users.find((u: any) => u.userId === id) ?? users[0] },
    });
  }).as("getUser");
  cy.visit(`/clinical/${seniorId}`);
  cy.contains("Medication", { timeout: 10000 }).should("be.visible");
};

describe("Clinical — senior carousel", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. What it lists
  // ──────────────────────────────────────────────────────────────────────────

  describe("Contents", () => {
    beforeEach(() => visitSenior(ARTHUR));

    it("shows a face for every senior in the home", () => {
      sel.faces().should("have.length", 3);
    });

    it("names each senior", () => {
      ["Arthur Bean", "Mary Shaw", "Ivan Petrov"].forEach((name) =>
        cy.contains("p", name).should("be.visible")
      );
    });

    it("falls back to initials when a senior has no photo", () => {
      cy.contains("div", /^AB$/).should("exist");
    });

    it("uses the photo when a senior has one", () => {
      visitSenior(ARTHUR, {
        users: [
          buildSenior(ARTHUR, "Arthur Bean", {
            profileImageUrl: "https://bucket.s3.amazonaws.com/arthur.jpg",
          }),
        ],
      });
      cy.get('img[alt="Arthur Bean"]').should("exist");
    });

    it("renders nothing but the strip when the home has one senior", () => {
      visitSenior(ARTHUR, { users: [SENIORS[0]] });
      sel.faces().should("have.length", 1);
    });

    it("survives a home with no seniors on the query", () => {
      visitSenior(ARTHUR, { users: [] });
      sel.faces().should("not.exist");
      cy.contains("Medication").should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Which face is active
  // ──────────────────────────────────────────────────────────────────────────

  describe("The active senior", () => {
    it("highlights the senior whose page is open", () => {
      visitSenior(ARTHUR);
      cy.contains("p", "Arthur Bean").should("have.class", "text-black");
    });

    it("dims the others", () => {
      visitSenior(ARTHUR);
      cy.contains("p", "Mary Shaw").should("have.class", "text-gray-500");
      cy.contains("p", "Ivan Petrov").should("have.class", "text-gray-500");
    });

    it("fades the others' portraits too", () => {
      visitSenior(ARTHUR);
      sel.face("Mary Shaw").should("have.class", "opacity-40");
    });

    it("does not fade the active senior's portrait", () => {
      visitSenior(ARTHUR);
      sel.face("Arthur Bean").should("not.have.class", "opacity-40");
    });

    it("reads the active senior from the URL, not from a click", () => {
      // A direct visit to Mary's page highlights Mary — the component derives
      // the active id from the last path segment.
      visitSenior(MARY);
      cy.contains("p", "Mary Shaw").should("have.class", "text-black");
      cy.contains("p", "Arthur Bean").should("have.class", "text-gray-500");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Switching senior
  // ──────────────────────────────────────────────────────────────────────────

  describe("Switching senior", () => {
    beforeEach(() => visitSenior(ARTHUR));

    it("routes to the senior that was clicked", () => {
      sel.face("Mary Shaw").click();
      cy.location("pathname", { timeout: 10000 }).should("eq", `/clinical/${MARY}`);
    });

    it("moves the highlight to the new senior", () => {
      sel.face("Mary Shaw").click();
      cy.contains("p", "Mary Shaw", { timeout: 10000 }).should("have.class", "text-black");
    });

    it("dims the senior that was left behind", () => {
      sel.face("Mary Shaw").click();
      cy.contains("p", "Arthur Bean", { timeout: 10000 }).should(
        "have.class",
        "text-gray-500"
      );
    });

    it("resets the tab strip to the first tab", () => {
      // handleProfileClick calls setActiveTab() before routing, so a carer who
      // was on Care Plan for one senior lands on Medication for the next.
      cy.contains("span", "Care Plan").click();
      cy.contains("button", "Add Medication").should("not.exist");

      sel.face("Mary Shaw").click();
      cy.contains("button", "Add Medication", { timeout: 10000 }).should("be.visible");
    });

    it("keeps the carousel on screen after switching", () => {
      sel.face("Mary Shaw").click();
      cy.contains("p", "Ivan Petrov", { timeout: 10000 }).should("be.visible");
    });

    it("does nothing new when the active senior is clicked", () => {
      sel.face("Arthur Bean").click();
      cy.location("pathname").should("eq", `/clinical/${ARTHUR}`);
      cy.contains("p", "Arthur Bean").should("have.class", "text-black");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Scroll arrows
  // ──────────────────────────────────────────────────────────────────────────

  describe("Scroll arrows", () => {
    it("offers no left arrow before the strip has been scrolled", () => {
      // canScrollLeft starts false — scrollLeft is 0 on first paint.
      visitSenior(ARTHUR);
      sel.arrows().should("have.length.at.most", 1);
    });

    it("offers no arrows at all when every senior fits", () => {
      visitSenior(ARTHUR, { users: [SENIORS[0]] });
      sel.arrows().should("have.length", 0);
    });

    it("offers a right arrow when the strip overflows", () => {
      const many = Array.from({ length: 12 }, (_, i) =>
        buildSenior(`cccccccc-00${String(i).padStart(2, "0")}-4ccc-8ccc-cccccccccccc`, `Senior ${i}`)
      );
      visitSenior(many[0].userId, { users: many });
      sel.arrows().should("have.length.at.least", 1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Who sees it
  // ──────────────────────────────────────────────────────────────────────────

  describe("Access", () => {
    it("shows the carousel to a PCHO", () => {
      visitSenior(ARTHUR);
      sel.faces().should("have.length", 3);
    });

    it("shows the carousel to a Personal Care Giver at a residential home", { tags: [Tags.PCG] }, () => {
      visitSenior(ARTHUR, { role: "PCG" });
      sel.faces().should("have.length", 3);
    });

    it("hides it from a Nurse", { tags: [Tags.NURSE] }, () => {
      // utils/roles.ts grants CLINICAL_CAROUSEL to PCHO, HomeAdmin and PCG.
      visitSenior(ARTHUR, { role: "Nurse" });
      sel.faces().should("not.exist");
    });

    it("hides it from an In-Home-Care caregiver", { tags: [Tags.PCG] }, () => {
      // Their round comes from today's shifts, so a strip of every senior in
      // the home would be misleading.
      visitSenior(ARTHUR, {
        role: "PCG",
        home: buildHome({ homeType: "In Home Care" }),
      });
      sel.faces().should("not.exist");
    });

    it("still shows the senior's own tabs when the carousel is hidden", { tags: [Tags.NURSE] }, () => {
      visitSenior(ARTHUR, { role: "Nurse" });
      cy.contains("MedPass").should("be.visible");
    });
  });
});
