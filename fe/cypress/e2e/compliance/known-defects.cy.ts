/// <reference types="cypress" />

/**
 * Compliance — known defects
 *
 * EVERY TEST IN THIS FILE FAILS ON PURPOSE, like its counterparts in the other
 * modules. Each asserts the behaviour the app SHOULD have against code that
 * does something else.
 *
 * A test here turning green means the bug is fixed: move it into
 * training-module.cy.ts rather than deleting it.
 *
 * WHAT IS IN HERE AND WHAT IS NOT
 *   Compliance carries 3 pinned findings. The third — Download Certificate
 *   staying disabled while the certificate is minted — is a loading state and
 *   arguably correct, so it stays an `[as-built]` pin.
 *
 *   The two below are silent data loss: a trainer selects several files, the
 *   screen shows one, and nothing tells them the rest were discarded.
 *
 *   npx cypress run --spec cypress/e2e/compliance/known-defects.cy.ts
 */

import { Tags } from "../../framework/utils/tags";
import { buildHome, buildUserWithDocuments } from "../../framework/module-commands";

const CREATE_MODULE = "/compliance/training/createModule";

const mp4File = {
  contents: Cypress.Buffer.from("fake mp4"),
  fileName: "induction.mp4",
  mimeType: "video/mp4",
};

const pptxFile = {
  contents: Cypress.Buffer.from("PK fake pptx"),
  fileName: "induction.pptx",
  mimeType:
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

const sel = {
  fileInput: () => cy.get("#fileInput"),
};

const visitCreateModule = () => {
  cy.clearAuthSession();
  cy.setAuthSession("PCHO");
  cy.stubHome(buildHome({ complianceTraining: [] }));
  cy.stubUsers();
  cy.intercept("GET", "**/v1/user/*", {
    statusCode: 200,
    body: { user: buildUserWithDocuments([]) },
  }).as("getUser");
  cy.intercept("POST", "/api/s3/list-objects", {
    statusCode: 200,
    body: { contents: [], commonPrefixes: [] },
  }).as("listObjects");
  cy.stubPresign();
  cy.visit(CREATE_MODULE);
  cy.contains("Create", { timeout: 10000 }).should("be.visible");
};

describe("Compliance known defects — the Create Module upload", { tags: [Tags.DEFECT, Tags.PCHO] }, () => {
  it("tells the trainer when it discards the extra videos", () => {
    // `if (file.type === "video/mp4" && !videoFile)` keeps the first video and
    // drops every later one without a word. The "only one video and one PPT"
    // warning underneath can never fire either, because `validFiles` is capped
    // at two by those same guards.
    //
    // Either keep them or say so — silently discarding a file the trainer
    // chose is the one option that should not happen.
    visitCreateModule();
    sel.fileInput().selectFile([mp4File, { ...mp4File, fileName: "second.mp4" }], {
      force: true,
    });
    // The component already has the right words for this — it just cannot
    // reach them, because `validFiles` is capped at two by the same guards
    // that discard the extras.
    cy.contains("You can upload only one video and one PPT file", {
      timeout: 10000,
    }).should("be.visible");
  });

  it("tells the trainer when it discards the extra decks", () => {
    visitCreateModule();
    sel.fileInput().selectFile([pptxFile, { ...pptxFile, fileName: "second.pptx" }], {
      force: true,
    });
    cy.contains("You can upload only one video and one PPT file", {
      timeout: 10000,
    }).should("be.visible");
  });
});
