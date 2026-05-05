import { List } from '@phosphor-icons/react'
import styles from './Wordmark.module.css'

interface Props {
  total: number
  visited: number
  onToggleSidebar: () => void
  onLogoClick: () => void
}

export default function Wordmark({ total, visited, onToggleSidebar, onLogoClick }: Props) {
  return (
    <div className={styles.container}>
      <button
        className={styles.wordmarkStack}
        onClick={onLogoClick}
        aria-label="Rider profile"
      >
        <div className={styles.tourDe}>Tour de</div>
        <div className={styles.playground}>Playground</div>
      </button>
      <button
        className={styles.iconBtn}
        onClick={onToggleSidebar}
        aria-label="Toggle playground list"
      >
        <List size={18} weight="bold" />
        <span className={styles.count}>{visited}/{total}</span>
      </button>
    </div>
  )
}
