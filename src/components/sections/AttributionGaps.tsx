import { useState, useEffect, useCallback } from 'react'
import { useDashboard } from '../../context/DashboardContext'
import { acculynxService, type AttributionGapLead, type AttributionGapReport } from '../../services/acculynx'
import { cn } from '../../utils/format'
import { Paginator, usePagination } from '../ui/Paginator'

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

type FilterTab = 'all' | 'not_in_crm' | 'wrong_source'

const STATUS_CONFIG = {
  not_in_crm:   { label: 'Not in CRM',     bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',    dot: 'bg-red-500'    },
  wrong_source: { label: 'Wrong Source',   bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  dot: 'bg-amber-500'  },
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatPill({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl px-5 py-3 shadow-sm min-w-[90px]">
      <span className={cn('text-2xl font-bold', color)}>{value}</span>
      <span className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 text-center leading-tight">{label}</span>
    </div>
  )
}

// ── Job Timeline Panel ────────────────────────────────────────────────────────
// Shows AccuLynx milestone dates as a timeline of touchpoints.
// The AccuLynx v2 REST API does not expose raw notes/communications,
// so we use the rich Lead Status CSV data embedded in the gap lead.

type TimelineEvent = { date: string; label: string; icon: string }

function JobTimelinePanel({ lead }: { lead: AttributionGapLead }) {
  // Build ordered timeline from available milestone dates
  const events: TimelineEvent[] = [
    lead.jobLeadDate     && { date: lead.jobLeadDate,     label: 'Lead Created',           icon: '📋' },
    lead.jobAssignedDate && { date: lead.jobAssignedDate, label: 'Assigned to Salesperson', icon: '👤' },
    lead.jobEstimateDate && { date: lead.jobEstimateDate, label: 'Estimate Scheduled',      icon: '📅' },
    lead.jobApprovedDate && { date: lead.jobApprovedDate, label: 'Job Approved / Signed',   icon: '✅' },
  ].filter((e): e is TimelineEvent => !!e)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const touchpointCount = events.length

  return (
    <div className="mt-3 border-t border-gray-200 dark:border-slate-700 pt-3">

      {/* Header */}
      <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2">
        {touchpointCount > 0
          ? `${touchpointCount} AccuLynx Touchpoint${touchpointCount !== 1 ? 's' : ''}`
          : 'AccuLynx Job History'}
        {lead.acculynxJobName && (
          <span className="ml-2 font-normal text-gray-400 dark:text-slate-500 normal-case tracking-normal">
            · {lead.acculynxJobName}
          </span>
        )}
      </p>

      {/* Job metadata chips */}
      <div className="flex flex-wrap gap-2 mb-3">
        {lead.jobMilestone && (
          <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2.5 py-1 font-medium">
            🏷 {lead.jobMilestone}
          </span>
        )}
        {lead.jobSalesperson && (
          <span className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-2.5 py-1 font-medium">
            👤 {lead.jobSalesperson}
          </span>
        )}
        {lead.jobEstimateTotal != null && lead.jobEstimateTotal > 0 && (
          <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-2.5 py-1 font-medium">
            💰 ${lead.jobEstimateTotal.toLocaleString()} estimate
          </span>
        )}
        {lead.jobDaysInStatus != null && (
          <span className={cn(
            'inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-1 font-medium border',
            lead.jobDaysInStatus > 30
              ? 'bg-red-50 text-red-700 border-red-200'
              : lead.jobDaysInStatus > 14
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-gray-50 text-gray-600 border-gray-200'
          )}>
            ⏱ {lead.jobDaysInStatus}d in current status
          </span>
        )}
        {lead.jobLastTouched != null && (
          <span className={cn(
            'inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-1 font-medium border',
            lead.jobLastTouched > 14
              ? 'bg-red-50 text-red-700 border-red-200'
              : lead.jobLastTouched > 7
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-green-50 text-green-700 border-green-200'
          )}>
            🕐 Last touched {lead.jobLastTouched}d ago
            {lead.jobLastTouched > 14 && ' — needs follow-up'}
          </span>
        )}
      </div>

      {/* Timeline */}
      {events.length > 0 ? (
        <div className="relative ml-1">
          {/* Vertical connector line */}
          {events.length > 1 && (
            <div className="absolute left-[10px] top-4 bottom-4 w-px bg-gray-200 dark:bg-slate-700" />
          )}
          <div className="space-y-2">
            {events.map((e, i) => (
              <div key={i} className="flex items-start gap-3 relative">
                {/* Icon dot */}
                <div className="w-5 h-5 flex items-center justify-center shrink-0 bg-white dark:bg-slate-900 z-10">
                  <span className="text-sm leading-none">{e.icon}</span>
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-lg px-3 py-2 shadow-sm">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-gray-700 dark:text-slate-200">{e.label}</span>
                    <span className="text-xs text-gray-400 dark:text-slate-500 shrink-0">
                      {new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-400 dark:text-slate-500 italic">
          No timeline data available from Lead Status report.
          {lead.acculynxJobId && ' Open AccuLynx to view full job history.'}
        </p>
      )}

      {/* AccuLynx deep-link */}
      {lead.acculynxJobId && (
        <a
          href={`https://my.acculynx.com/jobs/${lead.acculynxJobId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline"
        >
          🔗 Open job in AccuLynx ↗
        </a>
      )}
    </div>
  )
}

function GapRow({
  lead, index, checked, onCheck,
}: {
  lead: AttributionGapLead
  index: number
  checked: boolean
  onCheck: (id: string, val: boolean) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const cfg = STATUS_CONFIG[lead.matchStatus]

  return (
    <>
      <tr className={cn(
        'hover:bg-gray-50 dark:hover:bg-slate-800 select-none',
        checked && 'bg-blue-50/60 dark:bg-blue-900/10',
      )}>
        {/* Checkbox cell — click doesn't expand row */}
        <td className="pl-4 pr-2 py-2.5 w-8" onClick={e => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={checked}
            onChange={e => onCheck(lead.id, e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer accent-blue-600"
          />
        </td>
        <td
          className="px-4 py-2.5 text-gray-400 dark:text-slate-500 text-xs w-8 cursor-pointer"
          onClick={() => setExpanded(e => !e)}
        >{index + 1}</td>
        <td className="px-4 py-2.5 font-mono text-sm font-medium text-gray-800 dark:text-slate-100 cursor-pointer" onClick={() => setExpanded(e => !e)}>{lead.phone}</td>
        <td className="px-4 py-2.5 text-xs text-gray-600 dark:text-slate-300 cursor-pointer" onClick={() => setExpanded(e => !e)}>
          <div>{fmtDate(lead.date)}</div>
          <div className="text-gray-400 dark:text-slate-500">{fmtTime(lead.date)}</div>
        </td>
        <td className="px-4 py-2.5 text-xs cursor-pointer" onClick={() => setExpanded(e => !e)}>
          <span className={cn(
            'inline-block px-2 py-0.5 rounded-full font-medium',
            lead.durationSecs >= 120 ? 'bg-green-50 text-green-700'
              : lead.durationSecs >= 45 ? 'bg-blue-50 text-blue-700'
              : 'bg-gray-100 text-gray-500'
          )}>
            {fmtDuration(lead.durationSecs)}
          </span>
        </td>
        <td className="px-4 py-2.5 text-xs text-gray-600 dark:text-slate-300 cursor-pointer" onClick={() => setExpanded(e => !e)}>{lead.adType}</td>
        <td className="px-4 py-2.5 text-xs text-gray-600 dark:text-slate-300 max-w-[160px] truncate cursor-pointer" onClick={() => setExpanded(e => !e)}>{lead.campaign}</td>
        <td className="px-4 py-2.5 cursor-pointer" onClick={() => setExpanded(e => !e)}>
          <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border', cfg.bg, cfg.text, cfg.border)}>
            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', cfg.dot)} />
            {cfg.label}
          </span>
        </td>
        <td
          className="px-4 py-2.5 text-gray-300 dark:text-slate-600 text-xs text-right cursor-pointer"
          onClick={() => setExpanded(e => !e)}
        >{expanded ? '▲' : '▼'}</td>
      </tr>

      {expanded && (
        <tr className={cn('border-b border-gray-100 dark:border-slate-700', cfg.bg)}>
          <td colSpan={9} className="px-6 py-4">
            {/* Call details grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <p className="text-gray-400 dark:text-slate-500 uppercase tracking-wide font-semibold mb-0.5">Keyword</p>
                <p className="text-gray-700 dark:text-slate-200 font-medium">"{lead.keyword}"</p>
              </div>
              <div>
                <p className="text-gray-400 dark:text-slate-500 uppercase tracking-wide font-semibold mb-0.5">Campaign</p>
                <p className="text-gray-700 dark:text-slate-200">{lead.campaign}</p>
              </div>
              <div>
                <p className="text-gray-400 dark:text-slate-500 uppercase tracking-wide font-semibold mb-0.5">Call Duration</p>
                <p className={cn('font-semibold', lead.durationSecs >= 60 ? 'text-green-600' : 'text-gray-600 dark:text-slate-300')}>
                  {fmtDuration(lead.durationSecs)}
                  {lead.durationSecs >= 60 && <span className="ml-1 text-green-500 font-normal">✓ quality call</span>}
                </p>
              </div>
              {lead.matchStatus === 'wrong_source' ? (
                <div>
                  <p className="text-gray-400 dark:text-slate-500 uppercase tracking-wide font-semibold mb-0.5">AccuLynx Job</p>
                  <p className="text-gray-700 dark:text-slate-200 font-medium">{lead.acculynxJobName}</p>
                  <p className="text-amber-600 mt-0.5">
                    Source: <strong>{lead.acculynxSource}</strong> — should be Google Ads
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-gray-400 dark:text-slate-500 uppercase tracking-wide font-semibold mb-0.5">CRM Status</p>
                  <p className="text-red-600 font-medium">Not found in AccuLynx</p>
                  <p className="text-gray-400 dark:text-slate-500 mt-0.5">Create a new job and set source to Google Ads</p>
                </div>
              )}
            </div>

            {/* Job timeline — shown for wrong_source rows */}
            {lead.matchStatus === 'wrong_source' && (
              <JobTimelinePanel lead={lead} />
            )}
          </td>
        </tr>
      )}
    </>
  )
}

// ── Export helpers ────────────────────────────────────────────────────────────

function buildCsv(gaps: AttributionGapLead[]): string {
  const headers = ['#', 'Phone', 'Date', 'Time', 'Duration', 'Ad Type', 'Campaign', 'Keyword', 'Status', 'AccuLynx Job', 'AccuLynx Source']
  const rows = gaps.map((g, i) => [
    i + 1,
    g.phone,
    fmtDate(g.date),
    fmtTime(g.date),
    fmtDuration(g.durationSecs),
    g.adType,
    g.campaign,
    g.keyword,
    STATUS_CONFIG[g.matchStatus].label,
    g.acculynxJobName ?? '',
    g.acculynxSource  ?? '',
  ])
  return [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
}

function downloadCsv(gaps: AttributionGapLead[]) {
  const csv  = buildCsv(gaps)
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `ebs-google-ads-attribution-gaps-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

async function sendEmailViaServer(leads: AttributionGapLead[], report: AttributionGapReport): Promise<void> {
  const notInCrm    = leads.filter(g => g.matchStatus === 'not_in_crm').length
  const wrongSource = leads.filter(g => g.matchStatus === 'wrong_source').length
  const pct         = report.totalGadsCalls > 0
    ? Math.round((leads.length / report.totalGadsCalls) * 100)
    : 0

  const subject = `Action Required: ${leads.length} Google Ads Lead${leads.length !== 1 ? 's' : ''} Need Attribution Fix`
  const body    =
`Hi EBS Team,

Our attribution analysis has identified ${leads.length} lead${leads.length !== 1 ? 's' : ''} (${pct}% of all Google Ads calls in this period) that are missing proper Google Ads attribution in AccuLynx.

SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Google Ads calls:    ${report.totalGadsCalls}
Correctly attributed:      ${report.matchedInAccuLynx}
Selected for this report:  ${leads.length}

  ├─ Not in AccuLynx at all:     ${notInCrm}
  └─ Wrong source in AccuLynx:   ${wrongSource}

ACTION REQUIRED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
For "Not in CRM" leads → Create a new job in AccuLynx and set Lead Source = Google Ads
For "Wrong Source" leads → Find the job in AccuLynx and update Lead Source to Google Ads

The selected leads (with phone numbers, call times, and ad details) are attached as a CSV file.

This data is generated from the Grokon · EBS Dashboard.
Report date: ${report.reportDate ? new Date(report.reportDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'today'}

Regards,
Grokon Dashboard`

  const csvContent  = buildCsv(leads)
  const csvFilename = `ebs-google-ads-attribution-gaps-${new Date().toISOString().slice(0, 10)}.csv`

  const res = await fetch('http://localhost:3001/api/send-email', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ subject, body, csvContent, csvFilename }),
  })

  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to send email')
}

// ── Main component ────────────────────────────────────────────────────────────

export function AttributionGaps() {
  const { dateRange } = useDashboard()
  const [report,  setReport]  = useState<AttributionGapReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [open,       setOpen]       = useState(false)
  const [tab,        setTab]        = useState<FilterTab>('all')
  const [sending,    setSending]    = useState(false)
  const [sendResult, setSendResult] = useState<'sent' | 'error' | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await acculynxService.attributionGaps(dateRange)
      setReport(data)
      if (data.error) setError(data.error)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  useEffect(() => { load() }, [load])

  const filtered = report?.gaps.filter(g =>
    tab === 'all' ? true : g.matchStatus === tab
  ) ?? []

  const gapPagination = usePagination(filtered, 10)

  // ── Selection helpers ────────────────────────────────────────────────────
  const allFilteredSelected = filtered.length > 0 && filtered.every(g => selectedIds.has(g.id))
  const someFilteredSelected = filtered.some(g => selectedIds.has(g.id))

  function toggleOne(id: string, val: boolean) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      val ? next.add(id) : next.delete(id)
      return next
    })
  }

  function toggleAll(val: boolean) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      filtered.forEach(g => val ? next.add(g.id) : next.delete(g.id))
      return next
    })
  }

  const selectedLeads = (report?.gaps ?? []).filter(g => selectedIds.has(g.id))

  const notInCrmCount    = report?.gaps.filter(g => g.matchStatus === 'not_in_crm').length ?? 0
  const wrongSourceCount = report?.gaps.filter(g => g.matchStatus === 'wrong_source').length ?? 0
  const pct              = report && report.totalGadsCalls > 0
    ? Math.round((report.gapCount / report.totalGadsCalls) * 100)
    : 0

  const handleSendToEBS = async () => {
    if (!report) return
    const leadsToSend = selectedLeads.length > 0 ? selectedLeads : filtered
    if (leadsToSend.length === 0) return
    setSending(true)
    setSendResult(null)
    try {
      await sendEmailViaServer(leadsToSend, report)
      setSendResult('sent')
      setTimeout(() => setSendResult(null), 4000)
    } catch {
      setSendResult('error')
      setTimeout(() => setSendResult(null), 5000)
    } finally {
      setSending(false)
    }
  }

  return (
    <section id="attribution-gaps" className="scroll-mt-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-gray-800 dark:text-slate-100 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600 text-white text-sm shrink-0">G</span>
            Google Ads Attribution Gaps
          </h2>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 ml-9">Leads tracked in Google Ads but missing from AccuLynx CRM</p>
        </div>
        <div className="flex items-center gap-2">
          {report?.source === 'mock' && (
            <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-full">
              ● Sample data · Connect Google Ads for live
            </span>
          )}
          {report?.reportDate && (
            <span className="text-xs text-gray-400 dark:text-slate-500">
              Report: {new Date(report.reportDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300 transition-colors disabled:opacity-40"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* ── Summary banner ── */}
      <div className={cn(
        'rounded-xl border p-4 mb-4',
        loading ? 'bg-gray-50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700' :
        (report?.gapCount ?? 0) > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
      )}>
        {loading ? (
          <div className="flex gap-3 animate-pulse">
            {[80, 90, 80, 90].map((w, i) => (
              <div key={i} className="bg-gray-200 dark:bg-slate-700 rounded-xl h-16" style={{ width: w }} />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            {/* Stats */}
            <StatPill value={report?.totalGadsCalls ?? 0}    label="Google Ads Calls"   color="text-blue-600"  />
            <StatPill value={report?.matchedInAccuLynx ?? 0} label="Matched in AccuLynx" color="text-green-600" />
            <div className="text-2xl text-gray-300 font-light hidden sm:block">/</div>
            <StatPill value={report?.gapCount ?? 0}          label="Attribution Gaps"    color="text-red-600"   />
            <StatPill value={notInCrmCount}                   label="Not in CRM"          color="text-red-500"   />
            <StatPill value={wrongSourceCount}                label="Wrong Source"        color="text-amber-600" />

            {/* Spacer */}
            <div className="flex-1" />

            {/* CTA buttons */}
            {(report?.gapCount ?? 0) > 0 && (
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {sendResult === 'sent' && (
                  <span className="text-xs text-green-600 font-medium bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">
                    ✓ Email sent to EBS team
                  </span>
                )}
                {sendResult === 'error' && (
                  <span className="text-xs text-red-600 font-medium bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg">
                    ✗ Failed to send — check server
                  </span>
                )}
                <button
                  onClick={() => setOpen(o => !o)}
                  className={cn(
                    'flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg transition-colors',
                    open
                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      : 'bg-red-600 text-white hover:bg-red-700 shadow-sm'
                  )}
                >
                  {open ? '▲ Hide Leads' : `▼ View ${report?.gapCount} Missing Leads`}
                </button>
                <button
                  onClick={handleSendToEBS}
                  disabled={sending}
                  className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-60"
                >
                  {sending ? '⏳ Sending…' : '✉ Send to EBS'}
                </button>
              </div>
            )}

            {(report?.gapCount ?? 0) === 0 && !loading && (
              <span className="text-sm font-semibold text-green-700">✓ All Google Ads calls are attributed correctly</span>
            )}
          </div>
        )}

        {/* Variance bar */}
        {!loading && (report?.totalGadsCalls ?? 0) > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400 mb-1">
              <span>Attribution coverage</span>
              <span className={cn('font-semibold', pct > 20 ? 'text-red-600' : pct > 10 ? 'text-amber-600' : 'text-green-600')}>
                {100 - pct}% matched · {pct}% gap
              </span>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-400 rounded-full transition-all duration-500"
                style={{ width: `${100 - pct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Expanded leads table ── */}
      {open && (
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
          {/* Table toolbar */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between gap-3 flex-wrap">
            {/* Filter tabs */}
            <div className="flex items-center gap-1">
              {([
                ['all',          `All (${report?.gapCount ?? 0})`],
                ['not_in_crm',   `Not in CRM (${notInCrmCount})`],
                ['wrong_source', `Wrong Source (${wrongSourceCount})`],
              ] as [FilterTab, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={cn(
                    'text-xs px-3 py-1.5 rounded-lg font-medium transition-colors',
                    tab === key
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Export + Send */}
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-2.5 py-1 rounded-lg">
                  {selectedIds.size} selected
                </span>
              )}
              <button
                onClick={() => report && downloadCsv(selectedLeads.length > 0 ? selectedLeads : filtered)}
                className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 border border-gray-200 dark:border-slate-700 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
              >
                ↓ Export {selectedLeads.length > 0 ? `(${selectedLeads.length})` : 'CSV'}
              </button>
              <button
                onClick={handleSendToEBS}
                disabled={sending}
                className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                {sending ? '⏳ Sending…' : selectedLeads.length > 0 ? `✉ Send ${selectedLeads.length} to EBS` : '✉ Send All to EBS'}
              </button>
            </div>
          </div>

          {/* Instructions banner */}
          <div className="px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-900/40 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
            <span className="shrink-0 mt-0.5">ℹ</span>
            <span>
              <strong>How to fix:</strong> For "Not in CRM" — create a new AccuLynx job with <em>Lead Source = Google Ads</em>.
              For "Wrong Source" — find the existing job and update its Lead Source to <em>Google Ads</em>.
              Click any row to expand call details.
            </span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[700px]">
              <thead className="bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                <tr>
                  <th className="pl-4 pr-2 py-2.5 w-8">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      ref={el => { if (el) el.indeterminate = someFilteredSelected && !allFilteredSelected }}
                      onChange={e => toggleAll(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer accent-blue-600"
                      title="Select all"
                    />
                  </th>
                  <th className="text-left px-4 py-2.5 w-8">#</th>
                  <th className="text-left px-4 py-2.5">Phone</th>
                  <th className="text-left px-4 py-2.5">Date / Time</th>
                  <th className="text-left px-4 py-2.5">Duration</th>
                  <th className="text-left px-4 py-2.5">Ad Type</th>
                  <th className="text-left px-4 py-2.5">Campaign</th>
                  <th className="text-left px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 w-6" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                {gapPagination.paged.map((lead, i) => (
                  <GapRow
                    key={lead.id}
                    lead={lead}
                    index={gapPagination.page * gapPagination.pageSize + i}
                    checked={selectedIds.has(lead.id)}
                    onCheck={toggleOne}
                  />
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-400 dark:text-slate-500">
                      No gaps found for this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Paginator + footer note */}
          <Paginator
            page={gapPagination.page} pageSize={gapPagination.pageSize}
            total={gapPagination.total} onChange={gapPagination.setPage}
          />
          <div className="px-4 py-2 border-t border-gray-100 dark:border-slate-700 text-xs text-gray-400 dark:text-slate-500 flex items-center justify-between">
            <span>Phone numbers masked for privacy</span>
            {report?.source === 'mock' && (
              <span className="text-amber-500">⚠ Sample data — connect Google Ads API for real call feed</span>
            )}
          </div>
        </div>
      )}

      {error && !loading && (
        <p className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          ⚠ {error}
        </p>
      )}
    </section>
  )
}
