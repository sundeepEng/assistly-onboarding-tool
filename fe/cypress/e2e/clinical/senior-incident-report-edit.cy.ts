/// <reference types="cypress" />

/**
 * Clinical — Incident Report: editing and deleting
 *
 *   components/clinical/clinicalTabs/incident-report.tsx       the row actions
 *   components/clinical/clinicalTabs/incident-report-form.tsx  the prefill
 *   utils/dateUtils.ts                                         splitISOToDateTime
 *
 * Both actions arrived with the `feat/edit-incident-report` work and had no
 * coverage. The three sibling specs cover ADDING a report, its field
 * validation and its optional sections; this one is only about what the two
 * icons at the end of each row do.
 *
 * ONE ENDPOINT, NO DELETE VERB
 *   There is no incident endpoint. A report lives inside
 *   `clinical.incidentReport`, so both editing and deleting are the same
 *   `PUT /v1/clinical/user/{id}` carrying the whole clinical record — an edit
 *   replaces one entry, a delete filters it out. Asserting on the ARRAY in the
 *   request body is therefore the only way to tell the two apart.
 *
 * THE FORM TITLE IS THE MODE
 *   `selectedIncident ? "Edit Incident Report" : "Add Incident Report"` — the
 *   same modal and the same form component serve both, so the title is what
 *   distinguishes them.
 *
 * WHY THE TIMES MATTER
 *   The form prefills through `splitISOToDateTime`, which reads LOCAL date and
 *   time components. Reading UTC instead would shift the hour and a carer
 *   reopening a report would find a time they never entered. Pinned below
 *   against the same Date the helper sees, so it holds in any timezone.
 */

import { Tags } from "../../framework/utils/tags";
import {
  buildHome,
  buildIncident,
  buildSenior,
  sel,
  stubSave,
  today,
  visitTab,
} from "../../framework/incident-report";

const FIRST = "eeeeeeee-0001-4eee-8eee-eeeeeeeeeeee";
const SECOND = "eeeeeeee-0002-4eee-8eee-eeeeeeeeeeee";

/** Two reports, so "the one I clicked" is a meaningful assertion. */
const TWO_REPORTS = [
  buildIncident({
    incidentId: FIRST,
    incidentDetails: "Forgot the way and got lost",
    detailsOfIncident: "Forgot the way and got lost",
    reporterName: "Danny Ross",
  }),
  buildIncident({
    incidentId: SECOND,
    incidentDetails: "Slipped near the bathroom door",
    detailsOfIncident: "Slipped near the bathroom door",
    reporterName: "Marian Webb",
  }),
];

const row = (details: string) =>
  cy.contains(details).closest('div[class*="border-b"]');

/** The two round icon buttons at the end of a row, in DOM order. */
const editIcon = (details: string) => row(details).find("button").eq(0);
const deleteIcon = (details: string) => row(details).find("button").eq(1);

const openEdit = (details = "Forgot the way and got lost") => {
  editIcon(details).click({ force: true });
  cy.contains("Edit Incident Report", { timeout: 10000 }).should("be.visible");
};

/** The incident array the app would PUT back. */
const savedReports = (request: any) => request.body.incidentReport ?? [];

// ═══════════════════════════════════════════════════════════════════════════
// The row actions
// ═══════════════════════════════════════════════════════════════════════════

describe("Clinical — Incident Report: the row actions", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    visitTab(buildSenior(TWO_REPORTS));
    stubSave();
  });

  it("offers two actions on every row", () => {
    row("Forgot the way and got lost").find("button").should("have.length", 2);
  });

  it("offers them on the second row too", () => {
    row("Slipped near the bathroom door").find("button").should("have.length", 2);
  });

  it("opens no modal until one is clicked", () => {
    cy.contains("Edit Incident Report").should("not.exist");
    cy.contains("Delete Incident Report").should("not.exist");
  });
});

