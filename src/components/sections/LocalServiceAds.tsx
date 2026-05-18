import { cn } from '../../utils/format'
import { useLSA } from '../../hooks/useLSA'

const fmt = {
  currency: (n: number) => '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 }),
  pct:      (a: number, b: number) => b > 0 ? Math.round((a / b) * 100) + '%' : '—',
}

function KpiCard({ label, value, sub, color = 'blue', loading }: {
  label: string; value: string | number; sub?: string; color?: string; loading?: boolean
}) {
  const border = color === 'green'  ? 'border-green-200 dark:border-green-900/40'
               : color === 'amber'  ? 'border-amber-200 dark:border-amber-900/40'
               : color === 'purple' ? 'border-purple-200 dark:border-purple-900/40'
               : color === 'red'    ? 'border-red-200 dark:border-red-900/40'
               : 'border-blue-200 dark:border-blue-900/40'
  const dot    = color === 'green'  ? 'bg-green-500'
               : color === 'amber'  ? 'bg-amber-500'
               : color === 'purple' ? 'bg-purple-500'
               : color === 'red'    ? 'bg-red-500'
               : 'bg-blue-500'
  return (
    <div className={cn('bg-white dark:bg-slate-900 border rounded-xl p-4 shadow-sm', border)}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dot)} />
        <p className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">{label}</p>
      </div>
      {loading
        ? <div className="h-7 w-20 bg-gray-100 dark:bg-slate-800 rounded animate-pulse mt-1" />
        : <p className="text-2xl font-bold text-gray-800 dark:text-white">{value}</p>
      }
      {sub && !loading && <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cfg =
    status === 'NEW'      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
  : status === 'ACTIVE'   ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
  : status === 'DECLINED' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
  : status === 'BOOKED'   ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
  : 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400'

  const label =
    status === 'NEW'       ? 'New'
  : status === 'ACTIVE'    ? 'Active'
  : status === 'DECLINED'  ? 'Declined'
  : status === 'BOOKED'    ? 'Booked'
  : status === 'WIPED_OUT' ? 'Invalid'
  : status

  return <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', cfg)}>{label}</span>
}

