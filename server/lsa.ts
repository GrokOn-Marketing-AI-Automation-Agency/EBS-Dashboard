/**
 * Google Local Services Ads (LSA) server module
 * Uses Google Ads API v20 with the LSA customer ID (separate from regular GADS account)
 * No login-customer-id header needed — the refresh token has direct access
 */

const API_VERSION   = 'v20'
const LSA_CUSTOMER  = process.env.LSA_CUSTOMER_ID ?? '9014088688'
const API_BASE      = `https://googleads.googleapis.com/${API_VERSION}/customers/${LSA_CUSTOMER}`
const DEV_TOKEN     = process.env.GADS_DEVELOPER_TOKEN ?? ''
const CLIENT_ID     = process.env.GADS_CLIENT_ID     ?? ''
const CLIENT_SECRET = process.env.GADS_CLIENT_SECRET ?? ''
const REFRESH_TOKEN = process.env.GADS_REFRESH_TOKEN ?? ''

// ─── Token cache ─────────────────────────────────────────────────────────────

let _token: string | null = null
let _expiry = 0

async function getToken(): Promise<string> {
  if (_token && Date.now() < _expiry - 60_000) return _token
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type:    'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('LSA token fetch failed: ' + JSON.stringify(data))
  _token  = data.access_token
  _expiry = Date.now() + (data.expires_in ?? 3600) * 1000
  return _token!
}

async function gaql(query: string) {
  const token = await getToken()
  const res   = await fetch(`${API_BASE}/googleAds:search`, {
    method:  'POST',
    headers: {
      Authorization:    `Bearer ${token}`,
      'developer-token': DEV_TOKEN,
      'Content-Type':   'application/json',
    },
    body: JSON.stringify({ query }),
  })
  const data = await res.json()
  if (data.error) throw new Error(`LSA GAQL error: ${data.error.message}`)
  return data.results ?? []
}

// ─── Category label map ───────────────────────────────────────────────────────

const CAT_LABELS: Record<string, string> = {
  roofer:          'Roofing',
  siding_pro:      'Siding',
  window_repair:   'Windows',
  gutter_cleaning: 'Gutters',
  general_contractor: 'General',
}

