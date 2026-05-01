import { useState } from 'react'

const KEY = 'tdp:name'

export function useName() {
  const [name, setNameState] = useState<string | null>(() => localStorage.getItem(KEY))

  function setName(value: string) {
    localStorage.setItem(KEY, value)
    setNameState(value)
  }

  return { name, setName }
}
