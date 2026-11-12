# Assistly E2E — Cypress + TypeScript Framework

End-to-end automation for the Assistly web app (Next.js + React + MUI). Written
in TypeScript, runs against `dev`, `stg`, and `main` deployments, and splits
into **stubbed module specs** (fast, deterministic) and **real-auth smoke
checks** (prove the deployment works).

---

## Quick start

```bash
npm install --legacy-peer-deps     # repo convention (no committed lockfile)
cp cypress.env.example.json cypress.env.json   # only needed for stg/main creds

npm run cy:open:dev                # interactive runner against dev
npm run cy:run:smoke               # headless @smoke suite
npm run cy:run:stg                 # full suite against stg
```

`dev` needs no credentials (a throwaway account is committed in
`cypress/config/environments.ts`). `stg` and `main` require accounts — put
them in `cypress.env.json` (gitignored) or export `CYPRESS_STG_USER_EMAIL` /
`CYPRESS_STG_USER_PASSWORD` etc.

Verify the toolchain any time: `npm run typecheck:cypress && npm run lint:cypress`

---

## Architecture

```
cypress/
├── config/
│   └── environments.ts        Environment matrix + credential resolution
│                              (the ONLY place env URLs and fallbacks live)
├── e2e/                       Specs, grouped by app module — auth/, smoke/,
│                              crm/, clinical/, hcm/, revops/, compliance/,
│                              dashboard/, documents/ (each module dir
│                              carries its own README documenting coverage)
│   ├── personas/              RBAC matrix — journeys per role on the
│   │                          default residential (PCH) home
│   └── home-types/            Non-module dimension: a folder per home type
│       └── in-home-care/      every place In-Home Care diverges + its
│                              persona journeys
├── fixtures/                  Static canned JSON that never varies
├── framework/                 THE ENGINE — every reusable layer, one roof
│   ├── commands/              Custom commands by domain
│   │   ├── auth.commands.ts   Session: setAuthSession, login, loginAs
│   │   ├── network.commands.ts interceptApi, stubs, id-token assertions
│   │   ├── ui.commands.ts     byTestId, popover, form helpers
│   │   └── module.commands.ts Module stubs: stubUsers/stubHome/visitAs/…
│   ├── factories/             build<Entity>() response builders (sync with API)
│   │   └── module.factories.ts  Module entities: shifts, invoices, payouts…
│   ├── pages/                 Page objects — the only layer that knows the DOM
│   │   ├── base.page.ts       BasePage: visit/assertUrl/popover contract
│   │   ├── authenticated.page.ts  Shell for signed-in pages (nav, logout)
│   │   └── login.page.ts      Reference implementation
│   ├── utils/
│   │   ├── routes.ts          Routes + ApiPaths constants
│   │   └── tags.ts            @smoke / @regression / @defect constants
│   ├── module-commands.ts     Barrel — specs import builders + ids + stubs
│   ├── incident-report.ts     Shared helpers for the incident-report specs
│   └── constants.ts           Cookie names, roles, test ids — mirror of app
├── support/
│   └── e2e.ts                 Thin bootstrap: grep, reporter, command registry,
│                              slowMo, dev-overlay suppression
├── tools/
│   ├── run-cypress.js         Launcher — strips ELECTRON_RUN_AS_NODE (IDE terminals)
│   ├── tag-personas.js        Stamps persona tags on role-path tests in module specs
│   ├── export-testcases.js    Mochawesome JSON → formatted Excel test-case doc
│   ├── export-persona-cases.js Same, grouped per persona tag
│   └── quality-gate.js        Pass-rate gate used by the CI job
├── .eslintrc.json             eslint-plugin-cypress ruleset
├── tsconfig.json              Standalone TS project for the suite
└── README.md                  This file
cypress.config.ts              defineConfig — wiring only, logic lives in config/
cypress.env.example.json       Credential contract for gitignored env file
```

**Dependency rule: specs → pages → commands/factories → config.** Nothing
points back up. Specs never import selectors; page objects never assert on
other pages.

---

## The two auth strategies — pick deliberately

