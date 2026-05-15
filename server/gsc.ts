/**
 * Google Search Console — Search Analytics API
 * Auth: Same service account as GA4 (reuses JWT helper)
 * Docs: https://developers.google.com/webmaster-tools/search-console-api-original/v3/searchanalytics/query
 */


const SITE_URL = process.env.GSC_SITE_URL ?? 'sc-domain:exteriorbuildingsolutions.com'
const GSC_API  = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE_URL)}/searchAnalytics/query`

// ── Date range helper ─────────────────────────────────────────────────────────

function gscDates(range?: string | null): { startDate: string; endDate: string } {
  const end   = new Date()
  end.setDate(end.getDate() - 3)                     // GSC has ~3 day lag
  const start = new Date(end)
  const days  = range === '7d' ? 7 : range === '90d' ? 90 : 30
  start.setDate(start.getDate() - days)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { startDate: fmt(start), endDate: fmt(end) }
}

// ── Query runner ──────────────────────────────────────────────────────────────

async function query(body: object): Promise<any> {
  // GSC uses webmasters scope — we need to get a token with that scope
  // The GA4 service account key file is reused but with a different scope
  const token = await getGscToken()
  const res   = await fetch(GSC_API, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GSC API error ${res.status}: ${text}`)
  }
  return res.json()
}

// ── OAuth2 token using refresh token ─────────────────────────────────────────

let _gscToken  = ''
let _gscExpiry = 0

async function getGscToken(): Promise<string> {
  if (_gscToken && Date.now() < _gscExpiry) return _gscToken

  const clientId     = process.env.GADS_CLIENT_ID     ?? ''
  const clientSecret = process.env.GADS_CLIENT_SECRET ?? ''
  const refreshToken = process.env.GSC_REFRESH_TOKEN  ?? ''

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('GSC not configured — set GADS_CLIENT_ID, GADS_CLIENT_SECRET, GSC_REFRESH_TOKEN in .env')
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  })

  if (!res.ok) throw new Error(`GSC token refresh failed: ${await res.text()}`)

  const { access_token, expires_in } = await res.json() as { access_token: string; expires_in: number }
  _gscToken  = access_token
  _gscExpiry = Date.now() + (expires_in - 60) * 1000
  return _gscToken
}

// ── Summary builder ───────────────────────────────────────────────────────────

export async function getGSCSummary(range?: string | null) {
  const dates = gscDates(range)

  const base = { startDate: dates.startDate, endDate: dates.endDate, rowLimit: 25 }

  const [totalsRes, queriesRes, pagesRes, devicesRes, datesRes] = await Promise.all([
    // 1. Overall totals
    query({ ...base, dimensions: [] }),

    // 2. Top queries (keywords)
    query({ ...base, dimensions: ['query'], orderBy: { fieldName: 'clicks', sortOrder: 'DESCENDING' } }),

    // 3. Top pages
    query({ ...base, dimensions: ['page'], orderBy: { fieldName: 'clicks', sortOrder: 'DESCENDING' } }),

    // 4. Device breakdown
    query({ ...base, dimensions: ['device'] }),

    // 5. Daily time series
    query({ ...base, dimensions: ['date'], orderBy: { fieldName: 'date', sortOrder: 'ASCENDING' }, rowLimit: 90 }),
  ])

  // ── Parse totals ──
  const t = totalsRes.rows?.[0] ?? {}
  const overview = {
    clicks:      Math.round(t.clicks      ?? 0),
    impressions: Math.round(t.impressions ?? 0),
    ctr:         Math.round((t.ctr        ?? 0) * 10000) / 100,  // fraction → %
    position:    Math.round((t.position   ?? 0) * 10) / 10,
  }

  // ── Parse queries ──
  const topQueries = (queriesRes.rows ?? []).slice(0, 20).map((r: any) => ({
    query:       r.keys?.[0] ?? '',
    clicks:      Math.round(r.clicks      ?? 0),
    impressions: Math.round(r.impressions ?? 0),
    ctr:         Math.round((r.ctr        ?? 0) * 10000) / 100,
    position:    Math.round((r.position   ?? 0) * 10) / 10,
  }))

  // ── Parse pages (deduplicate same path from different URL variants) ──
  const pageMap = new Map<string, { clicks: number; impressions: number; ctr: number[]; position: number[] }>()
  for (const r of (pagesRes.rows ?? [])) {
    const raw  = r.keys?.[0] ?? ''
    const page = raw.replace(/^https?:\/\/[^/]+/, '') || '/'
    const existing = pageMap.get(page)
    if (existing) {
      existing.clicks      += Math.round(r.clicks      ?? 0)
      existing.impressions += Math.round(r.impressions ?? 0)
      existing.ctr.push((r.ctr      ?? 0) * 100)
      existing.position.push(r.position ?? 0)
    } else {
      pageMap.set(page, {
        clicks:      Math.round(r.clicks      ?? 0),
        impressions: Math.round(r.impressions ?? 0),
        ctr:         [(r.ctr      ?? 0) * 100],
        position:    [r.position  ?? 0],
      })
    }
  }
  const topPages = [...pageMap.entries()]
    .map(([page, v]) => ({
      page,
      clicks:      v.clicks,
      impressions: v.impressions,
      ctr:         Math.round((v.ctr.reduce((a, b) => a + b, 0) / v.ctr.length) * 100) / 100,
      position:    Math.round((v.position.reduce((a, b) => a + b, 0) / v.position.length) * 10) / 10,
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10)

  // ── Parse devices ──
  const deviceRows  = devicesRes.rows ?? []
  const deviceTotal = deviceRows.reduce((a: number, r: any) => a + (r.clicks ?? 0), 0) || 1
  const devices = deviceRows.map((r: any) => {
    const raw = (r.keys?.[0] ?? 'unknown') as string
    return {
      device:  raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase(),
      clicks:  Math.round(r.clicks ?? 0),
      pct:     Math.round((r.clicks ?? 0) / deviceTotal * 100),
    }
  })

  // ── Parse time series ──
  const timeSeries = (datesRes.rows ?? []).map((r: any) => ({
    date:        r.keys?.[0] ?? '',
    clicks:      Math.round(r.clicks      ?? 0),
    impressions: Math.round(r.impressions ?? 0),
    ctr:         Math.round((r.ctr        ?? 0) * 10000) / 100,
    position:    Math.round((r.position   ?? 0) * 10) / 10,
  }))

  return { overview, topQueries, topPages, devices, timeSeries, siteUrl: SITE_URL, dateRange: dates }
}
