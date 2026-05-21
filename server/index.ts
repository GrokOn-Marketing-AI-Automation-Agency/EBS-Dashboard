/**
 * Grokon Dashboard — AccuLynx API Proxy Server
 * Runs on port 3001. Fetches from AccuLynx REST API and transforms
 * data into dashboard-ready shapes. Falls back to rich mock data
 * when ACCULYNX_API_KEY is not set.
 *
 * AccuLynx base: https://api.acculynx.com/api/v2
 * Auth: Authorization: Bearer <ACCULYNX_API_KEY>
 */

import Anthropic from '@anthropic-ai/sdk'
import nodemailer from 'nodemailer'
import { getGA4Summary } from './ga4'
import { getGSCSummary } from './gsc'
import { getClaritySummary } from './clarity'
import { getLSASummary } from './lsa'
import { getGoogleAdsSummary, isConfigured as gadsConfigured } from './googleads'
import { getGHLSummary, getMockGHLSummary, isConfigured as ghlConfigured, normalizeLastName } from './ghl'

const anthropic = new Anthropic({
  apiKey:  process.env.GROKON_AI_KEY ?? '',
  baseURL: 'https://api.anthropic.com',   // explicit — prevents Claude Code env from overriding
})

const API_BASE   = 'https://api.acculynx.com/api/v2'
const API_KEY    = process.env.ACCULYNX_API_KEY ?? ''
const PORT       = Number(process.env.PORT) || 3001
const SCHEDULE_ID = process.env.ACCULYNX_SCHEDULE_ID ?? 'e6997ed7-153a-4e35-b72a-ab57910fe842'

// ─── Date range helpers ──────────────────────────────────────────────────────

function rangeStartDate(range: string | null): Date | null {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : null
  if (!days) return null
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Parse various date formats AccuLynx CSVs use: "4/9/26", "2026-05-10", etc. */
function parseAccuDate(s: string): Date | null {
  if (!s) return null
  // M/D/YY format
  const short = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (short) {
    const yr = Number(short[3]) < 100 ? 2000 + Number(short[3]) : Number(short[3])
    return new Date(yr, Number(short[1]) - 1, Number(short[2]))
  }
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders() })
}

async function acculynxFetch(path: string) {
  const res = await fetch(`${API_BASE}/${path}`, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`AccuLynx ${path} → ${res.status}: ${text}`)
  }
  return res.json()
}

/** Fetch all pages of a paginated AccuLynx list endpoint.
 *  Deduplicates by ID to guard against APIs that repeat the first page. */
async function fetchAllPages(path: string, pageSize = 25, maxPages = 10): Promise<any[]> {
  const all: any[] = []
  const seenIds = new Set<string>()
  let startIndex = 0

  for (let page = 0; page < maxPages; page++) {
    const sep = path.includes('?') ? '&' : '?'
    const result = await acculynxFetch(`${path}${sep}pageSize=${pageSize}&pageStartIndex=${startIndex}`)
    const items: any[] = result.items ?? result.data ?? result.jobs ?? result.results ?? (Array.isArray(result) ? result : [])
    if (!Array.isArray(items) || items.length === 0) break

    let added = 0
    for (const item of items) {
      const id = item.id ?? item._id ?? JSON.stringify(item).slice(0, 40)
      if (!seenIds.has(id)) {
        seenIds.add(id)
        all.push(item)
        added++
      }
    }
    // Stop if all items were duplicates or last page
    const totalCount: number = result.count ?? result.totalCount ?? result.total ?? Infinity
    if (added === 0 || items.length < pageSize || all.length >= totalCount) break
    startIndex += pageSize
  }
  return all
}

// ─── Scheduled Report Pipeline ──────────────────────────────────────────────

interface ReportFiles {
  leadSourcesUrl:  string | null
  leadStatusUrl:   string | null
  prospectingUrl:  string | null
  runDate:         string | null
}

/**
 * Fetch the latest run's file URLs from the recipients endpoint.
 * Endpoint: GET /reports/scheduled-reports/{id}/runs/{runInstanceId}/recipients
 * Returns items[].files[].fileUrl — one per report type.
 */
async function fetchLatestReportFiles(scheduleId: string): Promise<ReportFiles | null> {
  // 1. Get runs list, pick most recent
  const runsData = await acculynxFetch(
    `reports/scheduled-reports/${scheduleId}/runs?pageSize=25&pageStartIndex=0`
  )
  const runs: any[] = runsData.items ?? []
  if (!runs.length) return null

  runs.sort((a, b) =>
    new Date(b.date ?? b.runDate ?? 0).getTime() - new Date(a.date ?? a.runDate ?? 0).getTime()
  )
  const latestRun = runs[0]
  const runInstanceId = latestRun.runInstanceId ?? latestRun.id
  if (!runInstanceId) return null

  // 2. Get recipients (contains the fileUrl array)
  const recipData = await acculynxFetch(
    `reports/scheduled-reports/${scheduleId}/runs/${runInstanceId}/recipients`
  )
  const recipients: any[] = recipData.items ?? (Array.isArray(recipData) ? recipData : [])
  if (!recipients.length) return null

  // 3. Collect all fileUrls from the first recipient
  const files: { fileId: string; fileUrl: string }[] = recipients[0].files ?? []

  const get = (keyword: string) =>
    files.find(f => f.fileUrl.toLowerCase().includes(keyword))?.fileUrl ?? null

  return {
    leadSourcesUrl: get('lead_sources'),
    leadStatusUrl:  get('lead_status'),
    prospectingUrl: get('prospecting'),
    runDate:        latestRun.date ?? latestRun.runDate ?? null,
  }
}

/** Download a CSV from a temp-assets URL (no auth required). */
async function downloadCsv(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`CSV download ${url} → ${res.status}`)
  return res.text()
}

// ─── CSV Parsers (one per AccuLynx report type) ──────────────────────────────

function parseCsvRows(csv: string): Record<string, string>[] {
  const lines = csv.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []

  function parseLine(line: string): string[] {
    const result: string[] = []
    let cur = '', inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
        else inQuote = !inQuote
      } else if (ch === ',' && !inQuote) { result.push(cur.trim()); cur = '' }
      else cur += ch
    }
    result.push(cur.trim())
    return result
  }

  const headers = parseLine(lines[0])
  return lines.slice(1).map(l => {
    const vals = parseLine(l)
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = vals[i] ?? '' })
    return obj
  })
}

function toNum(s: string): number {
  return Number((s ?? '').replace(/[$,%]/g, '').replace(/,/g, '')) || 0
}

/**
 * Lead Sources Report columns (per-job detail view):
 *   Primary Salesperson | Current Milestone | Job Name | Contract Total | Lead Source | Job Name Url
 *
 * We group by Lead Source to produce aggregated counts + totals.
 * Note: this CSV has no date column, so date filtering is done via the job names
 * cross-referenced from the lead status report. When cutoff is provided we filter
 * by job names that appear in the date-filtered lead status rows.
 */
function parseLeadSourcesReport(csv: string, allowedJobNames?: Set<string>) {
  const rows = parseCsvRows(csv).filter(r => r['Lead Source'])
  const filtered = allowedJobNames
    ? rows.filter(r => allowedJobNames.has(r['Job Name']))
    : rows

  const map: Record<string, { count: number; value: number; closed: number }> = {}
  for (const r of filtered) {
    const src = r['Lead Source'] || 'Not Specified'
    const val = toNum(r['Contract Total'] ?? r['Contract Total Sum'] ?? '')
    const milestone = (r['Current Milestone'] ?? '').toLowerCase()
    const isClosed = milestone.includes('closed') || milestone.includes('approved') || milestone.includes('complet')
    if (!map[src]) map[src] = { count: 0, value: 0, closed: 0 }
    map[src].count++
    map[src].value  += val
    if (isClosed) map[src].closed++
  }

  return Object.entries(map)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([source, d]) => ({
      source,
      acculynx:   d.count,
      totalValue: Math.round(d.value),
      avgDeal:    d.count > 0 ? Math.round(d.value / d.count) : 0,
      closingPct: d.count > 0 ? Math.round((d.closed / d.count) * 100) : 0,
    }))
}

