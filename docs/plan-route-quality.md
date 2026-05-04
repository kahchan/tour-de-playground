# Plan: Better routes — real costs, clustering, lookahead

## Problem statement

The current routing is suspicious on three fronts:

1. **Cost metric is wrong.** Both `nearestNeighbour` and `twoOpt` minimise *straight-line* squared distance (equirectangular approximation in `tsp.ts`). Wellington has harbours, ridges, motorways and one-way streets — the crow-flies metric routinely picks neighbours that are >5× further by bike. The map then *renders* the on-road ORS line, which makes the order look bad even when each segment is fine.
2. **Per-leg distance/elevation come from ORS but the route they describe was chosen by the bad metric.** So the numbers in the sidebar are accurate for the ordering we picked — but the ordering itself is poor, and totals are inflated. Worth double-checking ORS values against an independent calculation regardless (see §Verification).
3. **No notion of clusters, road class, or doubling-back.** Two playgrounds in the same suburb should almost always be done together; a route that crosses SH1 twice in 1 km is almost never right; a TSP that revisits a corridor it already passed is wasted distance and elevation.

A pure A* doesn't fix this — A* is a *shortest-path* algorithm between two nodes; we already have ORS for that. What we want is a better **visit-order** (TSP/VRP), informed by real road costs and structure.

---

## Phase A — Verify the numbers we already show

Before changing the algorithm, confirm the displayed totals are right.

- **Sanity-check ORS values.** For one fetched route, log:
  - sum of `segments[i].distance` vs. our own Haversine sum over the leg coordinates (they should differ — ORS is on-road, Haversine is crow-flies — but both should be in sensible ranges).
  - sum of `segments[i].ascent` vs. a manual walk over the `[lng, lat, elev]` triples summing positive deltas.
- **Look for the chunk-boundary bug.** Chunks overlap by one waypoint (step = `CHUNK_SIZE - 1`). Currently `legStats` for each chunk has `chunk.length - 1` entries; with step 49 those tile cleanly into `ids.length - 1` legs. Verify by asserting `allLegStats.length === ids.length - 1` and add a runtime check.
- **Elevation noise.** Even though ORS pre-smooths, on flat-ish urban routes the reported ascent can still drift high. Compare against a known reference (e.g. plug a 5-stop loop into Strava/komoot) for one or two routes to calibrate confidence.
- **Profile choice.** `cycling-mountain` weights gradient avoidance heavily. For Wellington that may be right, but its distances will be longer than `cycling-regular`. Try one route with each profile and compare.

Output of this phase is a short note in the doc: are our numbers trustworthy? If yes, move on. If no, fix before changing the algorithm.

---

## Phase B — Build a real cost matrix

This is the foundation for everything below.

- Use **ORS Matrix API** (`/v2/matrix/cycling-mountain`) to get an N×N matrix of *on-road* `distance` and `duration` between all included playgrounds (currently ~111). One request can do up to 50×50; we'll need to tile (4 requests for 111²) and stitch.
- Cache the matrix in `localStorage` (or commit a generated `playgrounds-matrix.json` to the repo, since playgrounds change rarely). Key it on a hash of the included playground ids — invalidate when the set changes.
- For elevation cost, the Matrix API does not return ascent. Two options:
  - **(preferred)** A second pass: for each edge we *might* use, fetch its directions to get ascent. Too expensive for full matrix. Instead: build a cheap elevation proxy from a static DEM lookup (one elevation per playground), and approximate edge ascent as `max(0, elev[j] - elev[i])` plus a roughness term. Good enough for ordering decisions.
  - **(simpler)** Ignore elevation in the matrix; only optimise on distance/time. Apply elevation as a post-hoc tiebreaker / sidebar metric. Ship this first.
- Replace the squared-equirectangular `dist()` in `tsp.ts` with a `cost(i, j)` lookup against the matrix. `nearestNeighbour` and `twoOpt` then operate on real bike costs.

Even just this change should fix most of the "obviously wrong order" complaints without any clustering work.

---

## Phase C — Cluster-aware ordering

Goal: visits to playgrounds in the same suburb (or geographic cluster) happen in one sweep, not scattered through the route.

