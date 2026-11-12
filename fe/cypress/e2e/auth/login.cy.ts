/**
 * Login Screen — full coverage suite.
 *
 * Route under test: /login  (components/login/desktop-login.tsx)
 *
 * Sections:
 *   1. UI structure & layout     — header, card, fields, labels
 *   2. Client-side validation    — every zod rule + boundary + edge inputs
 *   3. Sign-in request contract  — payload shape, normalization, no pre-auth token
 *   4. Successful sign-in        — cookies, popover, role→route matrix, token propagation
 *   5. Failed sign-in            — 401/500/network, error-message fallbacks
 *   6. UX states                 — loading lock, Enter-to-submit, password toggle
 *   7. Session & access          — authenticated redirect, expired session
 *   8. Responsive                — mobile viewport behaviour (as-built pin)
 *   9. End-to-end journeys       — fail→correct→succeed, forgot→back
 *
 * Conventions demonstrated: page objects only (no inline selectors in specs),
 * intercept aliases over fixed waits, message constants synced with
 * model/crm/user.model.ts, tag constants from utils/tags.
 */

import { loginPage } from "../../framework/pages/login.page";
import { forgotPasswordPage } from "../../framework/pages/forgot-password.page";
import { AppRole, TEST_USER_ID } from "../../framework/constants";
import { Routes } from "../../framework/utils/routes";
import { Tags } from "../../framework/utils/tags";
import loginData from "../../fixtures/login.json";

const VALID_EMAIL = Cypress.env("TEST_USER_EMAIL") as string;
const VALID_PASSWORD = Cypress.env("TEST_USER_PASSWORD") as string;

/**
 * Every route the app can land on after sign-in, per
 * utils/roleAccess.ts:getInitialRoute + utils/roles.ts:INITIAL_ROUTE.
 * isSalesRequired comes from the stubbed /v1/home lookup.
 */
const ROLE_ROUTES: Array<[AppRole, boolean, string]> = [
  ["PCHO", false, Routes.crm],
  ["PCHO", true, Routes.salesDashboard],
  ["HomeAdmin", false, Routes.crm],
  ["HomeAdmin", true, Routes.salesDashboard],
  ["SalesRepresentative", false, Routes.salesDashboard],
  ["SalesDirector", false, Routes.salesDashboard],
  ["Nurse", false, Routes.clinical],
  ["ComplianceGuest", false, "/compliance/training"],
  ["Lead", false, `/crm/${TEST_USER_ID}`],
  ["Senior", false, `/crm/${TEST_USER_ID}`],
  ["PCGLead", false, `/crm/pcg/${TEST_USER_ID}`],
  ["NurseLead", false, `/crm/nurse/${TEST_USER_ID}`],
  ["PCG", false, "/"],
];

