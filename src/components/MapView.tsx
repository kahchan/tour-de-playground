import { useCallback, useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { FeatureCollection, LineString } from 'geojson'
import type { Playground } from '../types'
import styles from './MapView.module.css'

import type { MapTheme } from '../hooks/useDarkMode'

interface Props {
  playgrounds: Playground[]
  checkedIds: Set<string>
  onMarkerClick: (playground: Playground) => void
  mapTheme: MapTheme
  routeGeoJSON: FeatureCollection<LineString> | null
  routeOrder: string[]
  selectedId: string | null
  flyTarget: { lat: number; lng: number; nextLat?: number; nextLng?: number; legIndex?: number; seq: number } | null
  onPanChange?: (delta: { x: number; y: number }, moving: boolean) => void
  showLocation: boolean
  onLocationOff?: () => void
}

const WELLINGTON: [number, number] = [174.7762, -41.2865]

function getStyleUrl(mapTheme: MapTheme, key: string): string {
  if (mapTheme === 'satellite') return `https://api.maptiler.com/maps/hybrid/style.json?key=${key}`
  if (mapTheme === 'dark') return `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${key}`
  return `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${key}`
}

function toGeoJSON(
  playgrounds: Playground[],
  checkedIds: Set<string>,
  routeOrder: string[],
): FeatureCollection {
  const posMap = new Map(routeOrder.map((id, i) => [id, i + 1]))
  return {
    type: 'FeatureCollection',
    features: playgrounds.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: {
        id: p.id,
        name: p.name,
        checked: checkedIds.has(p.id),
        routePos: posMap.get(p.id) ?? 0,
      },
    })),
  }
}

