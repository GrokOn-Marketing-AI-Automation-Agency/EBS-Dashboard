import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Brush } from 'recharts'
import { useDashboard } from '../../context/DashboardContext'
import { useGA4Summary } from '../../hooks/useGA4'
import { CLARITY_DATA, GSC_DATA } from '../../data/mockData'
import { cn } from '../../utils/format'
import { DataBadge } from '../ui/DataBadge'

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

const CHANNEL_COLORS: Record<string, string> = {
  'Organic Search':  'bg-green-500',
  'Direct':          'bg-blue-500',
  'Paid Search':     'bg-purple-500',
  'Organic Social':  'bg-pink-500',
  'Referral':        'bg-amber-500',
  'Email':           'bg-indigo-500',
  'Unassigned':      'bg-gray-400',
}
const DEVICE_ICONS: Record<string, string> = {
  mobile:  '📱',
  desktop: '🖥',
  tablet:  '⬜',
}

const LINE_CONFIG = [
  { dataKey: 'users',       name: 'Users',       color: '#007BFF' },
  { dataKey: 'sessions',    name: 'Sessions',    color: '#22c55e' },
  { dataKey: 'conversions', name: 'Conversions', color: '#f59e0b' },
] as const

type LineKey = typeof LINE_CONFIG[number]['dataKey']

