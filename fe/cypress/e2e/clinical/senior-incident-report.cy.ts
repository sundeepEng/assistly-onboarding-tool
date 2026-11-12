/// <reference types="cypress" />

/**
 * Clinical — Incident Report: the tab, the form and the pre-fill
 *
 * One of three files covering the incident report. They were split because a
 * single browser session doing ~80 page visits degrades severely — tests that
 * take ~7s early in a run were taking ~48s late in it. Fixtures, selectors and
 * helpers are shared from cypress/support/incident-report.ts.
 *
 * Siblings: senior-incident-report.cy.ts (the tab, the form, the pre-fill),
 * -validation.cy.ts (validation and saving), -details.cy.ts (types, optional
 * sections, edge cases, PDF, access, journeys).
 *
 * Covers what the user sees before typing anything: the incident table, the
 * seven-section modal, and the five fields already filled in from other
 * records.
 */

import { Tags } from "../../framework/utils/tags";
import {
  buildIncident,
  buildSenior,
  fillRequired,
  openForm,
  savedIncident,
  sel,
  stubSave,
  visitTab,
  today,
  daysFromNow,
  FIRST_PCHO,
  SIGNED_IN_USER,
  SENIOR_ID,
  INCIDENT_TAB,
  PCHO_ID,
  buildHome,
  stubUserLookups,
  TEST_USER_ID,
  TEST_HOME_ID,
} from "../../framework/incident-report";

