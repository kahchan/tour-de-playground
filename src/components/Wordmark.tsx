import { useState, useRef } from 'react'
import { List, NavigationArrow } from '@phosphor-icons/react'
import styles from './Wordmark.module.css'

const SPRING = 'transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)'

interface Props {
  total: number
  visited: number
  onToggleSidebar: () => void
  onLogoClick: () => void
  panDelta?: { x: number; y: number }
  mapMoving?: boolean
  showLocation: boolean
  onToggleLocation: () => void
}

export default function Wordmark({
  total,
  visited,
  onToggleSidebar,
  onLogoClick,
  panDelta = { x: 0, y: 0 },
  mapMoving = false,
  showLocation,
  onToggleLocation,
}: Props) {
  const [pressed, setPressed] = useState(false)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleLogoClick() {
    setPressed(true)
    if (pressTimer.current) clearTimeout(pressTimer.current)
    pressTimer.current = setTimeout(() => setPressed(false), 280)
    onLogoClick()
  }

  const tx = -panDelta.x * 0.09
  const ty = -panDelta.y * 0.06
  const pressRotate = pressed ? 1.5 : 0

  return (
    <div className={styles.container}>
      <button
        className={styles.wordmarkStack}
        onClick={handleLogoClick}
        aria-label="Rider profile"
        style={{
          transform: `translate(${tx}px, ${ty}px) rotate(${pressRotate}deg)`,
          transition: pressed ? 'transform 0.08s ease' : (mapMoving ? 'none' : SPRING),
        }}
      >
        <div
          className={styles.tourDe}
          style={{
            transform: `rotate(${mapMoving ? -4 : -2}deg)`,
            transition: mapMoving ? 'none' : SPRING,
          }}
        >
          Tour de
        </div>
        <div
          className={styles.playground}
          style={{
            transform: `rotate(${mapMoving ? 3.5 : 1.5}deg)`,
            transition: mapMoving ? 'none' : SPRING,
          }}
        >
          Playground
        </div>
      </button>
      <button
        className={styles.iconBtn}
        onClick={onToggleSidebar}
        aria-label="Toggle playground list"
      >
        <List size={18} weight="bold" />
        <span className={styles.count}>{visited}/{total}</span>
      </button>
      <button
        className={styles.iconBtn}
        onClick={onToggleLocation}
        aria-label={showLocation ? 'Hide my location' : 'Show my location'}
        data-active={showLocation || undefined}
      >
        <NavigationArrow size={18} weight={showLocation ? 'fill' : 'bold'} />
      </button>
    </div>
  )
}
