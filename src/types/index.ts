export type DateRange = '7d' | '30d' | '90d' | 'custom'
export type CompareMode = 'wow' | 'mom' | 'none'

export interface DataSourceState {
  acculynx: boolean
  ga4: boolean
  googleAds: boolean
  gsc: boolean
  highlevel: boolean
  growmap: boolean
  clarity: boolean
  lsa: boolean
}

export interface MetricCard {
  label: string
  value: string | number
  change: number
  changeLabel: string
  prefix?: string
  suffix?: string
}

export interface LeadSourceRow {
  source: string
  acculynx: number
  googleAds: number
  highlevel: number
  spend: number
  cpl: number
  convRate: number
  avgDeal: number
}

export interface PipelineStage {
  stage: string
  count: number
  value: number
  avgDays: number
  winRate: number
}

export interface DailyMetric {
  date: string
  users: number
  sessions: number
  conversions: number
  clicks: number
  calls: number
  leads: number
}

export interface CallData {
  source: string
  calls: number
  answered: number
  missed: number
  avgDuration: number
}

export interface DiscrepancyAlert {
  id: string
  severity: 'critical' | 'warning' | 'info'
  platforms: string[]
  metric: string
  values: { platform: string; value: number }[]
  variance: number
  suggestions: string[]
}

export interface DataSource {
  key: keyof DataSourceState
  label: string
  icon: string
  lastSync: string
  status: 'ok' | 'warning' | 'error'
  freshnessScore: number
}
