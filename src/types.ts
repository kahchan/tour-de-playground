export interface Playground {
  id: string
  name: string
  lat: number
  lng: number
  suburb: string | null
  source: string
  included: boolean
}

export interface CheckIn {
  id: string
  name: string
  ts: string
}
