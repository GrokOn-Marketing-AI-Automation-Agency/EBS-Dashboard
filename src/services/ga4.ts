import { API_BASE } from '../utils/apiBase'
const BASE = `${API_BASE}/api/ga4`

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`GA4 API ${path} → ${res.status}`)
  return res.json() as Promise<T>
}

export interface GA4Overview {
  sessions:           number
  users:              number
  newUsers:           number
  bounceRate:         number   // already in %
  avgSessionDuration: number   // seconds
  pageViews:          number
  conversions:        number
}

export interface GA4TimePoint {
  date:        string
  sessions:    number
  users:       number
  conversions: number
}

export interface GA4Channel {
  channel:     string
  sessions:    number
  users:       number
  conversions: number
  pct:         number
}

export interface GA4Device {
  device:   string
  sessions: number
  users:    number
  pct:      number
}

export interface GA4Page {
  page:        string
  sessions:    number
  users:       number
  pageViews:   number
  bounceRate:  number
  avgDuration: number
}

export interface GA4Summary {
  source:     'live' | 'mock'
  lastSync?:  string
  error?:     string
  overview:   GA4Overview
  timeSeries: GA4TimePoint[]
  channels:   GA4Channel[]
  devices:    GA4Device[]
  topPages:   GA4Page[]
}

export const ga4Service = {
  summary: (range?: string) =>
    get<GA4Summary>(`/summary${range ? `?range=${range}` : ''}`),
}
