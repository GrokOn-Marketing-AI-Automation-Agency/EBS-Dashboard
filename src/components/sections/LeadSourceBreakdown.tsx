import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useDashboard } from '../../context/DashboardContext'
import { useAccuLynxSummary } from '../../hooks/useAccuLynx'
import { fmt } from '../../utils/format'
import { DataBadge } from '../ui/DataBadge'

const COLORS = ['#007BFF', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6']

// ── Custom Tooltip ─────────────────────────────────────────────────────────────

function LeadTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  // Access full row data by matching label against original rows
  const row = payload[0]?.payload?._row
  return (
    <div className="bg-gray-900 dark:bg-slate-800 border border-gray-700 dark:border-slate-600 rounded-xl shadow-xl px-3 py-2.5 text-xs min-w-[170px]">
      <p className="text-white font-semibold mb-1.5">{label}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Leads</span>
          <span className="text-blue-400 font-bold">{payload[0]?.value?.toLocaleString()}</span>
        </div>
        {row && (
          <>
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Avg Deal</span>
              <span className="text-green-400 font-bold">{row.avgDeal > 0 ? fmt.currency(row.avgDeal) : '—'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Total Value</span>
              <span className="text-amber-400 font-bold">{fmt.currency(row.totalValue)}</span>
            </div>
            {row.closingPct != null && (
              <div className="flex justify-between gap-4">
                <span className="text-gray-400">Closing %</span>
                <span className="text-purple-400 font-bold">{row.closingPct}%</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function LeadSourceBreakdown() {
  const { dateRange } = useDashboard()
  const { data, loading, error, refetch } = useAccuLynxSummary(dateRange)
  const rows = data?.leadSources ?? []
  const chartData = rows.map((r, i) => ({
    name: r.source.replace(' Search', '').replace(' Media', ''),
    leads: r.acculynx,
    // attach full row for tooltip lookup
    _row: rows[i],
  }))

  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  return (
    <section id="leads" className="scroll-mt-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-gray-800 dark:text-slate-100 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600 text-white text-sm shrink-0">A</span>
            Lead Source Breakdown
          </h2>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 ml-9">AccuLynx CRM · Jobs by source, value &amp; close rate</p>
        </div>
        <div className="flex items-center gap-2">
          {data && <DataBadge source={data.source} lastSync={data.lastSync} />}
          <button onClick={refetch} className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300 transition-colors">↻ Refresh</button>
        </div>
      </div>

      {loading && <LoadingSkeleton />}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          ⚠ Failed to load AccuLynx data: {error}
          <button onClick={refetch} className="ml-3 underline text-red-600 hover:text-red-800">Retry</button>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-3">Leads by Source</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ left: -20, right: 8 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip content={<LeadTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                <Bar
                  dataKey="leads"
                  name="Leads"
                  radius={[4, 4, 0, 0]}
                  onMouseEnter={(_: any, i: number) => setActiveIndex(i)}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  {chartData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={COLORS[i % COLORS.length]}
                      opacity={activeIndex === null || activeIndex === i ? 1 : 0.35}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
              <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">Performance by Source</p>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-400 uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Source</th>
                  <th className="text-right px-3 py-2">Leads</th>
                  <th className="text-right px-3 py-2">Avg Deal</th>
                  <th className="text-right px-3 py-2">Total Value</th>
                  <th className="text-right px-3 py-2">Close %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
                {rows.map((row, i) => (
                  <tr
                    key={row.source}
                    className={`transition-colors cursor-default ${
                      activeIndex === i
                        ? 'bg-blue-50 dark:bg-blue-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-slate-800'
                    }`}
                    onMouseEnter={() => setActiveIndex(i)}
                    onMouseLeave={() => setActiveIndex(null)}
                  >
                    <td className="px-3 py-2 font-medium text-gray-800 dark:text-slate-100 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      {row.source}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-slate-200 font-semibold">{row.acculynx.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-slate-200">{row.avgDeal > 0 ? fmt.currency(row.avgDeal) : '—'}</td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-slate-200">{fmt.currency(row.totalValue)}</td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-slate-200">
                      {row.closingPct != null ? `${row.closingPct}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-slate-800 border-t border-gray-100 dark:border-slate-700">
                <tr>
                  <td className="px-3 py-2 font-semibold text-gray-700 dark:text-slate-200">Total</td>
                  <td className="px-3 py-2 text-right font-bold text-gray-900 dark:text-white">{rows.reduce((a, r) => a + r.acculynx, 0).toLocaleString()}</td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-right font-bold text-gray-900 dark:text-white">{fmt.currency(rows.reduce((a, r) => a + r.totalValue, 0))}</td>
                  <td className="px-3 py-2" />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 animate-pulse">
      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl p-4 shadow-sm h-64">
        <div className="h-4 bg-gray-100 dark:bg-slate-800 rounded w-40 mb-4" />
        <div className="flex items-end gap-3 h-40 mt-6">
          {[60, 90, 45, 75, 30, 55].map((h, i) => (
            <div key={i} className="flex-1 bg-gray-100 dark:bg-slate-800 rounded-t" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden h-64">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
          <div className="h-4 bg-gray-100 dark:bg-slate-800 rounded w-36" />
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="px-3 py-2.5 flex gap-2 border-b border-gray-50 dark:border-slate-800">
            <div className="h-3 bg-gray-100 dark:bg-slate-800 rounded flex-1" />
            <div className="h-3 bg-gray-100 dark:bg-slate-800 rounded w-8" />
            <div className="h-3 bg-gray-100 dark:bg-slate-800 rounded w-14" />
            <div className="h-3 bg-gray-100 dark:bg-slate-800 rounded w-14" />
          </div>
        ))}
      </div>
    </div>
  )
}
