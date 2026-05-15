import type { LeadSourceRow, PipelineStage, DailyMetric, CallData, DiscrepancyAlert, DataSource } from '../types'
import type { DateRange, CompareMode } from '../types'

// --- Multipliers per date range ---
const SCALE: Record<DateRange, number> = { '7d': 1, '30d': 4.3, '90d': 12.9, custom: 1 }

// WoW change %: positive = improved this period vs prev
const WOW: Record<string, number> = {
  totalLeads: 12.2, totalSpend: -4.3, costPerLead: -14.8, conversionRate: 2.1,
  pipelineValue: 8.7, revenuePerLead: 5.4, totalCalls: 6.8, organicClicks: 18.3,
}
const MOM: Record<string, number> = {
  totalLeads: 24.1, totalSpend: -2.1, costPerLead: -21.2, conversionRate: 4.8,
  pipelineValue: 15.3, revenuePerLead: 9.7, totalCalls: 11.4, organicClicks: 33.7,
}

export function getChanges(compareMode: CompareMode) {
  if (compareMode === 'wow') return WOW
  if (compareMode === 'mom') return MOM
  return Object.fromEntries(Object.keys(WOW).map(k => [k, 0]))
}

// --- Base weekly metrics ---
const BASE_DAILY: DailyMetric[] = [
  { date: 'May 5', users: 312, sessions: 445, conversions: 18, clicks: 210, calls: 24, leads: 22 },
  { date: 'May 6', users: 289, sessions: 401, conversions: 14, clicks: 189, calls: 19, leads: 17 },
  { date: 'May 7', users: 356, sessions: 510, conversions: 22, clicks: 245, calls: 28, leads: 26 },
  { date: 'May 8', users: 401, sessions: 567, conversions: 26, clicks: 278, calls: 31, leads: 29 },
  { date: 'May 9', users: 378, sessions: 534, conversions: 21, clicks: 256, calls: 27, leads: 25 },
  { date: 'May 10', users: 420, sessions: 598, conversions: 29, clicks: 301, calls: 35, leads: 33 },
  { date: 'May 11', users: 388, sessions: 552, conversions: 24, clicks: 267, calls: 30, leads: 28 },
]

const MONTHLY_DAILY: DailyMetric[] = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(2026, 3, 12 + i)
  const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const base = 300 + Math.sin(i / 3) * 80 + i * 4
  return {
    date: label, users: Math.round(base), sessions: Math.round(base * 1.42),
    conversions: Math.round(base * 0.055), clicks: Math.round(base * 0.68),
    calls: Math.round(base * 0.077), leads: Math.round(base * 0.072),
  }
})

const QUARTERLY_DAILY: DailyMetric[] = Array.from({ length: 90 }, (_, i) => {
  const d = new Date(2026, 1, 10 + i)
  const label = i % 7 === 0 ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
  const base = 280 + Math.sin(i / 10) * 100 + i * 1.5
  return {
    date: label, users: Math.round(base), sessions: Math.round(base * 1.4),
    conversions: Math.round(base * 0.05), clicks: Math.round(base * 0.65),
    calls: Math.round(base * 0.075), leads: Math.round(base * 0.07),
  }
})

export function getDailyMetrics(range: DateRange): DailyMetric[] {
  if (range === '30d') return MONTHLY_DAILY
  if (range === '90d') return QUARTERLY_DAILY
  return BASE_DAILY
}

// --- KPI Summary ---
export function getKpiSummary(range: DateRange, compareMode: CompareMode) {
  const s = SCALE[range]
  const ch = getChanges(compareMode)
  return {
    totalLeads:      { value: Math.round(83 * s),          change: ch.totalLeads },
    totalSpend:      { value: Math.round(6600 * s),        change: ch.totalSpend },
    costPerLead:     { value: +(79.5 / (s < 2 ? 1 : s < 6 ? 1.05 : 1.08)).toFixed(1), change: ch.costPerLead },
    conversionRate:  { value: 16.9,                        change: ch.conversionRate },
    pipelineValue:   { value: Math.round(2272000 * (s < 2 ? 1 : s < 6 ? 1.8 : 2.4)), change: ch.pipelineValue },
    revenuePerLead:  { value: Math.round(2348 * (s < 2 ? 1 : 1.04)), change: ch.revenuePerLead },
    totalCalls:      { value: Math.round(158 * s),         change: ch.totalCalls },
    organicClicks:   { value: Math.round(1847 * s),        change: ch.organicClicks },
  }
}

