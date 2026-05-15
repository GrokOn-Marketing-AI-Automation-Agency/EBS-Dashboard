/**
 * Google Ads API module
 * Auth: OAuth2 refresh token flow
 * Queries: GAQL (Google Ads Query Language)
 */

const DEVELOPER_TOKEN = process.env.GADS_DEVELOPER_TOKEN ?? ''
const CUSTOMER_ID     = process.env.GADS_CUSTOMER_ID     ?? '4213913952'
const CLIENT_ID       = process.env.GADS_CLIENT_ID       ?? ''
const CLIENT_SECRET   = process.env.GADS_CLIENT_SECRET   ?? ''
const REFRESH_TOKEN   = process.env.GADS_REFRESH_TOKEN   ?? ''

const API_VERSION = 'v20'
const API_BASE    = `https://googleads.googleapis.com/${API_VERSION}/customers/${CUSTOMER_ID}`
const TOKEN_URL   = 'https://oauth2.googleapis.com/token'

// ── Auth ──────────────────────────────────────────────────────────────────────

let _cachedToken = ''
let _tokenExpiry = 0

async function getAccessToken(): Promise<string> {
  if (_cachedToken && Date.now() < _tokenExpiry) return _cachedToken

  const res = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type:    'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`Google Ads token error: ${await res.text()}`)

  const { access_token, expires_in } = await res.json() as { access_token: string; expires_in: number }
  _cachedToken = access_token
  _tokenExpiry = Date.now() + (expires_in - 60) * 1000
  return _cachedToken
}

// ── GAQL runner ───────────────────────────────────────────────────────────────

