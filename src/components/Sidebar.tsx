import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Sun, Moon, GlobeHemisphereWest, X, Check,
  CaretRight, ArrowDown, ArrowUp, Crosshair,
  ArrowsClockwise, NavigationArrow, Flag,
  ArrowBendDownLeft, ArrowBendDownRight, ArrowUDownLeft,
  DownloadSimple,
} from '@phosphor-icons/react'

import type { CheckIn, Playground } from '../types'
import type { RouteMode, LegStat, RouteStep } from '../hooks/useRoute'
import styles from './Sidebar.module.css'

interface Props {
  playgrounds: Playground[]
  checkIns: CheckIn[]
  checkedIds: Set<string>
  isOpen: boolean
  onClose: () => void
  onSelectPlayground: (p: Playground) => void
  selectedId: string | null
  onCheckOff: (id: string) => void
  onUndo: (id: string) => void
  isAdmin: boolean
  disabledIds: Set<string>
  onToggleDisabled: (id: string, on: boolean) => void
  onAdminReset: (passphrase: string) => Promise<void>
  onOpenCurate?: () => void
  highlight?: { id: string; seq: number } | null
  routeOrder?: string[]
  pinnedEndId: string | null
  onTogglePinEnd: (id: string) => void
  pinnedStartId: string | null
  onTogglePinStart: (id: string) => void
  dark: boolean
  onToggleDark: () => void
  satellite: boolean
  onToggleSatellite: () => void
  routeMode?: RouteMode
  routeFetchState?: 'idle' | 'loading' | 'ready' | 'error'
  onSetRouteMode?: (mode: RouteMode) => void
  routeLegs?: LegStat[]
  onExportRoute?: () => void
}

interface SuburbGroup {
  suburb: string
  playgrounds: Playground[]
}

type Filter = 'all' | 'undone' | 'route'

function fmtKm(m: number) {
  return (m / 1000).toFixed(1) + ' km'
}

function fmtElev(m: number) {
  return Math.round(m) + ' m↑'
}

function fmtDist(m: number): string {
  if (m < 950) return Math.round(m / 5) * 5 + ' m'
  return (m / 1000).toFixed(1) + ' km'
}

function stepIcon(step: RouteStep) {
  const p = { size: 13 } as const
  switch (step.type) {
    case 0: case 2: case 4: case 12: return <ArrowBendDownLeft {...p} />
    case 1: case 3: case 5: case 13: return <ArrowBendDownRight {...p} />
    case 6: return <ArrowUp {...p} />
    case 7: case 8: return <ArrowsClockwise {...p} />
    case 9: return <ArrowUDownLeft {...p} />
    case 10: return <Flag {...p} weight="fill" />
    case 11: return <NavigationArrow {...p} weight="fill" />
    default: return <ArrowUp {...p} />
  }
}

