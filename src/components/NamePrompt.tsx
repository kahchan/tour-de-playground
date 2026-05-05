import { useState } from 'react'
import styles from './NamePrompt.module.css'

interface Props {
  onSubmit: (name: string) => void
  onClose: () => void
  initialName?: string
}

export default function NamePrompt({ onSubmit, onClose, initialName }: Props) {
  const [value, setValue] = useState(initialName ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (trimmed) onSubmit(trimmed)
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.title}>What's your name?</div>
        <div className={styles.subtitle}>
          Shown when you check off a playground.
        </div>
        <form onSubmit={handleSubmit}>
          <input
            className={styles.input}
            type="text"
            placeholder="e.g. Kah"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
            maxLength={30}
          />
          <button
            className={styles.saveBtn}
            type="submit"
            disabled={!value.trim()}
          >
            Save
          </button>
        </form>
      </div>
    </div>
  )
}