describe("Clinical — Incident Report — the tab, the form and the pre-fill", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  describe("The tab", () => {
    it("offers the add action", () => {
      visitTab();
      sel.addButton().should("be.visible");
    });

    it("renders every column", () => {
      visitTab(buildSenior([buildIncident()]));
      ["S.No", "Description", "Date", "Time", "PDF", "Reported By"].forEach((header) =>
        cy.contains(header).should("exist")
      );
    });

    it("lists a recorded incident", () => {
      visitTab(buildSenior([buildIncident()]));
      cy.contains("Forgot the way and got lost").should("be.visible");
    });

    it("numbers the rows", () => {
      visitTab(buildSenior([buildIncident()]));
      cy.contains("1.").should("be.visible");
    });

    it("formats the incident date", () => {
      visitTab(
        buildSenior([buildIncident({ incidentDate: "2026-08-31T07:48:00.000Z" })])
      );
      cy.contains("08/31/2026").should("be.visible");
    });

    it("names who reported it", () => {
      visitTab(buildSenior([buildIncident()]));
      cy.contains("DR").should("be.visible");
    });

    it("offers a PDF download per incident", () => {
      visitTab(buildSenior([buildIncident()]));
      sel.pdfButton().should("have.length.at.least", 1);
    });

    it("renders an empty tab without erroring", () => {
      visitTab(buildSenior([]));
      sel.addButton().should("be.visible");
      cy.contains("Forgot the way").should("not.exist");
    });

    it("lists several incidents", () => {
      visitTab(
        buildSenior([
          buildIncident(),
          buildIncident({
            incidentId: "eeeeeeee-0002-4eee-8eee-eeeeeeeeeeee",
            incidentDetails: "Slipped in the bathroom",
          }),
        ])
      );
      cy.contains("Forgot the way and got lost").should("be.visible");
      cy.contains("Slipped in the bathroom").should("be.visible");
      cy.contains("2.").should("be.visible");
    });

    it("truncates a very long description rather than breaking the row", () => {
      visitTab(
        buildSenior([buildIncident({ incidentDetails: "x".repeat(400) })])
      );
      cy.get("p.truncate").should("exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. The form's shape
  // ──────────────────────────────────────────────────────────────────────────


  describe("The form", () => {
    beforeEach(() => openForm());

    it("opens with its title", () => {
      cy.contains("Add Incident Report").should("be.visible");
    });

    it("offers all seven sections", () => {
      [
        "Facility & Admin",
        "Type of Incident",
        "Resident(s) & Incident Details",
        "Notifications",
        "Perpetrator",
        "Witnesses",
        "Reporter",
      // Presence, not visibility: the modal scrolls and the later summaries sit
      // below the fold.
      ].forEach((title) => sel.section(title).should("exist"));
    });

    it("opens on Facility & Admin", () => {
      sel.field("facilityName").should("be.visible");
    });

    it("keeps the other sections collapsed", () => {
      // MUI's Accordion keeps collapsed children mounted, so the field exists
      // in the DOM — it is hidden, not absent.
      sel.field("detailsOfIncident").should("not.be.visible");
    });

    it("opens a section when its header is clicked", () => {
      sel.section("Resident(s) & Incident Details").click();
      sel.field("incidentDate").should("be.visible");
    });

    it("closes a section when its header is clicked again", () => {
      sel.section("Resident(s) & Incident Details").click();
      sel.field("incidentDate").should("be.visible");
      sel.section("Resident(s) & Incident Details").click();
      sel.field("incidentDate").should("not.be.visible");
    });

    it("shows one section at a time", () => {
      sel.section("Reporter").click();
      sel.field("reporterName").should("be.visible");
      sel.field("facilityName").should("not.be.visible");
    });

    it("offers Save", () => {
      // Below the fold in a scrolling modal — `.click()` scrolls to it, but an
      // assertion must not demand it already be on screen.
      sel.save().should("exist");
    });

    it("closes on the cross", () => {
      sel.closeModal().click();
      cy.get(".ReactModal__Content").should("not.exist");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. What is pre-filled
  //
  // Five required fields arrive populated, so the validation tests below have
  // to clear them deliberately. Asserting the pre-fill first keeps those tests
  // honest.
  // ──────────────────────────────────────────────────────────────────────────


  describe("Pre-filled details", () => {
    beforeEach(() => openForm());

    it("names the facility from the senior's home", () => {
      sel.field("facilityName").should("have.value", "Comfort Cove");
    });

    it("takes the facility phone from the home's first PCHO", () => {
      sel.field("facilityPhone").should("have.value", "7065183473");
    });

    it("takes the administrator from the home's first PCHO", () => {
      sel.field("facilityAdministrator").should("have.value", "Praveen Durvesula");
    });

    it("takes the facility email from the home's first PCHO", () => {
      sel.field("facilityEmail").should("have.value", "praveen@assistly.com");
    });

    it("names the resident from the senior being viewed", () => {
      sel.section("Resident(s) & Incident Details").click();
      sel.field("residentName.0").should("have.value", "Arthur Bean");
    });

    it("names the reporter from the signed-in user", () => {
      sel.section("Reporter").click();
      sel.field("reporterName").should("have.value", "Danny Ross");
    });

    it("leaves the optional facility fields empty", () => {
      sel.field("facilityCounty").should("have.value", "");
      sel.field("facilityFax").should("have.value", "");
    });

    it("copes with a home that has no PCHO to read details from", () => {
      cy.clearAuthSession();
      cy.setAuthSession("PCHO");
      cy.stubHome(buildHome());
      cy.intercept("GET", "**/v1/hcm/shifts*", {
        statusCode: 200,
        body: { shifts: [] },
      }).as("getShifts");
      cy.intercept("GET", "**/v1/users*", (req) => {
        const userType = req.query.userType as string | undefined;
        req.reply({
          statusCode: 200,
          body: { users: userType === "PCHO" ? [] : [buildSenior()] },
        });
      }).as("getUsers");
      stubUserLookups(buildSenior());
      cy.visit(`/clinical/${SENIOR_ID}?activeTab=${encodeURIComponent(INCIDENT_TAB)}`);

      sel.addButton().click();
      sel.field("facilityPhone").should("have.value", "");
      sel.field("facilityName").should("have.value", "Comfort Cove");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Validation
  // ──────────────────────────────────────────────────────────────────────────

});