function addSourcesAndLayers(
  map: maplibregl.Map,
  onClickRef: React.RefObject<(playground: Playground) => void>,
  playgroundsRef: React.RefObject<Playground[]>,
  mapTheme: MapTheme,
) {
  const darkColors = mapTheme !== 'light'
  const checkedColor = darkColors ? '#00c8d7' : '#00818c'
  const uncheckedColor = darkColors ? '#9b20d0' : '#6510a0'
  const routeColor = darkColors ? '#00c8d7' : '#00818c'
  const mtbColor = darkColors ? '#9b20d0' : '#6510a0'

  map.addSource('route', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })

  map.addLayer({
    id: 'route-line',
    type: 'line',
    source: 'route',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': ['case', ['==', ['get', 'isTrail'], true], mtbColor, routeColor],
      'line-width': 3,
      'line-opacity': 0.5,
    },
  })

  map.addSource('playgrounds', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 50,
  })

  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'playgrounds',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': checkedColor,
      'circle-radius': ['step', ['get', 'point_count'], 18, 10, 24, 30, 30],
      'circle-opacity': 0.9,
    },
  })

  map.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: 'playgrounds',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': '{point_count_abbreviated}',
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-size': 13,
    },
    paint: { 'text-color': '#fff' },
  })

  map.addLayer({
    id: 'unchecked',
    type: 'circle',
    source: 'playgrounds',
    filter: [
      'all',
      ['!', ['has', 'point_count']],
      ['!=', ['get', 'checked'], true],
    ],
    paint: {
      'circle-radius': 9,
      'circle-color': uncheckedColor,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff',
    },
  })

  map.addLayer({
    id: 'checked',
    type: 'circle',
    source: 'playgrounds',
    filter: [
      'all',
      ['!', ['has', 'point_count']],
      ['==', ['get', 'checked'], true],
    ],
    paint: {
      'circle-radius': 11,
      'circle-color': checkedColor,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff',
      'circle-opacity': 0.6,
      'circle-stroke-opacity': 0.6,
    },
  })

  map.addLayer({
    id: 'checked-tick',
    type: 'symbol',
    source: 'playgrounds',
    filter: [
      'all',
      ['!', ['has', 'point_count']],
      ['==', ['get', 'checked'], true],
    ],
    layout: {
      'text-field': '✓',
      'text-size': 11,
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
    },
    paint: { 'text-color': '#fff', 'text-opacity': 0.8 },
  })

  // Route order numbers — shown on unchecked markers when a route is active
  map.addLayer({
    id: 'route-number',
    type: 'symbol',
    source: 'playgrounds',
    filter: [
      'all',
      ['!', ['has', 'point_count']],
      ['!=', ['get', 'checked'], true],
      ['>', ['get', 'routePos'], 0],
    ],
    layout: {
      'text-field': ['to-string', ['get', 'routePos']],
      'text-size': 9,
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
    },
    paint: { 'text-color': '#fff' },
  })

  map.addSource('user-location', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })

  map.addLayer({
    id: 'user-location-accuracy',
    type: 'circle',
    source: 'user-location',
    paint: {
      'circle-radius': ['coalesce', ['get', 'accuracyPx'], 0],
      'circle-color': '#2c7ef7',
      'circle-opacity': 0.12,
      'circle-stroke-width': 1,
      'circle-stroke-color': '#2c7ef7',
      'circle-stroke-opacity': 0.25,
    },
  })

  map.addLayer({
    id: 'user-location-dot',
    type: 'circle',
    source: 'user-location',
    paint: {
      'circle-radius': 8,
      'circle-color': '#2c7ef7',
      'circle-stroke-width': 2.5,
      'circle-stroke-color': '#fff',
    },
  })

  for (const layer of ['clusters', 'unchecked', 'checked', 'checked-tick', 'route-number']) {
    map.on('mouseenter', layer, () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', layer, () => {
      map.getCanvas().style.cursor = ''
    })
  }

  map.on('click', 'clusters', (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })
    if (!features.length) return
    const clusterId = features[0].properties.cluster_id as number
    const source = map.getSource('playgrounds') as maplibregl.GeoJSONSource
    const coords = (features[0].geometry as GeoJSON.Point).coordinates as [number, number]
    source.getClusterExpansionZoom(clusterId).then((zoom) => {
      map.easeTo({ center: coords, zoom })
    })
  })

  for (const layer of ['unchecked', 'checked', 'checked-tick', 'route-number']) {
    map.on('click', layer, (e) => {
      const feature = e.features?.[0]
      if (!feature) return
      const { id } = feature.properties as { id: string }
      const playground = playgroundsRef.current?.find((p) => p.id === id)
      if (playground) onClickRef.current?.(playground)
    })
  }
}

