/// <reference types="cypress" />

/**
 * CRM — Home Tour
 *
 * The house icon in a lead's Milestones column, and the two-screen modal behind
 * it (components/home-tour.tsx).
 *
 * Two *different* fields drive the two things, which is worth stating up front
 * because it is easy to assume they are the same one:
 *
 *   icon colour   commonComponents/stage.tsx — blue (#514CEB) when the lead's
 *                 `milestone` array contains "tour", grey otherwise. The
 *                 milestone is only added when a tour is marked *finished*, so
 *                 merely scheduling one does not colour the icon in.
 *   which screen  home-tour.tsx — `tourDateTime` present -> "Home Tour Status"
 *                 (step 2), absent -> "Schedule Home Tour" (step 1).
 *
 * So a lead can be grey and still open the status screen (scheduled, not yet
 * finished), and — less usefully — blue while still opening the schedule screen.
 * Both combinations are covered below.
 *
 * Endpoints:
 *   POST /v1/user/home-tour   send the invitation (services/create.ts)
 *   PUT  /v1/user/{id}        persist tourDateTime / isTourCompleted / notes
 */

import { Tags } from "../../framework/utils/tags";
import { buildUserRow, TEST_USER_ID } from "../../framework/module-commands";

const CRM_PATH = "/crm";

const BLUE = "#514CEB";
const GREY = "gray";

// ── Date helpers ─────────────────────────────────────────────────────────────
// Everything is built off `Date.now()` in *local* time, because the component
// parses `${date}T${time}:00` as local. Fixed literals would rot.

const pad = (n: number) => String(n).padStart(2, "0");
const dateValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeValue = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * A date/time slot `offsetMs` from now, plus the ISO string the component will
 * derive from it — so the expected payload is computed the same way the app
 * computes it, rather than hard-coded.
 */
const slot = (offsetMs: number) => {
  const d = new Date(Date.now() + offsetMs);
  d.setSeconds(0, 0);
  const date = dateValue(d);
  const time = timeValue(d);
  return { date, time, iso: new Date(`${date}T${time}:00`).toISOString() };
};

const today = () => dateValue(new Date());

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** No tour at any stage: grey icon, opens the schedule screen. */
const UNSCHEDULED = buildUserRow({
  userId: "aaaaaaaa-0001-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Ada Lovelace",
  email: "ada@assistly.com",
  milestone: ["initial contact"],
});

/** Booked but not yet walked: still grey, but opens the status screen. */
const SCHEDULED = buildUserRow({
  userId: "aaaaaaaa-0002-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Grace Hopper",
  email: "grace@assistly.com",
  milestone: ["initial contact"],
  tourDateTime: "2026-09-01T15:00:00.000Z",
});

/** Walked and marked finished: blue, opens the status screen pre-filled. */
const COMPLETED = buildUserRow({
  userId: "aaaaaaaa-0003-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Alan Turing",
  email: "alan@assistly.com",
  milestone: ["initial contact", "tour"],
  tourDateTime: "2026-09-01T15:00:00.000Z",
  isTourCompleted: true,
  tourNotes: "Loved the garden.",
});

/** No address to invite: the schedule screen renders but cannot be submitted. */
const NO_EMAIL = buildUserRow({
  userId: "aaaaaaaa-0004-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Nia Okafor",
  email: "",
  milestone: ["initial contact"],
});

/**
 * Booked, unfinished, and already carrying notes. The only shape that reaches
 * handleHomeTourStatus's no-op branch, which compares `data.tourNotes` to the
 * textarea by value — see "Saving the tour status" below.
 */
const NOTED = buildUserRow({
  userId: "aaaaaaaa-0005-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Mary Jackson",
  email: "mary@assistly.com",
  milestone: ["initial contact"],
  tourDateTime: "2026-09-01T15:00:00.000Z",
  tourNotes: "Waiting on the family.",
});

const LEADS = [UNSCHEDULED, SCHEDULED, COMPLETED, NO_EMAIL, NOTED];

// ── Selectors ────────────────────────────────────────────────────────────────

/**
 * The tour cell in a lead's row.
 *
 * stage.tsx lays the four milestone icons out in a `gap-x-[7px]` flex row, one
 * wrapper div each, in a fixed order — tour is the second.
 */
const tourCell = (name: string) =>
  cy
    .contains(name)
    .closest('div[class*="border-b"]')
    .find('div[class*="gap-x-[7px]"] > div')
    .eq(1);

/** TourIcon paints the house glyph with `fill={color}`. */
const assertTourColour = (name: string, colour: string) =>
  tourCell(name).find("svg path").should("have.attr", "fill", colour);

