import type { CheckIn, Playground } from '../types'
import styles from './Sidebar.module.css'

interface Props {
  playgrounds: Playground[]
  checkIns: CheckIn[]
  checkedIds: Set<string>
  isOpen: boolean
  onClose: () => void
  onSelect: (playground: Playground) => void
}

export default function Sidebar({
  playgrounds,
  checkIns,
  checkedIds,
  isOpen,
  onClose,
  onSelect,
}: Props) {
  const sorted = [...playgrounds].sort((a, b) => {
    const aChecked = checkedIds.has(a.id)
    const bChecked = checkedIds.has(b.id)
    if (aChecked !== bChecked) return aChecked ? 1 : -1
    return a.name.localeCompare(b.name)
  })

  return (
    <>
      {isOpen && <div className={styles.backdrop} onClick={onClose} />}
      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
        <div className={styles.header}>
          <span className={styles.title}>
            Playgrounds{' '}
            <span className={styles.count}>
              {checkedIds.size} / {playgrounds.length}
            </span>
          </span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close sidebar">
            ×
          </button>
        </div>
        <ul className={styles.list}>
          {sorted.map((p) => {
            const checked = checkedIds.has(p.id)
            const checkIn = checkIns.find((c) => c.id === p.id)
            return (
              <li key={p.id}>
                <button
                  className={`${styles.item} ${checked ? styles.itemChecked : ''}`}
                  onClick={() => onSelect(p)}
                >
                  <span className={`${styles.dot} ${checked ? styles.dotChecked : ''}`}>
                    {checked ? '✓' : ''}
                  </span>
                  <span className={styles.itemName}>{p.name}</span>
                  {checkIn && <span className={styles.itemBy}>{checkIn.name}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      </aside>
    </>
  )
}
