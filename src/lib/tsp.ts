export interface Point {
  id: string
  lat: number
  lng: number
  suburb?: string | null
}

// Fallback cost when no ORS matrix is available: squared equirectangular distance.
// Used only for ordering — never shown to the user as a real distance.
export function euclidean(a: Point, b: { lat: number; lng: number }): number {
  const dlat = a.lat - b.lat
  const dlng = (a.lng - b.lng) * Math.cos((a.lat * Math.PI) / 180)
  return dlat * dlat + dlng * dlng
}

export function nearestNeighbour(
  points: Point[],
  start: Point,
  end?: Point,
  cost: (a: Point, b: Point) => number = euclidean,
): Point[] {
  if (points.length === 0) return []
  const remaining = new Set(
    points.filter((p) => p.id !== start.id && (!end || p.id !== end.id)),
  )
  const route: Point[] = [start]
  while (remaining.size > 0) {
    const last = route[route.length - 1]
    let nearest: Point | null = null
    let nearestCost = Infinity
    for (const p of remaining) {
      const c = cost(last, p)
      if (c < nearestCost) {
        nearestCost = c
        nearest = p
      }
    }
    remaining.delete(nearest!)
    route.push(nearest!)
  }
  if (end) route.push(end)
  return route
}

// Standard 2-opt: preserves first and last elements by construction.
export function twoOpt(
  route: Point[],
  cost: (a: Point, b: Point) => number = euclidean,
): Point[] {
  const n = route.length
  if (n < 4) return route
  let best = [...route]
  let improved = true
  while (improved) {
    improved = false
    for (let i = 0; i < n - 2; i++) {
      for (let j = i + 1; j < n - 1; j++) {
        const dOld = cost(best[i], best[i + 1]) + cost(best[j], best[j + 1])
        const dNew = cost(best[i], best[j]) + cost(best[i + 1], best[j + 1])
        if (dNew < dOld - 1e-6) {
          const reversed = best.slice(i + 1, j + 1).reverse()
          best = [...best.slice(0, i + 1), ...reversed, ...best.slice(j + 1)]
          improved = true
        }
      }
    }
  }
  return best
}

export function pickStart(
  points: Point[],
  mode: 'north' | 'south' | 'location',
  userPos?: { lat: number; lng: number },
): Point {
  if (mode === 'south') return [...points].sort((a, b) => a.lat - b.lat)[0]
  if (mode === 'location' && userPos) {
    return [...points].sort(
      (a, b) => euclidean(a, userPos) - euclidean(b, userPos),
    )[0]
  }
  return [...points].sort((a, b) => b.lat - a.lat)[0]
}

// Order playgrounds within a single cluster (suburb), starting from a known entry point.
// NN greedy from the entry point, then 2-opt to clean up.
function orderCluster(
  cluster: Point[],
  entry: Point,
  fixedEnd: Point | undefined,
  cost: (a: Point, b: Point) => number,
): Point[] {
  if (cluster.length <= 1) return cluster
  // Find entry within cluster (may be approximate — pick closest if not exact member)
  const entryInCluster =
    cluster.find((p) => p.id === entry.id) ??
    cluster.reduce((best, p) => (cost(entry, p) < cost(entry, best) ? p : best))
  const fixedEndInCluster = fixedEnd
    ? cluster.find((p) => p.id === fixedEnd.id)
    : undefined
  const ordered = nearestNeighbour(
    cluster,
    entryInCluster,
    fixedEndInCluster,
    cost,
  )
  return twoOpt(ordered, cost)
}

/**
 * Cluster-first, route-second TSP.
 *
 * Groups playgrounds by suburb, then greedily orders the clusters by finding
 * the cheapest bridge (cheapest point in any remaining cluster from the current
 * route tail). Within each cluster, orders by NN from the entry point + 2-opt.
 * A final global 2-opt pass cleans up any remaining cross-cluster crossings.
 */
export function clusterFirstRoute(
  points: Point[],
  start: Point,
  end: Point | undefined,
  cost: (a: Point, b: Point) => number,
): Point[] {
  if (points.length === 0) return []
  if (points.length === 1) return points

  // 1. Group by suburb; null-suburb playgrounds get singleton clusters.
  const clusterMap = new Map<string, Point[]>()
  for (const p of points) {
    const key = p.suburb ?? `_solo_${p.id}`
    const arr = clusterMap.get(key) ?? []
    arr.push(p)
    clusterMap.set(key, arr)
  }

  // Identify start/end clusters
  const findClusterOf = (p: Point) =>
    [...clusterMap.values()].find((c) => c.some((x) => x.id === p.id))

  const startCluster = findClusterOf(start) ?? points
  const endCluster = end ? findClusterOf(end) : undefined

  // Build pending set of clusters (all except start; end will be reserved)
  const pending = new Set(
    [...clusterMap.values()].filter((c) => c !== startCluster),
  )

  // 2. Greedy: order start cluster first, then pick cheapest-entry cluster at each step.
  const result: Point[] = []

  const appendCluster = (cluster: Point[], entry: Point, fixedEnd?: Point) => {
    const ordered = orderCluster(cluster, entry, fixedEnd, cost)
    result.push(...ordered)
  }

  // Handle start cluster with pinned start (and pinned end if same cluster)
  const endInStartCluster = end && startCluster.some((p) => p.id === end.id)
  appendCluster(startCluster, start, endInStartCluster ? end : undefined)

  while (pending.size > 0) {
    const tail = result[result.length - 1]

    // Keep end cluster reserved until it's the only one left.
    let bestCluster: Point[] | null = null
    let bestEntry: Point | null = null
    let bestCost = Infinity

    for (const cluster of pending) {
      // Skip the end cluster if other clusters remain
      if (cluster === endCluster && pending.size > 1) continue
      for (const p of cluster) {
        const c = cost(tail, p)
        if (c < bestCost) {
          bestCost = c
          bestCluster = cluster
          bestEntry = p
        }
      }
    }

    if (!bestCluster || !bestEntry) break

    pending.delete(bestCluster)
    const isEndCluster = bestCluster === endCluster
    appendCluster(bestCluster, bestEntry, isEndCluster ? end : undefined)
  }

  // 3. Final global 2-opt to clean up any cross-cluster crossings.
  // Pinned start/end are safe: twoOpt never moves index 0 or n-1.
  return twoOpt(result, cost)
}
