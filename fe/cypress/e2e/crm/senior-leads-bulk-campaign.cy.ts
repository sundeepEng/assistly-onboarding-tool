/// <reference types="cypress" />

/**
 * CRM — Send Bulk Campaign
 *
 * The three-step wizard a PCHO drives from the Senior Leads board:
 *
 *   selection gate   leads-table.tsx -> BaseTable(checkbox) -> setActiveBulkCampaign
 *   step 1 Channel   Email / SMS, each showing how many of the selected leads
 *                    actually carry that contact detail
 *   step 2 Compose   "Write Myself" (subject + message) or "Generate with AI"
 *                    (goal, tone, context, key details -> Generate Draft)
 *   step 3 Review    message preview + recipient count -> Send Now
 *
 * Everything lives in components/referral/campaign-modal.tsx, reused for both
 * the referral board and the senior leads board (`campaignAudience`).
 *
 * Endpoints:
 *   POST /api/generate-campaign-draft   the AI draft (Next route, same origin)
 *   PUT  /v1/crm/campaign               the send (services/upsert.ts, so a PUT)
 *   GET  /v1/user/{id}                  the sender, for campaignSenderEmail
 *
 * This spec should always be green. The wizard's known bugs are asserted in
 * known-defects.cy.ts, which fails on purpose and is run separately.
 */

import { Tags } from "../../framework/utils/tags";
import {
  buildHome,
  buildUserRow,
  TEST_HOME_ID,
  TEST_USER_ID,
} from "../../framework/module-commands";

const CRM_PATH = "/crm";

/**
 * Four leads with deliberately uneven contact details, so the Email and SMS
 * recipient counts differ from each other and from the selection size:
 *   selected 4 · with email 3 · with phone 2
 */
