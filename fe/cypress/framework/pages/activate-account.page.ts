import { BasePage } from "./base.page";
import { Routes } from "../utils/routes";
import { buildMockIdToken, decodeMockJwt } from "../factories";

/**
 * Page object for /activate-account (components/activate-account.tsx +
 * components/login/desktop-login.tsx's ActivateAccount screen).
 *
 * TWO COPIES OF THE FORM, ALWAYS MOUNTED
 *   `mq761` is a MAX-width breakpoint, so:
 *     hidden mq761:flex → the inline form, only BELOW 762px
 *     mq761:hidden      → <DesktopLogin initialScreen="ACTIVATE_ACCOUNT" />
 *   Both render into the DOM at every viewport and one is display:none, so
 *   every getter filters `:visible` — `input[name="email"]` matches twice
 *   otherwise. Filtering to the displayed copy is also the honest thing to
 *   assert: it is the form the user can reach.
 *
 * THE EMAIL COMES FROM THE LINK, NOT THE USER
 *   `?token=<jwt>` is base64-decoded (never verified) and its `email` claim
 *   fills a read-only field. The <Form> is keyed on that decoded email
 *   (`key={decodedEmail || "empty"}`), so the moment the claim resolves React
 *   tears down the "empty"-keyed form and mounts a fresh one — typing before
 *   that settles is racing a remount. `visit()` therefore waits for the
 *   prefill when the token carries an email.
 *
 * Validation messages mirror activateAccountSchema in model/crm/user.model.ts.
 */
export class ActivateAccountPage extends BasePage {
  readonly path = Routes.activateAccount;

  readonly messages = {
    passwordTooShort: "Password should be at least 8 characters.",
    passwordComplexity:
      "Password must have uppercase, lowercase, number, and special character.",
    passwordMismatch: "Passwords do not match.",
    confirmRequired: "Please re-enter your new password",
    activated: "Account Activated Successfully!",
    alreadyLoggedIn: "User already logged in!",
    /** The unreachable fallback — see known-defects.cy.ts. */
    activationFallback: "Failed to activate account",
  } as const;

  // ── Elements (all :visible-filtered — see the class doc) ─────────────────

  get heading(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.contains("h2:visible", /Activate (Your )?Account/);
  }

  get emailInput(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get('input[name="email"]:visible');
  }

  get passwordInput(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get('input[name="password"]:visible');
  }

  get confirmInput(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get('input[name="confirmPassword"]:visible');
  }

  get submitButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get("button:visible").contains("Activate Account");
  }

  get backToLogin(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.contains("div:visible", "Back to login").last();
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  assertLoaded(): Cypress.Chainable {
    return this.heading.should("be.visible");
  }

  /**
   * Land on the activation screen.
   *   token: undefined → a fresh invite token for the default invite email
   *          null      → no query param (a visitor who found the bare route)
   *          string     → that exact token (malformed / no-email / custom)
   */
  visit(opts: { token?: string | null; viewport?: [number, number] } = {}): this {
    if (opts.viewport) cy.viewport(opts.viewport[0], opts.viewport[1]);
    const token = opts.token === undefined ? this.inviteToken() : opts.token;
    cy.visit(token ? `${this.path}?token=${token}` : this.path);
    this.assertLoaded();
    this.waitForPrefill(token);
    return this;
  }

  /**
   * Wait out the `key={decodedEmail}` remount when the token carries an email.
   * No-ops for tokens that cannot decode to an email claim — by design the
   * field never fills for those.
   */
  waitForPrefill(token: string | null): this {
    if (!token) return this;
    let email: unknown;
    try {
      email = decodeMockJwt(token)?.email;
    } catch {
      // Malformed token — by design the field never fills for those.
      return this;
    }
    if (typeof email === "string") {
      this.emailInput.should("have.value", email);
    }
    return this;
  }

  /** An activation link token carrying an email claim. */
  inviteToken(email = "newjoiner@assistly.com"): string {
    return buildMockIdToken("PCG", { email });
  }

  // ── User-level verbs ────────────────────────────────────────────────────

  /** Fill both password fields and press Activate Account. */
  activateWith(password: string, confirm = password): this {
    this.passwordInput.type(password);
    this.confirmInput.type(confirm);
    this.submitButton.click();
    return this;
  }
}

/** Shared instance — the page is stateless, so a singleton is safe. */
export const activateAccountPage = new ActivateAccountPage();
