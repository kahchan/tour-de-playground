import { useEffect, useMemo, useState } from 'react'
import type { Playground } from './types'
import { useCheckIns } from './hooks/useCheckIns'
import { useName } from './hooks/useName'
import { useDarkMode } from './hooks/useDarkMode'
import { useRoute } from './hooks/useRoute'
import MapView from './components/MapView'
import Wordmark from './components/Wordmark'
import NameBadge from './components/NameBadge'
import MarkerPopup from './components/MarkerPopup'
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

  const uncheckedPlaygrounds = useMemo(
    () => visiblePlaygrounds.filter((p) => !checkedIds.has(p.id)),
    [visiblePlaygrounds, checkedIds],
  )

  const { mode: routeMode, cycle: cycleRoute, fetchState: routeFetchState, geoJSON: routeGeoJSON, orderedIds: routeOrderedIds } =
    useRoute(uncheckedPlaygrounds, pinnedEndId)

  function handlePopupCheckOff() {
    if (!selected) return
    if (!name) {
      setPendingId(selected.id)
      setShowNamePrompt(true)
    } else {
      addCheckIn(selected.id, name)
      setSelected(null)
    }
  }

  function handlePopupUndo() {
    if (!selected) return
    removeCheckIn(selected.id)
    setSelected(null)
  }

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

  function handleTogglePinEnd(id: string) {
    setPinnedEndId((prev) => (prev === id ? null : id))
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
        isAdmin={isAdmin}
        disabledIds={disabledIds}
        onToggleDisabled={toggleDisabled}
        onAdminReset={resetAll}
        highlight={sidebarHighlight}
        routeOrder={routeOrderedIds.length > 0 ? routeOrderedIds : undefined}
        pinnedEndId={pinnedEndId}
        onTogglePinEnd={handleTogglePinEnd}
      />
      <NameBadge name={name} onChangeName={() => setShowNamePrompt(true)} />
      {error && <div className={styles.errorBanner}>{error}</div>}
      {isResetMode && <ResetPanel onReset={handleReset} />}
      {selected && !showNamePrompt && !isResetMode && (
        <MarkerPopup
          playground={selected}
          checkIn={checkIns.find((c) => c.id === selected.id) ?? null}
          yourName={name}
          onCheckOff={handlePopupCheckOff}
          onUndo={handlePopupUndo}
          onClose={() => setSelected(null)}
        />
      )}
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
