/// <reference types="cypress" />

/**
 * Compliance — documents, training and certificates.
 *
 * The module has **no endpoints of its own**. Everything is stored on two
 * records the CRM already owns:
 *   - `home.complianceTraining` and `home.documents` — GET/PUT /v1/home/{id}
 *   - the signed-in user's `documents` and `completedComplianceModules` —
 *     GET/PUT /v1/user/{id}
 * so every spec here stubs those two and asserts on what the screens do with them.
 *
 * All three pages gate on `authorizedModules` including COMPLIANCE *and* on the
 * role's permissions, and the two produce different outcomes — Access Denied for
 * the module gate, a redirect for the role gate.
 */

import { Tags } from "../../framework/utils/tags";
import {
  buildCertificate,
  buildHome,
  buildTrainingModule,
  buildUserWithDocuments,
  TEST_HOME_ID,
  TEST_USER_ID,
} from "../../framework/module-commands";

const DOCUMENTS = "/compliance";
const TRAINING = "/compliance/training";
const CERTIFICATES = "/compliance/certificates";
const CREATE_MODULE = "/compliance/training/createModule";

describe("Compliance — Document Management", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  // ── Requests ───────────────────────────────────────────────────────────────

  describe("The home query", () => {
    it("GETs /v1/home/{id} — home documents live on the home record", () => {
      cy.visitComplianceAs(DOCUMENTS);
      cy.wait("@getHome");
    });

    it("authenticates with the session id token", () => {
      cy.visitComplianceAs(DOCUMENTS);
      cy.wait("@getHome");
      cy.assertAuthorized("@getHome");
    });

    it("requests the signed-in user's home, not an arbitrary one", () => {
      cy.visitComplianceAs(DOCUMENTS);
      cy.wait("@getHome").then((interception) => {
        expect(interception.request.url).to.include(TEST_HOME_ID);
      });
    });

    it("also reads the signed-in user record", () => {
      cy.visitComplianceAs(DOCUMENTS);
      cy.wait("@getUser");
      cy.assertAuthorized("@getUser");
    });
  });

  // ── Layout ─────────────────────────────────────────────────────────────────

  describe("The documents screen", () => {
    beforeEach(() => {
      cy.visitComplianceAs(DOCUMENTS);
      cy.wait("@getHome");
    });

    it("renders the page heading", () => {
      cy.contains("Document Management", { timeout: 10000 }).should("be.visible");
    });

    it("renders the Additional Documents section", () => {
      cy.contains("Additional Documents").should("be.visible");
    });

    it("offers the Add New Template action", () => {
      cy.contains("+ Add New Template").should("be.visible");
    });

    it("renders the statutory home document cards", () => {
      // utils/constants.ts → HOMEDOCUMENTS
      cy.contains("Fire Alarm Inspection Report").should("be.visible");
      cy.contains("State Permit").should("be.visible");
    });

    it("does not PUT anything on first paint", () => {
      cy.assertNoRequest("@updateUser");
    });
  });

  describe("For an In Home Care home", () => {
    it("renders the In-Home-Care document set instead", () => {
      cy.visitComplianceAs(DOCUMENTS, "PCHO", {
        home: buildHome({ homeType: "In Home Care" }),
      });
      cy.contains("Document Management", { timeout: 10000 }).should("be.visible");
      cy.contains("County Business License").should("be.visible");
    });
  });

  // ── Gating ─────────────────────────────────────────────────────────────────

  describe("Module entitlement", () => {
    it("shows Access Denied when the home has no COMPLIANCE licence", () => {
      cy.visitComplianceAs(DOCUMENTS, "PCHO", {
        home: buildHome({ authorizedModules: ["CRM", "CLINICAL", "REVOPS"] }),
      });
      cy.assertRestricted();
    });

    it("renders the documents when COMPLIANCE is licensed", () => {
      cy.visitComplianceAs(DOCUMENTS, "PCHO", {
        home: buildHome({ authorizedModules: ["COMPLIANCE"] }),
      });
      cy.contains("Document Management", { timeout: 10000 }).should("be.visible");
    });

    it("matches the module name case-insensitively via toUpperCase()", () => {
      // The page compares against `sidebarMenuItems.COMPLIANCE.toUpperCase()`.
      cy.visitComplianceAs(DOCUMENTS, "PCHO", {
        home: buildHome({ authorizedModules: ["COMPLIANCE"] }),
      });
      cy.contains("Access Denied").should("not.exist");
    });
  });

  describe("Role gating", () => {
    it("lets a PCHO manage home documents", () => {
      cy.visitComplianceAs(DOCUMENTS, "PCHO");
      cy.contains("Document Management", { timeout: 10000 }).should("be.visible");
    });

    it("lets a HomeAdmin manage home documents", { tags: [Tags.HOMEADMIN] }, () => {
      cy.visitComplianceAs(DOCUMENTS, "HomeAdmin");
      cy.contains("Document Management", { timeout: 10000 }).should("be.visible");
    });

    it("redirects a PCG to training — they cannot see home documents", { tags: [Tags.PCG] }, () => {
      cy.visitComplianceAs(DOCUMENTS, "PCG");
      cy.location("pathname", { timeout: 10000 }).should("eq", TRAINING);
    });

    it("redirects a PCGLead to training", () => {
      cy.visitComplianceAs(DOCUMENTS, "PCGLead");
      cy.location("pathname", { timeout: 10000 }).should("eq", TRAINING);
    });

    it("redirects a ComplianceGuest to training", () => {
      cy.visitComplianceAs(DOCUMENTS, "ComplianceGuest");
      cy.location("pathname", { timeout: 10000 }).should("eq", TRAINING);
    });

    it("redirects a Nurse to CRM — not to training", { tags: [Tags.NURSE] }, () => {
      cy.visitComplianceAs(DOCUMENTS, "Nurse");
      cy.location("pathname", { timeout: 10000 }).should("eq", "/crm");
    });
  });
});

