import { useEffect, useState } from 'react'

const STORAGE_KEY = 'tdp:dark-mode'

export function useDarkMode() {
  const [dark, setDark] = useState<boolean>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) return stored === 'true'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    localStorage.setItem(STORAGE_KEY, String(dark))
  }, [dark])

  return { dark, toggle: () => setDark((d) => !d) }
}
