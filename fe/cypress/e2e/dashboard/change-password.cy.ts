/// <reference types="cypress" />

/**
 * Change password — PUT /update-password
 *
 * Trigger: avatar popover → Profile → "Change Password" tab
 * (components/nav.tsx)
 *
 * The form validates client-side before any request:
 *   - newPassword !== reEnterNewPassword  → "Passwords does not match!"
 *   - oldPassword === newPassword         → "cannot be the same as old"
 * then PUTs:
 *
 *     PUT /update-password   { accessToken, oldPassword, newPassword }
 *
 * (non-/v1 endpoint — the auth service family, like /signin.)
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

const openChangePassword = () => {
  cy.clearAuthSession();
  cy.setAuthSession("PCHO");
  cy.stubHome(buildHome());
  stubNav();
  cy.visit("/");
  // Avatar initials → popover → Profile → Change Password tab.
  cy.contains(".rounded-full", "AU", { timeout: 10000 }).click();
  cy.contains(/^Profile$/, { timeout: 8000 }).click();
  cy.contains("Change Password", { timeout: 10000 }).click();
  cy.get('input[name="oldPassword"]', { timeout: 8000 }).should("be.visible");
};

const fillForm = (oldPw: string, newPw: string, rePw: string) => {
  cy.get('input[name="oldPassword"]').type(oldPw);
  cy.get('input[name="newPassword"]').type(newPw);
  cy.get('input[name="reEnterNewPassword"]').type(rePw);
};

describe("Change password", { tags: [Tags.REGRESSION] }, () => {
  it("puts the password payload on the auth endpoint", () => {
    cy.intercept("PUT", "**/update-password", {
      statusCode: 200,
      body: { message: "updated" },
    }).as("updatePassword");
    openChangePassword();
    fillForm("Old@1234", "New@1234", "New@1234");
    cy.contains("button", /update|save|submit|change/i, { timeout: 5000 }).click();
    cy.wait("@updatePassword", { timeout: 10000 }).then(({ request }) => {
      expect(request.method).to.eq("PUT");
      expect(request.url).to.include("/update-password");
      expect(request.body.oldPassword).to.eq("Old@1234");
      expect(request.body.newPassword).to.eq("New@1234");
      expect(request.body.accessToken).to.be.a("string").and.not.be.empty;
    });
    cy.contains("Password updated Successfully", { timeout: 8000 }).should(
      "be.visible"
    );
  });

  it("rejects a mismatched confirmation before the request", () => {
    // AS-BUILT: updatePasswordSchema.refine() rejects the mismatch inside the
    // form — the inline field error shows and onSubmit's popover branch never
    // runs. Asserted as-built (inline text), not via the popover.
    cy.intercept("PUT", "**/update-password").as("updatePassword");
    openChangePassword();
    fillForm("Old@1234", "New@1234", "Different@1");
    cy.contains("button", /update|save|submit|change/i, { timeout: 5000 }).click();
    cy.contains(/do not match|does not match/i, { timeout: 8000 }).should(
      "be.visible"
    );
    cy.assertNoRequest("@updatePassword");
  });

  it("rejects reusing the old password before the request", () => {
    cy.intercept("PUT", "**/update-password").as("updatePassword");
    openChangePassword();
    fillForm("Same@1234", "Same@1234", "Same@1234");
    cy.contains("button", /update|save|submit|change/i, { timeout: 5000 }).click();
    cy.get("#popover-portal", { timeout: 8000 }).should(
      "contain.text",
      "cannot be the same"
    );
    cy.assertNoRequest("@updatePassword");
  });
});
