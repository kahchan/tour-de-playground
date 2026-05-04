import styles from './Wordmark.module.css'

interface Props {
  total: number
  visited: number
  onToggleSidebar: () => void
}

export default function Wordmark({ total, visited, onToggleSidebar }: Props) {
  return (
    <div className={styles.container}>
      <div className={styles.wordmarkStack}>
        <div className={styles.tourDe}>Tour de</div>
        <div className={styles.playground}>Playground</div>
      </div>
      <button
        className={styles.iconBtn}
        onClick={onToggleSidebar}
        aria-label="Toggle playground list"
      >
        <span className={styles.listIcon}>≡</span>
        <span className={styles.count}>{visited}/{total}</span>
      </button>
    </div>
  )
}
