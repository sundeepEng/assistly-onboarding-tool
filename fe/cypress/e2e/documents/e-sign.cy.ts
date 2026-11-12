/**
 * E-Sign — the DocuSeal integration
 *
 *   components/documents/document-card-ui.tsx
 *   components/documents/docuseal-builder-modal.tsx
 *     E-Sign on a document card → POST /v1/docuseal/builder-token
 *     (name, documentUrls, externalId, roles) → <docuseal-builder token>
 *
 *   components/clinical/clinicalTabs/clinical-tabs.tsx
 *   components/documents/docuseal-form-modal.tsx
 *     Generate EMAR → E-Sign PDF → POST /v1/docuseal/create-submission
 *     ({pdfBase64, signerEmail}) → <docuseal-form data-src="…/s/{slug}">
 *
 * The DocuSeal widget itself is a third-party iframe driven by a CDN
 * script — unreachable territory. What belongs to the app is everything
 * around it: the request contracts, the modal lifecycle, and the error
 * paths. `@docuseal/react` mounts <docuseal-form>/<docuseal-builder>
 * custom elements carrying the slug/token as data-* attributes, so the
 * shell is assertable without the iframe ever loading.
 *
 * The Care Report path shares the same create-submission contract as
 * EMAR — pinning one pins the shape of both.
 */

import { Tags } from "../../framework/utils/tags";
import { buildHome, TEST_HOME_ID } from "../../framework/module-commands";
import { TEST_USER_ID } from "../../framework/constants";

