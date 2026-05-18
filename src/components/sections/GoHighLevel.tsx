import { useState } from 'react'
import { useDashboard } from '../../context/DashboardContext'
import { useGHLSummary } from '../../hooks/useGHL'
import { type GHLPipelineSummary } from '../../services/ghl'
import { cn } from '../../utils/format'
import { DataBadge } from '../ui/DataBadge'
import { Paginator, usePagination } from '../ui/Paginator'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(ts: string | number): string {
  if (!ts) return '—'
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtTime(ts: string | number): string {
  if (!ts) return ''
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function fmtCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toLocaleString()}`
}

// ── Small shared UI ───────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon, color = 'blue',
}: {
  label: string; value: string | number; sub?: string; icon: string
  color?: 'blue' | 'green' | 'amber' | 'purple' | 'red'
}) {
  const colors = {
    blue:   'bg-blue-50   text-blue-600   border-blue-100',
    green:  'bg-green-50  text-green-600  border-green-100',
    amber:  'bg-amber-50  text-amber-600  border-amber-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    red:    'bg-red-50    text-red-600    border-red-100',
  }
  return (
    <div className={cn('rounded-xl border p-4 shadow-sm', colors[color])}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium opacity-70">{label}</p>
        <span className="text-lg">{icon}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">{title}</p>
  )
}

// ── Pipeline Card ─────────────────────────────────────────────────────────────

const PIPELINE_COLORS: Record<string, string> = {
  'AccuLynx':                    'bg-blue-500',
  '$150 Off Pipeline':           'bg-green-500',
  'ReferGRO':                    'bg-purple-500',
  'ReviewGRO':                   'bg-amber-500',
  'Customer Journey':            'bg-pink-500',
  'New Referrals':               'bg-teal-500',
  'Commercial Referral Partners':'bg-indigo-500',
}

function PipelineCard({ pipeline }: { pipeline: GHLPipelineSummary }) {
  const [expanded, setExpanded] = useState(true)
  const hasValues = pipeline.stages.some(s => s.value > 0)
  const maxCount  = Math.max(...pipeline.stages.map(s => s.count), 1)
  const maxValue  = Math.max(...pipeline.stages.map(s => s.value), 1)
  const color     = PIPELINE_COLORS[pipeline.pipelineName] ?? 'bg-gray-400'

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
      {/* Header row */}
      <button
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2">
          <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', color)} />
          <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">{pipeline.pipelineName}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-gray-800 dark:text-slate-100">{pipeline.total.toLocaleString()} <span className="text-xs font-normal text-gray-400 dark:text-slate-500">opps</span></span>
          {pipeline.totalValue > 0 && (
            <span className="text-sm font-bold text-green-600 dark:text-green-400">{fmtCurrency(pipeline.totalValue)}</span>
          )}
          <span className="text-gray-300 dark:text-slate-600 text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-50 dark:border-slate-800">
          {/* Column headers */}
          <div className="px-4 pt-2.5 pb-1 grid grid-cols-[1fr_auto_auto] gap-x-4 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">
            <span>Stage</span>
            <span className="text-right w-10">Opps</span>
            {hasValues && <span className="text-right w-20">Value</span>}
          </div>

          <div className="px-4 pb-4 space-y-2.5">
            {pipeline.stages
              .slice()
              .sort((a, b) => b.value - a.value || b.count - a.count)
              .map(stage => {
                const barPct = hasValues
                  ? Math.round((stage.value / maxValue) * 100)
                  : Math.round((stage.count / maxCount) * 100)
                return (
                  <div key={stage.stageId}>
                    <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 items-center text-xs mb-1">
                      <span className="text-gray-600 dark:text-slate-300 font-medium truncate">{stage.stageName}</span>
                      <span className="text-gray-700 dark:text-slate-200 font-bold text-right w-10">{stage.count}</span>
                      {hasValues && (
                        <span className={cn(
                          'font-bold text-right w-20',
                          stage.value > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-300 dark:text-slate-600'
                        )}>
                          {stage.value > 0 ? fmtCurrency(stage.value) : '—'}
                        </span>
                      )}
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-slate-700/50 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', color)}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
          </div>

          {/* Footer totals row */}
          {hasValues && (
            <div className="px-4 py-2.5 border-t border-gray-50 dark:border-slate-800 grid grid-cols-[1fr_auto_auto] gap-x-4 text-xs">
              <span className="text-gray-400 dark:text-slate-500 font-medium">Total</span>
              <span className="text-gray-700 dark:text-slate-200 font-bold text-right w-10">{pipeline.total.toLocaleString()}</span>
              <span className="text-green-600 dark:text-green-400 font-bold text-right w-20">{fmtCurrency(pipeline.totalValue)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Workflow List ─────────────────────────────────────────────────────────────

function WorkflowRow({ name, status, updatedAt }: { name: string; status: string; updatedAt: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn(
          'w-1.5 h-1.5 rounded-full shrink-0',
          status === 'published' ? 'bg-green-500' : 'bg-gray-300'
        )} />
        <p className="text-xs text-gray-700 dark:text-slate-200 truncate">{name}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        <span className={cn(
          'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
          status === 'published' ? 'bg-green-50 text-green-700' : 'bg-gray-100 dark:bg-slate-700/50 text-gray-500 dark:text-slate-400'
        )}>
          {status === 'published' ? 'Active' : 'Draft'}
        </span>
        <span className="text-[10px] text-gray-400 dark:text-slate-500">{fmtDate(updatedAt)}</span>
      </div>
    </div>
  )
}

// ── Conversation Type Icon ────────────────────────────────────────────────────

function convIcon(type: string): string {
  if (type.includes('CALL') || type.includes('PHONE')) return '📞'
  if (type.includes('SMS'))   return '💬'
  if (type.includes('EMAIL')) return '✉️'
  if (type.includes('FB'))    return '📘'
  if (type.includes('IG'))    return '📸'
  return '💬'
}

// ── Main Component ────────────────────────────────────────────────────────────

export function GoHighLevel() {
  const { dateRange } = useDashboard()
  const { data, loading, error, refetch } = useGHLSummary(dateRange)

  // Use real total from API meta, not paginated sum
  const totalOpps  = data?.totalOpps ?? data?.pipelines.reduce((a, p) => a + p.total, 0) ?? 0
  const totalValue = data?.pipelines.reduce((a, p) => a + p.totalValue, 0) ?? 0

  // Pagination state
  const convPagination = usePagination(data?.conversations.recentContacts ?? [], 8)
  const wfPagination   = usePagination(data?.workflows.workflows ?? [], 10)
  const aptPagination  = usePagination(data?.appointments.appointments ?? [], 5)

  return (
    <section id="ghl" className="scroll-mt-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-gray-800 dark:text-slate-100 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-purple-600 text-white text-sm shrink-0">⚡</span>
            GROMAAP CRM
          </h2>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 ml-9">GoHighLevel · Contacts, pipeline, conversations &amp; automations</p>
        </div>
        <div className="flex items-center gap-2">
          {data && <DataBadge source={data.source} lastSync={data.lastSync} />}
          <button
            onClick={refetch}
            className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:text-slate-200 transition-colors"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* ── Top KPI row ── */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 animate-pulse">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 dark:bg-slate-700/50 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <KpiCard
            icon="👥"
            label="Total Contacts"
            value={(data?.contacts.total ?? 0).toLocaleString()}
            sub={`+${data?.contacts.newInPeriod ?? 0} this period`}
            color="blue"
          />
          <KpiCard
            icon="🎯"
            label="Opportunities"
            value={totalOpps.toLocaleString()}
            sub={totalValue > 0 ? `${fmtCurrency(totalValue)} total value` : `${data?.pipelines.length ?? 0} pipelines`}
            color="purple"
          />
          <KpiCard
            icon="💬"
            label="Conversations"
            value={(data?.conversations.total ?? 0).toLocaleString()}
            sub={`${data?.conversations.unread ?? 0} unread`}
            color={( data?.conversations.unread ?? 0) > 0 ? 'amber' : 'green'}
          />
          <KpiCard
            icon="⚡"
            label="Active Workflows"
            value={data?.workflows.published ?? 0}
            sub={`${data?.workflows.draft ?? 0} in draft`}
            color="green"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-4">

        {/* ── Contact Breakdown ── */}
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl shadow-sm p-4">
          <SectionHeader title="Contact Sources" />
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[...Array(5)].map((_, i) => <div key={i} className="h-6 bg-gray-100 dark:bg-slate-700/50 rounded" />)}
            </div>
          ) : (
            <>
              {/* Lead vs Customer split */}
              <div className="flex gap-3 mb-4">
                <div className="flex-1 bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-blue-500 font-medium">Leads</p>
                  <p className="text-xl font-bold text-blue-700">{(data?.contacts.leads ?? 0).toLocaleString()}</p>
                </div>
                <div className="flex-1 bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-green-500 font-medium">Customers</p>
                  <p className="text-xl font-bold text-green-700">{(data?.contacts.customers ?? 0).toLocaleString()}</p>
                </div>
              </div>

              {/* Source breakdown */}
              <p className="text-xs text-gray-400 dark:text-slate-500 font-medium mb-2">By Source</p>
              <div className="space-y-1.5">
                {(data?.contacts.bySource ?? []).map(s => {
                  const pct = data?.contacts.total
                    ? Math.round((s.count / data.contacts.total) * 100)
                    : 0
                  return (
                    <div key={s.source}>
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span className="text-gray-600 dark:text-slate-300 truncate max-w-[160px]">{s.source}</span>
                        <span className="text-gray-700 dark:text-slate-200 font-semibold shrink-0 ml-2">{s.count} <span className="text-gray-400 dark:text-slate-500 font-normal">({pct}%)</span></span>
                      </div>
                      <div className="h-1 bg-gray-100 dark:bg-slate-700/50 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* ── Conversations ── */}
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl shadow-sm p-4">
          <SectionHeader title="Recent Conversations" />
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-gray-100 dark:bg-slate-700/50 rounded" />)}
            </div>
          ) : (
            <>
              {/* Type breakdown pills */}
              <div className="flex gap-2 mb-3">
                <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-2.5 py-1 font-medium">
                  📞 {data?.conversations.bySmsCall ?? 0} Calls/SMS
                </span>
                <span className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 border border-purple-100 rounded-full px-2.5 py-1 font-medium">
                  ✉️ {data?.conversations.byEmail ?? 0} Email
                </span>
                {(data?.conversations.unread ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-700 border border-red-100 rounded-full px-2.5 py-1 font-medium">
                    🔴 {data?.conversations.unread} Unread
                  </span>
                )}
              </div>

              {/* Recent list */}
              {(data?.conversations.recentContacts ?? []).length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-slate-500 italic">No recent conversations</p>
              ) : (
                <>
                  <div className="space-y-1.5">
                    {convPagination.paged.map((c, i) => (
                      <div key={i} className="flex items-center gap-2.5 py-1.5 border-b border-gray-50 last:border-0">
                        <span className="text-sm shrink-0">{convIcon(c.type)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-700 dark:text-slate-200 truncate">{c.name}</p>
                          <p className="text-[10px] text-gray-400 dark:text-slate-500">{c.lastMessage.replace('TYPE_', '')}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] text-gray-400 dark:text-slate-500">{fmtDate(c.date)}</p>
                          <p className="text-[10px] text-gray-300">{fmtTime(c.date)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Paginator
                    page={convPagination.page} pageSize={convPagination.pageSize}
                    total={convPagination.total} onChange={convPagination.setPage}
                    className="-mx-4 -mb-4 mt-2 rounded-b-xl"
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Pipelines ── */}
      <div className="mb-4">
        <SectionHeader title="Pipelines & Opportunities" />
        {loading ? (
          <div className="space-y-2 animate-pulse">
            {[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-gray-100 dark:bg-slate-700/50 rounded-xl" />)}
          </div>
        ) : (
          <div className="space-y-2">
            {(data?.pipelines ?? []).map(p => (
              <PipelineCard key={p.pipelineId} pipeline={p} />
            ))}
            {(data?.pipelines ?? []).length === 0 && (
              <p className="text-xs text-gray-400 dark:text-slate-500 italic">No pipeline data available.</p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">

        {/* ── Workflows ── */}
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <SectionHeader title="Workflows / Automations" />
            <div className="flex items-center gap-1.5">
              <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
                {data?.workflows.published ?? 0} active
              </span>
              <span className="text-xs bg-gray-100 dark:bg-slate-700/50 text-gray-500 dark:text-slate-400 px-2 py-0.5 rounded-full font-medium">
                {data?.workflows.draft ?? 0} draft
              </span>
            </div>
          </div>
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[...Array(6)].map((_, i) => <div key={i} className="h-8 bg-gray-100 dark:bg-slate-700/50 rounded" />)}
            </div>
          ) : (data?.workflows.workflows ?? []).length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-slate-500 italic">No workflows found.</p>
          ) : (
            <>
              <div>
                {wfPagination.paged.map(w => (
                  <WorkflowRow key={w.id} name={w.name} status={w.status} updatedAt={w.updatedAt} />
                ))}
              </div>
              <Paginator
                page={wfPagination.page} pageSize={wfPagination.pageSize}
                total={wfPagination.total} onChange={wfPagination.setPage}
                className="-mx-4 -mb-4 mt-2 rounded-b-xl"
              />
            </>
          )}
        </div>

        {/* ── Appointments ── */}
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <SectionHeader title="Upcoming Appointments" />
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              {data?.appointments.upcoming ?? 0} upcoming
            </span>
          </div>
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-gray-100 dark:bg-slate-700/50 rounded" />)}
            </div>
          ) : (data?.appointments.appointments ?? []).length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-slate-500 italic">No upcoming appointments in the next 30 days.</p>
          ) : (
            <>
              <div className="space-y-2">
                {aptPagination.paged.map((apt, i) => (
                  <div key={i} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                    <div className="bg-blue-50 rounded-lg px-2 py-1 text-center shrink-0 min-w-[44px]">
                      <p className="text-[10px] text-blue-400 uppercase font-semibold leading-tight">
                        {apt.startTime ? new Date(apt.startTime).toLocaleDateString('en-US', { month: 'short' }) : '—'}
                      </p>
                      <p className="text-sm font-bold text-blue-700 leading-tight">
                        {apt.startTime ? new Date(apt.startTime).getDate() : '—'}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700 dark:text-slate-200 truncate">{apt.title}</p>
                      <p className="text-[10px] text-gray-400 dark:text-slate-500">
                        {apt.startTime ? fmtTime(apt.startTime) : '—'}
                        {apt.status && apt.status !== 'confirmed' && (
                          <span className="ml-1.5 capitalize text-amber-500">{apt.status}</span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <Paginator
                page={aptPagination.page} pageSize={aptPagination.pageSize}
                total={aptPagination.total} onChange={aptPagination.setPage}
                className="-mx-4 -mb-4 mt-2 rounded-b-xl"
              />
            </>
          )}
        </div>
      </div>

      {error && !loading && (
        <p className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          ⚠ {error}
        </p>
      )}
    </section>
  )
}
