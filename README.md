# ![NestJS](project-logo.png)

This repo is a companion for the talk ["Architekturziele für Coding Agents mit Harness Engineering"](https://speakerdeck.com/alexksbr/architekturziele-fur-coding-agents-mit-harness-engineering).

The branch [experiment/preflight-no-harness](https://github.com/alexksbr/harness-engineering-demo/tree/experiment/preflight-no-harness) shows the results the coding agent produced without an outer harness. [experiment/with-harness](https://github.com/alexksbr/harness-engineering-demo/tree/experiment/with-harness) shows the guides and sensors, while [experiment/with-harness-run](https://github.com/alexksbr/harness-engineering-demo/tree/experiment/with-harness-run) shows the result the coding agent produces with this outer harness.

> ### NestJS + MikroORM codebase containing real world examples (CRUD, auth, advanced patterns, etc) that adheres to the [RealWorld](https://github.com/gothinkster/realworld-example-apps) API spec.

> Extended with Harness Engineering components. Based on https://github.com/mikro-orm/nestjs-realworld-example-app (MIT).

> Rewrite of https://github.com/lujakob/nestjs-realworld-example-app to MikroORM.

---

# Getting started

## Installation

Install dependencies

    yarn

Copy config file and set JsonWebToken secret key

    cp src/config.ts.example src/config.ts

---

## Database

The example codebase uses [MikroORM](https://mikro-orm.io/) with a MySQL database.

Copy MikroORM config example file for database settings and adjust the connection settings.

    cp src/mikro-orm.config.ts.example src/mikro-orm.config.ts

Now you can start the application with `yarn start`. It will automatically
create the database and run initial migration that sets up the database
schema.

---

## NPM scripts

- `yarn start` - Start application
- `yarn start:dev` - Start application in watch mode
- `yarn check:structure` - run the Semgrep structural sensor
- `yarn check:bounds` - run the Semgrep pagination-bound sensor
- `yarn perf:profiles` - run the K6 `/api/profiles/top` performance sensor
- `yarn test` - run Vitest test runner
- `yarn start:prod` - Build application

---

### Sensors

`yarn check:structure` runs the Semgrep structural sensor against `src/`. It
enforces the layered architecture policy from `AGENTS.md`, including the ban on
raw database access from service-layer code.

`yarn check:bounds` runs the Semgrep pagination-bound sensor against
controllers in `src/`. If `semgrep` is not installed, run
`scripts/setup-semgrep.sh`.

`yarn check:policy` runs an Anthropic-backed inferential review of the git diff
against the behavioral rules in `AGENTS.md`. It requires `ANTHROPIC_API_KEY`
and costs API tokens on each run, typically a few cents. The judge uses prompt
caching so repeated reviews of similar diffs are faster and cheaper. By
default it reviews `git diff main...HEAD`; use
`yarn check:policy --base main --worktree` to include staged, unstaged, and
untracked local edits before committing.

`yarn perf:profiles` runs the K6 performance sensor for
`/api/profiles/top?limit=N`. It targets `K6_BASE_URL` when set, otherwise
`http://localhost:3000`. The runner uses Docker with the `grafana/k6` image
when Docker is available, and falls back to a local `k6` binary. When Docker is
used and `K6_BASE_URL` is unset, the runner targets
`http://host.docker.internal:3000` so the container can reach the host app. Set
`PERF_USER` and `PERF_PASS` if the default credentials `test@test.com` /
`test1234` do not exist in your database.

### Lifecycle integration

- Pre-commit: `check:structure` and `check:bounds` run automatically on every
  commit (via Husky). Bypass with `--no-verify` only in genuine emergencies -
  see `AGENTS.md` "How to handle sensor feedback".
- On-demand: run the full suite with `yarn check:all`.
- Inferential and runtime sensors (`check:policy`, `perf:profiles`) are NOT in
  pre-commit - they're slower and intended for CI or manual invocation.

---

## API Specification

This application adheres to the api specifications set by the [Thinkster](https://github.com/gothinkster) team. This helps mix and match any backend with any other frontend without conflicts.

> [Full API Spec](https://github.com/gothinkster/realworld/tree/master/api)

More information regarding the project can be found here https://github.com/gothinkster/realworld

---

## Start application

- `yarn start`
- Test api by browsing to `http://localhost:3000/api/articles`
- View automatically generated swagger api docs by browsing to `http://localhost:3000/docs`
- Run e2e tests from the `gothinkster/realworld` repository with `yarn test:e2e`

---

# Authentication

This applications uses JSON Web Token (JWT) to handle authentication. The token is passed with each request using the `Authorization` header with `Token` scheme. The JWT authentication middleware handles the validation and authentication of the token.