// --- Lead Sources ---
const BASE_SOURCES: LeadSourceRow[] = [
  { source: 'Google Ads',       acculynx: 35, googleAds: 50, highlevel: 42, spend: 4800, cpl: 96,  convRate: 28, avgDeal: 9400  },
  { source: 'Organic Search',   acculynx: 18, googleAds: 0,  highlevel: 20, spend: 0,    cpl: 0,   convRate: 35, avgDeal: 11200 },
  { source: 'Local Service Ads',acculynx: 12, googleAds: 0,  highlevel: 14, spend: 1200, cpl: 100, convRate: 42, avgDeal: 8800  },
  { source: 'Referral',         acculynx: 8,  googleAds: 0,  highlevel: 8,  spend: 0,    cpl: 0,   convRate: 62, avgDeal: 14500 },
  { source: 'Direct',           acculynx: 6,  googleAds: 0,  highlevel: 7,  spend: 0,    cpl: 0,   convRate: 33, avgDeal: 10100 },
  { source: 'Social Media',     acculynx: 4,  googleAds: 0,  highlevel: 5,  spend: 600,  cpl: 150, convRate: 20, avgDeal: 7800  },
]

export function getLeadSources(range: DateRange): LeadSourceRow[] {
  const s = SCALE[range]
  return BASE_SOURCES.map(r => ({
    ...r,
    acculynx:   Math.round(r.acculynx * s),
    googleAds:  r.googleAds ? Math.round(r.googleAds * s) : 0,
    highlevel:  Math.round(r.highlevel * s),
    spend:      Math.round(r.spend * s),
  }))
}

// --- Pipeline ---
export const PIPELINE_STAGES: PipelineStage[] = [
  { stage: 'Prospect',      count: 83,  value: 748000,  avgDays: 2, winRate: 100 },
  { stage: 'Qualified',     count: 52,  value: 624000,  avgDays: 4, winRate: 63  },
  { stage: 'Proposal Sent', count: 31,  value: 434000,  avgDays: 7, winRate: 37  },
  { stage: 'Negotiation',   count: 18,  value: 270000,  avgDays: 5, winRate: 22  },
  { stage: 'Closed Won',    count: 14,  value: 196000,  avgDays: 3, winRate: 17  },
]

// --- Calls ---
const BASE_CALLS: CallData[] = [
  { source: 'Google Ads', calls: 78, answered: 65, missed: 13, avgDuration: 4.2 },
  { source: 'LSA',        calls: 34, answered: 31, missed: 3,  avgDuration: 5.1 },
  { source: 'Organic',    calls: 22, answered: 18, missed: 4,  avgDuration: 3.8 },
  { source: 'Direct',     calls: 15, answered: 12, missed: 3,  avgDuration: 4.6 },
  { source: 'Referral',   calls: 9,  answered: 9,  missed: 0,  avgDuration: 6.3 },
]

export function getCallData(range: DateRange): CallData[] {
  const s = SCALE[range]
  return BASE_CALLS.map(c => ({
    ...c,
    calls:    Math.round(c.calls * s),
    answered: Math.round(c.answered * s),
    missed:   Math.round(c.missed * s),
  }))
}

// --- Discrepancy Alerts (always based on latest 7-day snapshot) ---
export const DISCREPANCY_ALERTS: DiscrepancyAlert[] = [
  {
    id: 'disc-1', severity: 'critical',
    platforms: ['Google Ads', 'AccuLynx'],
    metric: 'Lead Count (Google Ads)',
    values: [
      { platform: 'Google Ads', value: 50 },
      { platform: 'AccuLynx',   value: 35 },
      { platform: 'GROMAAP',    value: 42 },
    ],
    variance: 30,
    suggestions: [
      '15 leads may still be in the AccuLynx intake queue awaiting assignment',
      'Check for leads marked as duplicates or spam in AccuLynx',
      'Verify offline conversion imports match Google Ads conversion window (30-day default)',
      'Some leads may have been entered via phone call without CRM entry',
    ],
  },
  {
    id: 'disc-2', severity: 'warning',
    platforms: ['GA4', 'Google Ads'],
    metric: 'Form Submissions vs Ad Conversions',
    values: [
      { platform: 'GA4 Form Submissions',    value: 68 },
      { platform: 'Google Ads Conversions',  value: 50 },
    ],
    variance: 26,
    suggestions: [
      'GA4 counts all form submissions; Google Ads only counts those from paid clicks',
      'Check view-through conversions being excluded from Google Ads totals',
      'Verify GA4 conversion event is not double-firing on thank-you page',
    ],
  },
  {
    id: 'disc-3', severity: 'warning',
    platforms: ['GROMAAP', 'AccuLynx'],
    metric: 'Call Volume vs CRM Lead Entry',
    values: [
      { platform: 'GROMAAP Calls',              value: 158 },
      { platform: 'AccuLynx Leads from Calls',  value: 83  },
    ],
    variance: 47,
    suggestions: [
      'Many calls are likely repeat callers or existing customers — expected gap',
      'Short calls (<60s) rarely convert to leads; filter by duration > 90 seconds',
      'Ensure call tracking numbers are updated across all listings',
    ],
  },
]

