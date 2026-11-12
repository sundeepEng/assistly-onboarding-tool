#!/usr/bin/env node
/**
 * export-persona-cases.js — dump the persona coverage matrix to Excel for
 * review BEFORE it is baked into the suite.
 *
 * Walks every *.cy.ts under cypress/e2e, tracks tag inheritance
 * (top-level describe → nested describe → it), and writes one sheet per
 * persona (PCHO, HomeAdmin, PCG, Nurse, Senior) listing every test that
 * persona's run executes, grouped by module — each row carrying a one/two
 * line explanation of what the test proves and why it belongs to that
 * persona.
 *
 * Output: Assistly-Persona-TestCases.xlsx (repo root + Desktop copy).
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const ExcelJS = require("exceljs");

const E2E = path.join(__dirname, "..", "e2e");
const OUT_FILE = path.join(__dirname, "..", "..", "Assistly-Persona-TestCases.xlsx");
const DESKTOP = path.join(os.homedir(), "Desktop", "Assistly-Persona-TestCases.xlsx");

const PERSONAS = [
  { tag: "PCHO", sheet: "PCHO", basis: "Super admin — the full gated corpus" },
  { tag: "HOMEADMIN", sheet: "HomeAdmin", basis: "Operational admin — all modules except RevOps" },
  { tag: "PCG", sheet: "PCG", basis: "Caregiver — clinical round, own HCM/pay, compliance training" },
  { tag: "NURSE", sheet: "Nurse", basis: "Clinical only — assigned seniors, vitals + OTC writes" },
  { tag: "SENIOR", sheet: "Senior", basis: "Resident — own record + own billing" },
];

// Collect specs module-by-module so sheets are grouped.
const moduleSpecs = {};
const walk = (dir) => {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((ent) => {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) return walk(full);
    if (ent.name.endsWith(".cy.ts")) {
      const module = path.relative(E2E, path.dirname(full)) || "(root)";
      (moduleSpecs[module] ||= []).push(full);
    }
  });
};
walk(E2E);

const TAG_RE = /Tags\.([A-Z_]+)/g;
const tagsOnLine = (line) => {
  const out = new Set();
  let m;
  while ((m = TAG_RE.exec(line)) !== null) out.add(m[1]);
  return out;
};

/**
 * Parse one spec into tests:
 *   { module, spec, describe, title, tags:Set, defect:boolean }
 * Tag inheritance is tracked by pushing/popping describe contexts on
 * indentation depth (this codebase indents describes one level per nest).
 */
const parseSpec = (file) => {
  const module = path.relative(E2E, path.dirname(file));
  const spec = path.basename(file);
  const lines = fs.readFileSync(file, "utf8").split("\n");
  /** @type {{depth:number,tags:Set,title:string}[]} */
  const stack = [];
  const tests = [];

  lines.forEach((line) => {
    const dm = line.match(/^(\s*)describe\(\s*["'`]([^"'`]+)/);
    const im = line.match(/^(\s*)it\(\s*["'`]([^"'`]+)/);

    if (dm) {
      const depth = dm[1].length;
      while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
      stack.push({ depth, tags: tagsOnLine(line), title: dm[2] });
      return;
    }
    if (im) {
      const depth = im[1].length;
      while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
      const tags = new Set(tagsOnLine(line));
      stack.forEach((ctx) => ctx.tags.forEach((t) => tags.add(t)));
      tests.push({
        module,
        spec,
        describe: stack.length ? stack[stack.length - 1].title : "",
        title: im[2],
        tags,
        defect: tags.has("DEFECT"),
      });
    }
  });
  return tests;
};

const allTests = Object.values(moduleSpecs).flat().flatMap(parseSpec);

/** One-line "what this proves" for the row — title minus [markers]. */
const cleanTitle = (t) => t.replace(/\s+/g, " ").trim();

const basis = (test, personaTag) => {
  if (test.module === "personas") return `Dedicated ${personaTag} suite — the test runs AS ${personaTag} end-to-end`;
  if (test.tags.has(personaTag) && !test.tags.has("PCHO"))
    return `Role-scoped corpus test — executes as ${personaTag} in the module spec`;
  return `Inherited spec coverage — ${personaTag} can reach this screen, so the PCHO assertions apply`;
};

(async () => {
  const wb = new ExcelJS.Workbook();
  const headerFill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F2937" },
  };
  const moduleFill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFDDE7F0" },
  };

  for (const persona of PERSONAS) {
    const ws = wb.addWorksheet(persona.sheet);
    ws.columns = [
      { header: "#", key: "n", width: 6 },
      { header: "Module", key: "module", width: 14 },
      { header: "Spec", key: "spec", width: 38 },
      { header: "Section", key: "describe", width: 34 },
      { header: "Test Case", key: "title", width: 62 },
      { header: "Why this persona", key: "basis", width: 62 },
    ];
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = headerFill;
    ws.views = [{ state: "frozen", ySplit: 1 }];

    const tests = allTests.filter((t) => !t.defect && t.tags.has(persona.tag));
    let lastModule = null;
    let n = 0;
    for (const t of tests) {
      if (t.module !== lastModule) {
        const r = ws.addRow({ module: `── ${t.module.toUpperCase()} ──` });
        r.fill = moduleFill;
        r.font = { bold: true };
        lastModule = t.module;
      }
      n++;
      ws.addRow({
        n,
        module: t.module,
        spec: t.spec,
        describe: t.describe,
        title: cleanTitle(t.title),
        basis: basis(t, persona.tag),
      });
    }

    ws.autoFilter = { from: "A1", to: `F${ws.rowCount}` };
    console.log(`${persona.sheet}: ${tests.length} tests`);
  }

  await wb.xlsx.writeFile(OUT_FILE);
  try {
    fs.copyFileSync(OUT_FILE, DESKTOP);
    console.log(`\nWrote ${OUT_FILE}\nCopied to ${DESKTOP}`);
  } catch {
    console.log(`\nWrote ${OUT_FILE}`);
  }
})();