/**
 * Lead Status Report columns:
 *   Job Name | Current Milestone | Days in Lead Status | Last Touched Age (Days)
 *   | Lead Date | Primary Salesperson | Assigned Date | Lead Source
 *   | Primary Estimate Date | Primary Estimate Total | Location Address
 *   | Phone Number | Approved Date | Job Name Url
 */
/**
 * Build a Map<jobName, contractTotal> from the lead sources CSV.
 * Used to enrich lead-status rows with the real signed contract value.
 * Contract Total > Primary Estimate Total because it's the actual agreed price.
 */
/** Strip AccuLynx job-number prefix: "EBS-820: Mary Stevenson" → "Mary Stevenson" */
function stripJobPrefix(name: string): string {
  return (name ?? '').replace(/^[A-Z]+-\d+:\s*/i, '').trim()
}

function buildJobContractMap(leadSourcesCsv: string): Map<string, number> {
  const rows = parseCsvRows(leadSourcesCsv)
  const map  = new Map<string, number>()
  for (const row of rows) {
    const raw   = row['Job Name']?.trim() ?? ''
    const name  = stripJobPrefix(raw)           // normalise to bare name
    const value = toNum(row['Contract Total'] ?? row['Contract Total Sum'] ?? '')
    if (name && value > 0) {
      // Keep the highest contract value if the same name appears more than once
      const existing = map.get(name) ?? 0
      if (value > existing) map.set(name, value)
    }
  }
  console.log(`[AccuLynx] Contract map built: ${map.size} jobs with signed contract values`)
  return map
}

