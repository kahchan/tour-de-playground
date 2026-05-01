import { useEffect, useMemo, useState } from 'react'
import type { Playground } from './types'
import { useCheckIns } from './hooks/useCheckIns'
import { useName } from './hooks/useName'
import MapView from './components/MapView'
import Counter from './components/Counter'
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
  const [selected, setSelected] = useState<Playground | null>(null)
  const [showNamePrompt, setShowNamePrompt] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarHighlight, setSidebarHighlight] = useState<{
    id: string
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

  // In non-admin mode, hide disabled playgrounds entirely
  const visiblePlaygrounds = useMemo(
    () =>
      isAdmin ? playgrounds : playgrounds.filter((p) => !disabledIds.has(p.id)),
    [playgrounds, disabledIds],
  )

  const checkedIds = useMemo(
    () => new Set(checkIns.map((c) => c.id)),
    [checkIns],
  )

  function handleToggleCheck(id: string) {
    if (checkedIds.has(id)) {
      removeCheckIn(id)
    } else if (!name) {
      setPendingId(id)
      setShowNamePrompt(true)
    } else {
      addCheckIn(id, name)
    }
  }

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
      />
      <Sidebar
        playgrounds={visiblePlaygrounds}
        checkIns={checkIns}
        checkedIds={checkedIds}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onToggleCheck={handleToggleCheck}
        isAdmin={isAdmin}
        disabledIds={disabledIds}
        onToggleDisabled={toggleDisabled}
        onAdminReset={resetAll}
        highlight={sidebarHighlight}
      />
      <Counter
        total={visiblePlaygrounds.length}
        visited={checkedIds.size}
        onToggle={() => setSidebarOpen((o) => !o)}
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
