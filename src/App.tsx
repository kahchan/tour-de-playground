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

const isResetMode = new URLSearchParams(window.location.search).has('reset')
const workerUrl = import.meta.env.VITE_WORKER_URL as string | undefined

export default function App() {
  const [playgrounds, setPlaygrounds] = useState<Playground[]>([])
  const { checkIns, addCheckIn, error } = useCheckIns()
  const { name, setName } = useName()
  const [selected, setSelected] = useState<Playground | null>(null)
  const [showNamePrompt, setShowNamePrompt] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [flyToTarget, setFlyToTarget] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}playgrounds.json`)
      .then((r) => r.json())
      .then((data: Playground[]) => setPlaygrounds(data.filter((p) => p.included)))
      .catch((err) => console.error('Failed to load playgrounds:', err))
  }, [])

  const checkedIds = useMemo(() => new Set(checkIns.map((c) => c.id)), [checkIns])

  function handleCheckOff() {
    if (!selected) return
    if (!name) {
      setPendingId(selected.id)
      setShowNamePrompt(true)
    } else {
      addCheckIn(selected.id, name)
      setSelected(null)
    }
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

  function handleSidebarSelect(playground: Playground) {
    setSidebarOpen(false)
    setFlyToTarget({ lat: playground.lat, lng: playground.lng })
    setSelected(playground)
  }

  async function handleReset(passphrase: string) {
    if (!workerUrl) throw new Error('No worker URL configured')
    const res = await fetch(`${workerUrl}/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passphrase }),
    })
    if (!res.ok) throw new Error(`${res.status}`)
  }

  return (
    <div className={styles.app}>
      <MapView
        playgrounds={playgrounds}
        checkedIds={checkedIds}
        onMarkerClick={setSelected}
        flyToTarget={flyToTarget}
      />
      <Sidebar
        playgrounds={playgrounds}
        checkIns={checkIns}
        checkedIds={checkedIds}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelect={handleSidebarSelect}
      />
      <Counter
        total={playgrounds.length}
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
          onCheckOff={handleCheckOff}
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
