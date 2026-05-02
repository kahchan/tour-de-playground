# Routing plan

Route unchecked playgrounds in an efficient MTB-friendly order, drawn as a line on the map. Toggleable. Hidden if no API key is set.

## Routing service: OpenRouteService (ORS)

Free tier (2,000 req/day, 50 waypoints/request) — enough for this app.

Profile: `cycling-mountain` — uses OSM MTB track data, which covers Wellington's trail network.

**How to get a key:**
1. Sign up at openrouteservice.org → "Get started for free"
2. Dashboard → "Request a token" → Standard plan (free)
3. Add `VITE_ORS_KEY=<your-key>` to `.env.local`

### Alternatives considered

| Service | MTB profile | Free tier |
|---|---|---|
| **ORS** (chosen) | `cycling-mountain` | 2,000 req/day |
| GraphHopper | `mtb` (explicit) | 500 req/day |
| MapTiler Directions | `cycling` only | Pay-per-use |
| Mapbox Directions | `cycling` only | 100k/month |
| Valhalla | bicycle + surface weights | Self-hosted only |

---

## Ordering: nearest-neighbour TSP

111 unchecked playgrounds → full TSP is NP-hard. Nearest-neighbour heuristic runs in-browser in <1 ms and produces a route ~20% above optimal — good enough for a bike ride.

Start node: northernmost unchecked playground (natural top-of-Wellington start point).

Only unchecked playgrounds are routed. The route automatically shortens as playgrounds are checked off.

---

## Files to create / modify

| File | Change |
|---|---|
| `src/lib/tsp.ts` | Nearest-neighbour function. Pure math, no deps. |
| `src/hooks/useRoute.ts` | Toggle state, TSP ordering, ORS fetch with 50-waypoint chunking, response cache (keyed by waypoints), abort on toggle-off or re-render. |
| `src/components/MapView.tsx` | Add `route` GeoJSON source + `LineLayer` (drawn behind markers). Accept `routeGeoJSON` prop (null = hidden). Also move nav control from `top-right` → `bottom-left` to stop it being covered by the sidebar. |
| `src/App.tsx` | Call `useRoute`, pass `routeGeoJSON` + toggle to MapView and toggle button. |
| `src/components/Counter.tsx` (or new `RouteToggle.tsx`) | Route toggle button next to the counter pill (top-left). Hidden when `VITE_ORS_KEY` is unset. Shows a spinner while loading, "Route unavailable" on error. |
| `.env.example` | Add `VITE_ORS_KEY=` |

---

## useRoute behaviour

```
unchecked playgrounds
  → nearestNeighbour()          pure in-browser sort
  → chunk into groups of 50     ORS waypoint limit
  → fetch all chunks in parallel
  → merge into one LineString
  → setRouteGeoJSON(...)
```

- Cache keyed by serialised waypoint list — toggling off/on doesn't re-fetch if playgrounds haven't changed.
- Previous fetch is aborted when `routeEnabled` flips off or unchecked set changes.
- `routeEnabled = false` → `routeGeoJSON = null` → line layer hidden.

---

## Phase 2: dynamic reorder (future)

When sidebar drag-to-reorder lands, `useRoute` will accept an optional `overrideOrder: string[]`. If provided, skip TSP and use that order directly. Re-fetch debounced ~800 ms after last drag event.

---

## Known limits

- ORS free tier caps at 50 waypoints/request. 111 playgrounds → 3 sequential chunks. At the start of a full ride this costs 3 requests; drops as playgrounds are checked off.
- ORS `cycling-mountain` prefers OSM-tagged MTB tracks. Coverage depends on OSM contributors — Wellington's trail network is reasonably well mapped but may have gaps.
