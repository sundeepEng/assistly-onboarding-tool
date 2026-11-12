/// <reference types="cypress" />

/**
 * Support request — POST /v1/support
 *
 * Trigger: avatar popover → "Support" (components/nav.tsx)
 *
 * The nav's avatar menu carries Profile / Support / Logout. Support opens a
 * ticket form whose payload is validated against SupportRequestSchema before
 * it posts:
 *
 *     POST /v1/support    { userEmail, subject, body, attachments? }
 *
 * Attachments are inlined as base64 (fileToBase64), not sent through the
 * pre-signed URL service — so the contract asserted here is the JSON body.
 */

import { Tags } from "../../framework/utils/tags";
import { buildHome, TEST_HOME_ID, TEST_USER_ID } from "../../framework/module-commands";

const stubNav = () => {
  cy.intercept("GET", `**/v1/user/${TEST_USER_ID}*`, {
    statusCode: 200,
    body: {
      user: {
        userId: TEST_USER_ID,
        name: "Admin User",
        email: "admin@assistly.com",
        role: "PCHO",
        homeId: TEST_HOME_ID,
      },
    },
  }).as("getNavUser");
};

const visitDashboard = () => {
  cy.clearAuthSession();
  cy.setAuthSession("PCHO");
  cy.stubHome(buildHome());
  stubNav();
  cy.visit("/");
};

/** Avatar → popover → Support. */
const openSupportModal = () => {
  // The avatar renders initials inside a rounded-full div (no img without a
  // profile image); "AU" (Admin User) identifies the popover trigger uniquely.
  cy.contains(".rounded-full", "AU", { timeout: 10000 }).click();
  cy.contains(/^Profile$/, { timeout: 8000 }).should("be.visible");
  cy.contains(/^Support$/).click();
};

describe("Support request", { tags: [Tags.REGRESSION] }, () => {
  it("posts the ticket with the signed-in user's email", () => {
    cy.intercept("POST", "**/v1/support", {
      statusCode: 200,
      body: { message: "created" },
    }).as("createSupport");
    visitDashboard();
    openSupportModal();
    cy.get('input[name="subject"], textarea[name="subject"]', {
      timeout: 8000,
    }).type("Cannot open the billing tab");
    cy.get('textarea[name="body"], input[name="body"]', { timeout: 8000 }).type(
      "The RevOps section never finishes loading on Chrome."
    );
    cy.contains("button", /submit|send/i, { timeout: 5000 }).click();
    cy.wait("@createSupport", { timeout: 10000 }).then(({ request }) => {
      expect(request.method).to.eq("POST");
      expect(request.url).to.include("/v1/support");
      expect(request.body.userEmail).to.eq("admin@assistly.com");
      expect(request.body.subject).to.eq("Cannot open the billing tab");
      expect(request.body.body).to.include("RevOps section");
      expect(request.headers["authorization"]).to.match(/^Bearer .+/);
    });
    cy.contains("Support request submitted", { timeout: 8000 }).should(
      "be.visible"
    );
  });

  it("blocks an invalid ticket before it reaches the API", () => {
    cy.intercept("POST", "**/v1/support").as("createSupport");
    visitDashboard();
    openSupportModal();
    // Subject filled, body empty — the schema rejects it client-side.
    cy.get('input[name="subject"], textarea[name="subject"]', {
      timeout: 8000,
    }).type("Half a ticket");
    cy.contains("button", /submit|send/i, { timeout: 5000 }).click();
    cy.get("#popover-portal", { timeout: 8000 }).should("not.be.empty");
    cy.assertNoRequest("@createSupport");
  });
});
