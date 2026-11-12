/// <reference types="cypress" />

/**
 * UI interaction commands — the selector strategy and shared DOM helpers.
 *
 * Selector precedence (see cypress/README.md):
 *   1. [data-testid]        — stable contract, ask devs to add it
 *   2. semantic selectors   — role/label/placeholder/text
 *   3. structural selectors — last resort, scope them tight
 */

import { LOGIN_PATH } from "../constants";

declare global {
  namespace Cypress {
    interface Chainable {
      /** `cy.byTestId("sign-in")` -> `cy.get('[data-testid="sign-in"]')` */
      byTestId(testId: string): Chainable<JQuery<HTMLElement>>;

      /** Visit /login and wait for the desktop login card to render. */
      visitLoginPage(): Chainable<void>;

      /**
       * Clear and retype an input by `name`. Each step re-queries the field:
       * commonComponents/form.tsx remounts the whole `<form>` on mount (its
       * `key` is bumped by a useEffect), which detaches chained subjects.
       */
      typeField(name: string, value: string): Chainable<void>;

      /** Type email + password into the login form (clearing any prior value). */
      fillLoginForm(email: string, password: string): Chainable<void>;

      /** Scope queries to the desktop login markup (mobile markup is in the DOM too). */
      desktopLogin(): Chainable<JQuery<HTMLElement>>;

      /** Assert the exception popover (rendered in a body portal) shows `text`. */
      assertPopover(text: string): Chainable<void>;

      /**
       * Dismiss the popover by clicking its backdrop. Error popovers never
       * auto-close and their overlay covers the viewport, so the form is
       * unusable until the user clicks away — mirror that in tests.
       */
      dismissPopover(): Chainable<void>;
    }
  }
}

Cypress.Commands.add("byTestId", (testId: string) =>
  cy.get(`[data-testid="${testId}"]`)
);

Cypress.Commands.add("visitLoginPage", () => {
  cy.visit(LOGIN_PATH);
  cy.get('input[name="email"]').should("be.visible");
});

Cypress.Commands.add("typeField", (name: string, value: string) => {
  const field = () => cy.get(`input[name="${name}"]`);
  field().clear();
  // Re-query rather than chaining: the form subtree can remount between actions.
  if (value !== "") field().type(value, { delay: 0 });
});

Cypress.Commands.add("fillLoginForm", (email: string, password: string) => {
  cy.typeField("email", email);
  cy.typeField("password", password);
});

Cypress.Commands.add("desktopLogin", () =>
  // components/login/login.tsx renders both DesktopLogin and MobileLogin;
  // the mobile copy stays in the DOM (display:none) at desktop viewports.
  cy.get('div[class*="mq761:hidden"]').first()
);

Cypress.Commands.add("assertPopover", (text: string) => {
  cy.get("#popover-portal", { timeout: 10000 }).should("contain.text", text);
});

Cypress.Commands.add("dismissPopover", () => {
  // #popover-portal itself is pointer-events:none; its backdrop child is
  // clickable. Clicking outside the popover card triggers handleClickOutside.
  cy.get("#popover-portal div.fixed.inset-0").click("bottomRight");
  cy.get("#popover-portal").should("be.empty");
});
