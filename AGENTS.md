# AGENTS.md

This file provides guidance to Coding Agents when working with code in this repository.

## Project Overview

NestJS + MikroORM RealWorld example app implementing the [RealWorld API spec](https://github.com/gothinkster/realworld/tree/master/api). Uses MySQL database with JWT authentication.

## Common Commands

```bash
yarn start           # Start application (port 3000)
yarn start:dev       # Start in watch mode
yarn start:prod      # Build and run production
yarn test            # Run vitest unit tests
yarn test:watch      # Run tests in watch mode
yarn test:coverage   # Run tests with coverage
yarn test:e2e        # Run RealWorld API E2E tests (requires running server + MySQL)
yarn lint            # Lint with oxlint (type-aware)
yarn format          # Format with oxfmt
```

Run a single test file: `yarn vitest run src/user/test/user.service.spec.ts`

## Setup

```bash
yarn install
cp src/config.ts.example src/config.ts           # JWT secret
cp src/mikro-orm.config.ts.example src/mikro-orm.config.ts  # DB connection
docker compose up -d                              # MySQL on port 3307
yarn start                                        # Auto-runs migrations on startup
```

## Architecture

**Domain modules** in `src/`: `user/`, `article/`, `profile/`, `tag/` — each follows the pattern:

- `*.module.ts` — NestJS module registering controllers, services, and MikroORM entities
- `*.controller.ts` — REST route handlers
- `*.service.ts` — Business logic, injected repositories
- `*.entity.ts` — MikroORM entity definitions (uses decorator-based metadata)
- `dto/` — Request validation classes using class-validator decorators
- `*.interface.ts` — Response shape interfaces (e.g., `IUserRO`, `IArticleRO`)

**Authentication flow**: `AuthMiddleware` (`src/user/auth.middleware.ts`) validates JWT from `Authorization` header and attaches user to request. Applied selectively to routes in each module's `configure()` method. The `@User()` decorator (`src/user/user.decorator.ts`) extracts user data from the request.

**Database**: MikroORM with MySQL. Config in `src/mikro-orm.config.ts`. Migrations in `src/migrations/` run automatically on app startup via `onModuleInit` in `AppModule`.

**Shared**: `src/shared/pipes/validation.pipe.ts` — custom ValidationPipe for DTO validation.

**API docs**: Swagger UI at `http://localhost:3000/docs`, global prefix `/api`.

## Tech Stack

- **Runtime**: NestJS 11, MikroORM 7, TypeScript (strict mode, ESNext target)
- **Linting/Formatting**: oxlint + oxfmt (no ESLint/Prettier)
- **Testing**: Vitest with SWC transpiler, supertest for HTTP tests
- **Package manager**: Yarn 4 (corepack)

---

# Behavioral Rules

This section constrains agent behavior. Sensors in this repository enforce
additional rules at commit-time and at runtime; this file is the team's
codified policy that agents should respect proactively.

## Rule — No PII in aggregate or listing endpoints

**Rule**: Endpoints that return *multiple* records or aggregated views
(`/profiles/top`, `/users/list`, `/articles/feed`, etc.) MUST NOT expose
PII fields (e.g. email, real name, phone number, address) unless the requester
is the owner of the data or has elevated permissions.

**Why**: Listing endpoints multiply exposure. A single careless addition
can leak thousands of records of PII via a single request. Single-resource
endpoints (`/users/me`) have a different threat model and may expose more.

**How to handle prompts that ask for PII in listings**: Do not silently
comply. Push back: explain the rule and offer alternatives —
(a) scope the endpoint to authenticated/elevated users only, or
(b) omit the sensitive field, or
(c) recommend revisiting the team policy via a separate ADR.

**Backstop sensor**: An inferential code reviewer (LLM-as-judge) audits
diffs for violations of this rule.

---

# How to handle sensor feedback

When a sensor reports a violation:

1. Read the message in full. Sensors include the rule name and the reason.
2. Fix the root cause, not the symptom. Refactor; do not add
   `eslint-disable`, `// nosemgrep`, or threshold-loosening overrides.
3. If a rule genuinely seems wrong for a specific case, surface this in
   the PR description. Rules evolve through discussion, not silent
   exceptions.

---

# When to run sensors

Run sensors as part of your normal task loop:

1. **Before declaring a task complete**, run `yarn check:all`. Address every
   finding before you finish. Do not mark a task done while any sensor reports
   a violation.
2. After non-trivial changes (new endpoints, controller/service/entity edits),
   run `yarn check:all` early to catch regressions before they pile up.
3. `yarn check:structure` and `yarn check:bounds` are fast (~1s each) — run
   them freely.
4. `yarn check:policy` is slower (~5–15s) and costs API tokens — run it once
   per logical change, not on every save.
5. The pre-commit hook enforces `check:structure` and `check:bounds` on every
   commit. Do not bypass it with `--no-verify`.
