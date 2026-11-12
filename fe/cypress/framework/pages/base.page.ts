/**
 * BasePage — the contract every page object fulfils.
 *
 * A page object owns exactly three things:
 *   1. `path`            — where it lives, for direct navigation
 *   2. element getters   — lazy `get` accessors, never cached elements
 *   3. user-level verbs  — what a person does on the page, not which pixels
 *
 * A page object NEVER owns assertions about other pages' content — a spec
 * composes pages; it does not let them leak.
 *
 * Getters return Cypress chains (not jQuery), so they re-query on every use
 * and survive the app's re-renders.
 */
export abstract class BasePage {
  /** Route relative to baseUrl. Concrete pages must set it. */
  abstract readonly path: string;

  /** Navigate directly to this page. */
  visit(): this {
    cy.visit(this.path);
    return this;
  }

  /** Wait until the page has rendered its primary content. Override per page. */
  abstract assertLoaded(): Cypress.Chainable;

  /** Current browser path (assert against `path` or a redirect target). */
  assertUrl(expected: string | RegExp): this {
    cy.location("pathname").should(
      typeof expected === "string" ? "eq" : "match",
      expected as any
    );
    return this;
  }

  /** First element matching a data-testid, scoped or global. */
  el(testId: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.byTestId(testId);
  }

  /**
   * The exception popover renders into a body-level portal (#popover-portal).
   * These helpers are app-global, so they live on the base page.
   */
  assertPopover(text: string): this {
    cy.assertPopover(text);
    return this;
  }

  dismissPopover(): this {
    cy.dismissPopover();
    return this;
  }
}
