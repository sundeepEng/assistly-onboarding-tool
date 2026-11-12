/**
 * Suite-selection tags for @cypress/grep. Import the constants rather than
 * string-typing tags into specs — a renamed tag should be a compile error,
 * not a silently-uncollected test.
 *
 *   it("logs in", { tags: [Tags.SMOKE] }, () => { ... })
 *
 * Run them with:  npx cypress run --expose grepTags=@smoke
 *                 npx cypress run --expose "grepTags=@regression @smoke"  (OR)
 *                 npx cypress run --expose grepTags=@regression+@auth     (AND)
 *                 npx cypress run --expose grepTags=-@defect              (NOT)
 */
export const Tags = {
  /** Critical-path checks against live deployments — keep this set tiny. */
  SMOKE: "@smoke",
  /**
   * Build-acceptance pass: the key behaviours of each module, kept fast.
   * Runs after a deploy lands, before the full regression sweep.
   */
  SANITY: "@sanity",
  /** The default regression corpus — every module test carries this. */
  REGRESSION: "@regression",
  /**
   * Executable bug report: asserts the behaviour the app SHOULD have and
   * fails on purpose until the defect ships. Exclude in gating jobs with
   * `grepTags=-@defect` (or SKIP_KNOWN_DEFECTS=true for whole-file defects).
   */
  DEFECT: "@defect",
  /**
   * Persona tags — a spec carries one for every role it exercises, so a role's
   * full regression path is one grep expression: `grepTags=@senior+-@defect`
   * runs every Senior scenario (and only Senior scenarios) minus defect pins.
   */
  PCHO: "@pcho",
  PCG: "@pcg",
  SENIOR: "@senior",
  NURSE: "@nurse",
  HOMEADMIN: "@homeadmin",
} as const;
