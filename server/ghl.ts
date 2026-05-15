/**
 * GoHighLevel (GHL) Integration
 * Uses the GHL v2 REST API with a Private Integration token.
 * Base: https://services.leadconnectorhq.com
 */

const GHL_BASE    = 'https://services.leadconnectorhq.com'
const GHL_API_KEY = process.env.GHL_API_KEY    ?? ''
const GHL_LOC_ID  = process.env.GHL_LOCATION_ID ?? ''

export function isConfigured(): boolean {
  return !!(GHL_API_KEY && GHL_LOC_ID)
}

// ── Pipeline stage name maps (from probe) ─────────────────────────────────────
export const PIPELINE_NAMES: Record<string, string> = {
  DXnD9yfAsrj1hrisrSEO: '$150 Off Pipeline',
  VSb1gZvTs03F7gFy31eX: 'AccuLynx',
  GwlPq6uPrjILmYEf6wrR: 'Commercial Referral Partners',
  J7121MVz32WdTFc8KBPn: 'Customer Journey',
  XHnxHdRJea9iJOEaAG4u: 'New Referrals',
  hmijaqwp3VaUn3yNJIxO: 'ReferGRO',
  '7kUM7bkPt86anpdlvhFR': 'ReviewGRO',
  s8SYCJqjuuYzVgjBnXCB: 'Trash',
}

// ── HTTP helper ───────────────────────────────────────────────────────────────
async function ghlGet<T = any>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${GHL_BASE}${path}`)
  if (params) Object.entries(params).forEach(([k, v]) => v && url.searchParams.set(k, v))

  const res = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${GHL_API_KEY}`,
      'Version':       '2021-07-28',
      'Content-Type':  'application/json',
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GHL ${path} → ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json()
}

// ── Date range helpers ────────────────────────────────────────────────────────
function getDateRange(range = '30d'): { startDate: Date; endDate: Date } {
  const endDate   = new Date()
  const startDate = new Date()
  const days = range === '7d' ? 7 : range === '90d' ? 90 : 30
  startDate.setDate(startDate.getDate() - days)
  return { startDate, endDate }
}

function iso(d: Date) { return d.toISOString() }
function epochMs(d: Date) { return d.getTime().toString() }

