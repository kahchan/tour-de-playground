import styles from './NameBadge.module.css'

interface Props {
  name: string | null
  onChangeName: () => void
}

export default function NameBadge({ name, onChangeName }: Props) {
  return (
    <div className={styles.badge}>
      {name ? (
        <>
          Riding as <strong>{name}</strong>{' '}
          <button className={styles.changeBtn} onClick={onChangeName}>
            change
          </button>
        </>
      ) : (
        <button className={styles.changeBtn} onClick={onChangeName}>
          Set your name
        </button>
      )}
    </div>
  )
}
