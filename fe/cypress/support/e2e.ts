// ***********************************************************
// Support entry — loaded automatically before every spec file.
//
// Order matters: @cypress/grep must register before the reporter hooks, and
// both before the command layer so `cy.*` exists when specs evaluate.
// ***********************************************************

import { register as registerCypressGrep } from "@cypress/grep";
import "cypress-mochawesome-reporter/register";
import "../framework/commands";

registerCypressGrep();

/**
 * Demo slow-motion.
 *
 * Cypress has no built-in slowMo, so each interactive command is wrapped with
 * a pause in front of it. Off by default — `slowMo` is 0 unless asked for, and
 * the wrapping is skipped entirely, so normal and CI runs are untouched:
 *
 *   npx cypress run  --env slowMo=400 --spec cypress/e2e/auth/login.cy.ts
 *   npx cypress open --env slowMo=400
 *
 * 300-500ms reads well for an audience.
 *
 * The pause goes *after* the command, not before. Delaying beforehand was
 * tried first and broke tests: the subject is queried, then the app re-renders
 * during the pause, and the command acts on an element that has since been
 * detached. Letting the command run and pausing on the way out leaves every
 * subject fresh, and the next command re-queries anyway.
 *
 * Only commands a viewer can actually see are wrapped. Assertions, `cy.wait`
 * and the query commands are left alone: slowing those multiplies the pause
 * by every retry attempt.
 */
const slowMo = Number(Cypress.env("slowMo") ?? 0);

if (slowMo > 0) {
  const visibleCommands = [
    "visit",
    "click",
    "dblclick",
    "type",
    "clear",
    "check",
    "uncheck",
    "select",
    "selectFile",
    "scrollIntoView",
  ] as const;

  visibleCommands.forEach((name) => {
    Cypress.Commands.overwrite(name as any, (originalFn: any, ...args: any[]) => {
      const result = originalFn(...args);
      return new Cypress.Promise((resolve) =>
        setTimeout(() => resolve(result), slowMo)
      );
    });
  });
}

/**
 * The app renders authenticated pages (dashboard, navmain) after a successful
 * login redirect, and those pages fire real requests that are not part of the
 * contract under test. Their failures must not fail the spec.
 *
 * Failures of the flow under test are asserted explicitly in the specs.
 */
Cypress.on("uncaught:exception", () => false);

/**
 * Hide the Next.js dev overlay.
 *
 * `next dev` opens a full-screen error dialog (rendered into a
 * `<nextjs-portal>` custom element) whenever the app logs to `console.error` —
 * which several services do on purpose in their catch blocks
 * (services/create.ts, services/getById.ts). Its backdrop covers the page, so
 * Cypress refuses to click or type on anything underneath and error-path tests
 * fail on a dev-server artifact rather than on app behaviour.
 *
 * Removing the element is not enough: React re-mounts it. A stylesheet keeps
 * it hidden for the life of the page. Production builds never render it at all.
 */
Cypress.on("window:load", (win) => {
  const style = win.document.createElement("style");
  style.setAttribute("data-cypress-hide-dev-overlay", "true");
  style.textContent = "nextjs-portal { display: none !important; }";
  win.document.head.appendChild(style);
});