describe("Clinical — Incident Report: a deleted senior", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    visitTab(buildSenior(TWO_REPORTS, { isDeleted: true }));
    stubSave();
  });

  it("makes the delete icon unclickable", () => {
    // `pointer-events-none` rather than `disabled`, so it looks the same but
    // cannot be reached. `handleDeleteClick` returns early as well.
    deleteIcon("Forgot the way and got lost").should(
      "have.class",
      "pointer-events-none"
    );
  });

  it("opens no delete confirmation", () => {
    deleteIcon("Forgot the way and got lost").click({ force: true });
    cy.contains("Delete Incident Report").should("not.exist");
  });

  it("sends nothing", () => {
    deleteIcon("Forgot the way and got lost").click({ force: true });
    cy.assertNoRequest("@saveIncident");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Editing
// ═══════════════════════════════════════════════════════════════════════════

describe("Clinical — Incident Report: opening an edit", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    visitTab(buildSenior(TWO_REPORTS));
    stubSave();
  });

  it("titles the modal Edit Incident Report", () => {
    openEdit();
    cy.contains("Edit Incident Report").should("be.visible");
  });

  it("does not title it Add", () => {
    openEdit();
    cy.contains("Add Incident Report").should("not.exist");
  });

  it("prefills the details of the row that was clicked", () => {
    openEdit();
    cy.get('input[name="detailsOfIncident"]').should(
      "have.value",
      "Forgot the way and got lost"
    );
  });

  it("prefills the SECOND row when that is the one clicked", () => {
    // The bug this guards: a list that always edits its first entry.
    openEdit("Slipped near the bathroom door");
    cy.get('input[name="detailsOfIncident"]').should(
      "have.value",
      "Slipped near the bathroom door"
    );
  });

  it("prefills the reporter", () => {
    openEdit();
    cy.get('input[name="reporterName"]').should("have.value", "Danny Ross");
  });

  it("prefills the second row's reporter", () => {
    openEdit("Slipped near the bathroom door");
    cy.get('input[name="reporterName"]').should("have.value", "Marian Webb");
  });

  it("prefills the incident date", () => {
    openEdit();
    cy.get('input[name="incidentDate"]').should("have.value", today());
  });

  it("prefills the incident time from the LOCAL clock", () => {
    // `splitISOToDateTime` deliberately reads local components; derived here
    // from the same instant so the test holds in any timezone.
    const iso = `${today()}T07:48:00.000Z`;
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    const expected = `${pad(d.getHours())}:${pad(d.getMinutes())}`;

    openEdit();
    cy.get('input[name="incidentTime"]').should("have.value", expected);
  });

  it("reopens cleanly on a second edit", () => {
    openEdit();
    sel.closeModal().click();
    openEdit("Slipped near the bathroom door");
    cy.get('input[name="detailsOfIncident"]').should(
      "have.value",
      "Slipped near the bathroom door"
    );
  });

  it("goes back to Add after an edit is dismissed", () => {
    // `setSelectedIncident(null)` on close — otherwise Add would reopen the
    // last edited report and quietly overwrite it.
    openEdit();
    sel.closeModal().click();
    sel.addButton().click();
    cy.contains("Add Incident Report").should("be.visible");
  });

  it("sends nothing merely by opening", () => {
    openEdit();
    cy.assertNoRequest("@saveIncident");
  });
});

describe("Clinical — Incident Report: saving an edit", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    visitTab(buildSenior(TWO_REPORTS));
    stubSave();
  });

  /**
   * Type into the details field.
   *
   * It lives inside the "Resident(s) & Incident Details" accordion, which the
   * form renders COLLAPSED even in edit mode — the value is prefilled and in
   * the DOM, but not visible until the section is opened.
   */
  const editDetailsTo = (text: string) => {
    sel.section("Resident(s) & Incident Details").click();
    cy.get('input[name="detailsOfIncident"]').clear();
    cy.get('input[name="detailsOfIncident"]').type(text);
  };

  it("PUTs the clinical record", () => {
    openEdit();
    editDetailsTo("Forgot the way; escorted back by staff");
    sel.save().click();
    cy.wait("@saveIncident");
  });

  it("keeps both reports — an edit is not an insert", () => {
    openEdit();
    editDetailsTo("Forgot the way; escorted back by staff");
    sel.save().click();
    cy.wait("@saveIncident").then(({ request }) => {
      expect(savedReports(request)).to.have.length(2);
    });
  });

  it("carries the edited text", () => {
    // The form rebuilds the edited entry into the API shape, where the field
    // is `incidentDetails` — `detailsOfIncident` is the FORM's name for it and
    // does not survive the save. Untouched entries keep whatever shape they
    // already had, so the two can differ within one payload.
    openEdit();
    editDetailsTo("Forgot the way; escorted back by staff");
    sel.save().click();
    cy.wait("@saveIncident").then(({ request }) => {
      const edited = savedReports(request).find((r: any) => r.incidentId === FIRST);
      expect(edited.incidentDetails).to.contain("escorted back by staff");
    });
  });

  it("leaves the other report untouched", () => {
    openEdit();
    editDetailsTo("Forgot the way; escorted back by staff");
    sel.save().click();
    cy.wait("@saveIncident").then(({ request }) => {
      const other = savedReports(request).find((r: any) => r.incidentId === SECOND);
      expect(other.detailsOfIncident).to.eq("Slipped near the bathroom door");
    });
  });

  it("keeps the report's own id rather than minting a new one", () => {
    // Otherwise every edit would orphan the original and append a duplicate.
    openEdit();
    editDetailsTo("Forgot the way; escorted back by staff");
    sel.save().click();
    cy.wait("@saveIncident").then(({ request }) => {
      const ids = savedReports(request).map((r: any) => r.incidentId);
      expect(ids).to.include.members([FIRST, SECOND]);
    });
  });

  it("authenticates with the session id token", () => {
    openEdit();
    editDetailsTo("Forgot the way; escorted back by staff");
    sel.save().click();
    cy.wait("@saveIncident");
    cy.assertAuthorized("@saveIncident");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Deleting
// ═══════════════════════════════════════════════════════════════════════════

describe("Clinical — Incident Report: the delete confirmation", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    visitTab(buildSenior(TWO_REPORTS));
    stubSave();
    deleteIcon("Forgot the way and got lost").click({ force: true });
  });

  it("titles the modal Delete Incident Report", () => {
    cy.contains("Delete Incident Report").should("be.visible");
  });

  it("names what is being deleted", () => {
    cy.contains("this incident report").should("be.visible");
  });

  it("sends nothing while it is only asking", () => {
    cy.assertNoRequest("@saveIncident");
  });

  it("abandons on Cancel", () => {
    cy.contains("button", /^Cancel$/).click();
    cy.contains("Delete Incident Report").should("not.exist");
    cy.assertNoRequest("@saveIncident");
  });

  it("keeps the report in the list after Cancel", () => {
    cy.contains("button", /^Cancel$/).click();
    cy.contains("Forgot the way and got lost").should("be.visible");
  });
});

