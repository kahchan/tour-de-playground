import { useEffect, useMemo, useState } from 'react'
import type { Playground } from './types'
import { useCheckIns } from './hooks/useCheckIns'
import { useName } from './hooks/useName'
import { useDarkMode } from './hooks/useDarkMode'
import { useRoute } from './hooks/useRoute'
import MapView from './components/MapView'
import Wordmark from './components/Wordmark'
import NameBadge from './components/NameBadge'
import NamePrompt from './components/NamePrompt'
import Sidebar from './components/Sidebar'
import ResetPanel from './components/ResetPanel'
import styles from './App.module.css'

const params = new URLSearchParams(window.location.search)
const isResetMode = params.has('reset')
const isAdmin = params.has('admin')

export default function App() {
  const [playgrounds, setPlaygrounds] = useState<Playground[]>([])
  const { checkIns, addCheckIn, removeCheckIn, disabledIds, toggleDisabled, resetAll, error } =
    useCheckIns()
  const { name, setName } = useName()
  const { dark, toggle: toggleDark } = useDarkMode()
  const [selected, setSelected] = useState<Playground | null>(null)
  const [showNamePrompt, setShowNamePrompt] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [pinnedEndId, setPinnedEndId] = useState<string | null>(null)
  const [pinnedStartId, setPinnedStartId] = useState<string | null>(null)
  const [sidebarHighlight, setSidebarHighlight] = useState<{
    id: string
    seq: number
  } | null>(null)
  const [mapFlyTarget, setMapFlyTarget] = useState<{
    lat: number
    lng: number
    seq: number
  } | null>(null)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}playgrounds.json`)
      .then((r) => r.json())
      .then((data: Playground[]) =>
        setPlaygrounds(data.filter((p) => p.included)),
      )
      .catch((err) => console.error('Failed to load playgrounds:', err))
  }, [])

  const visiblePlaygrounds = useMemo(
    () =>
      isAdmin ? playgrounds : playgrounds.filter((p) => !disabledIds.has(p.id)),
    [playgrounds, disabledIds],
  )

  const checkedIds = useMemo(
    () => new Set(checkIns.map((c) => c.id)),
    [checkIns],
  )

  const { mode: routeMode, cycle: cycleRoute, fetchState: routeFetchState, geoJSON: routeGeoJSON, orderedIds: routeOrderedIds } =
    useRoute(visiblePlaygrounds, pinnedEndId, pinnedStartId)

  // Auto-clear pins if the pinned playground gets checked off
  useEffect(() => {
    if (pinnedStartId && checkedIds.has(pinnedStartId)) setPinnedStartId(null)
    if (pinnedEndId && checkedIds.has(pinnedEndId)) setPinnedEndId(null)
  }, [checkedIds]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleNameSubmit(n: string) {
    setName(n)
    setShowNamePrompt(false)
    if (pendingId) {
      addCheckIn(pendingId, n)
      setPendingId(null)
      setSelected(null)
    }
  }

  function handleMarkerClick(playground: Playground) {
    setSelected(playground)
    setSidebarOpen(true)
    setSidebarHighlight((prev) => ({ id: playground.id, seq: (prev?.seq ?? 0) + 1 }))
  }

  function handleSidebarSelect(playground: Playground) {
    setSelected(playground)
    setMapFlyTarget((prev) => ({
      lat: playground.lat,
      lng: playground.lng,
      seq: (prev?.seq ?? 0) + 1,
    }))
  }

  function handleSidebarCheckOff(id: string) {
    if (!name) {
      setPendingId(id)
      setShowNamePrompt(true)
    } else {
      addCheckIn(id, name)
      setSelected(null)
    }
  }

  function handleSidebarUndo(id: string) {
    removeCheckIn(id)
    setSelected(null)
  }

  function handleTogglePinEnd(id: string) {
    setPinnedEndId((prev) => (prev === id ? null : id))
  }

  function handleTogglePinStart(id: string) {
    setPinnedStartId((prev) => (prev === id ? null : id))
  }

  async function handleReset(passphrase: string) {
    if (!import.meta.env.VITE_WORKER_URL)
      throw new Error('No worker URL configured')
    const res = await fetch(`${import.meta.env.VITE_WORKER_URL}/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passphrase }),
    })
    if (!res.ok) throw new Error(`${res.status}`)
  }

  return (
    <div className={styles.app}>
      <MapView
        playgrounds={visiblePlaygrounds}
        checkedIds={checkedIds}
        onMarkerClick={handleMarkerClick}
        darkMode={dark}
        routeGeoJSON={routeGeoJSON}
        routeOrder={routeOrderedIds}
        selectedId={selected?.id ?? null}
        flyTarget={mapFlyTarget}
      />
      <Wordmark
        total={visiblePlaygrounds.length}
        visited={checkedIds.size}
        dark={dark}
        onToggleDark={toggleDark}
        onToggleSidebar={() => setSidebarOpen((o) => !o)}
        routeMode={routeMode}
        routeFetchState={routeFetchState}
        onCycleRoute={import.meta.env.VITE_ORS_KEY ? cycleRoute : undefined}
      />
      <Sidebar
        playgrounds={visiblePlaygrounds}
        checkIns={checkIns}
        checkedIds={checkedIds}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelectPlayground={handleSidebarSelect}
        selectedId={selected?.id ?? null}
        onCheckOff={handleSidebarCheckOff}
        onUndo={handleSidebarUndo}
        isAdmin={isAdmin}
        disabledIds={disabledIds}
        onToggleDisabled={toggleDisabled}
        onAdminReset={resetAll}
        highlight={sidebarHighlight}
        routeOrder={routeOrderedIds.length > 0 ? routeOrderedIds : undefined}
        pinnedEndId={pinnedEndId}
        onTogglePinEnd={handleTogglePinEnd}
        pinnedStartId={pinnedStartId}
        onTogglePinStart={handleTogglePinStart}
      />
      <NameBadge name={name} onChangeName={() => setShowNamePrompt(true)} />
      {error && <div className={styles.errorBanner}>{error}</div>}
      {isResetMode && <ResetPanel onReset={handleReset} />}
      {showNamePrompt && (
        <NamePrompt
          onSubmit={handleNameSubmit}
          onClose={() => {
            setShowNamePrompt(false)
            setPendingId(null)
          }}
        />
      )}
    </div>
  )
}
