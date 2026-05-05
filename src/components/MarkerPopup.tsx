import { X, Check } from '@phosphor-icons/react'
import type { CheckIn, Playground } from '../types'
import styles from './MarkerPopup.module.css'

interface Props {
  playground: Playground
  checkIn: CheckIn | null
  yourName: string | null
  onCheckOff: () => void
  onUndo: () => void
  onClose: () => void
}

export default function MarkerPopup({
  playground,
  checkIn,
  yourName,
  onCheckOff,
  onUndo,
  onClose,
}: Props) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <X size={18} weight="bold" />
        </button>
        <div className={styles.name}>{playground.name}</div>
        {checkIn ? (
          <>
            <div className={styles.checked}><Check size={14} weight="bold" /> Visited by {checkIn.name}</div>
            <button className={styles.undoBtn} onClick={onUndo}>
              Undo
            </button>
          </>
        ) : (
          <>
            {yourName && (
              <div className={styles.checkAs}>Checking as: {yourName}</div>
            )}
            <button className={styles.checkBtn} onClick={onCheckOff}>
              Mark done
            </button>
          </>
        )}
      </div>
    </div>
  )
}
