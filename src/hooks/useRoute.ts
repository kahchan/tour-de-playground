import { useCallback, useEffect, useRef, useState } from 'react'
import type { FeatureCollection, LineString } from 'geojson'
import type { Playground } from '../types'
import { clusterFirstRoute, euclidean, pickStart } from '../lib/tsp'
import { buildMatrix, getCachedMatrix, setCachedMatrix } from '../lib/matrix'

export type RouteMode = 'off' | 'north' | 'south' | 'location'
type FetchState = 'idle' | 'loading' | 'ready' | 'error'

export interface LegStat {
  id: string
  distance: number
  elevationGain: number
}

const MODE_CYCLE: RouteMode[] = ['off', 'north', 'south', 'location']
const ORS_DIRECTIONS_URL =
  'https://api.openrouteservice.org/v2/directions/cycling-mountain/geojson'
const CHUNK_SIZE = 50

function chunkOverlapping<T>(arr: T[], size: number): T[][] {
  if (arr.length < 2) return []
  const chunks: T[][] = []
  const step = size - 1
  for (let i = 0; i < arr.length - 1; i += step) {
    chunks.push(arr.slice(i, Math.min(i + size, arr.length)))
  }
  return chunks
}

interface ChunkResult {
  legs: [number, number, number][][]
  legStats: { distance: number; elevationGain: number }[]
}

interface CacheEntry {
  geoJSON: FeatureCollection<LineString>
  routeLegs: LegStat[]
}

async function fetchChunk(
  waypoints: { lat: number; lng: number }[],
  key: string,
  signal: AbortSignal,
): Promise<ChunkResult> {
  const res = await fetch(ORS_DIRECTIONS_URL, {
    method: 'POST',
    headers: { Authorization: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      coordinates: waypoints.map((p) => [p.lng, p.lat]),
      elevation: true,
    }),
    signal,
  })
  if (!res.ok) throw new Error(`ORS ${res.status}`)
  const data = await res.json()
  const feature = data.features[0]
  const coords: [number, number, number][] = feature.geometry.coordinates
  const wayPts: number[] = feature.properties.way_points
  const segments: { distance: number; ascent?: number }[] =
    feature.properties.segments ?? []
  const legs: [number, number, number][][] = []
  const legStats: { distance: number; elevationGain: number }[] = []
  for (let i = 0; i < wayPts.length - 1; i++) {
    const legCoords = coords.slice(wayPts[i], wayPts[i + 1] + 1)
    legs.push(legCoords)
    // Prefer ORS's pre-smoothed ascent value. Summing raw coordinate Z-deltas
    // accumulates DEM noise over hundreds of dense points and inflates totals
    // by orders of magnitude. Fall back to coordinate sum only if ascent is
    // absent (uncommon — ORS includes it whenever elevation:true is set).
    const orsAscent = segments[i]?.ascent
    let elevationGain: number
    if (orsAscent != null) {
      // ORS pre-smooths its DEM before summing — use that directly.
      elevationGain = orsAscent
    } else {
      // Rare fallback: subsample to ~every 30 coords to suppress DEM noise.
      // Summing every raw Z-delta over hundreds of dense routing points
      // accumulates noise into wildly inflated totals (tens of thousands of metres).
      const step = Math.max(1, Math.floor(legCoords.length / 30))
      elevationGain = 0
      for (let k = step; k < legCoords.length; k += step) {
        const dz = legCoords[k][2] - legCoords[k - step][2]
        if (dz > 0) elevationGain += dz
      }
    }
    legStats.push({ distance: segments[i]?.distance ?? 0, elevationGain })
  }
  return { legs, legStats }
}

