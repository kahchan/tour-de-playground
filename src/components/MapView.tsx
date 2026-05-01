import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { FeatureCollection } from 'geojson'
import type { Playground } from '../types'
import styles from './MapView.module.css'

interface FlyToTarget {
  lat: number
  lng: number
}

interface Props {
  playgrounds: Playground[]
  checkedIds: Set<string>
  onMarkerClick: (playground: Playground) => void
  flyToTarget?: FlyToTarget | null
}

const WELLINGTON: [number, number] = [174.7762, -41.2865]

function toGeoJSON(playgrounds: Playground[], checkedIds: Set<string>): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: playgrounds.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { id: p.id, name: p.name, checked: checkedIds.has(p.id) },
    })),
  }
}

export default function MapView({ playgrounds, checkedIds, onMarkerClick, flyToTarget }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const onClickRef = useRef(onMarkerClick)
  const playgroundsRef = useRef(playgrounds)
  const [mapLoaded, setMapLoaded] = useState(false)

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
      style: `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${key}`,
      center: WELLINGTON,
      zoom: 12,
    })
    mapRef.current = map

    map.addControl(new maplibregl.NavigationControl(), 'top-right')

    map.on('load', () => {
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
          'circle-color': '#6366F1',
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
        filter: ['all', ['!', ['has', 'point_count']], ['!=', ['get', 'checked'], true]],
        paint: {
          'circle-radius': 9,
          'circle-color': '#3B82F6',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
        },
      })

      map.addLayer({
        id: 'checked',
        type: 'circle',
        source: 'playgrounds',
        filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'checked'], true]],
        paint: {
          'circle-radius': 11,
          'circle-color': '#22C55E',
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#fff',
        },
      })

      for (const layer of ['clusters', 'unchecked', 'checked']) {
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

      for (const layer of ['unchecked', 'checked']) {
        map.on('click', layer, (e) => {
          const feature = e.features?.[0]
          if (!feature) return
          const { id } = feature.properties as { id: string }
          const playground = playgroundsRef.current.find((p) => p.id === id)
          if (playground) onClickRef.current(playground)
        })
      }

      setMapLoaded(true)
    })

    return () => {
      setMapLoaded(false)
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return
    const source = mapRef.current.getSource('playgrounds') as maplibregl.GeoJSONSource | undefined
    source?.setData(toGeoJSON(playgrounds, checkedIds))
  }, [playgrounds, checkedIds, mapLoaded])

  useEffect(() => {
    if (!flyToTarget || !mapRef.current) return
    mapRef.current.flyTo({
      center: [flyToTarget.lng, flyToTarget.lat],
      zoom: Math.max(mapRef.current.getZoom(), 15),
      duration: 800,
    })
  }, [flyToTarget])

  return <div ref={containerRef} className={styles.map} />
}
