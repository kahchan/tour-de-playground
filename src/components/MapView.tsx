import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { FeatureCollection, LineString } from 'geojson'
import type { Playground } from '../types'
import styles from './MapView.module.css'

interface Props {
  playgrounds: Playground[]
  checkedIds: Set<string>
  onMarkerClick: (playground: Playground) => void
  darkMode: boolean
  routeGeoJSON: FeatureCollection<LineString> | null
  routeOrder: string[]
  selectedId: string | null
  flyTarget: { lat: number; lng: number; seq: number } | null
}

const WELLINGTON: [number, number] = [174.7762, -41.2865]

function getStyleUrl(darkMode: boolean, key: string): string {
  return darkMode
    ? `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${key}`
    : `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${key}`
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
  darkMode: boolean,
) {
  const checkedColor = darkMode ? '#00c8d7' : '#00818c'
  const uncheckedColor = darkMode ? '#9b20d0' : '#6510a0'
  const routeColor = darkMode ? '#00c8d7' : '#00818c'

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
      'line-color': routeColor,
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
  darkMode,
  routeGeoJSON,
  routeOrder,
  selectedId,
  flyTarget,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const onClickRef = useRef(onMarkerClick)
  const playgroundsRef = useRef(playgrounds)
  const [mapLoaded, setMapLoaded] = useState(false)
  const mapReadyRef = useRef(false)

  useEffect(() => {
    onClickRef.current = onMarkerClick
  }, [onMarkerClick])

  useEffect(() => {
    playgroundsRef.current = playgrounds
  }, [playgrounds])

  useEffect(() => {
    if (!containerRef.current) return
    const key = import.meta.env.VITE_MAPTILER_KEY
    if (!key) {
      console.error('VITE_MAPTILER_KEY not set — add it to .env.local')
      return
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getStyleUrl(darkMode, key),
      center: WELLINGTON,
      zoom: 12,
    })
    mapRef.current = map

    map.addControl(new maplibregl.NavigationControl(), 'bottom-left')

    map.on('load', () => {
      addSourcesAndLayers(map, onClickRef, playgroundsRef, darkMode)
      mapReadyRef.current = true
      setMapLoaded(true)
    })

    return () => {
      mapReadyRef.current = false
      setMapLoaded(false)
      map.remove()
      mapRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mapReadyRef.current) return
    const map = mapRef.current
    if (!map) return
    const key = import.meta.env.VITE_MAPTILER_KEY
    if (!key) return

    mapReadyRef.current = false
    setMapLoaded(false)
    map.setStyle(getStyleUrl(darkMode, key))
    map.once('style.load', () => {
      addSourcesAndLayers(map, onClickRef, playgroundsRef, darkMode)
      mapReadyRef.current = true
      setMapLoaded(true)
    })
  }, [darkMode]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Fly to a playground when triggered from the sidebar
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !flyTarget) return
    mapRef.current.easeTo({
      center: [flyTarget.lng, flyTarget.lat],
      zoom: Math.max(mapRef.current.getZoom(), 15),
      duration: 500,
    })
  }, [flyTarget?.seq, mapLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

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

  return <div ref={containerRef} className={styles.map} />
}
