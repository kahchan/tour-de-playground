import { useCallback, useEffect, useRef, useState } from 'react'
import type { FeatureCollection, LineString } from 'geojson'
import type { Playground } from '../types'
import { nearestNeighbour, pickStart } from '../lib/tsp'

export type RouteMode = 'off' | 'north' | 'south' | 'location'
type FetchState = 'idle' | 'loading' | 'ready' | 'error'

const MODE_CYCLE: RouteMode[] = ['off', 'north', 'south', 'location']
const ORS_URL = 'https://api.openrouteservice.org/v2/directions/cycling-mountain/geojson'
const CHUNK_SIZE = 50

// Overlapping chunks so each chunk boundary shares its endpoint with the next,
// ensuring no route gap between chunks.
function chunkOverlapping<T>(arr: T[], size: number): T[][] {
  if (arr.length < 2) return []
  const chunks: T[][] = []
  const step = size - 1
  for (let i = 0; i < arr.length - 1; i += step) {
    chunks.push(arr.slice(i, Math.min(i + size, arr.length)))
  }
  return chunks
}

// Returns per-leg coordinate arrays for a single ORS chunk request.
// ORS way_points gives the coordinate index for each input waypoint, letting us
// cleanly slice the LineString into one segment per leg.
async function fetchChunk(
  waypoints: { lat: number; lng: number }[],
  key: string,
  signal: AbortSignal,
): Promise<[number, number][][]> {
  const res = await fetch(ORS_URL, {
    method: 'POST',
    headers: { Authorization: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ coordinates: waypoints.map((p) => [p.lng, p.lat]) }),
    signal,
  })
  if (!res.ok) throw new Error(`ORS ${res.status}`)
  const data = await res.json()
  const coords: [number, number][] = data.features[0].geometry.coordinates
  const wayPts: number[] = data.features[0].properties.way_points
  const legs: [number, number][][] = []
  for (let i = 0; i < wayPts.length - 1; i++) {
    legs.push(coords.slice(wayPts[i], wayPts[i + 1] + 1))
  }
  return legs
}

export function useRoute(uncheckedPlaygrounds: Playground[]) {
  const [mode, setMode] = useState<RouteMode>('off')
  const [fetchState, setFetchState] = useState<FetchState>('idle')
  const [geoJSON, setGeoJSON] = useState<FeatureCollection<LineString> | null>(null)
  const [orderedIds, setOrderedIds] = useState<string[]>([])

  const cacheRef = useRef<Map<string, FeatureCollection<LineString>>>(new Map())
  const abortRef = useRef<AbortController | null>(null)

  const cycle = useCallback(() => {
    setMode((m) => {
      const idx = MODE_CYCLE.indexOf(m)
      return MODE_CYCLE[(idx + 1) % MODE_CYCLE.length]
    })
  }, [])

  useEffect(() => {
    if (mode === 'off') {
      abortRef.current?.abort()
      setFetchState('idle')
      setGeoJSON(null)
      setOrderedIds([])
      return
    }

    const orsKey = import.meta.env.VITE_ORS_KEY
    if (!orsKey || uncheckedPlaygrounds.length < 2) {
      setFetchState('idle')
      setGeoJSON(null)
      setOrderedIds([])
      return
    }

    if (mode === 'location') {
      if (!navigator.geolocation) {
        setMode('off')
        return
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => runRoute({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setMode('off'),
        { timeout: 8000 },
      )
      return
    }

    runRoute(undefined)

    function runRoute(userPos: { lat: number; lng: number } | undefined) {
      const start = pickStart(uncheckedPlaygrounds, mode as 'north' | 'south' | 'location', userPos)
      const ordered = nearestNeighbour(uncheckedPlaygrounds, start)
      const ids = ordered.map((p) => p.id)
      const cacheKey = mode + ':' + ids.join(',')

      setOrderedIds(ids)

      const cached = cacheRef.current.get(cacheKey)
      if (cached) {
        setGeoJSON(cached)
        setFetchState('ready')
        return
      }

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setFetchState('loading')

      const chunks = chunkOverlapping(ordered, CHUNK_SIZE)

      Promise.all(chunks.map((chunk) => fetchChunk(chunk, orsKey, controller.signal)))
        .then((chunkLegs) => {
          // Build one Feature per leg with a global legIndex so MapView can
          // highlight individual segments (e.g. next leg from selected playground).
          let legIndex = 0
          const features = chunkLegs.flatMap((legs) =>
            legs.map((legCoords) => ({
              type: 'Feature' as const,
              geometry: { type: 'LineString' as const, coordinates: legCoords },
              properties: { legIndex: legIndex++ },
            })),
          )
          const result: FeatureCollection<LineString> = {
            type: 'FeatureCollection',
            features,
          }
          cacheRef.current.set(cacheKey, result)
          setGeoJSON(result)
          setFetchState('ready')
        })
        .catch((err) => {
          if (err.name === 'AbortError') return
          console.error('Route fetch failed:', err)
          setFetchState('error')
        })
    }
  }, [mode, uncheckedPlaygrounds])

  return { mode, cycle, fetchState, geoJSON, orderedIds }
}
