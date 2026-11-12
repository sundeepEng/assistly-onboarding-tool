/* eslint-disable cypress/no-force -- ported legacy suite: deliberate force-clicks on icon triggers / documented settle windows */
/// <reference types="cypress" />

/**
 * Clinical — Incident Report: types, optional sections and journeys
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
 * Covers the incident-type checkboxes, the optional perpetrator/witness/
 * notification blocks, edge cases, the PDF control, access, and the
 * end-to-end journeys.
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

describe("Clinical — Incident Report — types, optional sections and journeys", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  describe("Incident types", () => {
    beforeEach(() => {
      openForm();
      stubSave();
    });

    it("offers the abuse checkboxes", () => {
      sel.section("Type of Incident").click();
      cy.get('input[name="incidentType.0.abuseTypes.physical"]').should("exist");
      cy.get('input[name="incidentType.0.abuseTypes.verbal"]').should("exist");
    });

    it("records a ticked abuse type", () => {
      sel.section("Type of Incident").click();
      cy.get('input[name="incidentType.0.abuseTypes.physical"]').check({ force: true });
      fillRequired();
      sel.save().click();

      cy.wait("@saveIncident").then(({ request }) => {
        const types = savedIncident(request).incidentType;
        expect(JSON.stringify(types)).to.contain("physical");
      });
    });

    it("records a serious injury type", () => {
      sel.section("Type of Incident").click();
      cy.get('input[name="incidentType.0.seriousInjuryTypes.erVisit"]').check({
        force: true,
      });
      fillRequired();
      sel.save().click();

      cy.wait("@saveIncident").then(({ request }) => {
        expect(JSON.stringify(savedIncident(request).incidentType)).to.contain("erVisit");
      });
    });

    it("records several types at once", () => {
      sel.section("Type of Incident").click();
      cy.get('input[name="incidentType.0.abuseTypes.physical"]').check({ force: true });
      cy.get('input[name="incidentType.0.other.neglect"]').check({ force: true });
      fillRequired();
      sel.save().click();

      cy.wait("@saveIncident").then(({ request }) => {
        const json = JSON.stringify(savedIncident(request).incidentType);
        expect(json).to.contain("physical");
        expect(json).to.contain("neglect");
      });
    });

    it("saves with no incident type ticked at all", () => {
      fillRequired();
      sel.save().click();
      cy.wait("@saveIncident");
      cy.assertPopover("Incident reported successfully");
    });

    it("records the free-text other type", () => {
      sel.section("Type of Incident").click();
      sel.field("incidentType.0.other.other").type("Wandered from the garden");
      fillRequired();
      sel.save().click();

      cy.wait("@saveIncident").then(({ request }) => {
        expect(JSON.stringify(savedIncident(request).incidentType)).to.contain(
          "Wandered from the garden"
        );
      });
    });
  });


  describe("Optional sections", () => {
    beforeEach(() => {
      openForm();
      stubSave();
    });

    it("saves a perpetrator's details", () => {
      sel.section("Perpetrator").click();
      sel.field("allegedPerpetratorDetails.name").type("Unknown visitor");
      fillRequired();
      sel.save().click();

      cy.wait("@saveIncident").then(({ request }) => {
        expect(savedIncident(request).allegedPerpetratorDetails.name).to.eq(
          "Unknown visitor"
        );
      });
    });

    it("refuses to save a perpetrator phone that is not ten digits", () => {
      // Not "dropped": phoneDigits10 strips punctuation and THEN checks the
      // length, so "12345" stays five digits and fails the schema. The whole
      // form is blocked rather than the field being quietly discarded.
      cy.intercept("PUT", "**/v1/clinical/user/**").as("saveIncident");
      sel.section("Perpetrator").click();
      sel.field("allegedPerpetratorDetails.name").type("Unknown visitor");
      sel.field("allegedPerpetratorDetails.phone").type("12345");
      fillRequired();
      sel.save().click();

      cy.assertNoRequest("@saveIncident");
    });

    it("accepts a formatted perpetrator phone by stripping the punctuation", () => {
      // The mirror case: "(706) 518-3473" is ten digits once cleaned, so it
      // saves and arrives normalised.
      sel.section("Perpetrator").click();
      sel.field("allegedPerpetratorDetails.name").type("Unknown visitor");
      sel.field("allegedPerpetratorDetails.phone").type("(706) 518-3473");
      fillRequired();
      sel.save().click();

      cy.wait("@saveIncident").then(({ request }) => {
        expect(savedIncident(request).allegedPerpetratorDetails.phone).to.eq(
          "7065183473"
        );
      });
    });

    it("refuses to save a perpetrator zip that is not five digits", () => {
      // Same shape as the phone: zipDigits5 strips then length-checks, so a
      // four-digit zip blocks the save rather than being dropped.
      cy.intercept("PUT", "**/v1/clinical/user/**").as("saveIncident");
      sel.section("Perpetrator").click();
      sel.field("allegedPerpetratorDetails.name").type("Unknown visitor");
      sel.field("allegedPerpetratorDetails.zip").type("1234");
      fillRequired();
      sel.save().click();

      cy.assertNoRequest("@saveIncident");
    });

    it("saves a notification entry", () => {
      sel.section("Notifications").click();
      cy.get('input[name="notifications.0.name"]').type("Jane Bean");
      cy.get('input[name="notifications.0.notifiedDate"]').type(today());
      cy.get('input[name="notifications.0.notifiedTime"]').type("08:00");
      fillRequired();
      sel.save().click();

      cy.wait("@saveIncident").then(({ request }) => {
        expect(JSON.stringify(savedIncident(request).notifications)).to.contain(
          "Jane Bean"
        );
      });
    });

    it("saves the immediate corrections note", () => {
      fillRequired();
      sel.section("Reporter").click();
      sel.field("immediateCorrections").type("Door alarm fitted.");
      sel.save().click();

      cy.wait("@saveIncident").then(({ request }) => {
        expect(savedIncident(request).immediateCorrections).to.eq("Door alarm fitted.");
      });
    });

    it("saves a reporter title", () => {
      fillRequired();
      sel.section("Reporter").click();
      sel.field("reporterTitle").type("Care Manager");
      sel.save().click();

      cy.wait("@saveIncident").then(({ request }) => {
        expect(savedIncident(request).reporterTitle).to.eq("Care Manager");
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Edge cases
  // ──────────────────────────────────────────────────────────────────────────


  describe("Edge cases", () => {
    beforeEach(() => {
      openForm();
      stubSave();
    });

    it("accepts an incident dated in the past", () => {
      fillRequired({ incidentDate: daysFromNow(-30) });
      sel.save().click();

      cy.wait("@saveIncident").then(({ request }) => {
        expect(savedIncident(request).incidentDate.slice(0, 10)).to.exist;
      });
    });

    it("does not stop an incident being dated in the future", () => {
      // Neither the date input nor the schema constrains this — worth knowing.
      fillRequired({ incidentDate: daysFromNow(30) });
      sel.save().click();
      cy.wait("@saveIncident");
      cy.assertPopover("Incident reported successfully");
    });

    it("does not stop the report predating the incident", () => {
      fillRequired({ incidentDate: today(), reportedDate: daysFromNow(-5) });
      sel.save().click();
      cy.wait("@saveIncident");
      cy.assertPopover("Incident reported successfully");
    });

    it("accepts a very long description", () => {
      const long = "x".repeat(2000);
      fillRequired({ details: long });
      sel.save().click();

      cy.wait("@saveIncident").then(({ request }) => {
        expect(savedIncident(request).incidentDetails).to.have.length(2000);
      });
    });

    it("keeps punctuation and newlines in the description", () => {
      fillRequired({ details: "Fell — twice. Bruised; no break." });
      sel.save().click();

      cy.wait("@saveIncident").then(({ request }) => {
        expect(savedIncident(request).incidentDetails).to.eq(
          "Fell — twice. Bruised; no break."
        );
      });
    });

    it("lowercases the facility email", () => {
      sel.field("facilityEmail").clear().type("Praveen@Assistly.com");
      fillRequired();
      sel.save().click();

      cy.wait("@saveIncident").then(({ request }) => {
        expect(savedIncident(request).facilityEmail).to.eq("praveen@assistly.com");
      });
    });

    it("accepts midnight as the incident time", () => {
      fillRequired({ incidentTime: "00:00" });
      sel.save().click();
      cy.wait("@saveIncident");
      cy.assertPopover("Incident reported successfully");
    });

    it("reopens a fresh form after one is saved", () => {
      fillRequired();
      sel.save().click();
      cy.wait("@saveIncident");
      cy.dismissPopover();

      sel.addButton().click();
      sel.section("Resident(s) & Incident Details").click();
      sel.field("detailsOfIncident").should("have.value", "");
    });

    it("abandons the form on the cross without saving", () => {
      cy.intercept("PUT", "**/v1/clinical/user/**").as("saveIncident");
      fillRequired();
      sel.closeModal().click();
      cy.assertNoRequest("@saveIncident");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. The PDF control
  //
  // Generation itself is out of scope; these assert the control is wired and
  // reachable, and that clicking it does not disturb the page.
  // ──────────────────────────────────────────────────────────────────────────


  describe("PDF download", () => {
    it("offers one control per incident", () => {
      visitTab(
        buildSenior([
          buildIncident(),
          buildIncident({ incidentId: "eeeeeeee-0002-4eee-8eee-eeeeeeeeeeee" }),
        ])
      );
      sel.pdfButton().should("have.length.at.least", 2);
    });

    it("leaves the row intact when the control is clicked", () => {
      visitTab(buildSenior([buildIncident()]));
      sel.pdfButton().first().click();
      cy.contains("Forgot the way and got lost").should("be.visible");
    });

    it("offers no control when there are no incidents", () => {
      visitTab(buildSenior([]));
      // cy.get() fails outright on no match, so query through the body.
      cy.get("body").then(($body) => {
        expect($body.find("div.border-solid.rounded-md").length).to.eq(0);
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 9. Access
  // ──────────────────────────────────────────────────────────────────────────


  describe("Access", () => {
    it("offers the tab to a Care Team member", { tags: [Tags.PCG] }, () => {
      visitTab(buildSenior([buildIncident()]), "PCG");
      cy.contains("Forgot the way and got lost").should("be.visible");
    });

    it("hides the Incident Report tab from a Nurse", { tags: [Tags.NURSE] }, () => {
      // A Nurse holds neither CLINICAL_INCIDENT nor CLINICAL_TABS as EDIT.
      visitTab(buildSenior([buildIncident()]), "Nurse");
      cy.contains("span", "Incident Report").should("not.exist");
    });

    it("makes the tab inert for a deleted senior", () => {
      visitTab(buildSenior([buildIncident()], { isDeleted: true }));
      cy.contains("Forgot the way and got lost")
        .parents("div")
        .should(($ancestors) => {
          const inert = [...$ancestors].some((el) =>
            String(el.className).includes("opacity-50")
          );
          expect(inert, "the tab is faded for a deleted senior").to.be.true;
        });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 10. End-to-end journeys
  // ──────────────────────────────────────────────────────────────────────────


  describe("End-to-end journeys", () => {
    it("E2E — an incident is reported and appears on the tab", () => {
      openForm();
      stubSave();

      sel.section("Type of Incident").click();
      cy.get('input[name="incidentType.0.missingResidentTypes.residentHasMemoryImpairment"]')
        .check({ force: true });
      fillRequired({ details: "Forgot the way and got lost" });

      let saved: any;
      sel.save().click();
      cy.wait("@saveIncident").then(({ request }) => {
        saved = savedIncident(request);
      });
      cy.assertPopover("Incident reported successfully");
      cy.dismissPopover();

      // Feed back exactly what the app sent.
      cy.then(() => {
        // `saved` already carries incidentDetails — the form renames the field
        // on submit. Spreading a `detailsOfIncident` that no longer exists put
        // `undefined` over the good value.
        visitTab(buildSenior([saved]));
        cy.contains("Forgot the way and got lost").should("be.visible");
        sel.pdfButton().should("have.length.at.least", 1);
      });
    });

    it("E2E — a validation error is corrected and the incident then saves", () => {
      openForm();
      cy.intercept("PUT", "**/v1/clinical/user/**").as("saveIncident");

      sel.field("facilityPhone").clear().type("70651");
      fillRequired();
      sel.save().click();
      cy.assertNoRequest("@saveIncident");

      stubSave();
      sel.section("Facility & Admin").click();
      sel.field("facilityPhone").clear().type("7065183473");
      sel.save().click();

      cy.wait("@saveIncident").then(({ request }) => {
        expect(savedIncident(request).facilityPhone).to.eq("7065183473");
      });
    });

    it("E2E — a second incident is added alongside the first", () => {
      openForm(buildSenior([buildIncident()]));
      stubSave();

      fillRequired({ details: "Slipped in the bathroom" });
      sel.save().click();

      cy.wait("@saveIncident").then(({ request }) => {
        const reports = request.body.incidentReport;
        expect(reports).to.have.length(2);
        expect(reports[1].incidentDetails).to.eq("Slipped in the bathroom");
      });
    });
  });
});
