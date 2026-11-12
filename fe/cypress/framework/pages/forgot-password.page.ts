import { BasePage } from "./base.page";
import { LOGIN_PATH } from "../constants";

/**
 * Page object for the password-reset sub-screens inside /login
 * (components/login/desktop-login.tsx -> ForgotPassword + OTP).
 *
 * `currentScreen` swaps the card's contents without a route change, so this
 * page's `path` is still /login and navigation in/out is via on-screen links.
 * Both reset screens live under the same `mq761:hidden` desktop subtree, so
 * all getters are scoped through `cy.desktopLogin()`.
 *
 * Flow: Forgot password? -> email + Send Email -> PUT /reset-password ->
 * OTP screen -> 6-digit code + new/confirm password -> PUT
 * /confirm-reset-password -> back to LOGIN.
 */
export class ForgotPasswordPage extends BasePage {
  readonly path = LOGIN_PATH;

  /** Copy owned by the reset flow — keep in sync with desktop-login.tsx. */
  readonly messages = {
    emailInvalid: "Invalid Email",
    otpSent: "Otp sent to email!",
    otpResent: "Otp resent!",
    otpIncomplete: "Enter 6 digit OTP",
    passwordMismatch: "Passwords does not match!",
    passwordChanged: "Password Changed Succesfully!",
    resetFailureFallback: "Failed to reset Password",
    newPasswordTooShort: "Password should be at least 8 characters.",
    newPasswordComplexity:
      "Password must have uppercase, lowercase, number, and special character.",
    newPasswordRequired: "New password is required",
  } as const;

  // ── Screen 1: email entry ───────────────────────────────────────────────

  get heading(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.desktopLogin().contains("Forgot Your Password?");
  }

  get subtitle(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy
      .desktopLogin()
      .contains("Provide your email to receive a password reset OTP");
  }

  get emailInput(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get('input[name="email"]');
  }

  get sendEmailButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.contains<HTMLElement>("button", "Send Email");
  }

  get backToLoginLink(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.desktopLogin().contains("Back to login");
  }

  fieldError(name: string) {
    return cy
      .get(`input[name="${name}"]`)
      .closest("div.self-stretch")
      .find('div[class*="text-[red]"]');
  }

  // ── Screen 2: OTP + new password ────────────────────────────────────────

  get otpHeading(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.desktopLogin().contains("Enter OTP & Reset Password");
  }

  /** The six ReactCodeInput digit boxes. */
  get otpInputs(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get(".custom-otp-input input");
  }

  get newPasswordInput(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get('input[name="newPassword"]');
  }

  get confirmPasswordInput(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get('input[name="confirmPassword"]');
  }

  get submitButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.contains<HTMLElement>("button", "Submit");
  }

  get resendOtpLink(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.desktopLogin().contains(/Resend/i);
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  assertLoaded(): Cypress.Chainable {
    return this.heading.should("be.visible");
  }

  // ── User-level verbs ────────────────────────────────────────────────────

  typeEmail(email: string): this {
    cy.typeField("email", email);
    return this;
  }

  submitEmail(): this {
    this.sendEmailButton.click();
    return this;
  }

  backToLogin(): this {
    this.backToLoginLink.click();
    return this;
  }

  /** Type the OTP one digit per box — mirrors how a user types the code. */
  typeOtp(otp: string): this {
    otp.split("").forEach((digit, i) => {
      this.otpInputs.eq(i).type(digit);
    });
    return this;
  }

  typeNewPassword(password: string): this {
    this.newPasswordInput.clear().type(password, { delay: 0 });
    return this;
  }

  typeConfirmPassword(password: string): this {
    this.confirmPasswordInput.clear().type(password, { delay: 0 });
    return this;
  }

  submitReset(): this {
    this.submitButton.click();
    return this;
  }

  resendOtp(): this {
    this.resendOtpLink.click();
    return this;
  }
}

export const forgotPasswordPage = new ForgotPasswordPage();