- We already have `suburb` on each playground. Use it as a pre-computed cluster label.
- **Two-tier TSP:**
  1. Order *within* each suburb using the cost matrix (small TSP, ≤ ~10 stops typically — exact DP is fine).
  2. Order *between* suburbs by treating each suburb as a super-node at its centroid; run the matrix-based heuristic on those super-nodes.
  3. Concatenate, with the entry/exit point of each suburb chosen to minimise the join to the previous/next suburb.
- This is a standard "cluster-first, route-second" heuristic and gives big quality wins for free when clusters are obvious (which Wellington's suburbs mostly are).
- Fallback / sanity: also run flat 2-opt on the final concatenated path to clean up any clearly-wrong joins.

---

## Phase D — Penalise doubling-back and major crossings

These are quality terms layered on top of the cost metric.

- **Doubling-back penalty.** During 2-opt evaluation, add a penalty proportional to the cosine similarity between the incoming and outgoing edges at each visit — discourages U-turns. Cheap to compute and matches "felt" route quality.
- **Highway-crossing penalty.** Two ways to detect:
  - Use ORS directions response `extras.roadaccessrestrictions` / `extras.waycategory` per leg and count crossings of motorway/trunk classes. Add `k * crossings` to leg cost. Requires us to fetch directions per candidate edge — too expensive at TSP time.
  - **Cheaper proxy:** pre-compute, for each playground pair we care about, whether the bike route between them crosses a hand-curated set of motorway corridors (SH1 around Ngauranga/Aotea Quay, SH2). Store a boolean per matrix cell. Add a fixed penalty when true. The curated set is small enough to maintain.
- Both penalties go into `cost(i, j)` used by 2-opt; nearest-neighbour benefits automatically.

---

## Phase E — Lookahead / global solver

Once costs and penalties are right, the remaining gap is local-optimum traps. Options:

- **Or-opt / 3-opt** in addition to 2-opt. Or-opt (moving a chain of 1–3 cities to a different position) is cheap and often pulls a route out of 2-opt minima.
- **Limited-depth lookahead in nearest-neighbour.** At each step, instead of picking the cheapest next stop, pick the stop that minimises `cost(current, next) + cheapestExtensionFrom(next)` for a small horizon (k=2 or 3). Combats the classic NN failure where it greedily picks a close stop and then has to make a long return trip.
- **ORS Optimization endpoint (Vroom).** This is a proper VRP solver; it accepts jobs + a vehicle and returns an optimised order. Pros: handles the whole problem including time windows / capacities if we ever want them. Cons: it optimises for *time/distance only*, won't know about our cluster or crossing penalties — though those are partly absorbed by using a real cost matrix. Worth trying as a one-shot baseline to compare our heuristic against.

Recommendation: ship Phases A–C first, evaluate, then decide between Or-opt+lookahead (in-house, no extra API) and Vroom (external, simpler). I'd lean Vroom for the "give me the best order" path and keep our heuristic as the offline / no-key fallback.

---

## A* — where it does and doesn't fit

A* solves *shortest path between two nodes on a graph*. We already get that from ORS for each leg. A* would only help if we wanted to do our own routing on a local OSM extract (offline support, custom road-class weights). That's out of scope unless we drop ORS — note as a future option, don't build now.

The "lookahead" the user is asking for is **TSP lookahead**, not pathfinding lookahead. That's covered by Phase E.

---

## Suggested order of work

1. **Phase A** (verification) — small, no API spend, decides whether the totals shown in sidebar are even right.
2. **Phase B** (real cost matrix) — biggest single quality win.
3. **Phase C** (cluster-first by suburb) — fixes the "scattered visits" complaint.
4. **Phase D** (penalties) — polish; reorder if motorway crossings turn out to be the dominant pain.
5. **Phase E** (Vroom or Or-opt) — only if A–D aren't enough.

## Out of scope

- Self-hosted routing / offline OSM graph.
- Per-rider customisation (avoid hills, prefer time, etc.) — keep it one global route for now.
- Live re-routing as playgrounds get checked off (current behaviour: route is computed for unchecked set; that's fine).
