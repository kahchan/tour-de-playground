# Tour de Playground

Wellington playground check-off map. Riders tap a marker to check off a playground via the popup; state is shared globally via a Cloudflare Worker.

## Status

UI rebuild complete (Phases 1–8 done).

- **Frontend:** https://kahchan.github.io/tour-de-playground
- **API Worker:** https://tour-de-playground-api.chan-kah.workers.dev

## Stack

- Vite + React + TypeScript (frontend, GitHub Pages)
- MapLibre GL + MapTiler vector tiles (`outdoor-v2` light / `streets-v2-dark` dark)
- OpenRouteService `cycling-mountain` profile (optional, needs `VITE_ORS_KEY`)
- Cloudflare Worker + KV (backend, `*.workers.dev`)
- `playgrounds.json` committed to repo, generated from WCC ArcGIS feed
- Red Hat Display variable font (Google Fonts, weight 300–900)

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

| Var                 | Purpose                                                        |
| ------------------- | -------------------------------------------------------------- |
| `VITE_MAPTILER_KEY` | MapTiler API key (required for map tiles)                      |
| `VITE_WORKER_URL`   | Cloudflare Worker base URL                                     |
| `VITE_ORS_KEY`      | OpenRouteService API key (optional; hides route button if unset) |

Copy `.env.example` to `.env.local` and fill in values.

## Known issues / next tasks

- **Data curation:** 111 playgrounds — needs a hand-edit pass of `public/playgrounds.json` to hide unsuitable ones. Two flagged entries: `wcc-116` (Parliament Play Area, suburb null → hand-fix to "Thorndon") and `wcc-2920` (no name from WCC source). After editing, commit and push — no Worker redeploy needed.
- **Cloudflare stale branch:** `cloudflare/workers-autoconfig` branch on GitHub is safe to delete.

## Architecture

### Theme

- Dark mode is the `:root` default; `[data-theme='light']` overrides tokens.
- An inline script in `index.html` sets `document.documentElement.dataset.theme` before React hydrates (eliminates flash).
- `src/hooks/useDarkMode.ts` reads/writes `localStorage` key `tdp:theme` (`'dark'`/`'light'`), falls back to `prefers-color-scheme`.
- Palette: teal (`#00c8d7` dark / `#00818c` light) = complete/checked; purple (`#9b20d0` dark / `#6510a0` light) = undone/unchecked. Charlotte Hornets 80s jacket vibe.

### Frontend

- `src/hooks/useCheckIns.ts` — polls Worker every 7s when `VITE_WORKER_URL` is set; falls back to localStorage if not. Caches Worker state in localStorage for instant render on refresh. Also manages `disabledIds` and exposes `toggleDisabled`, `resetAll`.
- `src/hooks/useName.ts` — name always in localStorage, never sent to Worker.
- `src/hooks/useRoute.ts` — 4-state cycle: `off → north → south → location → off`. Fetches ORS `cycling-mountain/geojson` in overlapping chunks of 50 (step 49) so chunk boundaries share endpoints. Uses ORS `way_points` indices to build per-leg `FeatureCollection` (one Feature per leg with `legIndex` property). Exposes `mode`, `cycle()`, `fetchState`, `geoJSON`, `orderedIds`. Location mode calls `navigator.geolocation`, falls back to `off` on denial.
- `src/lib/tsp.ts` — `nearestNeighbour(points, start)` greedy TSP; `pickStart(points, mode, userPos?)` selects northernmost / southernmost / nearest-to-user start.
- `src/components/Wordmark.tsx` — top-left cluster: overlapping rotated "Tour de" (teal) + "Playground" (purple) pills, theme toggle, `≡ N/111` sidebar toggle, route cycle button. Route button icons: `⬡` off, `↓` north, `↑` south, `⊙` location; spins when loading.
- `src/components/MapView.tsx` — MapLibre map. Purple circles + route position number = unchecked; faded teal + ✓ = checked; teal clusters. Route drawn as per-leg LineString FeatureCollection at 50% opacity; when a playground is selected, its outbound leg brightens to 85% and all others dim to 35%. Route numbers use a symbol layer driven by `routePos` feature property. Accepts `routeOrder`, `selectedId` props.
- `src/components/Sidebar.tsx` — suburb-grouped collapsible list; floating bottom panel on mobile (1rem margins, 20px radius), floating right card on desktop (360px, 16px margins). All suburbs expanded by default. Suburb headers `position: sticky`. 3-way filter: All / Undone / Route (Route only visible when route is active). Route view shows flat numbered list of unchecked playgrounds in TSP order with suburb as secondary text. Rows are read-only — check-off is popup-only. In admin mode shows disable/enable toggles and a reset button.
- `src/index.css` — CSS custom properties for all colour tokens; `[data-theme='light']` overrides.
- Reset UI at `/?reset=1` — passphrase POSTs to `/reset` on the Worker.
- Admin mode at `/?admin=1` — no auth beyond the URL param. Shows disabled playgrounds with dashed border + toggle; shows "Reset everything" button (requires passphrase to confirm).

### Worker (`worker/`)

- Single KV key `state:current` holds `{ checks: [...], disabled: [...], lastModified: "..." }`.
- `POST /check` — idempotent on `id`, safe to retry.
- `POST /uncheck` — removes a check-in by `id`, idempotent.
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

## Extension points

| Version | Feature                                                                                                       |
| ------- | ------------------------------------------------------------------------------------------------------------- |
| v2      | Geofence: only allow check-off within 50m via browser geolocation                                             |
| v2      | Per-rider stats (your count, your last check-off)                                                             |
| v2      | Wake Lock API — keep screen on during a ride                                                                  |
| v2      | Haptic feedback on map marker check-off                                                                       |
| Later   | Offline tile caching via Service Worker (Cache API) — useful for on-ride use where connectivity is unreliable |
| Later   | `?room=xyz` for per-group sessions                                                                            |
| Later   | Photo upload on check-off                                                                                     |
| Later   | Swap MapTiler for self-hosted Protomaps tiles                                                                 |
