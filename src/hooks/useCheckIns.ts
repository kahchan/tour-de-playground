import { useState } from 'react'
import type { CheckIn } from '../types'

const KEY = 'tdp:checkins'

function load(): CheckIn[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

export function useCheckIns() {
  const [checkIns, setCheckIns] = useState<CheckIn[]>(load)

  function addCheckIn(id: string, name: string) {
    setCheckIns((prev) => {
      if (prev.some((c) => c.id === id)) return prev
      const next = [...prev, { id, name, ts: new Date().toISOString() }]
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }

  return { checkIns, addCheckIn }
}
