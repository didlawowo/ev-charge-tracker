# Contributing to EV Finder

Thanks for your interest in improving EV Finder. This document describes how to
set up the project, what is expected from a change, and how CI works.

## Prerequisites

- Node.js ≥ 20 (Node 22 is what CI uses)
- npm (`package-lock.json` is the single committed lockfile)

## Setup

```bash
npm install
cp .env.example .env   # then set VITE_OPENCHARGE_API_KEY
npm run dev
```

A free OpenChargeMap API key is required to fetch charging stations:
<https://openchargemap.org/site/develop/api>. Note that `VITE_*` variables are
embedded in the bundle at build time — use a dedicated key for your own
deployments.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server with HMR |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally (port 4173) |
| `npm run lint` | ESLint over `src/` |
| `npm run test` | Playwright end-to-end tests (builds and serves automatically) |

There is also a `Taskfile.yml` exposing the same commands through
[Task](https://taskfile.dev) (`task lint`, `task test`, `task ci`, …).

First time running Playwright:

```bash
npx playwright install --with-deps chromium
```

## Before opening a pull request

1. `npm run lint`
2. `npm run build`
3. `npm run test`

CI runs the same three steps. Please keep formatting and conventions consistent
with the surrounding code: Vue 3 Composition API, one composable per domain in
`src/composables/`, presentational components in `src/components/`, and no new
runtime dependency unless it replaces existing code.

## Commit and branch conventions

- Branch from `main`, use a descriptive branch name (`feat/…`, `fix/…`, `chore/…`).
- Prefer [Conventional Commits](https://www.conventionalcommits.org/) prefixes
  (`feat:`, `fix:`, `docs:`, `chore:`), matching the existing history.
- Keep a pull request focused on a single concern; describe the user-visible
  effect and how you tested it.
- Never commit secrets, `.env` files or build output.

## CI

The workflows in `.github/workflows/` run on self-hosted runners operated by the
project maintainers. Because of that:

- Pull requests opened from a **fork** do not run CI automatically. A maintainer
  reviews the change and runs the checks on a branch inside the repository
  before merging.
- Pull requests from branches of this repository run CI normally.
- `main` is protected: the version bump and the GitHub Release are produced by
  CI after merge.

## Security

Please do not report security issues in public discussions or pull requests —
see [SECURITY.md](./SECURITY.md).

By contributing, you agree that your contributions are licensed under the MIT
License (see [LICENSE](./LICENSE)).
