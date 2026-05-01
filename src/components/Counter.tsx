import styles from './Counter.module.css'

interface Props {
  total: number
  visited: number
  onToggle: () => void
}

export default function Counter({ total, visited, onToggle }: Props) {
  return (
    <button className={styles.counter} onClick={onToggle} aria-label="Toggle playground list">
      ☰ {visited} / {total}
    </button>
  )
}
