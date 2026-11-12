/// <reference types="cypress" />

/**
 * Compliance — Training: creating, taking and certifying a module
 *
 *   components/compliance/create-training-module.tsx  the Create form
 *   components/compliance/compliance-training.tsx     the card grid and delete
 *   pages/compliance/training/[training_id].tsx       the player
 *   components/compliance/doc-viewer.tsx              the PPT iframe
 *   utils/complianceUtil.tsx                          the default S3 modules
 *
 * `compliance.cy.ts` already covers the training SCREEN — its heading, counts,
 * Pending/Certified, document-type filtering and who may reach it. This spec is
 * the three flows it stops short of: building a module, working through one,
 * and the certificate that falls out of the end.
 *
 * THERE IS NO TRAINING ENDPOINT
 *   A module is an entry in `home.complianceTraining`, so creating or deleting
 *   one is a `PUT /v1/home/{id}` carrying the whole home. Completion lives on
 *   the USER (`completedComplianceModules`, `documents`), and the
 *   certificate is minted by `POST /v1/compliance/generate-certificate`.
 *
 * WHAT MAKES A MODULE "COMPLETE"
 *   `[training_id].tsx` decides from what the module actually contains:
 *
 *     video only   watched past 99%
 *     PPT only     the confirmation checkbox
 *     both         BOTH — ticking the box alone is not enough
 *
 *   Download Certificate renders only once that is satisfied, which is the
 *   whole point of the screen and is asserted from all three directions below.
 *
 * DRIVING THE VIDEO
 *   A real `<video>` cannot be played to the end in CI — the source is a
 *   presigned S3 URL that does not exist here. The component reads
 *   `e.currentTarget.duration` and `.currentTarget.currentTime` in its
 *   `onLoadedMetadata` / `onTimeUpdate` handlers, so the tests define those two
 *   properties and dispatch the native events. React's synthetic handlers fire
 *   from the native ones, so this exercises the real completion arithmetic
 *   rather than a mock of it.
 *
 * The certificate itself opens in a new tab (`window.open`) rather than being
 * written to disk, so `window.open` is stubbed and asserted. What the document
 * LOOKS like is out of scope, in line with the rest of the suite.
 */

import { Tags } from "../../framework/utils/tags";
import {
  buildHome,
  buildTrainingModule,
  buildUserWithDocuments,
  TEST_HOME_ID,
  TEST_USER_ID,
} from "../../framework/module-commands";

const TRAINING = "/compliance/training";
const CREATE_MODULE = "/compliance/training/createModule";

const VIDEO_MODULE = "module-fire-safety";
const PPT_MODULE = "module-slides";
const BOTH_MODULE = "module-both";

/** A module whose only asset is a video. */
const videoModule = (overrides: Record<string, any> = {}) =>
  buildTrainingModule({ moduleType: "uploaded", ...overrides });

/** A module whose only asset is a deck. */
const pptModule = (overrides: Record<string, any> = {}) =>
  buildTrainingModule({
    moduleId: PPT_MODULE,
    moduleName: "Slides Module",
    moduleType: "uploaded",
    documents: [
      {
        documentId: "slides-ppt",
        documentName: "Slides Module_ppt",
        documentType: ".pptx",
        documentUrl: "https://bucket.s3.amazonaws.com/slides.pptx",
      },
    ],
    ...overrides,
  });

/** A module carrying both — the case where one completion is not enough. */
const bothModule = () =>
  buildTrainingModule({
    moduleId: BOTH_MODULE,
    moduleName: "Video And Slides",
    moduleType: "uploaded",
    documents: [
      {
        documentId: "both-video",
        documentName: "Video And Slides_video",
        documentType: ".mp4",
        documentUrl: "https://bucket.s3.amazonaws.com/both.mp4",
      },
      {
        documentId: "both-ppt",
        documentName: "Video And Slides_ppt",
        documentType: ".pptx",
        documentUrl: "https://bucket.s3.amazonaws.com/both.pptx",
      },
    ],
  });

// ── Selectors ────────────────────────────────────────────────────────────────

