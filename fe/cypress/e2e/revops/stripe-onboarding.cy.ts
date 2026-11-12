/// <reference types="cypress" />

/**
 * RevOps — Stripe onboarding
 *
 * Route under test: /stripe/onboard?email={email} (pages/stripe/onboard.tsx)
 *
 * The page reads the email query param and POSTs it to the onboarding-link
 * endpoint — the only Stripe write the app performs client-side:
 *
 *     POST /v1/revops/stripe/onboarding-link    { email }
 *
 * On success the page hands the user off to the returned Stripe URL; the
 * handler is mocked out (the app sets window.location to an external origin).
 *
 * AS-BUILT NOTE — /v1/revops/stripe/status exists as a service
 * (services/stripe-status.ts) but no component calls it today; the return
 * page derives status from GET /v1/user/{id}.stripeOnboardingStatus instead.
 * The dead endpoint is documented, not asserted — if a caller lands, add the
 * contract test here.
 */

import { Tags } from "../../framework/utils/tags";
import { buildHome, TEST_HOME_ID } from "../../framework/module-commands";

const EMAIL = "admin@assistly.com";

const visitOnboard = () => {
  cy.clearAuthSession();
  cy.setAuthSession("PCHO");
  cy.stubHome(buildHome());
  cy.visit(`/stripe/onboard?email=${encodeURIComponent(EMAIL)}`);
};

describe("Stripe onboarding", { tags: [Tags.REGRESSION] }, () => {
  it("posts the query-param email to the onboarding-link endpoint", () => {
    cy.intercept("POST", "**/v1/revops/stripe/onboarding-link", {
      statusCode: 200,
      // Same-origin URL — the page assigns it to window.location on success,
      // and Cypress cannot follow a frame to an external Stripe origin.
      body: { url: "https://dev.assistly.live/stripe/return" },
    }).as("onboardingLink");
    visitOnboard();
    cy.wait("@onboardingLink", { timeout: 10000 }).then(({ request }) => {
      expect(request.method).to.eq("POST");
      expect(request.url).to.include("/v1/revops/stripe/onboarding-link");
      expect(request.body).to.deep.eq({ email: EMAIL });
      expect(request.headers["authorization"]).to.match(/^Bearer .+/);
    });
  });

  it("surfaces the error when the API cannot mint a link", () => {
    cy.intercept("POST", "**/v1/revops/stripe/onboarding-link", {
      statusCode: 500,
      body: { message: "stripe unavailable" },
    }).as("onboardingLink");
    visitOnboard();
    cy.wait("@onboardingLink");
    cy.contains(/failed|error|try again/i, { timeout: 10000 }).should(
      "be.visible"
    );
  });

  it("does not fire the request without an email param", () => {
    cy.intercept("POST", "**/v1/revops/stripe/onboarding-link").as(
      "onboardingLink"
    );
    cy.clearAuthSession();
    cy.setAuthSession("PCHO");
    cy.stubHome(buildHome());
    cy.visit("/stripe/onboard");
    // Give the page a settle window, then prove the call never went out.
    cy.contains(/email|error|invalid|required/i, { timeout: 8000 }).should(
      "exist"
    );
    cy.assertNoRequest("@onboardingLink");
  });
});
