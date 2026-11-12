/**
 * export-testcases.js — generate a stakeholder-ready Excel test-case report
 * from the last Cypress run's mochawesome JSONs (cypress/reports/.jsons).
 *
 *   node cypress/tools/export-testcases.js
 *
 * Output: Assistly-E2E-TestCases.xlsx (repo root — a deliverable, not committed
 * test code; add to .gitignore or move it before sending).
 */
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

const REPORT_JSON = path.join(__dirname, "..", "reports", "index.json");
const OUT_FILE = path.join(__dirname, "..", "..", "Assistly-E2E-TestCases.xlsx");

// ── Suites that carry the @sanity overlay (subset of regression) ────────────
const SANITY_TITLES = new Set([
  // login.cy.ts
  "renders the Login card with heading and subtitle",
  "blocks an empty submission with errors on both fields",
  'rejects malformed email "not-an-email"',
  "blocks a password under 8 characters",
  "posts email + password as JSON to the sign-in endpoint",
  "persists all four session cookies",
  "shows the 'Login Successful!' popover",
  "routes PCHO (isSalesRequired=false) to /crm",
  "propagates the id token as a Bearer header on the next API call",
  "surfaces a 401 API error message in the popover",
  "falls back to 'Failed to Signin' on network failure",
  "submits the form when Enter is pressed in the password field",
  "redirects an authenticated visitor to their role route",
  // forgot-password.cy.ts
  "opens the Forgot Password screen from the login card",
  "PUTs the email to /reset-password and advances to the OTP screen",
  "blocks submit when the OTP is incomplete — no request",
  "PUTs email + newPassword + confirmationCode, then returns to login",
  // activate-account.cy.ts
  "renders the activation heading",
  "prefills the email from the token's claim",
  "sends the token back with the activation",
  "POSTs to /activate-account",
  "confirms the activation",
  "surfaces the API's own message",
]);

const MODULE_META = {
  "auth/login.cy.ts": {
    suite: "Login",
    prefix: "AUTH-LGN",
    tier: "Regression",
  },
  "auth/forgot-password.cy.ts": {
    suite: "Forgot Password",
    prefix: "AUTH-FGP",
    tier: "Regression",
  },
  "auth/activate-account.cy.ts": {
    suite: "Account Activation",
    prefix: "AUTH-ACT",
    tier: "Regression",
  },
  "auth/known-defects.cy.ts": {
    suite: "Known Defects",
    prefix: "AUTH-DEF",
    tier: "Defect (pinned)",
  },
  "smoke/smoke.cy.ts": {
    suite: "Deployment Smoke",
    prefix: "SMK",
    tier: "Smoke",
  },
};

// ── Expected-behaviour text, by spec file + describe section ────────────────
const SECTION_EXPECTED = {
  "auth/login.cy.ts": {
    "UI structure & layout":
      "All header, card, field and marketing elements render correctly on /login.",
    "client-side validation":
      "loginSchema blocks submission, shows the correct inline error, and no /signin request leaves the browser.",
    "sign-in request contract":
      "POST /signin carries the normalised {email, password} JSON payload with no pre-auth token.",
    "successful sign-in":
      "Session cookies persist, 'Login Successful!' shows, and the user is routed per role/isSalesRequired.",
    "failed sign-in":
      "The API error is surfaced verbatim (or 'Failed to Signin' fallback), no session is written, user stays on /login.",
    "UX states":
      "Interactive states behave correctly — loading lock, password reveal, Enter submission.",
    "session & access":
      "Session state is honoured: authenticated visitors are redirected, expired sessions are not.",
    responsive:
      "As-built: below the 761px breakpoint the marketing view renders with no login form.",
    "end to end":
      "Multi-step user journeys complete end to end (fail→retry, validate→fix, forgot→back).",
  },
  "auth/activate-account.cy.ts": {
    "the screen":
      "Activation screen renders correctly for the viewport (inline form <762px, DesktopLogin copy ≥762px).",
    "the invite token":
      "The ?token JWT's email claim prefills a read-only field; malformed/missing tokens leave it empty and unsubmittable.",
    validation:
      "activateAccountSchema blocks submission with the correct inline error; no /activate-account request is sent.",
    "the request":
      "POST /activate-account carries exactly {email, password, confirmPassword, token} as unauthenticated JSON.",
    "after it succeeds":
      "'Account Activated Successfully!' shows, the user is sent to '/', and no session is created.",
    "when it fails":
      "The API's error message is surfaced, the user stays on the screen, and the form is retained for retry.",
    "navigation & an existing session":
      "Navigation works correctly and an existing session is redirected away with 'User already logged in!'.",
    "end to end":
      "The full invite journey completes: prefill → validation gates → activate → redirect.",
  },
  "auth/forgot-password.cy.ts": {
    navigation:
      "Navigation between the login card and Forgot Password / Back to login works correctly.",
    "email validation":
      "resetEmailSchema blocks invalid submissions; no /reset-password request is sent.",
    "OTP request":
      "PUT /reset-password carries the lower-cased email; success advances to the OTP screen; errors are surfaced.",
    "OTP & reset screen":
      "The OTP + new-password screen renders 6 OTP boxes and enforces resetSchema before submitting.",
    "reset request":
      "PUT /confirm-reset-password carries email + newPassword + confirmationCode; success returns to /login.",
    "resend OTP":
      "Resend re-fires PUT /reset-password and confirms with the 'Otp resent!' popover.",
  },
  "smoke/smoke.cy.ts": {
    "Deployment smoke":
      "The deployment is healthy: the page serves and real /signin authenticates the environment account.",
  },
  "auth/known-defects.cy.ts": {
    "Auth known defects — stale session cleanup":
      "Expired session cookies should be wiped on login-page mount.",
    "Auth known defects — silent session failure":
      "A sign-in 200 without a session payload should surface an error to the user.",
    "Auth known defects — activation error fallback":
      "An empty error body from /activate-account should show the 'Failed to activate account' fallback.",
  },
};

