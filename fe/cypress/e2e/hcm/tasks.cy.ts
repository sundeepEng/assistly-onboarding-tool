/// <reference types="cypress" />

/**
 * HCM — task library and daily tracking
 *
 * Route under test: /hcm/tasks (pages/hcm/tasks/index.tsx)
 *
 * Two tabs drive four endpoints:
 *
 *   Task Library  GET    /v1/tasks?home_id={id}        the library list
 *                 POST   /v1/task                       Add Task → Save
 *                 DELETE /v1/task                       row ✕ → Confirm
 *   Task Status   GET    /v1/task-daily-tracking        per-day completion,
 *                                                       ?home_id&date&user_id
 *
 * RESPONSE SHAPE — GET /v1/tasks returns API field names (title, type,
 * shift_notes, days_of_week); normalizeTask() maps them to the UI model
 * (name, category, notes, days). Fixtures here use the API shape.
 */

import { Tags } from "../../framework/utils/tags";
import { buildHome, TEST_HOME_ID, TEST_USER_ID } from "../../framework/module-commands";

const TASKS_PATH = "/hcm/tasks";

const FROZEN_NOW = new Date(2026, 8, 8, 10, 0, 0).getTime();

/** A task row as GET /v1/tasks returns it — API field names, not UI names. */
const buildTask = (overrides: Record<string, any> = {}) => ({
  id: "task-1",
  title: "Morning meds round",
  type: "Medication",
  shift: "Morning",
  shift_notes: "Check MAR before administering.",
  days_of_week: ["Mon", "Tue"],
  home_id: TEST_HOME_ID,
  ...overrides,
});

const stubTasks = (tasks: any[] = [buildTask()]) =>
  cy.intercept("GET", "**/v1/tasks*", {
    statusCode: 200,
    body: { tasks },
  }).as("getTasks");

const stubTracking = (items: any[] = []) =>
  cy.intercept("GET", "**/v1/task-daily-tracking*", {
    statusCode: 200,
    body: { tracking: items },
  }).as("getTracking");

const stubTaskWrite = () => {
  cy.intercept("POST", "**/v1/task", { statusCode: 200, body: {} }).as(
    "createTask"
  );
  cy.intercept("PUT", "**/v1/task/**", { statusCode: 200, body: {} }).as(
    "updateTask"
  );
  // useDelete calls DELETE {base}{path}/{id} — the id is a path segment, so
  // the glob must cross it.
  cy.intercept("DELETE", "**/v1/task/**", { statusCode: 200, body: {} }).as(
    "deleteTask"
  );
};

const visitTasks = (role: any = "PCHO") => {
  cy.clearAuthSession();
  cy.setAuthSession(role);
  cy.stubHome(buildHome());
  stubTasks();
  stubTracking();
  cy.clock(FROZEN_NOW, ["Date"]);
  cy.visit(TASKS_PATH);
  cy.contains("Task Library", { timeout: 10000 }).should("be.visible");
};

describe("HCM tasks", { tags: [Tags.REGRESSION, Tags.PCHO] }, () => {
  // ── GET /v1/tasks — the library ────────────────────────────────────────────

  describe("GET /v1/tasks — the task library", () => {
    it("requests the library scoped to the caller's home", () => {
      visitTasks();
      cy.wait("@getTasks").then(({ request }) => {
        expect(request.method).to.eq("GET");
        expect(request.url).to.include("/v1/tasks");
        expect(request.url).to.include(`home_id=${TEST_HOME_ID}`);
        expect(request.headers["authorization"]).to.match(/^Bearer .+/);
      });
    });

    it("renders the stubbed tasks", () => {
      visitTasks();
      cy.wait("@getTasks");
      cy.contains("Morning meds round").should("be.visible");
    });
  });

  // ── Task Status — GET /v1/task-daily-tracking ──────────────────────────────

  describe("GET /v1/task-daily-tracking — the status tab", () => {
    it("queries daily tracking with home, date and user when the tab opens", () => {
      visitTasks();
      cy.contains("Task Status").click();
      cy.wait("@getTracking", { timeout: 10000 }).then(({ request }) => {
        expect(request.method).to.eq("GET");
        expect(request.url).to.include("/v1/task-daily-tracking");
        expect(request.url).to.include(`home_id=${TEST_HOME_ID}`);
        expect(request.url).to.include(`user_id=${TEST_USER_ID}`);
        expect(request.url).to.include("date=2026-09-08");
        expect(request.headers["authorization"]).to.match(/^Bearer .+/);
      });
    });
  });

  // ── Writes — POST and DELETE /v1/task ──────────────────────────────────────

  describe("Task writes — POST and DELETE /v1/task", () => {
    it("deletes a task through the row delete button", () => {
      stubTaskWrite();
      visitTasks();
      cy.wait("@getTasks");
      cy.contains("Morning meds round").should("be.visible");
      // Each row carries inline edit (primary) and delete (red) icon buttons —
      // single-row library, so the red button is unique on the page.
      cy.get("button.bg-red-100", { timeout: 8000 }).first().click();
      cy.contains("button", "Confirm", { timeout: 8000 }).click();
      cy.wait("@deleteTask", { timeout: 10000 }).then(({ request }) => {
        expect(request.method).to.eq("DELETE");
        expect(request.url).to.include("/v1/task");
        expect(request.url).to.include("task-1");
        expect(request.headers["authorization"]).to.match(/^Bearer .+/);
      });
    });

    it("posts a new task on save", () => {
      stubTaskWrite();
      visitTasks();
      cy.wait("@getTasks");
      cy.contains("button", "Add Task", { timeout: 8000 }).click();
      cy.get('input[name="name"]', { timeout: 8000 }).type(
        "Evening wellness check"
      );
      cy.get('select[name="category"]').select("Cleaning");
      cy.get('select[name="shift"]').select("morning");
      cy.contains("button", /^Mon$/).click();
      cy.contains("button", /^Save$/).click();
      cy.wait("@createTask", { timeout: 10000 }).then(({ request }) => {
        expect(request.method).to.eq("POST");
        expect(request.url).to.include("/v1/task");
        expect(request.body).to.have.property("title", "Evening wellness check");
        expect(request.body).to.have.property("type", "Cleaning");
        expect(request.body).to.have.property("shift", "morning");
        expect(request.headers["authorization"]).to.match(/^Bearer .+/);
      });
    });
  });
});
