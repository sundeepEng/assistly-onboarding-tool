#!/usr/bin/env node
/**
 * Persona tagging — marks the tests that actually execute AS each role.
 *
 * Model: PCHO is the super admin — every top-level describe carries
 * Tags.PCHO, so `cy:run:pcho` is the whole gated corpus. Every other persona
 * tag lands on the innermost block that names the role:
 *
 *   - a role literal inside an `it` body            -> tag that it
 *   - a role literal in a nested describe's hooks   -> tag that describe
 *     (every `it` inside it runs as that role)
 *
 * RBAC denial tests belong to the denied persona — a Nurse regression wants
 * to prove the Nurse session is refused the care-team board, the same check
 * a manual pass would make.
 *
 * Idempotent: top-level describes keep only their tier tags + Tags.PCHO;
 * persona tags elsewhere are added once.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../e2e");

const PERSONAS = ["PCG", "Senior", "Nurse", "HomeAdmin"];
const TAG = {
  PCHO: "Tags.PCHO",
  PCG: "Tags.PCG",
  Senior: "Tags.SENIOR",
  Nurse: "Tags.NURSE",
  HomeAdmin: "Tags.HOMEADMIN",
};
const PERSONA_TAGS = new Set(Object.values(TAG));
const ROLE_RE = /"(PCG|PCGLead|Senior|Nurse|NurseLead|HomeAdmin)"/g;

// Files where every test runs as PCHO and no persona mapping applies — the
// onboarding record is staff-facing; a Senior's own record is a different
// flow already covered in clinical/*.
const TOP_LEVEL_ONLY = new Set([]);

// Persona journey specs — every test in these files runs as the named role.
// The session helper carries the role literal (visitAsAdmin ->
// setAuthSession("HomeAdmin")) outside any `it` block, so role-literal
// scanning can never tag these correctly; the file's persona tag belongs on
// the top-level describe itself.
const FILE_PERSONA = new Map([
  ["personas\\homeadmin.cy.ts", TAG.HOMEADMIN],
  ["personas\\pcg.cy.ts", TAG.PCG],
  ["personas\\nurse.cy.ts", TAG.NURSE],
  ["personas\\senior.cy.ts", TAG.SENIOR],
  ["personas/homeadmin.cy.ts", TAG.HOMEADMIN],
  ["personas/pcg.cy.ts", TAG.PCG],
  ["personas/nurse.cy.ts", TAG.NURSE],
  ["personas/senior.cy.ts", TAG.SENIOR],
]);

const specs = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.name.endsWith(".cy.ts")) specs.push(p);
  }
})(ROOT);

/** Line index of the enclosing block (describe/it) for a given line. */
function enclosingBlock(lines, lineNo) {
  const myIndent = lines[lineNo].match(/^(\s*)/)[1].length;
  for (let i = lineNo - 1; i >= 0; i--) {
    const m = lines[i].match(/^(\s*)(describe|it)\(/);
    if (m && m[1].length < myIndent) return i;
  }
  return -1;
}

/** Add `tag` into the block signature on `line`, inserting {tags:[…]} if absent. */
function addTag(lines, lineNo, tag) {
  const line = lines[lineNo];
  if (line.includes(`{ tags: [`)) {
    if (!line.includes(tag)) {
      lines[lineNo] = line.replace(/\{ tags: \[/, `{ tags: [${tag}, `);
      return true;
    }
    return false;
  }
  // it("title", () => …)  →  it("title", { tags: [tag] }, () => …)
  const m = line.match(/^(\s*)(describe|it)\((.*)(".*"),\s*\(\) =>/);
  if (!m) return false;
  lines[lineNo] = line.replace(/,\s*\(\) =>/, `, { tags: [${tag}] }, () =>`);
  return true;
}

let changed = 0;
for (const file of specs) {
  const src = fs.readFileSync(file, "utf8");
  const lines = src.split("\n");

  const rel = path.relative(ROOT, file);

  // Pass 1: top-level describe — strip persona tags, keep tier + Tags.PCHO
  // (+ the file's own persona tag for journey specs).
  for (let i = 0; i < lines.length; i++) {
    if (/^describe\(/.test(lines[i]) && lines[i].includes("{ tags: [")) {
      lines[i] = lines[i].replace(/\{ tags: \[[^\]]*\] \}/, (block) => {
        const tags = block
          .match(/\{ tags: \[([^\]]*)\] \}/)[1]
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t && !PERSONA_TAGS.has(t));
        tags.push(TAG.PCHO);
        const filePersona = FILE_PERSONA.get(rel);
        if (filePersona) tags.push(filePersona);
        return `{ tags: [${tags.join(", ")}] }`;
      });
    }
  }

  // Pass 2: role literals → tag the enclosing nested block.
  if (!TOP_LEVEL_ONLY.has(rel) && !FILE_PERSONA.has(rel)) {
    const text = lines.join("\n");
    const offsets = [];
    let offset = 0;
    for (const l of lines) {
      offsets.push(offset);
      offset += l.length + 1;
    }
    let m;
    while ((m = ROLE_RE.exec(text))) {
      const role = m[1];
      if (!(role in TAG)) continue; // PCGLead/NurseLead aren't personas yet
      const lineNo = offsets.findIndex((o, i) => m.index >= o && m.index < o + lines[i].length + 1);
      const block = enclosingBlock(lines, lineNo);
      if (block === -1 || /^describe\(/.test(lines[block])) continue; // top-level → PCHO default
      addTag(lines, block, TAG[role]);
    }
  }

  const out = lines.join("\n");
  if (out !== src) {
    fs.writeFileSync(file, out);
    changed++;
  }
}
console.log(`Tagged personas in ${changed} of ${specs.length} specs.`);
