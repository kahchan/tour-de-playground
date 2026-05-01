import { useEffect, useMemo, useState } from 'react'
import type { Playground } from './types'
import { useCheckIns } from './hooks/useCheckIns'
import { useName } from './hooks/useName'
import MapView from './components/MapView'
import Counter from './components/Counter'
import NameBadge from './components/NameBadge'
import MarkerPopup from './components/MarkerPopup'
import NamePrompt from './components/NamePrompt'
import styles from './App.module.css'

export default function App() {
  const [playgrounds, setPlaygrounds] = useState<Playground[]>([])
  const { checkIns, addCheckIn } = useCheckIns()
  const { name, setName } = useName()
  const [selected, setSelected] = useState<Playground | null>(null)
  const [showNamePrompt, setShowNamePrompt] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)

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

  return (
    <div className={styles.app}>
      <MapView
        playgrounds={playgrounds}
        checkedIds={checkedIds}
        onMarkerClick={setSelected}
      />
      <Counter total={playgrounds.length} visited={checkedIds.size} />
      <NameBadge name={name} onChangeName={() => setShowNamePrompt(true)} />
      {selected && !showNamePrompt && (
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
