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
  const [disabledIds, setDisabledIds] = useState<Set<string>>(new Set())
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
      const data: {
        checks: CheckIn[]
        disabled: string[]
        lastModified: string
      } = await res.json()
      if (data.lastModified !== lastModifiedRef.current) {
        lastModifiedRef.current = data.lastModified
        setCheckIns(data.checks)
        setDisabledIds(new Set(data.disabled ?? []))
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
    setCheckIns((prev) =>
      prev.some((c) => c.id === id) ? prev : [...prev, optimistic],
    )

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

  async function toggleDisabled(id: string, on: boolean) {
    // Optimistic update
    setDisabledIds((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

    if (!workerUrl) return

    try {
      const res = await fetch(`${workerUrl}/disable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, on }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      await fetchState()
    } catch {
      // Revert on failure
      setDisabledIds((prev) => {
        const next = new Set(prev)
        if (on) next.delete(id)
        else next.add(id)
        return next
      })
      flashError('Disable action failed — are you online?')
    }
  }

  async function resetAll(passphrase: string) {
    if (!workerUrl) throw new Error('No worker URL configured')
    const res = await fetch(`${workerUrl}/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passphrase }),
    })
    if (!res.ok)
      throw new Error(res.status === 403 ? 'Wrong passphrase' : `${res.status}`)
    // Optimistically clear everything
    setCheckIns([])
    setDisabledIds(new Set())
    localStorage.setItem(LOCAL_KEY, '[]')
    lastModifiedRef.current = null // force re-fetch on next poll
  }

  return { checkIns, addCheckIn, disabledIds, toggleDisabled, resetAll, error }
}