export function useRoute(
  allPlaygrounds: Playground[],
  pinnedEndId: string | null,
  pinnedStartId: string | null,
) {
  const [mode, setMode] = useState<RouteMode>('off')
  const [fetchState, setFetchState] = useState<FetchState>('idle')
  const [geoJSON, setGeoJSON] = useState<FeatureCollection<LineString> | null>(
    null,
  )
  const [orderedIds, setOrderedIds] = useState<string[]>([])
  const [routeLegs, setRouteLegs] = useState<LegStat[]>([])

  // Stable ref so check-off updates don't retrigger the route.
  const allPlaygroundsRef = useRef(allPlaygrounds)
  useEffect(() => {
    allPlaygroundsRef.current = allPlaygrounds
  }, [allPlaygrounds])

  // Matrix is cached here across mode changes; rebuilt only when playgrounds change.
  const matrixRef = useRef<number[][] | null>(null)
  const matrixHashRef = useRef<string>('')

  const routeCacheRef = useRef<Map<string, CacheEntry>>(new Map())
  const abortRef = useRef<AbortController | null>(null)

  const cycle = useCallback(() => {
    setMode((m) => MODE_CYCLE[(MODE_CYCLE.indexOf(m) + 1) % MODE_CYCLE.length])
  }, [])

  useEffect(() => {
    if (mode === 'off') {
      abortRef.current?.abort()
      setFetchState('idle')
      setGeoJSON(null)
      setOrderedIds([])
      setRouteLegs([])
      return
    }

    const orsKey = import.meta.env.VITE_ORS_KEY
    if (!orsKey || allPlaygroundsRef.current.length < 2) {
      setFetchState('idle')
      setGeoJSON(null)
      setOrderedIds([])
      setRouteLegs([])
      return
    }

    if (mode === 'location') {
      if (!navigator.geolocation) {
        setMode('off')
        return
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          runRoute(
            { lat: pos.coords.latitude, lng: pos.coords.longitude },
            orsKey,
          ),
        () => setMode('off'),
        { timeout: 8000 },
      )
      return
    }

    runRoute(undefined, orsKey)
  }, [mode, pinnedStartId, pinnedEndId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function runRoute(
    startPos: { lat: number; lng: number } | undefined,
    orsKey: string,
  ) {
    const playgrounds = allPlaygroundsRef.current

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setFetchState('loading')

    // ── Load or build the cost matrix ────────────────────────────────────────
    const hash = playgrounds
      .map((p) => p.id)
      .sort()
      .join(',')

    let matrix = matrixRef.current
    if (!matrix || matrixHashRef.current !== hash) {
      matrix = getCachedMatrix(playgrounds)
      if (!matrix) {
        try {
          matrix = await buildMatrix(playgrounds, orsKey, controller.signal)
          setCachedMatrix(playgrounds, matrix)
        } catch (err) {
          if ((err as Error).name === 'AbortError') return
          console.warn(
            'Matrix build failed — falling back to straight-line cost',
            err,
          )
          matrix = null
        }
      }
      matrixRef.current = matrix
      matrixHashRef.current = hash
    }

    // ── Build cost function ───────────────────────────────────────────────────
    const idxOf = new Map(playgrounds.map((p, i) => [p.id, i]))
    const cost =
      matrix != null
        ? (a: { id: string }, b: { id: string }) =>
            matrix![idxOf.get(a.id)!][idxOf.get(b.id)!]
        : euclidean

    // ── TSP: cluster-first, then global 2-opt ─────────────────────────────────
    const pinnedStart = pinnedStartId
      ? playgrounds.find((p) => p.id === pinnedStartId)
      : undefined
    const pinnedEnd = pinnedEndId
      ? playgrounds.find((p) => p.id === pinnedEndId)
      : undefined

    const start =
      pinnedStart ??
      pickStart(playgrounds, mode as 'north' | 'south' | 'location', startPos)
    const end = pinnedEnd?.id !== start.id ? pinnedEnd : undefined

    const ordered = clusterFirstRoute(playgrounds, start, end, cost)
    const ids = ordered.map((p) => p.id)
    setOrderedIds(ids)

    // ── ORS directions (for drawing) ──────────────────────────────────────────
    const cacheKey = `${mode}:${pinnedStartId ?? ''}:${pinnedEndId ?? ''}:${ids.join(',')}`
    const cached = routeCacheRef.current.get(cacheKey)
    if (cached) {
      setGeoJSON(cached.geoJSON)
      setRouteLegs(cached.routeLegs)
      setFetchState('ready')
      return
    }

    const chunks = chunkOverlapping(ordered, CHUNK_SIZE)

    Promise.all(
      chunks.map((chunk) => fetchChunk(chunk, orsKey, controller.signal)),
    )
      .then((chunkResults) => {
        let legIndex = 0
        const features = chunkResults.flatMap(({ legs }) =>
          legs.map((legCoords) => ({
            type: 'Feature' as const,
            geometry: { type: 'LineString' as const, coordinates: legCoords },
            properties: { legIndex: legIndex++ },
          })),
        )
        const allLegStats = chunkResults.flatMap(({ legStats }) => legStats)
        const newRouteLegs: LegStat[] = ids.map((id, i) =>
          i === 0
            ? { id, distance: 0, elevationGain: 0 }
            : { id, ...allLegStats[i - 1] },
        )
        const result: FeatureCollection<LineString> = {
          type: 'FeatureCollection',
          features,
        }
        routeCacheRef.current.set(cacheKey, {
          geoJSON: result,
          routeLegs: newRouteLegs,
        })
        setGeoJSON(result)
        setRouteLegs(newRouteLegs)
        setFetchState('ready')
      })
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return
        console.error('Route fetch failed:', err)
        setFetchState('error')
      })
  }

  return { mode, cycle, setMode, fetchState, geoJSON, orderedIds, routeLegs }
}
