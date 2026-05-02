import type { RouteMode } from '../hooks/useRoute'
import styles from './Wordmark.module.css'

interface Props {
  total: number
  visited: number
  dark: boolean
  onToggleDark: () => void
  onToggleSidebar: () => void
  routeMode: RouteMode
  routeFetchState: 'idle' | 'loading' | 'ready' | 'error'
  onCycleRoute?: () => void
}

const ROUTE_ICONS: Record<RouteMode, string> = {
  off: '⬡',
  north: '↓',
  south: '↑',
  location: '⊙',
}

export default function Wordmark({
  total,
  visited,
  dark,
  onToggleDark,
  onToggleSidebar,
  routeMode,
  routeFetchState,
  onCycleRoute,
}: Props) {
  const isLoading = routeFetchState === 'loading'
  const routeIcon = isLoading ? '⟳' : routeFetchState === 'error' ? '✕' : ROUTE_ICONS[routeMode]

  return (
    <div className={styles.container}>
      <div className={styles.wordmarkStack}>
        <div className={styles.tourDe}>Tour de</div>
        <div className={styles.playground}>Playground</div>
      </div>
      <button
        className={styles.iconBtn}
        onClick={onToggleDark}
        aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {dark ? '☀︎' : '☾'}
      </button>
      <button
        className={styles.iconBtn}
        onClick={onToggleSidebar}
        aria-label="Toggle playground list"
      >
        <span className={styles.listIcon}>≡</span>
        <span className={styles.count}>{visited}/{total}</span>
      </button>
      {onCycleRoute && (
        <button
          className={`${styles.iconBtn} ${routeMode !== 'off' ? styles.iconBtnActive : ''} ${isLoading ? styles.iconBtnLoading : ''}`}
          onClick={onCycleRoute}
          aria-label={`Route start: ${routeMode}`}
          title={routeFetchState === 'error' ? 'Route unavailable' : undefined}
        >
          <span className={isLoading ? styles.spin : undefined}>
            {routeIcon}
          </span>
        </button>
      )}
    </div>
  )
}