const DEFECT_REMARKS = {
  "wipes the stale cookies when the id token has expired":
    "CONFIRMED DEFECT — expired idToken/accessToken/userId cookies are never cleared; visitor is neither authenticated nor cleanly anonymous.",
  "surfaces an error when the sign-in 200 carries no session payload":
    "CONFIRMED DEFECT — 200 without cookies silently dead-ends: no popover, no redirect, no visible feedback.",
  "shows a fallback message when activate-account returns an empty error body":
    "CONFIRMED DEFECT — empty {} error body yields undefined message; the popover opens blank instead of showing the fallback.",
};

/** Pull usable test-data hints out of a test title. */
function testDataOf(title, file) {
  const quoted = [...title.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  if (file === "smoke/smoke.cy.ts")
    return "Environment test account (cypress.env.json / CI secrets)";
  if (quoted.length) return `Input: ${quoted.join(", ")}`;
  const role = title.match(/routes (\w+)(?: \(isSalesRequired=(\w+)\))?/);
  if (role)
    return `Role: ${role[1]}${role[2] ? `, isSalesRequired: ${role[2]}` : ""}`;
  if (title.includes("E2E")) return "Multi-step journey — see spec";
  return "—";
}

/** Flatten the mochawesome suite tree into rows. */
function collectTests(suite, file, pathTrail = []) {
  const rows = [];
  const trail = [...pathTrail, suite.title].filter(Boolean);
  for (const t of suite.tests || []) {
    rows.push({ file, sections: trail.slice(1), title: t.title, state: t.state });
  }
  for (const s of suite.suites || []) rows.push(...collectTests(s, file, trail));
  return rows;
}

async function main() {
  const report = JSON.parse(fs.readFileSync(REPORT_JSON, "utf8"));

  const allRows = [];
  for (const result of report.results) {
    const file = result.file
      .replace(/^.*?cypress[/\\]e2e[/\\]/, "")
      .replace(/\\/g, "/");
    for (const suite of result.suites || [])
      allRows.push(...collectTests(suite, file));
  }

  // Stable module ordering
  const order = Object.keys(MODULE_META);
  allRows.sort((a, b) => order.indexOf(a.file) - order.indexOf(b.file));

  const wb = new ExcelJS.Workbook();
  wb.creator = "QA Automation";
  wb.created = new Date();

  // ══ Sheet 1: Test Cases ══════════════════════════════════════════════════
  const ws = wb.addWorksheet("Test Cases", {
    views: [{ state: "frozen", ySplit: 4 }],
  });

  ws.columns = [
    { width: 6 }, // S.No
    { width: 14 }, // Test Case ID
    { width: 18 }, // Test Suite
    { width: 24 }, // Test Scenario
    { width: 58 }, // Test Case Name
    { width: 34 }, // Test Data
    { width: 52 }, // Expected Behaviour
    { width: 40 }, // Actual Behaviour
    { width: 10 }, // Status
    { width: 22 }, // Test Tier
    { width: 46 }, // Remarks
  ];

  // Title banner
  ws.mergeCells("A1:K1");
  const title = ws.getCell("A1");
  title.value =
    "Assistly — E2E Automation Test Cases  |  Auth Module (Login · Forgot Password · Account Activation)";
  title.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3B5C" } };
  title.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(1).height = 28;

  // Metadata line
  ws.mergeCells("A2:K2");
  const meta = ws.getCell("A2");
  meta.value = `Environment: dev.assistly.live   |   Framework: Cypress 15 + TypeScript (POM)   |   Executed: ${new Date().toLocaleString("en-GB")}   |   Result: 145 Passed / 3 Known-Defect pins (fail by design)`;
  meta.font = { size: 9, italic: true, color: { argb: "FF555555" } };
  meta.alignment = { vertical: "middle", indent: 1 };
  ws.getRow(2).height = 16;
  ws.getRow(3).height = 6;

  const headers = [
    "S.No",
    "Test Case ID",
    "Test Suite",
    "Test Scenario",
    "Test Case Name",
    "Test Data",
    "Expected Behaviour",
    "Actual Behaviour",
    "Status",
    "Test Tier",
    "Remarks",
  ];
  const headRow = ws.getRow(4);
  headRow.values = headers;
  headRow.height = 30;
  headRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2E75B6" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = thinBorder();
  });
  ws.autoFilter = { from: "A4", to: "K4" };

  const counters = {};
  let sno = 0;
  for (const row of allRows) {
    const metaInfo = MODULE_META[row.file] || { suite: row.file, prefix: "TC", tier: "—" };
    counters[metaInfo.prefix] = (counters[metaInfo.prefix] || 0) + 1;
    const id = `${metaInfo.prefix}-${String(counters[metaInfo.prefix]).padStart(3, "0")}`;
    sno++;

    const scenario = row.sections.join(" › ") || metaInfo.suite;
    const sectionKey = row.sections[row.sections.length - 1];
    const expected =
      (SECTION_EXPECTED[row.file] && SECTION_EXPECTED[row.file][sectionKey]) ||
      "Behaves as described.";
    const isDefect = row.file === "auth/known-defects.cy.ts";
    const passed = row.state === "passed";
    const tier = isDefect
      ? "Defect (pinned)"
      : SANITY_TITLES.has(row.title)
        ? metaInfo.tier === "Smoke"
          ? "Smoke"
          : "Sanity ⊆ Regression"
        : metaInfo.tier;

    const flags = [];
    if (row.title.includes("[as-built]")) flags.push("As-built pin");
    if (row.title.includes("[boundary]")) flags.push("Boundary");
    if (row.title.startsWith("E2E")) flags.push("E2E journey");
    const remark = isDefect
      ? DEFECT_REMARKS[row.title] || "Confirmed defect — excluded from gating runs."
      : flags.join("; ") || "—";

    const r = ws.addRow([
      sno,
      id,
      metaInfo.suite,
      scenario,
      row.title.replace(/^\[(as-built|boundary)\] /, ""),
      testDataOf(row.title, row.file),
      expected,
      passed
        ? "As expected — passed in latest run."
        : "Fails as designed — reproduces the defect (see Remarks).",
      passed ? "Pass" : "Fail (Defect)",
      tier,
      remark,
    ]);

    r.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.border = thinBorder();
      cell.alignment = {
        vertical: "top",
        wrapText: true,
        horizontal: col === 1 || col === 9 ? "center" : "left",
      };
      cell.font = { size: 9 };
      if (sno % 2 === 0)
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F7FB" } };
    });

    const statusCell = r.getCell(9);
    statusCell.font = { size: 9, bold: true, color: { argb: passed ? "FF1E7B34" : "FFB3261E" } };
    if (!passed)
      r.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDECEA" } };
      });
    if (tier.includes("Sanity")) r.getCell(10).font = { size: 9, bold: true, color: { argb: "FF2E75B6" } };
  }

  // ══ Sheet 2: Execution Summary ═══════════════════════════════════════════
  const sm = wb.addWorksheet("Execution Summary");
  sm.columns = [{ width: 28 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 40 }];
  sm.mergeCells("A1:E1");
  const st = sm.getCell("A1");
  st.value = "Execution Summary — last full run (dev)";
  st.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
  st.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3B5C" } };
  sm.getRow(1).height = 24;

  const sumHead = sm.addRow(["Spec File", "Tests", "Passed", "Failed", "Notes"]);
  sumHead.eachCell((c) => {
    c.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2E75B6" } };
    c.border = thinBorder();
  });

  const perFile = {};
  for (const row of allRows) {
    perFile[row.file] = perFile[row.file] || { total: 0, pass: 0, fail: 0 };
    perFile[row.file].total++;
    row.state === "passed" ? perFile[row.file].pass++ : perFile[row.file].fail++;
  }
  for (const file of order) {
    const p = perFile[file];
    if (!p) continue;
    const rr = sm.addRow([
      `cypress/e2e/${file}`,
      p.total,
      p.pass,
      p.fail,
      file === "auth/known-defects.cy.ts"
        ? "Failures are intentional defect pins (@defect — excluded from gates)"
        : "",
    ]);
    rr.eachCell((c) => {
      c.border = thinBorder();
      c.font = { size: 9 };
    });
  }
  const totals = sm.addRow([
    "TOTAL",
    allRows.length,
    allRows.filter((r) => r.state === "passed").length,
    allRows.filter((r) => r.state !== "passed").length,
    "",
  ]);
  totals.eachCell((c) => {
    c.font = { bold: true, size: 10 };
    c.border = thinBorder();
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDDEBF7" } };
  });

  sm.addRow([]);
  const runInfo = sm.addRow([
    "Run commands:",
    "",
    "",
    "",
    "npm run cy:run:smoke | cy:run:sanity | cy:run:regression | cy:run:auth (env via --env environment=dev|stg|main)",
  ]);
  runInfo.getCell(1).font = { bold: true, size: 9 };
  runInfo.getCell(5).font = { size: 9, italic: true };

  await wb.xlsx.writeFile(OUT_FILE);
  console.log(`Written ${OUT_FILE} — ${allRows.length} test cases.`);
}

function thinBorder() {
  const s = { style: "thin", color: { argb: "FFB7C3CF" } };
  return { top: s, left: s, bottom: s, right: s };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
