import { useCallback, useEffect, useRef, useState } from 'react'
import type { FeatureCollection, LineString } from 'geojson'
import type { Playground } from '../types'
import { clusterFirstRoute, euclidean, pickStart, type Point } from '../lib/tsp'

export type RouteMode = 'off' | 'north' | 'south' | 'location'
type FetchState = 'idle' | 'loading' | 'ready' | 'error'

export interface RouteStep {
  distance: number
  instruction: string
  name: string | null
  type: number
}

export interface LegStat {
  id: string
  distance: number
  elevationGain: number
  steps: RouteStep[]
}

const MODE_CYCLE: RouteMode[] = ['off', 'north', 'south', 'location']
const ORS_DIRECTIONS_URL =
  'https://api.openrouteservice.org/v2/directions/cycling-mountain/geojson'
const ORS_OPTIMIZATION_URL = 'https://api.openrouteservice.org/optimization'
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
  legStats: { distance: number; elevationGain: number; isMtb: boolean; steps: RouteStep[] }[]
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
      extra_info: ['waytype'],
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
  const waytypeValues: [number, number, number][] =
    feature.extras?.waytype?.values ?? []
  const legs: [number, number, number][][] = []
  const legStats: { distance: number; elevationGain: number; isMtb: boolean }[] = []
  for (let i = 0; i < wayPts.length - 1; i++) {
    const legCoords = coords.slice(wayPts[i], wayPts[i + 1] + 1)
    legs.push(legCoords)
    const orsAscent = segments[i]?.ascent
    const orsDistance = segments[i]?.distance ?? 0
    // Reject ORS ascent if it implies >15% average gradient — sign of a
    // corrupted SRTM tile (Freyberg, The Crescent, etc.). Cap at 300 m since
    // Wellington's highest ridgeline legs can genuinely approach that.
    const MAX_ELEV = 300
    const orsAscentPlausible =
      orsAscent != null &&
      orsAscent <= Math.min(Math.max(orsDistance * 0.15, 50), MAX_ELEV)
    let elevationGain: number
    if (orsAscentPlausible) {
      elevationGain = orsAscent
    } else {
      // Fall back to summing positive Z-deltas from the full coordinate array.
      // Ignore increments < 2 m to suppress DEM noise; cap at MAX_ELEV as a
      // final guard against tiles where the entire Z series is corrupt.
      let coordGain = 0
      for (let j = 1; j < legCoords.length; j++) {
        const dz = legCoords[j][2] - legCoords[j - 1][2]
        if (dz > 2) coordGain += dz
      }
      elevationGain = Math.min(coordGain, MAX_ELEV)
    }
    // Waytype 4 = path, 5 = track — both indicate off-road MTB terrain.
    const legStart = wayPts[i]
    const legEnd = wayPts[i + 1]
    const isMtb = waytypeValues.some(
      ([from, to, val]) => (val === 4 || val === 5) && from < legEnd && to > legStart,
    )
    const rawSteps: { distance: number; instruction: string; name: string; type: number }[] =
      segments[i]?.steps ?? []
    const steps: RouteStep[] = rawSteps.map((s) => ({
      distance: s.distance,
      instruction: s.instruction,
      name: s.name === '-' ? null : (s.name || null),
      type: s.type,
    }))
    legStats.push({ distance: orsDistance, elevationGain, isMtb, steps })
  }
  return { legs, legStats }
}

