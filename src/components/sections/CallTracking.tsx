import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { getCallData } from '../../data/mockData'
import { useDashboard } from '../../context/DashboardContext'

// ── Custom Tooltip ─────────────────────────────────────────────────────────────

function CallTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (!row) return null
  const total    = row.calls ?? 0
  const answered = row.answered ?? 0
  const missed   = row.missed ?? 0
  const ansPct   = total > 0 ? Math.round((answered / total) * 100) : 0
  const misPct   = total > 0 ? Math.round((missed / total) * 100) : 0
  return (
    <div className="bg-gray-900 dark:bg-slate-800 border border-gray-700 dark:border-slate-600 rounded-xl shadow-xl px-3 py-2.5 text-xs min-w-[170px]">
      <p className="text-white font-semibold mb-1.5">{row.source}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Total Calls</span>
          <span className="text-white font-bold">{total.toLocaleString()}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Answered</span>
          <span className="text-green-400 font-bold">{answered.toLocaleString()} ({ansPct}%)</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Missed</span>
          <span className="text-red-400 font-bold">{missed.toLocaleString()} ({misPct}%)</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Avg Duration</span>
          <span className="text-blue-400 font-bold">{row.avgDuration}m</span>
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function CallTracking() {
  const { dateRange, sources } = useDashboard()
  const callData = getCallData(dateRange)

  const [activeSource, setActiveSource] = useState<string | null>(null)

  const total    = callData.reduce((a, c) => a + c.calls,    0)
  const answered = callData.reduce((a, c) => a + c.answered, 0)
  const missed   = callData.reduce((a, c) => a + c.missed,   0)
  const avgDur   = (callData.reduce((a, c) => a + c.avgDuration * c.calls, 0) / total).toFixed(1)
  const ansRate  = Math.round((answered / total) * 100)

  return (
    <section id="calls" className="scroll-mt-4">
      <h2 className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-3">Call Tracking · GROMAAP</h2>
      <div className={`transition-opacity ${!sources.growmap ? 'opacity-40 pointer-events-none' : ''}`}>
        {!sources.growmap && (
          <div className="mb-3 px-4 py-2 bg-gray-100 dark:bg-slate-800 rounded-lg text-xs text-gray-500 dark:text-slate-400 text-center">
            GROMAAP source is disabled — enable it in the sidebar to see call data
          </div>
        )}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Total Calls',  value: total.toLocaleString(),            color: 'text-gray-900 dark:text-white'  },
            { label: 'Answered',     value: `${answered.toLocaleString()} (${ansRate}%)`, color: 'text-green-700' },
            { label: 'Missed',       value: `${missed.toLocaleString()} (${100 - ansRate}%)`, color: 'text-red-600'   },
            { label: 'Avg Duration', value: `${avgDur}m`,                      color: 'text-gray-900 dark:text-white'  },
          ].map(m => (
            <div key={m.label} className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl p-4 shadow-sm text-center">
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">{m.label}</p>
              <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-3">Calls by Source</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={callData}
                margin={{ left: -20, right: 8 }}
                onMouseMove={(e: any) => {
                  const src = e?.activePayload?.[0]?.payload?.source ?? null
                  setActiveSource(src)
                }}
                onMouseLeave={() => setActiveSource(null)}
              >
                <XAxis dataKey="source" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CallTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="answered" name="Answered" fill="#22c55e" radius={[0, 0, 0, 0]} stackId="a" />
                <Bar dataKey="missed"   name="Missed"   fill="#ef4444" radius={[4, 4, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
              <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">Source Details</p>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-400 uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Source</th>
                  <th className="text-right px-3 py-2">Total</th>
                  <th className="text-right px-3 py-2">Ans%</th>
                  <th className="text-right px-3 py-2">Avg Min</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                {callData.map(row => (
                  <tr
                    key={row.source}
                    className={`transition-colors cursor-default ${
                      activeSource === row.source
                        ? 'bg-green-50 dark:bg-green-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <td className="px-3 py-2 font-medium text-gray-800 dark:text-slate-100">{row.source}</td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-slate-200">{row.calls.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={`font-semibold ${Math.round((row.answered / row.calls) * 100) >= 90 ? 'text-green-600' : 'text-amber-600'}`}>
                        {Math.round((row.answered / row.calls) * 100)}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-slate-200">{row.avgDuration}m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}
