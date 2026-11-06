# AGENTS.md

Guidance for coding agents (and humans) working on this repository.

## Commands

`npm run dev | build | preview | lint | test` (Playwright e2e). Equivalent Task
tasks exist in `Taskfile.yml` (`task dev`, `task lint`, `task ci`, …).

## Environment

`.env` from `.env.example` with `VITE_OPENCHARGE_API_KEY`. The value is inlined
into the client bundle at build time: never commit a real key.

## Architecture

Vue 3 (Composition API) + Vite + Leaflet + PWA (Workbox). `App.vue` instantiates
the composables (`src/composables/`) and shares state through `provide()`.

When changing composables, components, the trip planner or API usage: read
[`docs/architecture.md`](./docs/architecture.md).

## Rules

- Never pre-download tiles from `tile.openstreetmap.org`: forbidden by the OSM tile usage policy. Only viewed tiles are cached.
- Do not reintroduce toll avoidance through `exclude=toll`: the public OSRM server rejects it.

## Conventions

- UI icons are inline SVG through `AppIcon`; emojis are not used as icons.
- User-facing text is French; code identifiers and commit messages follow the
  surrounding style (Conventional Commits).
- Keep the mobile-first layout: safe-area insets, `100dvh`, tap targets ≥ 44 px.

## Deployment

Static SPA (`dist/`); see `netlify.toml` and the README.
