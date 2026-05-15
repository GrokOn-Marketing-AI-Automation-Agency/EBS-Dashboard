const BASE = 'http://localhost:3001'

export interface ClarityOverview {
  sessions:           number
  users:              number
  pageViews:          number
  avgSessionDuration: string
  bounceRate:         number
  pagesPerSession:    number
  newUsersPercent:    number
}

export interface ClarityDevice {
  device:   string
  sessions: number
  pct:      number
}

export interface ClarityPage {
  url:        string
  views:      number
  bounceRate: number
  avgTime:    string
}

export interface ClarityBehavior {
  rageClicks:  number
  deadClicks:  number
  quickBacks:  number
  scrollDepth: number
  jsErrors:    number
}

export interface ClaritySummary {
  source:   'live' | 'mock' | 'error'
  overview: ClarityOverview
  devices:  ClarityDevice[]
  topPages: ClarityPage[]
  behavior: ClarityBehavior
  lastSync: string
  error?:   string
}

export async function fetchClaritySummary(): Promise<ClaritySummary> {
  const res = await fetch(`${BASE}/api/clarity/summary`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
