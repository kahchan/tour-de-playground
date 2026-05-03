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
