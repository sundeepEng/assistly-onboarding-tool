/* eslint-disable cypress/no-force, cypress/no-unnecessary-waiting -- ported legacy suite: deliberate force-clicks on icon triggers / documented settle windows */
/// <reference types="cypress" />

/**
 * CRM — known defects
 *
 * EVERY TEST IN THIS FILE FAILS ON PURPOSE. That is the point of the file.
 *
 * Each one asserts the behaviour the UI *advertises* — the count it shows, the
 * limit it prints, the action its own label promises — against code that does
 * something else. They are executable bug reports: a test here turning green
 * means the bug is fixed and the test should be moved into the spec that owns
 * that area, not deleted.
 *
 * Do NOT "fix" a test here by weakening its assertion to match the code. If the
 * current behaviour turns out to be intended, delete the test and record the
 * decision in the owning spec instead.
 *
 * Because this file is expected to be red, it is kept out of the specs that must
 * stay green. Run it on its own:
 *
 *   npx cypress run --spec cypress/e2e/crm/known-defects.cy.ts
 *
 * and exclude it from any "all CRM specs must pass" job. See README.md.
 *
 * Sections mirror the owning specs:
 *   1. Send Bulk Campaign   senior-leads-bulk-campaign.cy.ts
 *   2. Home Tour            senior-leads-home-tour.cy.ts
 *   3. Careplan / ADLs      senior-leads-onboarding.cy.ts
 *   4. Care & Nurse Leads   care-and-nurse-leads.cy.ts
 */

import { Tags } from "../../framework/utils/tags";
import { buildHome, buildUserRow, TEST_HOME_ID, TEST_USER_ID } from "../../framework/module-commands";

const CRM_PATH = "/crm";
const PCG_PATH = "/crm/pcg";

// ═══════════════════════════════════════════════════════════════════════════
// 1. Send Bulk Campaign
// ═══════════════════════════════════════════════════════════════════════════

/** Four leads: selected 4 · with email 3 · with phone 2. */
const CAMPAIGN_LEADS = [
  buildUserRow({
    userId: "aaaaaaaa-0001-4aaa-8aaa-aaaaaaaaaaaa",
    name: "Ada Lovelace",
    email: "ada@assistly.com",
    mobile: "5550000001",
  }),
  buildUserRow({
    userId: "aaaaaaaa-0002-4aaa-8aaa-aaaaaaaaaaaa",
    name: "Grace Hopper",
    email: "grace@assistly.com",
    mobile: "5550000002",
  }),
  buildUserRow({
    userId: "aaaaaaaa-0003-4aaa-8aaa-aaaaaaaaaaaa",
    name: "Alan Turing",
    email: "alan@assistly.com",
    mobile: "",
  }),
  buildUserRow({
    userId: "aaaaaaaa-0004-4aaa-8aaa-aaaaaaaaaaaa",
    name: "Nia Okafor",
    email: "",
    mobile: "",
  }),
];

const buildSender = () => ({
  userId: TEST_USER_ID,
  name: "Test User",
  role: "PCHO",
  homeId: TEST_HOME_ID,
  email: "sender@assistly.com",
  mobile: "5559990000",
});

const campaign = {
  bulkButton: () => cy.contains("button", "Send Bulk Campaign"),
  headerCheckbox: () => cy.get('input[type="checkbox"]').first(),
  modalHeading: () => cy.contains("h2", "Send Bulk Campaign"),
  next: () => cy.contains("button", "Next"),
  sendNow: () => cy.contains("button", /^(Send Now|Sending\.\.\.)$/),
  subject: () => cy.get('textarea[name="subjectDetails"]'),
  message: () => cy.get('textarea[name="message"]'),
  goal: () => cy.get('select[name="campaignType"]'),
  tone: () => cy.get('select[name="tone"]'),
  compose: () => cy.contains("Write Myself"),
  review: () => cy.contains("will view your message"),
};

const visitCampaignLeads = () => {
  cy.clearAuthSession();
  cy.setAuthSession("PCHO");
  cy.stubHome();
  cy.stubUsers(CAMPAIGN_LEADS);
  cy.stubUser(buildSender());
  cy.visit(CRM_PATH);
  cy.wait("@getUsers");
};

const stubSend = () =>
  cy.intercept("PUT", "**/v1/crm/campaign", { statusCode: 200, body: {} }).as("sendCampaign");

const openWizard = () => {
  campaign.headerCheckbox().check({ force: true });
  campaign.bulkButton().click();
  campaign.modalHeading().should("be.visible");
};