| | `cy.setAuthSession(role)` | `cy.login(email?, password?)` |
|---|---|---|
| What it does | Writes the same 4 cookies a sign-in response would (mock JWT) | Real `POST {API}/signin`, real cookies, cached via `cy.session` |
| Network | Every endpoint must be stubbed by the spec | Real API throughout |
| Speed | ~instant | First spec pays the sign-in cost; rest reuse the session |
| Use for | **Module/regression specs** — deterministic UI + contract checks | **`@smoke` + live-env checks** — proves deployment end-to-end |
| Role control | Any `AppRole` (PCHO, Nurse, SalesDirector…) | Whatever role the real account holds |

Rule of thumb: **default to `setAuthSession` + stubs.** Reach for `cy.login`
only when the test's value is that the real deployment works.

```ts
// Module spec: seeded session + stubbed endpoints
beforeEach(() => {
  cy.setAuthSession("PCHO");
  cy.interceptApi("GET", ApiPaths.users, "users", { body: { users: [buildUserRow()] } });
});

// Smoke spec: real sign-in
it("signs in", { tags: [Tags.SMOKE] }, () => {
  cy.login();
  cy.getCookie("idToken").should("exist");
});
```

---

## Page-object pattern

Every page is a class extending `BasePage` (or `AuthenticatedPage` for signed-in
screens). It owns its `path`, lazy element getters, and **user-level verbs** —
what a person does, expressed once.

```ts
export class LoginPage extends BasePage {
  readonly path = LOGIN_PATH;
  get emailInput() { return cy.get('input[name="email"]'); }      // lazy, re-queries
  signIn(email: string, password: string) {                        // user-level verb
    return this.fillForm(email, password).submit();
  }
}
export const loginPage = new LoginPage();                          // singleton
```

In specs: `loginPage.visit().signIn(...)` — never `cy.get('input[name=…]')`
in a spec file.

### Selector precedence

1. **`[data-testid]`** — the stable contract. Ask devs to add `data-testid` to
   elements specs need; query them via `cy.byTestId("…")` / `page.el("…")`.
2. **Semantic selectors** — `name` attributes, `role`, label, placeholder,
   visible text.
