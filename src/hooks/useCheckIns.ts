import { useCallback, useEffect, useRef, useState } from 'react'
import type { CheckIn } from '../types'

const LOCAL_KEY = 'tdp:checkins'
const POLL_MS = 7000

function loadLocal(): CheckIn[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function useCheckIns() {
  const workerUrl = import.meta.env.VITE_WORKER_URL as string | undefined
  const [checkIns, setCheckIns] = useState<CheckIn[]>(loadLocal)
  const [error, setError] = useState<string | null>(null)
  const lastModifiedRef = useRef<string | null>(null)

  function flashError(msg: string) {
    setError(msg)
    setTimeout(() => setError(null), 4000)
  }

  const fetchState = useCallback(async () => {
    if (!workerUrl) return
    try {
      const res = await fetch(`${workerUrl}/state`)
      if (!res.ok) throw new Error(`${res.status}`)
      const data: { checks: CheckIn[]; lastModified: string } = await res.json()
      if (data.lastModified !== lastModifiedRef.current) {
        lastModifiedRef.current = data.lastModified
        setCheckIns(data.checks)
        localStorage.setItem(LOCAL_KEY, JSON.stringify(data.checks))
      }
    } catch {
      // silent — offline or Worker down; stale state is fine
    }
  }, [workerUrl])

  useEffect(() => {
    if (!workerUrl) return
    fetchState()
    const id = setInterval(fetchState, POLL_MS)
    return () => clearInterval(id)
  }, [fetchState, workerUrl])

  async function addCheckIn(id: string, name: string) {
    if (!workerUrl) {
      setCheckIns((prev) => {
        if (prev.some((c) => c.id === id)) return prev
        const next = [...prev, { id, name, ts: new Date().toISOString() }]
        localStorage.setItem(LOCAL_KEY, JSON.stringify(next))
        return next
      })
      return
    }

    const optimistic: CheckIn = { id, name, ts: new Date().toISOString() }
    setCheckIns((prev) => (prev.some((c) => c.id === id) ? prev : [...prev, optimistic]))

    try {
      const res = await fetch(`${workerUrl}/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      await fetchState()
    } catch {
      setCheckIns((prev) => prev.filter((c) => c !== optimistic))
      flashError('Check-off failed — are you online?')
    }
  }

  return { checkIns, addCheckIn, error }
}