const sel = {
  createModule: () => cy.contains("button", "+ Create New Module"),
  card: (name: string) => cy.contains(name).closest('div[class*="w-[300px]"]'),
  startTraining: (name: string) => sel.card(name).contains("button", "Start Training"),
  deleteButton: (name: string) => sel.card(name).find('div[class*="rounded-[50%]"]'),
  confirm: () => cy.contains("button", "Confirm"),
  cancel: () => cy.contains("button", "Cancel"),

  // Create form
  title: () => cy.get('input[name="moduleName"]'),
  description: () => cy.get('textarea[name="moduleDescription"]'),
  /**
   * `FormSingleRadioSelect` renders `RadioButton`, which is styled divs — there
   * is no `input[type=radio]` on this form at all. The selected one is marked
   * `data-state="on"`.
   */
  duration: (label: string) => cy.contains(label),
  durationOptions: () => cy.get("[data-state]"),
  chosenDuration: () => cy.get('[data-state="on"]'),
  fileInput: () => cy.get("#fileInput"),
  createButton: () => cy.contains("button", "Create Module"),

  // Player
  video: () => cy.get("video"),
  pptFrame: () => cy.get("iframe"),
  confirmCheckbox: () => cy.get('input[type="checkbox"]'),
  downloadCertificate: () => cy.contains("button", "Download Certificate"),
};

// ── Setup ────────────────────────────────────────────────────────────────────

/** The default-module lookup S3 does for every training screen. */
const stubDefaultModules = (contents: any[] = []) =>
  cy.intercept("POST", "/api/s3/list-objects", {
    statusCode: 200,
    body: { contents, commonPrefixes: [] },
  }).as("listObjects");

const visitTraining = (
  modules: any[] = [videoModule()],
  opts: {
    role?: any;
    home?: any;
    completed?: string[];
    userDocuments?: any[];
    path?: string;
  } = {}
) => {
  cy.clearAuthSession();
  cy.setAuthSession(opts.role ?? "PCHO");
  cy.stubHome(opts.home ?? buildHome({ complianceTraining: modules }));
  cy.stubUsers();
  cy.intercept("GET", "**/v1/user/*", {
    statusCode: 200,
    body: {
      user: {
        ...buildUserWithDocuments(opts.userDocuments ?? []),
        completedComplianceModules: opts.completed ?? [],
      },
    },
  }).as("getUser");
  stubDefaultModules();
  cy.stubPresign();
  cy.visit(opts.path ?? TRAINING);
};

/** Open a module's player and wait for its title. */
const openPlayer = (moduleId: string, moduleName: string, opts: any = {}) => {
  visitTraining(opts.modules ?? [videoModule()], {
    ...opts,
    path: `${TRAINING}/${moduleId}`,
  });
  cy.contains(moduleName, { timeout: 10000 }).should("be.visible");
};

/**
 * Play a video to its end without a real media file.
 *
 * The component computes `(currentTime / duration) * 100 > 99`, so both
 * properties have to be readable off the element when its handlers run.
 */
const watchVideoToEnd = () => {
  sel.video().should("exist");
  sel.video().then(($video) => {
    const video = $video[0] as HTMLVideoElement;
    Object.defineProperty(video, "duration", { value: 10, configurable: true });
    Object.defineProperty(video, "currentTime", {
      value: 10,
      writable: true,
      configurable: true,
    });
    video.dispatchEvent(new Event("loadedmetadata"));
    video.dispatchEvent(new Event("timeupdate"));
  });
};

/** Report the video as only part-watched. */
const watchVideoPartly = (fraction: number) => {
  sel.video().should("exist");
  sel.video().then(($video) => {
    const video = $video[0] as HTMLVideoElement;
    Object.defineProperty(video, "duration", { value: 10, configurable: true });
    Object.defineProperty(video, "currentTime", {
      value: 10 * fraction,
      writable: true,
      configurable: true,
    });
    video.dispatchEvent(new Event("loadedmetadata"));
    video.dispatchEvent(new Event("timeupdate"));
  });
};

/**
 * The server answers with the certificate's own URL.
 *
 * That matters more than it looks: `ensureCertificateUrl` only settles quickly
 * when the response carries `documentUrl`. Without one it refetches the user
 * five times with 800ms sleeps and then throws, and Download Certificate stays
 * `disabled` for the whole four seconds — see the test that pins it.
 */
const stubCertificate = (
  statusCode = 201,
  body: any = {
    documentUrl: "https://bucket.s3.amazonaws.com/certs/fire-safety.docx",
  }
) =>
  cy.intercept("POST", "**/v1/compliance/generate-certificate", {
    statusCode,
    body,
  }).as("generateCertificate");

const stubHomeSave = (statusCode = 200) =>
  cy.intercept("PUT", "**/v1/home**", { statusCode, body: {} }).as("saveHome");

const stubS3Upload = () => {
  cy.intercept("POST", "/api/s3/presign-put", {
    statusCode: 200,
    body: { url: "https://bucket.s3.amazonaws.com/put?X-Amz-Signature=stub" },
  }).as("presignPut");
  cy.intercept("PUT", "https://bucket.s3.amazonaws.com/**", { statusCode: 200 });
  cy.intercept("POST", "/api/s3/delete-object", {
    statusCode: 200,
    body: { deleted: true },
  }).as("deleteObject");
};