async function gaqlSearch(query: string): Promise<any[]> {
  const token = await getAccessToken()
  let allResults: any[] = []
  let pageToken: string | undefined

  do {
    const body: any = { query }
    if (pageToken) body.pageToken = pageToken

    const res = await fetch(`${API_BASE}/googleAds:search`, {
      method:  'POST',
      headers: {
        'Authorization':   `Bearer ${token}`,
        'developer-token': DEVELOPER_TOKEN,
        'Content-Type':    'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) throw new Error(`Google Ads GAQL: ${await res.text()}`)

    const data = await res.json()
    allResults = allResults.concat(data.results ?? [])
    pageToken  = data.nextPageToken
  } while (pageToken)

  return allResults
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const micro = (v: any) => Math.round(Number(v ?? 0) / 1_000_000 * 100) / 100

function fmtDate(d: Date) { return d.toISOString().slice(0, 10) }

function getRange(range?: string | null) {
  const days      = range === '7d' ? 7 : range === '90d' ? 90 : 30

  // For time series chart: end = yesterday (last complete day, matches Google UI convention)
  const endDate   = new Date()
  endDate.setDate(endDate.getDate() - 1)          // yesterday = last complete day
  const startDate = new Date(endDate)
  startDate.setDate(endDate.getDate() - (days - 1)) // inclusive range of `days` complete days

  // GAQL DURING literals — only LAST_7_DAYS and LAST_30_DAYS are valid
  // For 90d we must use BETWEEN date strings (LAST_90_DAYS is not a valid literal)
  const duringClause =
    range === '7d'  ? 'segments.date DURING LAST_7_DAYS' :
    range === '90d' ? `segments.date BETWEEN '${fmtDate(startDate)}' AND '${fmtDate(endDate)}'` :
                      'segments.date DURING LAST_30_DAYS'

  return {
    days,
    // Use DURING for 7d/30d (matches Google UI exactly), BETWEEN for 90d
    dateFilter: duringClause,
    // Always use BETWEEN for time-series (needs explicit date strings)
    between:    `segments.date BETWEEN '${fmtDate(startDate)}' AND '${fmtDate(endDate)}'`,
    start:      fmtDate(startDate),
    end:        fmtDate(endDate),
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function getGoogleAdsSummary(range?: string | null) {
  const dr = getRange(range)

  const [
    campaignPeriodRows,
    campaignAllTimeRows,
    keywordPeriodRows,
    timeSeriesRows,
    callRows,
  ] = await Promise.allSettled([

    // 1. Campaign metrics for selected period
    // Uses DURING LAST_7_DAYS / LAST_30_DAYS to match Google Ads UI date convention exactly
    // (DURING aggregates per campaign, not per day — avoids row multiplication)
    gaqlSearch(`
      SELECT
        campaign.name,
        campaign.status,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.ctr,
        metrics.average_cpc
      FROM campaign
      WHERE campaign.status != 'REMOVED'
        AND ${dr.dateFilter}
      ORDER BY metrics.cost_micros DESC
    `),

    // 2. All-time campaign totals (for lifetime context — always shown)
    gaqlSearch(`
      SELECT
        campaign.name,
        campaign.status,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.ctr,
        metrics.average_cpc
      FROM campaign
      WHERE campaign.status != 'REMOVED'
      ORDER BY metrics.cost_micros DESC
    `),

    // 3. Top keywords for selected period
    gaqlSearch(`
      SELECT
        ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.ctr,
        metrics.average_cpc
      FROM keyword_view
      WHERE ad_group_criterion.status != 'REMOVED'
        AND ${dr.dateFilter}
        AND metrics.impressions > 0
      ORDER BY metrics.clicks DESC
      LIMIT 15
    `),

    // 4. Daily time series for chart
    gaqlSearch(`
      SELECT
        segments.date,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions,
        metrics.conversions
      FROM campaign
      WHERE campaign.status != 'REMOVED'
        AND ${dr.between}
      ORDER BY segments.date ASC
    `),

    // 5. Call conversion details
    gaqlSearch(`
      SELECT
        call_view.caller_area_code,
        call_view.call_duration_seconds,
        call_view.call_status,
        call_view.start_call_date_time,
        call_view.type,
        campaign.name
      FROM call_view
      WHERE call_view.start_call_date_time >= '${dr.start} 00:00:00'
        AND call_view.start_call_date_time <= '${dr.end} 23:59:59'
      ORDER BY call_view.start_call_date_time DESC
    `),
  ])

  // ── Period campaigns ──────────────────────────────────────────────────────
  const campaignsPeriod = campaignPeriodRows.status === 'fulfilled'
    ? campaignPeriodRows.value
        .filter((r: any) => Number(r.metrics?.costMicros ?? 0) > 0 || Number(r.metrics?.impressions ?? 0) > 0)
        .map((r: any) => ({
          name:        r.campaign?.name        ?? 'Unknown',
          status:      r.campaign?.status      ?? 'UNKNOWN',
          spend:       micro(r.metrics?.costMicros),
          clicks:      Number(r.metrics?.clicks      ?? 0),
          impressions: Number(r.metrics?.impressions ?? 0),
          conversions: Math.round(Number(r.metrics?.conversions ?? 0) * 100) / 100,
          ctr:         Math.round(Number(r.metrics?.ctr ?? 0) * 1000000) / 10000,
          avgCpc:      micro(r.metrics?.averageCpc),
        }))
    : []

  // ── All-time campaigns ────────────────────────────────────────────────────
  const campaignsAllTime = campaignAllTimeRows.status === 'fulfilled'
    ? campaignAllTimeRows.value.map((r: any) => ({
        name:        r.campaign?.name        ?? 'Unknown',
        status:      r.campaign?.status      ?? 'UNKNOWN',
        spend:       micro(r.metrics?.costMicros),
        clicks:      Number(r.metrics?.clicks      ?? 0),
        impressions: Number(r.metrics?.impressions ?? 0),
        conversions: Math.round(Number(r.metrics?.conversions ?? 0) * 10) / 10,
        ctr:         Math.round(Number(r.metrics?.ctr ?? 0) * 10000) / 100,
        avgCpc:      micro(r.metrics?.averageCpc),
      }))
    : []

  // Show period campaigns if any have data, otherwise fall back to all-time
  const hasPeriodData = campaignsPeriod.length > 0
  const campaigns     = hasPeriodData ? campaignsPeriod : campaignsAllTime

  // ── Totals ────────────────────────────────────────────────────────────────
  function sumCampaigns(list: typeof campaigns) {
    const t = list.reduce(
      (acc, c) => ({
        spend:       acc.spend       + c.spend,
        clicks:      acc.clicks      + c.clicks,
        impressions: acc.impressions + c.impressions,
        conversions: acc.conversions + c.conversions,
      }),
      { spend: 0, clicks: 0, impressions: 0, conversions: 0 }
    )
    return {
      ...t,
      spend:             Math.round(t.spend * 100) / 100,
      costPerConversion: t.conversions > 0 ? Math.round((t.spend / t.conversions) * 100) / 100 : 0,
      ctr:               t.impressions > 0 ? Math.round((t.clicks / t.impressions) * 1000000) / 10000 : 0,
    }
  }

  const totals        = sumCampaigns(campaigns)
  const totalsAllTime = sumCampaigns(campaignsAllTime)

  // ── Daily time series ─────────────────────────────────────────────────────
  // Aggregate across all campaigns per date
  const dateMap: Record<string, { spend: number; clicks: number; impressions: number; conversions: number }> = {}

  if (timeSeriesRows.status === 'fulfilled') {
    for (const r of timeSeriesRows.value) {
      const date = r.segments?.date ?? ''
      if (!date) continue
      if (!dateMap[date]) dateMap[date] = { spend: 0, clicks: 0, impressions: 0, conversions: 0 }
      dateMap[date].spend       += micro(r.metrics?.costMicros)
      dateMap[date].clicks      += Number(r.metrics?.clicks      ?? 0)
      dateMap[date].impressions += Number(r.metrics?.impressions ?? 0)
      dateMap[date].conversions += Number(r.metrics?.conversions ?? 0)
    }
  }

  const timeSeries = Object.entries(dateMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, m]) => ({
      date:        date.slice(5),   // "MM-DD" for display
      spend:       Math.round(m.spend * 100) / 100,
      clicks:      m.clicks,
      impressions: m.impressions,
      conversions: Math.round(m.conversions * 10) / 10,
    }))

  // ── Keywords ─────────────────────────────────────────────────────────────
  const keywordsPeriod = keywordPeriodRows.status === 'fulfilled'
    ? keywordPeriodRows.value.map((r: any) => ({
        keyword:     r.adGroupCriterion?.keyword?.text      ?? '—',
        matchType:   r.adGroupCriterion?.keyword?.matchType ?? 'BROAD',
        clicks:      Number(r.metrics?.clicks      ?? 0),
        impressions: Number(r.metrics?.impressions ?? 0),
        cost:        micro(r.metrics?.costMicros),
        conversions: Math.round(Number(r.metrics?.conversions ?? 0) * 10) / 10,
        ctr:         Math.round(Number(r.metrics?.ctr ?? 0) * 10000) / 100,
        avgCpc:      micro(r.metrics?.averageCpc),
      }))
    : []

  // Fall back to all-time keywords if period has none
  const allTimeKeywords = hasPeriodData ? [] : await gaqlSearch(`
    SELECT
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.impressions,
      metrics.ctr,
      metrics.average_cpc
    FROM keyword_view
    WHERE ad_group_criterion.status != 'REMOVED'
      AND metrics.clicks > 0
    ORDER BY metrics.clicks DESC
    LIMIT 15
  `).then(rows => rows.map((r: any) => ({
    keyword:     r.adGroupCriterion?.keyword?.text      ?? '—',
    matchType:   r.adGroupCriterion?.keyword?.matchType ?? 'BROAD',
    clicks:      Number(r.metrics?.clicks      ?? 0),
    impressions: Number(r.metrics?.impressions ?? 0),
    cost:        micro(r.metrics?.costMicros),
    conversions: Math.round(Number(r.metrics?.conversions ?? 0) * 10) / 10,
    ctr:         Math.round(Number(r.metrics?.ctr ?? 0) * 10000) / 100,
    avgCpc:      micro(r.metrics?.averageCpc),
  }))).catch(() => [])

  const keywords = keywordsPeriod.length > 0 ? keywordsPeriod : allTimeKeywords

  // ── Call conversions ──────────────────────────────────────────────────────
  const callConversions = callRows.status === 'fulfilled'
    ? callRows.value.map((r: any, i: number) => ({
        id:           `gads-call-${i}`,
        areaCode:     r.callView?.callerAreaCode           ?? '???',
        durationSecs: Number(r.callView?.callDurationSeconds ?? 0),
        status:       r.callView?.callStatus               ?? 'UNKNOWN',
        date:         r.callView?.startCallDateTime         ?? new Date().toISOString(),
        campaign:     r.campaign?.name                     ?? 'Unknown Campaign',
        trackingName: r.callView?.type ?? '',
      }))
    : []

  const allPaused = campaignsAllTime.length > 0 &&
    campaignsAllTime.every(c => c.status === 'PAUSED')

  // Warn about queries that failed
  for (const [label, result] of [
    ['campaigns(period)', campaignPeriodRows],
    ['campaigns(alltime)', campaignAllTimeRows],
    ['keywords', keywordPeriodRows],
    ['timeSeries', timeSeriesRows],
    ['calls', callRows],
  ] as const) {
    if (result.status === 'rejected') {
      console.warn(`[Google Ads] ${label} failed:`, (result as any).reason?.message)
    }
  }

  return {
    range:          range ?? '30d',
    hasPeriodData,
    allPaused,
    totals,
    totalsAllTime,
    campaigns,
    campaignsAllTime,
    keywords,
    timeSeries,
    callConversions,
    hasCallData: callRows.status === 'fulfilled' && callRows.value.length > 0,
  }
}

export const isConfigured = () => !!(DEVELOPER_TOKEN && CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN)
