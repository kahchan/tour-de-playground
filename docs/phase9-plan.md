# Phase 9 — UX polish: popup removal, stable route, start pin, 2-opt

## Overview

Four focused changes that make the app work better as an actual ride-day tool.

---

## 1. Remove MarkerPopup

**Problem:** Tapping a map marker opens a floating popup AND highlights the sidebar row, giving two simultaneous ways to mark done. On mobile the popup obscures the map.

**Fix:**
- Stop rendering `MarkerPopup` in `App.tsx`; remove the component from the tree entirely.
- Map marker click continues to call `handleMarkerClick`: selects the playground, opens the sidebar, scrolls/highlights the row.
- All check-off happens via the inline ✓ Done / Undo buttons that already appear on the selected sidebar row.
- Name-prompt flow is already triggered by the inline Done button, so nothing else changes.
- Keep `selected` state for the sidebar row highlight (`selectedId` prop).
- `MarkerPopup.tsx` can stay in the codebase but is simply not used.

---

## 2. Stable route numbers (no renumber on check-off)

**Problem:** `useRoute` depends on `uncheckedPlaygrounds`, so every check-off triggers a full TSP + ORS recalculation. This renumbers every remaining marker mid-ride and wastes ORS quota.

**Fix — freeze the route on explicit change only:**
- Remove `uncheckedPlaygrounds` from the `useEffect` dependency array in `useRoute`. The route only recalculates when `mode`, `pinnedStartId`, or `pinnedEndId` changes.
- Introduce `allPlaygrounds: Playground[]` as a second parameter to `useRoute` (the full visible set, not filtered by checked). TSP and ORS always plan over the full set regardless of check-off state.
- `orderedIds` is now a stable, frozen sequence representing the planned ride order.
- **Map markers:** all playgrounds get a `routePos` (their frozen sequence number); the symbol layer already filters to unchecked-only, so checked ones just lose their number naturally as you tick them.
- **Sidebar route view:** show the full frozen sequence (all items), with checked ones dimmed + ✓. This lets the rider see "I've done 1–6, currently on 7, next is 8" without numbers jumping around.
- **ORS line:** stays fixed too — shows the full planned path. Checked stops remain on the line visually (you can see where you've been). Unneeded segments could be styled differently in future.
- **Auto-clear pins on check-off:** In `App.tsx`, when `checkedIds` changes, if `pinnedStartId` or `pinnedEndId` is now checked, clear it (so the next re-route from a mode change doesn't reference a done playground).

---

## 3. Pinnable start + 2-opt improvement

### 3a. Pin specific start playground

**Problem:** End can be a specific playground (⊢ button), but start is always abstract (northernmost / southernmost / nearest). Asymmetric and can't represent "start at home."

**Fix:**
- Add a `⊣` start-pin button on each unchecked list row alongside the existing `⊢` end-pin button. Only visible when route is active.
- `pinnedStartId: string | null` state in `App.tsx`, passed to `useRoute`.
- In `useRoute`: if `pinnedStartId` is set, use that playground directly as `start` (skips `pickStart`). The abstract mode button (north/south/location) is still useful as a fallback when no specific playground is pinned.
- Visual distinction: start pin button uses teal accent (matching the start/route colour), end pin uses purple.

### 3b. 2-opt improvement pass

**Problem:** Nearest-neighbour produces locally greedy routes that zigzag. With a fixed start+end the middle section can still double back on itself.

**Fix — add 2-opt to `src/lib/tsp.ts`:**

```ts
export function twoOpt(route: Point[], fixedStart: boolean, fixedEnd: boolean): Point[] {
  // Standard 2-opt: try reversing every sub-segment [i+1..j],
  // skip if it would move a fixed endpoint.
  // Repeat until no improvement found (typically 3–5 passes for 111 nodes).
  // O(n²) per pass — negligible at this scale.
}
```

- Applied after `nearestNeighbour` in `useRoute.runRoute`.
- When both start and end are pinned, only swap sub-segments that exclude both endpoints. This naturally produces more circular, less directional routes — the algorithm finds it cheaper to sweep one side then the other rather than zigzag back.
- When only start or only end is pinned, same constraint on the relevant endpoint.
- Cache key includes the final 2-opt result (already does, since it hashes `orderedIds`).

---

## 4. Ideal route with both endpoints set

When `pinnedStartId` and `pinnedEndId` are both set, the combination of 2-opt + fixed endpoints already handles this. But there's one heuristic improvement worth adding:

**"Sweep" initialisation instead of NN when both endpoints are set:**
Rather than NN from start (which greedily visits nearest each step and may end up far from the end), try a sweep approach:
1. Sort all intermediate playgrounds by their angle relative to the midpoint of start→end.
2. Use that sorted order as the initial tour, then apply 2-opt.

This gives 2-opt a better starting point when start and end form a clear axis, producing routes that loop around rather than double back.

Implementation: add `sweepOrder(points, start, end)` to `tsp.ts`, called instead of `nearestNeighbour` when both endpoints are pinned.

---

## File change summary

| File | Change |
|------|--------|
| `src/App.tsx` | Don't render MarkerPopup; add `pinnedStartId`; auto-clear pins on check-off |
| `src/hooks/useRoute.ts` | Accept `allPlaygrounds` + `pinnedStartId`; remove `uncheckedPlaygrounds` dep; apply 2-opt |
| `src/lib/tsp.ts` | Add `twoOpt()`, add `sweepOrder()` |
| `src/components/Sidebar.tsx` | Route view shows full frozen sequence with checked items dimmed; add start-pin `⊣` button |
| `src/components/Sidebar.module.css` | Start-pin button style (teal variant) |

No new dependencies. No Worker changes.

## Order of implementation

1. Remove MarkerPopup (standalone, no deps on other changes)
2. Stable route + full-sequence sidebar view (requires `allPlaygrounds` param change)
3. `twoOpt` + `sweepOrder` in tsp.ts (pure functions, easy to test)
4. Pin start (`pinnedStartId`), wire 2-opt into `useRoute`
5. Auto-clear pins on check-off
