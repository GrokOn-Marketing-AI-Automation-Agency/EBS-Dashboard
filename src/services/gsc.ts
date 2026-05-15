const BASE = 'http://localhost:3001'

export interface GSCOverview {
  clicks:      number
  impressions: number
  ctr:         number
  position:    number
}

export interface GSCQuery {
  query:       string
  clicks:      number
  impressions: number
  ctr:         number
  position:    number
}

export interface GSCPage {
  page:        string
  clicks:      number
  impressions: number
  ctr:         number
  position:    number
}

export interface GSCDevice {
  device: string
  clicks: number
  pct:    number
}

export interface GSCPoint {
  date:        string
  clicks:      number
  impressions: number
  ctr:         number
  position:    number
}

export interface GSCSummary {
  overview:    GSCOverview
  topQueries:  GSCQuery[]
  topPages:    GSCPage[]
  devices:     GSCDevice[]
  timeSeries:  GSCPoint[]
  siteUrl:     string
  dateRange:   { startDate: string; endDate: string }
  source:      'live' | 'error'
  error?:      string
  lastSync?:   string
}

export const gscService = {
  async summary(range?: string): Promise<GSCSummary> {
    const params = range ? `?range=${range}` : ''
    const res    = await fetch(`${BASE}/api/gsc/summary${params}`)
    if (!res.ok) throw new Error(`GSC API ${res.status}`)
    return res.json()
  },
}
