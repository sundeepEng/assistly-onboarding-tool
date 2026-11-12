import { defineConfig } from "cypress";
import { rmSync } from "fs";
import {
  DEFAULT_ENV,
  TARGETS,
  resolveCredential,
  resolveEnvName,
} from "./cypress/config/environments";

// Marker for "nothing more specific was supplied". If `config.baseUrl` still
// equals this by the time setupNodeEvents runs, neither --config baseUrl=… nor
// CYPRESS_BASE_URL was set, so the mapped value is safe to apply.
const CONFIG_FILE_BASE_URL = TARGETS[DEFAULT_ENV].baseUrl;

export default defineConfig({
  e2e: {
    baseUrl: CONFIG_FILE_BASE_URL,
    specPattern: "cypress/e2e/**/*.cy.{ts,tsx}",
    /**
     * Known-defect specs fail on purpose — each asserts the behaviour the app
     * SHOULD have. A gating job that includes them is permanently red, so CI
     * opts out with one variable rather than maintaining a list of paths:
     *
     *   SKIP_KNOWN_DEFECTS=true npx cypress run
     *
     * Excluded only when asked. The default runs everything, so nobody is
     * silently skipping tests they did not know about, and `npx cypress run`
     * locally still shows the whole picture including the open defects.
     */
    excludeSpecPattern:
      process.env.SKIP_KNOWN_DEFECTS === "true" ? ["**/known-defects.cy.ts"] : [],
    supportFile: "cypress/support/e2e.ts",
    fixturesFolder: "cypress/fixtures",
    viewportWidth: 1280,
    viewportHeight: 800,
    defaultCommandTimeout: 8000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    video: false,
    screenshotOnRunFailure: true,
    // First paint is not fully deterministic (cookie polling, react-query),
    // so allow one retry in headless runs only.
    retries: { runMode: 1, openMode: 0 },
    reporter: "cypress-mochawesome-reporter",
    reporterOptions: {
      reportDir: "cypress/reports",
      // One consolidated HTML report per run; JSON kept for CI tooling.
      overwrite: false,
      html: true,
      json: true,
      charts: true,
      reportPageTitle: "Assistly E2E",
      embeddedScreenshots: true,
      inlineAssets: true,
      saveAllAttempts: true,
      // Keep the per-spec JSONs after the HTML merge — downstream tooling
      // (cypress/tools/export-testcases.js, CI dashboards) consumes them.
      saveJson: true,
    },
    setupNodeEvents(on, config) {
      // trashAssetsBeforeRuns only covers screenshots/videos — the mochawesome
      // report dir is ours to clear. Stale index_*.json must not survive into
      // a run or the quality gate can read a previous run's results.
      rmSync("cypress/reports", { recursive: true, force: true });

      // Suite selection by tag: --expose grepTags=@smoke / -@defect / a,b
      const { plugin: cypressGrepPlugin } = require("@cypress/grep/plugin");
      cypressGrepPlugin(config);
      // Mochawesome HTML + JSON report wiring.
      require("cypress-mochawesome-reporter/plugin")(on);

      // `--env environment=stg` and cypress.env.json are merged into config.env
      // before this hook runs. Cypress also strips the CYPRESS_ prefix off
      // shell vars, so `CYPRESS_ENVIRONMENT=stg` lands on env.ENVIRONMENT.
      const envName = resolveEnvName(
        config.env.environment ?? config.env.ENVIRONMENT
      );
      const target = TARGETS[envName];

      if (config.baseUrl === CONFIG_FILE_BASE_URL) {
        config.baseUrl = target.baseUrl;
      }
      // `??` so anything supplied ahead of this hook — cypress.env.json, --env,
      // or a CYPRESS_-prefixed shell var — keeps precedence over the mapping.
      // The specs read TEST_USER_EMAIL / TEST_USER_PASSWORD and stay unaware of
      // which environment supplied them.
      config.env = {
        ...config.env,
        environment: envName,
        API_BASE_URL: config.env.API_BASE_URL ?? target.apiBaseUrl,
        TEST_USER_EMAIL: resolveCredential(
          config.env,
          envName,
          "EMAIL",
          target.userEmail
        ),
        TEST_USER_PASSWORD: resolveCredential(
          config.env,
          envName,
          "PASSWORD",
          target.userPassword
        ),
      };

      // Password is never logged — this line ends up in CI output.
      // eslint-disable-next-line no-console
      console.log(
        `[cypress] environment=${envName} baseUrl=${config.baseUrl} ` +
          `api=${config.env.API_BASE_URL} user=${config.env.TEST_USER_EMAIL}`
      );

      return config;
    },
  },
  env: {
    // Route under test — the login screen lives at /login; `/` is the dashboard.
    LOGIN_PATH: "/login",
    // API_BASE_URL, TEST_USER_EMAIL and TEST_USER_PASSWORD are filled in
    // per-environment by setupNodeEvents above. They are deliberately absent
    // here: a value in this block is already on config.env when the hook runs,
    // so it would shadow the mapping for every environment. Override them in
    // cypress.env.json (gitignored) or via --env NAME=… instead.
  },
});