const chooseEmail = () => cy.contains("p", "Send email with subject").click();

const gotoCompose = () => {
  openWizard();
  chooseEmail();
  campaign.next().click();
  campaign.compose().should("be.visible");
};

/**
 * Assert an in-modal validation message. The modal body is `max-h-[60vh]
 * overflow-y-auto` and these messages render as its last child, so scroll first
 * — otherwise the assertion measures layout rather than behaviour.
 */
const assertModalError = (text: string) => {
  cy.contains(text).scrollIntoView();
  cy.contains(text).should("be.visible");
};

describe("CRM — known defects", { tags: [Tags.DEFECT, Tags.PCHO] }, () => {
  describe("Send Bulk Campaign", () => {
    beforeEach(() => visitCampaignLeads());

    it("[defect] sends only the recipients the Review step counted", () => {
      // Review says "Recipients (3)" — the leads that actually hold an email —
      // but handleSubmit maps *every* selected lead into campaignUsers, so Nia
      // Okafor (no email, no mobile) is shipped to the campaign service too.
      stubSend();
      gotoCompose();
      campaign.subject().clear().type("Spring open house", { delay: 0 });
      campaign.message().clear().type("Come and visit us this Saturday.", { delay: 0 });
      campaign.next().click();
      cy.contains("Recipients (3)").should("be.visible");
      cy.wait("@getUser");
      campaign.sendNow().click();

      cy.wait("@sendCampaign").then(({ request }) => {
        const names = request.body.campaignUsers.map((u: any) => u.userName);
        expect(names, "recipients on the payload").to.not.include("Nia Okafor");
        expect(request.body.campaignUsers).to.have.length(3);
      });
    });

    it("[defect] does not send an email campaign with an empty subject", () => {
      // The Subject field is never validated and campaignMetadata.subject falls
      // back to keyDetails, which is "" in Write-Myself mode — so an email
      // campaign can go out with no subject line at all.
      //
      // Deliberately NOT `cy.wait("@sendCampaign")`: the likeliest fix is to
      // refuse the send, and waiting on a request that a fixed build never
      // makes would leave this permanently red — looking like the bug survived
      // its own fix. Asserting on what was sent covers both shapes of fix:
      // block the send, or require a subject first.
      stubSend();
      gotoCompose();
      campaign.message().type("Come and visit us this Saturday.", { delay: 0 });
      campaign.next().click();
      cy.wait("@getUser");
      campaign.sendNow().click();

      // A fixed build sends nothing here, so there is no event to wait on —
      // give the request its chance to fire before reading the alias.
      cy.wait(2000);
      cy.get("@sendCampaign.all").then((calls: any[]) => {
        const subjectless = calls.filter(
          (call) => !call.request?.body?.campaignMetadata?.subject
        );
        expect(subjectless, "campaigns sent with an empty subject line").to.have.length(
          0
        );
      });
    });

    it("[defect] enforces the 320-character limit the Email composer advertises", () => {
      // The counter reads "N/320 characters" on the Email step, but validateStep
      // only length-checks SMS — so the promised limit is never applied.
      gotoCompose();
      campaign.message().type("x".repeat(330), { delay: 0 });
      cy.contains("330/320 characters").should("be.visible");

      campaign.next().click();
      assertModalError("Message exceeds 320 characters");
      campaign.review().should("not.exist");
    });

    it("[defect] keeps Write Myself selected when Write Myself is clicked", () => {
      // Toggle calls setToggleState(false)/(true), but campaign-modal ignores the
      // argument and flips `useAI` regardless — so clicking the side that is
      // already active switches the user into the other mode.
      gotoCompose();
      campaign.subject().should("be.visible");

      cy.contains("Write Myself").click();
      campaign.subject().should("be.visible");
    });

    it("[defect] says why Next did nothing when an AI draft is missing", () => {
      // validateStep(2) sets validationErrors.message, but that error is only
      // rendered inside the Write-Myself branch — so in AI mode Next just
      // silently refuses, with nothing on screen to explain it.
      gotoCompose();
      cy.contains("Generate with AI").click();
      campaign.goal().select("welcome");
      campaign.tone().select("warm");
      campaign.next().click();

      assertModalError("Message is required");
    });

    it("[defect] names the audience in the summary heading", () => {
      // audienceLabel = AUDIENCE_LABELS[campaignAudience], but the parent passes
      // the label *value* ("Leads"), not the key — so the lookup is undefined
      // and the heading renders "Selected  (4)".
      openWizard();
      cy.contains("Selected Leads (4)").should("be.visible");
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // 2. Home Tour
  // ═════════════════════════════════════════════════════════════════════════

  describe("Home Tour", () => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateValue = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const timeValue = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const futureSlot = () => {
      const d = new Date(Date.now() + 2 * 60 * 60 * 1000);
      d.setSeconds(0, 0);
      return { date: dateValue(d), time: timeValue(d) };
    };

    /** Walked and marked finished: the only shape that can be "unfinished". */
    const COMPLETED = buildUserRow({
      userId: "aaaaaaaa-0003-4aaa-8aaa-aaaaaaaaaaaa",
      name: "Alan Turing",
      email: "alan@assistly.com",
      milestone: ["initial contact", "tour"],
      tourDateTime: "2026-09-01T15:00:00.000Z",
      isTourCompleted: true,
      tourNotes: "Loved the garden.",
    });

    /** Booked but unfinished, with notes already saved. */
    const NOTED = buildUserRow({
      userId: "aaaaaaaa-0005-4aaa-8aaa-aaaaaaaaaaaa",
      name: "Mary Jackson",
      email: "mary@assistly.com",
      milestone: ["initial contact"],
      tourDateTime: "2026-09-01T15:00:00.000Z",
      tourNotes: "Waiting on the family.",
    });

    /** No address to invite. */
    const NO_EMAIL = buildUserRow({
      userId: "aaaaaaaa-0004-4aaa-8aaa-aaaaaaaaaaaa",
      name: "Nia Okafor",
      email: "",
      milestone: ["initial contact"],
    });

    const tour = {
      scheduleScreen: () => cy.contains("Schedule Home Tour"),
      statusScreen: () => cy.contains("Home Tour Status"),
      date: () => cy.get('input[name="scheduleDate"]'),
      time: () => cy.get('input[name="scheduleTime"]'),
      sendInvitation: () => cy.contains("button", "Send Invitation"),
      yes: () => cy.get("#tour-yes"),
      no: () => cy.get("#tour-no"),
      comments: () => cy.get('textarea[placeholder*="Add comments"]'),
      save: () => cy.contains("button", "Save"),
    };

    /** stage.tsx lays the milestone icons out in a fixed order — tour is 2nd. */
    const openTour = (name: string) =>
      cy
        .contains(name)
        .closest('div[class*="border-b"]')
        .find('div[class*="gap-x-[7px]"] > div')
        .eq(1)
        .find("svg")
        .click({ force: true });

    const visitTourLeads = (users: any[]) => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome();
      cy.stubUsers(users);
      cy.visit(CRM_PATH);
      cy.wait("@getUsers");
    };

    it("[defect] lets a finished tour be marked unfinished again", () => {
      // handleHomeTourStatus bails out when `tourNotes === feedback &&
      // isHomeTourCompleted === false`, treating "No with unchanged notes" as
      // "nothing changed" — so a finished tour cannot be reopened. The modal
      // just closes and the record is untouched.
      visitTourLeads([COMPLETED]);
      cy.intercept("PUT", "**/v1/user/**", { statusCode: 200, body: {} }).as("updateLead");

      openTour("Alan Turing");
      tour.statusScreen().should("be.visible");
      tour.yes().should("be.checked");
      tour.no().click();
      tour.save().click();

      cy.wait("@updateLead").then(({ request }) => {
        expect(request.body.isTourCompleted, "isTourCompleted").to.eq(false);
      });
    });

    it("[defect] drops the tour milestone when the tour is unfinished", () => {
      // Even when the save does fire, the milestone is only ever *added* — there
      // is no removal branch — so the icon stays blue for a tour the user has
      // just marked unfinished.
      visitTourLeads([COMPLETED]);
      cy.intercept("PUT", "**/v1/user/**", { statusCode: 200, body: {} }).as("updateLead");

      openTour("Alan Turing");
      tour.no().click();
      tour.comments().clear().type("Family postponed.");
      tour.save().click();

      cy.wait("@updateLead").then(({ request }) => {
        expect(request.body.milestone, "milestone").to.not.include("tour");
      });
    });

    it("[defect] keeps the status modal open when the save fails", () => {
      // handleHomeTourStatus calls setIsHomeTourModalOpen(false) unconditionally
      // *after* mutate(), outside both callbacks — so the modal closes even on
      // failure, taking the user's typed comments with it. The error popover is
      // shown against a modal that is already gone.
      visitTourLeads([NOTED]);
      cy.intercept("PUT", "**/v1/user/**", { statusCode: 500, body: {} }).as("updateLead");

      openTour("Mary Jackson");
      tour.comments().clear().type("Rescheduling next week.");
      tour.save().click();

      cy.wait("@updateLead");
      cy.assertPopover("Failed to save tour notes. Please try again!");
      cy.dismissPopover();
      tour.statusScreen().should("be.visible");
      tour.comments().should("have.value", "Rescheduling next week.");
    });

    it("[defect] keeps the schedule modal open when the booking fails", () => {
      // handleScheduleHomeTour's onError closes the modal too, so a failed
      // invitation discards the date and time the user just picked.
      visitTourLeads([NOTED]);
      cy.intercept("POST", "**/v1/user/home-tour", { statusCode: 500, body: {} }).as(
        "scheduleTour"
      );
      const when = futureSlot();

      openTour("Mary Jackson");
      cy.contains("button", "Reschedule").click();
      tour.date().clear().type(when.date);
      tour.time().clear().type(when.time);
      tour.sendInvitation().click();

      cy.wait("@scheduleTour");
      cy.assertPopover("Error scheduling home tour");
      cy.dismissPopover();
      tour.scheduleScreen().should("be.visible");
      tour.date().should("have.value", when.date);
    });

    it("[defect] warns about a missing email before the form is filled in", () => {
      // The `!data?.email` guard lives inside the submit handler, so the user
      // picks a date and a time and only then learns the lead has no address.
      // The banner above the button renders "...at  with the date and time",
      // with an empty gap where the address should be.
      //
      // Note this prescribes one particular fix — disabling the button. Warn
      // some other way (an inline message, hiding the form) and this stays red
      // even though the defect is addressed; rewrite it rather than assume the
      // bug is back.
      visitTourLeads([NO_EMAIL]);

      openTour("Nia Okafor");
      tour.scheduleScreen().should("be.visible");
      tour.sendInvitation().should("be.disabled");
    });

    it("[defect] does not promise an invitation it cannot send", () => {
      // Same root cause, stated as the user sees it: the confirmation banner
      // claims an invitation will go out even when there is no address for it.
      visitTourLeads([NO_EMAIL]);

      openTour("Nia Okafor");
      cy.contains("An invitation will be sent to").should("not.exist");
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // 3. Careplan / ADLs
  // ═════════════════════════════════════════════════════════════════════════

  describe("Careplan", () => {
    const LEAD_ID = "aaaaaaaa-0001-4aaa-8aaa-aaaaaaaaaaaa";
    const LEAD_PATH = `/crm/${LEAD_ID}`;

    const buildLead = (overrides: Record<string, any> = {}) =>
      buildUserRow({
        userId: LEAD_ID,
        name: "Ada Lovelace",
        email: "ada@assistly.com",
        milestone: ["initial contact"],
        ...overrides,
      });

    /** ToggleSwitch renders an unlabelled button next to its label span. */
    const templateToggle = () => cy.contains("span", "Use Template").siblings("button");

    const S3_PUT_URL = "https://bucket.s3.amazonaws.com/upload";

    /** The three same-origin hops uploadToS3 + getFileUrl make before extraction. */
    const stubTemplateUpload = () => {
      cy.intercept("POST", "/api/s3/presign-put", {
        statusCode: 200,
        body: { url: S3_PUT_URL },
      }).as("presignPut");
      cy.intercept("PUT", S3_PUT_URL, { statusCode: 200, body: {} }).as("s3Put");
      cy.intercept("POST", "/api/s3/presign-get", {
        statusCode: 200,
        body: { url: "https://bucket.s3.amazonaws.com/carenotes.pdf" },
      }).as("presignGet");
    };

    const stubExtraction = (categories: any[]) =>
      cy
        .intercept("POST", "/api/extract-adls", { statusCode: 200, body: { categories } })
        .as("extractAdls");

    /** Selecting the file is what kicks off the upload and the extraction. */
    const uploadTemplate = () => {
      cy.contains("button", "Use Custom Template").click();
      cy.contains("Upload Custom Template").should("be.visible");
      cy.get('input[type="file"]').selectFile(
        {
          contents: Cypress.Buffer.from("PDF-1.4 stub"),
          fileName: "carenotes.pdf",
          mimeType: "application/pdf",
        },
        { force: true }
      );
    };

    const visitCareplan = () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome();
      cy.stubUsers();
      cy.stubUser(buildLead());
      cy.visit(LEAD_PATH);
      cy.contains("Personal Details", { timeout: 10000 }).should("be.visible");
      cy.settleForm();
      cy.contains("span", "Careplan").click({ force: true });
      cy.contains("ADL Services", { timeout: 10000 }).should("exist");
    };

    it("[defect] reports the API's own message when an ADL save fails", () => {
      // saveCarePlan's onError uses `error.message` — the raw axios string — so
      // the user is shown "Request failed with status code 500" instead of what
      // the API said. Every other tab reads error.response.data.error.
      visitCareplan();
      cy.intercept("PUT", "**/v1/user/**", {
        statusCode: 500,
        body: { error: "Careplan service unavailable" },
      }).as("updateLead");

      cy.contains("button", "Save").click({ force: true });
      cy.wait("@updateLead");
      cy.assertPopover("Careplan service unavailable");
    });

    it("[defect] stays on the ADLs after a template is applied", () => {
      // handleConfirmServices saves, and a successful careplan save moves the
      // sub-tab on to Overall Health — so the services the user just added are
      // whisked away before any care level can be set against them.
      visitCareplan();
      cy.intercept("PUT", "**/v1/user/**", { statusCode: 200, body: {} }).as("updateLead");
      stubTemplateUpload();
      stubExtraction([{ name: "Personal Care", services: ["Shower Assist"] }]);

      templateToggle().click();
      uploadTemplate();
      cy.contains("button", "Confirm").click();

      cy.wait("@updateLead");
      // Still on the ADLs, with the newly applied service ready to be graded.
      cy.get('select[name="carePlan.adl.showerassist.careLevel"]').should("exist");
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // 4. Care & Nurse Leads
  // ═════════════════════════════════════════════════════════════════════════

  describe("Care and Nurse Leads", () => {
    const CARE_LEAD = "Priya Patel";

    const buildCareLead = (overrides: Record<string, any> = {}) =>
      buildUserRow({
        userId: "pppppppp-0001-4ppp-8ppp-pppppppppppp",
        name: CARE_LEAD,
        firstName: "Priya",
        lastName: "Patel",
        email: "priya@assistly.com",
        role: "PCGLead",
        milestone: [],
        ...overrides,
      });

    const item = (label: string) => cy.contains("div", new RegExp(`^${label}$`));

    const visitBoard = (path: string, users: any[]) => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome(buildHome());
      cy.stubUsers(users);
      cy.visit(path);
      cy.wait("@getUsers");
    };

    it("[defect] reports the API's own message when a Care Lead move fails", () => {
      // pcg-action-cell's onError ignores the error entirely and always shows
      // the same sentence, so the user never learns why the move failed.
      visitBoard(PCG_PATH, [buildCareLead()]);
      cy.stubPut("/v1/user", "updateCrm", 500, { error: "Care Lead already in clinical" });

      cy.openRowMenu(CARE_LEAD);
      item("Move to Clinical").click();
      cy.contains("button", "Confirm").click();

      cy.wait("@updateCrm");
      cy.assertPopover("Care Lead already in clinical");
    });

    it("[defect] writes a clinical record when a Care Lead moves to clinical", () => {
      // Senior Leads writes /v1/clinical/user before the CRM record; the Care
      // Lead path only re-roles the CRM record, so nothing is created on the
      // clinical side for the board it then redirects to.
      visitBoard(PCG_PATH, [buildCareLead()]);
      cy.stubPut("/v1/user", "updateCrm", 200, {});
      cy.intercept("PUT", "**/v1/clinical/user/**").as("updateClinical");

      cy.openRowMenu(CARE_LEAD);
      item("Move to Clinical").click();
      cy.contains("button", "Confirm").click();

      cy.wait("@updateCrm");
      cy.get("@updateClinical.all").should("have.length", 1);
    });

    it("[defect] spaces the Care Lead delete confirmation correctly", () => {
      // The message is built as `${"Care Lead "} deleted successfully!`, so it
      // renders with a doubled space in the middle.
      visitBoard(PCG_PATH, [buildCareLead()]);
      cy.stubDelete("/v1/user", "deleteCareLead", 200, {});

      cy.openRowMenu(CARE_LEAD);
      item("Delete").click();
      cy.contains("button", "Confirm").click();

      cy.wait("@deleteCareLead");
      // assertPopover, so the failure prints the doubled-space text it actually
      // found rather than an empty string.
      cy.assertPopover("Care Lead deleted successfully!");
    });
  });
});