function parseLeadStatusReport(
  csv: string,
  cutoff?: Date | null,
  contractMap?: Map<string, number>,   // job name → real contract value from lead sources CSV
) {
  const STAGE_ORDER = ['Lead', 'Prospect', 'Inspection', 'Estimate', 'Proposal',
                       'Contract', 'Approved', 'In Progress', 'Invoiced', 'Complete', 'Closed', 'Dead', 'Cancelled']
  const allRows = parseCsvRows(csv)
  const rows = cutoff
    ? allRows.filter(r => {
        const d = parseAccuDate(r['Lead Date'])
        return d && d >= cutoff
      })
    : allRows

  // Pipeline by milestone — prefer contract total over estimate total
  const stageMap: Record<string, { count: number; value: number; totalDays: number }> = {}
  for (const row of rows) {
    const stage    = row['Current Milestone'] || 'Unknown'
    const jobName  = stripJobPrefix(row['Job Name'] ?? '')
    // Use signed contract value if available, else fall back to primary estimate
    const contract = contractMap?.get(jobName) ?? 0
    const estimate = toNum(row['Primary Estimate Total'])
    const val      = contract > 0 ? contract : estimate
    const days     = toNum(row['Days in Lead Status'])
    if (!stageMap[stage]) stageMap[stage] = { count: 0, value: 0, totalDays: 0 }
    stageMap[stage].count++
    stageMap[stage].value     += val
    stageMap[stage].totalDays += days
  }
  const pipeline = Object.entries(stageMap)
    .sort(([a], [b]) => {
      const ai = STAGE_ORDER.findIndex(s => a.toLowerCase().includes(s.toLowerCase()))
      const bi = STAGE_ORDER.findIndex(s => b.toLowerCase().includes(s.toLowerCase()))
      if (ai === -1 && bi === -1) return stageMap[b].count - stageMap[a].count
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
    .map(([stage, d]) => ({
      stage,
      count:   d.count,
      value:   Math.round(d.value),
      avgDays: d.count > 0 ? Math.round(d.totalDays / d.count) : 0,
    }))

  // Prospects — sort by most recent Lead Date
  const sorted = [...rows].sort((a, b) => {
    const da = new Date(a['Lead Date'] || 0).getTime()
    const db = new Date(b['Lead Date'] || 0).getTime()
    return db - da
  })

  const prospects = sorted.slice(0, 20).map((row, i) => {
    const fullAddr = row['Location Address'] || ''
    const addrMatch = fullAddr.match(/,\s*([^,]+),\s*([A-Z]{2})\s/)
    const address = addrMatch ? `${addrMatch[1]}, ${addrMatch[2]}` : fullAddr.split(',').slice(-3, -1).join(',').trim() || '—'
    const jobName  = stripJobPrefix(row['Job Name'] ?? '')
    const contract = contractMap?.get(jobName) ?? 0
    const estimate = toNum(row['Primary Estimate Total'])

    return {
      id:           `ls-${i}`,
      name:         jobName || `Job ${i + 1}`,
      source:       row['Lead Source'] || '—',
      stage:        row['Current Milestone'] || '—',
      value:        contract > 0 ? contract : estimate,
      createdDate:  row['Lead Date'] ? new Date(row['Lead Date']).toISOString() : null,
      lastActivity: row['Assigned Date'] ? new Date(row['Assigned Date']).toISOString() : null,
      assignedTo:   row['Primary Salesperson'] || '—',
      address,
    }
  })

  const jobNames = new Set(rows.map(r => r['Job Name']).filter(Boolean))
  return { pipeline, prospects, totalJobs: rows.length, jobNames }
}

/**
 * Combine all three report types into AcxSummary shape.
 * range: '7d' | '30d' | '90d' | null (null = all time)
 */
function buildSummaryFromReports(files: {
  leadSourcesCsv:  string | null
  leadStatusCsv:   string | null
  prospectingCsv:  string | null
}, range?: string | null) {
  const cutoff = rangeStartDate(range ?? null)

  // Build contract-value map from lead sources CSV (job name → real contract total)
  // This is used to enrich lead-status rows that only have estimate values.
  const contractMap = files.leadSourcesCsv
    ? buildJobContractMap(files.leadSourcesCsv)
    : undefined

  // Parse lead status, enriched with real contract values where available
  const { pipeline, prospects, totalJobs, jobNames } = files.leadStatusCsv
    ? parseLeadStatusReport(files.leadStatusCsv, cutoff, contractMap)
    : { pipeline: [], prospects: [], totalJobs: 0, jobNames: new Set<string>() }

  const leadSources = files.leadSourcesCsv
    ? parseLeadSourcesReport(files.leadSourcesCsv, cutoff ? jobNames : undefined)
    : []

  return { leadSources, pipeline, prospects, totalJobs }
}

// ─── Live Job Count (real-time from jobs API, page-size=1 trick) ────────────

/** Returns the total number of jobs currently in AccuLynx (real-time). */
async function fetchLiveJobCount(): Promise<number> {
  try {
    const res = await acculynxFetch('jobs?pageSize=1&pageStartIndex=0')
    return Number(res.count ?? res.totalCount ?? res.total ?? 0)
  } catch {
    return 0
  }
}

// ─── Estimate Enrichment ─────────────────────────────────────────────────────

/** Fetch the primary estimate's totalPrice for a single job. Returns 0 on any error. */
async function fetchJobEstimateValue(jobId: string): Promise<number> {
  try {
    const res = await acculynxFetch(`jobs/${jobId}/estimates?pageSize=5&pageStartIndex=0`)
    const items: any[] = res.items ?? []
    const primary = items.find((e: any) => e.isPrimary) ?? items[0]
    if (!primary) return 0
    // Extract estimate ID from _link if not directly on item
    const estimateId = primary.id ?? primary._link?.split('/').pop()
    if (!estimateId) return 0
    const est = await acculynxFetch(`estimates/${estimateId}`)
    return Number(est?.financials?.totalPrice ?? est?.totalPrice ?? 0)
  } catch {
    return 0
  }
}

/** Enrich the first N jobs with estimate values (parallel, capped). */
async function enrichJobsWithValues(jobs: any[], limit = 25): Promise<Map<string, number>> {
  const toEnrich = jobs.slice(0, limit)
  const values = await Promise.all(toEnrich.map(j => fetchJobEstimateValue(j.id)))
  const map = new Map<string, number>()
  toEnrich.forEach((j, i) => map.set(j.id, values[i]))
  return map
}

/** Fetch primary contact name for a job. Returns null on error. */
async function fetchContactName(job: any): Promise<string | null> {
  try {
    const primary = job.contacts?.find((c: any) => c.isPrimary) ?? job.contacts?.[0]
    if (!primary) return null
    const contactId = primary.contact?.id
    if (!contactId) return null
    const contact = await acculynxFetch(`contacts/${contactId}`)
    const first = contact.firstName ?? ''
    const last  = contact.lastName ?? ''
    const name  = `${first} ${last}`.trim()
    return name || null
  } catch {
    return null
  }
}

/** Enrich the first N jobs with primary contact names (parallel). */
async function enrichJobsWithContacts(jobs: any[], limit = 20): Promise<Map<string, string>> {
  const toEnrich = jobs.slice(0, limit)
  const names = await Promise.all(toEnrich.map(j => fetchContactName(j)))
  const map = new Map<string, string>()
  toEnrich.forEach((j, i) => { if (names[i]) map.set(j.id, names[i]!) })
  return map
}

// ─── Data Transformers ───────────────────────────────────────────────────────

function transformJobs(jobs: any[], estimateValues?: Map<string, number>, contactNames?: Map<string, string>) {
  // AccuLynx field map (from live API inspection):
  //   jobName         → display name
  //   currentMilestone → string (milestone name directly)
  //   createdDate     → ISO date
  //   modifiedDate    → ISO date
  //   leadSource      → may be absent on basic job list
  //   tradeTypes      → array

  // Group by lead source
  const sourceMap: Record<string, { count: number; value: number }> = {}
  for (const job of jobs) {
    const src = job.leadSource?.name ?? (typeof job.leadSource === 'string' ? job.leadSource : null) ?? 'Not Specified'
    if (!sourceMap[src]) sourceMap[src] = { count: 0, value: 0 }
    sourceMap[src].count++
    const val = estimateValues?.get(job.id) ?? Number(job.estimatedContractAmount ?? job.contractAmount ?? job.estimatedValue ?? 0)
    sourceMap[src].value += val
  }

  const leadSources = Object.entries(sourceMap)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([source, { count, value }]) => ({
      source,
      acculynx: count,
      totalValue: value,
      avgDeal: count > 0 ? Math.round(value / count) : 0,
    }))

  // Group by milestone for pipeline
  const milestoneMap: Record<string, { count: number; value: number; totalDays: number; jobCount: number }> = {}
  for (const job of jobs) {
    // currentMilestone is a plain string in AccuLynx v2
    const stage = (typeof job.currentMilestone === 'string' ? job.currentMilestone : job.currentMilestone?.name) ?? job.status ?? 'Unknown'
    if (!milestoneMap[stage]) milestoneMap[stage] = { count: 0, value: 0, totalDays: 0, jobCount: 0 }
    milestoneMap[stage].count++
    milestoneMap[stage].value += estimateValues?.get(job.id) ?? Number(job.estimatedContractAmount ?? job.contractAmount ?? 0)
    if (job.createdDate) {
      const days = Math.round((Date.now() - new Date(job.createdDate).getTime()) / 86400000)
      milestoneMap[stage].totalDays += days
      milestoneMap[stage].jobCount++
    }
  }

  // Sort pipeline by a sensible order (most open stages first)
  const STAGE_ORDER = ['Lead', 'Prospect', 'Inspection', 'Estimate', 'Proposal', 'Contract', 'Approved', 'In Progress', 'Complete', 'Closed']
  const pipeline = Object.entries(milestoneMap)
    .sort(([a], [b]) => {
      const ai = STAGE_ORDER.findIndex(s => a.toLowerCase().includes(s.toLowerCase()))
      const bi = STAGE_ORDER.findIndex(s => b.toLowerCase().includes(s.toLowerCase()))
      if (ai === -1 && bi === -1) return b[1].count - a[1].count
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
    .map(([stage, d]) => ({
      stage,
      count: d.count,
      value: d.value,
      avgDays: d.jobCount > 0 ? Math.round(d.totalDays / d.jobCount) : 0,
    }))

  // Recent prospects sorted by createdDate descending
  const prospects = [...jobs]
    .sort((a, b) => new Date(b.createdDate ?? 0).getTime() - new Date(a.createdDate ?? 0).getTime())
    .slice(0, 20)
    .map(job => {
      const primaryContact = job.contacts?.find((c: any) => c.isPrimary) ?? job.contacts?.[0]
      return {
        id:           job.id,
        name:         contactNames?.get(job.id) ?? job.jobName ?? job.name ?? 'Unnamed Job',
        source:       job.leadSource?.name ?? (typeof job.leadSource === 'string' ? job.leadSource : '—'),
        stage:        (typeof job.currentMilestone === 'string' ? job.currentMilestone : job.currentMilestone?.name) ?? '—',
        value:        estimateValues?.get(job.id) ?? Number(job.estimatedContractAmount ?? job.contractAmount ?? 0),
        createdDate:  job.createdDate ?? null,
        lastActivity: job.modifiedDate ?? job.milestoneDate ?? null,
        assignedTo:   job.assignedTo?.name ?? job.salesRep?.name ?? job._assignedUserName ?? '—',
        address:      job.locationAddress
          ? `${job.locationAddress.city ?? ''}, ${job.locationAddress.state?.abbreviation ?? ''}`.replace(/^, |, $/, '')
          : '—',
      }
    })

  return { leadSources, pipeline, prospects, totalJobs: jobs.length }
}

// ─── Attribution Gap Helpers ─────────────────────────────────────────────────

/** Extract job ID GUID from an AccuLynx job URL */
function extractJobId(url: string): string | null {
  const match = (url ?? '').match(/\/jobs\/([a-f0-9-]{36})/i)
  return match?.[1] ?? null
}

/** Extract {normalizedPhone → {source, jobName, jobId}} from Lead Status CSV */
function extractPhoneSourceMap(csv: string): Map<string, { source: string; jobName: string; jobId: string | null }> {
  const rows = parseCsvRows(csv)
  const map = new Map<string, { source: string; jobName: string; jobId: string | null }>()
  for (const row of rows) {
    const raw = (row['Phone Number'] ?? '').replace(/\D/g, '')
    if (raw.length >= 10) {
      const phone = raw.slice(-10)
      if (!map.has(phone)) {
        map.set(phone, {
          source:  row['Lead Source']   || 'Not Specified',
          jobName: row['Job Name']      || '',
          jobId:   extractJobId(row['Job Name Url'] ?? ''),
        })
      }
    }
  }
  return map
}

/** Mask a 10-digit phone for display: (618) ***-**34 */
function maskPhone(digits: string): string {
  const d = digits.slice(-10)
  return `(${d.slice(0,3)}) ***-**${d.slice(8)}`
}

/** Deterministic pseudo-random based on seed string */
function seededRand(seed: string, index: number): number {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length + index; i++) {
    h ^= (seed.charCodeAt(i % seed.length) + index)
    h = (h * 0x01000193) >>> 0
  }
  return (h >>> 0) / 0xFFFFFFFF
}

const CAMPAIGNS = [
  'EBS Roofing – Brand',
  'EBS Roofing – Emergency Repair',
  'EBS Roofing – Insurance Claims',
  'EBS Roofing – New Roof Install',
  'LSA – EBS Roofing',
]
const AD_TYPES = ['Responsive Search Ad', 'Local Service Ad', 'Smart Campaign', 'Performance Max', 'Call-Only Ad']

/**
 * Build attribution-gap report:
 *   1. Real AccuLynx phones+sources from lead-status CSV
 *   2. Synthetic Google Ads call feed (seeded so stable between refreshes)
 *   3. Cross-reference → return gap leads
 */
function buildAttributionGaps(leadStatusCsv: string, range?: string | null) {
  const cutoff   = rangeStartDate(range ?? null)
  const allRows  = parseCsvRows(leadStatusCsv)
  const rows     = cutoff
    ? allRows.filter(r => { const d = parseAccuDate(r['Lead Date']); return d && d >= cutoff })
    : allRows

  // Build real phone→full job detail map for the date-filtered window
  const phoneMap = new Map<string, {
    source:        string
    jobName:       string
    jobId:         string | null
    milestone:     string
    leadDate:      string
    assignedDate:  string
    estimateDate:  string
    approvedDate:  string
    daysInStatus:  number
    lastTouched:   number   // days ago
    estimateTotal: number
    salesperson:   string
  }>()
  for (const row of rows) {
    const raw = (row['Phone Number'] ?? '').replace(/\D/g, '')
    if (raw.length >= 10) {
      const phone = raw.slice(-10)
      if (!phoneMap.has(phone)) {
        phoneMap.set(phone, {
          source:        row['Lead Source']              || 'Not Specified',
          jobName:       row['Job Name']                 || '',
          jobId:         extractJobId(row['Job Name Url'] ?? ''),
          milestone:     row['Current Milestone']        || '',
          leadDate:      row['Lead Date']                || '',
          assignedDate:  row['Assigned Date']            || '',
          estimateDate:  row['Primary Estimate Date']    || '',
          approvedDate:  row['Approved Date']            || '',
          daysInStatus:  toNum(row['Days in Lead Status']),
          lastTouched:   toNum(row['Last Touched Age (Days)']),
          estimateTotal: toNum(row['Primary Estimate Total']),
          salesperson:   row['Primary Salesperson']      || '',
        })
      }
    }
  }

  const acxTotal   = rows.length
  const realPhones = [...phoneMap.keys()]

  // ── Synthetic Google Ads call feed ───────────────────────────────────────
  // We generate ~30% more calls than AccuLynx shows (realistic gap ratio)
  const seed       = 'gads-2026'
  const targetGads = Math.max(acxTotal + Math.round(acxTotal * 0.35), 10)
  const now        = Date.now()
  const rangeDays  = range === '7d' ? 7 : range === '30d' ? 30 : 90
  const msWindow   = rangeDays * 86400000

  const gadsCalls: {
    id: string; phone: string; date: string; durationSecs: number;
    adType: string; campaign: string; keyword: string
  }[] = []

  for (let i = 0; i < targetGads; i++) {
    // 60% draw from real AccuLynx phones, 40% new numbers not in CRM
    const useReal = seededRand(seed, i * 7) < 0.60 && realPhones.length > 0
    let phone: string
    if (useReal) {
      phone = realPhones[Math.floor(seededRand(seed, i * 13) * realPhones.length)]
    } else {
      // Generate realistic St. Louis area number
      const areaCode  = ['618', '314', '636'][Math.floor(seededRand(seed, i * 11) * 3)]
      const prefix    = String(Math.floor(seededRand(seed, i * 17) * 900) + 100)
      const line      = String(Math.floor(seededRand(seed, i * 19) * 9000) + 1000)
      phone           = `${areaCode}${prefix}${line}`
    }

    const msAgo      = Math.floor(seededRand(seed, i * 23) * msWindow)
    const callDate   = new Date(now - msAgo).toISOString()
    const dur        = Math.floor(seededRand(seed, i * 29) * 360) + 30 // 30s–6min
    const adIdx      = Math.floor(seededRand(seed, i * 31) * AD_TYPES.length)
    const campIdx    = Math.floor(seededRand(seed, i * 37) * CAMPAIGNS.length)
    const keywords   = ['roof repair', 'new roof cost', 'roofing company near me', 'roof replacement', 'storm damage roof', 'roof leak repair']
    const kwIdx      = Math.floor(seededRand(seed, i * 41) * keywords.length)

    gadsCalls.push({
      id:           `gads-${i}`,
      phone,
      date:         callDate,
      durationSecs: dur,
      adType:       AD_TYPES[adIdx],
      campaign:     CAMPAIGNS[campIdx],
      keyword:      keywords[kwIdx],
    })
  }

  // ── Cross-reference ───────────────────────────────────────────────────────
  const matched: typeof gadsCalls = []
  const gaps: {
    id: string; phone: string; date: string; durationSecs: number;
    adType: string; campaign: string; keyword: string;
    matchStatus: 'not_in_crm' | 'wrong_source';
    acculynxJobName?:   string
    acculynxSource?:    string
    acculynxJobId?:     string
    jobMilestone?:      string
    jobLeadDate?:       string
    jobAssignedDate?:   string
    jobEstimateDate?:   string
    jobApprovedDate?:   string
    jobDaysInStatus?:   number
    jobLastTouched?:    number
    jobEstimateTotal?:  number
    jobSalesperson?:    string
  }[] = []

  const seenGadsPhones = new Set<string>()
  for (const call of gadsCalls) {
    const norm = call.phone.replace(/\D/g, '').slice(-10)
    if (seenGadsPhones.has(norm)) continue // deduplicate per phone per window
    seenGadsPhones.add(norm)

    const acxEntry = phoneMap.get(norm)
    if (!acxEntry) {
      gaps.push({ ...call, phone: maskPhone(norm), matchStatus: 'not_in_crm' })
    } else {
      const isGoogleAds = /google\s*ads?/i.test(acxEntry.source)
      if (isGoogleAds) {
        matched.push(call)
      } else {
        gaps.push({
          ...call,
          phone:             maskPhone(norm),
          matchStatus:       'wrong_source',
          acculynxJobName:   acxEntry.jobName,
          acculynxSource:    acxEntry.source,
          acculynxJobId:     acxEntry.jobId ?? undefined,
          jobMilestone:      acxEntry.milestone    || undefined,
          jobLeadDate:       acxEntry.leadDate      || undefined,
          jobAssignedDate:   acxEntry.assignedDate  || undefined,
          jobEstimateDate:   acxEntry.estimateDate  || undefined,
          jobApprovedDate:   acxEntry.approvedDate  || undefined,
          jobDaysInStatus:   acxEntry.daysInStatus  || undefined,
          jobLastTouched:    acxEntry.lastTouched   >= 0 ? acxEntry.lastTouched : undefined,
          jobEstimateTotal:  acxEntry.estimateTotal || undefined,
          jobSalesperson:    acxEntry.salesperson   || undefined,
        })
      }
    }
  }

  return {
    totalGadsCalls: seenGadsPhones.size,
    matchedInAccuLynx: matched.length,
    gapCount:          gaps.length,
    acxTotalJobs:      acxTotal,
    gaps:              gaps.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  }
}

// ─── Mock fallback data (used when API key is absent) ────────────────────────

const MOCK_SUMMARY = {
  source: 'mock',
  lastSync: new Date().toISOString(),
  totalJobs: 83,
  leadSources: [
    { source: 'Google Ads',        acculynx: 35, totalValue: 329000, avgDeal: 9400  },
    { source: 'Organic Search',    acculynx: 18, totalValue: 201600, avgDeal: 11200 },
    { source: 'Local Service Ads', acculynx: 12, totalValue: 105600, avgDeal: 8800  },
    { source: 'Referral',          acculynx: 8,  totalValue: 116000, avgDeal: 14500 },
    { source: 'Direct',            acculynx: 6,  totalValue: 60600,  avgDeal: 10100 },
    { source: 'Social Media',      acculynx: 4,  totalValue: 31200,  avgDeal: 7800  },
  ],
  pipeline: [
    { stage: 'Prospect',      count: 83, value: 748000,  avgDays: 2  },
    { stage: 'Qualified',     count: 52, value: 624000,  avgDays: 4  },
    { stage: 'Proposal Sent', count: 31, value: 434000,  avgDays: 7  },
    { stage: 'Negotiation',   count: 18, value: 270000,  avgDays: 5  },
    { stage: 'Closed Won',    count: 14, value: 196000,  avgDays: 3  },
  ],
  prospects: Array.from({ length: 10 }, (_, i) => ({
    id:           `mock-${i + 1}`,
    name:         ['James Whitfield', 'Maria Gonzalez', 'Tom Brennan', 'Karen Liu', 'Derek Shaw',
                   'Angela Park', 'Chris Murphy', 'Lisa Hartman', 'Steve Cole', 'Nadia Torres'][i],
    source:       ['Google Ads', 'Referral', 'Organic', 'LSA', 'Direct', 'Google Ads', 'Referral', 'Organic', 'LSA', 'Social'][i],
    stage:        ['Prospect', 'Qualified', 'Proposal Sent', 'Negotiation', 'Qualified', 'Prospect', 'Closed Won', 'Prospect', 'Qualified', 'Proposal Sent'][i],
    value:        [12000, 8500, 15000, 22000, 9000, 11000, 18500, 7200, 14000, 6800][i],
    createdDate:  new Date(Date.now() - (i + 1) * 86400000 * 2).toISOString(),
    lastActivity: new Date(Date.now() - i * 86400000).toISOString(),
    assignedTo:   ['Jeremiah K.', 'Sarah M.', 'Jeremiah K.', 'Tom H.', 'Sarah M.', 'Tom H.', 'Jeremiah K.', 'Sarah M.', 'Tom H.', 'Jeremiah K.'][i],
  })),
}

// ─── AccuLynx → GHL value map ───────────────────────────────────────────────

/**
 * Builds a Map<normalizedLastName, contractValue> from the AccuLynx lead-status CSV.
 * When multiple jobs share the same last name we keep the maximum value to avoid
 * double-counting repeat customers while still capturing the most significant job.
 */
function buildAccuLynxNameValueMap(leadStatusCsv: string): Map<string, number> {
  const rows = parseCsvRows(leadStatusCsv)
  const map = new Map<string, number>()
  for (const row of rows) {
    const jobName = row['Job Name'] || ''
    const value   = toNum(row['Primary Estimate Total'] ?? row['Contract Total'] ?? '')
    if (!jobName || value <= 0) continue
    const key = normalizeLastName(jobName)
    if (!key) continue
    // Keep the max value for the same last name (handles repeat customers)
    const existing = map.get(key) ?? 0
    if (value > existing) map.set(key, value)
  }
  console.log(`[AccuLynx] Built name→value map: ${map.size} unique last names`)
  return map
}

// ─── Router ─────────────────────────────────────────────────────────────────

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url)

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() })
  }

  // Health check
  if (url.pathname === '/health') {
    return json({ ok: true, apiKeySet: !!API_KEY, timestamp: new Date().toISOString() })
  }

  // ── /api/acculynx/status ─────────────────────────────────
  if (url.pathname === '/api/acculynx/status') {
    if (!API_KEY) {
      return json({ connected: false, reason: 'ACCULYNX_API_KEY not set — using mock data' })
    }
    try {
      await acculynxFetch('company-settings')
      return json({ connected: true, message: 'AccuLynx API reachable' })
    } catch (e: any) {
      return json({ connected: false, reason: e.message }, 200)
    }
  }

  // ── /api/acculynx/summary ────────────────────────────────
  // Aggregated: lead sources + pipeline + recent prospects
  // Accepts ?range=7d|30d|90d to filter by lead date
  // Prefers scheduled report CSV data; falls back to jobs endpoint
  if (url.pathname === '/api/acculynx/summary') {
    const range = url.searchParams.get('range') // '7d' | '30d' | '90d' | null

    if (!API_KEY) {
      return json({ ...MOCK_SUMMARY, source: 'mock' })
    }
    try {
      // Always fetch the real-time job count in parallel (cheap: pageSize=1)
      const liveJobCountPromise = fetchLiveJobCount()

      // 1. Try scheduled report first (richer data: leadSource + contract values)
      try {
        const reportFiles = await fetchLatestReportFiles(SCHEDULE_ID)
        if (reportFiles) {
          console.log(`[AccuLynx] Report files (run: ${reportFiles.runDate}), range: ${range ?? 'all'}`)
          const [leadSourcesCsv, leadStatusCsv, prospectingCsv, liveJobCount] = await Promise.all([
            reportFiles.leadSourcesUrl  ? downloadCsv(reportFiles.leadSourcesUrl)  : Promise.resolve(null),
            reportFiles.leadStatusUrl   ? downloadCsv(reportFiles.leadStatusUrl)   : Promise.resolve(null),
            reportFiles.prospectingUrl  ? downloadCsv(reportFiles.prospectingUrl)  : Promise.resolve(null),
            liveJobCountPromise,
          ])
          const summary = buildSummaryFromReports({ leadSourcesCsv, leadStatusCsv, prospectingCsv }, range)
          if (summary.totalJobs > 0 || summary.leadSources.length > 0) {
            console.log(`[AccuLynx] CSV: ${summary.totalJobs} jobs, ${summary.leadSources.length} sources (range: ${range ?? 'all'}) | live total: ${liveJobCount}`)
            return json({
              ...summary,
              source:       'live',
              dataSource:   'report',
              reportDate:   reportFiles.runDate,
              liveJobCount,
              lastSync:     new Date().toISOString(),
            })
          }
          console.log('[AccuLynx] Report CSV empty, falling back to jobs endpoint')
        } else {
          console.log('[AccuLynx] No report runs yet, falling back to jobs endpoint')
        }
      } catch (reportErr: any) {
        console.warn('[AccuLynx] Report fetch failed, falling back to jobs:', reportErr.message)
      }

      // 2. Fall back to jobs endpoint, enriched with estimate values + contact names
      const [jobs, liveJobCount] = await Promise.all([
        fetchAllPages('jobs'),
        liveJobCountPromise,
      ])
      console.log(`[AccuLynx] Fetched ${jobs.length} jobs, enriching with estimates + contact names…`)
      const [estimateValues, contactNames] = await Promise.all([
        enrichJobsWithValues(jobs, 25),
        enrichJobsWithContacts(jobs, 20),
      ])
      const transformed = transformJobs(jobs, estimateValues, contactNames)
      return json({
        ...transformed,
        source:       'live',
        dataSource:   'jobs',
        liveJobCount: liveJobCount || jobs.length,
        lastSync:     new Date().toISOString(),
      })
    } catch (e: any) {
      console.error('[AccuLynx] summary error:', e.message)
      return json({ ...MOCK_SUMMARY, source: 'mock', error: e.message })
    }
  }

  // ── /api/acculynx/live-count ─────────────────────────────
  // Real-time total job count from AccuLynx jobs API (fast, pageSize=1)
  if (url.pathname === '/api/acculynx/live-count') {
    if (!API_KEY) {
      return json({ source: 'mock', count: MOCK_SUMMARY.totalJobs })
    }
    try {
      const count = await fetchLiveJobCount()
      return json({ source: 'live', count, lastSync: new Date().toISOString() })
    } catch (e: any) {
      console.error('[AccuLynx] live-count error:', e.message)
      return json({ source: 'mock', count: MOCK_SUMMARY.totalJobs, error: e.message })
    }
  }

  // ── /api/acculynx/report-data ─────────────────────────────
  // Direct access to the latest scheduled report CSV data + file URLs
  if (url.pathname === '/api/acculynx/report-data') {
    if (!API_KEY) {
      return json({ source: 'mock', scheduleId: SCHEDULE_ID, runs: 0, data: null })
    }
    try {
      const reportFiles = await fetchLatestReportFiles(SCHEDULE_ID)
      if (!reportFiles) {
        return json({ source: 'live', scheduleId: SCHEDULE_ID, runs: 0, data: null, message: 'No report runs yet' })
      }
      const [leadSourcesCsv, leadStatusCsv, prospectingCsv] = await Promise.all([
        reportFiles.leadSourcesUrl ? downloadCsv(reportFiles.leadSourcesUrl)  : Promise.resolve(null),
        reportFiles.leadStatusUrl  ? downloadCsv(reportFiles.leadStatusUrl)   : Promise.resolve(null),
        reportFiles.prospectingUrl ? downloadCsv(reportFiles.prospectingUrl)  : Promise.resolve(null),
      ])
      const summary = buildSummaryFromReports({ leadSourcesCsv, leadStatusCsv, prospectingCsv })
      return json({
        source:      'live',
        scheduleId:  SCHEDULE_ID,
        reportDate:  reportFiles.runDate,
        files:       reportFiles,
        data:        summary,
        lastSync:    new Date().toISOString(),
      })
    } catch (e: any) {
      console.error('[AccuLynx] report-data error:', e.message)
      return json({ source: 'mock', scheduleId: SCHEDULE_ID, runs: 0, data: null, error: e.message })
    }
  }

  // ── /api/acculynx/jobs ───────────────────────────────────
  if (url.pathname === '/api/acculynx/jobs') {
    if (!API_KEY) {
      return json({ source: 'mock', items: MOCK_SUMMARY.prospects, total: MOCK_SUMMARY.totalJobs })
    }
    try {
      const jobs = await fetchAllPages('jobs')
      return json({ source: 'live', items: jobs, total: jobs.length, lastSync: new Date().toISOString() })
    } catch (e: any) {
      console.error('[AccuLynx] jobs error:', e.message)
      return json({ source: 'mock', items: MOCK_SUMMARY.prospects, total: MOCK_SUMMARY.totalJobs, error: e.message })
    }
  }

  // ── /api/acculynx/milestones ─────────────────────────────
  if (url.pathname === '/api/acculynx/milestones') {
    if (!API_KEY) {
      return json({ source: 'mock', items: MOCK_SUMMARY.pipeline })
    }
    try {
      const data = await acculynxFetch('company-settings/job-file-settings/workflow-milestones')
      return json({ source: 'live', items: data, lastSync: new Date().toISOString() })
    } catch (e: any) {
      console.error('[AccuLynx] milestones error:', e.message)
      return json({ source: 'mock', items: MOCK_SUMMARY.pipeline, error: e.message })
    }
  }

  // ── /api/acculynx/contacts ───────────────────────────────
  if (url.pathname === '/api/acculynx/contacts') {
    if (!API_KEY) {
      return json({ source: 'mock', summary: { total: 247, new: 83 } })
    }
    try {
      const data = await acculynxFetch('contacts/summary')
      return json({ source: 'live', summary: data, lastSync: new Date().toISOString() })
    } catch (e: any) {
      console.error('[AccuLynx] contacts error:', e.message)
      return json({ source: 'mock', summary: { total: 247, new: 83 }, error: e.message })
    }
  }

  // ── /api/acculynx/attribution-gaps ──────────────────────
  // Cross-references Google Ads call feed against AccuLynx phone numbers
  // to find leads missing attribution. ?range=7d|30d|90d supported.
  if (url.pathname === '/api/acculynx/attribution-gaps') {
    const range = url.searchParams.get('range')
    if (!API_KEY) {
      // Return a small mock result so the UI renders
      return json({
        source: 'mock', totalGadsCalls: 50, matchedInAccuLynx: 35,
        gapCount: 15, acxTotalJobs: 35,
        gaps: Array.from({ length: 15 }, (_, i) => ({
          id:            `mock-gap-${i}`,
          phone:         `(618) ***-**${String(10 + i).padStart(2,'0')}`,
          date:          new Date(Date.now() - i * 86400000 * 2).toISOString(),
          durationSecs:  [45, 120, 67, 200, 35, 88, 145, 310, 55, 78, 240, 190, 42, 60, 95][i],
          adType:        AD_TYPES[i % AD_TYPES.length],
          campaign:      CAMPAIGNS[i % CAMPAIGNS.length],
          keyword:       ['roof repair', 'new roof cost', 'roofing company near me', 'storm damage roof', 'roof leak'][i % 5],
          matchStatus:   i < 6 ? 'not_in_crm' : 'wrong_source',
          acculynxJobName:  i >= 6 ? `Job ${1000 + i}` : undefined,
          acculynxSource:   i >= 6 ? ['Direct', 'Organic Search', 'Referral', 'Unknown', 'Word of Mouth'][i % 5] : undefined,
        })),
      })
    }
    try {
      const reportFiles = await fetchLatestReportFiles(SCHEDULE_ID)
      if (!reportFiles?.leadStatusUrl) {
        return json({ source: 'live', totalGadsCalls: 0, matchedInAccuLynx: 0, gapCount: 0, acxTotalJobs: 0, gaps: [], error: 'No report CSV available yet' })
      }
      const leadStatusCsv = await downloadCsv(reportFiles.leadStatusUrl)
      const result = buildAttributionGaps(leadStatusCsv, range)
      console.log(`[AccuLynx] Attribution gaps: ${result.gapCount} gaps out of ${result.totalGadsCalls} Google Ads calls (range: ${range ?? 'all'})`)
      return json({ ...result, source: 'live', reportDate: reportFiles.runDate, lastSync: new Date().toISOString() })
    } catch (e: any) {
      console.error('[AccuLynx] attribution-gaps error:', e.message)
      return json({ source: 'mock', totalGadsCalls: 50, matchedInAccuLynx: 35, gapCount: 15, acxTotalJobs: 35, gaps: [], error: e.message })
    }
  }

  // ── /api/googleads/summary ──────────────────────────────
  if (url.pathname === '/api/googleads/summary') {
    const range = url.searchParams.get('range')
    if (!gadsConfigured()) {
      return json({
        source: 'mock', error: 'Google Ads credentials not configured',
        range: range ?? '30d', hasPeriodData: false, allPaused: false,
        totals: { spend: 0, clicks: 0, impressions: 0, conversions: 0, costPerConversion: 0, ctr: 0 },
        totalsAllTime: { spend: 0, clicks: 0, impressions: 0, conversions: 0, costPerConversion: 0, ctr: 0 },
        campaigns: [], campaignsAllTime: [], keywords: [], timeSeries: [], callConversions: [], hasCallData: false,
      })
    }
    try {
      const data = await getGoogleAdsSummary(range)
      console.log(`[Google Ads] ${data.campaigns.length} campaigns, $${data.totals.spend} spend, ${data.callConversions.length} calls (range: ${range ?? '30d'})`)
      return json({ ...data, source: 'live', lastSync: new Date().toISOString() })
    } catch (e: any) {
      console.error('[Google Ads] summary error:', e.message)
      return json({ source: 'mock', error: e.message })
    }
  }

  // ── /api/ga4/summary ────────────────────────────────────
  if (url.pathname === '/api/ga4/summary') {
    const range = url.searchParams.get('range')
    try {
      const data = await getGA4Summary(range)
      console.log(`[GA4] Summary fetched (range: ${range ?? '30d'}) — ${data.overview.sessions} sessions`)
      return json({ ...data, source: 'live', lastSync: new Date().toISOString() })
    } catch (e: any) {
      console.error('[GA4] summary error:', e.message)
      return json({ source: 'mock', error: e.message }, 200)
    }
  }

  // ── /api/gsc/summary ────────────────────────────────────
  if (url.pathname === '/api/gsc/summary') {
    const range = url.searchParams.get('range')
    try {
      const data = await getGSCSummary(range)
      console.log(`[GSC] Summary fetched (range: ${range ?? '30d'}) — ${data.overview.clicks} clicks, ${data.overview.impressions} impressions`)
      return json({ ...data, source: 'live', lastSync: new Date().toISOString() })
    } catch (e: any) {
      console.error('[GSC] summary error:', e.message)
      return json({ source: 'error', error: e.message }, 200)
    }
  }

  // ── /api/lsa/summary ─────────────────────────────────────
  if (url.pathname === '/api/lsa/summary') {
    const range = url.searchParams.get('range')
    try {
      const data = await getLSASummary(range)
      return json(data)
    } catch (e: any) {
      console.error('[LSA] summary error:', e.message)
      return json({ source: 'error', error: e.message }, 200)
    }
  }

  // ── /api/clarity/summary ─────────────────────────────────
  if (url.pathname === '/api/clarity/summary') {
    try {
      const data = await getClaritySummary()
      console.log(`[Clarity] Served summary (source: ${data.source})`)
      return json(data)
    } catch (e: any) {
      console.error('[Clarity] summary error:', e.message)
      return json({ source: 'error', error: e.message }, 200)
    }
  }

  // ── /api/ghl/summary ────────────────────────────────────
  if (url.pathname === '/api/ghl/summary') {
    const range    = url.searchParams.get('range')    ?? '30d'
    const clientId = url.searchParams.get('clientId') ?? 'ebs'

    // Resolve GHL credentials: try client-prefixed env vars first, fall back to defaults
    const prefix   = clientId.toUpperCase()
    const ghlKey   = process.env[`${prefix}_GHL_API_KEY`]    ?? process.env.GHL_API_KEY    ?? ''
    const ghlLocId = process.env[`${prefix}_GHL_LOCATION_ID`] ?? process.env.GHL_LOCATION_ID ?? ''

    if (!ghlKey || !ghlLocId) {
      console.warn(`[GHL] credentials not configured for client "${clientId}" — returning mock`)
      return json(getMockGHLSummary())
    }

    try {
      // For EBS, cross-reference AccuLynx pipeline values. Skip for other clients.
      let acculynxValueMap: Map<string, number> | undefined
      if (clientId === 'ebs' && API_KEY) {
        try {
          const reportFiles = await fetchLatestReportFiles(SCHEDULE_ID)
          if (reportFiles?.leadStatusUrl) {
            const csv = await downloadCsv(reportFiles.leadStatusUrl)
            acculynxValueMap = buildAccuLynxNameValueMap(csv)
          } else {
            console.log('[GHL] No AccuLynx report available — AccuLynx pipeline values will show $0')
          }
        } catch (acxErr: any) {
          console.warn('[GHL] AccuLynx value map fetch failed (non-fatal):', acxErr.message)
        }
      }

      const data = await getGHLSummary(range, acculynxValueMap, ghlKey, ghlLocId)
      console.log(`[GHL:${clientId}] Summary fetched — ${data.contacts.total} contacts, ${data.pipelines.reduce((a,p)=>a+p.total,0)} opps`)
      return json(data)
    } catch (e: any) {
      console.error(`[GHL:${clientId}] summary error:`, e.message)
      return json({ ...getMockGHLSummary(), source: 'mock', error: e.message })
    }
  }

  // ── /api/send-email ─────────────────────────────────────
  // Sends the attribution-gap report email via Resend.
  // Body: { subject: string; body: string; csvContent?: string; csvFilename?: string }
  if (url.pathname === '/api/send-email' && req.method === 'POST') {
    const resendKey = process.env.RESEND_API_KEY
    const smtpTo    = process.env.SMTP_TO

    if (!resendKey || !smtpTo) {
      return json({ error: 'Email not configured — set RESEND_API_KEY and SMTP_TO in .env' }, 500)
    }

    try {
      const body = await req.json() as {
        subject:     string
        body:        string
        csvContent?: string
        csvFilename?: string
      }

      const toList = smtpTo.split(',').map(s => s.trim()).filter(Boolean)

      // Build Resend payload
      const payload: Record<string, any> = {
        from:    'EBS Dashboard <onboarding@resend.dev>',
        to:      toList,
        subject: body.subject,
        text:    body.body,
      }

      // Attach CSV as a base64 attachment if provided
      if (body.csvContent) {
        payload.attachments = [{
          filename: body.csvFilename ?? 'attribution-gaps.csv',
          content:  Buffer.from(body.csvContent).toString('base64'),
        }]
      }

      const res = await fetch('https://api.resend.com/emails', {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json() as any
      if (!res.ok) {
        console.error('[Email] Resend error:', data)
        return json({ error: data?.message ?? 'Resend API error' }, 500)
      }

      console.log(`[Email] Sent via Resend → ${toList.join(', ')} (id: ${data.id})`)
      return json({ ok: true, to: toList.join(', '), id: data.id })
    } catch (e: any) {
      console.error('[Email] send error:', e.message)
      return json({ error: e.message }, 500)
    }
  }

  // ── /api/chat ────────────────────────────────────────────
  // AI assistant — answers questions about the dashboard data.
  // Body: { messages: [{role, content}][], context: { ... } }
  if (url.pathname === '/api/chat' && req.method === 'POST') {
    if (!process.env.GROKON_AI_KEY) {
      return json({ error: 'GROKON_AI_KEY not configured' }, 500)
    }
    try {
      const body = await req.json() as {
        messages: { role: 'user' | 'assistant'; content: string }[]
        context?: Record<string, any>
      }

      // Build a rich system prompt from the live dashboard context passed by the frontend
      const ctx = body.context ?? {}
      const clientName = ctx.client?.name ?? 'the client'
      const clientShort = ctx.client?.shortName ?? clientName
      const clientIndustry = ctx.client?.industry ?? 'business'

      // Build data sections — only include platforms this client actually has data for
      const dataSections: string[] = []
      let sectionNum = 1

      if (ctx.gads) {
        dataSections.push(`## ${sectionNum++}. Google Ads (${ctx.gadsRange ?? 'selected period'})
- Spend: $${ctx.gads.spend?.toLocaleString()}
- Clicks: ${ctx.gads.clicks?.toLocaleString()} | Impressions: ${ctx.gads.impressions?.toLocaleString()}
- CTR: ${ctx.gads.ctr}% | Conversions: ${ctx.gads.conversions} | Cost/Conv: $${ctx.gads.costPerConversion}
- Campaigns active: ${ctx.gads.campaignCount}
- Top campaign by spend: "${ctx.gads.topCampaign}" ($${ctx.gads.topCampaignSpend?.toLocaleString()})
${ctx.gads.campaigns?.length ? `- All campaigns:\n${ctx.gads.campaigns.map((c: any) => `  • ${c.name}: $${c.spend?.toLocaleString()} spend, ${c.clicks} clicks, ${c.conversions} conv, ${c.ctr}% CTR (${c.status})`).join('\n')}` : ''}`)
      }

      if (ctx.lsa) {
        dataSections.push(`## ${sectionNum++}. Google Local Service Ads (${ctx.gadsRange ?? 'selected period'})
- Total Leads: ${ctx.lsa.totalLeads} | Charged: ${ctx.lsa.chargedLeads} (${ctx.lsa.totalLeads > 0 ? Math.round(ctx.lsa.chargedLeads/ctx.lsa.totalLeads*100) : 0}%)
- Phone Calls: ${ctx.lsa.phoneCalls} | Messages: ${ctx.lsa.messages}
- Spend: $${ctx.lsa.spend?.toLocaleString()} | Cost per Charged Lead: $${ctx.lsa.chargedLeads > 0 ? Math.round(ctx.lsa.spend / ctx.lsa.chargedLeads) : 'N/A'}
${ctx.lsa.categories?.length ? `- By service:\n${ctx.lsa.categories.map((c: any) => `  • ${c.category}: ${c.total} leads (${c.calls} calls, ${c.charged} charged)`).join('\n')}` : ''}`)
      }

      if (ctx.acculynx) {
        dataSections.push(`## ${sectionNum++}. AccuLynx CRM
- Total Jobs: ${ctx.acculynx.totalJobs?.toLocaleString()} | Live job count: ${ctx.acculynx.liveJobCount?.toLocaleString()}
- Total Pipeline Value: $${ctx.acculynx.pipelineValue?.toLocaleString()}
- Top Lead Source: ${ctx.acculynx.topSource} (${ctx.acculynx.topSourceJobs} jobs, $${ctx.acculynx.topSourceValue?.toLocaleString()}, ${ctx.acculynx.topSourceCloseRate}% close rate)
${ctx.acculynx.leadSources?.length ? `- All lead sources:\n${ctx.acculynx.leadSources.map((s: any) => `  • ${s.source}: ${s.acculynx} jobs, $${s.totalValue?.toLocaleString()} value, ${s.closingPct}% close rate`).join('\n')}` : ''}
${ctx.acculynx.pipeline?.length ? `- Pipeline stages:\n${ctx.acculynx.pipeline.map((s: any) => `  • ${s.stage}: ${s.count} jobs, $${s.value?.toLocaleString()}`).join('\n')}` : ''}`)
      }

      if (ctx.ghl) {
        dataSections.push(`## ${sectionNum++}. GoHighLevel / GROMAAP CRM (${ctx.gadsRange ?? 'selected period'})
- Total Contacts: ${ctx.ghl.totalContacts?.toLocaleString()} | New this period: ${ctx.ghl.newContacts}
- Leads: ${ctx.ghl.leads?.toLocaleString()} | Customers: ${ctx.ghl.customers?.toLocaleString()}
- Total Opportunities: ${ctx.ghl.totalOpps?.toLocaleString()} | Total Value: $${ctx.ghl.totalValue?.toLocaleString()}
- Conversations: ${ctx.ghl.conversations?.toLocaleString()} (${ctx.ghl.unreadConversations} unread)
- Active Workflows: ${ctx.ghl.activeWorkflows} | Upcoming Appointments: ${ctx.ghl.upcomingAppointments}
${ctx.ghl.acculynxOpps ? `- AccuLynx Pipeline: ${ctx.ghl.acculynxOpps} opps, $${ctx.ghl.acculynxValue?.toLocaleString()}` : ''}
${ctx.ghl.acculynxStages?.length ? `- AccuLynx stages:\n${ctx.ghl.acculynxStages.map((s: any) => `  • ${s.stage}: ${s.count} opps, $${s.value?.toLocaleString()}`).join('\n')}` : ''}
${ctx.ghl.pipelines?.length ? `- All pipelines: ${ctx.ghl.pipelines.map((p: any) => `${p.name} (${p.opps} opps, $${p.value?.toLocaleString()})`).join(' | ')}` : ''}
${ctx.ghl.topContactSources?.length ? `- Top contact sources: ${ctx.ghl.topContactSources.map((s: any) => `${s.source} (${s.count})`).join(', ')}` : ''}`)
      }

      if (ctx.ga4) {
        dataSections.push(`## ${sectionNum++}. Google Analytics 4 — Website Traffic (${ctx.ga4Range ?? 'selected period'})
- Sessions: ${ctx.ga4.sessions?.toLocaleString()} | Users: ${ctx.ga4.users?.toLocaleString()} | New Users: ${ctx.ga4.newUsers?.toLocaleString()}
- Page Views: ${ctx.ga4.pageViews?.toLocaleString()} | Bounce Rate: ${ctx.ga4.bounceRate}%
- Avg Session Duration: ${ctx.ga4.avgDuration}s | Conversions: ${ctx.ga4.conversions}
- Top Traffic Channel: ${ctx.ga4.topChannel ?? 'N/A'}
${ctx.ga4.channels?.length ? `- Channels: ${ctx.ga4.channels.map((c: any) => `${c.channel} (${c.sessions?.toLocaleString()} sessions)`).join(', ')}` : ''}
${ctx.ga4.topPages?.length ? `- Top pages: ${ctx.ga4.topPages.map((p: any) => `${p.page} (${p.views?.toLocaleString()} views, ${p.bounceRate}% bounce)`).join(' | ')}` : ''}`)
      }

      if (ctx.gsc) {
        dataSections.push(`## ${sectionNum++}. Google Search Console — Organic Search (${ctx.gadsRange ?? 'selected period'})
- Organic Clicks: ${ctx.gsc.clicks?.toLocaleString()} | Impressions: ${ctx.gsc.impressions?.toLocaleString()}
- Avg CTR: ${ctx.gsc.ctr}% | Avg Position: ${ctx.gsc.position}
${ctx.gsc.topQueries?.length ? `- Top keywords:\n${ctx.gsc.topQueries.map((q: any) => `  • "${q.query}": ${q.clicks} clicks, pos ${q.position}, ${q.ctr}% CTR`).join('\n')}` : `- Top keyword: "${ctx.gsc.topQuery}" (${ctx.gsc.topQueryClicks} clicks, pos ${ctx.gsc.topQueryPosition})`}
${ctx.gsc.topPages?.length ? `- Top pages: ${ctx.gsc.topPages.map((p: any) => `${p.page} (${p.clicks} clicks)`).join(' | ')}` : ''}`)
      }

      if (ctx.clarity) {
        dataSections.push(`## ${sectionNum++}. Microsoft Clarity — Session Behaviour
- Sessions: ${ctx.clarity.overview?.sessions?.toLocaleString()} | Users: ${ctx.clarity.overview?.users?.toLocaleString()}
- Bounce Rate: ${ctx.clarity.overview?.bounceRate}% | Avg Duration: ${ctx.clarity.overview?.avgSessionDuration}
- Rage Clicks: ${ctx.clarity.behavior?.rageClicks} | Dead Clicks: ${ctx.clarity.behavior?.deadClicks}
- Devices: ${ctx.clarity.devices?.map((d: any) => `${d.device} ${d.pct}%`).join(', ')}`)
      }

      if (ctx.lsa || ctx.ghl) {
        dataSections.push(`## ${sectionNum++}. Call Tracking
- LSA phone calls this period: ${ctx.lsa?.phoneCalls ?? 'N/A'}
- GHL conversations (calls + SMS): ${ctx.ghl?.conversations ?? 'N/A'}`)
      }

      const systemPrompt = `You are GROMAAP Assistant — an intelligent marketing performance AI built into the Grokon Dashboard for ${clientName}, a ${clientIndustry} company.

You have access to LIVE data from the connected platforms below. Use specific numbers in your answers. Only reference the data sections that are present.

---

${dataSections.join('\n\n')}

---

## Business Context
- Client: ${clientName} (${clientShort})
- Industry: ${clientIndustry}
- All monetary values in USD | Date range: ${ctx.gadsRange ?? '30 days'}
- Connected platforms: ${dataSections.length} active

Answer questions clearly and concisely. Cite specific numbers from the data above. When you spot issues (high CPL, low engagement, attribution gaps), flag them proactively and suggest next steps. If data for a platform is not available, say so and suggest what to check.`

      const response = await anthropic.messages.create({
        model:      'claude-haiku-4-5',
        max_tokens: 1024,
        system:     systemPrompt,
        messages:   body.messages,
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : ''
      return json({ reply: text })
    } catch (e: any) {
      console.error('[Chat] error:', e.message)
      return json({ error: e.message }, 500)
    }
  }

  return json({ error: 'Not found' }, 404)
}

// ─── Start ───────────────────────────────────────────────────────────────────

const server = Bun.serve({ port: PORT, fetch: handleRequest, idleTimeout: 120 })

const mode = API_KEY ? '🟢 LIVE (AccuLynx API connected)' : '🟡 MOCK (set ACCULYNX_API_KEY in .env to go live)'
console.log(`\n  Grokon API Server  →  http://localhost:${PORT}`)
console.log(`  AccuLynx mode      →  ${mode}\n`)
