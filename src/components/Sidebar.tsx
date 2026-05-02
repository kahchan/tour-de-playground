import { useState, useMemo, useEffect, useRef } from 'react'
import type { CheckIn, Playground } from '../types'
import styles from './Sidebar.module.css'

interface Props {
  playgrounds: Playground[]
  checkIns: CheckIn[]
  checkedIds: Set<string>
  isOpen: boolean
  onClose: () => void
  isAdmin: boolean
  disabledIds: Set<string>
  onToggleDisabled: (id: string, on: boolean) => void
  onAdminReset: (passphrase: string) => Promise<void>
  highlight?: { id: string; seq: number } | null
  routeOrder?: string[]
}

interface SuburbGroup {
  suburb: string
  playgrounds: Playground[]
}

type Filter = 'all' | 'undone' | 'route'

export default function Sidebar({
  playgrounds,
  checkIns,
  checkedIds,
  isOpen,
  onClose,
  isAdmin,
  disabledIds,
  onToggleDisabled,
  onAdminReset,
  highlight,
  routeOrder,
}: Props) {
  const [expandedSuburbs, setExpandedSuburbs] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<Filter>('all')
  const [flashId, setFlashId] = useState<string | null>(null)
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map())
  const [resetConfirming, setResetConfirming] = useState(false)
  const [resetPassphrase, setResetPassphrase] = useState('')
  const [resetPending, setResetPending] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  // If routeOrder disappears, exit route filter
  useEffect(() => {
    if (filter === 'route' && (!routeOrder || routeOrder.length === 0)) {
      setFilter('all')
    }
  }, [routeOrder, filter])

  const suburbGroups = useMemo((): SuburbGroup[] => {
    const map = new Map<string, Playground[]>()
    for (const p of playgrounds) {
      const suburb = p.suburb ?? 'Unknown'
      if (!map.has(suburb)) map.set(suburb, [])
      map.get(suburb)!.push(p)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([suburb, pgs]) => ({
        suburb,
        playgrounds: [...pgs].sort((a, b) => a.name.localeCompare(b.name)),
      }))
  }, [playgrounds])

  // Route view: unchecked playgrounds in TSP order with position numbers
  const routeItems = useMemo(() => {
    if (!routeOrder) return []
    const pgMap = new Map(playgrounds.map((p) => [p.id, p]))
    return routeOrder
      .filter((id) => !checkedIds.has(id))
      .map((id, i) => ({ pos: i + 1, playground: pgMap.get(id) }))
      .filter((x): x is { pos: number; playground: Playground } => x.playground !== undefined)
  }, [routeOrder, playgrounds, checkedIds])

  useEffect(() => {
    if (suburbGroups.length > 0 && expandedSuburbs.size === 0) {
      setExpandedSuburbs(new Set(suburbGroups.map((g) => g.suburb)))
    }
  }, [suburbGroups]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!highlight) return
    const { id } = highlight
    if (filter === 'route') {
      setFilter('all')
    }
    const group = suburbGroups.find((g) => g.playgrounds.some((p) => p.id === id))
    if (!group) return
    setExpandedSuburbs((prev) => new Set([...prev, group.suburb]))
    setFlashId(id)
    const scrollTimer = setTimeout(() => {
      itemRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 80)
    const flashTimer = setTimeout(() => setFlashId(null), 1400)
    return () => {
      clearTimeout(scrollTimer)
      clearTimeout(flashTimer)
    }
  }, [highlight?.seq]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleSuburb(suburb: string) {
    setExpandedSuburbs((prev) => {
      const next = new Set(prev)
      if (next.has(suburb)) next.delete(suburb)
      else next.add(suburb)
      return next
    })
  }

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
          <div className={styles.headerText}>
            <span className={styles.title}>Playgrounds</span>
            <span className={styles.progress}>
              {checkedIds.size} / {playgrounds.length} done
            </span>
          </div>
          <div className={styles.headerActions}>
            <button
              className={`${styles.filterToggle} ${filter === 'undone' ? styles.filterToggleActive : ''}`}
              onClick={() => setFilter((f) => (f === 'undone' ? 'all' : 'undone'))}
              title={filter === 'undone' ? 'Show all playgrounds' : 'Show only undone'}
            >
              Undone
            </button>
            {routeOrder && routeOrder.length > 0 && (
              <button
                className={`${styles.filterToggle} ${filter === 'route' ? styles.filterToggleActive : ''}`}
                onClick={() => setFilter((f) => (f === 'route' ? 'all' : 'route'))}
                title={filter === 'route' ? 'Show all playgrounds' : 'Show in route order'}
              >
                Route
              </button>
            )}
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
              <button className={styles.resetCancelBtn} onClick={handleResetCancel}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className={styles.body}>
          {filter === 'route' ? (
            <ul className={styles.routeList}>
              {routeItems.map(({ pos, playground: p }) => {
                const checked = checkedIds.has(p.id)
                return (
                  <li key={p.id}>
                    <div className={`${styles.routeItem} ${checked ? styles.itemChecked : ''}`}>
                      <span className={styles.routePos}>{pos}</span>
                      <span className={styles.routeItemText}>
                        <span className={styles.itemName}>{p.name}</span>
                        {p.suburb && <span className={styles.itemSuburb}>{p.suburb}</span>}
                      </span>
                      <span className={`${styles.dot} ${checked ? styles.dotChecked : ''}`}>
                        {checked ? '✓' : ''}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            suburbGroups.map(({ suburb, playgrounds: pgs }) => {
              const checkedCount = pgs.filter((p) => checkedIds.has(p.id)).length
              const visiblePgs = filter === 'undone'
                ? pgs.filter((p) => !checkedIds.has(p.id))
                : pgs
              if (visiblePgs.length === 0) return null
              const isExpanded = expandedSuburbs.has(suburb)
              return (
                <div key={suburb} className={styles.suburbSection}>
                  <button
                    className={styles.suburbHeader}
                    onClick={() => toggleSuburb(suburb)}
                  >
                    <span
                      className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ''}`}
                    >
                      ›
                    </span>
                    <span className={styles.suburbName}>{suburb}</span>
                    <span className={styles.suburbCount}>
                      {checkedCount}/{pgs.length}
                    </span>
                  </button>
                  {isExpanded && (
                    <ul className={styles.suburbList}>
                      {visiblePgs.map((p) => {
                        const checked = checkedIds.has(p.id)
                        const disabled = disabledIds.has(p.id)
                        const checkIn = checkIns.find((c) => c.id === p.id)
                        return (
                          <li
                            key={p.id}
                            ref={(el) => {
                              if (el) itemRefs.current.set(p.id, el)
                              else itemRefs.current.delete(p.id)
                            }}
                          >
                            <div
                              className={[
                                styles.item,
                                checked ? styles.itemChecked : '',
                                isAdmin && disabled ? styles.itemDisabled : '',
                                flashId === p.id ? styles.itemFlash : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                            >
                              <div className={styles.itemMain}>
                                <span
                                  className={`${styles.dot} ${checked ? styles.dotChecked : ''}`}
                                >
                                  {checked ? '✓' : ''}
                                </span>
                                <span className={styles.itemName}>{p.name}</span>
                                {isAdmin && disabled && (
                                  <span className={styles.disabledBadge}>
                                    disabled
                                  </span>
                                )}
                                {checkIn && !disabled && (
                                  <span className={styles.itemBy}>
                                    {checkIn.name}
                                  </span>
                                )}
                              </div>
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
                  )}
                </div>
              )
            })
          )}
        </div>
      </aside>
    </>
  )
}
