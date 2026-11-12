/**
 * Forgot Password — full reset flow coverage.
 *
 * Route: /login (in-place screen switch: LOGIN -> FORGOT_PASSWORD ->
 * OTP_RESET_PASSWORD -> LOGIN; components/login/desktop-login.tsx)
 *
 * Sections:
 *   1. Screen navigation       — in and back out
 *   2. Email validation        — forgotPasswordSchema (email only, "Invalid Email")
 *   3. OTP request contract    — PUT /reset-password, trimmed+lowercased email
 *   4. OTP & reset screen      — code length gate, password match gate, schema
 *   5. Reset request contract  — PUT /confirm-reset-password payload
 *   6. Resend OTP              — second /reset-password call
 */

import { loginPage } from "../../framework/pages/login.page";
import { forgotPasswordPage } from "../../framework/pages/forgot-password.page";
import { Routes } from "../../framework/utils/routes";
import { Tags } from "../../framework/utils/tags";
import loginData from "../../fixtures/login.json";

const VALID_EMAIL = Cypress.env("TEST_USER_EMAIL") as string;
const NEW_PASSWORD = "NewPass@123";
const OTP = "123456";

describe("Forgot Password", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
    loginPage.visit();
    loginPage.openForgotPassword();
  });

  // ────────────────────────────────────────────────────────────────────────
  // 1. Screen navigation
  // ────────────────────────────────────────────────────────────────────────

  describe("navigation", () => {
    it(
      "opens the Forgot Password screen from the login card",
      { tags: [Tags.SANITY] },
      () => {
      forgotPasswordPage.assertLoaded();
      forgotPasswordPage.subtitle.should("be.visible");
      forgotPasswordPage.emailInput.should("be.visible");
      forgotPasswordPage.sendEmailButton.should("be.visible");
      // The route never changes — the card swaps screens in place.
      cy.location("pathname").should("eq", Routes.login);
    });

    it("returns to the login screen via 'Back to login'", () => {
      forgotPasswordPage.backToLogin();
      loginPage.assertLoaded();
      loginPage.signInButton.should("be.visible");
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 2. Email validation
  // ────────────────────────────────────────────────────────────────────────

  describe("email validation", () => {
    it("blocks an empty submission — no reset request", () => {
      cy.intercept("PUT", "**/reset-password").as("forgotPasswordRequest");
      forgotPasswordPage.submitEmail();
      forgotPasswordPage.fieldError("email").should("not.be.empty");
      cy.get("@forgotPasswordRequest.all").should("have.length", 0);
    });

    it("rejects a malformed email — no reset request", () => {
      cy.intercept("PUT", "**/reset-password").as("forgotPasswordRequest");
      forgotPasswordPage.typeEmail(loginData.invalid.malformedEmail).submitEmail();
      forgotPasswordPage
        .fieldError("email")
        .should("contain.text", forgotPasswordPage.messages.emailInvalid);
      cy.get("@forgotPasswordRequest.all").should("have.length", 0);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 3. OTP request contract
  // ────────────────────────────────────────────────────────────────────────

  describe("OTP request", () => {
    it(
      "PUTs the email to /reset-password and advances to the OTP screen",
      { tags: [Tags.SANITY] },
      () => {
      cy.stubForgotPassword(200);
      forgotPasswordPage.typeEmail(VALID_EMAIL).submitEmail();

      cy.wait("@forgotPasswordRequest").then(({ request }) => {
        expect(request.method).to.eq("PUT");
        expect(request.url).to.include("/reset-password");
        expect(request.body).to.deep.eq({ email: VALID_EMAIL });
      });
      cy.assertPopover(forgotPasswordPage.messages.otpSent);
      forgotPasswordPage.otpHeading.should("be.visible");
    });

    it("normalizes uppercase email before the reset request", () => {
      // Same handler convention as sign-in: trim().toLowerCase() pre-flight.
      cy.stubForgotPassword(200);
      forgotPasswordPage
        .typeEmail("TESTINGDEVS@YOPMAIL.COM")
        .submitEmail();

      cy.wait("@forgotPasswordRequest").then(({ request }) => {
        expect(request.body.email).to.eq("testingdevs@yopmail.com");
      });
    });

    it("surfaces the API error and stays on the email screen", () => {
      cy.stubForgotPassword(404, { error: "Email not found" });
      forgotPasswordPage.typeEmail(VALID_EMAIL).submitEmail();

      cy.assertPopover("Email not found");
      forgotPasswordPage.heading.should("be.visible");
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 4. OTP & new-password screen
  // ────────────────────────────────────────────────────────────────────────

  describe("OTP & reset screen", () => {
    beforeEach(() => {
      // Land on the OTP screen with the request already answered.
      cy.stubForgotPassword(200);
      forgotPasswordPage.typeEmail(VALID_EMAIL).submitEmail();
      cy.wait("@forgotPasswordRequest");
      forgotPasswordPage.dismissPopover();
      forgotPasswordPage.otpHeading.should("be.visible");
    });

    it("renders six OTP boxes and both password fields", () => {
      forgotPasswordPage.otpInputs.should("have.length", 6);
      forgotPasswordPage.newPasswordInput.should("be.visible");
      forgotPasswordPage.confirmPasswordInput.should("be.visible");
    });

    it(
      "blocks submit when the OTP is incomplete — no request",
      { tags: [Tags.SANITY] },
      () => {
      cy.stubConfirmResetPassword(200);
      forgotPasswordPage
        .typeOtp("123")
        .typeNewPassword(NEW_PASSWORD)
        .typeConfirmPassword(NEW_PASSWORD)
        .submitReset();

      cy.assertPopover(forgotPasswordPage.messages.otpIncomplete);
      forgotPasswordPage.dismissPopover();
      cy.get("@confirmResetRequest.all").should("have.length", 0);
    });

    it("blocks submit when the passwords do not match — no request", () => {
      cy.stubConfirmResetPassword(200);
      forgotPasswordPage
        .typeOtp(OTP)
        .typeNewPassword(NEW_PASSWORD)
        .typeConfirmPassword("Different@123")
        .submitReset();

      cy.assertPopover(forgotPasswordPage.messages.passwordMismatch);
      forgotPasswordPage.dismissPopover();
      cy.get("@confirmResetRequest.all").should("have.length", 0);
    });

    it("blocks a weak new password via resetSchema", () => {
      cy.stubConfirmResetPassword(200);
      forgotPasswordPage
        .typeOtp(OTP)
        .typeNewPassword("weakpass")
        .typeConfirmPassword("weakpass")
        .submitReset();

      forgotPasswordPage
        .fieldError("newPassword")
        .should("contain.text", forgotPasswordPage.messages.newPasswordComplexity);
      cy.get("@confirmResetRequest.all").should("have.length", 0);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 5. Reset request contract + outcome
  // ────────────────────────────────────────────────────────────────────────

  describe("reset request", () => {
    beforeEach(() => {
      cy.stubForgotPassword(200);
      forgotPasswordPage.typeEmail(VALID_EMAIL).submitEmail();
      cy.wait("@forgotPasswordRequest");
      forgotPasswordPage.dismissPopover();
    });

    it(
      "PUTs email + newPassword + confirmationCode, then returns to login",
      { tags: [Tags.SANITY] },
      () => {
      cy.stubConfirmResetPassword(200);
      forgotPasswordPage
        .typeOtp(OTP)
        .typeNewPassword(NEW_PASSWORD)
        .typeConfirmPassword(NEW_PASSWORD)
        .submitReset();

      cy.wait("@confirmResetRequest").then(({ request }) => {
        expect(request.method).to.eq("PUT");
        expect(request.url).to.include("/confirm-reset-password");
        expect(request.body).to.deep.eq({
          email: VALID_EMAIL,
          newPassword: NEW_PASSWORD,
          confirmationCode: OTP,
        });
      });
      cy.assertPopover(forgotPasswordPage.messages.passwordChanged);
      loginPage.signInButton.should("be.visible");
    });

    it("shows the fallback message on a failed reset", () => {
      cy.stubConfirmResetPassword(400, {});
      forgotPasswordPage
        .typeOtp(OTP)
        .typeNewPassword(NEW_PASSWORD)
        .typeConfirmPassword(NEW_PASSWORD)
        .submitReset();

      cy.assertPopover(forgotPasswordPage.messages.resetFailureFallback);
      // User stays on the OTP screen to retry.
      forgotPasswordPage.otpHeading.should("be.visible");
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 6. Resend OTP
  // ────────────────────────────────────────────────────────────────────────

  describe("resend OTP", () => {
    it("re-fires PUT /reset-password and confirms with a popover", () => {
      cy.stubForgotPassword(200);
      forgotPasswordPage.typeEmail(VALID_EMAIL).submitEmail();
      cy.wait("@forgotPasswordRequest");
      forgotPasswordPage.dismissPopover();

      forgotPasswordPage.resendOtp();
      // Same endpoint, second call.
      cy.get("@forgotPasswordRequest.all").should("have.length", 2);
      cy.assertPopover(forgotPasswordPage.messages.otpResent);
    });
  });
});