export default function Sidebar({
  playgrounds,
  checkIns,
  checkedIds,
  isOpen,
  onClose,
  onSelectPlayground,
  selectedId,
  onCheckOff,
  onUndo,
  isAdmin,
  disabledIds,
  onToggleDisabled,
  onAdminReset,
  onOpenCurate,
  highlight,
  routeOrder,
  pinnedEndId,
  onTogglePinEnd,
  pinnedStartId,
  onTogglePinStart,
  dark,
  onToggleDark,
  satellite,
  onToggleSatellite,
  routeMode = 'off',
  routeFetchState = 'idle',
  onSetRouteMode,
  routeLegs,
  onExportRoute,
}: Props) {
  const [expandedSuburbs, setExpandedSuburbs] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<Filter>(() => {
    const saved = localStorage.getItem('tdp:sidebar-filter') as Filter | null
    return saved === 'undone' || saved === 'route' ? saved : 'all'
  })
  const [flashId, setFlashId] = useState<string | null>(null)
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map())
  const [resetConfirming, setResetConfirming] = useState(false)
  const [resetPassphrase, setResetPassphrase] = useState('')
  const [resetPending, setResetPending] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  function updateFilter(f: Filter) {
    setFilter(f)
    localStorage.setItem('tdp:sidebar-filter', f)
  }

  // If routeOrder disappears, exit route filter
  useEffect(() => {
    if (filter === 'route' && (!routeOrder || routeOrder.length === 0)) {
      updateFilter('all')
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

  // Route view: full frozen sequence with checked items dimmed
  const routeItems = useMemo(() => {
    if (!routeOrder) return []
    const pgMap = new Map(playgrounds.map((p) => [p.id, p]))
    return routeOrder
      .map((id, i) => ({ pos: i + 1, playground: pgMap.get(id), legIdx: i }))
      .filter((x): x is { pos: number; playground: Playground; legIdx: number } => x.playground !== undefined)
  }, [routeOrder, playgrounds])

  const routeLegMap = useMemo(() => {
    if (!routeLegs) return new Map<string, LegStat>()
    return new Map(routeLegs.map((l) => [l.id, l]))
  }, [routeLegs])

  // Running cumulative elevation — lets you verify the total by reading the last row
  const routeItemsWithCumulative = useMemo(() => {
    let cumElev = 0
    return routeItems.map((item) => {
      const stat = routeLegMap.get(item.playground.id)
      cumElev += stat?.elevationGain ?? 0
      return { ...item, cumElev }
    })
  }, [routeItems, routeLegMap])

  const { totalDistance, totalElevation, remainingCount } = useMemo(() => {
    if (!routeLegs || routeLegs.length === 0) return { totalDistance: 0, totalElevation: 0, remainingCount: 0 }
    const unchecked = routeItems.filter(({ playground: p }) => !checkedIds.has(p.id))
    const total = routeLegs.reduce(
      (acc, l) => ({ distance: acc.distance + l.distance, elevation: acc.elevation + l.elevationGain }),
      { distance: 0, elevation: 0 },
    )
    return { totalDistance: total.distance, totalElevation: total.elevation, remainingCount: unchecked.length }
  }, [routeLegs, routeItems, checkedIds])

  useEffect(() => {
    if (suburbGroups.length > 0 && expandedSuburbs.size === 0) {
      setExpandedSuburbs(new Set(suburbGroups.map((g) => g.suburb)))
    }
  }, [suburbGroups]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!highlight) return
    const { id } = highlight

    const inRoute = routeOrder?.includes(id) ?? false
    const isChecked = checkedIds.has(id)
    const stayingInRoute = filter === 'route' && inRoute

    if (filter === 'route' && !inRoute) {
      updateFilter('all')
    } else if (filter === 'undone' && isChecked) {
      updateFilter('all')
    }

    if (!stayingInRoute) {
      const group = suburbGroups.find((g) => g.playgrounds.some((p) => p.id === id))
      if (group) setExpandedSuburbs((prev) => new Set([...prev, group.suburb]))
    }

    setFlashId(id)
    const scrollTimer = setTimeout(() => {
      itemRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
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

  const isRouteLoading = routeFetchState === 'loading'
  const isRouteError = routeFetchState === 'error'
  const routeOn = routeMode !== 'off'
  const isCustomRoute = !!(pinnedStartId && pinnedEndId)

  const ThemeIcon = dark ? Moon : Sun
  const themeLabel = dark ? 'Switch to light mode' : 'Switch to dark mode'

  return (
    <>
      {isOpen && <div className={styles.backdrop} onClick={onClose} />}
      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
        <div className={styles.header}>
          <div className={styles.headerRow1}>
            <div className={styles.headerText}>
              <span className={styles.title}>Playgrounds</span>
              <span className={styles.progress}>
                {checkedIds.size} / {playgrounds.length} done
              </span>
            </div>
            <div className={styles.headerIcons}>
              <button
                className={styles.themeBtn}
                onClick={onToggleDark}
                aria-label={themeLabel}
              >
                <ThemeIcon size={18} weight="fill" />
              </button>
              <button
                className={`${styles.themeBtn} ${satellite ? styles.themeBtnActive : ''}`}
                onClick={onToggleSatellite}
                aria-label={satellite ? 'Switch to map view' : 'Switch to satellite view'}
              >
                <GlobeHemisphereWest size={18} weight={satellite ? 'fill' : 'regular'} />
              </button>
              <button
                className={styles.closeBtn}
                onClick={onClose}
                aria-label="Close sidebar"
              >
                <X size={18} weight="bold" />
              </button>
            </div>
          </div>
          <div className={styles.headerRow2}>
            <button
              className={`${styles.filterToggle} ${filter === 'undone' ? styles.filterToggleActive : ''}`}
              onClick={() => updateFilter(filter === 'undone' ? 'all' : 'undone')}
              title={filter === 'undone' ? 'Show all playgrounds' : 'Show only undone'}
            >
              Undone
            </button>
            {onSetRouteMode && (
              <>
                <button
                  className={[
                    styles.routeBtn,
                    routeOn ? styles.routeBtnActive : '',
                    isRouteLoading ? styles.routeBtnLoading : '',
                    isRouteError ? styles.routeBtnError : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => onSetRouteMode(routeOn ? 'off' : 'north')}
                  title={isRouteError ? 'Route unavailable' : routeOn ? 'Turn route off' : 'Turn route on'}
                >
                  {isRouteLoading ? <ArrowsClockwise size={14} className={styles.spin} /> : null}
                  Route
                </button>
                {routeOn && (
                  isCustomRoute ? (
                    <span className={styles.routeDirectionCustom}>Custom</span>
                  ) : (
                    <span className={styles.routeDirectionGroup}>
                      <button
                        className={`${styles.routeDirectionBtn} ${routeMode === 'north' ? styles.routeDirectionBtnActive : ''}`}
                        onClick={() => onSetRouteMode('north')}
                        title="Start from northernmost"
                      ><ArrowDown size={14} /></button>
                      <button
                        className={`${styles.routeDirectionBtn} ${routeMode === 'south' ? styles.routeDirectionBtnActive : ''}`}
                        onClick={() => onSetRouteMode('south')}
                        title="Start from southernmost"
                      ><ArrowUp size={14} /></button>
                      <button
                        className={`${styles.routeDirectionBtn} ${routeMode === 'location' ? styles.routeDirectionBtnActive : ''}`}
                        onClick={() => onSetRouteMode('location')}
                        title="Start from your location"
                      ><Crosshair size={14} /></button>
                    </span>
                  )
                )}
              </>
            )}
            {routeOrder && routeOrder.length > 0 && (
              <button
                className={`${styles.filterToggle} ${filter === 'route' ? styles.filterToggleActive : ''}`}
                onClick={() => updateFilter(filter === 'route' ? 'all' : 'route')}
                title={filter === 'route' ? 'Show all playgrounds' : 'Show in route order'}
              >
                List
              </button>
            )}
            {isAdmin && onOpenCurate && (
              <button
                className={styles.resetBtn}
                onClick={onOpenCurate}
                title="Open curation queue"
              >
                Curate
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
              {routeLegs && routeLegs.length > 0 && (
                <li className={styles.routeTotalsRow}>
                  <span className={styles.routeTotalsLabel}>Total</span>
                  <span className={styles.routeTotalsStats}>
                    {fmtKm(totalDistance)} · {fmtElev(totalElevation)}
                  </span>
                  <span className={styles.routeTotalsRemaining}>
                    {remainingCount} stop{remainingCount !== 1 ? 's' : ''} remaining
                  </span>
                  {onExportRoute && (
                    <button
                      className={styles.routeExportBtn}
                      onClick={onExportRoute}
                      title="Download route as KML"
                      aria-label="Download route as KML"
                    >
                      <DownloadSimple size={16} weight="bold" />
                    </button>
                  )}
                </li>
              )}
              {routeItemsWithCumulative.map(({ pos, playground: p, legIdx, cumElev }) => {
                const checked = checkedIds.has(p.id)
                const legStat = routeLegMap.get(p.id)
                const hasStats = legStat !== undefined && (legIdx > 0 || legStat.distance > 0)
                const isSelected = selectedId === p.id
                const steps = legStat?.steps ?? []
                return (
                  <li
                    key={p.id}
                    ref={(el) => {
                      if (el) itemRefs.current.set(p.id, el)
                      else itemRefs.current.delete(p.id)
                    }}
                  >
                    <div
                      className={`${styles.routeItem} ${checked ? styles.itemChecked : ''} ${isSelected ? styles.itemSelected : ''}`}
                    >
                      <div className={styles.routeItemRow} onClick={() => onSelectPlayground(p)}>
                        <span className={styles.routePos}>{pos}</span>
                        <span className={styles.routeItemText}>
                          <span className={styles.itemName}>{p.name}</span>
                          {p.suburb && <span className={styles.itemSuburb}>{p.suburb}</span>}
                          {hasStats && (
                            <span className={styles.legStats}>
                              {fmtKm(legStat!.distance)} · +{fmtElev(legStat!.elevationGain)}
                              <span className={styles.cumElev}> / {fmtElev(cumElev)}</span>
                            </span>
                          )}
                        </span>
                        {isSelected && (
                          checked ? (
                            <button
                              className={styles.inlineUndoBtn}
                              onClick={(e) => { e.stopPropagation(); onUndo(p.id) }}
                            >
                              Undo
                            </button>
                          ) : (
                            <button
                              className={styles.inlineDoneBtn}
                              onClick={(e) => { e.stopPropagation(); onCheckOff(p.id) }}
                            >
                              <Check size={13} weight="bold" /> Done
                            </button>
                          )
                        )}
                        {!checked && (
                          <>
                            <button
                              className={`${styles.pinStartBtn} ${pinnedStartId === p.id ? styles.pinStartBtnActive : ''}`}
                              onClick={(e) => { e.stopPropagation(); onTogglePinStart(p.id) }}
                              title={pinnedStartId === p.id ? 'Clear start point' : 'Set as route start'}
                            >
                              <NavigationArrow size={14} weight={pinnedStartId === p.id ? 'fill' : 'regular'} />
                            </button>
                            <button
                              className={`${styles.pinEndBtn} ${pinnedEndId === p.id ? styles.pinEndBtnActive : ''}`}
                              onClick={(e) => { e.stopPropagation(); onTogglePinEnd(p.id) }}
                              title={pinnedEndId === p.id ? 'Clear end point' : 'Set as route end'}
                            >
                              <Flag size={14} weight={pinnedEndId === p.id ? 'fill' : 'regular'} />
                            </button>
                          </>
                        )}
                      </div>
                      {isSelected && steps.length > 0 && (
                        <ul className={styles.stepList}>
                          {steps.map((step, i) => (
                            <li key={i} className={styles.stepItem}>
                              <span className={`${styles.stepIcon} ${step.type === 10 ? styles.stepIconArrive : ''}`}>
                                {stepIcon(step)}
                              </span>
                              {step.type !== 10 && (
                                <span className={styles.stepDist}>{fmtDist(step.distance)}</span>
                              )}
                              <span className={`${styles.stepText} ${step.type === 10 ? styles.stepTextArrive : ''}`}>
                                {step.instruction}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
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
                    <CaretRight
                      size={14}
                      weight="bold"
                      className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ''}`}
                    />
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
                                selectedId === p.id ? styles.itemSelected : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                            >
                              <div
                                className={styles.itemMain}
                                onClick={() => onSelectPlayground(p)}
                              >
                                <span
                                  className={`${styles.dot} ${checked ? styles.dotChecked : ''}`}
                                >
                                  {checked ? <Check size={11} weight="bold" /> : ''}
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
                              {selectedId === p.id && (
                                checked ? (
                                  <button
                                    className={styles.inlineUndoBtn}
                                    onClick={(e) => { e.stopPropagation(); onUndo(p.id) }}
                                  >
                                    Undo
                                  </button>
                                ) : (
                                  <button
                                    className={styles.inlineDoneBtn}
                                    onClick={(e) => { e.stopPropagation(); onCheckOff(p.id) }}
                                  >
                                    <Check size={13} weight="bold" /> Done
                                  </button>
                                )
                              )}
                              {routeOrder && !checked && (
                                <>
                                  <button
                                    className={`${styles.pinStartBtn} ${pinnedStartId === p.id ? styles.pinStartBtnActive : ''}`}
                                    onClick={(e) => { e.stopPropagation(); onTogglePinStart(p.id) }}
                                    title={pinnedStartId === p.id ? 'Clear start point' : 'Set as route start'}
                                  >
                                    ⊣
                                  </button>
                                  <button
                                    className={`${styles.pinEndBtn} ${pinnedEndId === p.id ? styles.pinEndBtnActive : ''}`}
                                    onClick={(e) => { e.stopPropagation(); onTogglePinEnd(p.id) }}
                                    title={pinnedEndId === p.id ? 'Clear end point' : 'Set as route end'}
                                  >
                                    ⊢
                                  </button>
                                </>
                              )}
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
