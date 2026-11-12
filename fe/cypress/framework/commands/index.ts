/**
 * Custom-command registry. One file per domain, each declaring its own
 * Cypress.Chainable types next to the implementation — add a new domain as a
 * sibling file and import it here.
 */

import "./auth.commands";
import "./network.commands";
import "./ui.commands";
import "./module.commands";

// Re-export so the ported module specs' `import ... from "../../framework/commands"`
// resolves builders/constants through this directory's index.
export * from "../factories";
export * from "../constants";