function catLabel(catId: string): string {
  const slug = catId.replace('xcat:service_area_business_', '')
  return CAT_LABELS[slug] ?? slug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function rangeClause(range: string | null): string {
  if (range === '7d')  return 'segments.date DURING LAST_7_DAYS'
  if (range === '30d') return 'segments.date DURING LAST_30_DAYS'
  if (range === '90d') return 'segments.date DURING LAST_90_DAYS'
  return 'segments.date DURING LAST_30_DAYS'
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function rangeStartISO(range: string | null): string {
  if (range === '7d')  return daysAgo(7)
  if (range === '90d') return daysAgo(90)
  return daysAgo(30)
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LSALead {
  id:       string
  type:     'PHONE_CALL' | 'MESSAGE'
  status:   'NEW' | 'ACTIVE' | 'DECLINED' | 'BOOKED' | 'WIPED_OUT'
  category: string
  service:  string
  date:     string
  charged:  boolean
}

export interface LSACategoryBreakdown {
  category: string
  total:    number
  charged:  number
  calls:    number
  messages: number
}

export interface LSASummary {
  source:       'live' | 'mock'
  period:       string
  spend:        number       // USD
  impressions:  number
  clicks:       number
  conversions:  number       // from campaign metrics
  totalLeads:   number
  chargedLeads: number
  newLeads:     number
  activeLeads:  number
  declinedLeads:number
  phoneCalls:   number
  messages:     number
  categories:   LSACategoryBreakdown[]
  recentLeads:  LSALead[]
  lastSync:     string
}

// ─── Mock fallback ────────────────────────────────────────────────────────────

function getMockSummary(range: string | null): LSASummary {
  const s = range === '7d' ? 1 : range === '90d' ? 3 : 2
  return {
    source: 'mock', period: range ?? '30d',
    spend: 1200 * s, impressions: 3500 * s, clicks: 340 * s, conversions: 14 * s,
    totalLeads: 34 * s, chargedLeads: 28 * s, newLeads: 4 * s,
    activeLeads: 26 * s, declinedLeads: 2 * s,
    phoneCalls: 26 * s, messages: 8 * s,
    categories: [
      { category: 'Roofing', total: 12 * s, charged: 10 * s, calls: 9 * s,  messages: 3 * s },
      { category: 'Siding',  total: 14 * s, charged: 12 * s, calls: 11 * s, messages: 3 * s },
      { category: 'Windows', total: 8 * s,  charged: 6 * s,  calls: 6 * s,  messages: 2 * s },
    ],
    recentLeads: [],
    lastSync: new Date().toISOString(),
  }
}

// ─── Live fetch ───────────────────────────────────────────────────────────────

export async function getLSASummary(range: string | null): Promise<LSASummary> {
  try {
    const startDate = rangeStartISO(range)

    // 1. Campaign metrics (spend, impressions, clicks, conversions)
    const [campaignRows, leadRows] = await Promise.all([
      gaql(`SELECT metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions
            FROM campaign WHERE ${rangeClause(range)}`),
      gaql(`SELECT local_services_lead.lead_type, local_services_lead.lead_status,
                   local_services_lead.creation_date_time, local_services_lead.lead_charged,
                   local_services_lead.category_id, local_services_lead.service_id
            FROM local_services_lead
            WHERE local_services_lead.creation_date_time >= '${startDate} 00:00:00'
            ORDER BY local_services_lead.creation_date_time DESC
            LIMIT 500`),
    ])

    // Aggregate campaign metrics
    let spend = 0, impressions = 0, clicks = 0, conversions = 0
    for (const row of campaignRows) {
      const m = row.metrics ?? {}
      spend       += Number(m.costMicros ?? 0) / 1_000_000
      impressions += Number(m.impressions ?? 0)
      clicks      += Number(m.clicks ?? 0)
      conversions += Number(m.conversions ?? 0)
    }

    // Parse leads
    const leads: LSALead[] = leadRows.map((row: any) => {
      const l = row.localServicesLead ?? {}
      const id = (l.resourceName ?? '').split('/').pop() ?? ''
      return {
        id,
        type:     l.leadType     ?? 'PHONE_CALL',
        status:   l.leadStatus   ?? 'ACTIVE',
        category: catLabel(l.categoryId ?? ''),
        service:  (l.serviceId ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
        date:     (l.creationDateTime ?? '').slice(0, 10),
        charged:  l.leadCharged ?? false,
      }
    })

    // Count breakdowns
    const totalLeads    = leads.length
    const chargedLeads  = leads.filter(l => l.charged).length
    const newLeads      = leads.filter(l => l.status === 'NEW').length
    const activeLeads   = leads.filter(l => l.status === 'ACTIVE').length
    const declinedLeads = leads.filter(l => l.status === 'DECLINED').length
    const phoneCalls    = leads.filter(l => l.type === 'PHONE_CALL').length
    const messages      = leads.filter(l => l.type === 'MESSAGE').length

    // Category breakdown
    const catMap = new Map<string, LSACategoryBreakdown>()
    for (const l of leads) {
      const cat = l.category || 'Other'
      if (!catMap.has(cat)) catMap.set(cat, { category: cat, total: 0, charged: 0, calls: 0, messages: 0 })
      const c = catMap.get(cat)!
      c.total++
      if (l.charged) c.charged++
      if (l.type === 'PHONE_CALL') c.calls++
      else c.messages++
    }
    const categories = [...catMap.values()].sort((a, b) => b.total - a.total)

    console.log(`[LSA] ${totalLeads} leads (${range ?? '30d'}), $${spend.toFixed(2)} spend`)

    return {
      source: 'live',
      period: range ?? '30d',
      spend:  +spend.toFixed(2),
      impressions, clicks,
      conversions: Math.round(conversions),
      totalLeads, chargedLeads, newLeads, activeLeads, declinedLeads,
      phoneCalls, messages,
      categories,
      recentLeads: leads.slice(0, 20),
      lastSync: new Date().toISOString(),
    }
  } catch (e: any) {
    console.error('[LSA] fetch error, using mock:', e.message)
    return getMockSummary(range)
  }
}
