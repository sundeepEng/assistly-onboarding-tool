import { BasePage } from "./base.page";

/**
 * Shell shared by every authenticated page — top nav, user menu, module
 * switcher (components/nav.tsx, components/navmain.tsx).
 *
 * Module page objects extend this so a spec writes
 * `seniorsBoard.logout().assertUrl("/login")` rather than re-owning chrome.
 * It is not itself visitable; `path` is a sentinel.
 */
export abstract class AuthenticatedPage extends BasePage {
  // ── Chrome elements ─────────────────────────────────────────────────────

  /** The avatar that opens the user menu (alt="Profile" in components/nav.tsx). */
  get userMenuTrigger(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get('img[alt="Profile"]');
  }

  get userMenu(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.contains("div", "Logout").parent();
  }

  /** "Are you sure you want to logout ?" confirmation dialog. */
  get logoutConfirmModal(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.contains<HTMLElement>("Are you sure you want to logout ?");
  }

  // ── User-level verbs ────────────────────────────────────────────────────

  openUserMenu(): this {
    this.userMenuTrigger.click();
    cy.contains("div", "Logout").should("be.visible");
    return this;
  }

  /**
   * Sign out through the UI: user menu -> Logout -> Confirm.
   * The app clears all auth cookies, routes to /login and shows a
   * "Logging out!" popover (components/nav.tsx handleOptionClick).
   */
  logout(): this {
    this.openUserMenu();
    cy.contains("div", "Logout").click();
    this.logoutConfirmModal.should("be.visible");
    cy.contains("button", "Confirm").click();
    return this;
  }
}
