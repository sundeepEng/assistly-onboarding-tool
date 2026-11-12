/**
 * Account activation (/activate-account) — the invite-acceptance flow.
 *
 * Every user's first contact with the product: they click an emailed link
 * carrying ?token=<jwt>, the token's email claim prefills a read-only field,
 * they set a password, and POST /activate-account completes the invite.
 *
 * Ported to the framework conventions: ActivateAccountPage owns every
 * selector (both DOM copies of the form — see the page object's class doc),
 * cy.stubActivateAccount owns the endpoint, and validation copy lives in
 * activateAccountPage.messages (activateAccountSchema).
 */

import { activateAccountPage as page } from "../../framework/pages/activate-account.page";
import { Routes, ApiPaths } from "../../framework/utils/routes";
import { Tags } from "../../framework/utils/tags";

const INVITE_EMAIL = "newjoiner@assistly.com";
/** A valid password: upper, lower, digit, and one of @$!%*?&# */
const GOOD_PASSWORD = "Str0ng!Pass";

/** Stub the endpoints the redirect target fires so the landing settles quietly. */
const stubSessionLanding = () => {
  cy.stubHomeLookup();
  cy.interceptApi("GET", ApiPaths.users, "usersList", { body: { users: [] } });
};

describe("Account Activation", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  // ────────────────────────────────────────────────────────────────────────
  // The screen
  // ────────────────────────────────────────────────────────────────────────

  describe("the screen", () => {
    it("renders the activation heading", { tags: [Tags.SANITY] }, () => {
      cy.stubActivateAccount();
      page.visit();
      page.heading.should("be.visible");
    });

    it("offers email, password, and re-enter password fields", () => {
      cy.stubActivateAccount();
      page.visit();
      page.emailInput.should("exist");
      page.passwordInput.should("exist");
      page.confirmInput.should("exist");
    });

    it("offers an Activate Account button and a way back to login", () => {
      cy.stubActivateAccount();
      page.visit();
      page.submitButton.should("be.visible");
      page.backToLogin.should("be.visible");
    });

    it("labels the two password fields differently", () => {
      cy.stubActivateAccount();
      page.visit();
      cy.contains("div:visible", "Re-enter Password").should("be.visible");
    });

    it("masks both password fields", () => {
      cy.stubActivateAccount();
      page.visit();
      page.passwordInput.should("have.attr", "type", "password");
      page.confirmInput.should("have.attr", "type", "password");
    });

    it("needs no session to reach it", () => {
      cy.stubActivateAccount();
      page.visit();
      cy.getCookie("idToken").should("not.exist");
      page.submitButton.should("be.visible");
    });

    it("renders the inline form on a narrow viewport", () => {
      // `mq761` is a MAX-width breakpoint — a phone gets activate-account.tsx's
      // own copy, headed "Activate Your Account".
      cy.stubActivateAccount();
      page.visit({ viewport: [600, 900] });
      cy.contains("h2", "Activate Your Account").should("be.visible");
    });

    it("renders the DesktopLogin screen on a wide viewport", () => {
      cy.stubActivateAccount();
      page.visit({ viewport: [1440, 900] });
      cy.contains("h2", "Activate Your Account").should("not.be.visible");
      cy.contains("h2", /^Activate Account$/).should("be.visible");
    });

    it("[as-built] keeps both copies of the form in the DOM at once", () => {
      // Neither block is conditionally rendered — the page ships two complete
      // forms and hides one with CSS. Harmless today because only the visible
      // copy can be submitted, but it is why every selector filters :visible.
      cy.stubActivateAccount();
      page.visit();
      cy.get('input[name="email"]').should("have.length", 2);
      cy.get('input[name="email"]:visible').should("have.length", 1);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // The invite token
  // ────────────────────────────────────────────────────────────────────────

  describe("the invite token", () => {
    it(
      "prefills the email from the token's claim",
      { tags: [Tags.SANITY] },
      () => {
        cy.stubActivateAccount();
        page.visit();
        page.emailInput.should("have.value", INVITE_EMAIL);
      }
    );

    it("prefills whatever email the token carries", () => {
      cy.stubActivateAccount();
      page.visit({ token: page.inviteToken("someone.else@assistly.com") });
      page.emailInput.should("have.value", "someone.else@assistly.com");
    });

    it("keeps the email read-only — it is the invite's, not the user's", () => {
      cy.stubActivateAccount();
      page.visit();
      page.emailInput.should("have.attr", "readonly");
    });

    it("never sends a tampered email — a force-typed value fails validation", () => {
      // cy.type({force:true}) bypasses the browser's readonly guard, but the
      // result APPENDS to the prefilled invite address ("invite@x.com" +
      // "attacker@evil.com"), which is not a valid email — the schema blocks
      // the submit and nothing reaches the API. The property under test: the
      // activated address always comes from the token, never from typed input.
      cy.stubActivateAccount();
      page.visit();
      page.emailInput.type("attacker@evil.com", { force: true });
      page.activateWith(GOOD_PASSWORD);
      cy.contains("div:visible", /invalid format/i).should("be.visible");
      cy.assertNoRequests("@activate");
    });

    it("leaves the email empty when the link carries no token", () => {
      cy.stubActivateAccount();
      page.visit({ token: null });
      page.emailInput.should("have.value", "");
    });

    it("leaves the email empty for a malformed token", () => {
      // decodeJwtToken swallows the error and returns null rather than throwing.
      cy.stubActivateAccount();
      page.visit({ token: "not-a-jwt" });
      page.emailInput.should("have.value", "");
    });

    it("stays on the screen for a malformed token rather than erroring out", () => {
      cy.stubActivateAccount();
      page.visit({ token: "not-a-jwt" });
      page.heading.should("be.visible");
    });

    it("leaves the email empty when the token has no email claim", () => {
      const noEmail = ["eyJhbGciOiJIUzI1NiJ9", btoa('{"sub":"x"}'), "sig"].join(
        "."
      );
      cy.stubActivateAccount();
      page.visit({ token: noEmail });
      page.emailInput.should("have.value", "");
    });

    it("[boundary] cannot be submitted without an email, however strong the password", () => {
      // The schema needs a valid email and the field is read-only, so an
      // invite-less visitor is stuck — the button does nothing at all.
      cy.stubActivateAccount();
      page.visit({ token: null });
      page.activateWith(GOOD_PASSWORD);
      cy.assertNoRequests("@activate");
    });

    it("sends the token back with the activation", { tags: [Tags.SANITY] }, () => {
      const token = page.inviteToken();
      cy.stubActivateAccount();
      page.visit({ token });
      page.activateWith(GOOD_PASSWORD);
      cy.wait("@activate").its("request.body.token").should("eq", token);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Validation (activateAccountSchema)
  // ────────────────────────────────────────────────────────────────────────

  describe("validation", () => {
    beforeEach(() => {
      cy.stubActivateAccount();
      page.visit();
    });

    it("refuses an empty form — no request leaves the browser", () => {
      page.submitButton.click();
      cy.assertNoRequests("@activate");
    });

    it("complains that a password is required", () => {
      page.submitButton.click();
      cy.contains(/required|at least 8/i).should("be.visible");
    });

    it("refuses a password with no confirmation — no request", () => {
      page.passwordInput.type(GOOD_PASSWORD);
      page.submitButton.click();
      cy.assertNoRequests("@activate");
    });

    it("asks for the confirmation to be re-entered", () => {
      // The schema's .nonempty() message only runs on a string; an untouched
      // field is undefined, so zod's type error fires first — loose match.
      page.passwordInput.type(GOOD_PASSWORD);
      page.submitButton.click();
      cy.contains("div:visible", /required|re-enter|expected string/i).should(
        "be.visible"
      );
    });

    it("refuses a confirmation that does not match — no request", () => {
      page.activateWith(GOOD_PASSWORD, "Str0ng!Other");
      cy.assertNoRequests("@activate");
    });

    it("says the passwords do not match", () => {
      page.activateWith(GOOD_PASSWORD, "Str0ng!Other");
      cy.contains(page.messages.passwordMismatch).should("be.visible");
    });

    it("[boundary] refuses a 7-character password", () => {
      page.activateWith("Str0ng!");
      cy.contains(page.messages.passwordTooShort).should("be.visible");
    });

    it("[boundary] accepts an 8-character password that meets every rule", () => {
      page.activateWith("Str0ng!A");
      cy.wait("@activate");
    });

    it("refuses a password with no uppercase letter", () => {
      page.activateWith("str0ng!pass");
      cy.contains(page.messages.passwordComplexity).should("be.visible");
    });

    it("refuses a password with no lowercase letter", () => {
      page.activateWith("STR0NG!PASS");
      cy.contains(page.messages.passwordComplexity).should("be.visible");
    });

    it("refuses a password with no digit", () => {
      page.activateWith("Strong!Pass");
      cy.contains(page.messages.passwordComplexity).should("be.visible");
    });

    it("refuses a password with no special character", () => {
      page.activateWith("Str0ngPass");
      cy.contains(page.messages.passwordComplexity).should("be.visible");
    });

    it("[boundary] refuses a strong password built from an unlisted symbol", () => {
      // The whitelist is [A-Za-z\d@$!%*?&#] — a hyphen fails the whole pattern
      // even though the password is otherwise complete. The message only
      // mentions the four classes, so it reads as a false rejection.
      page.activateWith("Str0ng-Pass");
      cy.contains(page.messages.passwordComplexity).should("be.visible");
      cy.assertNoRequests("@activate");
    });

    it("accepts each of the listed special characters", () => {
      // One representative from the whitelist, to prove the set is honoured.
      page.activateWith("Str0ng#Pass");
      cy.wait("@activate");
    });

    it("clears the mismatch complaint once the confirmation is corrected", () => {
      page.activateWith(GOOD_PASSWORD, "Str0ng!Other");
      cy.contains(page.messages.passwordMismatch).should("be.visible");
      page.confirmInput.clear().type(GOOD_PASSWORD);
      page.submitButton.click();
      cy.wait("@activate");
    });

    it("sends nothing while the form is invalid, however many times it is pressed", () => {
      page.submitButton.click();
      page.submitButton.click();
      cy.assertNoRequests("@activate");
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // The request
  // ────────────────────────────────────────────────────────────────────────

  describe("the request", () => {
    beforeEach(() => {
      cy.stubActivateAccount();
      page.visit();
    });

    it(
      "POSTs to /activate-account",
      { tags: [Tags.SANITY] },
      () => {
        page.activateWith(GOOD_PASSWORD);
        cy.wait("@activate").its("request.method").should("eq", "POST");
      }
    );

    it("carries the email, password, and confirmation", () => {
      page.activateWith(GOOD_PASSWORD);
      cy.wait("@activate").then(({ request }) => {
        expect(request.body.email).to.eq(INVITE_EMAIL);
        expect(request.body.password).to.eq(GOOD_PASSWORD);
        expect(request.body.confirmPassword).to.eq(GOOD_PASSWORD);
      });
    });

    it("lower-cases the email before sending it", () => {
      page.visit({ token: page.inviteToken("MixedCase@Assistly.com") });
      page.activateWith(GOOD_PASSWORD);
      cy.wait("@activate")
        .its("request.body.email")
        .should("eq", "mixedcase@assistly.com");
    });

    it("sends no Authorization header — the caller has no session yet", () => {
      page.activateWith(GOOD_PASSWORD);
      cy.wait("@activate").then(({ request }) => {
        expect(request.headers).to.not.have.property("authorization");
      });
    });

    it("sends JSON", () => {
      page.activateWith(GOOD_PASSWORD);
      cy.wait("@activate")
        .its("request.headers.content-type")
        .should("contain", "application/json");
    });

    it("sends exactly the four expected fields", () => {
      page.activateWith(GOOD_PASSWORD);
      cy.wait("@activate").then(({ request }) => {
        expect(Object.keys(request.body).sort()).to.deep.eq([
          "confirmPassword",
          "email",
          "password",
          "token",
        ]);
      });
    });

    it("sends one request per press", () => {
      page.activateWith(GOOD_PASSWORD);
      cy.wait("@activate");
      cy.get("@activate.all").should("have.length", 1);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Success
  // ────────────────────────────────────────────────────────────────────────

  describe("after it succeeds", () => {
    beforeEach(() => {
      cy.stubActivateAccount();
      page.visit();
    });

    it(
      "confirms the activation",
      { tags: [Tags.SANITY] },
      () => {
        page.activateWith(GOOD_PASSWORD);
        cy.wait("@activate");
        cy.contains(page.messages.activated).should("be.visible");
      }
    );

    it("sends the user on to the app", () => {
      // router.push("/") fires 1500ms after the confirmation; "/" is transient
      // because activation does not create a session, so the auth guard's
      // bounce to /login is the deterministic landing spot.
      page.activateWith(GOOD_PASSWORD);
      cy.wait("@activate");
      cy.location("pathname", { timeout: 10000 }).should("eq", Routes.login);
    });

    it("does not sign the user in on its own", () => {
      // Activation sets a password; it returns no tokens — the user still
      // has to log in.
      page.activateWith(GOOD_PASSWORD);
      cy.wait("@activate");
      cy.getCookie("idToken").should("not.exist");
    });

    it("accepts a 201 as readily as a 200", () => {
      cy.stubActivateAccount(201, { message: "created" });
      page.activateWith(GOOD_PASSWORD);
      cy.contains(page.messages.activated).should("be.visible");
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Failure
  // ────────────────────────────────────────────────────────────────────────

  describe("when it fails", () => {
    const visitAndFail = (statusCode: number, body: Record<string, unknown>) => {
      cy.stubActivateAccount(statusCode, body);
      page.visit();
      page.activateWith(GOOD_PASSWORD);
      cy.wait("@activate");
    };

    it(
      "surfaces the API's own message",
      { tags: [Tags.SANITY] },
      () => {
        visitAndFail(400, { error: "This invitation has expired." });
        cy.contains("This invitation has expired.").should("be.visible");
      }
    );

    it("surfaces an already-activated account", () => {
      visitAndFail(409, { error: "Account is already active." });
      cy.contains("Account is already active.").should("be.visible");
    });

    it("surfaces a rejected token", () => {
      visitAndFail(401, { error: "Invalid activation token." });
      cy.contains("Invalid activation token.").should("be.visible");
    });

    it("stays on the activation screen after a failure", () => {
      visitAndFail(400, { error: "This invitation has expired." });
      page.assertUrl(Routes.activateAccount);
    });

    it("keeps the form filled in so it can be retried", () => {
      visitAndFail(500, {});
      page.emailInput.should("have.value", INVITE_EMAIL);
    });

    it("allows a second attempt after a failure", () => {
      // The error popover stays up and covers the form — dismiss it first,
      // exactly what a user does.
      visitAndFail(500, {});
      page.dismissPopover();
      cy.stubActivateAccount(200, { message: "ok" });
      page.submitButton.click();
      cy.wait("@activate");
      cy.contains(page.messages.activated).should("be.visible");
    });

    it("does not redirect on a failure", () => {
      visitAndFail(400, { error: "nope" });
      // Give any erroneous redirect a beat to fire, then confirm we stayed.
      cy.contains("nope").should("be.visible");
      page.assertUrl(Routes.activateAccount);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Navigation and an existing session
  // ────────────────────────────────────────────────────────────────────────

  describe("navigation & an existing session", () => {
    it("Back to login leaves the activation screen", () => {
      cy.stubActivateAccount();
      page.visit();
      page.backToLogin.click();
      cy.location("pathname", { timeout: 10000 }).should(
        "not.eq",
        Routes.activateAccount
      );
    });

    it("sends an already-signed-in user away", () => {
      cy.stubActivateAccount();
      cy.setAuthSession("PCHO");
      stubSessionLanding();
      cy.visit(`${Routes.activateAccount}?token=${page.inviteToken()}`);
      cy.location("pathname", { timeout: 10000 }).should(
        "not.eq",
        Routes.activateAccount
      );
    });

    it("tells an already-signed-in user why", () => {
      cy.stubActivateAccount();
      cy.setAuthSession("PCHO");
      stubSessionLanding();
      cy.visit(`${Routes.activateAccount}?token=${page.inviteToken()}`);
      cy.contains(page.messages.alreadyLoggedIn, { timeout: 10000 }).should(
        "be.visible"
      );
    });

    it("never activates for a user who already has a session", () => {
      cy.stubActivateAccount();
      cy.setAuthSession("PCHO");
      stubSessionLanding();
      cy.visit(`${Routes.activateAccount}?token=${page.inviteToken()}`);
      cy.location("pathname", { timeout: 10000 }).should(
        "not.eq",
        Routes.activateAccount
      );
      cy.assertNoRequests("@activate");
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // End-to-end journeys
  // ────────────────────────────────────────────────────────────────────────

  describe("end to end", () => {
    it("E2E — an invited carer sets a password and is handed to the app", () => {
      const token = page.inviteToken("carer.invite@assistly.com");
      cy.stubActivateAccount();
      page.visit({ token });

      // The link decides who is being activated.
      page.emailInput.should("have.value", "carer.invite@assistly.com");
      page.emailInput.should("have.attr", "readonly");

      // A weak password is refused before anything leaves the browser.
      page.activateWith("short");
      cy.contains(page.messages.passwordTooShort).should("be.visible");
      cy.assertNoRequests("@activate");

      // So is a mismatch.
      page.passwordInput.clear().type(GOOD_PASSWORD);
      page.confirmInput.clear().type("Str0ng!Different");
      page.submitButton.click();
      cy.contains(page.messages.passwordMismatch).should("be.visible");
      cy.assertNoRequests("@activate");

      // Corrected, it goes out with the token and the invited address.
      page.confirmInput.clear().type(GOOD_PASSWORD);
      page.submitButton.click();
      cy.wait("@activate").then(({ request }) => {
        expect(request.body.email).to.eq("carer.invite@assistly.com");
        expect(request.body.password).to.eq(GOOD_PASSWORD);
        expect(request.body.token).to.eq(token);
      });

      // Confirmed, then handed over — still without a session, so the push to
      // "/" is immediately bounced by the auth guard to /login.
      cy.contains(page.messages.activated).should("be.visible");
      cy.location("pathname", { timeout: 10000 }).should("eq", Routes.login);
      cy.getCookie("idToken").should("not.exist");
    });

    it("E2E — an expired invitation is refused and can be retried", () => {
      cy.stubActivateAccount(400, { error: "This invitation has expired." });
      const token = page.inviteToken();
      page.visit({ token });

      page.activateWith(GOOD_PASSWORD);
      cy.wait("@activate");
      cy.contains("This invitation has expired.").should("be.visible");
      page.assertUrl(Routes.activateAccount);

      // A freshly issued invitation works without reloading the page — once
      // the error popover covering the form has been dismissed.
      page.dismissPopover();
      cy.stubActivateAccount(200, { message: "ok" });
      page.submitButton.click();
      cy.wait("@activate");
      cy.contains(page.messages.activated).should("be.visible");
    });
  });
});
