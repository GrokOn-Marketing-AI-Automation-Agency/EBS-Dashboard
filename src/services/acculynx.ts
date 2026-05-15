/**
 * AccuLynx Service
 * Fetches from the local Bun proxy server (/api/acculynx/*).
 * The proxy transparently switches between live AccuLynx data
 * and mock data depending on whether ACCULYNX_API_KEY is set.
 */

export interface AcxLeadSource {
  source:      string
  acculynx:    number
  totalValue:  number
  avgDeal:     number
  closingPct?: number   // % of leads that closed (from report CSV)
}

export interface AcxPipelineStage {
  stage:   string
  count:   number
  value:   number
  avgDays: number
}

export interface AcxProspect {
  id:           string
  name:         string
  source:       string
  stage:        string
  value:        number
  createdDate:  string | null
  lastActivity: string | null
  assignedTo:   string
  address?:     string
}

export interface AcxSummary {
  source:        'live' | 'mock'
  dataSource?:   'report' | 'jobs'   // 'report' = richer CSV data; 'jobs' = basic API data
  lastSync:      string
  totalJobs:     number
  liveJobCount?: number              // real-time count from jobs API (always current)
  reportDate?:   string              // date the scheduled report was generated
  leadSources:   AcxLeadSource[]
  pipeline:      AcxPipelineStage[]
  prospects:     AcxProspect[]
  error?:        string
}

export interface AttributionGapLead {
  id:               string
  phone:            string
  date:             string
  durationSecs:     number
  adType:           string
  campaign:         string
  keyword:          string
  matchStatus:      'not_in_crm' | 'wrong_source'
  acculynxJobName?:  string
  acculynxSource?:   string
  acculynxJobId?:    string
  // Job timeline from lead status CSV
  jobMilestone?:     string
  jobLeadDate?:      string
  jobAssignedDate?:  string
  jobEstimateDate?:  string
  jobApprovedDate?:  string
  jobDaysInStatus?:  number
  jobLastTouched?:   number
  jobEstimateTotal?: number
  jobSalesperson?:   string
}

export interface AttributionGapReport {
  source:            'live' | 'mock'
  totalGadsCalls:    number
  matchedInAccuLynx: number
  gapCount:          number
  acxTotalJobs:      number
  reportDate?:       string
  lastSync?:         string
  gaps:              AttributionGapLead[]
  error?:            string
}

export interface AcxStatus {
  connected: boolean
  reason?:   string
  message?:  string
}

const BASE = '/api/acculynx'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`)
  return res.json() as Promise<T>
}

export const acculynxService = {
  status:             () => get<AcxStatus>('/status'),
  summary:            (range?: string) => get<AcxSummary>(`/summary${range ? `?range=${range}` : ''}`),
  prospects:          () => get<{ source: string; items: AcxProspect[]; total: number }>('/jobs'),
  attributionGaps:    (range?: string) => get<AttributionGapReport>(`/attribution-gaps${range ? `?range=${range}` : ''}`),
}