// --- Data Sources ---
export const DATA_SOURCES: DataSource[] = [
  { key: 'acculynx',  label: 'AccuLynx CRM',       icon: '🏠', lastSync: '2026-05-11 09:00', status: 'ok',      freshnessScore: 98 },
  { key: 'ga4',       label: 'Google Analytics 4',  icon: '📊', lastSync: '2026-05-11 08:45', status: 'ok',      freshnessScore: 95 },
  { key: 'googleAds', label: 'Google Ads',           icon: '🎯', lastSync: '2026-05-11 08:30', status: 'ok',      freshnessScore: 92 },
  { key: 'gsc',       label: 'Search Console',       icon: '🔍', lastSync: '2026-05-15 09:00', status: 'ok',      freshnessScore: 90 },
  { key: 'highlevel', label: 'GROMAAP',              icon: '⚡', lastSync: '2026-05-15 07:15', status: 'ok',      freshnessScore: 88 },
  { key: 'growmap',   label: 'GROMAAP Calls',        icon: '📞', lastSync: '2026-05-15 09:00', status: 'ok',      freshnessScore: 99 },
  { key: 'clarity',   label: 'Microsoft Clarity',    icon: '🖱️', lastSync: '2026-05-15 09:00', status: 'ok',      freshnessScore: 90 },
  { key: 'lsa',       label: 'Local Service Ads',    icon: '📍', lastSync: '2026-05-10 18:00', status: 'warning', freshnessScore: 72 },
]

// --- Clarity ---
export const CLARITY_DATA = {
  pageViews: 4218, sessions: 2845, users: 2388,
  avgSessionDuration: '2m 47s', bounceRate: 42.3,
  deviceBreakdown: [
    { device: 'Desktop', pct: 58 },
    { device: 'Mobile',  pct: 36 },
    { device: 'Tablet',  pct: 6  },
  ],
  topPages: [
    { page: '/',                views: 1840, bounceRate: 38.1 },
    { page: '/roofing-services',views: 892,  bounceRate: 44.2 },
    { page: '/contact',         views: 614,  bounceRate: 28.7 },
    { page: '/about',           views: 412,  bounceRate: 51.0 },
    { page: '/free-inspection', views: 460,  bounceRate: 22.4 },
  ],
}

// --- GSC ---
export const GSC_DATA = {
  totalClicks: 1847, impressions: 24310, ctr: 7.6, avgPosition: 8.4,
  topKeywords: [
    { keyword: 'roofing contractor near me',  clicks: 312, impressions: 2840, ctr: 11.0, position: 4.2 },
    { keyword: 'roof replacement cost',       clicks: 248, impressions: 3120, ctr: 7.9,  position: 6.8 },
    { keyword: 'emergency roof repair',       clicks: 196, impressions: 1980, ctr: 9.9,  position: 3.4 },
    { keyword: 'exterior building solutions', clicks: 178, impressions: 890,  ctr: 20.0, position: 1.8 },
    { keyword: 'metal roofing installation',  clicks: 143, impressions: 2240, ctr: 6.4,  position: 9.1 },
  ],
}

// --- ROI Funnel ---
export function getRoiFunnel(range: DateRange) {
  const s = SCALE[range]
  return [
    { stage: 'Ad Spend',   value: Math.round(6600 * s)   },
    { stage: 'Clicks',     value: Math.round(1847 * s)   },
    { stage: 'Leads',      value: Math.round(83 * s)     },
    { stage: 'Qualified',  value: Math.round(52 * s)     },
    { stage: 'Closed Won', value: Math.round(14 * s)     },
    { stage: 'Revenue',    value: Math.round(196000 * s) },
  ]
}
