# assistly-onboarding-api

Node.js backend for Gia-guided onboarding. Owns PostgreSQL persistence
(sessions, step progress, navigation requests) and the server-side Gia/Lyzr
integration. Uses the same authentication as the main Assistly API: Cognito
user-pool id tokens sent as `Authorization: Bearer <idToken>`.

## Local setup

```bash
# PostgreSQL (Homebrew install — adjust for your setup)
brew services start postgresql@18
createdb assistly_onboarding

# or: docker run -d -p 5432:5432 -e POSTGRES_DB=assistly_onboarding postgres

cp .env.example .env   # fill COGNITO_USER_POOL_ID, LYZR_API_KEY
npm install
npm run migrate:latest
```

## Run all three apps

```bash
cd be-onboarding && npm run dev          # API on :3100
cd fe-onboarding && PORT=3000 npm run dev # portal on :3000
cd fe && PORT=3001 npm run dev            # dashboard on :3001
```

## Auth

- `COGNITO_USER_POOL_ID` — same pool the apps use (`us-east-1_wDU1EftmU`).
- `COGNITO_CLIENT_ID` — optional; unset skips the `aud` check (dev).
- `AUTH_DEV_BYPASS=1` — local only: decodes JWT claims without JWKS
  verification so the API can be exercised without Cognito access. Never
  enable outside local development.

## Endpoints

- `GET  /onboarding/session?flow_id=<id>&subject_record_id=<id?>` — load or
  create the session scoped to the authenticated user, home, flow and record.
- `POST /onboarding/nav-request` `{session_id, step_id}` — issue a navigation
  request; returns `{request_id, step_id, path}` resolved from the shared
  registry.
- `POST /onboarding/nav-ack` `{request_id, status}` — applies the iframe's
  acknowledgement in one transaction (screen/task commit, visit, revision++).
  `409` for stale/duplicate acknowledgements.
- `POST /gia/chat` `{message, view:{flow_id, screen_id, tab}}` — Gia reply;
  navigation responses carry a server-issued `request_id`.

The shared step registry is generated from
`fe/docs/gia-onboarding/GIA_CRM_CLINICAL_ONBOARDING.md.md` by
`fe/scripts/generate-onboarding-registry.mjs` into `generated/` for each app.
