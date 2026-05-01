import { useState } from 'react'
import type { CheckIn, Playground } from '../types'
import styles from './Sidebar.module.css'

interface Props {
  playgrounds: Playground[]
  checkIns: CheckIn[]
  checkedIds: Set<string>
  isOpen: boolean
  onClose: () => void
  onSelect: (playground: Playground) => void
  isAdmin: boolean
  disabledIds: Set<string>
  onToggleDisabled: (id: string, on: boolean) => void
  onAdminReset: (passphrase: string) => Promise<void>
}

export default function Sidebar({
  playgrounds,
  checkIns,
  checkedIds,
  isOpen,
  onClose,
  onSelect,
  isAdmin,
  disabledIds,
  onToggleDisabled,
  onAdminReset,
}: Props) {
  const [resetConfirming, setResetConfirming] = useState(false)
  const [resetPassphrase, setResetPassphrase] = useState('')
  const [resetPending, setResetPending] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  const sorted = [...playgrounds].sort((a, b) => {
    const aDisabled = disabledIds.has(a.id)
    const bDisabled = disabledIds.has(b.id)
    if (isAdmin && aDisabled !== bDisabled) return aDisabled ? 1 : -1
    const aChecked = checkedIds.has(a.id)
    const bChecked = checkedIds.has(b.id)
    if (aChecked !== bChecked) return aChecked ? 1 : -1
    return a.name.localeCompare(b.name)
  })

  async function handleResetConfirm() {
    setResetPending(true)
    setResetError(null)
    try {
      await onAdminReset(resetPassphrase)
      setResetConfirming(false)
      setResetPassphrase('')
    } catch (e) {
      setResetError(e instanceof Error ? e.message : 'Reset failed')
    } finally {
      setResetPending(false)
    }
  }

  function handleResetCancel() {
    setResetConfirming(false)
    setResetPassphrase('')
    setResetError(null)
  }

  return (
    <>
      {isOpen && <div className={styles.backdrop} onClick={onClose} />}
      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
        <div className={styles.header}>
          <span className={styles.title}>
            Playgrounds{' '}
            <span className={styles.count}>
              {checkedIds.size} / {playgrounds.length}
            </span>
          </span>
          <div className={styles.headerActions}>
            {isAdmin && !resetConfirming && (
              <button
                className={styles.resetBtn}
                onClick={() => setResetConfirming(true)}
                title="Reset all check-offs and disabled flags"
              >
                Reset
              </button>
            )}
            <button
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Close sidebar"
            >
              ×
            </button>
          </div>
        </div>

        {resetConfirming && (
          <div className={styles.resetPanel}>
            <p className={styles.resetWarning}>
              Nukes all check-offs and disabled flags. Cannot be undone.
            </p>
            <input
              className={styles.resetInput}
              type="password"
              placeholder="Passphrase"
              value={resetPassphrase}
              onChange={(e) => setResetPassphrase(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleResetConfirm()}
              autoFocus
            />
            {resetError && <p className={styles.resetError}>{resetError}</p>}
            <div className={styles.resetActions}>
              <button
                className={styles.resetConfirmBtn}
                onClick={handleResetConfirm}
                disabled={resetPending || !resetPassphrase}
              >
                {resetPending ? 'Resetting…' : 'Confirm reset'}
              </button>
              <button
                className={styles.resetCancelBtn}
                onClick={handleResetCancel}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <ul className={styles.list}>
          {sorted.map((p) => {
            const checked = checkedIds.has(p.id)
            const disabled = disabledIds.has(p.id)
            const checkIn = checkIns.find((c) => c.id === p.id)
            return (
              <li key={p.id}>
                <div
                  className={[
                    styles.item,
                    checked ? styles.itemChecked : '',
                    isAdmin && disabled ? styles.itemDisabled : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <button
                    className={styles.itemMain}
                    onClick={() => !disabled && onSelect(p)}
                    disabled={disabled && !isAdmin}
                  >
                    <span
                      className={`${styles.dot} ${checked ? styles.dotChecked : ''}`}
                    >
                      {checked ? '✓' : ''}
                    </span>
                    <span className={styles.itemName}>{p.name}</span>
                    {isAdmin && disabled && (
                      <span className={styles.disabledBadge}>disabled</span>
                    )}
                    {checkIn && !disabled && (
                      <span className={styles.itemBy}>{checkIn.name}</span>
                    )}
                  </button>
                  {isAdmin && (
                    <button
                      className={
                        disabled ? styles.enableBtn : styles.disableBtn
                      }
                      onClick={() => onToggleDisabled(p.id, !disabled)}
                      title={
                        disabled
                          ? 'Enable this playground'
                          : 'Disable this playground'
                      }
                    >
                      {disabled ? 'Enable' : 'Disable'}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </aside>
    </>
  )
}