// ─── Training ────────────────────────────────────────────────────────────────

describe("Compliance — Training", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  describe("The training screen", () => {
    beforeEach(() => {
      cy.visitComplianceAs(TRAINING, "PCHO", {
        home: buildHome({ complianceTraining: [buildTrainingModule()] }),
      });
      cy.wait("@getHome");
    });

    it("renders the page heading", () => {
      cy.contains("Training Module", { timeout: 10000 }).should("be.visible");
    });

    it("renders the home's uploaded module", () => {
      cy.contains("Fire Safety", { timeout: 10000 }).should("be.visible");
    });

    it("shows a module count", () => {
      cy.contains(/\d+ Training Modules/, { timeout: 10000 }).should("be.visible");
    });

    it("marks an uncompleted module as Pending", () => {
      cy.contains("Pending", { timeout: 10000 }).should("be.visible");
    });
  });

  describe("Completion state", () => {
    it("marks a module the user has completed as Certified", () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome(buildHome({ complianceTraining: [buildTrainingModule()] }));
      cy.stubUsers();
      cy.intercept("GET", "**/v1/user/*", {
        statusCode: 200,
        body: {
          user: {
            ...buildUserWithDocuments(),
            completedComplianceModules: ["module-fire-safety"],
          },
        },
      }).as("getUser");
      cy.visit(TRAINING);

      cy.contains("Certified", { timeout: 10000 }).should("be.visible");
    });
  });

  describe("Module filtering", () => {
    /**
     * The screen filters each module's documents down to
     * `ComplianceTrainingAllowedTypes` (.mp4/.ppt/.pptx) and then drops any
     * module left with none — so a module whose only asset is a PDF vanishes
     * entirely rather than rendering empty.
     */
    it("hides a module whose documents are all of an unsupported type", () => {
      cy.visitComplianceAs(TRAINING, "PCHO", {
        home: buildHome({
          complianceTraining: [
            buildTrainingModule({
              moduleName: "PDF Only Module",
              documents: [
                {
                  documentId: "pdf-1",
                  documentName: "handbook",
                  documentType: ".pdf",
                  documentUrl: "https://bucket.s3.amazonaws.com/handbook.pdf",
                },
              ],
            }),
          ],
        }),
      });

      cy.contains("Training Module", { timeout: 10000 }).should("be.visible");
      cy.contains("PDF Only Module").should("not.exist");
    });

    it("keeps a module that has a .pptx deck", () => {
      cy.visitComplianceAs(TRAINING, "PCHO", {
        home: buildHome({
          complianceTraining: [
            buildTrainingModule({
              moduleName: "Slides Module",
              documents: [
                {
                  documentId: "ppt-1",
                  documentName: "Slides Module_deck",
                  documentType: ".pptx",
                  documentUrl: "https://bucket.s3.amazonaws.com/deck.pptx",
                },
              ],
            }),
          ],
        }),
      });

      cy.contains("Slides Module", { timeout: 10000 }).should("be.visible");
    });

    it("renders the screen when the home has no modules at all", () => {
      cy.visitComplianceAs(TRAINING, "PCHO", {
        home: buildHome({ complianceTraining: [] }),
      });
      cy.contains("Training Module", { timeout: 10000 }).should("be.visible");
    });
  });

  describe("Creating a module", () => {
    it("offers Create New Module to a PCHO", () => {
      cy.visitComplianceAs(TRAINING, "PCHO");
      cy.contains("+ Create New Module", { timeout: 10000 }).should("be.visible");
    });

    it("navigates to the create form", () => {
      cy.visitComplianceAs(TRAINING, "PCHO");
      cy.contains("+ Create New Module", { timeout: 10000 }).click();
      cy.location("pathname", { timeout: 10000 }).should("eq", CREATE_MODULE);
    });

    /**
     * CREATE_COMPLIANCE_TRAINING is held by PCHO and HomeAdmin only —
     * `<ProtectedComponent>` renders nothing for anyone else.
     */
    it("hides Create New Module from a PCG", { tags: [Tags.PCG] }, () => {
      cy.visitComplianceAs(TRAINING, "PCG");
      cy.contains("Training Module", { timeout: 10000 }).should("be.visible");
      cy.contains("+ Create New Module").should("not.exist");
    });

    it("hides Create New Module from a ComplianceGuest", () => {
      cy.visitComplianceAs(TRAINING, "ComplianceGuest");
      cy.contains("Training Module", { timeout: 10000 }).should("be.visible");
      cy.contains("+ Create New Module").should("not.exist");
    });

    it("does not PUT the home until a module is actually saved", () => {
      cy.stubPut("/v1/home", "updateHome");
      cy.visitComplianceAs(CREATE_MODULE, "PCHO");
      cy.contains("Access Denied").should("not.exist");
      cy.assertNoRequest("@updateHome");
    });
  });

  describe("Gating", () => {
    it("shows Access Denied when the home has no COMPLIANCE licence", () => {
      cy.visitComplianceAs(TRAINING, "PCHO", {
        home: buildHome({ authorizedModules: ["CRM"] }),
      });
      cy.assertRestricted();
    });

    /**
     * Training gates on COMPLIANCE at VIEW, which is a much wider set than the
     * documents page's COMPLIANCE_DOCUMENTS at EDIT — a caregiver, a care lead
     * and an external auditor all reach training.
     */
    it("lets a PCG reach training", { tags: [Tags.PCG] }, () => {
      cy.visitComplianceAs(TRAINING, "PCG");
      cy.contains("Training Module", { timeout: 10000 }).should("be.visible");
    });

    it("lets a ComplianceGuest reach training", () => {
      cy.visitComplianceAs(TRAINING, "ComplianceGuest");
      cy.contains("Training Module", { timeout: 10000 }).should("be.visible");
    });

    it("lets a PCGLead reach training", () => {
      cy.visitComplianceAs(TRAINING, "PCGLead");
      cy.contains("Training Module", { timeout: 10000 }).should("be.visible");
    });

    it("redirects a Nurse to CRM", { tags: [Tags.NURSE] }, () => {
      cy.visitComplianceAs(TRAINING, "Nurse");
      cy.location("pathname", { timeout: 10000 }).should("eq", "/crm");
    });

    it("redirects a Lead to CRM", () => {
      cy.visitComplianceAs(TRAINING, "Lead");
      cy.location("pathname", { timeout: 10000 }).should("eq", "/crm");
    });
  });
});

