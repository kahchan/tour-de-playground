# Tour de Playground

Wellington playground check-off map. Riders tap a marker to check off a playground; state is shared globally via a Cloudflare Worker.

## Status

UI rebuild in progress (Phases 1–6). Phases 1–5 complete.

- **Frontend:** https://kahchan.github.io/tour-de-playground
- **API Worker:** https://tour-de-playground-api.chan-kah.workers.dev

## Stack

- Vite + React + TypeScript (frontend, GitHub Pages)
- MapLibre GL + MapTiler vector tiles (`outdoor-v2` style)
- Cloudflare Worker + KV (backend, `*.workers.dev`)
- `playgrounds.json` committed to repo, generated from WCC ArcGIS feed

## Commands

| Command                            | Purpose                                     |
| ---------------------------------- | ------------------------------------------- |
| `npm run dev`                      | Local dev server                            |
| `npm run build`                    | Production build                            |
| `npm run preview`                  | Preview production build                    |
| `npm run lint`                     | ESLint + Prettier check                     |
| `npm run deploy`                   | Deploy frontend to GitHub Pages             |
| `npm run refresh-data`             | Regenerate `playgrounds.json` from WCC feed |
| `cd worker && npx wrangler deploy` | Deploy API Worker to Cloudflare             |

## Env vars

| Var                 | Purpose                                   |
| ------------------- | ----------------------------------------- |
| `VITE_MAPTILER_KEY` | MapTiler API key (required for map tiles) |
| `VITE_WORKER_URL`   | Cloudflare Worker base URL                |

Copy `.env.example` to `.env.local` and fill in values.

## Known issues / next tasks

- **Data curation:** 111 playgrounds — needs a hand-edit pass of `public/playgrounds.json` to hide unsuitable ones. Two flagged entries: `wcc-116` (Parliament Play Area, suburb null → hand-fix to "Thorndon") and `wcc-2920` (no name from WCC source). After editing, commit the file — no Worker redeploy needed.
- **Cloudflare stale branch:** `cloudflare/workers-autoconfig` branch on GitHub is safe to delete.
- **Do not deploy frontend** (`npm run deploy`) until the UI rebuild phases are complete and signed off.

## Architecture

### Frontend

- `src/hooks/useCheckIns.ts` — polls Worker every 7s when `VITE_WORKER_URL` is set; falls back to localStorage if not. Caches Worker state in localStorage for instant render on refresh. Also manages `disabledIds` and exposes `toggleDisabled`, `resetAll`.
- `src/hooks/useName.ts` — name always in localStorage, never sent to Worker.
- `src/components/MapView.tsx` — MapLibre map. Blue circles = unchecked, green = checked, indigo clusters. Accepts `flyToTarget` prop to animate to a playground.
- `src/components/Sidebar.tsx` — suburb-grouped collapsible list; bottom sheet on mobile, floating right card on desktop (360px, 16px margins, overlays map). Accepts `highlight` prop (`{ id, seq }`) to expand + scroll + flash a specific item. Full-row tap toggles check (calls `onToggleCheck`). In admin mode shows disable/enable toggles and a reset button.
- Reset UI at `/?reset=1` — passphrase POSTs to `/reset` on the Worker.
- Admin mode at `/?admin=1` — no auth beyond the URL param. Shows disabled playgrounds with dashed border + toggle; shows "Reset everything" button (requires passphrase to confirm).

### Worker (`worker/`)

- Single KV key `state:current` holds `{ checks: [...], disabled: [...], lastModified: "..." }`.
- `POST /check` — idempotent on `id`, safe to retry.
- `POST /disable` — `{ id, on: boolean }`, adds/removes from `disabled[]`, idempotent.
- `POST /reset` — passphrase-protected; clears both `checks` and `disabled`.
- CORS restricted to `https://kahchan.github.io` and localhost.
- Reset passphrase stored as Worker secret `RESET_PASSPHRASE`.
- KV namespace binding: `STATE` (id: `ff17165d94bd40e28455c9f52aa5e399`).

### Data pipeline

- `scripts/refresh-playgrounds.mjs` fetches WCC ArcGIS `Parks/Parks` MapServer layer 49.
- Extracts `suburb` from `Within_Location` field (format: `"Wellington\\[Suburb]\\..."`).
- Merges with existing `playgrounds.json` — preserves `included` flags, hand-edited `suburb`, and other hand-edits.
- Run `npm run refresh-data`, review diff, then commit.

### Playground data shape

```ts
{
  id: string        // "wcc-{OBJECTID}"
  name: string
  lat: number
  lng: number
  suburb: string | null   // from WCC Within_Location; null for 2 entries
  source: string    // "wcc"
  included: boolean // false = hidden from app entirely
}
```

## Conventions

- TypeScript strict mode on
- ESLint + Prettier configured; run manually via `npm run lint` — no pre-commit hooks
- Conventional Commits (`feat:`, `fix:`, `chore:`, etc.)
- Functional React components only; `useState` / `useEffect` for state — no external state library
- Plain CSS modules — no CSS framework unless agreed
- Ask before installing any library beyond React, MapLibre, and build tooling

## UI rebuild plan (Phases 5–6 remaining)

Style reference: mire·studio — dark canvas, vibrant color blocks, 25px radius, compact density.
See memory file `style_mirestudio.md` for full token reference.

### ~~Phase 3 — Floating right sidebar with suburb groups~~ ✓
### ~~Phase 4 — Bidirectional sidebar ↔ map sync~~ ✓
### ~~Phase 5 — Check-off interaction + done visual treatment~~ ✓

### Phase 6 — "Show undone only" toggle *(next)*
- Local toggle in sidebar header; hides checked rows; suburb sections with 0 left collapse or disappear

## Extension points

| Version | Feature                                                                                                       |
| ------- | ------------------------------------------------------------------------------------------------------------- |
| v2      | Geofence: only allow check-off within 50m via browser geolocation                                             |
| v2      | Per-rider stats (your count, your last check-off)                                                             |
| Later   | Offline tile caching via Service Worker (Cache API) — useful for on-ride use where connectivity is unreliable |
| Later   | `?room=xyz` for per-group sessions                                                                            |
| Later   | Photo upload on check-off                                                                                     |
| Later   | Swap MapTiler for self-hosted Protomaps tiles                                                                 |
| Later   | Routing suggestions                                                                                           |