const pad = (n: number) => String(n).padStart(2, "0");
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const daysFromNow = (n: number) => {
  const d = new Date(Date.now() + n * 86400000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// ════════════════════════════════════════════════════════════════════════════
// 1. The document card — POST /v1/docuseal/builder-token
// ════════════════════════════════════════════════════════════════════════════

describe("E-Sign — document card builder", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  const LEAD_ID = "eeeeeeee-0001-4eee-8eee-eeeeeeeeeeee";

  const visitDocuments = () => {
    cy.clearAuthSession();
    cy.setAuthSession("PCHO");
    cy.stubHome(buildHome());
    cy.stubUsers();
    cy.stubUser({
      userId: LEAD_ID,
      name: "Nora Bennett",
      role: "Lead",
      homeId: TEST_HOME_ID,
      milestone: ["contract"],
      isDeleted: false,
      docusignEnvelopeStatus: "completed",
      documents: [
        {
          documentId: "ad-doc-1",
          documentName: "admission_agreement",
          documentCategory: "onboarding",
          documentUrl: "https://bucket.s3.amazonaws.com/doc.docx",
          createdByUserId: TEST_USER_ID,
          createdAt: "2026-04-01T10:00:00.000Z",
        },
      ],
    });
    // The builder presigns through the Next API route, not the service one.
    cy.intercept("POST", "**/api/s3/presign-get", {
      statusCode: 200,
      body: { url: "https://bucket.s3.amazonaws.com/signed-doc.docx" },
    }).as("presign");
    cy.visit(`/crm/${LEAD_ID}`);
    cy.contains("Documents", { timeout: 10000 }).click();
    cy.contains("E-Sign", { timeout: 10000 }).should("be.visible");
  };

  it("requests a builder token with the document's identity on the wire", () => {
    cy.intercept("POST", "**/v1/docuseal/builder-token", {
      statusCode: 200,
      body: { token: "tok-abc" },
    }).as("builderToken");
    visitDocuments();
    cy.contains("E-Sign").click();
    cy.wait("@builderToken").then(({ request }) => {
      expect(request.body.name).to.eq("admission_agreement");
      expect(request.body.documentUrls).to.be.an("array").and.have.length(1);
      expect(request.body.documentUrls[0]).to.include("signed-doc");
      // externalId is a JSON string tying the submission to this record.
      const externalId = JSON.parse(request.body.externalId);
      expect(externalId.userId).to.eq(LEAD_ID);
      expect(externalId.documentName).to.eq("admission_agreement");
    });
    cy.assertAuthorized("@builderToken");
  });

  it("mounts the builder once the token lands", () => {
    cy.intercept("POST", "**/v1/docuseal/builder-token", {
      statusCode: 200,
      body: { token: "tok-abc" },
    }).as("builderToken");
    visitDocuments();
    cy.contains("E-Sign").click();
    cy.wait("@builderToken");
    cy.get("docuseal-builder", { timeout: 10000 })
      .should("exist")
      .and("have.attr", "data-token", "tok-abc");
  });

  it("says so when the token request fails", () => {
    cy.intercept("POST", "**/v1/docuseal/builder-token", {
      statusCode: 500,
      body: {},
    }).as("builderToken");
    visitDocuments();
    cy.contains("E-Sign").click();
    cy.wait("@builderToken");
    // The modal renders the thrown message in its red error slot — the
    // generic fallback or the network error string, whichever the throw gave.
    cy.get("div.text-red-600", { timeout: 10000 })
      .invoke("text")
      .should("not.be.empty");
    cy.get("docuseal-builder").should("not.exist");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. EMAR — POST /v1/docuseal/create-submission
// ════════════════════════════════════════════════════════════════════════════

describe("E-Sign — EMAR submission", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  const SENIOR_ID = "cccccccc-0001-4ccc-8ccc-cccccccccccc";

  const SENIOR = {
    userId: SENIOR_ID,
    name: "Arthur Bean",
    role: "Senior",
    home: "Comfort Cove",
    homeId: TEST_HOME_ID,
    milestone: ["contract"],
    isDeleted: false,
    documents: [],
    clinical: {
      roomNumber: 12,
      status: "In Home",
      medication: [
        {
          id: "aaaa1111-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
          medicationId: "aaaa1111-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
          name: "Tylenol",
          dosage: "100mg",
          directions: "After eating",
          startdate: daysFromNow(-30),
          enddate: "",
          timings: ["09:00:00"],
          overTheCounter: false,
        },
      ],
      medPass: {
        services: [
          {
            medicationId: "aaaa1111-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
            passOrRefuse: "Pass",
            remarks: "Took it calmly",
            providedAt: `${today()}T09:00:00.000Z`,
            providedBy: TEST_USER_ID,
            timing: "09:00:00",
          },
        ],
      },
      carePlan: { services: [] },
      vitalSigns: { bloodPressure: true },
    },
  };

  const visitEmar = () => {
    cy.clearAuthSession();
    cy.setAuthSession("PCHO");
    cy.stubHome(buildHome());
    cy.stubUsers([SENIOR]);
    cy.intercept("GET", "**/v1/hcm/shifts*", {
      statusCode: 200,
      body: { shifts: [] },
    });
    cy.intercept("GET", "**/v1/user/*", {
      statusCode: 200,
      body: { user: SENIOR },
    }).as("getUser");
    cy.visit(`/clinical/${SENIOR_ID}?activeTab=${encodeURIComponent("MedPass")}`);
    cy.contains("Generate EMAR", { timeout: 10000 }).should("be.visible");
    // Month select — index 1 is the first real month option.
    cy.get("select").first().select(1);
    cy.contains("E-Sign PDF", { timeout: 10000 }).should("be.visible");
  };

  it("submits the generated PDF with the signer's email", () => {
    cy.intercept("POST", "**/v1/docuseal/create-submission", {
      statusCode: 200,
      body: { data: { slug: "slug-abc123" } },
    }).as("submission");
    visitEmar();
    cy.contains("E-Sign PDF").click();
    cy.wait("@submission").then(({ request }) => {
      expect(request.body.pdfBase64, "the jsPDF output, base64").to.be.a(
        "string"
      ).and.not.be.empty;
      expect(request.body.signerEmail).to.match(/@/);
    });
    cy.assertAuthorized("@submission");
  });

  it("opens the signing form on the returned slug", () => {
    cy.intercept("POST", "**/v1/docuseal/create-submission", {
      statusCode: 200,
      body: { data: { slug: "slug-abc123" } },
    }).as("submission");
    visitEmar();
    cy.contains("E-Sign PDF").click();
    cy.wait("@submission");
    cy.get("docuseal-form", { timeout: 10000 })
      .should("exist")
      .and("have.attr", "data-src", "https://docuseal.com/s/slug-abc123");
  });

  it("surfaces the failure when the submission cannot be prepared", () => {
    cy.intercept("POST", "**/v1/docuseal/create-submission", {
      statusCode: 500,
      body: {},
    }).as("submission");
    visitEmar();
    cy.contains("E-Sign PDF").click();
    cy.wait("@submission");
    cy.contains(/Request failed|Failed to prepare e-signature/i, {
      timeout: 10000,
    }).should("be.visible");
    cy.get("docuseal-form").should("not.exist");
  });
});