// ─── Certificates ────────────────────────────────────────────────────────────

describe("Compliance — Certificates", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  describe("With no certificates", { tags: [Tags.PCG] }, () => {
    beforeEach(() => {
      cy.visitComplianceAs(CERTIFICATES, "PCG", { documents: [] });
    });

    it("prompts the user to complete training", () => {
      cy.contains("Get certificates by completing Training.", { timeout: 10000 }).should(
        "be.visible"
      );
    });

    it("reads the signed-in user record", () => {
      cy.wait("@getUser");
      cy.assertAuthorized("@getUser");
    });

    it("requests the signed-in user, not an arbitrary one", () => {
      cy.wait("@getUser").then((interception) => {
        expect(interception.request.url).to.include(TEST_USER_ID);
      });
    });

    it("does not PUT the user back when there is nothing to dedupe", () => {
      cy.contains("Get certificates by completing Training.", { timeout: 10000 }).should(
        "be.visible"
      );
      cy.assertNoRequest("@updateUser");
    });
  });

  describe("With certificates", () => {
    it("renders the certificate card", { tags: [Tags.PCG] }, () => {
      cy.visitComplianceAs(CERTIFICATES, "PCG", { documents: [buildCertificate()] });
      cy.contains("Fire Safety Certificate", { timeout: 10000 }).should("be.visible");
    });

    it("does not show the empty-state prompt", { tags: [Tags.PCG] }, () => {
      cy.visitComplianceAs(CERTIFICATES, "PCG", { documents: [buildCertificate()] });
      cy.contains("Fire Safety Certificate", { timeout: 10000 }).should("be.visible");
      cy.contains("Get certificates by completing Training.").should("not.exist");
    });

    it("ignores documents that are not certificates", { tags: [Tags.PCG] }, () => {
      cy.visitComplianceAs(CERTIFICATES, "PCG", {
        documents: [
          buildCertificate(),
          buildCertificate({
            documentId: "dl-1",
            documentName: "Driving Licence",
            documentCategory: "onboarding",
          }),
        ],
      });

      cy.contains("Fire Safety Certificate", { timeout: 10000 }).should("be.visible");
      cy.contains("Driving Licence").should("not.exist");
    });

    /**
     * The page dedupes by `documentUrl` before rendering — the same certificate
     * issued twice must appear once. It then PUTs the deduped record back, which
     * is the only write this screen makes.
     */
    it("renders a duplicated certificate only once", { tags: [Tags.PCG] }, () => {
      cy.visitComplianceAs(CERTIFICATES, "PCG", {
        documents: [
          // Same documentUrl, different documentId — the dedupe key is the URL.
          buildCertificate(),
          buildCertificate({ documentId: "cert-duplicate" }),
        ],
      });

      // One iframe per rendered DocumentCard.
      cy.get('iframe[title="Fire Safety Certificate"]', { timeout: 10000 }).should(
        "have.length",
        1
      );
    });

    it("renders two certificates with different URLs as two cards", { tags: [Tags.PCG] }, () => {
      cy.visitComplianceAs(CERTIFICATES, "PCG", {
        documents: [
          buildCertificate(),
          buildCertificate({
            documentId: "cert-hygiene",
            documentName: "Hand Hygiene Certificate",
            documentUrl: "https://bucket.s3.amazonaws.com/certs/hand-hygiene.pdf",
          }),
        ],
      });

      cy.contains("Fire Safety Certificate", { timeout: 10000 }).should("be.visible");
      cy.contains("Hand Hygiene Certificate").should("be.visible");
    });

    it("presigns the certificate before rendering its card", { tags: [Tags.PCG] }, () => {
      cy.visitComplianceAs(CERTIFICATES, "PCG", { documents: [buildCertificate()] });
      cy.wait("@presign", { timeout: 15000 });
      cy.contains("Fire Safety Certificate", { timeout: 10000 }).should("be.visible");
    });

    /**
     * Pinned: `DocumentCard` returns `null` without a presigned URL, and the
     * empty-state prompt only renders when there are *no* certificates at all —
     * so a presign failure leaves the page completely blank. The user is told
     * neither that they have certificates nor that something went wrong.
     */
    it("renders nothing at all — not even an error — when the presign fails", { tags: [Tags.PCG] }, () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCG");
      cy.stubHome();
      cy.stubUsers();
      cy.stubUser(buildUserWithDocuments([buildCertificate()]));
      cy.stubPut("/v1/user", "updateUser");
      cy.intercept("POST", "/api/s3/presign-get", { statusCode: 500, body: {} }).as("presign");
      cy.intercept("GET", "**/v1/s3-pre-signed-url*", { statusCode: 500, body: {} }).as(
        "presignLegacy"
      );
      cy.visit(CERTIFICATES);

      cy.contains("Fire Safety Certificate").should("not.exist");
      cy.contains("Get certificates by completing Training.").should("not.exist");
    });

    it("writes the deduped document list back to the user record", { tags: [Tags.PCG] }, () => {
      cy.visitComplianceAs(CERTIFICATES, "PCG", { documents: [buildCertificate()] });
      cy.wait("@updateUser", { timeout: 15000 });
      cy.assertAuthorized("@updateUser");
    });

    it("keeps non-certificate documents in the record it writes back", { tags: [Tags.PCG] }, () => {
      cy.visitComplianceAs(CERTIFICATES, "PCG", {
        documents: [
          buildCertificate(),
          buildCertificate({
            documentId: "dl-1",
            documentName: "Driving Licence",
            documentCategory: "onboarding",
            documentUrl: "https://bucket.s3.amazonaws.com/dl.pdf",
          }),
        ],
      });

      cy.wait("@updateUser", { timeout: 15000 }).then((interception) => {
        const names = (interception.request.body.documents ?? []).map(
          (d: any) => d.documentName
        );
        expect(names).to.include("Driving Licence");
      });
    });
  });

  describe("Gating", () => {
    it("shows Access Denied when the home has no COMPLIANCE licence", { tags: [Tags.PCG] }, () => {
      cy.visitComplianceAs(CERTIFICATES, "PCG", {
        home: buildHome({ authorizedModules: ["CRM"] }),
      });
      cy.assertRestricted();
    });

    it("lets a PCHO view their certificates", () => {
      cy.visitComplianceAs(CERTIFICATES, "PCHO", { documents: [] });
      cy.contains("Get certificates by completing Training.", { timeout: 10000 }).should(
        "be.visible"
      );
    });

    it("lets a ComplianceGuest view their certificates", () => {
      cy.visitComplianceAs(CERTIFICATES, "ComplianceGuest", { documents: [] });
      cy.contains("Get certificates by completing Training.", { timeout: 10000 }).should(
        "be.visible"
      );
    });

    it("redirects a Nurse to CRM", { tags: [Tags.NURSE] }, () => {
      cy.visitComplianceAs(CERTIFICATES, "Nurse");
      cy.location("pathname", { timeout: 10000 }).should("eq", "/crm");
    });
  });
});