describe("Login Screen", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  // ────────────────────────────────────────────────────────────────────────
  // 1. UI structure & layout
  // ────────────────────────────────────────────────────────────────────────

  describe("UI structure & layout", () => {
    beforeEach(() => {
      loginPage.visit();
    });

    it("renders the Assistly logo in the header", () => {
      loginPage.logo.should("be.visible");
    });

    it("renders the header navigation links", () => {
      ["Home", "Products", "Who We Serve", "About Us", "Blog"].forEach((link) =>
        loginPage.navLink(link).should("be.visible")
      );
    });

    it("links 'Request a Demo' to the marketing site", () => {
      loginPage
        .navLink("Request a Demo")
        .should("be.visible")
        .and("have.attr", "href", "https://assistly.care/request-a-demo/");
    });

    it(
      "renders the Login card with heading and subtitle",
      { tags: [Tags.SANITY] },
      () => {
        loginPage.assertLoaded();
        loginPage.subtitle.should("be.visible");
      }
    );

    it("renders labelled Email and Password fields with placeholders", () => {
      loginPage.fieldLabel("Email").should("be.visible");
      loginPage.fieldLabel("Password").should("be.visible").and("have.length", 1);
      loginPage.emailInput
        .should("be.visible")
        .and("have.attr", "placeholder", "Enter your email");
      loginPage.passwordInput
        .should("be.visible")
        .and("have.attr", "placeholder", "Enter your password");
    });

    it("masks the password field by default", () => {
      loginPage.passwordInput.should("have.attr", "type", "password");
    });

    it("renders a Sign in button and Forgot password link", () => {
      loginPage.signInButton.should("be.visible").and("be.enabled");
      loginPage.forgotPasswordLink.should("be.visible");
    });

    it("renders the marketing headline and value-prop bullets", () => {
      loginPage.root
        .contains("All Your Care Operations.")
        .should("be.visible");
      loginPage.root
        .contains("One Unified Platform.")
        .should("be.visible");
      loginPage.root
        .contains("Manage schedules, care plans, and compliance")
        .should("be.visible");
      loginPage.root.contains("Stay inspection-ready").should("be.visible");
    });

    it("renders the footer with copyright text", () => {
      loginPage.root.contains(/© Copyright \d{4}/).should("be.visible");
      loginPage.root.contains("Assistly Care LLC").should("be.visible");
      loginPage.root.contains("Charter Global").should("be.visible");
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 2. Client-side validation — nothing invalid ever reaches the API
  // ────────────────────────────────────────────────────────────────────────

  describe("client-side validation", () => {
    beforeEach(() => {
      cy.interceptLoginApi();
      loginPage.visit();
    });

    it(
      "blocks an empty submission with errors on both fields",
      { tags: [Tags.SANITY] },
      () => {
      loginPage.submit();
      // Untouched fields submit as `undefined` — zod reports its generic
      // "Required" rather than the custom messages.
      loginPage
        .fieldError("email")
        .should("contain.text", loginPage.messages.untouchedRequired);
      loginPage
        .fieldError("password")
        .should("contain.text", loginPage.messages.untouchedRequired);
      cy.assertNoLoginRequest();
    });

    it("blocks when only the password is filled", () => {
      loginPage.typePassword(VALID_PASSWORD).submit();
      loginPage
        .fieldError("email")
        .should("contain.text", loginPage.messages.untouchedRequired);
      cy.assertNoLoginRequest();
    });

    it("blocks when only the email is filled", () => {
      loginPage.typeEmail(VALID_EMAIL).submit();
      loginPage
        .fieldError("password")
        .should("contain.text", loginPage.messages.untouchedRequired);
      cy.assertNoLoginRequest();
    });

    it("shows the custom messages when a field is touched then cleared", () => {
      // Touched-then-cleared produces "" (not undefined). The schema order then
      // matters: email's .nonempty() runs first -> "Email is required"; the
      // password's .min(8) precedes its .nonempty() -> the too-short message.
      loginPage.typeEmail("a").typeEmail("");
      loginPage.typePassword("a").typePassword("");
      loginPage.submit();
      loginPage
        .fieldError("email")
        .should("contain.text", loginPage.messages.emailRequired);
      loginPage
        .fieldError("password")
        .should("contain.text", loginPage.messages.passwordTooShort);
      cy.assertNoLoginRequest();
    });

    // Every malformed shape zod's .email() rejects.
    [
      "not-an-email",
      "missing@tld",
      "user@@assistly.com",
      "@assistly.com",
      "user @assistly.com",
      "user@assistly .com",
    ].forEach((badEmail) => {
      // One representative malformed email belongs to sanity; the rest are
      // regression-depth matrix coverage.
      const tags = badEmail === "not-an-email" ? [Tags.SANITY] : [];
      it(
        `rejects malformed email "${badEmail}"`,
        { tags },
        () => {
          loginPage.signIn(badEmail, VALID_PASSWORD);
          loginPage
            .fieldError("email")
            .should("contain.text", loginPage.messages.emailInvalid);
          cy.assertNoLoginRequest();
        }
      );
    });

    it("rejects an email wrapped in whitespace — no pre-validation trim", () => {
      // The handler trims after schema validation, so padded input never
      // reaches it: zod sees the spaces and reports an invalid email.
      loginPage.signIn(`  ${VALID_EMAIL}  `, VALID_PASSWORD);
      loginPage
        .fieldError("email")
        .should("contain.text", loginPage.messages.emailInvalid);
      cy.assertNoLoginRequest();
    });

    it(
      "blocks a password under 8 characters",
      { tags: [Tags.SANITY] },
      () => {
      loginPage.signIn(VALID_EMAIL, loginData.invalid.shortPassword); // 7 chars
      loginPage
        .fieldError("password")
        .should("contain.text", loginPage.messages.passwordTooShort);
      cy.assertNoLoginRequest();
    });

    // Same length, one missing character class each — plus the regex's
    // whitelist quirks ([A-Za-z\d@$!%*?&#] only).
    [
      ["no uppercase", "test@1234"],
      ["no lowercase", "TEST@1234"],
      ["no digit", "Test@abcd"],
      ["no special character", "Test12345"],
      ["disallowed special char '^'", "Aa1bcde^"],
      ["disallowed special char '('", "Aa1bcde("],
      ["contains an emoji", "Aa1!bc😀"],
    ].forEach(([label, weakPassword]) => {
      it(`rejects a password with ${label}`, () => {
        loginPage.signIn(VALID_EMAIL, weakPassword);
        loginPage
          .fieldError("password")
          .should("contain.text", loginPage.messages.passwordComplexity);
        cy.assertNoLoginRequest();
      });
    });

    it("accepts a password at the 8-character boundary", () => {
      // "Test@123" is exactly 8 chars, all required classes — validation must
      // pass and the request must fire (stubbed 401 proves it left the page).
      cy.stubLoginFailure(401, "reached the api");
      loginPage.signIn(VALID_EMAIL, "Test@123");
      cy.wait("@loginRequest");
      loginPage.dismissPopover();
    });

    it("rejects injection-shaped input client-side", () => {
      loginPage.signIn("' OR '1'='1", "' OR '1'='1");
      loginPage.fieldError("email").should("contain.text", loginPage.messages.emailInvalid);
      cy.assertNoLoginRequest();
    });

    it("rejects markup-shaped input without rendering it", () => {
      loginPage.signIn("<img src=x onerror=alert(1)>", VALID_PASSWORD);
      loginPage
        .fieldError("email")
        .should("contain.text", loginPage.messages.emailInvalid);
      cy.get("img[src='x']").should("not.exist");
      cy.assertNoLoginRequest();
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 3. Sign-in request contract
  // ────────────────────────────────────────────────────────────────────────

  describe("sign-in request contract", () => {
    beforeEach(() => {
      loginPage.visit();
    });

    it(
      "posts email + password as JSON to the sign-in endpoint",
      { tags: [Tags.SANITY] },
      () => {
      cy.stubLoginSuccess("PCHO");
      cy.stubHomeLookup(false);
      loginPage.signIn();

      cy.wait("@loginRequest").then(({ request }) => {
        expect(request.url).to.include("/signin");
        expect(request.method).to.eq("POST");
        expect(request.headers["content-type"]).to.include("application/json");
        expect(request.body).to.deep.eq({
          email: VALID_EMAIL,
          password: VALID_PASSWORD,
        });
      });
    });

    it("normalizes the email to lowercase in the request body", () => {
      // desktop-login.tsx: `email.trim().toLowerCase()` runs before mutate —
      // an uppercase login must reach the API lowercase.
      cy.stubLoginSuccess("PCHO");
      cy.stubHomeLookup(false);
      loginPage.signIn("TESTINGDEVS@YOPMAIL.COM", VALID_PASSWORD);

      cy.wait("@loginRequest").then(({ request }) => {
        expect(request.body.email).to.eq("testingdevs@yopmail.com");
      });
    });

    it("carries no idToken — sign-in is a pre-auth endpoint", () => {
      cy.stubLoginSuccess("PCHO");
      cy.stubHomeLookup(false);
      loginPage.signIn();

      cy.wait("@loginRequest").then(({ request }) => {
        expect(request.body).to.not.have.property("idToken");
        expect(request.headers).to.not.have.property("authorization");
      });
    });

    it("[as-built] silently strips whitespace typed into the password field", () => {
      // FormInputFieldComponent trims on every change for passwordVisibility
      // fields — a space typed mid-password is deleted on the spot, so
      // "Aa1! bcde" leaves the browser as "Aa1!bcde". Passwords can never
      // contain whitespace; this pins the behaviour (and would flag a change).
      cy.stubLoginSuccess("PCHO");
      cy.stubHomeLookup(false);
      loginPage.signIn(VALID_EMAIL, "Aa1! bcde");

      cy.wait("@loginRequest").then(({ request }) => {
        expect(request.body.password).to.eq("Aa1!bcde");
      });
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 4. Successful sign-in
  // ────────────────────────────────────────────────────────────────────────

  describe("successful sign-in", () => {
    beforeEach(() => {
      loginPage.visit();
    });

    it(
      "persists all four session cookies",
      { tags: [Tags.SANITY] },
      () => {
      cy.stubLoginSuccess("PCHO");
      cy.stubHomeLookup(false);
      loginPage.signIn();

      cy.wait("@loginRequest");
      ["idToken", "accessToken", "userId", "homeId"].forEach((cookie) =>
        cy.getCookie(cookie).should("exist")
      );
    });

    it(
      "shows the 'Login Successful!' popover",
      { tags: [Tags.SANITY] },
      () => {
      cy.stubLoginSuccess("PCHO");
      cy.stubHomeLookup(false);
      loginPage.signIn();
      cy.assertPopover(loginPage.messages.loginSuccess);
    });

    it("reports the userType and a matching custom:role claim", () => {
      cy.stubLoginSuccess("SalesDirector");
      cy.stubHomeLookup(false);
      loginPage.signIn();
      cy.assertUserType("SalesDirector");
    });

    // Every role lands where utils/roles.ts says it should. The canonical
    // PCHO route doubles as the sanity check; the full matrix is regression.
    ROLE_ROUTES.forEach(([role, isSalesRequired, expectedRoute]) => {
      const tags = role === "PCHO" && !isSalesRequired ? [Tags.SANITY] : [];
      it(
        `routes ${role}${role === "PCHO" || role === "HomeAdmin" ? ` (isSalesRequired=${isSalesRequired})` : ""} to ${expectedRoute}`,
        { tags },
        () => {
          cy.stubLoginSuccess(role);
          cy.stubHomeLookup(isSalesRequired);
          loginPage.signIn();
          cy.storeIdToken();
          cy.location("pathname").should("eq", expectedRoute);
        }
      );
    });

    it(
      "propagates the id token as a Bearer header on the next API call",
      { tags: [Tags.SANITY] },
      () => {
      // Right after sign-in the app fetches /v1/home/{homeId} — getById.ts
      // reads the just-persisted cookie into an Authorization header.
      cy.stubLoginSuccess("PCHO");
      cy.stubHomeLookup(false);
      loginPage.signIn();
      cy.storeIdToken();

      cy.wait("@homeLookup").then(({ request }) => {
        cy.getStoredIdToken().then((token) => {
          expect(request.headers.authorization).to.eq(`Bearer ${token}`);
        });
      });
    });

    it("caches the home's isSalesRequired flag in a cookie for later screens", () => {
      // getInitialRoute reads the /v1/home lookup once, then persists the flag
      // so downstream screens route without re-fetching the home.
      cy.stubLoginSuccess("PCHO");
      cy.stubHomeLookup(true);
      loginPage.signIn();

      cy.wait("@homeLookup");
      cy.getCookie("isSalesRequired").should("have.property", "value", "true");
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 5. Failed sign-in
  // ────────────────────────────────────────────────────────────────────────

  describe("failed sign-in", () => {
    beforeEach(() => {
      loginPage.visit();
    });

    it(
      "surfaces a 401 API error message in the popover",
      { tags: [Tags.SANITY] },
      () => {
      cy.stubLoginFailure(401, "Invalid email or password");
      loginPage.signIn();
      cy.assertPopover("Invalid email or password");
      loginPage.dismissPopover();
      cy.location("pathname").should("eq", Routes.login);
    });

    it("surfaces a 500 server error", () => {
      cy.stubLoginFailure(500, "Internal Server Error");
      loginPage.signIn();
      cy.assertPopover("Internal Server Error");
      cy.location("pathname").should("eq", Routes.login);
    });

    it("falls back to 'Failed to Signin' for a non-string error body", () => {
      // errMsg = error.response.data.error if string else "Failed to Signin".
      cy.stubLoginFailure(403, { unexpected: "shape" });
      loginPage.signIn();
      cy.assertPopover(loginPage.messages.signinFallbackError);
    });

    it(
      "falls back to 'Failed to Signin' on network failure",
      { tags: [Tags.SANITY] },
      () => {
      cy.intercept("POST", "**/signin", { forceNetworkError: true }).as(
        "loginRequest"
      );
      loginPage.signIn();
      cy.assertPopover(loginPage.messages.signinFallbackError);
    });

    it("writes no session cookies after a failed attempt", () => {
      cy.stubLoginFailure(401, "Invalid email or password");
      loginPage.signIn();
      cy.assertPopover("Invalid email or password");
      cy.getCookie("idToken").should("be.null");
      cy.location("pathname").should("eq", Routes.login);
    });

    it("re-enables the Sign in button after an API error", () => {
      cy.stubLoginFailure(401, "Invalid email or password");
      loginPage.signIn();

      cy.wait("@loginRequest");
      loginPage.signInButton.should("not.be.disabled");
    });

    it("surfaces a distinct message for user-not-found vs bad credentials", () => {
      // Two different 401 bodies → two different popovers; the app must not
      // collapse them into one generic error.
      cy.stubLoginFailure(401, "User not found");
      loginPage.signIn();
      cy.assertPopover("User not found");
      loginPage.dismissPopover();

      cy.stubLoginFailure(401, "Invalid email or password");
      loginPage.signIn();
      cy.assertPopover("Invalid email or password");
    });

    it("keeps the error popover on screen — it does not auto-dismiss like success", () => {
      // Success popovers close after ~2s; error popovers set close options and
      // stay. cy.clock()+cy.tick() advances the app clock deterministically —
      // no real wait, no flake.
      cy.clock();
      cy.stubLoginFailure(401, "Invalid email or password");
      loginPage.signIn();
      cy.assertPopover("Invalid email or password");

      cy.tick(3000);
      cy.assertPopover("Invalid email or password");

      // It is dismissed by clicking the backdrop, which frees the form again.
      loginPage.dismissPopover();
      loginPage.typeEmail("someone@assistly.com");
      loginPage.emailInput.should("have.value", "someone@assistly.com");
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 6. UX states
  // ────────────────────────────────────────────────────────────────────────

  describe("UX states", () => {
    beforeEach(() => {
      loginPage.visit();
    });

    it("reveals and re-masks the password while keeping its value", () => {
      loginPage.typePassword(VALID_PASSWORD);
      loginPage.passwordInput.should("have.attr", "type", "password");

      // FormInputFieldComponent passes `props.type` (undefined) when revealed,
      // so the attribute is dropped rather than set to "text".
      loginPage.togglePasswordVisibility();
      loginPage.passwordInput
        .should("not.have.attr", "type", "password")
        .and("have.value", VALID_PASSWORD);

      loginPage.togglePasswordVisibility();
      loginPage.passwordInput.should("have.attr", "type", "password");
    });

    it("locks the submit button while the request is in flight", () => {
      // Button disabled={disabled || isLoading} — the lock is what prevents
      // a double-submit during a slow response.
      cy.stubLoginDelayed(1500, "PCHO");
      cy.stubHomeLookup(false);
      loginPage.signIn();

      loginPage.signInButton.should("be.disabled");
      cy.wait("@loginRequest");
      cy.get("@loginRequest.all").should("have.length", 1);
    });

    it(
      "submits the form when Enter is pressed in the password field",
      { tags: [Tags.SANITY] },
      () => {
      cy.stubLoginSuccess("PCHO");
      cy.stubHomeLookup(false);
      loginPage.fillForm(VALID_EMAIL, VALID_PASSWORD);
      loginPage.passwordInput.type("{enter}");
      cy.wait("@loginRequest");
      cy.assertUserType("PCHO");
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 7. Session & access
  // ────────────────────────────────────────────────────────────────────────

  describe("session & access", () => {
    it(
      "redirects an authenticated visitor to their role route",
      { tags: [Tags.SANITY] },
      () => {
      // Signed-in users must never sit on the login screen. The app resolves
      // the route from the id-token cookie — getInitialRoute without
      // isSalesRequired sends PCHO to "/".
      cy.setAuthSession("PCHO");
      cy.visit(Routes.login);
      cy.location("pathname", { timeout: 10000 }).should("eq", "/");
      cy.assertPopover(loginPage.messages.alreadyLoggedIn);
    });

    it("does not redirect a visitor whose session has expired", () => {
      cy.setExpiredAuthSession("PCHO");
      cy.visit(Routes.login);
      loginPage.emailInput.should("be.visible");
      cy.location("pathname").should("eq", Routes.login);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 8. Responsive — as-built documentation
  // ────────────────────────────────────────────────────────────────────────

  describe("responsive", () => {
    it("[as-built] shows the marketing view — no login form — below 761px", () => {
      // components/login/login.tsx: DesktopLogin is mq761:hidden and
      // MobileLogin is hidden mq761:block. The mobile copy contains NO sign-in
      // form — visitors on phones see branding only. This pins the behaviour
      // so a deliberate product change (or an accidental regression) is loud.
      cy.viewport(375, 667);
      cy.visit(Routes.login);
      cy.contains("All Your Care Operations. One Unified Platform.").should(
        "be.visible"
      );
      cy.get('input[name="email"]').should("not.be.visible");
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 9. End-to-end journeys — multi-step flows a real user takes
  // ────────────────────────────────────────────────────────────────────────

  describe("end to end", () => {
    beforeEach(() => {
      loginPage.visit();
    });

    it("E2E — login fails, the user corrects the credentials and succeeds", () => {
      cy.stubLoginFailure(401, "Invalid email or password");
      loginPage.signIn("wrong@assistly.com", VALID_PASSWORD);
      cy.wait("@loginRequest");
      loginPage.assertPopover("Invalid email or password");
      loginPage.dismissPopover();
      loginPage.signInButton.should("not.be.disabled");

      cy.stubLoginSuccess("PCHO");
      cy.stubHomeLookup(false);
      loginPage.signIn();
      cy.wait("@loginRequest");
      loginPage.assertPopover(loginPage.messages.loginSuccess);
      cy.location("pathname").should("eq", Routes.crm);
    });

    it("E2E — a validation error is corrected and the login then succeeds", () => {
      cy.interceptLoginApi();
      loginPage.signIn("not-an-email", VALID_PASSWORD);
      loginPage
        .fieldError("email")
        .should("contain.text", loginPage.messages.emailInvalid);
      cy.assertNoLoginRequest();

      cy.stubLoginSuccess("PCHO");
      cy.stubHomeLookup(false);
      loginPage.typeEmail(VALID_EMAIL).submit();
      cy.wait("@loginRequest");
      loginPage.assertPopover(loginPage.messages.loginSuccess);
    });

    it("E2E — user visits Forgot Password and comes back to Login", () => {
      cy.stubForgotPassword();
      loginPage.openForgotPassword();
      forgotPasswordPage.assertLoaded();

      forgotPasswordPage.backToLogin();
      loginPage.assertLoaded();
      loginPage.signInButton.should("be.visible");
    });
  });
});
