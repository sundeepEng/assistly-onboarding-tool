#!/usr/bin/env node
/**
 * Cypress launcher — strips a stray ELECTRON_RUN_AS_NODE before booting.
 *
 * Cypress's binary is an Electron app. When the environment carries
 * ELECTRON_RUN_AS_NODE=1 (Electron-based IDEs inject it into spawned
 * terminals), the exe boots as plain Node, rejects its own flags
 * ("bad option: --smoke-test"), and every run dies at verify. Deleting
 * the var here makes `npm run cy:*` immune regardless of which terminal
 * or IDE launched it. Harmless no-op where the var is absent (CI).
 *
 *   node cypress/tools/run-cypress.js run --env environment=dev
 */
const { spawnSync } = require("child_process");

delete process.env.ELECTRON_RUN_AS_NODE;

// cypress/package.json's exports map hides ./bin — resolve the CLI by path.
const cli = require("path").join(
  __dirname,
  "../../node_modules/cypress/bin/cypress",
);
const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], {
  stdio: "inherit",
});

process.exit(result.status ?? 1);
