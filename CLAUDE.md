# Tour de Playground

Wellington playground check-off map. Riders tap a marker to check off a playground; state is shared globally via a Cloudflare Worker.

## Stack

- Vite + React + TypeScript (frontend, GitHub Pages)
- MapLibre GL + MapTiler vector tiles
- Cloudflare Worker + KV (backend, `*.workers.dev`)
- `playgrounds.json` committed to repo, generated from WCC ArcGIS feed

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint + Prettier check |
| `npm run deploy` | Deploy to GitHub Pages |
| `npm run refresh-data` | Regenerate `playgrounds.json` from WCC feed |

## Env vars

| Var | Purpose |
|---|---|
| `VITE_MAPTILER_KEY` | MapTiler API key (required for map tiles) |
| `VITE_WORKER_URL` | Cloudflare Worker base URL (Phase 2) |

Copy `.env.example` to `.env.local` and fill in values.

## Conventions

- TypeScript strict mode on
- ESLint + Prettier configured; run manually via `npm run lint` — no pre-commit hooks
- Conventional Commits (`feat:`, `fix:`, `chore:`, etc.)
- Functional React components only; `useState` / `useEffect` for state — no external state library
- Plain CSS modules — no CSS framework unless agreed
- Ask before installing any library beyond React, MapLibre, and build tooling

## Architecture notes

- Phase 1: local-only, `localStorage` for check-offs
- Phase 2: Worker + KV for shared state; frontend polls `/state` every 7s
- `included: false` hides a playground without removing its record
- Reset is hidden behind `/?reset=1` + passphrase — not surfaced in main UI