const openTour = (name: string) => {
  // The click handler sits on a div wrapping the icon, so the event has to
  // bubble up from the svg.
  tourCell(name).find("svg").click({ force: true });
};

const sel = {
  scheduleScreen: () => cy.contains("Schedule Home Tour"),
  statusScreen: () => cy.contains("Home Tour Status"),
  date: () => cy.get('input[name="scheduleDate"]'),
  time: () => cy.get('input[name="scheduleTime"]'),
  sendInvitation: () => cy.contains("button", "Send Invitation"),
  yes: () => cy.get("#tour-yes"),
  no: () => cy.get("#tour-no"),
  comments: () => cy.get('textarea[placeholder*="Add comments"]'),
  reschedule: () => cy.contains("button", "Reschedule"),
  save: () => cy.contains("button", "Save"),
  closeModal: () => cy.get(".ReactModal__Content div.absolute.top-4.right-6"),
};

// ── Stubs ────────────────────────────────────────────────────────────────────

const visitLeads = (users: any[] = LEADS) => {
  cy.clearAuthSession();
  cy.setAuthSession("PCHO");
  cy.stubHome();
  cy.stubUsers(users);
  cy.visit(CRM_PATH);
  cy.wait("@getUsers");
};

const stubSchedule = (statusCode = 201, body: any = {}) =>
  cy.intercept("POST", "**/v1/user/home-tour", { statusCode, body }).as("scheduleTour");

/** Alias the schedule call without answering it, for "nothing was sent" checks. */
const watchSchedule = () =>
  cy.intercept("POST", "**/v1/user/home-tour").as("scheduleTour");

const stubUpdate = (statusCode = 200, body: any = {}) =>
  cy.intercept("PUT", "**/v1/user/**", { statusCode, body }).as("updateLead");

const watchUpdate = () => cy.intercept("PUT", "**/v1/user/**").as("updateLead");

/** Fill the schedule form. Either field can be skipped to test the other. */
const fillSlot = ({ date, time }: { date?: string; time?: string }) => {
  if (date) sel.date().clear().type(date);
  if (time) sel.time().clear().type(time);
};

