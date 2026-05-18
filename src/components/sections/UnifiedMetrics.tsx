import { MetricCard } from '../ui/MetricCard'
import { useAccuLynxSummary } from '../../hooks/useAccuLynx'
import { useGoogleAdsSummary } from '../../hooks/useGoogleAds'
import { useGHLSummary } from '../../hooks/useGHL'
import { useDashboard } from '../../context/DashboardContext'
import { getKpiSummary } from '../../data/mockData'
import { fmt } from '../../utils/format'
import { DataBadge } from '../ui/DataBadge'

export function UnifiedMetrics() {
  const { dateRange, compareMode } = useDashboard()
  const { data, loading, refetch } = useAccuLynxSummary(dateRange)
  const { data: gads }             = useGoogleAdsSummary(dateRange)
  const { data: ghl }              = useGHLSummary(dateRange)

  // Mock-scaled KPIs for platforms not yet connected (Calls, GSC)
  const mock = getKpiSummary(dateRange, compareMode)

  const gadsLive  = gads?.source === 'live'
  const ghlLive   = ghl?.source  === 'live'
  const adSpend   = gadsLive ? fmt.currency(gads!.totals.spend) : fmt.currency(mock.totalSpend.value)
  const costPerLead = gadsLive && gads!.totals.costPerConversion > 0
    ? `$${gads!.totals.costPerConversion}`
    : `$${mock.costPerLead.value}`

  // ── Live AccuLynx KPIs (filtered by dateRange) ────────────────────────────
  // liveJobCount: real-time total from jobs API (always fresh, unfiltered)
  // totalLeads:   count from report CSV filtered to selected date range
  const liveJobCount  = data?.liveJobCount ?? 0
  const totalLeads    = data?.leadSources.reduce((a, s) => a + s.acculynx, 0) ?? 0
  const totalValue    = data?.leadSources.reduce((a, s) => a + s.totalValue, 0) ?? 0

  const INACTIVE      = ['closed', 'dead', 'cancelled', 'lost']
  const pipelineValue = data?.pipeline
    .filter(p => !INACTIVE.some(x => p.stage.toLowerCase().includes(x)))
    .reduce((a, p) => a + p.value, 0) ?? 0

  const weightedClose = totalLeads > 0
    ? Math.round(
        (data?.leadSources ?? []).reduce((a, s) => a + (s.closingPct ?? 0) * s.acculynx, 0) / totalLeads
      )
    : null

  const revenuePerLead = totalLeads > 0 ? Math.round(totalValue / totalLeads) : 0

  const isLive = data?.source === 'live'

  return (
    <section id="kpi" className="scroll-mt-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-gray-800 dark:text-slate-100 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-700 text-white text-sm shrink-0">📊</span>
            Key Performance Indicators
          </h2>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 ml-9">Live KPIs across all connected platforms</p>
        </div>
        <div className="flex items-center gap-2">
          {data && <DataBadge source={data.source} dataSource={data.dataSource} lastSync={data.lastSync} />}
          <button onClick={refetch} className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300 transition-colors">↻ Refresh</button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* ── AccuLynx live ── */}
        <MetricCard
          label="Total Jobs in CRM"
          value={loading ? '…' : liveJobCount || totalLeads}
          source={isLive ? 'live' : 'mock'}
          platform="AccuLynx"
          loading={loading}
          highlight
          sub={
            isLive && liveJobCount
              ? `${totalLeads} in ${dateRange ?? 'all time'} · Live count`
              : `Top: ${data?.leadSources[0]?.source ?? '—'}`
          }
        />
        <MetricCard
          label="Active Pipeline"
          value={loading ? '…' : fmt.currency(pipelineValue)}
          source={isLive ? 'live' : 'mock'}
          platform="AccuLynx"
          loading={loading}
          sub="Excl. closed / dead"
        />
        <MetricCard
          label="Contract Value"
          value={loading ? '…' : fmt.currency(totalValue)}
          source={isLive ? 'live' : 'mock'}
          platform="AccuLynx"
          loading={loading}
          sub="All lead sources"
        />
        <MetricCard
          label="Avg Close Rate"
          value={loading ? '…' : weightedClose !== null ? `${weightedClose}%` : '—'}
          source={isLive ? 'live' : 'mock'}
          platform="AccuLynx"
          loading={loading}
          sub="Weighted by leads"
        />
        <MetricCard
          label="Revenue per Lead"
          value={loading ? '…' : revenuePerLead > 0 ? fmt.currency(revenuePerLead) : '—'}
          source={isLive ? 'live' : 'mock'}
          platform="AccuLynx"
          loading={loading}
          sub="Contract ÷ leads"
        />

        {/* ── Google Ads / GROMAAP ── */}
        <MetricCard
          label="Total Ad Spend"
          value={adSpend}
          change={gadsLive ? undefined : mock.totalSpend.change}
          source={gadsLive ? 'live' : 'mock'}
          platform="Google Ads"
          sub={gadsLive ? `${gads!.totals.clicks.toLocaleString()} clicks` : 'Connect Google Ads'}
        />
        <MetricCard
          label="Cost per Lead"
          value={costPerLead}
          change={gadsLive ? undefined : mock.costPerLead.change}
          source={gadsLive ? 'live' : 'mock'}
          platform="Google Ads"
          sub={gadsLive ? `${gads!.totals.conversions} conversions` : 'Needs Google Ads'}
        />
        <MetricCard
          label="Total Calls"
          value={ghlLive ? (ghl!.totalCalls).toLocaleString() : mock.totalCalls.value}
          change={ghlLive ? undefined : mock.totalCalls.change}
          source={ghlLive ? 'live' : 'mock'}
          platform="GROMAAP"
          sub={ghlLive ? 'Phone conversations · GROMAAP' : 'Connect GROMAAP'}
        />
      </div>

      {/* ── Freshness strip ──────────────────────────────────── */}
      {isLive && (
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-400 dark:text-slate-500 px-1">
          {data?.liveJobCount != null && (
            <span className="flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400" />
              <span className="text-green-600 font-medium">{data.liveJobCount.toLocaleString()} jobs live in CRM</span>
            </span>
          )}
          {data?.liveJobCount != null && data?.reportDate && (
            <span className="text-gray-300 dark:text-slate-600">·</span>
          )}
          {data?.reportDate && (
            <span>
              Financial data from report{' '}
              <span className="text-gray-500 dark:text-slate-400 font-medium">
                {new Date(data.reportDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </span>
          )}
          {data?.dataSource === 'jobs' && (
            <span className="text-amber-600">⚠ No report CSV — contract values are partial</span>
          )}
        </div>
      )}
    </section>
  )
}
