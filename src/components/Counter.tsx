import { List } from '@phosphor-icons/react'
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
      <List size={18} weight="bold" />
      <span className={styles.count}>{visited}/{total}</span>
    </button>
  )
}
