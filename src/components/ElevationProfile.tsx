import { useMemo } from 'react'
import { Mountains } from '@phosphor-icons/react'
import type { FeatureCollection, LineString } from 'geojson'
import styles from './ElevationProfile.module.css'

interface Props {
  geoJSON: FeatureCollection<LineString> | null
  visible: boolean
  sidebarOpen: boolean
  onToggle: () => void
}

const MAX_PTS = 600

function buildProfile(geoJSON: FeatureCollection<LineString>): number[] | null {
  const sorted = [...geoJSON.features].sort(
    (a, b) => (a.properties?.legIndex ?? 0) - (b.properties?.legIndex ?? 0),
  )
  const elevs: number[] = []
  for (const f of sorted) {
    for (const coord of f.geometry.coordinates as [number, number, number][]) {
      const z = coord[2]
      if (typeof z === 'number' && isFinite(z)) elevs.push(z)
    }
  }
  if (elevs.length < 2) return null
  if (elevs.length <= MAX_PTS) return elevs
  const step = elevs.length / MAX_PTS
  return Array.from({ length: MAX_PTS }, (_, i) => elevs[Math.floor(i * step)])
}

export default function ElevationProfile({ geoJSON, visible, sidebarOpen, onToggle }: Props) {
  const profile = useMemo(
    () => (geoJSON && geoJSON.features.length > 0 ? buildProfile(geoJSON) : null),
    [geoJSON],
  )

  if (!profile) return null

  const W = 1000
  const H = 64
  const PY = 4

  const minE = Math.min(...profile)
  const maxE = Math.max(...profile)
  const range = maxE - minE || 1

  const pts = profile.map((e, i) => {
    const x = (i / (profile.length - 1)) * W
    const y = PY + (1 - (e - minE) / range) * (H - PY * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  const linePoints = pts.join(' ')
  const areaPoints = `0,${H} ${linePoints} ${W},${H}`

  return (
    <div className={`${styles.wrap} ${sidebarOpen ? styles.wrapSidebarOpen : ''}`}>
      <div className={`${styles.chart} ${visible ? styles.chartVisible : ''}`}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className={styles.svg}
          aria-hidden
        >
          <defs>
            <linearGradient id="elev-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-checked)" stopOpacity="0.45" />
              <stop offset="100%" stopColor="var(--color-checked)" stopOpacity="0.04" />
            </linearGradient>
          </defs>
          <polygon points={areaPoints} fill="url(#elev-fill)" />
          <polyline
            points={linePoints}
            fill="none"
            stroke="var(--color-checked)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span className={styles.labelMin}>{Math.round(minE)} m</span>
        <span className={styles.labelMax}>{Math.round(maxE)} m</span>
      </div>
      <button
        className={`${styles.toggleBtn} ${visible ? styles.toggleBtnActive : ''}`}
        onClick={onToggle}
        aria-label={visible ? 'Hide elevation profile' : 'Show elevation profile'}
        title={visible ? 'Hide elevation profile' : 'Show elevation profile'}
      >
        <Mountains size={16} weight={visible ? 'fill' : 'regular'} />
      </button>
    </div>
  )
}
