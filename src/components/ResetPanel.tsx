import { useState } from 'react'
import styles from './ResetPanel.module.css'

interface Props {
  onReset: (passphrase: string) => Promise<void>
}

export default function ResetPanel({ onReset }: Props) {
  const [value, setValue] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>(
    'idle',
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    try {
      await onReset(value.trim())
      setStatus('done')
    } catch {
      setStatus('error')
      setValue('')
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.title}>Reset all check-offs</div>
      {status === 'done' ? (
        <div className={styles.success}>✓ All check-offs cleared</div>
      ) : (
        <form onSubmit={handleSubmit}>
          <input
            className={styles.input}
            type="password"
            placeholder="Passphrase"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={status === 'loading'}
            autoFocus
          />
          <button
            className={styles.btn}
            type="submit"
            disabled={!value.trim() || status === 'loading'}
          >
            {status === 'loading' ? 'Resetting…' : 'Reset'}
          </button>
          {status === 'error' && (
            <div className={styles.error}>
              Wrong passphrase or server error.
            </div>
          )}
        </form>
      )}
    </div>
  )
}