describe("Clinical — Incident Report: confirming a delete", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  beforeEach(() => {
    visitTab(buildSenior(TWO_REPORTS));
    stubSave();
    deleteIcon("Forgot the way and got lost").click({ force: true });
  });

  const confirm = () => cy.contains("button", /^(Delete|Confirm|Yes)$/).click();

  it("PUTs the clinical record", () => {
    confirm();
    cy.wait("@saveIncident");
  });

  it("drops the report it was opened on", () => {
    confirm();
    cy.wait("@saveIncident").then(({ request }) => {
      const ids = savedReports(request).map((r: any) => r.incidentId);
      expect(ids).not.to.include(FIRST);
    });
  });

  it("keeps the one it was not opened on", () => {
    confirm();
    cy.wait("@saveIncident").then(({ request }) => {
      const ids = savedReports(request).map((r: any) => r.incidentId);
      expect(ids).to.include(SECOND);
    });
  });

  it("leaves exactly one report behind", () => {
    confirm();
    cy.wait("@saveIncident").then(({ request }) => {
      expect(savedReports(request)).to.have.length(1);
    });
  });

  it("deletes the SECOND report when that is the one chosen", () => {
    cy.contains("button", /^Cancel$/).click();
    deleteIcon("Slipped near the bathroom door").click({ force: true });
    confirm();
    cy.wait("@saveIncident").then(({ request }) => {
      const ids = savedReports(request).map((r: any) => r.incidentId);
      expect(ids).to.include(FIRST);
      expect(ids).not.to.include(SECOND);
    });
  });

  it("confirms the deletion", () => {
    confirm();
    cy.assertPopover("Incident report deleted");
  });

  it("closes the confirmation afterwards", () => {
    confirm();
    cy.wait("@saveIncident");
    cy.contains("Delete Incident Report").should("not.exist");
  });

  it("authenticates with the session id token", () => {
    confirm();
    cy.wait("@saveIncident");
    cy.assertAuthorized("@saveIncident");
  });
});

describe("Clinical — Incident Report: when a delete fails", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  it("surfaces the API's own message", () => {
    visitTab(buildSenior(TWO_REPORTS));
    stubSave(500, { message: "Clinical record is locked." });
    deleteIcon("Forgot the way and got lost").click({ force: true });
    cy.contains("button", /^(Delete|Confirm|Yes)$/).click();
    cy.assertPopover("Clinical record is locked.");
  });

  it("keeps the report in the list", () => {
    visitTab(buildSenior(TWO_REPORTS));
    stubSave(500, {});
    deleteIcon("Forgot the way and got lost").click({ force: true });
    cy.contains("button", /^(Delete|Confirm|Yes)$/).click();
    cy.wait("@saveIncident");
    cy.contains("Forgot the way and got lost").should("be.visible");
  });

  it("refuses to send when the report has no id", () => {
    // The guard before the mutation: without `incidentId` there is nothing to
    // filter on, so it complains rather than rewriting the whole array.
    visitTab(buildSenior([buildIncident({ incidentId: undefined })]));
    stubSave();
    deleteIcon("Forgot the way and got lost").click({ force: true });
    cy.contains("button", /^(Delete|Confirm|Yes)$/).click();
    cy.assertPopover("Unable to delete incident report");
    cy.assertNoRequest("@saveIncident");
  });
});