// ── Pagination helper ─────────────────────────────────────────────────────────
async function fetchAllPages<T>(
  path: string,
  baseParams: Record<string, string>,
  key: string,
  maxPages = 10,
): Promise<T[]> {
  const items: T[] = []
  let startAfter: string | undefined

  for (let page = 0; page < maxPages; page++) {
    const params = { ...baseParams, limit: '100' }
    if (startAfter) params.startAfter = startAfter

    const data: any = await ghlGet(path, params)
    const batch: T[] = data[key] ?? []
    items.push(...batch)

    const meta = data.meta ?? {}
    if (!meta.nextPageUrl && !meta.startAfter && batch.length < 100) break
    if (meta.startAfter) startAfter = meta.startAfter
    else break
  }

  return items
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GHLPipelineStageSummary {
  stageId:   string
  stageName: string
  count:     number
  value:     number
}

export interface GHLPipelineSummary {
  pipelineId:   string
  pipelineName: string
  total:        number
  totalValue:   number
  stages:       GHLPipelineStageSummary[]
}

export interface GHLContactStats {
  total:       number
  newInPeriod: number
  leads:       number
  customers:   number
  bySource:    { source: string; count: number }[]
}

export interface GHLConversationStats {
  total:        number
  unread:       number
  bySmsCall:    number
  byEmail:      number
  recentContacts: { name: string; lastMessage: string; type: string; date: number }[]
}

export interface GHLWorkflowSummary {
  total:     number
  published: number
  draft:     number
  workflows: { id: string; name: string; status: string; updatedAt: string }[]
}

export interface GHLAppointmentSummary {
  upcoming:    number
  appointments: { title: string; startTime: string; status: string; calendarId: string }[]
}

export interface GHLSummary {
  source:        'live' | 'mock'
  lastSync:      string
  locationName:  string
  totalOpps:     number              // real total from meta, not paginated count
  totalCalls:    number              // total phone/call conversations
  contacts:      GHLContactStats
  pipelines:     GHLPipelineSummary[]
  conversations: GHLConversationStats
  workflows:     GHLWorkflowSummary
  appointments:  GHLAppointmentSummary
  error?:        string
}

// ── Name normalisation (for AccuLynx cross-reference) ────────────────────────
/** Extracts and lowercases the last word of a name — used as a fuzzy match key.
 *  e.g. "Abby & Nate Beckermann" → "beckermann", "Candyse Burns" → "burns" */
export function normalizeLastName(name: string): string {
  if (!name) return ''
  const parts = name.trim().split(/\s+/)
  return parts[parts.length - 1].toLowerCase().replace(/[^a-z]/g, '')
}

// AccuLynx pipeline ID in GHL — opportunities here have $0 monetaryValue
// because values are never entered in GHL; we cross-reference from AccuLynx.
const ACCULYNX_PIPELINE_ID = 'VSb1gZvTs03F7gFy31eX'

// ── Main export ───────────────────────────────────────────────────────────────
/**
 * @param range         Date range for contact/conversation filters ('7d'|'30d'|'90d')
 * @param acculynxValueMap  Optional last-name → contract value map built from AccuLynx
 *                          report CSV.  When provided, replaces the always-$0
 *                          monetaryValue for the AccuLynx pipeline opportunities.
 */
export async function getGHLSummary(
  range = '30d',
  acculynxValueMap?: Map<string, number>,
): Promise<GHLSummary> {
  const { startDate, endDate } = getDateRange(range)

  const [
    contactsAll,
    contactsNew,
    contactsSample,
    oppsAll,
    pipelinesData,
    conversationsData,
    callsData,
    workflowsData,
    calendarsData,
  ] = await Promise.allSettled([
    // Total contacts count (limit=1 just to get meta.total)
    ghlGet<any>('/contacts/', { locationId: GHL_LOC_ID, limit: '1' }),
    // New contacts in period count
    ghlGet<any>('/contacts/', {
      locationId: GHL_LOC_ID,
      limit:      '1',
      startDate:  iso(startDate),
      endDate:    iso(endDate),
    }),
    // 100 contacts for type/source breakdown sample
    ghlGet<any>('/contacts/', { locationId: GHL_LOC_ID, limit: '100' }),
    // All opportunities — paginate up to 500 for stage breakdown
    ghlGet<any>('/opportunities/search', { location_id: GHL_LOC_ID, limit: '100' }),
    // Pipelines (for stage name lookup)
    ghlGet<any>('/opportunities/pipelines', { locationId: GHL_LOC_ID }),
    // Recent conversations (all types, for list display)
    ghlGet<any>('/conversations/search', { locationId: GHL_LOC_ID, limit: '50' }),
    // Phone calls total (TYPE_PHONE gives real call count)
    ghlGet<any>('/conversations/search', { locationId: GHL_LOC_ID, limit: '1', type: 'TYPE_PHONE' }),
    // Workflows
    ghlGet<any>('/workflows/', { locationId: GHL_LOC_ID }),
    // Calendars (for upcoming appointments)
    ghlGet<any>('/calendars/', { locationId: GHL_LOC_ID }),
  ])

  // ── Contacts ───────────────────────────────────────────────────────────────
  // meta.total holds the real count; fall back to array length
  const totalContacts = contactsAll.status === 'fulfilled'
    ? (contactsAll.value?.meta?.total ?? contactsAll.value?.contacts?.length ?? 0)
    : 0
  const newContacts = contactsNew.status === 'fulfilled'
    ? (contactsNew.value?.meta?.total ?? contactsNew.value?.contacts?.length ?? 0)
    : 0

  // Source/type breakdown from 100-contact sample
  const contactSample: any[] = contactsSample.status === 'fulfilled' ? (contactsSample.value?.contacts ?? []) : []
  const sourceMap: Record<string, number> = {}
  for (const c of contactSample) {
    const src = c.source || 'Direct / Unknown'
    sourceMap[src] = (sourceMap[src] ?? 0) + 1
  }
  const bySource = Object.entries(sourceMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([source, count]) => ({ source, count }))

  // Extrapolate leads/customers ratio from sample to full contact count
  const sampleSize   = contactSample.length || 1
  const leadRatio    = contactSample.filter(c => c.type === 'lead').length     / sampleSize
  const customerRatio = contactSample.filter(c => c.type === 'customer').length / sampleSize

  const contacts: GHLContactStats = {
    total:       totalContacts,
    newInPeriod: newContacts,
    leads:       Math.round(totalContacts * leadRatio),
    customers:   Math.round(totalContacts * customerRatio),
    bySource,
  }

  // ── Pipelines & Opportunities ──────────────────────────────────────────────
  // Use meta.total for the true count; paginate ALL pages for accurate stage breakdown
  const totalOppsCount = oppsAll.status === 'fulfilled' ? (oppsAll.value?.meta?.total ?? 0) : 0
  let opps: any[] = oppsAll.status === 'fulfilled' ? (oppsAll.value?.opportunities ?? []) : []
  if (oppsAll.status === 'fulfilled' && opps.length === 100) {
    let startAfter   = oppsAll.value.meta?.startAfter
    let startAfterId = oppsAll.value.meta?.startAfterId
    // Fetch up to 30 more pages (3,000 additional) — covers any realistic opp count
    for (let page = 0; page < 30 && startAfter; page++) {
      try {
        const more = await ghlGet<any>('/opportunities/search', {
          location_id:  GHL_LOC_ID,
          limit:        '100',
          startAfter:   String(startAfter),
          startAfterId: startAfterId ?? '',
        })
        const batch: any[] = more.opportunities ?? []
        opps.push(...batch)
        startAfter   = more.meta?.startAfter
        startAfterId = more.meta?.startAfterId
        if (batch.length < 100) break
      } catch { break }
    }
  }
  console.log(`[GHL] Fetched ${opps.length} / ${totalOppsCount} opportunities for stage breakdown`)

  const pipelinesList: any[] = pipelinesData.status === 'fulfilled' ? (pipelinesData.value?.pipelines ?? []) : []

  // Build stage name lookup
  const stageNameMap: Record<string, string> = {}
  for (const p of pipelinesList) {
    for (const s of p.stages ?? []) {
      stageNameMap[s.id] = s.name
    }
  }

  // Group opps by pipeline → stage
  const pipelineMap: Record<string, Record<string, { count: number; value: number }>> = {}
  let acxMatched = 0, acxUnmatched = 0

  for (const opp of opps) {
    const pid = opp.pipelineId      ?? 'unknown'
    const sid = opp.pipelineStageId ?? 'unknown'
    if (!pipelineMap[pid]) pipelineMap[pid] = {}
    if (!pipelineMap[pid][sid]) pipelineMap[pid][sid] = { count: 0, value: 0 }
    pipelineMap[pid][sid].count++

    let value = opp.monetaryValue ?? 0

    // For the AccuLynx pipeline, look up the real contract value from AccuLynx CRM
    // using last-name matching against the contact name on the opportunity.
    if (pid === ACCULYNX_PIPELINE_ID && acculynxValueMap) {
      const contactName = opp.contact?.name ?? opp.contactName ?? ''
      const key = normalizeLastName(contactName)
      const acxValue = key ? acculynxValueMap.get(key) : undefined
      if (acxValue !== undefined) {
        value = acxValue
        acxMatched++
      } else {
        acxUnmatched++
      }
    }

    pipelineMap[pid][sid].value += value
  }

  if (acculynxValueMap && (acxMatched + acxUnmatched) > 0) {
    console.log(`[GHL] AccuLynx pipeline cross-ref: ${acxMatched} matched, ${acxUnmatched} unmatched (of ${acxMatched + acxUnmatched} opps)`)
  }

  const pipelines: GHLPipelineSummary[] = Object.entries(pipelineMap)
    .filter(([pid]) => pid !== 's8SYCJqjuuYzVgjBnXCB') // exclude Trash
    .map(([pid, stageData]) => {
      const pipelineName = PIPELINE_NAMES[pid] ?? pipelinesList.find(p => p.id === pid)?.name ?? pid
      const stages: GHLPipelineStageSummary[] = Object.entries(stageData).map(([sid, d]) => ({
        stageId:   sid,
        stageName: stageNameMap[sid] ?? sid,
        count:     d.count,
        value:     d.value,
      }))
      const total      = stages.reduce((a, s) => a + s.count, 0)
      const totalValue = stages.reduce((a, s) => a + s.value, 0)
      return { pipelineId: pid, pipelineName, total, totalValue, stages }
    })
    .sort((a, b) => b.total - a.total)

  // Add totalOppsCount to first pipeline summary note (used by frontend KPI)
  // The KPI will read this from a dedicated field instead of summing paginated opps

  // ── Calls total ────────────────────────────────────────────────────────────
  const totalCalls = callsData.status === 'fulfilled'
    ? (callsData.value?.total ?? 0)
    : 0

  // ── Conversations ──────────────────────────────────────────────────────────
  const convs: any[] = conversationsData.status === 'fulfilled'
    ? (conversationsData.value?.conversations ?? [])
    : []
  // Use top-level `total` field for real count (not the page result length)
  const totalConversations = conversationsData.status === 'fulfilled'
    ? (conversationsData.value?.total ?? convs.length)
    : convs.length

  const unread    = convs.filter(c => (c.unreadCount ?? 0) > 0).length
  const smsCall   = convs.filter(c => c.type === 'TYPE_PHONE' || c.type === 'TYPE_SMS' || c.type === 'TYPE_CALL').length
  const email     = convs.filter(c => c.type === 'TYPE_EMAIL').length

  const recentContacts = convs.slice(0, 10).map(c => ({
    name:        c.fullName || c.contactName || c.phone || 'Unknown',
    lastMessage: c.lastMessageType?.replace('TYPE_', '') ?? 'Message',
    type:        c.type?.replace('TYPE_', '') ?? 'UNKNOWN',
    date:        c.lastMessageDate ?? c.dateUpdated ?? 0,
  }))

  const conversations: GHLConversationStats = {
    total:          totalConversations,
    unread,
    bySmsCall:      smsCall,
    byEmail:        email,
    recentContacts,
  }

  // ── Workflows ──────────────────────────────────────────────────────────────
  const wfList: any[] = workflowsData.status === 'fulfilled'
    ? (workflowsData.value?.workflows ?? [])
    : []

  const published = wfList.filter(w => w.status === 'published').length
  const draft     = wfList.filter(w => w.status === 'draft').length

  const workflows: GHLWorkflowSummary = {
    total:     wfList.length,
    published,
    draft,
    workflows: wfList
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 15)
      .map(w => ({ id: w.id, name: w.name, status: w.status, updatedAt: w.updatedAt })),
  }

  // ── Appointments ──────────────────────────────────────────────────────────
  // Fetch upcoming appointments for each calendar
  const calList: any[] = calendarsData.status === 'fulfilled'
    ? (calendarsData.value?.calendars ?? [])
    : []

  let allAppointments: any[] = []
  const now    = Date.now()
  const future = now + 30 * 24 * 60 * 60 * 1000

  await Promise.allSettled(
    calList.slice(0, 5).map(cal =>
      ghlGet<any>('/calendars/events', {
        locationId:  GHL_LOC_ID,
        calendarId:  cal.id,
        startTime:   now.toString(),
        endTime:     future.toString(),
      }).then(d => {
        allAppointments.push(...(d.events ?? d.appointments ?? []))
      }).catch(() => {})
    )
  )

  allAppointments.sort((a, b) =>
    new Date(a.startTime ?? a.startAt ?? 0).getTime() - new Date(b.startTime ?? b.startAt ?? 0).getTime()
  )

  const appointments: GHLAppointmentSummary = {
    upcoming: allAppointments.length,
    appointments: allAppointments.slice(0, 10).map(a => ({
      title:      a.title ?? a.name ?? 'Appointment',
      startTime:  a.startTime ?? a.startAt ?? '',
      status:     a.appointmentStatus ?? a.status ?? 'confirmed',
      calendarId: a.calendarId ?? '',
    })),
  }

  return {
    source:       'live',
    lastSync:     new Date().toISOString(),
    locationName: 'Exterior Building Solutions',
    totalOpps:    totalOppsCount,
    totalCalls,
    contacts,
    pipelines,
    conversations,
    workflows,
    appointments,
  }
}