export default function MapView({
  playgrounds,
  checkedIds,
  onMarkerClick,
  mapTheme,
  routeGeoJSON,
  routeOrder,
  selectedId,
  flyTarget,
  onPanChange,
  showLocation,
  onLocationOff,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const onClickRef = useRef(onMarkerClick)
  const playgroundsRef = useRef(playgrounds)
  const checkedIdsRef = useRef(checkedIds)
  const routeOrderRef = useRef(routeOrder)
  const routeGeoJSONRef = useRef(routeGeoJSON)
  const mapThemeRef = useRef(mapTheme)
  const onPanChangeRef = useRef(onPanChange)
  const [mapLoaded, setMapLoaded] = useState(false)
  const mapReadyRef = useRef(false)
  const [dropPos, setDropPos] = useState<{ x: number; y: number; key: number } | null>(null)
  const dropTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => { onClickRef.current = onMarkerClick }, [onMarkerClick])
  useEffect(() => { onPanChangeRef.current = onPanChange }, [onPanChange])
  useEffect(() => { playgroundsRef.current = playgrounds }, [playgrounds])
  useEffect(() => { checkedIdsRef.current = checkedIds }, [checkedIds])
  useEffect(() => { routeOrderRef.current = routeOrder }, [routeOrder])
  useEffect(() => { routeGeoJSONRef.current = routeGeoJSON }, [routeGeoJSON])
  // Must be defined before the theme setStyle effect so the ref is current when style.load fires
  useEffect(() => { mapThemeRef.current = mapTheme }, [mapTheme])

  useEffect(() => {
    if (!containerRef.current) return
    const key = import.meta.env.VITE_MAPTILER_KEY
    if (!key) {
      console.error('VITE_MAPTILER_KEY not set — add it to .env.local')
      return
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getStyleUrl(mapTheme, key),
      center: WELLINGTON,
      zoom: 12,
    })
    mapRef.current = map

    map.addControl(new maplibregl.NavigationControl(), 'bottom-left')

    // Persistent listener — fires on initial load and after every setStyle() call.
    // Guard on layers (not sources) because setStyle diff-mode keeps user sources but removes all layers.
    map.on('style.load', () => {
      if (!map.getLayer('route-line')) {
        addSourcesAndLayers(map, onClickRef, playgroundsRef, mapThemeRef.current)
      }
      ;(map.getSource('playgrounds') as maplibregl.GeoJSONSource)
        ?.setData(toGeoJSON(playgroundsRef.current, checkedIdsRef.current, routeOrderRef.current))
      ;(map.getSource('route') as maplibregl.GeoJSONSource)
        ?.setData(routeGeoJSONRef.current ?? { type: 'FeatureCollection', features: [] })
      mapReadyRef.current = true
      setMapLoaded(true)
    })

    let startLngLat: maplibregl.LngLat | null = null
    const clamp = (v: number, max: number) => Math.max(-max, Math.min(max, v))

    map.on('movestart', () => {
      startLngLat = map.getCenter()
    })
    map.on('move', () => {
      if (!startLngLat) return
      const container = map.getContainer()
      const cx = container.clientWidth / 2
      const cy = container.clientHeight / 2
      const sp = map.project(startLngLat)
      onPanChangeRef.current?.(
        { x: clamp(sp.x - cx, 80), y: clamp(sp.y - cy, 60) },
        true,
      )
    })
    map.on('moveend', () => {
      startLngLat = null
      onPanChangeRef.current?.({ x: 0, y: 0 }, false)
    })

    return () => {
      mapReadyRef.current = false
      setMapLoaded(false)
      map.remove()
      mapRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Theme change — swap the style; { diff: false } forces a clean wipe of all sources + layers
  // so the style.load handler can safely re-add everything without source-already-exists errors.
  useEffect(() => {
    const map = mapRef.current
    const key = import.meta.env.VITE_MAPTILER_KEY
    if (!map || !key || !mapReadyRef.current) return
    mapReadyRef.current = false
    setMapLoaded(false)
    map.setStyle(getStyleUrl(mapTheme, key), { diff: false })
  }, [mapTheme]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return
    const source = mapRef.current.getSource('playgrounds') as
      | maplibregl.GeoJSONSource
      | undefined
    source?.setData(toGeoJSON(playgrounds, checkedIds, routeOrder))
  }, [playgrounds, checkedIds, routeOrder, mapLoaded])

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return
    const source = mapRef.current.getSource('route') as
      | maplibregl.GeoJSONSource
      | undefined
    source?.setData(
      routeGeoJSON ?? { type: 'FeatureCollection', features: [] },
    )
  }, [routeGeoJSON, mapLoaded])

  // Fly to a playground when triggered from the sidebar.
  // If a next-stop is provided (route list click), fit both markers in view with
  // sidebar-aware padding so neither is hidden behind the panel.
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !flyTarget) return
    const map = mapRef.current

    if (flyTarget.nextLat !== undefined && flyTarget.nextLng !== undefined) {
      const isDesktop = window.innerWidth >= 640
      // Mobile bottom padding = sidebar height (350px) + 1rem margin (16px) + 20px buffer
      const padding = isDesktop
        ? { top: 80, bottom: 80, left: 80, right: 392 }
        : { top: 60, bottom: 386, left: 20, right: 20 }

      let minLng = Math.min(flyTarget.lng, flyTarget.nextLng)
      let maxLng = Math.max(flyTarget.lng, flyTarget.nextLng)
      let minLat = Math.min(flyTarget.lat, flyTarget.nextLat)
      let maxLat = Math.max(flyTarget.lat, flyTarget.nextLat)

      if (flyTarget.legIndex !== undefined) {
        const legFeature = routeGeoJSONRef.current?.features.find(
          (f) => f.properties?.legIndex === flyTarget.legIndex,
        )
        if (legFeature) {
          for (const [lng, lat] of legFeature.geometry.coordinates as [number, number][]) {
            if (lng < minLng) minLng = lng
            if (lng > maxLng) maxLng = lng
            if (lat < minLat) minLat = lat
            if (lat > maxLat) maxLat = lat
          }
        }
      }

      map.fitBounds(
        [[minLng, minLat], [maxLng, maxLat]],
        { padding, maxZoom: 16, duration: 600 },
      )
    } else {
      map.easeTo({
        center: [flyTarget.lng, flyTarget.lat],
        zoom: Math.max(map.getZoom(), 15),
        duration: 500,
      })
    }
  }, [flyTarget?.seq, mapLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  // Pin-drop bounce animation when a marker is clicked on the map.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return
    const layers = ['unchecked', 'checked', 'checked-tick', 'route-number']
    const handler = (e: maplibregl.MapLayerMouseEvent) => {
      if (dropTimerRef.current) clearTimeout(dropTimerRef.current)
      setDropPos({ x: e.point.x, y: e.point.y, key: Date.now() })
      dropTimerRef.current = setTimeout(() => setDropPos(null), 900)
    }
    for (const layer of layers) map.on('click', layer, handler)
    return () => {
      for (const layer of layers) map.off('click', layer, handler)
      if (dropTimerRef.current) clearTimeout(dropTimerRef.current)
    }
  }, [mapLoaded])

  // Drive per-leg opacity: highlight the leg starting at the selected playground.
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return
    const map = mapRef.current
    if (!map.getLayer('route-line')) return
    const nextLegIndex =
      selectedId && routeOrder.length > 0 ? routeOrder.indexOf(selectedId) : -1

    if (nextLegIndex === -1) {
      map.setPaintProperty('route-line', 'line-opacity', 0.5)
    } else {
      map.setPaintProperty('route-line', 'line-opacity', [
        'case',
        ['==', ['get', 'legIndex'], nextLegIndex],
        0.85,
        0.35,
      ])
    }
  }, [selectedId, routeOrder, mapLoaded])

  useEffect(() => {
    const source = () =>
      mapRef.current?.getSource('user-location') as maplibregl.GeoJSONSource | undefined

    if (!mapLoaded) return

    if (!showLocation) {
      source()?.setData({ type: 'FeatureCollection', features: [] })
      return
    }

    if (!navigator.geolocation) return

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const map = mapRef.current
        if (!map) return
        // Convert accuracy (metres) to approximate pixels at current zoom/lat
        const metersPerPx =
          (156543.03392 * Math.cos((pos.coords.latitude * Math.PI) / 180)) /
          Math.pow(2, map.getZoom())
        const accuracyPx = pos.coords.accuracy / metersPerPx
        source()?.setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [pos.coords.longitude, pos.coords.latitude],
              },
              properties: { accuracyPx },
            },
          ],
        })
      },
      () => {
        source()?.setData({ type: 'FeatureCollection', features: [] })
        onLocationOff?.()
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [showLocation, mapLoaded])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }, [])

  const handleMouseLeave = useCallback(() => setCursorPos(null), [])

  return (
    <div
      className={styles.mapWrapper}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div ref={containerRef} className={styles.map} />
      {cursorPos && (
        <div
          className={styles.cursorHint}
          style={{ left: cursorPos.x + 18, top: cursorPos.y - 14 }}
        >
          Click a playground
        </div>
      )}
      {dropPos && (
        <div
          key={dropPos.key}
          className={styles.dropAnim}
          style={{ left: dropPos.x, top: dropPos.y }}
        >
          <div className={styles.dropDot} />
          <div className={styles.dropRing} />
        </div>
      )}
    </div>
  )
}