/** A file the upload accepts. */
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

describe("Compliance — Training: create, take, certify", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. The card
  // ──────────────────────────────────────────────────────────────────────────

  describe("A training card", () => {
    it("names the module", () => {
      visitTraining();
      cy.contains("Fire Safety", { timeout: 10000 }).should("be.visible");
    });

    it("marks a video module with the video icon", () => {
      visitTraining();
      sel.card("Fire Safety").find("svg.text-blue-500").should("exist");
    });

    it("marks a deck module with the presentation icon", () => {
      visitTraining([pptModule()]);
      sel.card("Slides Module").find("svg.text-green-500").should("exist");
    });

    it("marks a module carrying both with both icons", () => {
      visitTraining([bothModule()]);
      sel.card("Video And Slides").find("svg.text-blue-500").should("exist");
      sel.card("Video And Slides").find("svg.text-green-500").should("exist");
    });

    it("shows Pending until the module is finished", () => {
      visitTraining();
      sel.card("Fire Safety").should("contain.text", "Pending");
    });

    it("shows Certified once it has been", () => {
      visitTraining([videoModule()], { completed: [VIDEO_MODULE] });
      sel.card("Fire Safety").should("contain.text", "Certified");
    });

    it("offers Start Training", () => {
      visitTraining();
      sel.startTraining("Fire Safety").should("be.visible");
    });

    it("opens the module", () => {
      visitTraining();
      sel.startTraining("Fire Safety").click();
      cy.location("pathname", { timeout: 10000 }).should(
        "eq",
        `${TRAINING}/${VIDEO_MODULE}`
      );
    });

    it("truncates a very long module name", () => {
      visitTraining([
        videoModule({
          moduleName:
            "A Very Long Compliance Training Module Name That Runs Past Fifty Characters",
        }),
      ]);
      cy.contains(
        "A Very Long Compliance Training Module Name That R...",
        { timeout: 10000 }
      ).should("be.visible");
    });

    it("counts the modules on offer", () => {
      visitTraining([videoModule(), pptModule()]);
      cy.contains("2 Training Modules", { timeout: 10000 }).should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Deleting a module
  // ──────────────────────────────────────────────────────────────────────────

  describe("Deleting a module", () => {
    beforeEach(() => {
      stubS3Upload();
      stubHomeSave();
      visitTraining();
      cy.contains("Fire Safety", { timeout: 10000 }).should("be.visible");
    });

    it("offers a delete on an uploaded module", () => {
      sel.deleteButton("Fire Safety").should("be.visible");
    });

    it("asks for confirmation first", () => {
      sel.deleteButton("Fire Safety").click();
      cy.contains("Delete Module").should("be.visible");
      cy.contains("Are you sure you want to delete this").should("be.visible");
    });

    it("names the module it is about to delete", () => {
      sel.deleteButton("Fire Safety").click();
      cy.contains("Fire Safety").should("be.visible");
    });

    it("sends nothing until confirmed", () => {
      sel.deleteButton("Fire Safety").click();
      cy.assertNoRequest("@saveHome");
    });

    it("abandons the delete on Cancel", () => {
      sel.deleteButton("Fire Safety").click();
      sel.cancel().click();
      cy.assertNoRequest("@saveHome");
    });

    it("removes the module from the home when confirmed", () => {
      sel.deleteButton("Fire Safety").click();
      sel.confirm().click();

      cy.wait("@saveHome").then(({ request }) => {
        const names = (request.body.complianceTraining ?? []).map(
          (m: any) => m.moduleName
        );
        expect(names).to.not.include("Fire Safety");
      });
    });

    it("removes the file from storage first", () => {
      sel.deleteButton("Fire Safety").click();
      sel.confirm().click();
      cy.wait("@deleteObject");
    });

    it("confirms the deletion", () => {
      sel.deleteButton("Fire Safety").click();
      sel.confirm().click();
      cy.wait("@saveHome");
      cy.assertPopover("Module deleted succesfully!");
    });

    it("reports a rejected deletion", () => {
      cy.intercept("PUT", "**/v1/home**", { statusCode: 500, body: {} }).as(
        "saveHome"
      );
      sel.deleteButton("Fire Safety").click();
      sel.confirm().click();
      cy.wait("@saveHome");
      cy.assertPopover("Failed to delete training module");
    });

    it("leaves the other modules alone", () => {
      visitTraining([videoModule(), pptModule()]);
      cy.contains("Slides Module", { timeout: 10000 }).should("be.visible");
      sel.deleteButton("Fire Safety").click();
      sel.confirm().click();

      cy.wait("@saveHome").then(({ request }) => {
        const names = (request.body.complianceTraining ?? []).map(
          (m: any) => m.moduleName
        );
        expect(names).to.include("Slides Module");
      });
    });

    it("withholds the delete from a role that may only take training", { tags: [Tags.PCG] }, () => {
      // COMPLIANCE_TRAINING EDIT guards it; a PCG reaches the screen without it.
      visitTraining([videoModule()], { role: "PCG" });
      cy.contains("Fire Safety", { timeout: 10000 }).should("be.visible");
      sel.card("Fire Safety").find('div[class*="rounded-[50%]"]').should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. The Create form
  // ──────────────────────────────────────────────────────────────────────────

  describe("The Create Training Module form", () => {
    beforeEach(() => {
      stubS3Upload();
      stubHomeSave();
      visitTraining([], { path: CREATE_MODULE });
      cy.contains("Create Training Module", { timeout: 10000 }).should("be.visible");
    });

    it("heads the form", () => {
      cy.contains("Create Training Module").should("be.visible");
      cy.contains("Upload content and create a new training module").should(
        "be.visible"
      );
    });

    it("asks for a title and a description", () => {
      cy.contains("Module Title *").should("be.visible");
      cy.contains("Description *").should("be.visible");
      sel.title().should("exist");
      sel.description().should("exist");
    });

    it("prompts in the description", () => {
      sel.description().should(
        "have.attr",
        "placeholder",
        "Describe what learners will gain from this module..."
      );
    });

    it("asks how long the certificate lasts", () => {
      cy.contains("Certificate Expires In *").should("be.visible");
      cy.contains("6 Months").should("be.visible");
      cy.contains("1 Year").should("be.visible");
    });

    it("offers only those two durations", () => {
      sel.durationOptions().should("have.length", 2);
    });

    it("starts with no duration chosen", () => {
      sel.chosenDuration().should("not.exist");
    });

    it("marks the duration that was chosen", () => {
      sel.duration("6 Months").click();
      sel.chosenDuration().should("have.length", 1);
      sel.chosenDuration().should("contain.text", "6 Months");
    });

    it("swaps the choice rather than adding to it", () => {
      sel.duration("6 Months").click();
      sel.duration("1 Year").click();
      sel.chosenDuration().should("have.length", 1);
      sel.chosenDuration().should("contain.text", "1 Year");
    });

    it("describes what may be uploaded", () => {
      cy.contains("Upload Training Content").should("be.visible");
      cy.contains("Supported: Video files (.mp4) and PPT files (.ppt,.pptx)").should(
        "be.visible"
      );
    });

    it("accepts only video and presentation types", () => {
      sel.fileInput()
        .should("have.attr", "accept")
        .and("contain", "video/mp4")
        .and("contain", "presentationml.presentation");
    });

    it("takes more than one file at a time", () => {
      sel.fileInput().should("have.attr", "multiple");
    });

    it("offers Create and Cancel", () => {
      sel.createButton().should("be.visible");
      cy.contains("button", "Cancel").should("be.visible");
    });

    it("goes back to the training screen on Cancel", () => {
      cy.contains("button", "Cancel").click();
      cy.location("pathname", { timeout: 10000 }).should("eq", TRAINING);
    });

    it("names a file once it is chosen", () => {
      sel.fileInput().selectFile(mp4File, { force: true });
      cy.contains("induction.mp4").should("be.visible");
    });

    it("names both files when a video and a deck are chosen", () => {
      sel.fileInput().selectFile([mp4File, pptxFile], { force: true });
      cy.contains("induction.mp4").should("be.visible");
      cy.contains("induction.pptx").should("be.visible");
    });

    it("sends nothing merely by filling the form in", () => {
      sel.title().type("Induction");
      sel.description().type("A short induction");
      cy.assertNoRequest("@saveHome");
    });
  });

  describe("The Create form — what it refuses", () => {
    beforeEach(() => {
      stubS3Upload();
      stubHomeSave();
      visitTraining([], { path: CREATE_MODULE });
      cy.contains("Create Training Module", { timeout: 10000 }).should("be.visible");
    });

    it("refuses an empty form", () => {
      sel.createButton().click();
      cy.assertNoRequest("@saveHome");
    });

    it("marks the missing fields", () => {
      // An untouched field is `undefined` rather than "", so zod answers with
      // its own "Required" and the schema's custom messages never appear on a
      // pristine form. They show once the field has held a string — see below.
      sel.createButton().click();
      cy.contains("Required").should("be.visible");
    });

    it("says the title is required once it has been emptied", () => {
      // Re-query between commands — the form remounts the field on change and
      // the old subject detaches mid-chain.
      sel.title().type("x");
      sel.title().clear();
      sel.description().type("A short induction");
      sel.duration("6 Months").click();
      sel.createButton().click();
      cy.contains("Module Title is required").should("be.visible");
    });

    it("says the description is required once it has been emptied", () => {
      sel.title().type("Induction");
      sel.description().type("x");
      sel.description().clear();
      sel.duration("6 Months").click();
      sel.createButton().click();
      cy.contains("Description is required").should("be.visible");
    });

    it("refuses a title of nothing but spaces", () => {
      sel.title().type("   ");
      sel.description().type("A short induction");
      sel.duration("6 Months").click();
      sel.createButton().click();
      cy.assertNoRequest("@saveHome");
    });

    it("refuses a complete form with no file attached", () => {
      sel.title().type("Induction");
      sel.description().type("A short induction");
      sel.duration("6 Months").click();
      sel.createButton().click();

      cy.assertPopover("Please upload a video");
      cy.assertNoRequest("@saveHome");
    });

    it("refuses a file that is neither video nor presentation", () => {
      sel.fileInput().selectFile(
        {
          contents: Cypress.Buffer.from("%PDF-1.4"),
          fileName: "handbook.pdf",
          mimeType: "application/pdf",
        },
        { force: true }
      );
      cy.assertPopover("Please upload either a video or a PPT file");
    });

    it("does not attach a file it refused", () => {
      sel.fileInput().selectFile(
        {
          contents: Cypress.Buffer.from("%PDF-1.4"),
          fileName: "handbook.pdf",
          mimeType: "application/pdf",
        },
        { force: true }
      );
      cy.dismissPopover();
      cy.contains("handbook.pdf").should("not.exist");
    });



    it("keeps the valid file out of a mixed selection", () => {
      sel.fileInput().selectFile(
        [
          mp4File,
          {
            contents: Cypress.Buffer.from("%PDF-1.4"),
            fileName: "handbook.pdf",
            mimeType: "application/pdf",
          },
        ],
        { force: true }
      );
      cy.contains("induction.mp4").should("be.visible");
      cy.contains("handbook.pdf").should("not.exist");
    });
  });

  describe("The Create form — saving", () => {
    const fillAndSubmit = (files: any = mp4File, duration = "6 Months") => {
      sel.title().type("Induction");
      sel.description().type("A short induction");
      sel.duration(duration).click();
      sel.fileInput().selectFile(files, { force: true });
      sel.createButton().click();
    };

    beforeEach(() => {
      stubS3Upload();
      stubHomeSave();
      visitTraining([], { path: CREATE_MODULE });
      cy.contains("Create Training Module", { timeout: 10000 }).should("be.visible");
    });

    it("uploads the file before saving the home", () => {
      fillAndSubmit();
      cy.wait("@presignPut");
      cy.wait("@saveHome");
    });

    it("appends the module to the home", () => {
      fillAndSubmit();
      cy.wait("@saveHome").then(({ request }) => {
        const names = (request.body.complianceTraining ?? []).map(
          (m: any) => m.moduleName
        );
        expect(names).to.include("Induction");
      });
    });

    it("carries the title and the description", () => {
      fillAndSubmit();
      cy.wait("@saveHome").then(({ request }) => {
        const module = request.body.complianceTraining.at(-1);
        expect(module.moduleName).to.eq("Induction");
        expect(module.moduleDescription).to.eq("A short induction");
      });
    });

    it("stores six months as 180 days", () => {
      fillAndSubmit(mp4File, "6 Months");
      cy.wait("@saveHome").then(({ request }) => {
        expect(request.body.complianceTraining.at(-1).certificateDurationDays).to.eq(
          180
        );
      });
    });

    it("stores one year as 365 days", () => {
      fillAndSubmit(mp4File, "1 Year");
      cy.wait("@saveHome").then(({ request }) => {
        expect(request.body.complianceTraining.at(-1).certificateDurationDays).to.eq(
          365
        );
      });
    });

    it("records a video as an .mp4 document", () => {
      fillAndSubmit();
      cy.wait("@saveHome").then(({ request }) => {
        const [document] = request.body.complianceTraining.at(-1).documents;
        expect(document.documentType).to.eq(".mp4");
        expect(document.documentName).to.eq("Induction_video");
      });
    });

    it("records a deck as a .pptx document", () => {
      fillAndSubmit(pptxFile);
      cy.wait("@saveHome").then(({ request }) => {
        const [document] = request.body.complianceTraining.at(-1).documents;
        expect(document.documentType).to.eq(".pptx");
        expect(document.documentName).to.eq("Induction_ppt");
      });
    });

    it("records both when both are uploaded", () => {
      fillAndSubmit([mp4File, pptxFile]);
      cy.wait("@saveHome").then(({ request }) => {
        const types = request.body.complianceTraining
          .at(-1)
          .documents.map((d: any) => d.documentType);
        expect(types).to.have.members([".mp4", ".pptx"]);
      });
    });

    it("stamps who created it and when", () => {
      fillAndSubmit();
      cy.wait("@saveHome").then(({ request }) => {
        const module = request.body.complianceTraining.at(-1);
        expect(module.createdByUserId).to.eq(TEST_USER_ID);
        expect(module.createdAt).to.be.a("string");
        expect(module.moduleId).to.be.a("string");
      });
    });

    it("keeps the home's existing modules", () => {
      visitTraining([], {
        path: CREATE_MODULE,
        home: buildHome({ complianceTraining: [videoModule()] }),
      });
      cy.contains("Create Training Module", { timeout: 10000 }).should("be.visible");
      fillAndSubmit();

      cy.wait("@saveHome").then(({ request }) => {
        const names = request.body.complianceTraining.map((m: any) => m.moduleName);
        expect(names).to.include("Fire Safety");
        expect(names).to.include("Induction");
      });
    });

    it("confirms the upload", () => {
      fillAndSubmit();
      cy.wait("@saveHome");
      cy.assertPopover("Training module uploaded succesfully!");
    });

    it("returns to the training screen", () => {
      fillAndSubmit();
      cy.wait("@saveHome");
      cy.location("pathname", { timeout: 10000 }).should("eq", TRAINING);
    });

    it("reports a rejected upload", () => {
      cy.intercept("PUT", "**/v1/home**", { statusCode: 500, body: {} }).as(
        "saveHome"
      );
      fillAndSubmit();
      cy.wait("@saveHome");
      cy.assertPopover("Failed to upload training module");
    });

    it("stays on the form after a rejected upload", () => {
      cy.intercept("PUT", "**/v1/home**", { statusCode: 500, body: {} }).as(
        "saveHome"
      );
      fillAndSubmit();
      cy.wait("@saveHome");
      cy.location("pathname").should("eq", CREATE_MODULE);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Taking a video-only module
  // ──────────────────────────────────────────────────────────────────────────

  describe("A video module", () => {
    beforeEach(() => {
      stubCertificate();
      openPlayer(VIDEO_MODULE, "Fire Safety");
    });

    it("names the module and its description", () => {
      cy.contains("Fire Safety").should("be.visible");
      cy.contains("Annual fire safety refresher").should("be.visible");
    });

    it("shows the video", () => {
      sel.video().should("exist");
    });

    it("offers no deck", () => {
      sel.pptFrame().should("not.exist");
    });

    it("offers no confirmation checkbox", () => {
      sel.confirmCheckbox().should("not.exist");
    });

    it("withholds the certificate until the video has been watched", () => {
      sel.downloadCertificate().should("not.exist");
    });

    it("still withholds it part way through", () => {
      watchVideoPartly(0.5);
      sel.downloadCertificate().should("not.exist");
    });

    it("still withholds it at ninety per cent", () => {
      // The threshold is 99%, not "nearly all of it".
      watchVideoPartly(0.9);
      sel.downloadCertificate().should("not.exist");
    });

    it("offers the certificate once the video finishes", () => {
      watchVideoToEnd();
      sel.downloadCertificate().should("be.visible");
    });

    it("mints the certificate on first completion", () => {
      watchVideoToEnd();
      cy.wait("@generateCertificate").then(({ request }) => {
        expect(request.body.moduleId).to.eq(VIDEO_MODULE);
        expect(request.body.moduleName).to.eq("Fire Safety");
        expect(request.body.userId).to.eq(TEST_USER_ID);
      });
    });

    it("[as-built] leaves the button disabled while the certificate is minted", () => {
      // `disabled={!isCompleted || certificateLoader}`. When the API answers
      // without a `documentUrl`, `ensureCertificateUrl` retries five times with
      // 800ms sleeps before giving up — so the button a learner has just earned
      // sits disabled for about four seconds and then reports an error.
      cy.intercept("POST", "**/v1/compliance/generate-certificate", {
        statusCode: 201,
        body: {},
      }).as("generateCertificate");
      watchVideoToEnd();
      cy.wait("@generateCertificate");
      sel.downloadCertificate().should("be.disabled");
    });

    it("opens the certificate when the button is pressed", () => {
      cy.window().then((win) => cy.stub(win, "open").as("open"));
      watchVideoToEnd();
      cy.wait("@generateCertificate");
      sel.downloadCertificate().click();
      cy.get("@open").should("have.been.called");
    });

    it("reports a certificate the server refused", () => {
      cy.intercept("POST", "**/v1/compliance/generate-certificate", {
        statusCode: 500,
        body: { message: "Certificate service unavailable" },
      }).as("generateCertificate");
      watchVideoToEnd();
      cy.wait("@generateCertificate");
      cy.assertPopover("Certificate service unavailable");
    });
  });

  describe("A video module already completed", () => {
    it("offers the certificate straight away", () => {
      stubCertificate();
      openPlayer(VIDEO_MODULE, "Fire Safety", { completed: [VIDEO_MODULE] });
      sel.downloadCertificate().should("be.visible");
    });

    it("does not mint a second certificate", () => {
      stubCertificate();
      openPlayer(VIDEO_MODULE, "Fire Safety", { completed: [VIDEO_MODULE] });
      sel.downloadCertificate().should("be.visible");
      cy.assertNoRequest("@generateCertificate");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Taking a deck-only module
  // ──────────────────────────────────────────────────────────────────────────

  describe("A deck module", () => {
    beforeEach(() => {
      stubCertificate();
      openPlayer(PPT_MODULE, "Slides Module", { modules: [pptModule()] });
    });

    it("shows the deck", () => {
      sel.pptFrame().should("exist");
    });

    it("offers no video", () => {
      sel.video().should("not.exist");
    });

    it("asks the learner to confirm they have read it", () => {
      cy.contains("I confirm that I have completed the full Assistly training").should(
        "be.visible"
      );
    });

    it("names the module in the confirmation", () => {
      cy.contains("Slides Module").should("be.visible");
    });

    it("starts unconfirmed", () => {
      sel.confirmCheckbox().should("not.be.checked");
    });

    it("withholds the certificate until it is confirmed", () => {
      sel.downloadCertificate().should("not.exist");
    });

    it("offers the certificate once confirmed", () => {
      sel.confirmCheckbox().check();
      sel.downloadCertificate().should("be.visible");
    });

    it("mints the certificate on confirmation", () => {
      sel.confirmCheckbox().check();
      cy.wait("@generateCertificate").then(({ request }) => {
        expect(request.body.moduleId).to.eq(PPT_MODULE);
      });
    });

    it("locks the confirmation once the module is complete", () => {
      // `disabled={isCompleted}` — the box cannot be unticked afterwards.
      sel.confirmCheckbox().check();
      sel.downloadCertificate().should("be.visible");
      sel.confirmCheckbox().should("be.disabled");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Taking a module with both
  // ──────────────────────────────────────────────────────────────────────────

  describe("A module with a video and a deck", () => {
    beforeEach(() => {
      stubCertificate();
      openPlayer(BOTH_MODULE, "Video And Slides", { modules: [bothModule()] });
    });

    it("shows both", () => {
      sel.video().should("exist");
      sel.pptFrame().should("exist");
    });

    it("withholds the certificate at the start", () => {
      sel.downloadCertificate().should("not.exist");
    });

    it("is not satisfied by the checkbox alone", () => {
      // The point of the whole screen: confirming the deck does not excuse the
      // video.
      sel.confirmCheckbox().check();
      sel.downloadCertificate().should("not.exist");
    });

    it("is not satisfied by the video alone", () => {
      watchVideoToEnd();
      sel.downloadCertificate().should("not.exist");
    });

    it("is satisfied by both, video first", () => {
      watchVideoToEnd();
      sel.confirmCheckbox().check();
      sel.downloadCertificate().should("be.visible");
    });

    it("is satisfied by both, checkbox first", () => {
      sel.confirmCheckbox().check();
      watchVideoToEnd();
      sel.downloadCertificate().should("be.visible");
    });

    it("sends nothing while only half done", () => {
      sel.confirmCheckbox().check();
      cy.assertNoRequest("@generateCertificate");
    });

    it("mints one certificate when both are done", () => {
      watchVideoToEnd();
      sel.confirmCheckbox().check();
      cy.wait("@generateCertificate");
      cy.get("@generateCertificate.all").should("have.length", 1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. The certificate reaches the Certificates screen
  // ──────────────────────────────────────────────────────────────────────────

  describe("The certificate afterwards", () => {
    /** The document the server attaches to the user once a module is passed. */
    const certificate = {
      documentId: "cert-fire-safety",
      documentName: "Fire Safety_Certificate",
      documentType: ".docx",
      documentCategory: "certificate",
      moduleId: VIDEO_MODULE,
      documentUrl: "https://bucket.s3.amazonaws.com/fire-safety-certificate.docx",
      createdAt: "2026-09-10T10:00:00.000Z",
    };

    it("turns the training card Certified", () => {
      visitTraining([videoModule()], {
        completed: [VIDEO_MODULE],
        userDocuments: [certificate],
      });
      sel.card("Fire Safety").should("contain.text", "Certified");
    });

    it("appears on the certificates screen", () => {
      visitTraining([videoModule()], {
        completed: [VIDEO_MODULE],
        userDocuments: [certificate],
        path: "/compliance/certificates",
      });
      cy.contains("Fire Safety", { timeout: 10000 }).should("be.visible");
    });

    it("is offered for download from the player without being reissued", () => {
      stubCertificate();
      openPlayer(VIDEO_MODULE, "Fire Safety", {
        completed: [VIDEO_MODULE],
        userDocuments: [certificate],
      });
      sel.downloadCertificate().should("be.visible");
      cy.assertNoRequest("@generateCertificate");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. Access
  // ──────────────────────────────────────────────────────────────────────────

  describe("Access", () => {
    it("refuses the player when the home has no compliance module", () => {
      visitTraining([videoModule()], {
        home: buildHome({
          authorizedModules: ["CRM"],
          complianceTraining: [videoModule()],
        }),
        path: `${TRAINING}/${VIDEO_MODULE}`,
      });
      cy.assertRestricted();
    });

    it("redirects a role without COMPLIANCE away from the player", { tags: [Tags.NURSE] }, () => {
      visitTraining([videoModule()], {
        role: "Nurse",
        path: `${TRAINING}/${VIDEO_MODULE}`,
      });
      cy.location("pathname", { timeout: 10000 }).should("eq", "/crm");
    });

    it("lets a carer take a module", { tags: [Tags.PCG] }, () => {
      visitTraining([videoModule()], {
        role: "PCG",
        path: `${TRAINING}/${VIDEO_MODULE}`,
      });
      cy.contains("Fire Safety", { timeout: 10000 }).should("be.visible");
    });

    it("refuses the create form when the home has no compliance module", () => {
      visitTraining([], {
        home: buildHome({ authorizedModules: ["CRM"] }),
        path: CREATE_MODULE,
      });
      cy.assertRestricted();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 9. End-to-end journeys
  // ──────────────────────────────────────────────────────────────────────────

  describe("End-to-end journeys", () => {
    it("E2E — a module is created from the training screen", () => {
      stubS3Upload();
      stubHomeSave();
      visitTraining([]);

      cy.contains("Training Module", { timeout: 10000 }).should("be.visible");
      sel.createModule().click();
      cy.contains("Create Training Module", { timeout: 10000 }).should("be.visible");

      sel.title().type("Induction");
      sel.description().type("A short induction");
      sel.duration("1 Year").click();
      sel.fileInput().selectFile(mp4File, { force: true });
      sel.createButton().click();

      cy.wait("@saveHome").then(({ request }) => {
        const module = request.body.complianceTraining.at(-1);
        expect(module.moduleName).to.eq("Induction");
        expect(module.certificateDurationDays).to.eq(365);
      });
      cy.assertPopover("Training module uploaded succesfully!");
      cy.location("pathname", { timeout: 10000 }).should("eq", TRAINING);
    });

    it("E2E — a video module is watched through to its certificate", () => {
      stubCertificate();
      visitTraining([videoModule()]);

      sel.card("Fire Safety").should("contain.text", "Pending");
      sel.startTraining("Fire Safety").click();
      cy.contains("Fire Safety", { timeout: 10000 }).should("be.visible");

      sel.downloadCertificate().should("not.exist");
      watchVideoToEnd();
      sel.downloadCertificate().should("be.visible");

      cy.wait("@generateCertificate").then(({ request }) => {
        expect(request.body.moduleId).to.eq(VIDEO_MODULE);
      });
    });

    it("E2E — a mixed module needs the video and the deck", () => {
      stubCertificate();
      openPlayer(BOTH_MODULE, "Video And Slides", { modules: [bothModule()] });

      sel.confirmCheckbox().check();
      sel.downloadCertificate().should("not.exist");
      cy.assertNoRequest("@generateCertificate");

      watchVideoToEnd();
      sel.downloadCertificate().should("be.visible");
      cy.wait("@generateCertificate");
    });
  });
});
