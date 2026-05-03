interface Point {
  id: string
  lat: number
  lng: number
}

function dist(a: Point, b: { lat: number; lng: number }): number {
  const dlat = a.lat - b.lat
  const dlng = (a.lng - b.lng) * Math.cos((a.lat * Math.PI) / 180)
  return dlat * dlat + dlng * dlng
}

export function nearestNeighbour(points: Point[], start: Point, end?: Point): Point[] {
  if (points.length === 0) return []
  const remaining = new Set(
    points.filter((p) => p.id !== start.id && (!end || p.id !== end.id)),
  )
  const route: Point[] = [start]
  while (remaining.size > 0) {
    const last = route[route.length - 1]
    let nearest: Point | null = null
    let nearestDist = Infinity
    for (const p of remaining) {
      const d = dist(p, last)
      if (d < nearestDist) {
        nearestDist = d
        nearest = p
      }
    }
    remaining.delete(nearest!)
    route.push(nearest!)
  }
  if (end) route.push(end)
  return route
}

export function pickStart(
  points: Point[],
  mode: 'north' | 'south' | 'location',
  userPos?: { lat: number; lng: number },
): Point {
  if (mode === 'south') return [...points].sort((a, b) => a.lat - b.lat)[0]
  if (mode === 'location' && userPos) {
    return [...points].sort((a, b) => dist(a, userPos) - dist(b, userPos))[0]
  }
  return [...points].sort((a, b) => b.lat - a.lat)[0]
}

// Standard path 2-opt — endpoints are always preserved by construction.
export function twoOpt(route: Point[]): Point[] {
  const n = route.length
  if (n < 4) return route
  let best = [...route]
  let improved = true
  while (improved) {
    improved = false
    for (let i = 0; i < n - 2; i++) {
      for (let j = i + 1; j < n - 1; j++) {
        const dOld = dist(best[i], best[i + 1]) + dist(best[j], best[j + 1])
        const dNew = dist(best[i], best[j]) + dist(best[i + 1], best[j + 1])
        if (dNew < dOld - 1e-14) {
          const reversed = best.slice(i + 1, j + 1).reverse()
          best = [...best.slice(0, i + 1), ...reversed, ...best.slice(j + 1)]
          improved = true
        }
      }
    }
  }
  return best
}

// Sweep initialisation: sort intermediates by angle around the start→end midpoint.
// Gives 2-opt a better starting point when both endpoints are pinned.
export function sweepOrder(points: Point[], start: Point, end: Point): Point[] {
  const intermediates = points.filter((p) => p.id !== start.id && p.id !== end.id)
  const midLat = (start.lat + end.lat) / 2
  const midLng = (start.lng + end.lng) / 2
  const cosLat = Math.cos((midLat * Math.PI) / 180)
  const sorted = [...intermediates].sort((a, b) => {
    const angleA = Math.atan2(a.lat - midLat, (a.lng - midLng) * cosLat)
    const angleB = Math.atan2(b.lat - midLat, (b.lng - midLng) * cosLat)
    return angleA - angleB
  })
  return [start, ...sorted, end]
}
