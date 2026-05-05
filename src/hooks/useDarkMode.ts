import { useEffect, useState } from 'react'

export type MapTheme = 'dark' | 'light' | 'satellite'

const DARK_KEY = 'tdp:theme'
const SAT_KEY = 'tdp:satellite'

export function useDarkMode() {
  const [dark, setDark] = useState<boolean>(() => {
    const stored = localStorage.getItem(DARK_KEY)
    if (stored !== null) return stored === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  const [satellite, setSatellite] = useState<boolean>(
    () => localStorage.getItem(SAT_KEY) === 'true',
  )

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    localStorage.setItem(DARK_KEY, dark ? 'dark' : 'light')
  }, [dark])

  useEffect(() => {
    localStorage.setItem(SAT_KEY, satellite ? 'true' : 'false')
  }, [satellite])

  const mapTheme: MapTheme = satellite ? 'satellite' : dark ? 'dark' : 'light'

  return {
    dark,
    satellite,
    mapTheme,
    toggleDark: () => setDark((d) => !d),
    toggleSatellite: () => setSatellite((s) => !s),
  }
}