function StatChip({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-gray-50 dark:bg-slate-800 rounded-xl px-3 py-2.5 text-center">
      <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{label}</p>
      <p className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────

function TrafficTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  // Build a map of all three metrics from payload (some may be absent if line is hidden)
  const byKey: Record<string, number> = {}
  payload.forEach((p: any) => { byKey[p.dataKey] = p.value })

  return (
    <div className="bg-gray-900 dark:bg-slate-800 border border-gray-700 dark:border-slate-600 rounded-xl shadow-xl px-3 py-2.5 text-xs min-w-[160px]">
      <p className="text-white font-semibold mb-1.5">{label}</p>
      <div className="space-y-1">
        {LINE_CONFIG.map(({ dataKey, name, color }) => (
          <div key={dataKey} className="flex justify-between gap-4">
            <span style={{ color }} className="font-medium">{name}</span>
            <span className="text-white font-bold">
              {byKey[dataKey] != null ? byKey[dataKey].toLocaleString() : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Clickable Legend ──────────────────────────────────────────────────────────

function ClickableLegend({
  hiddenLines,
  onToggle,
}: {
  hiddenLines: Set<LineKey>
  onToggle: (key: LineKey) => void
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap mt-1 mb-2">
      {LINE_CONFIG.map(({ dataKey, name, color }) => {
        const isHidden = hiddenLines.has(dataKey)
        return (
          <button
            key={dataKey}
            onClick={() => onToggle(dataKey)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
              isHidden
                ? 'opacity-40 border-gray-300 dark:border-slate-600 text-gray-400 dark:text-slate-500'
                : 'border-transparent text-white'
            )}
            style={isHidden ? {} : { background: color + '22', borderColor: color, color }}
          >
            <span
              className="w-2 h-2 rounded-full inline-block shrink-0"
              style={{ background: isHidden ? '#94a3b8' : color }}
            />
            <span className={isHidden ? 'line-through' : ''}>{name}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function TrafficEngagement() {
  const { dateRange, sources } = useDashboard()
  const { data, loading, error, refetch } = useGA4Summary(dateRange)

  const [hiddenLines, setHiddenLines] = useState<Set<LineKey>>(new Set())

  const toggleLine = (key: LineKey) => {
    setHiddenLines(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Downsample for 90d chart readability
  const chartData = data?.timeSeries
    ? (dateRange === '90d' ? data.timeSeries.filter((_, i) => i % 7 === 0) : data.timeSeries)
    : []

  const isLive = data?.source === 'live'
  const showBrush = dateRange === '30d' || dateRange === '90d'

  return (
    <section id="traffic" className="scroll-mt-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-gray-800 dark:text-slate-100 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-orange-500 text-white text-sm shrink-0">G</span>
            Traffic &amp; Engagement
          </h2>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 ml-9">Google Analytics 4 · Sessions, users &amp; conversions</p>
        </div>
        <div className="flex items-center gap-2">
          {data && <DataBadge source={data.source} lastSync={data.lastSync} />}
          <button onClick={refetch} className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300 transition-colors">↻ Refresh</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">

        {/* ── GA4 Panel ── */}
        <div className={cn('bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl p-4 shadow-sm transition-opacity', !sources.ga4 && 'opacity-40')}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">GA4 · Users &amp; Sessions</p>
            {!sources.ga4
              ? <span className="text-xs text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">Source Disabled</span>
              : isLive
              ? <span className="text-xs text-green-600 font-medium flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block" /> Live</span>
              : <span className="text-xs text-amber-600">● Mock</span>
            }
          </div>

          {/* KPI chips */}
          {loading ? (
            <div className="grid grid-cols-3 gap-2 mb-3 animate-pulse">
              {[...Array(6)].map((_, i) => <div key={i} className="h-14 bg-gray-100 dark:bg-slate-800 rounded-xl" />)}
            </div>
          ) : error ? (
            <p className="text-xs text-red-500 mb-3">⚠ {error}</p>
          ) : data ? (
            <div className="grid grid-cols-3 gap-2 mb-3">
              <StatChip label="Sessions"     value={data.overview.sessions.toLocaleString()} />
              <StatChip label="Users"        value={data.overview.users.toLocaleString()} />
              <StatChip label="New Users"    value={data.overview.newUsers.toLocaleString()} />
              <StatChip label="Page Views"   value={data.overview.pageViews.toLocaleString()} />
              <StatChip label="Bounce Rate"  value={`${data.overview.bounceRate}%`} />
              <StatChip label="Avg Duration" value={fmtDuration(data.overview.avgSessionDuration)} />
            </div>
          ) : null}

          {/* Clickable Legend */}
          <ClickableLegend hiddenLines={hiddenLines} onToggle={toggleLine} />

          {/* Line chart */}
          <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">
            {dateRange === '7d' ? 'Last 7 days' : dateRange === '30d' ? 'Last 30 days' : 'Last 90 days'}
          </p>
          <ResponsiveContainer width="100%" height={showBrush ? 180 : 160}>
            <LineChart data={chartData} margin={{ left: -20, right: 8 }}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                interval={dateRange === '7d' ? 0 : 'preserveStartEnd'}
              />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<TrafficTooltip />} />
              {LINE_CONFIG.map(({ dataKey, name, color }) => (
                <Line
                  key={dataKey}
                  type="monotone"
                  dataKey={dataKey}
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  name={name}
                  hide={hiddenLines.has(dataKey)}
                  activeDot={{ r: 5, strokeWidth: 2 }}
                />
              ))}
              {showBrush && (
                <Brush dataKey="date" height={20} stroke="#94a3b8" />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* ── Clarity Panel (mock) ── */}
        <div className={cn('bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl p-4 shadow-sm transition-opacity', !sources.clarity && 'opacity-40')}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">Microsoft Clarity · User Behavior</p>
            {!sources.clarity && <span className="text-xs text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">Source Disabled</span>}
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {[
              { label: 'Page Views',   value: CLARITY_DATA.pageViews.toLocaleString() },
              { label: 'Sessions',     value: CLARITY_DATA.sessions.toLocaleString()  },
              { label: 'Avg Duration', value: CLARITY_DATA.avgSessionDuration         },
              { label: 'Bounce Rate',  value: `${CLARITY_DATA.bounceRate}%`           },
            ].map(m => (
              <div key={m.label} className="bg-gray-50 dark:bg-slate-800 rounded-lg p-2 text-center">
                <p className="text-xs text-gray-500 dark:text-slate-400">{m.label}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{m.value}</p>
              </div>
            ))}
          </div>
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-2">Device Breakdown</p>
          <div className="flex gap-2">
            {CLARITY_DATA.deviceBreakdown.map(d => (
              <div key={d.device} className="flex-1 bg-gray-100 dark:bg-slate-700/50 rounded-lg p-2 text-center">
                <p className="text-xs text-gray-500 dark:text-slate-400">{d.device}</p>
                <p className="font-bold text-gray-800 dark:text-slate-100 text-sm">{d.pct}%</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── GA4 Channel breakdown ── */}
      {isLive && data && data.channels.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
            <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">Traffic by Channel</p>
          </div>
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {data.channels.map(ch => (
              <div key={ch.channel} className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn('w-2 h-2 rounded-full shrink-0', CHANNEL_COLORS[ch.channel] ?? 'bg-gray-400')} />
                  <p className="text-xs font-medium text-gray-700 dark:text-slate-200 truncate">{ch.channel}</p>
                </div>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{ch.sessions.toLocaleString()}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-gray-400 dark:text-slate-500">{ch.users.toLocaleString()} users</p>
                  <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">{ch.pct}%</span>
                </div>
                {/* Thin bar */}
                <div className="mt-2 h-1 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', CHANNEL_COLORS[ch.channel] ?? 'bg-gray-400')}
                    style={{ width: `${ch.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Device breakdown row */}
          {data.devices.length > 0 && (
            <div className="px-4 pb-4 pt-0">
              <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-2">Device Split</p>
              <div className="flex gap-3">
                {data.devices.map(d => (
                  <div key={d.device} className="flex items-center gap-2 bg-gray-50 dark:bg-slate-800 rounded-lg px-3 py-2 flex-1">
                    <span className="text-lg">{DEVICE_ICONS[d.device] ?? '📱'}</span>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-slate-400 capitalize">{d.device}</p>
                      <p className="text-sm font-bold text-gray-800 dark:text-slate-100">{d.pct}%</p>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-slate-500 ml-auto">{d.sessions.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Top Landing Pages ── */}
      {isLive && data && data.topPages.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">Top Landing Pages · GA4</p>
            <span className="text-xs text-gray-400 dark:text-slate-500">by sessions</span>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-400 uppercase">
              <tr>
                <th className="text-left px-4 py-2">Page</th>
                <th className="text-right px-4 py-2">Sessions</th>
                <th className="text-right px-4 py-2">Users</th>
                <th className="text-right px-4 py-2">Views</th>
                <th className="text-right px-4 py-2">Bounce</th>
                <th className="text-right px-4 py-2">Avg Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
              {data.topPages.map((pg, i) => (
                <tr key={`${pg.page}-${i}`} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                  <td className="px-4 py-2.5 font-medium text-gray-700 dark:text-slate-200 max-w-[220px] truncate" title={pg.page}>
                    {pg.page === '/' ? '/ (homepage)' : pg.page}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-700 dark:text-slate-200 font-semibold">{pg.sessions.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600 dark:text-slate-300">{pg.users.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600 dark:text-slate-300">{pg.pageViews.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={cn('font-medium', pg.bounceRate > 60 ? 'text-red-500' : pg.bounceRate > 40 ? 'text-amber-500' : 'text-green-600')}>
                      {pg.bounceRate}%
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-500 dark:text-slate-400">{fmtDuration(pg.avgDuration)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── GSC (mock) ── */}
      <div className={cn('bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden transition-opacity', !sources.gsc && 'opacity-40')}>
        <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">Google Search Console · Top Keywords</p>
          <div className="flex gap-4 text-xs text-gray-500 dark:text-slate-400">
            <span>Clicks: <strong className="text-gray-800 dark:text-slate-100">{GSC_DATA.totalClicks.toLocaleString()}</strong></span>
            <span>Impressions: <strong className="text-gray-800 dark:text-slate-100">{GSC_DATA.impressions.toLocaleString()}</strong></span>
            <span>CTR: <strong className="text-gray-800 dark:text-slate-100">{GSC_DATA.ctr}%</strong></span>
            <span>Avg Pos: <strong className="text-gray-800 dark:text-slate-100">{GSC_DATA.avgPosition}</strong></span>
            {!sources.gsc && <span className="text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">Source Disabled</span>}
          </div>
        </div>
        <table className="w-full text-xs">
          <thead className="bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-400 uppercase">
            <tr>
              <th className="text-left px-4 py-2">Keyword</th>
              <th className="text-right px-4 py-2">Clicks</th>
              <th className="text-right px-4 py-2">Impressions</th>
              <th className="text-right px-4 py-2">CTR</th>
              <th className="text-right px-4 py-2">Position</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
            {GSC_DATA.topKeywords.map(kw => (
              <tr key={kw.keyword} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                <td className="px-4 py-2 font-medium text-gray-800 dark:text-slate-100">{kw.keyword}</td>
                <td className="px-4 py-2 text-right text-gray-700 dark:text-slate-200">{kw.clicks}</td>
                <td className="px-4 py-2 text-right text-gray-700 dark:text-slate-200">{kw.impressions.toLocaleString()}</td>
                <td className="px-4 py-2 text-right text-gray-700 dark:text-slate-200">{kw.ctr}%</td>
                <td className="px-4 py-2 text-right">
                  <span className={cn('font-semibold', kw.position <= 3 ? 'text-green-600' : kw.position <= 7 ? 'text-amber-600' : 'text-gray-500 dark:text-slate-400')}>
                    #{kw.position}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