// Ask ORS Vroom to optimise the visit order. Returns playground ids in the
// order Vroom recommends, with start first and (optional) pinned end last.
async function fetchVroomOrder(
  playgrounds: Playground[],
  start: Point,
  end: Point | undefined,
  orsKey: string,
  signal: AbortSignal,
): Promise<string[]> {
  // Jobs = every playground that isn't the fixed start or end.
  const jobPgs = playgrounds.filter(
    (p) => p.id !== start.id && (!end || p.id !== end.id),
  )
  const jobs = jobPgs.map((p, i) => ({ id: i, location: [p.lng, p.lat] }))

  const vehicle: Record<string, unknown> = {
    id: 0,
    profile: 'cycling-mountain',
    start: [start.lng, start.lat],
  }
  if (end) vehicle.end = [end.lng, end.lat]

  const res = await fetch(ORS_OPTIMIZATION_URL, {
    method: 'POST',
    headers: { Authorization: orsKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobs, vehicles: [vehicle] }),
    signal,
  })
  if (!res.ok) throw new Error(`ORS optimization ${res.status}`)
  const data = await res.json()
  const route = data.routes?.[0]
  if (!route) throw new Error('No route in optimization response')

  const ids: string[] = [start.id]
  for (const step of route.steps as { type: string; id?: number }[]) {
    if (step.type === 'job' && step.id != null) ids.push(jobPgs[step.id].id)
  }
  if (end) ids.push(end.id)
  return ids
}

export function useRoute(
  allPlaygrounds: Playground[],
  pinnedEndId: string | null,
  pinnedStartId: string | null,
) {
  const [mode, setMode] = useState<RouteMode>('off')
  const [fetchState, setFetchState] = useState<FetchState>('idle')
  const [geoJSON, setGeoJSON] = useState<FeatureCollection<LineString> | null>(null)
  const [orderedIds, setOrderedIds] = useState<string[]>([])
  const [routeLegs, setRouteLegs] = useState<LegStat[]>([])

  const allPlaygroundsRef = useRef(allPlaygrounds)
  useEffect(() => {
    allPlaygroundsRef.current = allPlaygrounds
  }, [allPlaygrounds])

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
          runRoute({ lat: pos.coords.latitude, lng: pos.coords.longitude }, orsKey),
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

    // ── Visit order: Vroom (≤50 jobs) or cluster-first TSP ───────────────────
    // ORS free tier rejects optimization payloads with >50 jobs (returns 413).
    const jobCount = playgrounds.length - 1 - (end ? 1 : 0)
    let ids: string[]
    if (jobCount <= 50) {
      try {
        ids = await fetchVroomOrder(playgrounds, start, end, orsKey, controller.signal)
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        console.warn('Vroom failed — falling back to cluster-first TSP:', err)
        ids = clusterFirstRoute(playgrounds, start, end, euclidean).map((p) => p.id)
      }
    } else {
      ids = clusterFirstRoute(playgrounds, start, end, euclidean).map((p) => p.id)
    }

    setOrderedIds(ids)

    // ── ORS directions (for drawing the route on the map) ─────────────────────
    const cacheKey = `${mode}:${pinnedStartId ?? ''}:${pinnedEndId ?? ''}:${ids.join(',')}`
    const cached = routeCacheRef.current.get(cacheKey)
    if (cached) {
      setGeoJSON(cached.geoJSON)
      setRouteLegs(cached.routeLegs)
      setFetchState('ready')
      return
    }

    const orderedPgs = ids
      .map((id) => playgrounds.find((p) => p.id === id))
      .filter((p): p is Playground => p !== undefined)
    const chunks = chunkOverlapping(orderedPgs, CHUNK_SIZE)

    Promise.all(chunks.map((chunk) => fetchChunk(chunk, orsKey, controller.signal)))
      .then((chunkResults) => {
        let legIndex = 0
        const features = chunkResults.flatMap(({ legs, legStats }) =>
          legs.map((legCoords, i) => ({
            type: 'Feature' as const,
            geometry: { type: 'LineString' as const, coordinates: legCoords },
            properties: { legIndex: legIndex++, isMtb: legStats[i]?.isMtb ?? false },
          })),
        )
        const allLegStats = chunkResults.flatMap(({ legStats }) => legStats)
        const newRouteLegs: LegStat[] = ids.map((id, i) =>
          i === 0
            ? { id, distance: 0, elevationGain: 0, steps: [] }
            : { id, ...allLegStats[i - 1] },
        )
        const result: FeatureCollection<LineString> = { type: 'FeatureCollection', features }
        routeCacheRef.current.set(cacheKey, { geoJSON: result, routeLegs: newRouteLegs })
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
