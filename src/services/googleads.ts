import { API_BASE } from '../utils/apiBase'
const BASE = `${API_BASE}/api/googleads`

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`Google Ads API ${path} → ${res.status}`)
  return res.json() as Promise<T>
}

export interface GAdsCampaign {
  name:        string
  status:      string
  channelType: string   // e.g. SEARCH, DISPLAY, SMART, PERFORMANCE_MAX
  spend:       number
  clicks:      number
  impressions: number
  conversions: number
  ctr:         number
  avgCpc:      number
}

export interface GAdsKeyword {
  keyword:     string
  matchType:   string
  clicks:      number
  impressions: number
  cost:        number
  conversions: number
  ctr:         number
  avgCpc:      number
}

export interface GAdsCall {
  id:           string
  areaCode:     string
  durationSecs: number
  status:       string
  date:         string
  campaign:     string
  trackingName: string
}

export interface GAdsTotals {
  spend:             number
  clicks:            number
  impressions:       number
  conversions:       number
  costPerConversion: number
  ctr:               number
}

export interface GAdsTimeSeriesPoint {
  date:        string   // "MM-DD" for display
  spend:       number
  clicks:      number
  impressions: number
  conversions: number
}

export interface GAdsSummary {
  source:          'live' | 'mock'
  lastSync?:       string
  error?:          string
  range:           string
  hasPeriodData:   boolean
  allPaused:       boolean
  totals:          GAdsTotals
  totalsAllTime:   GAdsTotals
  campaigns:       GAdsCampaign[]
  campaignsAllTime: GAdsCampaign[]
  keywords:        GAdsKeyword[]
  timeSeries:      GAdsTimeSeriesPoint[]
  callConversions: GAdsCall[]
  hasCallData:     boolean
}

export const googleAdsService = {
  summary: (range?: string) =>
    get<GAdsSummary>(`/summary${range ? `?range=${range}` : ''}`),
}