describe("CRM — Home Tour", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. The milestone icon
  // ──────────────────────────────────────────────────────────────────────────

  describe("Tour icon state", () => {
    beforeEach(() => visitLeads());

    it("greys the icon for a lead with no tour milestone", () => {
      assertTourColour("Ada Lovelace", GREY);
    });

    it("colours the icon for a lead that has reached the tour milestone", () => {
      assertTourColour("Alan Turing", BLUE);
    });

    it("tints the icon's backdrop to match", () => {
      // TourIcon puts `${color}33` on the rounded pill behind the glyph.
      tourCell("Alan Turing")
        .find('div[class*="rounded-3xl"]')
        .should("have.css", "background-color", "rgba(81, 76, 235, 0.2)");
    });

    it("keeps a booked-but-unfinished tour grey", () => {
      // The colour tracks `milestone`, which only gains "tour" when the tour is
      // marked finished — Grace has a tourDateTime but no milestone yet.
      assertTourColour("Grace Hopper", GREY);
    });

    it("renders a tour icon on every lead's row", () => {
      LEADS.forEach((lead) => tourCell(lead.name).find("svg").should("exist"));
    });

    it("opens a modal from the icon", () => {
      openTour("Ada Lovelace");
      cy.get(".ReactModal__Content").should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Which screen the icon opens
  // ──────────────────────────────────────────────────────────────────────────

  describe("Modal routing", () => {
    beforeEach(() => visitLeads());

    it("opens the schedule screen when no tour is booked", () => {
      openTour("Ada Lovelace");
      sel.scheduleScreen().should("be.visible");
      cy.contains("Schedule a tour for Ada Lovelace").should("be.visible");
    });

    it("opens the status screen when a tour is booked", () => {
      openTour("Grace Hopper");
      sel.statusScreen().should("be.visible");
      cy.contains("Update tour status and add comments for Grace Hopper").should(
        "be.visible"
      );
    });

    it("opens the status screen for a finished tour", () => {
      openTour("Alan Turing");
      sel.statusScreen().should("be.visible");
    });

    it("routes on tourDateTime, not on the icon's colour", () => {
      // A blue icon with no tourDateTime still lands on the schedule screen:
      // colour and routing read different fields.
      visitLeads([
        buildUserRow({
          userId: "aaaaaaaa-0009-4aaa-8aaa-aaaaaaaaaaaa",
          name: "Blue Unbooked",
          email: "blue@assistly.com",
          milestone: ["initial contact", "tour"],
        }),
      ]);

      assertTourColour("Blue Unbooked", BLUE);
      openTour("Blue Unbooked");
      sel.scheduleScreen().should("be.visible");
    });

    it("opens the modal for the lead whose icon was clicked", () => {
      openTour("Nia Okafor");
      cy.contains("Schedule a tour for Nia Okafor").should("be.visible");
      cy.contains("Schedule a tour for Ada Lovelace").should("not.exist");
    });

    it("closes on the cross without touching the tour", () => {
      watchSchedule();
      watchUpdate();

      openTour("Ada Lovelace");
      sel.closeModal().click();

      cy.get(".ReactModal__Content").should("not.exist");
      cy.assertNoRequest("@scheduleTour");
      cy.assertNoRequest("@updateLead");
    });

    it("reopens on the same screen after being closed", () => {
      openTour("Grace Hopper");
      sel.statusScreen().should("be.visible");
      sel.closeModal().click();

      openTour("Grace Hopper");
      sel.statusScreen().should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Schedule screen — what it renders
  // ──────────────────────────────────────────────────────────────────────────

  describe("Schedule screen", () => {
    beforeEach(() => {
      visitLeads();
      openTour("Ada Lovelace");
    });

    it("offers a date and a time field", () => {
      cy.contains("Select Date").should("be.visible");
      cy.contains("Select Time").should("be.visible");
      sel.date().should("have.attr", "type", "date");
      sel.time().should("have.attr", "type", "time");
    });

    it("starts both fields empty", () => {
      sel.date().should("have.value", "");
      sel.time().should("have.value", "");
    });

    it("stops the date picker before today", () => {
      sel.date().should("have.attr", "min", today());
    });

    it("caps the date picker at a four-digit year", () => {
      sel.date().should("have.attr", "max", "9999-12-31");
    });

    it("names the invitee and their address", () => {
      cy.contains(
        "An invitation will be sent to Ada Lovelace at ada@assistly.com with the date and time of the tour."
      ).should("be.visible");
    });

    it("offers the Send Invitation action", () => {
      sel.sendInvitation().should("be.visible");
    });

    it("leaves the address blank when the lead has none", () => {
      // The banner interpolates data.email unconditionally, so a lead with no
      // address reads "...sent to Nia Okafor at  with the date and time...".
      // The refusal only arrives on submit — see the validation block below.
      sel.closeModal().click();
      openTour("Nia Okafor");
      cy.contains("An invitation will be sent to Nia Okafor at").should("be.visible");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Schedule screen — validation
  // ──────────────────────────────────────────────────────────────────────────

  describe("Schedule validation", () => {
    beforeEach(() => {
      visitLeads();
      watchSchedule();
    });

    it("refuses an empty form", () => {
      // react-hook-form leaves untouched fields undefined, so zod's type check
      // fires before ScheduleHomeTourSchema's own message — the field error
      // reads "Required", not "Please select a date".
      openTour("Ada Lovelace");
      sel.sendInvitation().click();

      cy.get(".ReactModal__Content").contains("Required").should("be.visible");
      cy.assertNoRequest("@scheduleTour");
    });

    it("refuses a date with no time", () => {
      const future = slot(DAY);
      openTour("Ada Lovelace");
      fillSlot({ date: future.date });
      sel.sendInvitation().click();

      cy.get(".ReactModal__Content").contains("Required").should("be.visible");
      cy.assertNoRequest("@scheduleTour");
    });

    it("refuses a time with no date", () => {
      openTour("Ada Lovelace");
      fillSlot({ time: "10:00" });
      sel.sendInvitation().click();

      cy.get(".ReactModal__Content").contains("Required").should("be.visible");
      cy.assertNoRequest("@scheduleTour");
    });

    it("blocks a past date at the field itself", () => {
      // `min={today}` makes a past date fail the browser's own constraint check,
      // so the form never submits: the warning is a native tooltip, not one of
      // the app's popovers, and no request goes out.
      const past = slot(-3 * DAY);
      openTour("Ada Lovelace");
      fillSlot({ date: past.date, time: "10:00" });
      sel.sendInvitation().click();

      cy.assertNoRequest("@scheduleTour");
      sel.scheduleScreen().should("be.visible");
      // The browser's tooltip is native chrome, not DOM — so the app's own
      // rejection never runs and its popover never appears.
      cy.contains("Please select a future date and time.").should("not.exist");
    });

    it("rejects a time that has already passed today", () => {
      // Midnight today is always behind `new Date()`, and the time field has no
      // `min`, so this reaches the handler's own guard.
      openTour("Ada Lovelace");
      fillSlot({ date: today(), time: "00:00" });
      sel.sendInvitation().click();

      cy.assertPopover("Please select a future date and time.");
      cy.assertNoRequest("@scheduleTour");
    });

    it("keeps the schedule screen open after rejecting a past time", () => {
      openTour("Ada Lovelace");
      fillSlot({ date: today(), time: "00:00" });
      sel.sendInvitation().click();

      cy.assertPopover("Please select a future date and time.");
      cy.dismissPopover();
      sel.scheduleScreen().should("be.visible");
      sel.date().should("have.value", today());
    });

    it("accepts the slot once the time is corrected", () => {
      const future = slot(2 * HOUR);
      openTour("Ada Lovelace");
      fillSlot({ date: today(), time: "00:00" });
      sel.sendInvitation().click();
      cy.assertPopover("Please select a future date and time.");
      cy.dismissPopover();

      stubSchedule();
      fillSlot({ date: future.date, time: future.time });
      sel.sendInvitation().click();

      cy.wait("@scheduleTour");
      cy.assertPopover("Mail Sent!");
    });

    it("refuses to invite a lead with no email address", () => {
      openTour("Nia Okafor");
      fillSlot(slot(DAY));
      sel.sendInvitation().click();

      cy.assertPopover("Recipient email does not exist");
      cy.assertNoRequest("@scheduleTour");
    });

    it("keeps the modal open when the lead has no email", () => {
      // Deliberate: the user keeps their date and time and can add an address
      // to the lead instead of starting over.
      openTour("Nia Okafor");
      fillSlot(slot(DAY));
      sel.sendInvitation().click();

      cy.assertPopover("Recipient email does not exist");
      cy.dismissPopover();
      sel.scheduleScreen().should("be.visible");
    });

    it("checks the address before it checks the date", () => {
      // A lead with no email and a past time reports the missing address, since
      // that guard runs first.
      openTour("Nia Okafor");
      fillSlot({ date: today(), time: "00:00" });
      sel.sendInvitation().click();

      cy.assertPopover("Recipient email does not exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Schedule screen — sending the invitation
  // ──────────────────────────────────────────────────────────────────────────

  describe("Sending the invitation", () => {
    beforeEach(() => {
      visitLeads();
      stubSchedule();
      stubUpdate();
    });

    const scheduleFor = (name: string, when = slot(DAY)) => {
      openTour(name);
      fillSlot(when);
      sel.sendInvitation().click();
      return when;
    };

    it("posts the booking to /v1/user/home-tour", () => {
      scheduleFor("Ada Lovelace");
      cy.wait("@scheduleTour").then(({ request }) => {
        expect(request.method).to.eq("POST");
        expect(request.url).to.include("/v1/user/home-tour");
      });
    });

    it("authenticates with the session id token", () => {
      scheduleFor("Ada Lovelace");
      cy.wait("@scheduleTour");
      cy.assertAuthorized("@scheduleTour");
    });

    it("names the lead and the organiser on the booking", () => {
      scheduleFor("Ada Lovelace");
      cy.wait("@scheduleTour").then(({ request }) => {
        expect(request.body.leadUserId).to.eq(UNSCHEDULED.userId);
        expect(request.body.pchoUserId).to.eq(TEST_USER_ID);
      });
    });

    it("sends the chosen slot as an ISO timestamp", () => {
      const when = scheduleFor("Ada Lovelace");
      cy.wait("@scheduleTour").then(({ request }) => {
        expect(request.body.tourDateTime).to.eq(when.iso);
      });
    });

    it("confirms the invitation went out", () => {
      scheduleFor("Ada Lovelace");
      cy.wait("@scheduleTour");
      cy.assertPopover("Mail Sent!");
    });

    it("records the booking on the lead", () => {
      const when = scheduleFor("Ada Lovelace");
      cy.wait("@scheduleTour");
      cy.wait("@updateLead").then(({ request }) => {
        expect(request.url).to.include(`/v1/user/${UNSCHEDULED.userId}`);
        expect(request.body.tourDateTime).to.eq(when.iso);
      });
    });

    it("strips the server-owned fields from the lead update", () => {
      // USER_PATH_OMIT_FIELDS — sending these back would clobber them.
      scheduleFor("Ada Lovelace");
      cy.wait("@updateLead").then(({ request }) => {
        expect(request.body).to.not.have.property("modifiedAt");
        expect(request.body).to.not.have.property("clinical");
        expect(request.body).to.not.have.property("isReferredByUserName");
      });
    });

    it("leaves the lead's milestones alone", () => {
      // Booking a tour is not reaching the tour milestone.
      scheduleFor("Ada Lovelace");
      cy.wait("@updateLead").then(({ request }) => {
        expect(request.body.milestone).to.deep.eq(["initial contact"]);
      });
    });

    it("closes the modal once the invitation is away", () => {
      scheduleFor("Ada Lovelace");
      cy.wait("@scheduleTour");
      cy.get(".ReactModal__Content").should("not.exist");
    });

    it("accepts a slot later today", () => {
      const when = scheduleFor("Ada Lovelace", slot(2 * HOUR));
      cy.wait("@scheduleTour").then(({ request }) => {
        expect(request.body.tourDateTime).to.eq(when.iso);
      });
      cy.assertPopover("Mail Sent!");
    });

    it("accepts a slot months out", () => {
      scheduleFor("Ada Lovelace", slot(90 * DAY));
      cy.wait("@scheduleTour");
      cy.assertPopover("Mail Sent!");
    });

    it("leaves the icon grey but switches the lead to the status screen", () => {
      // The refetched row now carries tourDateTime; the milestone is untouched,
      // so the colour does not move.
      scheduleFor("Ada Lovelace");
      cy.wait("@scheduleTour");

      cy.stubUsers([{ ...UNSCHEDULED, tourDateTime: slot(DAY).iso }, ...LEADS.slice(1)]);
      cy.visit(CRM_PATH);
      cy.wait("@getUsers");

      assertTourColour("Ada Lovelace", GREY);
      openTour("Ada Lovelace");
      sel.statusScreen().should("be.visible");
    });

    // ── negative ────────────────────────────────────────────────────────────

    it("reports a failed booking", () => {
      cy.intercept("POST", "**/v1/user/home-tour", {
        statusCode: 500,
        body: { error: "Mail service unavailable" },
      }).as("scheduleTour");

      scheduleFor("Ada Lovelace");
      cy.wait("@scheduleTour");
      cy.assertPopover("Error scheduling home tour");
    });

    it("does not record a booking that was never sent", () => {
      cy.intercept("POST", "**/v1/user/home-tour", { statusCode: 500, body: {} }).as(
        "scheduleTour"
      );
      watchUpdate();

      scheduleFor("Ada Lovelace");
      cy.wait("@scheduleTour");
      cy.assertPopover("Error scheduling home tour");
      cy.assertNoRequest("@updateLead");
    });

    it("closes the modal after a failed booking", () => {
      cy.intercept("POST", "**/v1/user/home-tour", { statusCode: 500, body: {} }).as(
        "scheduleTour"
      );

      scheduleFor("Ada Lovelace");
      cy.wait("@scheduleTour");
      cy.get(".ReactModal__Content").should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Status screen — what it renders
  // ──────────────────────────────────────────────────────────────────────────

  describe("Status screen", () => {
    beforeEach(() => visitLeads());

    it("asks whether the tour is finished", () => {
      openTour("Grace Hopper");
      cy.contains("Is home tour finished?").should("be.visible");
      sel.yes().should("exist");
      sel.no().should("exist");
    });

    it("defaults an unfinished tour to No", () => {
      openTour("Grace Hopper");
      sel.no().should("be.checked");
      sel.yes().should("not.be.checked");
    });

    it("defaults a finished tour to Yes", () => {
      openTour("Alan Turing");
      sel.yes().should("be.checked");
      sel.no().should("not.be.checked");
    });

    it("offers a comments box", () => {
      openTour("Grace Hopper");
      cy.contains("Tour Comments").should("be.visible");
      sel.comments().should("be.visible");
    });

    it("starts the comments box empty when the lead has no notes", () => {
      openTour("Grace Hopper");
      sel.comments().should("have.value", "");
    });

    it("pre-fills the comments box with the lead's existing notes", () => {
      openTour("Alan Turing");
      sel.comments().should("have.value", "Loved the garden.");
    });

    it("offers Reschedule and Save", () => {
      openTour("Grace Hopper");
      sel.reschedule().should("be.visible");
      sel.save().should("be.visible");
    });

    it("lets the radio be switched", () => {
      openTour("Grace Hopper");
      sel.yes().check({ force: true });
      sel.yes().should("be.checked");
      sel.no().should("not.be.checked");
    });

    it("discards unsaved edits when the modal is closed", () => {
      openTour("Grace Hopper");
      sel.comments().type("Half-written note");
      sel.closeModal().click();

      openTour("Grace Hopper");
      sel.comments().should("have.value", "");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Status screen — saving
  // ──────────────────────────────────────────────────────────────────────────

  describe("Saving the tour status", () => {
    beforeEach(() => {
      visitLeads();
      stubUpdate();
    });

    it("marks the tour finished", () => {
      openTour("Grace Hopper");
      sel.yes().check({ force: true });
      sel.save().click();

      cy.wait("@updateLead").then(({ request }) => {
        expect(request.method).to.eq("PUT");
        expect(request.url).to.include(`/v1/user/${SCHEDULED.userId}`);
        expect(request.body.isTourCompleted).to.eq(true);
      });
    });

    it("awards the tour milestone when the tour is finished", () => {
      openTour("Grace Hopper");
      sel.yes().check({ force: true });
      sel.save().click();

      cy.wait("@updateLead").then(({ request }) => {
        expect(request.body.milestone).to.include("tour");
        expect(request.body.milestone).to.include("initial contact");
      });
    });

    it("confirms the update", () => {
      openTour("Grace Hopper");
      sel.yes().check({ force: true });
      sel.save().click();

      cy.wait("@updateLead");
      cy.assertPopover("Tour status updated!");
    });

    it("closes the modal after saving", () => {
      openTour("Grace Hopper");
      sel.yes().check({ force: true });
      sel.save().click();

      cy.wait("@updateLead");
      cy.get(".ReactModal__Content").should("not.exist");
    });

    it("saves the tour comments alongside the status", () => {
      openTour("Grace Hopper");
      sel.yes().check({ force: true });
      sel.comments().type("Family joined the walk-through.");
      sel.save().click();

      cy.wait("@updateLead").then(({ request }) => {
        expect(request.body.tourNotes).to.eq("Family joined the walk-through.");
      });
    });

    it("does not duplicate a milestone the lead already holds", () => {
      openTour("Alan Turing");
      sel.comments().clear().type("Second visit.");
      sel.save().click();

      cy.wait("@updateLead").then(({ request }) => {
        const tours = request.body.milestone.filter((m: string) => m === "tour");
        expect(tours).to.have.length(1);
      });
    });

    it("strips the server-owned fields from the update", () => {
      openTour("Grace Hopper");
      sel.yes().check({ force: true });
      sel.save().click();

      cy.wait("@updateLead").then(({ request }) => {
        expect(request.body).to.not.have.property("modifiedAt");
        expect(request.body).to.not.have.property("clinical");
      });
    });

    it("saves notes on a tour that is still unfinished", () => {
      openTour("Grace Hopper");
      sel.comments().type("Rescheduling, family away.");
      sel.save().click();

      cy.wait("@updateLead").then(({ request }) => {
        expect(request.body.isTourCompleted).to.eq(false);
        expect(request.body.tourNotes).to.eq("Rescheduling, family away.");
        expect(request.body.milestone).to.not.include("tour");
      });
      cy.assertPopover("Tour status updated!");
    });

    it("colours the icon in once the tour is marked finished", () => {
      openTour("Grace Hopper");
      sel.yes().check({ force: true });
      sel.save().click();
      cy.wait("@updateLead");

      cy.stubUsers([
        UNSCHEDULED,
        { ...SCHEDULED, isTourCompleted: true, milestone: ["initial contact", "tour"] },
        COMPLETED,
        NO_EMAIL,
      ]);
      cy.visit(CRM_PATH);
      cy.wait("@getUsers");

      assertTourColour("Grace Hopper", BLUE);
    });

    // ── negative ────────────────────────────────────────────────────────────

    it("saves nothing when neither the status nor the notes changed", () => {
      // handleHomeTourStatus short-circuits on an unchanged, still-unfinished
      // tour, so Save is a no-op rather than a pointless write.
      openTour("Mary Jackson");
      sel.save().click();

      cy.get(".ReactModal__Content").should("not.exist");
      cy.assertNoRequest("@updateLead");
    });

    it("still writes when an unchanged tour has no notes to compare", () => {
      // The no-op check is `data.tourNotes === feedback`, and the textarea
      // falls back to "". A lead that has never been commented on has
      // `tourNotes` undefined, so `undefined === ""` is false and Save writes
      // anyway — with nothing actually changed.
      openTour("Grace Hopper");
      sel.save().click();

      cy.wait("@updateLead").then(({ request }) => {
        expect(request.body.isTourCompleted).to.eq(false);
        expect(request.body.tourNotes).to.eq("");
      });
    });

    it("saves nothing when a finished tour is switched back to No", () => {
      // Same short-circuit: with the notes untouched and the radio on No the
      // handler returns early, so `isTourCompleted` stays true on the record
      // and the milestone is never taken away.
      openTour("Alan Turing");
      sel.no().check({ force: true });
      sel.save().click();

      cy.get(".ReactModal__Content").should("not.exist");
      cy.assertNoRequest("@updateLead");
    });

    it("reports a failed milestone update", () => {
      cy.intercept("PUT", "**/v1/user/**", { statusCode: 500, body: {} }).as("updateLead");

      openTour("Grace Hopper");
      sel.yes().check({ force: true });
      sel.save().click();

      cy.wait("@updateLead");
      cy.assertPopover("Failed to update milestone. Please try again!");
    });

    it("reports a failed notes-only update in its own words", () => {
      cy.intercept("PUT", "**/v1/user/**", { statusCode: 500, body: {} }).as("updateLead");

      openTour("Grace Hopper");
      sel.comments().type("Could not reach the family.");
      sel.save().click();

      cy.wait("@updateLead");
      cy.assertPopover("Failed to save tour notes. Please try again!");
    });

    it("closes the modal even when the save fails", () => {
      // The modal is dismissed before the mutation settles, so the error
      // popover arrives over the leads board rather than over the form.
      cy.intercept("PUT", "**/v1/user/**", { statusCode: 500, body: {} }).as("updateLead");

      openTour("Grace Hopper");
      sel.yes().check({ force: true });
      sel.save().click();

      cy.wait("@updateLead");
      cy.get(".ReactModal__Content").should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. Rescheduling
  // ──────────────────────────────────────────────────────────────────────────

  describe("Rescheduling", () => {
    beforeEach(() => visitLeads());

    it("takes the user back to the schedule screen", () => {
      openTour("Grace Hopper");
      sel.reschedule().click();

      sel.scheduleScreen().should("be.visible");
      cy.contains("Schedule a tour for Grace Hopper").should("be.visible");
    });

    it("offers empty date and time fields to rebook with", () => {
      openTour("Grace Hopper");
      sel.reschedule().click();

      sel.date().should("have.value", "");
      sel.time().should("have.value", "");
    });

    it("changes nothing on its own", () => {
      watchSchedule();
      watchUpdate();

      openTour("Grace Hopper");
      sel.reschedule().click();
      sel.scheduleScreen().should("be.visible");

      cy.assertNoRequest("@scheduleTour");
      cy.assertNoRequest("@updateLead");
    });

    it("leaves the original tour standing if the user backs out", () => {
      // Abandoning the reschedule must not clear tourDateTime — reopening the
      // icon still lands on the status screen.
      watchSchedule();
      watchUpdate();

      openTour("Grace Hopper");
      sel.reschedule().click();
      sel.closeModal().click();

      cy.assertNoRequest("@scheduleTour");
      cy.assertNoRequest("@updateLead");

      openTour("Grace Hopper");
      sel.statusScreen().should("be.visible");
    });

    it("leaves the original tour standing until the new invitation is sent", () => {
      watchSchedule();
      watchUpdate();

      openTour("Grace Hopper");
      sel.reschedule().click();
      fillSlot(slot(3 * DAY));

      // Filled in but not submitted — still nothing has moved.
      cy.assertNoRequest("@scheduleTour");
      cy.assertNoRequest("@updateLead");
    });

    it("books the new slot when the invitation is sent", () => {
      stubSchedule();
      stubUpdate();
      const when = slot(3 * DAY);

      openTour("Grace Hopper");
      sel.reschedule().click();
      fillSlot(when);
      sel.sendInvitation().click();

      cy.wait("@scheduleTour").then(({ request }) => {
        expect(request.body.tourDateTime).to.eq(when.iso);
        expect(request.body.leadUserId).to.eq(SCHEDULED.userId);
      });
      cy.assertPopover("Mail Sent!");
    });

    it("still validates the new slot", () => {
      watchSchedule();

      openTour("Grace Hopper");
      sel.reschedule().click();
      sel.sendInvitation().click();

      cy.get(".ReactModal__Content").contains("Required").should("be.visible");
      cy.assertNoRequest("@scheduleTour");
    });

    it("still rejects a past time on the new slot", () => {
      watchSchedule();

      openTour("Grace Hopper");
      sel.reschedule().click();
      fillSlot({ date: today(), time: "00:00" });
      sel.sendInvitation().click();

      cy.assertPopover("Please select a future date and time.");
      cy.assertNoRequest("@scheduleTour");
    });

    it("can be reached from a finished tour too", () => {
      stubSchedule();
      stubUpdate();

      openTour("Alan Turing");
      sel.reschedule().click();
      fillSlot(slot(5 * DAY));
      sel.sendInvitation().click();

      cy.wait("@scheduleTour").then(({ request }) => {
        expect(request.body.leadUserId).to.eq(COMPLETED.userId);
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 9. End-to-end journeys
  // ──────────────────────────────────────────────────────────────────────────

  describe("End-to-end journeys", () => {
    it("E2E — book a tour, walk it, and mark it finished", () => {
      visitLeads();
      stubSchedule();
      stubUpdate();
      const when = slot(DAY);

      // Grey icon, nothing booked.
      assertTourColour("Ada Lovelace", GREY);
      openTour("Ada Lovelace");
      sel.scheduleScreen().should("be.visible");

      // Book it.
      fillSlot(when);
      sel.sendInvitation().click();
      cy.wait("@scheduleTour").then(({ request }) => {
        expect(request.body.tourDateTime).to.eq(when.iso);
      });
      cy.assertPopover("Mail Sent!");
      cy.get(".ReactModal__Content").should("not.exist");

      // Consume the write that records the booking, so the `@updateLead` wait
      // after Save below lands on the *status* write rather than this one.
      cy.wait("@updateLead").then(({ request }) => {
        expect(request.body.tourDateTime).to.eq(when.iso);
      });

      // The refetched lead is booked but still grey.
      const booked = { ...UNSCHEDULED, tourDateTime: when.iso };
      cy.stubUsers([booked, ...LEADS.slice(1)]);
      cy.visit(CRM_PATH);
      cy.wait("@getUsers");
      assertTourColour("Ada Lovelace", GREY);

      // Walk it and mark it finished.
      openTour("Ada Lovelace");
      sel.statusScreen().should("be.visible");
      sel.yes().check({ force: true });
      sel.comments().type("Signed up on the spot.");
      sel.save().click();

      cy.wait("@updateLead").then(({ request }) => {
        expect(request.body.isTourCompleted).to.eq(true);
        expect(request.body.tourNotes).to.eq("Signed up on the spot.");
        expect(request.body.milestone).to.include("tour");
      });
      cy.assertPopover("Tour status updated!");

      // The milestone is in, so the icon finally colours.
      cy.stubUsers([
        { ...booked, isTourCompleted: true, milestone: ["initial contact", "tour"] },
        ...LEADS.slice(1),
      ]);
      cy.visit(CRM_PATH);
      cy.wait("@getUsers");
      assertTourColour("Ada Lovelace", BLUE);
    });

    it("E2E — a past slot is refused, corrected, and then booked", () => {
      visitLeads();
      watchSchedule();
      const when = slot(2 * HOUR);

      openTour("Ada Lovelace");

      // Nothing at all.
      sel.sendInvitation().click();
      cy.get(".ReactModal__Content").contains("Required").should("be.visible");

      // A date the field itself will not accept.
      fillSlot({ date: slot(-2 * DAY).date, time: "09:00" });
      sel.sendInvitation().click();
      cy.assertNoRequest("@scheduleTour");

      // Today, but an hour that has been and gone.
      fillSlot({ date: today(), time: "00:00" });
      sel.sendInvitation().click();
      cy.assertPopover("Please select a future date and time.");
      cy.dismissPopover();

      // A slot that actually works.
      stubSchedule();
      stubUpdate();
      fillSlot(when);
      sel.sendInvitation().click();

      cy.wait("@scheduleTour").then(({ request }) => {
        expect(request.body.tourDateTime).to.eq(when.iso);
      });
      cy.assertPopover("Mail Sent!");
    });

    it("E2E — reschedule a booked tour without disturbing it until sent", () => {
      visitLeads();
      watchSchedule();
      watchUpdate();

      openTour("Grace Hopper");
      sel.statusScreen().should("be.visible");

      // Open the reschedule form, then think better of it.
      sel.reschedule().click();
      sel.scheduleScreen().should("be.visible");
      sel.closeModal().click();
      cy.assertNoRequest("@scheduleTour");
      cy.assertNoRequest("@updateLead");

      // The booking is untouched.
      openTour("Grace Hopper");
      sel.statusScreen().should("be.visible");

      // Now actually move it.
      stubSchedule();
      stubUpdate();
      const when = slot(4 * DAY);
      sel.reschedule().click();
      fillSlot(when);
      sel.sendInvitation().click();

      cy.wait("@scheduleTour").then(({ request }) => {
        expect(request.body.tourDateTime).to.eq(when.iso);
      });
      cy.wait("@updateLead").then(({ request }) => {
        expect(request.body.tourDateTime).to.eq(when.iso);
      });
      cy.assertPopover("Mail Sent!");
    });
  });
});