3. **Structural selectors** — last resort; scope them tight and leave a
   comment saying why (e.g. `desktopLogin`'s `mq761:hidden` scope).

---

## Tagging & suite selection (@cypress/grep)

Import tags from `cypress/framework/utils/tags.ts` — never string-type them (a renamed
tag must be a compile error, not an uncollected test).

| Tag | Meaning | Gating? |
|---|---|---|
| `@smoke` | Critical-path, real-auth, read-only checks. **Keep tiny.** | PR + deploy gate |
| `@sanity` | Build-acceptance pass: each module's key behaviours, kept fast | Post-deploy, pre-regression |
| `@regression` | The full module corpus | Scheduled / on-demand |
| `@defect` | Executable bug report — fails until the fix ships | Excluded from gates |

Suite tags and test tags stack: a `describe` tagged `@regression` makes every
`it` inside regression corpus, and an `it` can *additionally* carry `@sanity`
to also belong to the smaller pass.

```ts
describe("Login", { tags: [Tags.REGRESSION] }, () => {
  it("happy path", { tags: [Tags.SMOKE, Tags.SANITY] }, () => { … });
  it("edge case", () => { … });   // regression only
});
```

Tag expressions use **space for OR**, `+` for AND, `-` for NOT:

```bash
npx cypress run --expose "grepTags=@smoke"                # smoke only
npx cypress run --expose "grepTags=@sanity @smoke"        # build-acceptance pass
npx cypress run --expose "grepTags=@regression @sanity @smoke"  # full corpus
npx cypress run --expose "grepTags=-@defect"              # everything except defects
SKIP_KNOWN_DEFECTS=true npx cypress run            # also drops known-defects.cy.ts files
```

### Persona suites

Two layers, complementary:

**`cypress/e2e/personas/<role>.cy.ts`** — dedicated persona specs: the tests
run *as that role* end-to-end — what they land on, what their sidebar offers,
every screen they can view or write, and every route that must bounce them.
Built directly from `utils/roles.ts` (`Permissions` + `roleNavAllow`) and the
page-level gates; divergences are pinned `[as-built]` or in the owning
module's `known-defects.cy.ts`. Current dedicated specs:
`personas/pcho.cy.ts` (46), `personas/homeadmin.cy.ts` (90),
`personas/pcg.cy.ts` (91), `personas/nurse.cy.ts` (69),
`personas/senior.cy.ts` (67).

**Persona tags on module specs** — `tag-personas.js` marks every `it`/nested
describe whose body names a role literal (`setAuthSession("PCG")`,
`visitCarePlan(senior, "Nurse")`), so a persona run also sweeps the role-path
tests scattered through the module corpus — including the RBAC denial checks,
which belong to the denied role's suite.

```bash
npm run cy:run:pcho        # PCHO — super admin: the whole gated corpus
npm run cy:run:nurse       # Nurse — clinical board + own profile, nothing else
npm run cy:run:pcg         # Personal Care Giver — clinical round, own payroll
npm run cy:run:senior      # Senior — own record, own billing
npm run cy:run:homeadmin   # Home Admin — everything except RevOps
npm run cy:run:personas    # one click — all five persona journey specs
```

`grepTags=@<persona>+-@defect` = that persona's tests AND NOT defect pins.
For an environment regression: run each persona suite against the target
(`--env environment=stg`) — five sign-offs, one per role.

### Known defects

A bug the app should not have is a spec that *should* pass, tagged `@defect`
or filed as `known-defects.cy.ts`. It stays red in the repo — an executable
bug report with a link to the ticket in the test title — and CI filters it out
of gating runs. When the fix ships, the test goes green and the tag is removed.

---

## Reporting

`cypress-mochawesome-reporter` produces a consolidated HTML + JSON report per
run in `cypress/reports/` (screenshots embedded, retries shown). CI uploads it
as a build artifact. Open locally after a run:

```bash
npx cypress run && start cypress/reports/index.html
```

---

## Environments & secrets

`cypress/config/environments.ts` maps `environment=dev|stg|main` → `baseUrl` +
`API_BASE_URL` + optional committed account. Resolution order for credentials,
most specific first: `TEST_USER_*` (run-scoped override) → `<ENV>_USER_*`
(per-env account) → committed fallback (dev only).

- **Never commit stg/main credentials.** `cypress.env.json` is gitignored;
  CI reads `CYPRESS_<ENV>_USER_*` from Actions secrets.
- URLs are public and committed — the *accounts* are the secret.

---

## CI (`.github/workflows/`)

Two files, split by responsibility:

- **`cypress-automation.yml`** — the generic runner. Manual dispatch (env,
  tag expression, spec glob, pass threshold) and `workflow_call` so any
  pipeline can consume it as a gate. Waits for the site, typechecks + lints
  test code, runs headless with `SKIP_KNOWN_DEFECTS=true`, uploads reports.
- **`cypress-gates.yml`** — the event-driven layering on top:

  | Trigger | Lane | Scope | Gate |
  |---|---|---|---|
  | `pull_request` → dev/main | persona matrix (nurse, senior, homeadmin, pcg), dev | `@<role>+-@defect` — persona spec **plus** every module test tagged for the role | 80% each |
  | `push` → dev | sanity, dev | `@smoke @sanity -@defect` — build acceptance | 80% |
  | `push` → main | regression, prod | `-@defect` — full corpus | 80% |

  The persona lanes run in parallel with `fail-fast: false`, so a red role
  can't mask the others. Because `tag-personas.js` stamps the module corpus
  with role tags, `@homeadmin` sweeps every module test the role exercises —
  the persona file itself is only the curated journey layer on top.

### The promotion gate

`cypress/tools/quality-gate.js` reads the merged mochawesome report and fails
the job when `passes / (passes + failures)` drops below `pass_threshold` —
so a run that is ≥80% green succeeds even though individual tests failed,
while a run below it blocks promotion. The measured rate is written to the
job summary and exposed as the `pass_rate` job output.

A deploy pipeline consumes it two ways:

```yaml
# 1. As a reusable gate — deploy only runs when the gate job succeeds
e2e-gate:
  uses: ./.github/workflows/cypress-automation.yml
  with: { environment: stg, tags: "-@defect", pass_threshold: "80" }
  secrets: inherit
deploy-stg:
  needs: e2e-gate
  steps: [ …deploy… ]

# 2. As a required status check — mark "E2E (stg)" required in branch
#    protection so no PR merges below the threshold.
```

Local equivalent — measure the rate yourself after any run:

```bash
npm run cy:run:regression                       # or any spec/env
node cypress/tools/quality-gate.js              # prints the rate, exits non-zero < 80%
node cypress/tools/quality-gate.js cypress/reports/index.json 95   # stricter gate
```

---

## Writing a new module spec — checklist

1. Create `cypress/e2e/<module>/<feature>.cy.ts` — name `<area>-<concern>` so
   alphabetical order groups related coverage.
2. If the page doesn't have an object yet, create `cypress/framework/pages/<module>.page.ts`
   extending `AuthenticatedPage` (or `BasePage` for public pages): `path`,
   element getters, user-level verbs, message constants synced with the app's
   zod schema.
3. `cy.setAuthSession(role)` in `beforeEach` — pick the *narrowest* role that
   exercises the feature; assert denied paths with a role below it.
4. Stub every endpoint the page calls with `cy.interceptApi` + factories
   (`buildUserRow`, `buildHome`, …). Add a factory for a new entity rather than
   inlining response bodies.
5. Wait on aliases (`cy.wait("@users")`) — **never `cy.wait(ms)`** (lint rule).
6. Assert user-visible outcomes; assert request payloads when the contract
   itself is under test. Use `attachIdTokenToRequests` +
   `assertAuthorizedWithIdToken` for auth-propagation checks.
7. Tag: `@regression` on the module describe; add `@sanity` to the key-path
   tests; `@smoke` only for true critical paths with real auth; `@defect` for
   pinned bugs.
8. `npm run typecheck:cypress && npm run lint:cypress` must be clean.

### Flake policy

- One retry in `runMode` already exists — that's for paint timing, not a
  license to write order-dependent tests. `testIsolation` stays on.
- No fixed `cy.wait(ms)`, no `.then` chaining on detached subjects
  (`cy.typeField` exists precisely because the form remounts), no assertions
  on things outside the page under test.
- A test that fails twice in a row in CI is *quarantined* (tag `@defect` +
  ticket), not retried into green.

---

## Troubleshooting

**`Cypress failed to start … bad option: --smoke-test`** — the IDE terminal
(VS Code/Windsurf extension host) exports `ELECTRON_RUN_AS_NODE=1`, which makes
every Electron binary — including Cypress.exe — behave as plain Node. Prefix
the command:

```bash
env -u ELECTRON_RUN_AS_NODE npx cypress run
```

Regular terminals and CI are unaffected.

**`allowCypressEnv` deprecation warning** — Cypress is migrating from
`Cypress.env()` to `cy.env()` / `Cypress.expose()`. The suite still uses
`Cypress.env()` deliberately: it's the contract the existing spec corpus is
built on, and the only "secret" it exposes is a test account that's committed
anyway. Migration is a single sweep when Cypress removes the flag — `grepTags`
already rides the new `--expose` mechanism.

## Debugging helpers

```bash
npx cypress open --env environment=dev              # interactive runner
npx cypress run --env slowMo=400 --spec …           # demo slow-motion
npx cypress run --browser chrome --env …            # pick a browser
```

Slow-mo pauses *after* each visible command (click/type/visit) so recordings
and demos are readable — it never affects normal or CI runs.

---

## Module coverage — all landed

| Module | Specs | Test definitions | Defect pins |
| --- | --- | --- | --- |
| auth | 4 | ~123 | 3 |
| smoke | 1 | 2 | — |
| crm | 11 | ~746 | 17 |
| clinical | 15 | ~823 | 15 |
| hcm | 12 | ~759 | 10 |
| revops | 8 | ~1,336 | 14 |
| compliance | 3 | ~162 | 2 |
| dashboard | 4 | ~152 | 3 |
| ihc (home-types/) | 2 | ~54 | — |
| documents | 1 | ~6 | — |
| **Total** | **61** | **~4,163** | **~64** |

Counts are static `it()` definitions — runtime totals vary with `it.each`
expansion, grep filtering and retries. The personas/ journey specs (5 files,
363 tests) are reported separately in the Persona suites section above.

Every module directory carries a README with the per-spec breakdown and the
as-built quirks the suite documents. New modules follow the checklist above.
