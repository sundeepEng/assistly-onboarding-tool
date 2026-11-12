# Gia product walkthrough release

Ownership verified from code: `fe-onboarding/pages/onboarding.tsx` is the parent portal (port 3000); `fe/pages/crm/index.tsx` is the dashboard entry (port 3001). The request's port/route labels are reversed relative to this checkout. All seven requested dashboard routes exist. `be-onboarding` owns the Node API on 3100. No AGENTS.md existed initially; Next dev subsequently generated framework instruction files.

## Start locally

```sh
docker run -d --name gia-postgres -p 5432:5432 -e POSTGRES_DB=assistly_onboarding -e POSTGRES_PASSWORD=local-only postgres:17
cd be-onboarding
cp .env.example .env
npm ci
npm run migrate:latest
npm start
# Another terminal
cd fe-onboarding
cp .env.example .env.local
npm ci --legacy-peer-deps
PORT=3000 npm run dev
# Another terminal
cd fe
npm ci --legacy-peer-deps
NEXT_PUBLIC_ONBOARDING_ORIGIN=http://localhost:3000 PORT=3001 npm run dev
```

Keep existing app Cognito/main API settings. Set `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `ASSISTLY_API_URL` (origin without /v1) and optionally `LYZR_API_KEY` on the backend. Lyzr is mocked deterministically when its key is absent. Signed claims must contain a user identity, home ID, and role; missing home scope now fails closed instead of sharing `unknown-home`. Production home type comes from the main API's authenticated home read. Existing sessions that only keep homeId in a browser cookie need an authorized server-side membership resolver before use; do not trust the cookie as authorization.

For synthetic testing only, `AUTH_DEV_BYPASS=1` accepts fixture JWT payloads including `custom:homeType`; production mode disables this option. Never expose this dev server publicly. Production subdomains must set exact portal/dashboard origins and preserve the existing Cognito/cookie setup.

## Changes

The existing Markdown JSON catalog retains stable IDs and adds home and permission applicability and a seven-screen `walkthrough`. The generator validates applicability and creates identical registries plus a server snapshot of the dashboard's EDIT grants. Run it after role/catalog edits:

```sh
node fe/scripts/generate-onboarding-registry.mjs --out be-onboarding/generated/onboarding-registry.json
node fe/scripts/generate-onboarding-registry.mjs --out fe-onboarding/utils/generated/onboarding-registry.json
node fe/scripts/generate-onboarding-registry.mjs --out fe/utils/generated/onboarding-registry.json
```

`be-onboarding/src/registry.ts`, `product-walkthrough.ts`, `auth.ts`, `server.ts` filter on the server, resolve approved destinations and provide the `/walkthrough`, `/walkthrough/select`, `/walkthrough/chat` endpoints. Migration `20261113000000_product_walkthrough.js` adds a user/home/version primary key with selected screen/task and independent viewed/acknowledged screen arrays. No sensitive form data or record verification is stored here.

The portal provider, steps panel and chat panel use this saved selection. The existing dashboard iframe bridge supplies page navigation and unsaved-change handling; origin, source window and message payload are checked. Chat offers an Open button using the same handler as checklist clicks. An acknowledgement confirms navigation before selection is saved; timeouts and persistence errors are shown. Chat answers cannot verify an action. Legacy record-flow endpoints are not exposed by this release API, preventing placeholder synthetic DB verifiers from being mistaken for real verification.

## Scope gaps

Personal Care Home and In Home Care are explicitly covered by supplied house documents. Adult Day Center, Assisted Living, Memory Care and the fixture-only `Residential` value remain excluded pending reviewed guidance. The shared frontend fallback is not used as evidence of applicability. Current dashboard permissions, including their existing EDIT-based route gates, are preserved; task help applies additional action grants. Campaigns and medication management appear as reference help, not required actions.

Nurse creation has no reliable end-to-end authorized verification contract established here. The existing GET /v1/user/{id} handler returns a record but does not itself enforce home membership or bind a create action; synthetic database tables are not production evidence. Nurse-lead actions therefore remain unverified. No save interception or generic event pipeline was added. This does not block the tour.

## Verification

Backend and portal TypeScript checks passed. All existing DB migrations plus the new migration ran against local PostgreSQL 17. `src/product-walkthrough.test.ts` tests applicability, roles, nurse guidance, next-screen offers, reference questions and invalid model destinations. `acceptance.cjs` exercises the running API with synthetic claims: saved selection, acknowledgements, refresh/read resume, user/home isolation and rejection of invalid destinations. Run with:

```sh
cd be-onboarding
npm run typecheck
node_modules/.bin/tsx --test src/product-walkthrough.test.ts
# Against a local AUTH_DEV_BYPASS=1 API with a migrated synthetic DB:
node acceptance.cjs
cd ../fe-onboarding
npx tsc --noEmit
```

Live Cognito, Lyzr and real nurse creation were not exercised; credentials are absent. Browser verification details are recorded separately after testing.

Browser: Chromium/Playwright loaded the real portal. With a synthetic iframe bridge, manual Nurse Leads selection, current-task explanation, next/Open to Clinical Seniors, refresh resume and Referral Agents help without selection changes passed. The real dashboard first failed during SSR due to missing S3 bucket/region settings; after supplying synthetic settings its compilation process exited before bridge readiness. Standalone dashboard behavior and full real-iframe navigation remain unverified; no unrelated dashboard implementation was changed.

The optional `browser-acceptance.cjs` needs Playwright and system Chromium (`npm install --no-save playwright`); it mocks only the iframe bridge and uses the running portal/API/PostgreSQL. The legacy schema remains available for a future authorized record-workflow release; the product tour does not invoke it.
