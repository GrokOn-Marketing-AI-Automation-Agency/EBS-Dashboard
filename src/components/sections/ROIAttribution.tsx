import { useState, useMemo } from 'react'
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Brush, ReferenceLine,
} from 'recharts'
import { useDashboard } from '../../context/DashboardContext'
import { useGoogleAdsSummary } from '../../hooks/useGoogleAds'
import { useAccuLynxSummary } from '../../hooks/useAccuLynx'
import { fmt, cn } from '../../utils/format'
import { DataBadge } from '../ui/DataBadge'
import type { GAdsCampaign } from '../../services/googleads'

// ── Constants ─────────────────────────────────────────────────────────────────

const MATCH_TYPE_LABELS: Record<string, string> = {
  EXACT:  'Exact',
  PHRASE: 'Phrase',
  BROAD:  'Broad',
}

const RANGE_LABELS: Record<string, string> = {
  '7d':  'Last 7 Days',
  '30d': 'Last 30 Days',
  '90d': 'Last 90 Days',
}

type CampaignFilter = 'all' | 'active' | 'inactive'
type ChartMetric    = 'spend' | 'clicks' | 'conversions'

const FILTER_OPTIONS: { key: CampaignFilter; label: string; dot?: string }[] = [
  { key: 'all',      label: 'All'      },
  { key: 'active',   label: 'Active',   dot: 'bg-green-400' },
  { key: 'inactive', label: 'Inactive', dot: 'bg-amber-400' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function sumCampaigns(list: GAdsCampaign[]) {
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
    ctr:               t.impressions > 0 ? Math.round((t.clicks / t.impressions) * 10000) / 100 : 0,
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiTile({
  label, value, sub, accent, icon,
}: {
  label: string; value: string; sub?: string; accent?: string; icon?: string
}) {
  return (
    <div className={cn(
      'relative rounded-2xl p-5 flex flex-col gap-1 overflow-hidden border shadow-sm',
      accent ?? 'bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-700'
    )}>
      {icon && (
        <span className="absolute top-3 right-3 text-2xl opacity-20 select-none">{icon}</span>
      )}
      <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-extrabold text-gray-900 dark:text-white leading-none">{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function AllTimeBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-xs text-gray-400 dark:text-slate-500">{label}</span>
      <span className="text-sm font-bold text-gray-600 dark:text-slate-300">{value}</span>
    </div>
  )
}

function CustomTooltip({ active, payload, label, selectedMetric, chartConfig }: any) {
  if (!active || !payload?.length) return null
  // Build lookup from all payload items
  const byKey: Record<string, number> = {}
  payload.forEach((p: any) => { byKey[p.dataKey] = p.value })
  // Also check the raw data point — payload[0].payload has all fields
  const dataPoint = payload[0]?.payload ?? {}
  const allMetrics: Array<{ key: string; label: string; color: string }> = [
    { key: 'spend',       label: 'Spend',       color: chartConfig?.spend?.color       ?? '#3b82f6' },
    { key: 'clicks',      label: 'Clicks',      color: chartConfig?.clicks?.color      ?? '#10b981' },
    { key: 'conversions', label: 'Conversions', color: chartConfig?.conversions?.color ?? '#f59e0b' },
  ]
  return (
    <div className="bg-gray-900 dark:bg-slate-800 border border-gray-700 dark:border-slate-600 rounded-xl shadow-xl px-3 py-2.5 text-xs min-w-[160px]">
      <p className="text-white font-semibold mb-2">{label}</p>
      {allMetrics.map(({ key, label: metricLabel, color }) => {
        const value = byKey[key] ?? dataPoint[key] ?? 0
        const isPrimary = key === selectedMetric
        return (
          <div
            key={key}
            className={`flex items-center justify-between gap-4 ${isPrimary ? 'mb-1' : 'opacity-60'}`}
          >
            <span style={{ color }} className={`font-medium ${isPrimary ? 'text-sm' : ''}`}>
              {metricLabel}
            </span>
            <span className={`font-bold text-white ${isPrimary ? 'text-sm' : ''}`}>
              {key === 'spend' ? fmt.currencyExact(value) : value.toLocaleString()}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── CampaignFilter Toggle ─────────────────────────────────────────────────────

function CampaignFilterToggle({
  value, onChange, counts,
}: {
  value: CampaignFilter
  onChange: (v: CampaignFilter) => void
  counts: Record<CampaignFilter, number>
}) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-700/50 rounded-xl p-1">
      {FILTER_OPTIONS.map(({ key, label, dot }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
            value === key
              ? 'bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-100 shadow-sm'
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:text-slate-200'
          )}
        >
          {dot && (
            <span className={cn('w-1.5 h-1.5 rounded-full', dot)} />
          )}
          {label}
          <span className={cn(
            'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
            value === key ? 'bg-gray-100 dark:bg-slate-700/50 text-gray-600 dark:text-slate-300' : 'text-gray-400 dark:text-slate-500'
          )}>
            {counts[key]}
          </span>
        </button>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ROIAttribution() {
  const { dateRange } = useDashboard()
  const { data: gads, loading, refetch } = useGoogleAdsSummary(dateRange)
  const { data: acx } = useAccuLynxSummary(dateRange)

  const [chartMetric,    setChartMetric]    = useState<ChartMetric>('spend')
  const [campaignFilter, setCampaignFilter] = useState<CampaignFilter>('all')

  const isLive     = gads?.source === 'live'
  const hasPeriod  = gads?.hasPeriodData ?? false
  const allPaused  = gads?.allPaused    ?? false
  const rangeLabel = RANGE_LABELS[dateRange ?? '30d'] ?? 'Last 30 Days'

  // All campaigns from API
  const allCampaigns = gads?.campaigns ?? []

  // Campaign counts per filter
  const counts = useMemo<Record<CampaignFilter, number>>(() => ({
    all:      allCampaigns.length,
    active:   allCampaigns.filter(c => c.status === 'ENABLED').length,
    inactive: allCampaigns.filter(c => c.status !== 'ENABLED').length,
  }), [allCampaigns])

  // Filtered campaign list
  const filteredCampaigns = useMemo(() => {
    if (campaignFilter === 'active')   return allCampaigns.filter(c => c.status === 'ENABLED')
    if (campaignFilter === 'inactive') return allCampaigns.filter(c => c.status !== 'ENABLED')
    return allCampaigns
  }, [allCampaigns, campaignFilter])

  // Totals derived from filtered campaigns (so KPIs update with the toggle)
  const filteredTotals = useMemo(() => sumCampaigns(filteredCampaigns), [filteredCampaigns])

  // All-time totals (never filtered)
  const totalsAT = gads?.totalsAllTime ?? { spend: 0, clicks: 0, impressions: 0, conversions: 0, costPerConversion: 0, ctr: 0 }

  const acxTotalValue = acx?.leadSources.reduce((a, s) => a + s.totalValue, 0) ?? 0
  const roi           = filteredTotals.spend > 0
    ? Math.round(((acxTotalValue - filteredTotals.spend) / filteredTotals.spend) * 100)
    : 0
  const roiPositive = roi >= 0

  // Time series (always all campaigns — can't split by status server-side)
  const timeSeries = gads?.timeSeries ?? []

  // Chart config
  const chartConfig: Record<ChartMetric, { label: string; color: string }> = {
    spend:       { label: 'Spend',       color: '#3b82f6' },
    clicks:      { label: 'Clicks',      color: '#10b981' },
    conversions: { label: 'Conversions', color: '#f59e0b' },
  }
  const activeChart = chartConfig[chartMetric]

  const filterLabel =
    campaignFilter === 'active'   ? 'Active campaigns only' :
    campaignFilter === 'inactive' ? 'Inactive campaigns only' :
    'All campaigns'

  return (
    <section id="roi" className="scroll-mt-4 space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-800 dark:text-slate-100 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600 text-white text-sm">G</span>
            Google Ads Performance
          </h2>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
            {isLive
              ? allPaused
                ? 'All campaigns paused — showing all-time totals'
                : `${rangeLabel} · ${filterLabel}`
              : 'Sample data — connect Google Ads for live metrics'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {gads && <DataBadge source={gads.source} lastSync={gads.lastSync} />}
          <button
            onClick={refetch}
            className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:text-slate-200 transition-colors px-2 py-1 rounded-lg hover:bg-gray-100 dark:bg-slate-700/50"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* ── Paused / no-data banners ────────────────────────────────────────── */}
      {isLive && allPaused && (
        <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <span className="text-lg leading-none mt-0.5">⏸</span>
          <div>
            <p className="font-semibold">Campaigns are currently paused</p>
            <p className="text-xs text-amber-700 mt-0.5">
              No activity recorded in the selected period. All metrics below reflect all-time lifetime totals.
              Figures will update once campaigns are reactivated.
            </p>
          </div>
        </div>
      )}
      {isLive && !allPaused && !hasPeriod && (
        <div className="flex items-start gap-3 px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl text-sm text-gray-600 dark:text-slate-300">
          <span className="text-lg leading-none mt-0.5">ℹ️</span>
          <p>No activity in the selected period. Showing all-time totals for reference.</p>
        </div>
      )}

      {/* ── Campaign filter toggle ──────────────────────────────────────────── */}
      {!loading && allCampaigns.length > 0 && (
        <div className="flex items-center justify-between">
          <CampaignFilterToggle
            value={campaignFilter}
            onChange={setCampaignFilter}
            counts={counts}
          />
          {campaignFilter !== 'all' && (
            <p className="text-xs text-gray-400 dark:text-slate-500">
              KPIs &amp; campaign list reflect <span className="font-semibold text-gray-600 dark:text-slate-300">{filterLabel.toLowerCase()}</span>
              {' '}· Daily chart always shows all campaigns
            </p>
          )}
        </div>
      )}

      {/* ── Primary KPI row ─────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-gray-100 dark:bg-slate-700/50 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiTile
            label="Total Ad Spend"
            value={fmt.currencyExact(filteredTotals.spend)}
            sub={hasPeriod ? rangeLabel : 'All-time (campaigns paused)'}
            icon="💰"
          />
          <KpiTile
            label="Clicks"
            value={filteredTotals.clicks.toLocaleString()}
            sub={`${filteredTotals.ctr}% CTR · ${filteredTotals.impressions.toLocaleString()} impr.`}
            icon="🖱️"
          />
          <KpiTile
            label="Conversions"
            value={filteredTotals.conversions > 0
                  ? Number.isInteger(filteredTotals.conversions)
                    ? filteredTotals.conversions.toLocaleString()
                    : filteredTotals.conversions.toFixed(2)
                  : '—'}
            sub={filteredTotals.costPerConversion > 0
              ? `${fmt.currencyExact(filteredTotals.costPerConversion)} / conv.`
              : undefined}
            icon="🎯"
          />
          <div className={cn(
            'relative rounded-2xl p-5 flex flex-col gap-1 overflow-hidden border shadow-sm',
            acxTotalValue > 0
              ? roiPositive ? 'bg-emerald-600 border-emerald-600' : 'bg-rose-600 border-rose-600'
              : 'bg-blue-600 border-blue-600'
          )}>
            <span className="absolute top-3 right-3 text-2xl opacity-20 select-none">📈</span>
            <p className="text-xs font-medium text-white/70 uppercase tracking-wide">
              {acxTotalValue > 0 ? 'Est. ROI' : 'Cost / Lead'}
            </p>
            <p className="text-3xl font-extrabold text-white leading-none">
              {acxTotalValue > 0
                ? `${roi.toLocaleString()}%`
                : filteredTotals.costPerConversion > 0
                  ? fmt.currencyExact(filteredTotals.costPerConversion)
                  : '—'
              }
            </p>
            <p className="text-xs text-white/60 mt-0.5">
              {acxTotalValue > 0 ? 'vs AccuLynx contract value' : 'per conversion'}
            </p>
          </div>
        </div>
      )}

      {/* ── All-time comparison strip ────────────────────────────────────────── */}
      {isLive && hasPeriod && !loading && (
        <div className="bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl px-5 py-3 flex items-center gap-6 flex-wrap">
          <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide shrink-0">All-Time · All Campaigns</p>
          <div className="flex items-center gap-6 flex-wrap">
            <AllTimeBadge label="Spend"        value={fmt.currencyExact(totalsAT.spend)} />
            <AllTimeBadge label="Clicks"       value={totalsAT.clicks.toLocaleString()} />
            <AllTimeBadge label="Impressions"  value={totalsAT.impressions.toLocaleString()} />
            <AllTimeBadge label="Conversions"  value={Number.isInteger(totalsAT.conversions) ? totalsAT.conversions.toLocaleString() : totalsAT.conversions.toFixed(2)} />
            <AllTimeBadge label="CTR"          value={`${totalsAT.ctr}%`} />
            {totalsAT.costPerConversion > 0 && (
              <AllTimeBadge label="Cost / Conv." value={fmt.currencyExact(totalsAT.costPerConversion)} />
            )}
          </div>
        </div>
      )}

      {/* ── Daily trend chart ────────────────────────────────────────────────── */}
      {!loading && timeSeries.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">Daily Trend · {rangeLabel}</p>
              {campaignFilter !== 'all' && (
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Showing all campaigns (filter applies to table below)</p>
              )}
            </div>
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-700/50 rounded-lg p-0.5">
              {(['spend', 'clicks', 'conversions'] as ChartMetric[]).map(m => (
                <button
                  key={m}
                  onClick={() => setChartMetric(m)}
                  className={cn(
                    'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                    chartMetric === m
                      ? 'bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-100 shadow-sm'
                      : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:text-slate-200'
                  )}
                >
                  {chartConfig[m].label}
                </button>
              ))}
            </div>
          </div>
          <div className="px-4 py-4">
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={timeSeries} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gadsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={activeChart.color} stopOpacity={0.18} />
                    <stop offset="95%" stopColor={activeChart.color} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v =>
                    chartMetric === 'spend'
                      ? v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`
                      : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`
                  }
                  width={48}
                />
                <Tooltip content={<CustomTooltip selectedMetric={chartMetric} chartConfig={chartConfig} />} />
                <Area
                  type="monotone"
                  dataKey={chartMetric}
                  name={activeChart.label}
                  stroke={activeChart.color}
                  strokeWidth={2.5}
                  fill="url(#gadsGrad)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
                {timeSeries.length > 0 && (() => {
                  const vals = timeSeries.map((d: any) => (d[chartMetric] as number) ?? 0)
                  const avg  = vals.reduce((a: number, v: number) => a + v, 0) / vals.length
                  return (
                    <ReferenceLine
                      y={avg}
                      stroke="#94a3b8"
                      strokeDasharray="4 4"
                      label={{ value: 'Avg', position: 'right', fontSize: 10, fill: '#94a3b8' }}
                    />
                  )
                })()}
                <Brush dataKey="date" height={20} stroke="#94a3b8" travellerWidth={8} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Campaigns + Keywords ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Campaigns */}
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">Campaigns</p>
              {campaignFilter !== 'all' && (
                <span className={cn(
                  'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                  campaignFilter === 'active'
                    ? 'bg-green-50 text-green-700'
                    : 'bg-amber-50 text-amber-700'
                )}>
                  {campaignFilter === 'active' ? 'Active only' : 'Inactive only'}
                </span>
              )}
            </div>
            <span className="text-xs text-gray-400 dark:text-slate-500">
              {filteredCampaigns.length} of {allCampaigns.length} · {hasPeriod ? rangeLabel : 'All-time'}
            </span>
          </div>

          {loading ? (
            <div className="p-4 space-y-3 animate-pulse">
              {[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-gray-100 dark:bg-slate-700/50 rounded-xl" />)}
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-gray-400 dark:text-slate-500">
                No {campaignFilter === 'active' ? 'active' : 'inactive'} campaigns in this period.
              </p>
              <button
                onClick={() => setCampaignFilter('all')}
                className="mt-2 text-xs text-blue-500 hover:text-blue-700"
              >
                Show all campaigns
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-slate-800">
              {filteredCampaigns.map(c => {
                const maxSpend  = Math.max(...filteredCampaigns.map(x => x.spend), 1)
                const pct       = maxSpend > 0 ? Math.round((c.spend / maxSpend) * 100) : 0
                const isPaused  = c.status !== 'ENABLED'
                const isSmart   = c.channelType === 'SMART'
                const isPmax    = c.channelType === 'PERFORMANCE_MAX'
                const hasNoData = c.spend === 0 && c.clicks === 0 && c.impressions === 0
                return (
                  <div key={c.name} className="px-5 py-3.5">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={cn(
                          'inline-block w-1.5 h-1.5 rounded-full shrink-0 mt-1',
                          isPaused ? 'bg-amber-400' : 'bg-green-400'
                        )} />
                        <p className="text-xs font-semibold text-gray-800 dark:text-slate-100 truncate" title={c.name}>
                          {c.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isSmart && (
                          <span className="text-[9px] font-bold uppercase tracking-wide text-blue-600 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">
                            Smart
                          </span>
                        )}
                        {isPmax && (
                          <span className="text-[9px] font-bold uppercase tracking-wide text-purple-600 bg-purple-50 border border-purple-200 rounded px-1.5 py-0.5">
                            PMax
                          </span>
                        )}
                        {isPaused && (
                          <span className="text-[9px] font-bold uppercase tracking-wide text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                            Paused
                          </span>
                        )}
                        {hasNoData && !isPaused && (
                          <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5">
                            No data
                          </span>
                        )}
                        <span className="text-sm font-bold text-gray-700 dark:text-slate-200">{fmt.currencyExact(c.spend)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-slate-700/50 rounded-full overflow-hidden mb-2">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          isPaused ? 'bg-amber-300' : 'bg-blue-500'
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-slate-500">
                      <span>
                        <span className="font-medium text-gray-600 dark:text-slate-300">{c.clicks.toLocaleString()}</span> clicks
                      </span>
                      <span>
                        <span className="font-medium text-gray-600 dark:text-slate-300">{c.ctr}%</span> CTR
                      </span>
                      <span>
                        <span className={cn(
                          'font-medium',
                          c.conversions > 0 ? 'text-emerald-600' : 'text-gray-600 dark:text-slate-300'
                        )}>
                          {c.conversions}
                        </span> conv.
                      </span>
                      <span className="ml-auto">
                        <span className="font-medium text-gray-600 dark:text-slate-300">${c.avgCpc}</span> CPC
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Filtered totals footer */}
          {!loading && filteredCampaigns.length > 0 && (
            <div className="px-5 py-3 bg-gray-50 dark:bg-slate-800 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-slate-400 font-medium">
                {campaignFilter === 'all' ? 'Total' : `${campaignFilter === 'active' ? 'Active' : 'Inactive'} total`}
              </span>
              <div className="flex items-center gap-4 text-gray-700 dark:text-slate-200 font-semibold">
                <span>{fmt.currencyExact(filteredTotals.spend)}</span>
                <span>{filteredTotals.clicks.toLocaleString()} clicks</span>
                <span>{filteredTotals.conversions} conv.</span>
              </div>
            </div>
          )}
        </div>

        {/* Top keywords */}
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">Top Keywords</p>
            <span className="text-xs text-gray-400 dark:text-slate-500">{hasPeriod ? rangeLabel : 'All-time'}</span>
          </div>
          {loading ? (
            <div className="p-4 space-y-3 animate-pulse">
              {[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-gray-100 dark:bg-slate-700/50 rounded-lg" />)}
            </div>
          ) : (gads?.keywords ?? []).length === 0 ? (
            <p className="p-5 text-sm text-gray-400 dark:text-slate-500">No keyword data available.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-800 text-gray-400 dark:text-slate-500 uppercase">
                  <th className="text-left px-5 py-2.5 font-medium">Keyword</th>
                  <th className="text-right px-3 py-2.5 font-medium">Clicks</th>
                  <th className="text-right px-3 py-2.5 font-medium">Cost</th>
                  <th className="text-right px-5 py-2.5 font-medium">Conv.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                {(gads?.keywords ?? []).map(kw => (
                  <tr key={kw.keyword} className="hover:bg-gray-50 dark:bg-slate-800/70 transition-colors">
                    <td className="px-5 py-2.5">
                      <span className="font-medium text-gray-800 dark:text-slate-100">{kw.keyword}</span>
                      <span className="ml-1.5 text-gray-400 dark:text-slate-500 text-[10px] bg-gray-100 dark:bg-slate-700/50 rounded px-1 py-0.5">
                        {MATCH_TYPE_LABELS[kw.matchType] ?? kw.matchType}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-700 dark:text-slate-200 font-medium">
                      {kw.clicks.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-700 dark:text-slate-200">
                      {fmt.currencyExact(kw.cost)}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <span className={cn(
                        'font-bold',
                        kw.conversions > 0 ? 'text-emerald-600' : 'text-gray-300'
                      )}>
                        {kw.conversions > 0 ? kw.conversions : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Call conversions ──────────────────────────────────────────────────── */}
      {isLive && gads?.hasCallData && !loading && (
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 dark:border-slate-700">
            <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">
              Call Conversions · {rangeLabel}
            </p>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-slate-800 max-h-64 overflow-y-auto">
            {(gads.callConversions ?? []).map(call => {
              const mins      = Math.floor(call.durationSecs / 60)
              const secs      = call.durationSecs % 60
              const connected = call.status === 'RECEIVED'
              return (
                <div key={call.id} className="px-5 py-3 flex items-center gap-4 text-xs">
                  <span className={cn(
                    'w-2 h-2 rounded-full shrink-0',
                    connected ? 'bg-green-400' : 'bg-gray-300'
                  )} />
                  <span className="font-medium text-gray-700 dark:text-slate-200 w-16 shrink-0">
                    ({call.areaCode}) ***
                  </span>
                  <span className="text-gray-500 dark:text-slate-400 w-20 shrink-0">{mins}m {secs}s</span>
                  <span className="text-gray-400 dark:text-slate-500 truncate flex-1">{call.campaign}</span>
                  <span className="text-gray-400 dark:text-slate-500 shrink-0">
                    {new Date(call.date).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric',
                    })}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── ROI footnote ─────────────────────────────────────────────────────── */}
      {isLive && acxTotalValue > 0 && !loading && (
        <p className="text-xs text-gray-400 dark:text-slate-500 px-1">
          ROI = (AccuLynx contracts{' '}
          <strong className="text-gray-600 dark:text-slate-300">{fmt.currencyExact(acxTotalValue)}</strong>
          {' '}− {filterLabel} spend{' '}
          <strong className="text-gray-600 dark:text-slate-300">{fmt.currencyExact(filteredTotals.spend)}</strong>
          ) ÷ spend.
        </p>
      )}
    </section>
  )
}
