import styles from './Counter.module.css'

interface Props {
  total: number
  visited: number
  onToggle: () => void
}

export default function Counter({ total, visited, onToggle }: Props) {
  return (
    <button
      className={styles.counter}
      onClick={onToggle}
      aria-label="Toggle playground list"
    >
      <span className={styles.icon}>≡</span>
      <span className={styles.count}>{visited}/{total}</span>
    </button>
  )
}
