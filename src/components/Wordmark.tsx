import styles from './Wordmark.module.css'

interface Props {
  total: number
  visited: number
  dark: boolean
  onToggleDark: () => void
}

export default function Wordmark({ total, visited, dark, onToggleDark }: Props) {
  return (
    <div className={styles.container}>
      <div className={styles.wordmark}>
        <span className={styles.name}>Tour de Playground</span>
        <span className={styles.count}>{visited} / {total}</span>
      </div>
      <button
        className={styles.themeBtn}
        onClick={onToggleDark}
        aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {dark ? '☀︎' : '☾'}
      </button>
    </div>
  )
}
