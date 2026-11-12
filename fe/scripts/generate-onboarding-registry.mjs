#!/usr/bin/env node
/**
 * Generates the Gia onboarding registry from the shared Markdown context file.
 *
 * The Markdown file (GIA_CRM_CLINICAL_ONBOARDING.md) is the single source of
 * truth for steps, guidance, routes and flow order. This script extracts the
 * fenced `json` block, validates it, and writes a flat registry JSON that both
 * the portal (fe-onboarding) and the dashboard (fe) consume at build time.
 *
 * Usage:
 *   node scripts/generate-onboarding-registry.mjs --out <output.json>
 *
 * Env:
 *   GIA_CONTEXT_FILE  absolute/relative path to the shared markdown file.
 *                     Defaults to ../docs/gia-onboarding/GIA_CRM_CLINICAL_ONBOARDING.md.md
 *                     relative to this script.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const defaultContext = resolve(
  here,
  "../docs/gia-onboarding/GIA_CRM_CLINICAL_ONBOARDING.md.md"
);

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const outPath = outIdx >= 0 ? resolve(args[outIdx + 1]) : null;
const contextPath = resolve(process.env.GIA_CONTEXT_FILE || defaultContext);

if (!outPath) {
  console.error("Missing --out <path>");
  process.exit(1);
}

const fail = (msg) => {
  console.error(`onboarding-registry: ${msg}`);
  process.exit(1);
};

const SAFE_PATH = /^\/(crm|clinical)(\/[a-z0-9][a-z0-9\-_/]*)?$/;

let markdown;
try {
  markdown = readFileSync(contextPath, "utf8");
} catch (e) {
  fail(`cannot read context file ${contextPath}: ${e.message}`);
}

// Extract the last fenced ```json block.
const blocks = [...markdown.matchAll(/```json\s*\n([\s\S]*?)```/g)];
if (!blocks.length) fail("no fenced json block found in context file");
let config;
try {
  config = JSON.parse(blocks[blocks.length - 1][1]);
} catch (e) {
  fail(`fenced json block is not valid JSON: ${e.message}`);
}

const { modules, flows } = config;
if (!Array.isArray(modules) || !modules.length) fail("config.modules missing");
if (!Array.isArray(flows) || !flows.length) fail("config.flows missing");

const steps = {};
const screens = {};
const moduleIds = new Set();
const screenIds = new Set();

for (const mod of modules) {
  if (!mod.module_id || moduleIds.has(mod.module_id))
    fail(`duplicate or missing module_id: ${mod.module_id}`);
  moduleIds.add(mod.module_id);
  if (!SAFE_PATH.test(mod.path || ""))
    fail(`unsafe module path for ${mod.module_id}: ${mod.path}`);
  for (const screen of mod.screens || []) {
    if (!screen.screen_id || screenIds.has(screen.screen_id))
      fail(`duplicate or missing screen_id: ${screen.screen_id}`);
    screenIds.add(screen.screen_id);
    if (!SAFE_PATH.test(screen.path || ""))
      fail(`unsafe screen path for ${screen.screen_id}: ${screen.path}`);
    screens[screen.screen_id] = {
      screen_id: screen.screen_id,
      title: screen.title,
      path: screen.path,
      module_id: mod.module_id,
      module_title: mod.title,
    };
    for (const action of screen.actions || []) {
      const id = action.step_id;
      if (!id || steps[id]) fail(`duplicate or missing step_id: ${id}`);
      if (!id.startsWith(`${mod.module_id}.${screen.screen_id}.`))
        fail(`step_id ${id} does not match ${mod.module_id}.${screen.screen_id}.*`);
      if (action.kind !== "onboarding" && action.kind !== "reference")
        fail(`step ${id} has unknown kind ${action.kind}`);
      steps[id] = {
        step_id: id,
        title: action.title,
        guidance: action.guidance,
        kind: action.kind,
        completion_check_key: action.completion_check_key ?? null,
        screen_id: screen.screen_id,
        screen_title: screen.title,
        screen_path: screen.path,
        module_id: mod.module_id,
        module_title: mod.title,
        module_path: mod.path,
      };
    }
  }
}

const flowMap = {};
for (const flow of flows) {
  if (!flow.flow_id || flowMap[flow.flow_id])
    fail(`duplicate or missing flow_id: ${flow.flow_id}`);
  if (!Array.isArray(flow.steps) || !flow.steps.length)
    fail(`flow ${flow.flow_id} has no steps`);
  for (const stepId of flow.steps) {
    if (!steps[stepId])
      fail(`flow ${flow.flow_id} references unknown step ${stepId}`);
    if (steps[stepId].kind !== "onboarding")
      fail(`flow ${flow.flow_id} includes non-onboarding step ${stepId}`);
  }
  flowMap[flow.flow_id] = {
    flow_id: flow.flow_id,
    steps: flow.steps,
    sequence_status: flow.sequence_status || "suggested",
  };
}

const registry = {
  schema_version: config.schema_version || "1.0.0",
  generated_at: new Date().toISOString(),
  source: contextPath,
  screens,
  steps,
  flows: flowMap,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(registry, null, 2) + "\n");
console.log(
  `onboarding-registry: wrote ${outPath} (${Object.keys(steps).length} steps, ${Object.keys(flowMap).length} flows)`
);