export function LocalServiceAds() {
  const { data, loading } = useLSA()

  const isLive = data?.source === 'live'

  return (
    <section id="lsa" className="scroll-mt-4">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-gray-800 dark:text-slate-100 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-green-600 text-white text-sm shrink-0">📍</span>
            Local Service Ads
          </h2>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
            Google LSA · Roofing, Siding &amp; Windows · Account 901-408-8688
          </p>
        </div>
        <span className={cn(
          'flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border',
          isLive
            ? 'text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800'
            : 'text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 border-amber-200 dark:border-amber-800'
        )}>
          <span className={cn('w-1.5 h-1.5 rounded-full', loading ? 'bg-amber-400 animate-pulse' : isLive ? 'bg-green-500' : 'bg-amber-400')} />
          {loading ? 'Loading…' : isLive ? 'Live' : 'Sample data'}
        </span>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Total Leads"    value={data?.totalLeads   ?? '—'} sub="All lead types"               color="blue"   loading={loading} />
        <KpiCard label="Charged Leads"  value={data?.chargedLeads ?? '—'} sub={data ? fmt.pct(data.chargedLeads, data.totalLeads) + ' of total' : undefined} color="green"  loading={loading} />
        <KpiCard label="LSA Spend"      value={data ? fmt.currency(data.spend) : '—'}         sub="Period spend"   color="purple" loading={loading} />
        <KpiCard label="Impressions"    value={data?.impressions?.toLocaleString() ?? '—'}     sub={data ? `${data.clicks.toLocaleString()} clicks` : undefined} color="amber"  loading={loading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Lead type + status breakdown */}
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl shadow-sm p-4 space-y-4">

          {/* Lead types */}
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-3">Lead Types</p>
            {loading ? (
              <div className="space-y-2">
                {[60, 35].map((w, i) => <div key={i} className="h-8 rounded-lg bg-gray-100 dark:bg-slate-800 animate-pulse" style={{ width: `${w}%` }} />)}
              </div>
            ) : data ? (
              <div className="space-y-2">
                {[
                  { label: '📞 Phone Calls', value: data.phoneCalls, color: 'bg-blue-500',   total: data.totalLeads },
                  { label: '💬 Messages',    value: data.messages,   color: 'bg-purple-500', total: data.totalLeads },
                ].map(row => (
                  <div key={row.label}>
                    <div className="flex justify-between text-xs text-gray-600 dark:text-slate-300 mb-1">
                      <span className="font-medium">{row.label}</span>
                      <span className="font-bold">{row.value} <span className="font-normal text-gray-400">({fmt.pct(row.value, row.total)})</span></span>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full', row.color)} style={{ width: fmt.pct(row.value, row.total) }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Lead statuses */}
          <div className="pt-3 border-t border-gray-100 dark:border-slate-700">
            <p className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-3">Lead Status</p>
            {loading ? (
              <div className="space-y-1.5">
                {[1,2,3].map(i => <div key={i} className="h-8 rounded-lg bg-gray-100 dark:bg-slate-800 animate-pulse" />)}
              </div>
            ) : data ? (
              <div className="space-y-1.5">
                {[
                  { label: 'Active',   value: data.activeLeads,   color: 'text-green-600 dark:text-green-400',  bg: 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-900/30' },
                  { label: 'New',      value: data.newLeads,      color: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900/30' },
                  { label: 'Declined', value: data.declinedLeads, color: 'text-red-600 dark:text-red-400',      bg: 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30' },
                ].map(row => (
                  <div key={row.label} className={cn('flex items-center justify-between px-3 py-2 rounded-xl border text-xs', row.bg)}>
                    <span className="font-medium text-gray-700 dark:text-slate-300">{row.label}</span>
                    <span className={cn('font-bold text-base', row.color)}>{row.value}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* CPL */}
          {data && !loading && data.chargedLeads > 0 && (
            <div className="pt-3 border-t border-gray-100 dark:border-slate-700">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 dark:text-slate-400 font-medium">Cost per Charged Lead</span>
                <span className="font-bold text-lg text-gray-800 dark:text-white">
                  {fmt.currency(Math.round(data.spend / data.chargedLeads))}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Category breakdown */}
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl shadow-sm p-4">
          <p className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-3">Service Category</p>
          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-gray-100 dark:bg-slate-800 animate-pulse" />)}
            </div>
          ) : data?.categories.length ? (
            <div className="space-y-3">
              {data.categories.map((cat, i) => {
                const colors = ['bg-blue-500', 'bg-purple-500', 'bg-amber-500', 'bg-green-500']
                const color  = colors[i % colors.length]
                const pct    = fmt.pct(cat.total, data.totalLeads)
                return (
                  <div key={cat.category} className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3 border border-gray-100 dark:border-slate-700">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold text-gray-700 dark:text-slate-200">{cat.category}</span>
                      <span className="text-xs font-bold text-gray-500 dark:text-slate-400">{cat.total} leads · {pct}</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
                      <div className={cn('h-full rounded-full', color)} style={{ width: pct }} />
                    </div>
                    <div className="flex gap-3 text-[10px] text-gray-500 dark:text-slate-400">
                      <span>📞 {cat.calls} calls</span>
                      <span>💬 {cat.messages} msgs</span>
                      <span className="ml-auto font-semibold text-green-600 dark:text-green-400">✓ {cat.charged} charged</span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-6">No leads in this period</p>
          )}
        </div>

        {/* Recent leads */}
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl shadow-sm p-4">
          <p className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-3">Recent Leads</p>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-10 rounded-lg bg-gray-100 dark:bg-slate-800 animate-pulse" />
              ))}
            </div>
          ) : data?.recentLeads.length ? (
            <div className="space-y-1.5 overflow-y-auto max-h-[340px]">
              {data.recentLeads.map(lead => (
                <div key={lead.id} className="flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                  <span className="text-base shrink-0">{lead.type === 'PHONE_CALL' ? '📞' : '💬'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 dark:text-slate-300 truncate">{lead.category}{lead.service ? ` · ${lead.service}` : ''}</p>
                    <p className="text-[10px] text-gray-400 dark:text-slate-500">{lead.date}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {lead.charged && (
                      <span className="text-[10px] font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded-full border border-green-200 dark:border-green-900/30">$</span>
                    )}
                    <StatusBadge status={lead.status} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-6">No leads in this period</p>
          )}
        </div>
      </div>
    </section>
  )
}