const LEADS = [
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

/** Row indexes into LEADS, for tests that select a specific lead. */
const ROW = { ada: 0, grace: 1, emailOnly: 2, noContact: 3 };

/**
 * The signed-in user, read back by the modal via GET /v1/user/{id}. Send Now
 * refuses to fire without an email (Email) or a mobile (SMS) on this record.
 */
const buildSender = (overrides: Record<string, any> = {}) => ({
  userId: TEST_USER_ID,
  name: "Test User",
  role: "PCHO",
  homeId: TEST_HOME_ID,
  email: "sender@assistly.com",
  mobile: "5559990000",
  ...overrides,
});

const sel = {
  bulkButton: () => cy.contains("button", "Send Bulk Campaign"),
  /** The "select all" checkbox in the table header (the only unnamed one). */
  headerCheckbox: () => cy.get('input[type="checkbox"]').first(),
  /** Per-row checkboxes — base-table.tsx renders these with name="row". */
  rowCheckboxes: () => cy.get('input[name="row"]'),
  modal: () => cy.get(".ReactModal__Content"),
  modalHeading: () => cy.contains("h2", "Send Bulk Campaign"),
  closeModal: () => cy.get(".ReactModal__Content div.absolute.top-4.right-6"),
  next: () => cy.contains("button", "Next"),
  back: () => cy.contains("button", "Back"),
  sendNow: () => cy.contains("button", /^(Send Now|Sending\.\.\.)$/),
  generateDraft: () => cy.contains("button", "Generate Draft"),
  /** The Email channel card's text column (title, blurb, recipient count). */
  emailCard: () => cy.contains("p", "Send email with subject").parent(),
  smsCard: () => cy.contains("p", "Send short text message").parent(),
  subject: () => cy.get('textarea[name="subjectDetails"]'),
  message: () => cy.get('textarea[name="message"]'),
  goal: () => cy.get('select[name="campaignType"]'),
  tone: () => cy.get('select[name="tone"]'),
  eventContext: () => cy.get('textarea[name="eventContext"]'),
  keyDetails: () => cy.get('textarea[name="keyDetails"]'),
};

const step = {
  channel: () => cy.contains("Audience Summary"),
  compose: () => cy.contains("Write Myself"),
  /** Only step 3 carries the recipient sentence, so it identifies the step. */
  review: () => cy.contains("will view your message"),
};

/**
 * Which step the wizard is showing — by presence, not visibility.
 *
 * Use these instead of `step.x().should("be.visible")` in any test that has put
 * an error on screen. Two things make a visibility assertion unreliable there:
 * `assertModalError` leaves the modal body scrolled to its last child, which
 * pushes each step's heading back out of the clip region; and the red banner
 * renders above the content and can cover it. Cypress calls a clipped or
 * covered element hidden, so the assertion starts measuring layout rather than
 * behaviour. Which step is mounted is the thing under test.
 */
const onChannel = () => {
  step.channel().should("exist");
  step.compose().should("not.exist");
};

const onCompose = () => {
  step.compose().should("exist");
  step.review().should("not.exist");
};

/**
 * Assert an in-modal validation message.
 *
 * Both validation paragraphs — `validationErrors.channel` on step 1 and
 * `validationErrors.message` on step 2 — render as the *last* child of the
 * modal body, which is `max-h-[60vh] overflow-y-auto`. Measured on a 1280x800
 * viewport, the step-1 error's bottom edge lands ~5px past the container's, so
 * it is clipped at scrollTop 0 and Cypress reports a clipped element as hidden.
 * A bare `should("be.visible")` therefore sits on a five-pixel cliff that font
 * metrics, scrollbar width or one extra audience row is enough to tip.
 *
 * Scrolling first is what a real user does to read it, and it makes the
 * assertion independent of where the message happens to land.
 */
const assertModalError = (text: string) => {
  cy.contains(text).scrollIntoView();
  cy.contains(text).should("be.visible");
};

// ── Campaign History ─────────────────────────────────────────────────────────
// The history table reads `home.campaigns` off GET /v1/home/{id} and filters it
// to the board's own campaignType — there is no campaigns endpoint.

/** A campaign as it is stored on the home record, i.e. the send payload. */
const buildCampaign = (overrides: Record<string, any> = {}) => ({
  campaignId: "cccccccc-0001-4ccc-8ccc-cccccccccccc",
  campaignType: "SENIOR",
  campaignChannel: "EMAIL",
  campaignCreatedByUserId: TEST_USER_ID,
  campaignMetadata: { subject: "Spring open house", body: "Come and see us." },
  // AS-BUILT: the history table counts only channel-valid recipients — the
  // entries carry the same fields the real send payload does.
  campaignUsers: [
    {
      userId: "aaaaaaaa-0001-4aaa-8aaa-aaaaaaaaaaaa",
      userName: "Ada Lovelace",
      userEmail: "ada@assistly.com",
      userMobile: "5550000001",
    },
    {
      userId: "aaaaaaaa-0002-4aaa-8aaa-aaaaaaaaaaaa",
      userName: "Grace Hopper",
      userEmail: "grace@assistly.com",
      userMobile: "5550000002",
    },
  ],
  createdAt: "2026-04-20T10:00:00.000Z",
  ...overrides,
});

/** Column positions in campaign-table.tsx, left to right. */
const COL = {
  channel: 0,
  subject: 1,
  recipients: 2,
  /** Headed "Status", but it renders the created date. */
  date: 3,
  sent: 4,
  createdBy: 5,
};

const historyRow = (text: string) =>
  cy.contains(text).closest('div[class*="border-b"]');

/** One cell of the row containing `text`. base-table lays cells out in a grid. */
const historyCell = (text: string, index: number) =>
  historyRow(text).find('div[style*="grid"] > div').eq(index);

/**
 * The date the history table shows for a campaign.
 *
 * campaign-table.tsx splits the ISO timestamp at "T" and formats what is left,
 * so the cell carries the **UTC** calendar date. Building the expectation from
 * `new Date()` locally would compare that against the *local* date, and the two
 * disagree for the first hours of every day east of UTC — in IST (UTC+5:30),
 * any run between 00:00 and 05:30 sees the table a day behind. Deriving it from
 * the payload the app sent keeps the assertion correct in every timezone and at
 * every hour.
 */
const formattedDate = (isoTimestamp: string) => {
  const [year, month, day] = isoTimestamp.split("T")[0].split("-");
  return `${month}/${day}/${year}`;
};

const visitLeads = (
  users: any[] = LEADS,
  sender: Record<string, any> = buildSender()
) => {
  cy.clearAuthSession();
  cy.setAuthSession("PCHO");
  cy.stubHome();
  cy.stubUsers(users);
  cy.stubUser(sender);
  cy.visit(CRM_PATH);
  cy.wait("@getUsers");
};

/** Stub the send. `stubPut` appends `/**`, which never matches this id-less URL. */
const stubSend = (statusCode = 200, body: any = {}) =>
  cy.intercept("PUT", "**/v1/crm/campaign", { statusCode, body }).as("sendCampaign");

const stubDraft = (draft: string, delay = 0) =>
  cy
    .intercept("POST", "**/api/generate-campaign-draft", {
      statusCode: 200,
      body: { draft },
      delay,
    })
    .as("generateDraft");

const stubDraftFailure = (statusCode = 500, body: any = { error: "LLM unavailable" }) =>
  cy.intercept("POST", "**/api/generate-campaign-draft", { statusCode, body }).as(
    "generateDraft"
  );

/** Select every selectable lead and open the wizard. */
const openWizard = () => {
  sel.headerCheckbox().check({ force: true });
  sel.bulkButton().click();
  sel.modalHeading().should("be.visible");
};

/** Select just the rows at `indexes` and open the wizard. */
const openWizardWith = (...indexes: number[]) => {
  indexes.forEach((i) => sel.rowCheckboxes().eq(i).check({ force: true }));
  sel.bulkButton().click();
  sel.modalHeading().should("be.visible");
};

// The channel cards put their click handler on a wrapper div, so clicking the
// blurb inside them bubbles up to it.
const chooseEmail = () => cy.contains("p", "Send email with subject").click();
const chooseSms = () => cy.contains("p", "Send short text message").click();

/** Open the wizard on every lead, pick a channel, and land on Compose. */
const gotoCompose = (channel: "email" | "sms" = "email") => {
  openWizard();
  if (channel === "email") chooseEmail();
  else chooseSms();
  sel.next().click();
  step.compose().should("be.visible");
};

const composeManually = ({
  subject = "Spring open house",
  message = "Come and visit us this Saturday.",
} = {}) => {
  if (subject) sel.subject().clear().type(subject, { delay: 0 });
  if (message) sel.message().clear().type(message, { delay: 0 });
};

/** The whole Write-Myself happy path, stopping on Review. */
const gotoReview = (channel: "email" | "sms" = "email", copy = {}) => {
  gotoCompose(channel);
  composeManually(copy);
  sel.next().click();
  step.review().should("be.visible");
};

describe("CRM — Send Bulk Campaign", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. The selection gate
  // ──────────────────────────────────────────────────────────────────────────

  describe("Selection gate", () => {
    beforeEach(() => visitLeads());

    it("keeps Send Bulk Campaign disabled while nothing is selected", () => {
      sel.bulkButton().should("be.disabled");
    });

    it("enables Send Bulk Campaign as soon as one lead is ticked", () => {
      // base-table.tsx toggleRow: setActiveBulkCampaign(next.size > 0) — a
      // single selection is enough, there is no two-lead minimum.
      sel.rowCheckboxes().eq(ROW.ada).check({ force: true });
      sel.bulkButton().should("not.be.disabled");
    });

    it("enables Send Bulk Campaign when several leads are ticked", () => {
      sel.rowCheckboxes().eq(ROW.ada).check({ force: true });
      sel.rowCheckboxes().eq(ROW.grace).check({ force: true });
      sel.bulkButton().should("not.be.disabled");
    });

    it("enables Send Bulk Campaign from the select-all checkbox", () => {
      sel.headerCheckbox().check({ force: true });
      sel.rowCheckboxes().should("be.checked");
      sel.bulkButton().should("not.be.disabled");
    });

    it("disables Send Bulk Campaign again once the last lead is unticked", () => {
      sel.rowCheckboxes().eq(ROW.ada).check({ force: true });
      sel.bulkButton().should("not.be.disabled");

      sel.rowCheckboxes().eq(ROW.ada).uncheck({ force: true });
      sel.bulkButton().should("be.disabled");
    });

    it("clears the whole selection when select-all is unticked", () => {
      sel.headerCheckbox().check({ force: true });
      sel.headerCheckbox().uncheck({ force: true });

      sel.rowCheckboxes().should("not.be.checked");
      sel.bulkButton().should("be.disabled");
    });

    it("does not open the wizard while the button is disabled", () => {
      sel.bulkButton().click({ force: true });
      sel.modalHeading().should("not.exist");
    });

    it("opens the wizard on Channel once leads are selected", () => {
      openWizardWith(ROW.ada);
      step.channel().should("be.visible");
      ["Channel", "Compose", "Review"].forEach((label) =>
        sel.modal().should("contain.text", label)
      );
    });

    it("leaves a lost lead out of reach of the campaign", () => {
      visitLeads([
        ...LEADS,
        buildUserRow({
          userId: "aaaaaaaa-0005-4aaa-8aaa-aaaaaaaaaaaa",
          name: "Gone Away",
          milestone: ["initial contact", "lost"],
        }),
      ]);

      // leads-table.tsx passes isRowDisabled for lost leads, so select-all skips
      // them and their own checkbox cannot be ticked.
      sel.rowCheckboxes().eq(4).should("be.disabled");
      sel.headerCheckbox().check({ force: true });
      sel.rowCheckboxes().eq(4).should("not.be.checked");

      sel.bulkButton().click();
      sel.modal().should("not.contain.text", "Gone Away");
    });

    it("resets the selection when the wizard is closed", () => {
      // handleSetCampaignModal(false) bumps resetSelectionKey, which clears the
      // table's selection and disables the button again.
      openWizard();
      sel.closeModal().click();

      sel.modalHeading().should("not.exist");
      sel.rowCheckboxes().should("not.be.checked");
      sel.bulkButton().should("be.disabled");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Step 1 — Channel
  // ──────────────────────────────────────────────────────────────────────────

  describe("Step 1 — Channel", () => {
    beforeEach(() => visitLeads());

    it("summarises how many leads were selected", () => {
      openWizard();
      sel.modal().should("contain.text", "(4)");
    });

    it("lists every selected lead by name", () => {
      openWizard();
      ["Ada Lovelace", "Grace Hopper", "Alan Turing", "Nia Okafor"].forEach((name) =>
        sel.modal().should("contain.text", name)
      );
    });

    it("lists only the leads that were actually ticked", () => {
      openWizardWith(ROW.ada, ROW.grace);

      sel.modal().should("contain.text", "(2)");
      sel.modal().should("contain.text", "Ada Lovelace");
      sel.modal().should("contain.text", "Grace Hopper");
      sel.modal().should("not.contain.text", "Nia Okafor");
    });

    it("offers both channels", () => {
      openWizard();
      sel.emailCard().should("contain.text", "Email");
      sel.smsCard().should("contain.text", "SMS");
    });

    it("counts only the leads holding an email as valid Email recipients", () => {
      // 3 of the 4 have an email address.
      openWizard();
      sel.emailCard().should("contain.text", "3 valid recipients");
    });

    it("counts only the leads holding a mobile as valid SMS recipients", () => {
      // 2 of the 4 have a phone number.
      openWizard();
      sel.smsCard().should("contain.text", "2 valid recipients");
    });

    it("re-counts against a narrower selection", () => {
      openWizardWith(ROW.emailOnly);
      sel.emailCard().should("contain.text", "1 valid recipients");
      sel.smsCard().should("contain.text", "0 valid recipients");
    });

    it("highlights the Email card once it is picked", () => {
      openWizard();
      chooseEmail();
      cy.contains("p", "Send email with subject")
        .closest("div.border-2")
        .should("have.class", "border-blue-500");
    });

    it("highlights the SMS card once it is picked", () => {
      openWizard();
      chooseSms();
      cy.contains("p", "Send short text message")
        .closest("div.border-2")
        .should("have.class", "border-green-600");
    });

    it("lets the user swap the channel before moving on", () => {
      openWizard();
      chooseEmail();
      chooseSms();

      cy.contains("p", "Send short text message")
        .closest("div.border-2")
        .should("have.class", "border-green-600");
      cy.contains("p", "Send email with subject")
        .closest("div.border-2")
        .should("not.have.class", "border-blue-500");
    });

    it("advances to Compose once a channel is chosen", () => {
      openWizard();
      chooseEmail();
      sel.next().click();
      onCompose();
    });

    // ── negative ────────────────────────────────────────────────────────────

    it("refuses to advance with no channel chosen", () => {
      openWizard();
      sel.next().click();

      assertModalError("Please select a channel");
      onChannel();
    });

    it("clears the channel error once a channel is picked and Next retried", () => {
      openWizard();
      sel.next().click();
      assertModalError("Please select a channel");

      chooseEmail();
      sel.next().click();
      onCompose();
    });

    it("blocks an Email campaign when no selected lead has an email", () => {
      openWizardWith(ROW.noContact);
      chooseEmail();
      sel.next().click();

      cy.contains(
        "No selected users have a valid email address. Please select users with email addresses to start the email campaign."
      ).should("be.visible");
      onChannel();
    });

    it("blocks an SMS campaign when no selected lead has a phone number", () => {
      openWizardWith(ROW.emailOnly);
      chooseSms();
      sel.next().click();

      cy.contains(
        "No selected users have a valid phone number. Please select users with phone numbers to start the SMS campaign."
      ).should("be.visible");
      onChannel();
    });

    it("lets the user recover by switching to the channel that has recipients", () => {
      openWizardWith(ROW.emailOnly);
      chooseSms();
      sel.next().click();
      cy.contains("No selected users have a valid phone number.").should("be.visible");

      chooseEmail();
      sel.next().click();
      onCompose();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Step 2 — Compose, "Write Myself"
  // ──────────────────────────────────────────────────────────────────────────

  describe("Step 2 — Compose (Write Myself)", () => {
    beforeEach(() => visitLeads());

    it("opens on Write Myself with the manual fields", () => {
      gotoCompose("email");
      sel.subject().should("be.visible");
      sel.message().should("be.visible");
      cy.contains("Email Message").should("be.visible");
    });

    it("labels the body for the chosen channel", () => {
      gotoCompose("sms");
      cy.contains("Sms Message").should("be.visible");
    });

    it("starts the character counter at zero", () => {
      gotoCompose("email");
      cy.contains("0/320 characters").should("be.visible");
    });

    it("counts characters as the message is typed", () => {
      gotoCompose("email");
      sel.message().type("Hello", { delay: 0 });
      cy.contains("5/320 characters").should("be.visible");
    });

    it("accepts a subject and a message and advances to Review", () => {
      gotoCompose("email");
      composeManually();
      sel.next().click();
      step.review().should("be.visible");
    });

    it("carries the typed message through to the Review preview", () => {
      gotoCompose("email");
      composeManually({ message: "Come and visit us this Saturday." });
      sel.next().click();
      sel.modal().should("contain.text", "Come and visit us this Saturday.");
    });

    it("keeps the draft when the user steps back to Compose", () => {
      gotoReview("email");
      sel.back().click();
      sel.message().should("have.value", "Come and visit us this Saturday.");
      sel.subject().should("have.value", "Spring open house");
    });

    it("keeps the chosen channel when the user steps back to Channel", () => {
      gotoCompose("sms");
      sel.back().click();
      cy.contains("p", "Send short text message")
        .closest("div.border-2")
        .should("have.class", "border-green-600");
    });

    it("accepts a 320-character SMS", () => {
      gotoCompose("sms");
      sel.message().type("x".repeat(320), { delay: 0 });
      sel.next().click();
      step.review().should("be.visible");
    });

    // ── negative ────────────────────────────────────────────────────────────

    it("refuses to advance with an empty message", () => {
      gotoCompose("email");
      sel.next().click();

      assertModalError("Message is required");
      onCompose();
    });

    it("treats a whitespace-only message as empty", () => {
      gotoCompose("email");
      sel.message().type("    ", { delay: 0 });
      sel.next().click();

      assertModalError("Message is required");
      onCompose();
    });

    it("rejects an SMS longer than 320 characters", () => {
      gotoCompose("sms");
      sel.message().type("x".repeat(321), { delay: 0 });
      sel.next().click();

      assertModalError("Message exceeds 320 characters");
      onCompose();
    });

    it("lets the user trim an over-long SMS and continue", () => {
      gotoCompose("sms");
      sel.message().type("x".repeat(321), { delay: 0 });
      sel.next().click();
      assertModalError("Message exceeds 320 characters");

      sel.message().clear().type("Short and sweet.", { delay: 0 });
      sel.next().click();
      step.review().should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Step 2 — Compose, "Generate with AI"
  // ──────────────────────────────────────────────────────────────────────────

  describe("Step 2 — Compose (Generate with AI)", () => {
    const switchToAI = () => cy.contains("Generate with AI").click();

    beforeEach(() => visitLeads());

    it("swaps the manual fields for the AI inputs", () => {
      gotoCompose("email");
      switchToAI();

      cy.contains("Campaign Goal").should("be.visible");
      cy.contains("Tone").should("be.visible");
      cy.contains("Event/Context").should("be.visible");
      cy.contains("Key Details").should("be.visible");
      sel.subject().should("not.exist");
    });

    it("offers every campaign goal", () => {
      gotoCompose("email");
      switchToAI();

      ["Update", "Follow-Up", "Welcome", "Event Recap", "General Announcement"].forEach(
        (option) => sel.goal().contains(option).should("exist")
      );
    });

    it("offers every tone", () => {
      gotoCompose("email");
      switchToAI();

      ["Warm", "Friendly", "Professional"].forEach((option) =>
        sel.tone().contains(option).should("exist")
      );
    });

    it("starts with no goal and no tone selected", () => {
      gotoCompose("email");
      switchToAI();

      sel.goal().should("have.value", "");
      sel.tone().should("have.value", "");
    });

    it("generates a draft and shows it in the preview", () => {
      stubDraft("Subject: Spring open house\n\nHi [Name],\n\nCome and see us.");
      gotoCompose("email");
      switchToAI();

      sel.goal().select("welcome");
      sel.tone().select("warm");
      sel.generateDraft().click();

      cy.wait("@generateDraft");
      cy.contains("Message Preview").should("be.visible");
      sel.message().should("contain.value", "Hi [Name],");
      cy.contains("Your changes are saved automatically").should("be.visible");
    });

    it("lifts a leading 'Subject:' line out of an email draft", () => {
      // parseEmailDraft strips the subject line so it can be sent separately —
      // the body left in the preview must no longer carry it.
      stubDraft("Subject: Spring open house\n\nHi [Name],\n\nCome and see us.");
      gotoCompose("email");
      switchToAI();

      sel.goal().select("welcome");
      sel.tone().select("warm");
      sel.generateDraft().click();
      cy.wait("@generateDraft");

      sel.message().should("not.contain.value", "Subject:");
    });

    it("leaves an SMS draft untouched", () => {
      // Only the email branch runs parseEmailDraft.
      stubDraft("Subject: not a header for SMS");
      gotoCompose("sms");
      switchToAI();

      sel.goal().select("update");
      sel.tone().select("friendly");
      sel.generateDraft().click();
      cy.wait("@generateDraft");

      sel.message().should("have.value", "Subject: not a header for SMS");
    });

    it("sends the chosen goal, tone, context and key details to the draft API", () => {
      stubDraft("Hi [Name], see you Saturday.");
      gotoCompose("email");
      switchToAI();

      sel.goal().select("recap");
      sel.tone().select("professional");
      sel.eventContext().type("Autumn open house", { delay: 0 });
      sel.keyDetails().type("Saturday 2pm, main hall", { delay: 0 });
      sel.generateDraft().click();

      cy.wait("@generateDraft").then(({ request }) => {
        expect(request.body.campaignType).to.eq("recap");
        expect(request.body.tone).to.eq("professional");
        expect(request.body.eventContext).to.eq("Autumn open house");
        expect(request.body.keyDetails).to.eq("Saturday 2pm, main hall");
        expect(request.body.channel).to.eq("EMAIL");
      });
    });

    it("shows a loader while the draft is being generated", () => {
      stubDraft("Hi [Name], see you Saturday.", 2000);
      gotoCompose("email");
      switchToAI();

      sel.goal().select("welcome");
      sel.tone().select("warm");
      sel.generateDraft().click();

      // `exist`, not `be.visible`: the loader renders below the fold of the
      // modal's own scroll container, and Cypress calls clipped content invisible.
      cy.contains("Generating AI draft...").should("exist");
      cy.wait("@generateDraft");
      cy.contains("Generating AI draft...").should("not.exist");
    });

    it("lets the user edit the generated draft before continuing", () => {
      stubDraft("Hi [Name], see you Saturday.");
      gotoCompose("email");
      switchToAI();

      sel.goal().select("welcome");
      sel.tone().select("warm");
      sel.generateDraft().click();
      cy.wait("@generateDraft");

      sel.message().clear().type("Hi Ada, see you Saturday.", { delay: 0 });
      sel.next().click();
      sel.modal().should("contain.text", "Hi Ada, see you Saturday.");
    });

    it("replaces the draft when it is regenerated", () => {
      stubDraft("First attempt.");
      gotoCompose("email");
      switchToAI();

      sel.goal().select("welcome");
      sel.tone().select("warm");
      sel.generateDraft().click();
      cy.wait("@generateDraft");
      sel.message().should("have.value", "First attempt.");

      stubDraft("Second attempt.");
      sel.tone().select("friendly");
      sel.generateDraft().click();
      cy.wait("@generateDraft");
      sel.message().should("have.value", "Second attempt.");
    });

    it("carries an AI draft through to Review", () => {
      stubDraft("Hi [Name], see you Saturday.");
      gotoCompose("email");
      switchToAI();

      sel.goal().select("welcome");
      sel.tone().select("warm");
      sel.generateDraft().click();
      cy.wait("@generateDraft");

      sel.next().click();
      step.review().should("be.visible");
      sel.modal().should("contain.text", "Hi [Name], see you Saturday.");
    });

    it("lets an over-long AI-generated SMS through with a warning", () => {
      // validateStep: an AI draft over 320 chars is allowed, but the user is
      // told about it rather than being silently truncated.
      stubDraft("x".repeat(400));
      gotoCompose("sms");
      switchToAI();

      sel.goal().select("update");
      sel.tone().select("warm");
      sel.generateDraft().click();
      cy.wait("@generateDraft");

      sel.next().click();
      cy.assertPopover("AI-generated SMS message exceeds 320 characters, allowing it");
    });

    // ── negative ────────────────────────────────────────────────────────────

    it("keeps Generate Draft disabled until both goal and tone are chosen", () => {
      gotoCompose("email");
      switchToAI();

      sel.generateDraft().should("be.disabled");

      sel.goal().select("welcome");
      sel.generateDraft().should("be.disabled");

      sel.tone().select("warm");
      sel.generateDraft().should("not.be.disabled");
    });

    it("keeps Generate Draft disabled when only a tone is chosen", () => {
      gotoCompose("email");
      switchToAI();

      sel.tone().select("warm");
      sel.generateDraft().should("be.disabled");
    });

    it("re-disables Generate Draft if the goal is cleared again", () => {
      gotoCompose("email");
      switchToAI();

      sel.goal().select("welcome");
      sel.tone().select("warm");
      sel.generateDraft().should("not.be.disabled");

      sel.goal().select("");
      sel.generateDraft().should("be.disabled");
    });

    it("reports a failed draft request and shows no preview", () => {
      stubDraftFailure(500);
      gotoCompose("email");
      switchToAI();

      sel.goal().select("welcome");
      sel.tone().select("warm");
      sel.generateDraft().click();

      cy.wait("@generateDraft");
      cy.contains("Failed to generate draft").should("be.visible");
      sel.message().should("not.exist");
      onCompose();
    });

    it("reports a 200 that carries no draft content", () => {
      cy.intercept("POST", "**/api/generate-campaign-draft", {
        statusCode: 200,
        body: {},
      }).as("generateDraft");
      gotoCompose("email");
      switchToAI();

      sel.goal().select("welcome");
      sel.tone().select("warm");
      sel.generateDraft().click();

      cy.wait("@generateDraft");
      cy.contains("Failed to generate draft").should("be.visible");
      sel.message().should("not.exist");
    });

    it("lets the user retry after a failed draft", () => {
      stubDraftFailure(500);
      gotoCompose("email");
      switchToAI();

      sel.goal().select("welcome");
      sel.tone().select("warm");
      sel.generateDraft().click();
      cy.wait("@generateDraft");
      cy.contains("Failed to generate draft").should("be.visible");

      stubDraft("Hi [Name], see you Saturday.");
      sel.generateDraft().click();
      cy.wait("@generateDraft");
      sel.message().should("have.value", "Hi [Name], see you Saturday.");
    });

    it("refuses to advance from AI mode before a draft exists", () => {
      // validateStep(2) blocks the move — silently, though: see the matching
      // entry in known-defects.cy.ts for the error message that never renders.
      gotoCompose("email");
      switchToAI();

      sel.goal().select("welcome");
      sel.tone().select("warm");
      sel.next().click();

      onCompose();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Step 3 — Review & Send
  // ──────────────────────────────────────────────────────────────────────────

  describe("Step 3 — Review & Send", () => {
    beforeEach(() => visitLeads());

    it("previews the message that will go out", () => {
      gotoReview("email", { message: "Come and visit us this Saturday." });
      cy.contains("Message Preview").should("be.visible");
      sel.modal().should("contain.text", "Come and visit us this Saturday.");
    });

    it("reports how many people will receive an Email campaign", () => {
      gotoReview("email");
      cy.contains("Recipients (3)").should("be.visible");
      cy.contains("3 will view your message").should("be.visible");
    });

    it("reports how many people will receive an SMS campaign", () => {
      gotoReview("sms");
      cy.contains("Recipients (2)").should("be.visible");
      cy.contains("2 will view your message").should("be.visible");
    });

    it("offers Send Now instead of Next on the last step", () => {
      gotoReview("email");
      sel.sendNow().should("be.visible");
      cy.contains("button", "Next").should("not.exist");
    });

    it("sends the campaign and confirms it", () => {
      stubSend();
      gotoReview("email");
      cy.wait("@getUser");

      sel.sendNow().click();

      cy.wait("@sendCampaign");
      cy.assertPopover("Campaign created Successfully!");
    });

    it("closes the wizard after a successful send", () => {
      stubSend();
      gotoReview("email");
      cy.wait("@getUser");

      sel.sendNow().click();

      cy.wait("@sendCampaign");
      sel.modalHeading().should("not.exist");
    });

    it("clears the table selection after a successful send", () => {
      stubSend();
      gotoReview("email");
      cy.wait("@getUser");

      sel.sendNow().click();
      cy.wait("@sendCampaign");

      sel.rowCheckboxes().should("not.be.checked");
      sel.bulkButton().should("be.disabled");
    });

    it("shows a sending state while the request is in flight", () => {
      cy.intercept("PUT", "**/v1/crm/campaign", {
        statusCode: 200,
        body: {},
        delay: 1000,
      }).as("sendCampaign");
      gotoReview("email");
      cy.wait("@getUser");

      sel.sendNow().click();
      cy.contains("button", "Sending...").should("be.disabled");
      cy.wait("@sendCampaign");
    });

    it("lets the user go back and edit before sending", () => {
      stubSend();
      gotoReview("email");
      cy.wait("@getUser");

      sel.back().click();
      sel.message().clear().type("Revised invitation.", { delay: 0 });
      sel.next().click();
      sel.sendNow().click();

      cy.wait("@sendCampaign").then(({ request }) => {
        expect(request.body.campaignMetadata.body).to.eq("Revised invitation.");
      });
    });

    // ── negative ────────────────────────────────────────────────────────────

    it("reports a failed send and keeps the wizard open", () => {
      stubSend(500, { error: "Campaign service unavailable" });
      gotoReview("email");
      cy.wait("@getUser");

      sel.sendNow().click();

      cy.wait("@sendCampaign");
      cy.assertPopover("Failed to send campaign. Please try again.");
      cy.dismissPopover();
      step.review().should("be.visible");
    });

    it("lets the user retry after a failed send", () => {
      stubSend(500, { error: "Campaign service unavailable" });
      gotoReview("email");
      cy.wait("@getUser");

      sel.sendNow().click();
      cy.wait("@sendCampaign");
      cy.assertPopover("Failed to send campaign. Please try again.");
      cy.dismissPopover();

      stubSend(200);
      sel.sendNow().click();
      cy.wait("@sendCampaign");
      cy.assertPopover("Campaign created Successfully!");
    });

    it("refuses to send an Email campaign when the sender has no email", () => {
      // handleSubmit needs campaignSenderEmail on the outgoing payload.
      visitLeads(LEADS, buildSender({ email: "" }));
      stubSend();
      gotoReview("email");
      cy.wait("@getUser");

      sel.sendNow().click();

      cy.contains("Unable to determine sender email. Please try again.").should(
        "be.visible"
      );
      cy.assertNoRequest("@sendCampaign");
    });

    it("refuses to send an SMS campaign when the sender has no mobile", () => {
      visitLeads(LEADS, buildSender({ mobile: "" }));
      stubSend();
      gotoReview("sms");
      cy.wait("@getUser");

      sel.sendNow().click();

      cy.contains("Unable to determine sender mobile number. Please try again.").should(
        "be.visible"
      );
      cy.assertNoRequest("@sendCampaign");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. API contract — PUT /v1/crm/campaign
  // ──────────────────────────────────────────────────────────────────────────

  describe("API contract — PUT /v1/crm/campaign", () => {
    beforeEach(() => {
      visitLeads();
      stubSend();
    });

    const send = (channel: "email" | "sms" = "email", copy = {}) => {
      gotoReview(channel, copy);
      cy.wait("@getUser");
      sel.sendNow().click();
    };

    it("sends the campaign as a PUT to /v1/crm/campaign", () => {
      send();
      cy.wait("@sendCampaign").then(({ request }) => {
        expect(request.method).to.eq("PUT");
        expect(request.url).to.include("/v1/crm/campaign");
      });
    });

    it("authenticates with the session id token", () => {
      send();
      cy.wait("@sendCampaign");
      cy.assertAuthorized("@sendCampaign");
    });

    it("scopes the campaign to the signed-in user's home", () => {
      send();
      cy.wait("@sendCampaign").then(({ request }) => {
        expect(request.body.homeId).to.eq(TEST_HOME_ID);
        expect(request.body.campaignCreatedByUserId).to.eq(TEST_USER_ID);
      });
    });

    it("stamps the campaign as SENIOR from the leads board", () => {
      // campaign-modal.tsx derives this from campaignAudience; the referral
      // board sends REFERRAL through the same component.
      send();
      cy.wait("@sendCampaign").then(({ request }) => {
        expect(request.body.campaignType).to.eq("SENIOR");
      });
    });

    it("reports the chosen channel", () => {
      send("email");
      cy.wait("@sendCampaign").then(({ request }) => {
        expect(request.body.campaignChannel).to.eq("EMAIL");
      });
    });

    it("reports SMS as the channel for a text campaign", () => {
      send("sms");
      cy.wait("@sendCampaign").then(({ request }) => {
        expect(request.body.campaignChannel).to.eq("SMS");
      });
    });

    it("carries a fresh campaign id", () => {
      send();
      cy.wait("@sendCampaign").then(({ request }) => {
        expect(request.body.campaignId).to.match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );
      });
    });

    it("carries the subject and body the user typed", () => {
      send("email", { subject: "Spring open house", message: "Come and see us." });
      cy.wait("@sendCampaign").then(({ request }) => {
        expect(request.body.campaignMetadata.subject).to.eq("Spring open house");
        expect(request.body.campaignMetadata.body).to.eq("Come and see us.");
      });
    });

    it("converts the message's line breaks to <br> for the email body", () => {
      send("email", { message: "Hi there,{enter}{enter}See you Saturday." });
      cy.wait("@sendCampaign").then(({ request }) => {
        expect(request.body.campaignMetadata.body).to.eq(
          "Hi there,<br><br>See you Saturday."
        );
      });
    });

    it("identifies each recipient by id, name, email and mobile", () => {
      send();
      cy.wait("@sendCampaign").then(({ request }) => {
        const ada = request.body.campaignUsers.find(
          (u: any) => u.userName === "Ada Lovelace"
        );
        expect(ada).to.deep.include({
          userId: "aaaaaaaa-0001-4aaa-8aaa-aaaaaaaaaaaa",
          userName: "Ada Lovelace",
          userEmail: "ada@assistly.com",
          userMobile: "5550000001",
        });
      });
    });

    it("carries the sender's email so replies have somewhere to land", () => {
      send();
      cy.wait("@sendCampaign").then(({ request }) => {
        expect(request.body.campaignSenderEmail).to.eq("sender@assistly.com");
      });
    });

    it("timestamps the campaign", () => {
      send();
      cy.wait("@sendCampaign").then(({ request }) => {
        expect(new Date(request.body.createdAt).toString()).to.not.eq("Invalid Date");
      });
    });

    it("falls back to the AI key details when no subject was captured", () => {
      // campaignMetadata.subject = subjectDetails || keyDetails.
      stubDraft("Hi [Name], see you Saturday.");
      gotoCompose("email");
      cy.contains("Generate with AI").click();
      sel.goal().select("welcome");
      sel.tone().select("warm");
      sel.keyDetails().type("Saturday 2pm, main hall", { delay: 0 });
      sel.generateDraft().click();
      cy.wait("@generateDraft");
      sel.next().click();
      cy.wait("@getUser");
      sel.sendNow().click();

      cy.wait("@sendCampaign").then(({ request }) => {
        expect(request.body.campaignMetadata.subject).to.eq("Saturday 2pm, main hall");
      });
    });

    it("uses the subject the AI put on the draft", () => {
      stubDraft("Subject: Spring open house\n\nHi [Name], see you Saturday.");
      gotoCompose("email");
      cy.contains("Generate with AI").click();
      sel.goal().select("welcome");
      sel.tone().select("warm");
      sel.generateDraft().click();
      cy.wait("@generateDraft");
      sel.next().click();
      cy.wait("@getUser");
      sel.sendNow().click();

      cy.wait("@sendCampaign").then(({ request }) => {
        expect(request.body.campaignMetadata.subject).to.eq("Spring open house");
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. End-to-end journeys
  // ──────────────────────────────────────────────────────────────────────────

  describe("End-to-end journeys", () => {
    beforeEach(() => visitLeads());

    it("E2E — select all, write an email by hand, review and send", () => {
      stubSend();

      sel.bulkButton().should("be.disabled");
      sel.headerCheckbox().check({ force: true });
      sel.bulkButton().should("not.be.disabled").click();

      // Step 1
      step.channel().should("be.visible");
      sel.emailCard().should("contain.text", "3 valid recipients");
      chooseEmail();
      sel.next().click();

      // Step 2
      step.compose().should("be.visible");
      sel.subject().type("Spring open house", { delay: 0 });
      sel.message().type("Come and visit us this Saturday.", { delay: 0 });
      sel.next().click();

      // Step 3
      cy.contains("Recipients (3)").should("be.visible");
      cy.wait("@getUser");
      sel.sendNow().click();

      cy.wait("@sendCampaign").then(({ request }) => {
        expect(request.body.campaignChannel).to.eq("EMAIL");
        expect(request.body.campaignMetadata.subject).to.eq("Spring open house");
      });
      cy.assertPopover("Campaign created Successfully!");
      sel.modalHeading().should("not.exist");
      sel.bulkButton().should("be.disabled");
    });

    it("E2E — pick two leads, generate an SMS with AI, review and send", () => {
      stubSend();
      stubDraft("Hi [Name], the open house is this Saturday at 2pm.");

      openWizardWith(ROW.ada, ROW.grace);
      sel.smsCard().should("contain.text", "2 valid recipients");
      chooseSms();
      sel.next().click();

      cy.contains("Generate with AI").click();
      sel.goal().select("announcement");
      sel.tone().select("friendly");
      sel.eventContext().type("Autumn open house", { delay: 0 });
      sel.keyDetails().type("Saturday 2pm", { delay: 0 });
      sel.generateDraft().click();
      cy.wait("@generateDraft");
      sel.message().should("contain.value", "the open house is this Saturday");

      sel.next().click();
      cy.contains("Recipients (2)").should("be.visible");
      cy.wait("@getUser");
      sel.sendNow().click();

      cy.wait("@sendCampaign").then(({ request }) => {
        expect(request.body.campaignChannel).to.eq("SMS");
        expect(request.body.campaignUsers).to.have.length(2);
      });
      cy.assertPopover("Campaign created Successfully!");
    });

    it("E2E — every validation gate is hit, corrected, and the campaign still lands", () => {
      stubSend();

      openWizard();

      // No channel.
      sel.next().click();
      assertModalError("Please select a channel");

      // A channel with no reachable recipients — narrow the selection first.
      sel.closeModal().click();
      openWizardWith(ROW.noContact);
      chooseEmail();
      sel.next().click();
      cy.contains("No selected users have a valid email address.").should("be.visible");

      // Widen the selection back out and get through step 1.
      sel.closeModal().click();
      openWizard();
      chooseEmail();
      sel.next().click();

      // Empty message.
      sel.next().click();
      assertModalError("Message is required");

      composeManually();
      sel.next().click();
      cy.wait("@getUser");
      sel.sendNow().click();

      cy.wait("@sendCampaign");
      cy.assertPopover("Campaign created Successfully!");
    });

    it("E2E — a campaign that was just sent turns up in Campaign History", () => {
      stubSend();

      openWizard();
      chooseEmail();
      sel.next().click();
      sel.subject().type("Spring open house", { delay: 0 });
      sel.message().type("Come and visit us this Saturday.", { delay: 0 });
      sel.next().click();
      cy.wait("@getUser");
      sel.sendNow().click();

      // Feed the campaign the app actually sent back as the home's history, so
      // the row under test is the real payload rather than a hand-written one.
      let sentDate = "";
      cy.wait("@sendCampaign").then(({ request }) => {
        cy.stubHome(buildHome({ campaigns: [request.body] }));
        sentDate = formattedDate(request.body.createdAt);
      });
      cy.assertPopover("Campaign created Successfully!");

      cy.contains("Campaign History").click();
      historyRow("Spring open house").within(() => {
        cy.contains("EMAIL").should("be.visible");
        cy.contains("Sent").should("be.visible");
      });
      // [as-built] the history filters recipients by channel validity: all 4
      // leads were selected, but Nia carries no email, so it renders 3.
      historyCell("Spring open house", COL.recipients).should("have.text", "3");
      // Callback form, so `sentDate` is read when the assertion runs rather than
      // when the command queue is built — by then the wait above has filled it.
      historyCell("Spring open house", COL.date).should(($cell) =>
        expect($cell.text()).to.eq(sentDate)
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. Campaign History
  //
  // Where a sent campaign lands. campaign-table.tsx reads `home.campaigns` off
  // GET /v1/home/{id}, keeps the ones matching the board's campaignType, and
  // resolves each creator's name with its own GET /v1/user/{id}.
  // ──────────────────────────────────────────────────────────────────────────

  describe("Campaign History", () => {
    const visitHistory = (campaigns: any[] = [buildCampaign()]) => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome(buildHome({ campaigns }));
      cy.stubUsers(LEADS);
      cy.stubUser(buildSender());
      cy.visit(CRM_PATH);
      cy.wait("@getUsers");
      cy.contains("Campaign History").click();
    };

    it("renders the history table's column headers", () => {
      visitHistory();
      // "Receipents" is the app's own spelling — asserting the corrected one
      // would fail for the wrong reason.
      ["Channel", "Subject/Message", "Receipents", "Status", "Sent", "Created By"].forEach(
        (header) => cy.contains(header).should("be.visible")
      );
    });

    it("reports the channel a campaign went out on", () => {
      visitHistory();
      historyCell("Spring open house", COL.channel).should("have.text", "EMAIL");
    });

    it("reports an SMS campaign's channel", () => {
      visitHistory([buildCampaign({ campaignChannel: "SMS" })]);
      historyCell("Spring open house", COL.channel).should("have.text", "SMS");
    });

    it("shows the campaign's subject", () => {
      visitHistory();
      historyCell("Spring open house", COL.subject).should("have.text", "Spring open house");
    });

    it("counts how many people it went to", () => {
      visitHistory();
      historyCell("Spring open house", COL.recipients).should("have.text", "2");
    });

    it("dates the campaign as MM/DD/YYYY", () => {
      // The column is headed "Status" but renders createdAt.
      visitHistory();
      historyCell("Spring open house", COL.date).should("have.text", "04/20/2026");
    });

    it("marks every campaign as Sent", () => {
      visitHistory();
      historyCell("Spring open house", COL.sent).should("have.text", "Sent");
    });

    it("names whoever sent it", () => {
      visitHistory();
      historyCell("Spring open house", COL.createdBy).should("have.text", "Test User");
    });

    it("lists every senior campaign the home has sent", () => {
      visitHistory([
        buildCampaign({ campaignMetadata: { subject: "Spring open house" } }),
        buildCampaign({
          campaignId: "cccccccc-0002-4ccc-8ccc-cccccccccccc",
          campaignChannel: "SMS",
          campaignMetadata: { subject: "Autumn fete" },
          campaignUsers: [
            { userName: "Ada Lovelace", userMobile: "5550000001" },
          ],
          createdAt: "2026-04-23T10:00:00.000Z",
        }),
      ]);

      historyCell("Spring open house", COL.channel).should("have.text", "EMAIL");
      historyCell("Autumn fete", COL.channel).should("have.text", "SMS");
      historyCell("Autumn fete", COL.recipients).should("have.text", "1");
      historyCell("Autumn fete", COL.date).should("have.text", "04/23/2026");
    });

    it("truncates a subject longer than 30 characters", () => {
      const long = "Spring open house at Comfort Cove this Saturday";
      visitHistory([buildCampaign({ campaignMetadata: { subject: long } })]);

      historyCell("Spring open house at", COL.subject).should(
        "have.text",
        `${long.substring(0, 30)}...`
      );
    });

    it("leaves a 30-character subject whole", () => {
      const exact = "Spring open house at Comfort"; // 28 chars
      visitHistory([buildCampaign({ campaignMetadata: { subject: exact } })]);

      historyCell(exact, COL.subject).should("have.text", exact);
    });

    it("goes back to the leads table on Contacts", () => {
      visitHistory();
      cy.contains("Contacts").click();

      cy.contains("Ada Lovelace").should("be.visible");
      sel.bulkButton().should("be.visible");
    });

    it("still lists the campaigns after toggling away and back", () => {
      visitHistory();
      cy.contains("Contacts").click();
      cy.contains("Ada Lovelace").should("be.visible");

      cy.contains("Campaign History").click();
      historyCell("Spring open house", COL.channel).should("have.text", "EMAIL");
    });

    // ── negative ────────────────────────────────────────────────────────────

    it("shows the empty state when the home has sent nothing", () => {
      visitHistory([]);
      cy.contains("Nothing added yet.").should("be.visible");
    });

    it("keeps referral campaigns off the senior board", () => {
      // campaign-table filters on campaignType; the referral board renders the
      // same component with REFERRAL.
      visitHistory([
        buildCampaign({ campaignMetadata: { subject: "Senior newsletter" } }),
        buildCampaign({
          campaignId: "cccccccc-0003-4ccc-8ccc-cccccccccccc",
          campaignType: "REFERRAL",
          campaignMetadata: { subject: "Agent newsletter" },
        }),
      ]);

      cy.contains("Senior newsletter").should("be.visible");
      cy.contains("Agent newsletter").should("not.exist");
    });

    it("shows the empty state when the home has only referral campaigns", () => {
      visitHistory([buildCampaign({ campaignType: "REFERRAL" })]);
      cy.contains("Nothing added yet.").should("be.visible");
    });

    it("dashes the subject when the campaign carries none", () => {
      visitHistory([buildCampaign({ campaignMetadata: { body: "No subject line." } })]);
      historyCell("EMAIL", COL.subject).should("have.text", "-");
    });

    it("dashes the subject when the campaign has no metadata at all", () => {
      visitHistory([buildCampaign({ campaignMetadata: undefined })]);
      historyCell("EMAIL", COL.subject).should("have.text", "-");
    });

    it("dashes the recipient count for a campaign with an empty audience", () => {
      // `users?.length || "-"` — a zero count is falsy, so it reads as a dash
      // rather than as 0.
      visitHistory([buildCampaign({ campaignUsers: [] })]);
      historyCell("Spring open house", COL.recipients).should("have.text", "-");
    });

    it("dashes the recipient count when the audience is missing", () => {
      visitHistory([buildCampaign({ campaignUsers: undefined })]);
      historyCell("Spring open house", COL.recipients).should("have.text", "-");
    });

    it("leaves Created By blank when the sender cannot be looked up", () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome(buildHome({ campaigns: [buildCampaign()] }));
      cy.stubUsers(LEADS);
      cy.intercept("GET", "**/v1/user/*", { statusCode: 404, body: {} }).as("getUser");
      cy.visit(CRM_PATH);
      cy.wait("@getUsers");
      cy.contains("Campaign History").click();

      historyCell("Spring open house", COL.channel).should("have.text", "EMAIL");
      historyCell("Spring open house", COL.createdBy).should("have.text", "");
    });

    it("shows the empty state when the home record cannot be read", () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.intercept("GET", "**/v1/home/**", { statusCode: 500, body: {} }).as("getHome");
      cy.stubUsers(LEADS);
      cy.stubUser(buildSender());
      cy.visit(CRM_PATH);
      cy.wait("@getUsers");
      cy.contains("Campaign History").click();

      cy.contains("Nothing added yet.").should("be.visible");
    });
  });
});