// ── Mock fallback ─────────────────────────────────────────────────────────────
export function getMockGHLSummary(): GHLSummary {
  return {
    source:       'mock',
    lastSync:     new Date().toISOString(),
    locationName: 'Exterior Building Solutions',
    totalOpps:    2014,
    totalCalls:   158,
    contacts: {
      total:       2985,
      newInPeriod: 143,
      leads:       820,
      customers:   2165,
      bySource: [
        { source: 'Google Ads',      count: 412 },
        { source: 'Referral',        count: 298 },
        { source: 'Facebook Ads',    count: 187 },
        { source: 'Organic Search',  count: 124 },
        { source: 'Direct',          count: 98  },
        { source: 'Direct / Unknown',count: 1866},
      ],
    },
    pipelines: [
      {
        pipelineId:   'VSb1gZvTs03F7gFy31eX',
        pipelineName: 'AccuLynx',
        total:        1840,
        totalValue:   0,
        stages: [
          { stageId: '28a1839f', stageName: 'Unassigned Lead', count: 412, value: 0 },
          { stageId: '13e950ac', stageName: 'Assigned Lead',   count: 380, value: 0 },
          { stageId: 'e6bfed92', stageName: 'Prospect',        count: 290, value: 0 },
          { stageId: 'ccd83d69', stageName: 'Approved',        count: 180, value: 0 },
          { stageId: 'a7e1886d', stageName: 'Completed',       count: 310, value: 0 },
          { stageId: 'ce4b1a96', stageName: 'Invoiced',        count: 180, value: 0 },
          { stageId: 'ba04dd20', stageName: 'Closed',          count: 58,  value: 0 },
          { stageId: 'be17e0d7', stageName: 'Cancelled',       count: 30,  value: 0 },
        ],
      },
      {
        pipelineId:   'hmijaqwp3VaUn3yNJIxO',
        pipelineName: 'ReferGRO',
        total:        87,
        totalValue:   0,
        stages: [
          { stageId: 'c9032a19', stageName: 'New Referral Request', count: 24, value: 0 },
          { stageId: '7b7c390e', stageName: 'New Referral Lead',    count: 18, value: 0 },
          { stageId: 'c8344487', stageName: 'Referral Booked',      count: 27, value: 0 },
          { stageId: 'cdd751af', stageName: 'Referral Serviced',    count: 18, value: 0 },
        ],
      },
    ],
    conversations: {
      total:        50,
      unread:       8,
      bySmsCall:    34,
      byEmail:      12,
      recentContacts: [],
    },
    workflows: {
      total:     24,
      published: 14,
      draft:     10,
      workflows: [],
    },
    appointments: {
      upcoming: 12,
      appointments: [],
    },
  }
}
