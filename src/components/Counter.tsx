import styles from './Counter.module.css'

interface Props {
  total: number
  visited: number
}

export default function Counter({ total, visited }: Props) {
  return (
    <div className={styles.counter}>
      {visited} / {total} visited
    </div>
  )
}
