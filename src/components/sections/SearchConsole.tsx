import { useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { useDashboard } from '../../context/DashboardContext'
import { useGSCSummary } from '../../hooks/useGSC'
import { cn } from '../../utils/format'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

function PositionBadge({ pos }: { pos: number }) {
  const color = pos <= 3 ? 'bg-green-100 text-green-700' : pos <= 10 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
  return <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', color)}>{pos.toFixed(1)}</span>
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 shadow-sm">
      <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">{label}</p>
      <p className={cn('text-2xl font-bold', color)}>{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Custom tooltip ─────────────────────────────────────────────────────────────

function GSCTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg px-3 py-2.5 text-xs">
      <p className="font-semibold text-gray-600 dark:text-slate-300 mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-0.5">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-500 dark:text-slate-400">{p.name}:</span>
          <span className="font-semibold text-gray-800 dark:text-slate-100">{p.value?.toLocaleString?.() ?? p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 dark:bg-slate-800 rounded-xl" />)}
      </div>
      <div className="h-52 bg-gray-100 dark:bg-slate-800 rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-64 bg-gray-100 dark:bg-slate-800 rounded-xl" />
        <div className="h-64 bg-gray-100 dark:bg-slate-800 rounded-xl" />
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

type Tab = 'queries' | 'pages'
type ChartMetric = 'clicks' | 'impressions' | 'position'

export function SearchConsole() {
  const { dateRange } = useDashboard()
  const { data, loading, error, refetch } = useGSCSummary(dateRange)
  const [tab, setTab] = useState<Tab>('queries')
  const [chartMetric, setChartMetric] = useState<ChartMetric>('clicks')

  const rangeLabel = dateRange === '7d' ? 'Last 7 Days' : dateRange === '30d' ? 'Last 30 Days' : 'Last 90 Days'

  // Format time series dates nicely
  const timeSeries = (data?.timeSeries ?? []).map(p => ({
    ...p,
    date: new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }))

  return (
    <section id="search-console" className="scroll-mt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
            🔍 Google Search Console
          </h2>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
            {data?.siteUrl ?? 'exteriorbuildingsolutions.com'} · {rangeLabel}
          </p>
        </div>
        <button
          onClick={refetch}
          disabled={loading}
          className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300 transition-colors disabled:opacity-40"
        >
          ↻ Refresh
        </button>
      </div>

      {loading ? <Skeleton /> : error && !data ? (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4 text-xs text-red-600 dark:text-red-400">
          ⚠ {error}
        </div>
      ) : data ? (
        <div className="space-y-4">

          {/* Overview stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total Clicks"  value={data.overview.clicks.toLocaleString()} color="text-blue-600"   sub="organic search" />
            <StatCard label="Impressions"   value={fmt(data.overview.impressions)}         color="text-purple-600" sub="search appearances" />
            <StatCard label="Avg CTR"       value={`${data.overview.ctr.toFixed(2)}%`}     color={data.overview.ctr >= 2 ? 'text-green-600' : data.overview.ctr >= 1 ? 'text-amber-600' : 'text-red-500'} sub={data.overview.ctr < 1 ? 'low — needs improvement' : 'click-through rate'} />
            <StatCard label="Avg Position"  value={data.overview.position.toFixed(1)}      color={data.overview.position <= 10 ? 'text-green-600' : data.overview.position <= 20 ? 'text-amber-600' : 'text-red-500'} sub={data.overview.position <= 10 ? 'on page 1 🎉' : `page ${Math.ceil(data.overview.position / 10)}`} />
          </div>

          {/* Time series chart */}
          <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">Performance Over Time</p>
              <div className="flex gap-1">
                {(['clicks', 'impressions', 'position'] as ChartMetric[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setChartMetric(m)}
                    className={cn(
                      'text-xs px-2.5 py-1 rounded-lg font-medium capitalize transition-colors',
                      chartMetric === m ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600'
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={timeSeries} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                  interval={Math.floor(timeSeries.length / 6)} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={chartMetric === 'position' ? (v: number) => v.toFixed(0) : fmt} width={36} reversed={chartMetric === 'position'} />
                <Tooltip content={<GSCTooltip />} />
                <Line
                  type="monotone"
                  dataKey={chartMetric}
                  stroke={chartMetric === 'clicks' ? '#3B82F6' : chartMetric === 'impressions' ? '#8B5CF6' : '#F59E0B'}
                  strokeWidth={2} dot={false} activeDot={{ r: 4 }}
                  name={chartMetric.charAt(0).toUpperCase() + chartMetric.slice(1)}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Bottom two panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Queries / Pages table */}
            <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 pt-3 pb-0 flex items-center gap-2 border-b border-gray-100 dark:border-slate-700">
                {(['queries', 'pages'] as Tab[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={cn(
                      'text-xs font-semibold pb-2.5 px-1 border-b-2 transition-colors capitalize',
                      tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300'
                    )}
                  >
                    Top {t}
                  </button>
                ))}
              </div>
              <div className="overflow-y-auto max-h-72">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-slate-900 text-gray-400 dark:text-slate-500 uppercase tracking-wide sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-2">{tab === 'queries' ? 'Query' : 'Page'}</th>
                      <th className="text-right px-3 py-2">Clicks</th>
                      <th className="text-right px-3 py-2">Impr.</th>
                      <th className="text-right px-3 py-2">CTR</th>
                      <th className="text-right px-4 py-2">Pos.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
                    {(tab === 'queries' ? data.topQueries : data.topPages).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="px-4 py-2.5 max-w-[180px]">
                          <p className="truncate font-medium text-gray-700 dark:text-slate-200">
                            {'query' in row ? row.query : row.page}
                          </p>
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-blue-600">{row.clicks.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-right text-gray-500 dark:text-slate-400">{fmt(row.impressions)}</td>
                        <td className="px-3 py-2.5 text-right text-gray-500 dark:text-slate-400">{row.ctr.toFixed(1)}%</td>
                        <td className="px-4 py-2.5 text-right"><PositionBadge pos={row.position} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Device breakdown chart */}
            <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4 shadow-sm">
              <p className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-3">Clicks by Device</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data.devices} layout="vertical" margin={{ left: 8, right: 20, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={fmt} />
                  <YAxis type="category" dataKey="device" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={60} />
                  <Tooltip content={<GSCTooltip />} />
                  <Bar dataKey="clicks" name="Clicks" fill="#3B82F6" radius={[0, 4, 4, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
              {/* Device pct pills */}
              <div className="flex gap-2 mt-3 flex-wrap">
                {data.devices.map(d => (
                  <span key={d.device} className="text-xs bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 px-2.5 py-1 rounded-full capitalize font-medium">
                    {d.device}: {d.pct}%
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* GSC note */}
          {data.source === 'live' && (
            <p className="text-xs text-gray-400 dark:text-slate-500 text-center">
              Search Console data has a ~3 day lag · Last synced {data.lastSync ? new Date(data.lastSync).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'}
            </p>
          )}
        </div>
      ) : null}
    </section>
  )
}
