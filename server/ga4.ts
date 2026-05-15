/**
 * Google Analytics 4 — Data API module
 * Auth: Service Account → JWT → OAuth2 access token (cached 1h)
 * Docs: https://developers.google.com/analytics/devguides/reporting/data/v1
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

const PROPERTY_ID = process.env.GA4_PROPERTY_ID ?? '423969803'
const KEY_FILE    = process.env.GA4_KEY_FILE    ?? './server/ga4-service-account.json'
const GA4_API     = `https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}`

// ── Load credentials ─────────────────────────────────────────────────────────

let _creds: {
  client_email: string
  private_key:  string
  token_uri:    string
} | null = null

function getCreds() {
  if (_creds) return _creds
  try {
    const raw = readFileSync(resolve(KEY_FILE), 'utf8')
    _creds = JSON.parse(raw)
    return _creds!
  } catch (e: any) {
    throw new Error(`GA4: Cannot read key file at ${KEY_FILE} — ${e.message}`)
  }
}

// ── JWT / Token ──────────────────────────────────────────────────────────────

function b64url(input: string | ArrayBuffer): string {
  const base64 = typeof input === 'string'
    ? Buffer.from(input).toString('base64')
    : Buffer.from(input).toString('base64')
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function pemToBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '')
  const binary = atob(b64)
  const bytes  = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

let _cachedToken  = ''
let _tokenExpiry  = 0

export async function getAccessToken(): Promise<string> {
  if (_cachedToken && Date.now() < _tokenExpiry) return _cachedToken

  const creds = getCreds()
  const now   = Math.floor(Date.now() / 1000)

  const header  = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({
    iss:   creds.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud:   creds.token_uri,
    exp:   now + 3600,
    iat:   now,
  }))

  const unsigned  = `${header}.${payload}`
  const keyData   = pemToBuffer(creds.private_key)
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign'],
  )
  const sigBuf  = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(unsigned))
  const jwt     = `${unsigned}.${b64url(sigBuf)}`

  const res = await fetch(creds.token_uri, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
    }),
  })
  if (!res.ok) throw new Error(`GA4 token fetch failed: ${await res.text()}`)

  const { access_token, expires_in } = await res.json() as { access_token: string; expires_in: number }
  _cachedToken = access_token
  _tokenExpiry = Date.now() + (expires_in - 60) * 1000
  return _cachedToken
}

// ── Report runner ─────────────────────────────────────────────────────────────

async function runReport(body: object): Promise<any> {
  const token = await getAccessToken()
  const res   = await fetch(`${GA4_API}:runReport`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`GA4 runReport failed: ${await res.text()}`)
  return res.json()
}

function parseRows(report: any): Record<string, string>[] {
  const dims = (report.dimensionHeaders ?? []).map((h: any) => h.name as string)
  const mets = (report.metricHeaders   ?? []).map((h: any) => h.name as string)
  return (report.rows ?? []).map((row: any) => {
    const obj: Record<string, string> = {}
    dims.forEach((d, i) => { obj[d] = row.dimensionValues?.[i]?.value ?? '' })
    mets.forEach((m, i) => { obj[m] = row.metricValues?.[i]?.value   ?? '0' })
    return obj
  })
}

function ga4DateRange(range?: string | null) {
  if (range === '7d')  return { startDate: '7daysAgo',  endDate: 'today' }
  if (range === '90d') return { startDate: '90daysAgo', endDate: 'today' }
  return                      { startDate: '30daysAgo', endDate: 'today' }
}

// ── Summary builder ───────────────────────────────────────────────────────────

export async function getGA4Summary(range?: string | null) {
  const dateRange = ga4DateRange(range)

  const [overviewRpt, timeSeriesRpt, channelRpt, deviceRpt, pagesRpt] = await Promise.all([

    // 1. Aggregate totals (no dimension)
    runReport({
      dateRanges: [dateRange],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
        { name: 'screenPageViews' },
        { name: 'conversions' },
        { name: 'newUsers' },
      ],
    }),

    // 2. Daily sessions/users/conversions for the chart
    runReport({
      dateRanges: [dateRange],
      dimensions: [{ name: 'date' }],
      metrics:    [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'conversions' }],
      orderBys:   [{ dimension: { dimensionName: 'date' }, desc: false }],
    }),

    // 3. Channel breakdown
    runReport({
      dateRanges: [dateRange],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics:    [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'conversions' }],
      orderBys:   [{ metric: { metricName: 'sessions' }, desc: true }],
    }),

    // 4. Device breakdown
    runReport({
      dateRanges: [dateRange],
      dimensions: [{ name: 'deviceCategory' }],
      metrics:    [{ name: 'sessions' }, { name: 'totalUsers' }],
      orderBys:   [{ metric: { metricName: 'sessions' }, desc: true }],
    }),

    // 5. Top 10 landing pages
    runReport({
      dateRanges: [dateRange],
      dimensions: [{ name: 'landingPage' }],
      metrics:    [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'screenPageViews' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
      ],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit:    10,
    }),
  ])

  // ── Parse overview ──
  const ovRow = parseRows(overviewRpt)[0] ?? {}
  const overview = {
    sessions:           Number(ovRow['sessions']              ?? 0),
    users:              Number(ovRow['totalUsers']            ?? 0),
    newUsers:           Number(ovRow['newUsers']              ?? 0),
    bounceRate:         Math.round(Number(ovRow['bounceRate'] ?? 0) * 1000) / 10, // fraction→%
    avgSessionDuration: Math.round(Number(ovRow['averageSessionDuration'] ?? 0)),
    pageViews:          Number(ovRow['screenPageViews']       ?? 0),
    conversions:        Number(ovRow['conversions']           ?? 0),
  }

  // ── Parse time series ──
  const timeSeries = parseRows(timeSeriesRpt).map(row => {
    const raw = row['date'] ?? ''      // YYYYMMDD
    const d   = raw.length === 8
      ? new Date(+raw.slice(0,4), +raw.slice(4,6) - 1, +raw.slice(6,8))
      : new Date(raw)
    return {
      date:        d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      sessions:    Number(row['sessions']    ?? 0),
      users:       Number(row['totalUsers']  ?? 0),
      conversions: Number(row['conversions'] ?? 0),
    }
  })

  // ── Parse channels ──
  const chRows     = parseRows(channelRpt)
  const chTotal    = chRows.reduce((a, r) => a + Number(r['sessions']), 0) || 1
  const channels   = chRows.map(r => ({
    channel:     r['sessionDefaultChannelGroup'] || 'Other',
    sessions:    Number(r['sessions']    ?? 0),
    users:       Number(r['totalUsers']  ?? 0),
    conversions: Number(r['conversions'] ?? 0),
    pct:         Math.round((Number(r['sessions']) / chTotal) * 100),
  }))

  // ── Parse devices ──
  const devRows  = parseRows(deviceRpt)
  const devTotal = devRows.reduce((a, r) => a + Number(r['sessions']), 0) || 1
  const devices  = devRows.map(r => ({
    device:   r['deviceCategory'] || 'other',
    sessions: Number(r['sessions']   ?? 0),
    users:    Number(r['totalUsers'] ?? 0),
    pct:      Math.round((Number(r['sessions']) / devTotal) * 100),
  }))

  // ── Parse top pages ──
  const topPages = parseRows(pagesRpt).slice(0, 10).map(r => ({
    page:        r['landingPage']            || '/',
    sessions:    Number(r['sessions']        ?? 0),
    users:       Number(r['totalUsers']      ?? 0),
    pageViews:   Number(r['screenPageViews'] ?? 0),
    bounceRate:  Math.round(Number(r['bounceRate'] ?? 0) * 1000) / 10,
    avgDuration: Math.round(Number(r['averageSessionDuration'] ?? 0)),
  }))

  return { overview, timeSeries, channels, devices, topPages }
}
