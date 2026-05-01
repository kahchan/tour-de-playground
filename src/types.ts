export interface Playground {
  id: string
  name: string
  lat: number
  lng: number
  source: string
  included: boolean
}

export interface CheckIn {
  id: string
  name: string
  ts: string
}
