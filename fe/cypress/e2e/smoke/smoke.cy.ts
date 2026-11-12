/**
 * Smoke suite — the small set that runs against live deployments.
 *
 * Rules for @smoke specs:
 *   - REAL auth only (cy.login through /signin). A stubbed "smoke" test proves
 *     nothing about the deployment.
 *   - Read-only journeys. Never create/mutate data here.
 *   - Keep the set tiny: each test is a page a customer would riot over losing.
 */

import { loginPage } from "../../framework/pages/login.page";
import { Routes } from "../../framework/utils/routes";
import { Tags } from "../../framework/utils/tags";

describe("Deployment smoke", { tags: [Tags.SMOKE, Tags.PCHO] }, () => {
  it("serves the login page", () => {
    loginPage.visit();
    loginPage.assertLoaded();
  });

  it("signs in with the environment account and leaves /login", () => {
    cy.login();
    // getInitialRoute picks the landing page by role + isSalesRequired; the
    // only contract worth asserting at smoke level is "authenticated and
    // routed away from the login screen".
    cy.visit(Routes.dashboard);
    cy.location("pathname").should("not.eq", Routes.login);
    cy.getCookie("idToken").should("exist");
  });
});
