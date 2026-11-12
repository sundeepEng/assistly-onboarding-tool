import { BasePage } from "./base.page";
import { LOGIN_PATH } from "../constants";

/**
 * Page object for /login (components/login/desktop-login.tsx).
 *
 * Both DesktopLogin and MobileLogin are always in the DOM — the mobile copy
 * is display:none above 761px — so every getter is scoped through
 * `cy.desktopLogin()` (the `mq761:hidden` subtree).
 *
 * Validation messages come from `loginSchema` in model/crm/user.model.ts —
 * keep `LoginPage.messages` in sync with it, and prefer asserting those
 * constants over re-typing strings into specs.
 */
export class LoginPage extends BasePage {
  readonly path = LOGIN_PATH;

  /** Validation + toast copy owned by the login flow. */
  readonly messages = {
    untouchedRequired: "Required",
    emailRequired: "Email is required",
    emailInvalid: "Please enter a valid email address",
    passwordRequired: "Password is required!",
    passwordTooShort: "Password must be at least 8 characters",
    passwordComplexity:
      "Password should be of minimum length 8 characters with atleast one uppercase, one lowercase, one number, one special character",
    loginSuccess: "Login Successful!",
    signinFallbackError: "Failed to Signin",
    alreadyLoggedIn: "User already logged in!",
  } as const;

  // ── Elements ────────────────────────────────────────────────────────────

  get root(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.desktopLogin();
  }

  get logo(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.root.find('img[alt="Assistly"]');
  }

  get heading(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.root.contains<HTMLElement>("h1", "Login");
  }

  get emailInput(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get('input[name="email"]');
  }

  get passwordInput(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get('input[name="password"]');
  }

  /** The show/hide control sits next to the input inside the bordered wrapper. */
  get passwordToggle(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.passwordInput.parent().find<HTMLElement>("button");
  }

  get signInButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.contains<HTMLElement>("button", "Sign in");
  }

  get forgotPasswordLink(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.contains<HTMLElement>("Forgot password?");
  }

  /** "Access your assistly account securely." under the heading. */
  get subtitle(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.root.contains("Access your assistly account securely.");
  }

  /** Top-nav link in the marketing header (Home, Products, …). */
  navLink(label: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.root.contains<HTMLElement>("a", label);
  }

  /** The label text rendered above a field — a leaf div, not a <label>. */
  fieldLabel(text: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.root
      .find("div")
      .filter((_i, el) => el.childElementCount === 0 && el.textContent?.trim() === text);
  }

  /** Field-level error rendered by FormInputFieldComponent below the input. */
  fieldError(name: "email" | "password" | "confirmPassword") {
    return cy
      .get(`input[name="${name}"]`)
      .closest("div.self-stretch")
      .find('div[class*="text-[red]"]');
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  visit(): this {
    super.visit();
    this.emailInput.should("be.visible");
    return this;
  }

  assertLoaded(): Cypress.Chainable {
    return this.heading.should("be.visible");
  }

  // ── User-level verbs ────────────────────────────────────────────────────

  typeEmail(email: string): this {
    cy.typeField("email", email);
    return this;
  }

  typePassword(password: string): this {
    cy.typeField("password", password);
    return this;
  }

  fillForm(email: string, password: string): this {
    cy.fillLoginForm(email, password);
    return this;
  }

  submit(): this {
    this.signInButton.click();
    return this;
  }

  togglePasswordVisibility(): this {
    this.passwordToggle.click();
    return this;
  }

  openForgotPassword(): this {
    this.forgotPasswordLink.click();
    return this;
  }

  /**
   * Submit credentials as the configured test user. Pair with
   * `cy.stubLoginSuccess()` / `cy.interceptLoginApi()` before calling — the
   * method deliberately does not stub so a spec controls the response.
   */
  signIn(
    email: string = Cypress.env("TEST_USER_EMAIL"),
    password: string = Cypress.env("TEST_USER_PASSWORD")
  ): this {
    return this.fillForm(email, password).submit();
  }
}

/** Shared instance — the page is stateless, so a singleton is safe. */
export const loginPage = new LoginPage();
