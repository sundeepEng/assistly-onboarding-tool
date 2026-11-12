# assistly-be

Assistly Backend Repository

## Development tooling

### Formatting

We use [Prettier](https://prettier.io/) for automated formatting. Two npm scripts are available:

```bash
npm run format       # writes fixes
npm run format:check # verifies formatting
```

Prettier runs automatically on staged files through a Husky pre-commit hook via `lint-staged`. After cloning the repo and running `npm install`, Husky installs itself (through the `prepare` script) so hooks fire automatically. If you ever need to reinstall hooks, run:

```bash
npm run prepare
```

Remember to register your editor to respect the `.prettierrc` settings for the best experience.

## Project structure

```
assistly-be-old/
├─ bin/                     # CDK bootstrap/CLI shim
├─ dal/                     # Data-access layer helpers (DynamoDB, etc.)
├─ functions/               # Lambda entrypoints (cron jobs, API handlers)
├─ lib/                     # CDK infrastructure (Assistly stack definition)
├─ models/                  # Shared zod schemas & domain models
├─ services/                # Business logic + HTTP handlers grouped by domain
├─ layers/                  # Lambda layer sources
├─ migrations/              # Knex migration files
├─ utils/                   # Cross-cutting helpers (crypto, secrets, etc.)
├─ cdk.json / tsconfig.json # Build + CDK config
└─ package.json             # Dependencies, scripts, tooling
```

## Creating a new service/endpoint

1. **Model/schema** – Define or extend the relevant zod schema inside `models/` so inputs/outputs are validated consistently.
2. **Business logic** – Implement the handler in an appropriate module under `services/` (for example `services/notifications/...`). Reuse DAL helpers from `dal/` whenever the handler needs DynamoDB access.
3. **Route wiring** – Export the handler in `services/route-handlers.ts`, then map the HTTP route in `functions/thirdPartyIntegrations.ts` (or the respective Lambda entry) so API Gateway can invoke it. If the route is new, update `lib/assistly-be-stack.ts` to add the resource/method in the CDK stack.
4. **Infrastructure/env** – When the handler needs new AWS resources or environment variables, declare them in the CDK stack and pass the env vars to the consuming Lambda in `lib/assistly-be-stack.ts`.
5. **Formatting & hooks** – Stage your changes and rely on the Prettier Husky hook to keep style consistent before committing.

## Database migrations (PostgreSQL)

We manage schema changes with [Knex](https://knexjs.org/) migrations (see `knexfile.ts`). The config reads Postgres credentials from `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`, and `DB_PORT`. Typical workflow:

1. Generate a migration scaffold with `npx knex migrate:make <file_name>`.
2. Implement the `up`/`down` logic inside the generated TypeScript file under `migrations/`.
3. Roll back using the same CLI when necessary.

Keep migrations deterministic, reversible, and scoped to the change being deployed so that CI/CD and manual runs behave predictably.

## CI/CD workflows

GitHub Actions automates deployments and database migrations through two workflow files in `.github/workflows/`:

1. **`deployment.yml` – Assistly CI/CD Pipeline**
   - Triggers on pushes to `main`, `stg`, `dev`, or `bedev`, and can be run manually via `workflow_dispatch`.
   - Performs checkout, installs dependencies (root + Lambda layer), zips the shared layer, installs AWS CDK, compiles TypeScript, configures AWS credentials, then bootstraps & deploys the CDK stack with `cdk deploy --context stackName="luma-${{github.ref_name}}"`.
   - Uses repo secrets (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ACCOUNT_ID`, `AWS_REGION`, `CRYPTO_ENCRYPTION_KEY`) and sets `STAGE` from the branch name so each environment gets its own stack.

2. **`postgres.yml` – Postgres Schema Migrations Pipeline**
   - Also listens to pushes on `bedev`, `dev`, `stg`, and `main`, with a job per branch. Each job runs on a self-hosted runner matching the environment.
   - Steps: checkout, set up Node 20, run `npm ci`, install `ts-node`/TypeScript, install AWS CLI + `jq`, configure AWS credentials, pull RDS credentials from Secrets Manager (e.g., `PostgresCredentials-dev`), export them as `DB_*` env vars, then execute `ts-node utils/postgres-schema-migrations.ts` to run Knex migrations.
   - Ensures schema migrations land alongside code deploys so Lambda and database stay in sync.

Together, these workflows cover both infrastructure/application rollout (CDK deployment) and data-layer evolution (Postgres migrations). When contributing, ensure your PRs keep both workflows green to avoid breaking auto-deploys.

### Required GitHub secrets

Both workflows rely on repository secrets. Configure these under _Settings → Secrets and variables → Actions_ before enabling the pipelines:

| Secret                                        | Purpose                                                                                                         |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | IAM user/role credentials with permissions for CDK deploys, Lambda, CloudFormation, and Secrets Manager access. |
| `AWS_ACCOUNT_ID`                              | Target AWS account used by CDK.                                                                                 |
| `AWS_REGION`                                  | Default region for deployments (used by CDK and migration jobs).                                                |
| `CRYPTO_ENCRYPTION_KEY`                       | Symmetric key injected into Lambdas for encryption/decryption (referenced during `cdk deploy`).                 |

The Postgres workflow also expects Secrets Manager entries per environment (`PostgresCredentials-dev`, `-stg`, etc.) containing `host`, `username`, `password`, `dbname`, and `port`. Ensure those AWS-side secrets exist so the workflow can hydrate DB environment variables.

## How to Deploy your features.

- pull the dev branch code locally.
- create a new feature branch.
- add your logic - the actual fun part.
- merge to dev using PRs.
- sit back and relax until pipeline runs through and deploy the code for you in the **dev** environment.
- test the feature.
- if anything fails in dev, read the fun note, laugh and then revert back your changes.
- if everything works in dev, its time to merge code to stg using PRs.
- again sit back and relax until pipeline deploys your code to **stg** environment.
- test in stg environment.

### Fun note:

**"Alright, dev environment, it's your time to shine! Or… you know, crash and burn gloriously. Either way, we’ve got your back."**

Deploying new features into dev is like throwing spaghetti at the wall to see what sticks, except the spaghetti is code, and the wall might collapse under the pressure.

**Mission Plan:**

- Deploy the shiny, new feature that definitely worked on your machine.
- Watch as dev starts throwing errors like a toddler throws tantrums.
- Fix bugs, one line at a time, with the intensity of a surgeon saving a life.
- When all else fails, hit “revert” and pretend nothing happened - Masth shades unnayi ra neelo.

**Pro tip:** Always maintain a close relationship with your “undo”(revert changes from PR) button—it’s your best friend in this chaotic love affair with the dev environment.

**Because let's face it, “If it doesn’t break in dev, can you really call it a feature?”**

**Remember:** Dev environments aren’t just for testing code—they’re here to remind us that the universe thrives on chaos, and we’re simply trying to write clean code in it.

## Happy coding!!!!!
