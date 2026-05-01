import type { CheckIn, Playground } from '../types'
import styles from './MarkerPopup.module.css'

interface Props {
  playground: Playground
  checkIn: CheckIn | null
  yourName: string | null
  onCheckOff: () => void
  onClose: () => void
}

export default function MarkerPopup({
  playground,
  checkIn,
  yourName,
  onCheckOff,
  onClose,
}: Props) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <button
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <div className={styles.name}>{playground.name}</div>
        {checkIn ? (
          <div className={styles.checked}>✓ Visited by {checkIn.name}</div>
        ) : (
          <>
            {yourName && (
              <div className={styles.checkAs}>Checking as: {yourName}</div>
            )}
            <button className={styles.checkBtn} onClick={onCheckOff}>
              Check off!
            </button>
          </>
        )}
      </div>
    </div>
  )
}