// ─── Cross-cutting ───────────────────────────────────────────────────────────

describe("Compliance — session and error handling", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  it("does not stay on a compliance page without a session", () => {
    cy.stubHome();
    cy.visit(TRAINING);
    cy.location("pathname", { timeout: 10000 }).should("not.eq", TRAINING);
  });

  it("falls back to every module when the home request fails", () => {
    cy.setAuthSession("PCHO");
    cy.intercept("GET", "**/v1/home/**", { statusCode: 500, body: { error: "boom" } }).as(
      "getHome"
    );
    cy.stubUsers();
    cy.stubUser(buildUserWithDocuments());
    cy.visit(TRAINING);

    // `useAuthorizedModules` defaults to accessAllModules on a failed fetch, so
    // the licence gate opens rather than closing.
    cy.contains("Access Denied").should("not.exist");
  });

  it("renders the training screen when the user record fails to load", () => {
    cy.setAuthSession("PCHO");
    cy.stubHome(buildHome({ complianceTraining: [buildTrainingModule()] }));
    cy.stubUsers();
    cy.intercept("GET", "**/v1/user/*", { statusCode: 500, body: { error: "boom" } }).as(
      "getUser"
    );
    cy.visit(TRAINING);

    cy.contains("Access Denied").should("not.exist");
  });

  it("sends the token from the current session on the home read", () => {
    cy.visitComplianceAs(DOCUMENTS);
    cy.wait("@getHome");
    cy.getCookie("idToken").then((cookie) => {
      cy.get("@getHome").then((interception: any) => {
        expect(interception.request.headers.authorization).to.eq(`Bearer ${cookie?.value}`);
      });
    });
  });
});
