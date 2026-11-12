#!/usr/bin/env node
/**
 * Cypress quality gate — fails the job when the pass rate of the last run
 * drops below a threshold.
 *
 *   node cypress/tools/quality-gate.js [report.json] [threshold]
 *
 * Reads the merged mochawesome report (`cypress/reports/index.json`, produced
 * because the reporter runs with `saveJson: true`), computes
 *
 *   pass_rate = passes / (passes + failures) * 100
 *
 * (pending/skipped tests count towards neither side — a skipped spec must not
 * silently raise the gate), then:
 *
 *   - prints the breakdown to the console
 *   - appends a table to $GITHUB_STEP_SUMMARY when running in Actions
 *   - writes `pass_rate` to $GITHUB_OUTPUT so downstream jobs can read it
 *   - exits 1 when the rate is below the threshold or no report exists
 *
 * Defect-pinned tests are excluded upstream by the tag expression
 * (`grepTags=-@defect` / `SKIP_KNOWN_DEFECTS`), so the rate reflects the
 * suite that must stay green.
 */

const fs = require("fs");
const path = require("path");

const reportPath = path.resolve(process.argv[2] || "cypress/reports/index.json");
const threshold = Number(process.argv[3] ?? 80);

if (!fs.existsSync(reportPath)) {
  console.error(`[quality-gate] No report at ${reportPath} — the run never produced results.`);
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));

// The merged report carries an aggregate `stats` block; fall back to summing
// per-spec stats for older reporter layouts.
const aggregate = report.stats
  ? report.stats
  : (report.results || []).reduce(
      (acc, r) => {
        const s = r.stats || {};
        for (const k of ["tests", "passes", "failures", "pending", "skipped"])
          acc[k] = (acc[k] || 0) + (s[k] || 0);
        return acc;
      },
      {},
    );

const passes = aggregate.passes || 0;
const failures = aggregate.failures || 0;
const skipped = (aggregate.pending || 0) + (aggregate.skipped || 0);
const measured = passes + failures;
const passRate = measured === 0 ? 0 : (passes / measured) * 100;

const lines = [
  "## Cypress quality gate",
  "",
  `| Metric | Value |`,
  `| --- | --- |`,
  `| Passing | ${passes} |`,
  `| Failing | ${failures} |`,
  `| Skipped | ${skipped} |`,
  `| Pass rate | **${passRate.toFixed(1)}%** |`,
  `| Threshold | ${threshold}% |`,
  "",
  passRate >= threshold ? "### Gate: PASSED" : "### Gate: FAILED",
  "",
].join("\n");

console.log(lines);

if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines);
}
if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `pass_rate=${passRate.toFixed(1)}\n`);
}

if (measured === 0) {
  console.error("[quality-gate] No executed tests — refusing to gate an empty run.");
  process.exit(1);
}
if (passRate < threshold) {
  console.error(`[quality-gate] ${passRate.toFixed(1)}% < ${threshold}% — promotion blocked.`);
  process.exit(1);
}
console.log(`[quality-gate] ${passRate.toFixed(1)}% >= ${threshold}% — promotion allowed.`);
