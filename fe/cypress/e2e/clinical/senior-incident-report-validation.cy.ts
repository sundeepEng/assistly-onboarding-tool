/// <reference types="cypress" />

/**
 * Clinical — Incident Report: validation and saving
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
 * Covers what the schema demands and what reaches the API — the ten required
 * fields, the phone/zip/email rules, and the shape of the saved payload.
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

describe("Clinical — Incident Report — validation and saving", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  describe("Validation", () => {
    beforeEach(() => {
      openForm();
      cy.intercept("PUT", "**/v1/clinical/user/**").as("saveIncident");
    });

    it("refuses a form with nothing added to the pre-fill", () => {
      sel.save().click();
      cy.assertNoRequest("@saveIncident");
    });

    it("refuses an incident with no date", () => {
      fillRequired();
      sel.section("Resident(s) & Incident Details").click();
      sel.field("incidentDate").clear();
      sel.save().click();
      cy.assertNoRequest("@saveIncident");
    });

    it("refuses an incident with no time", () => {
      fillRequired();
      sel.section("Resident(s) & Incident Details").click();
      sel.field("incidentTime").clear();
      sel.save().click();
      cy.assertNoRequest("@saveIncident");
    });

    it("refuses an incident with no details", () => {
      fillRequired({ details: "" });
      sel.save().click();
      cy.assertNoRequest("@saveIncident");
    });

    it("accepts details that are only whitespace", () => {
      // `detailsOfIncident: z.string().min(1)` counts a space, so four spaces
      // pass and a regulatory form saves with a blank description. Pinned
      // as-built here and in the unit suite
      // (__tests__/unit/clinical/incident-schema.test.ts); a `.trim().min(1)`
      // would close it.
      stubSave();
      fillRequired({ details: "    " });
      sel.save().click();

      cy.wait("@saveIncident").then(({ request }) => {
        expect(savedIncident(request).incidentDetails).to.eq("    ");
      });
    });

    it("refuses a cleared facility name", () => {
      sel.field("facilityName").clear();
      fillRequired();
      sel.save().click();
      cy.assertNoRequest("@saveIncident");
    });

    it("refuses a cleared administrator", () => {
      sel.field("facilityAdministrator").clear();
      fillRequired();
      sel.save().click();
      cy.assertNoRequest("@saveIncident");
    });

    it("refuses a cleared reporter", () => {
      fillRequired();
      sel.section("Reporter").click();
      sel.field("reporterName").clear();
      sel.save().click();
      cy.assertNoRequest("@saveIncident");
    });

    it("refuses a cleared resident", () => {
      fillRequired();
      sel.section("Resident(s) & Incident Details").click();
      sel.field("residentName.0").clear();
      sel.save().click();
      cy.assertNoRequest("@saveIncident");
    });

    it("refuses a facility phone that is not ten digits", () => {
      sel.field("facilityPhone").clear().type("70651");
      fillRequired();
      sel.save().click();
      cy.assertNoRequest("@saveIncident");
    });

    it("accepts a hyphenated facility phone by stripping the punctuation", () => {
      // phoneDigits10 strips non-digits first, so "706-518-3473" is ten digits
      // and saves — it is not a rejection case.
      stubSave();
      sel.field("facilityPhone").clear().type("706-518-3473");
      fillRequired();
      sel.save().click();

      cy.wait("@saveIncident").then(({ request }) => {
        expect(savedIncident(request).facilityPhone).to.eq("7065183473");
      });
    });

    it("refuses a facility phone with no digits in it at all", () => {
      cy.intercept("PUT", "**/v1/clinical/user/**").as("saveIncident");
      sel.field("facilityPhone").clear().type("abcdefghij");
      fillRequired();
      sel.save().click();
      cy.assertNoRequest("@saveIncident");
    });

    it("refuses a malformed facility email", () => {
      sel.field("facilityEmail").clear().type("not-an-email");
      fillRequired();
      sel.save().click();
      cy.assertNoRequest("@saveIncident");
    });

    it("refuses a reported date with no reported time", () => {
      fillRequired({ reportedTime: "" });
      sel.save().click();
      cy.assertNoRequest("@saveIncident");
    });

    it("accepts an incident with every optional field left blank", () => {
      stubSave();
      fillRequired();
      sel.save().click();
      cy.wait("@saveIncident");
      cy.assertPopover("Incident reported successfully");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Saving
  // ──────────────────────────────────────────────────────────────────────────


  describe("Saving", () => {
    beforeEach(() => {
      openForm();
      stubSave();
    });

    it("appends the incident to the senior's clinical record", () => {
      fillRequired();
      sel.save().click();

      cy.wait("@saveIncident").then(({ request }) => {
        expect(request.body.incidentReport).to.have.length(1);
      });
    });

    it("carries the details through", () => {
      fillRequired({ details: "Forgot the way and got lost" });
      sel.save().click();

      cy.wait("@saveIncident").then(({ request }) => {
        expect(savedIncident(request).incidentDetails).to.eq(
          "Forgot the way and got lost"
        );
      });
    });

    it("gives the incident its own id", () => {
      fillRequired();
      sel.save().click();

      cy.wait("@saveIncident").then(({ request }) => {
        expect(savedIncident(request).incidentId).to.match(/^[0-9a-f-]{36}$/i);
      });
    });

    it("combines the incident date and time into one timestamp", () => {
      fillRequired({ incidentDate: today(), incidentTime: "07:48" });
      sel.save().click();

      cy.wait("@saveIncident").then(({ request }) => {
        // combineDT parses `${date}T${time}:00` locally, so the stored instant
        // is that local moment expressed in UTC.
        const expected = new Date(`${today()}T07:48:00`).toISOString();
        expect(savedIncident(request).incidentDate).to.eq(expected);
      });
    });

    it("combines the reported date and time into one timestamp", () => {
      fillRequired({ reportedDate: today(), reportedTime: "07:49" });
      sel.save().click();

      cy.wait("@saveIncident").then(({ request }) => {
        const expected = new Date(`${today()}T07:49:00`).toISOString();
        expect(savedIncident(request).incidentReportedAt).to.eq(expected);
      });
    });

    it("carries the facility details through", () => {
      fillRequired();
      sel.save().click();

      cy.wait("@saveIncident").then(({ request }) => {
        const incident = savedIncident(request);
        expect(incident.facilityName).to.eq("Comfort Cove");
        expect(incident.facilityPhone).to.eq("7065183473");
        expect(incident.facilityAdministrator).to.eq("Praveen Durvesula");
      });
    });

    it("carries the resident through", () => {
      fillRequired();
      sel.save().click();

      cy.wait("@saveIncident").then(({ request }) => {
        expect(savedIncident(request).residentName).to.deep.eq(["Arthur Bean"]);
      });
    });

    it("keeps the senior's existing incidents", () => {
      openForm(buildSenior([buildIncident()]));
      stubSave();
      fillRequired({ details: "Slipped in the bathroom" });
      sel.save().click();

      cy.wait("@saveIncident").then(({ request }) => {
        expect(request.body.incidentReport).to.have.length(2);
        expect(request.body.incidentReport[0].detailsOfIncident).to.eq(
          "Forgot the way and got lost"
        );
      });
    });

    it("keeps the senior's other clinical data", () => {
      fillRequired();
      sel.save().click();

      cy.wait("@saveIncident").then(({ request }) => {
        expect(request.body.roomNumber).to.eq(12);
      });
    });

    it("confirms the incident was recorded", () => {
      fillRequired();
      sel.save().click();
      cy.wait("@saveIncident");
      cy.assertPopover("Incident reported successfully");
    });

    it("closes the form", () => {
      fillRequired();
      sel.save().click();
      cy.wait("@saveIncident");
      cy.get(".ReactModal__Content").should("not.exist");
    });

    it("reports a rejected save", () => {
      cy.intercept("PUT", "**/v1/clinical/user/**", { statusCode: 500, body: {} }).as(
        "saveIncident"
      );
      fillRequired();
      sel.save().click();

      cy.wait("@saveIncident");
      cy.assertPopover("Incident not added, please try again!");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Incident types and the optional sections
  // ──────────────────────────────────────────────────────────────────────────

});
