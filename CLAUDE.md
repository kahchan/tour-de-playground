# Tour de Playground

Wellington playground check-off map. Riders tap a marker to check off a playground; state is shared globally via a Cloudflare Worker.

## Status

Both phases are complete and deployed.

- **Frontend:** https://kahchan.github.io/tour-de-playground
- **API Worker:** https://tour-de-playground-api.chan-kah.workers.dev

## Stack

- Vite + React + TypeScript (frontend, GitHub Pages)
- MapLibre GL + MapTiler vector tiles (`outdoor-v2` style)
- Cloudflare Worker + KV (backend, `*.workers.dev`)
- `playgrounds.json` committed to repo, generated from WCC ArcGIS feed

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint + Prettier check |
| `npm run deploy` | Deploy frontend to GitHub Pages |
| `npm run refresh-data` | Regenerate `playgrounds.json` from WCC feed |
| `cd worker && npx wrangler deploy` | Deploy API Worker to Cloudflare |

## Env vars

| Var | Purpose |
|---|---|
| `VITE_MAPTILER_KEY` | MapTiler API key (required for map tiles) |
| `VITE_WORKER_URL` | Cloudflare Worker base URL |

Copy `.env.example` to `.env.local` and fill in values.

## Known issues / next tasks

- **Data curation:** 111 playgrounds are all `included: true`. Needs a hand-edit pass of `public/playgrounds.json` to hide unsuitable ones and fix `Playground 2920` (no name from WCC source). After editing, commit the file — no redeploy needed for the Worker, frontend picks it up via GitHub Pages.
- **Cloudflare stale branch:** `cloudflare/workers-autoconfig` branch on GitHub is safe to delete — it's the auto-generated frontend-as-Worker config which we don't use.

## Architecture

### Frontend

- `src/hooks/useCheckIns.ts` — polls Worker every 7s when `VITE_WORKER_URL` is set; falls back to localStorage if not. Caches Worker state in localStorage for instant render on refresh.
- `src/hooks/useName.ts` — name always in localStorage, never sent to Worker.
- `src/components/MapView.tsx` — MapLibre map. Blue circles = unchecked, green = checked, indigo clusters. Accepts `flyToTarget` prop to animate to a playground.
- `src/components/Sidebar.tsx` — collapsible list; bottom sheet on mobile, left panel on desktop.
- Reset UI at `/?reset=1` — passphrase POSTs to `/reset` on the Worker.

### Worker (`worker/`)

- Single KV key `state:current` holds `{ checks: [...], lastModified: "..." }`.
- `POST /check` is idempotent on `id` — safe to retry.
- CORS restricted to `https://kahchan.github.io` and localhost.
- Reset passphrase stored as Worker secret `RESET_PASSPHRASE`.
- KV namespace binding: `STATE` (id: `ff17165d94bd40e28455c9f52aa5e399`).

### Data pipeline

- `scripts/refresh-playgrounds.mjs` fetches WCC ArcGIS `Parks/Parks` MapServer layer 49.
- Merges with existing `playgrounds.json` — preserves `included` flags and hand-edits.
- Run `npm run refresh-data`, review diff, then commit.

## Conventions

- TypeScript strict mode on
- ESLint + Prettier configured; run manually via `npm run lint` — no pre-commit hooks
- Conventional Commits (`feat:`, `fix:`, `chore:`, etc.)
- Functional React components only; `useState` / `useEffect` for state — no external state library
- Plain CSS modules — no CSS framework unless agreed
- Ask before installing any library beyond React, MapLibre, and build tooling

## Extension points

| Version | Feature |
|---|---|
| v2 | Geofence: only allow check-off within 50m via browser geolocation |
| v2 | Per-rider stats (your count, your last check-off) |
| Later | Offline tile caching via Service Worker (Cache API) — useful for on-ride use where connectivity is unreliable |
| Later | `?room=xyz` for per-group sessions |
| Later | Photo upload on check-off |
| Later | Swap MapTiler for self-hosted Protomaps tiles |
| Later | Suburbs / area filters |
| Later | Routing suggestions |
