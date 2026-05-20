import { useAccuLynxSummary } from '../../hooks/useAccuLynx'
import { fmt } from '../../utils/format'
import { DataBadge } from '../ui/DataBadge'

export function PipelineFunnel() {
  const { data, loading, error, refetch } = useAccuLynxSummary() // no range = all-time
  const stages = data?.pipeline ?? []
  const maxCount = stages[0]?.count ?? 1

  return (
    <section id="pipeline" className="scroll-mt-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-gray-800 dark:text-slate-100 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600 text-white text-sm shrink-0">A</span>
            Pipeline &amp; Sales Funnel
          </h2>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 ml-9">AccuLynx CRM · Active deal stages &amp; conversion funnel</p>
        </div>
        <div className="flex items-center gap-2">
          {data && <DataBadge source={data.source} lastSync={data.lastSync} />}
          <button onClick={refetch} className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300 transition-colors">↻ Refresh</button>
        </div>
      </div>

      {loading && <PipelineSkeleton />}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          ⚠ Failed to load pipeline data: {error}
          <button onClick={refetch} className="ml-3 underline text-red-600">Retry</button>
        </div>
      )}

      {!loading && stages.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-4">AccuLynx Pipeline Stages</p>
            <div className="space-y-2">
              {stages.map((stage, i) => {
                const pct = maxCount > 0 ? (stage.count / maxCount) * 100 : 0
                const colors = ['bg-[#007BFF]', 'bg-blue-400', 'bg-indigo-400', 'bg-violet-400', 'bg-green-500']
                return (
                  <div key={stage.stage} className="flex items-center gap-3">
                    <div className="w-32 text-xs text-gray-600 dark:text-slate-300 font-medium text-right shrink-0 truncate">{stage.stage}</div>
                    <div className="flex-1 bg-gray-100 dark:bg-slate-700/50 rounded-full h-7 overflow-hidden">
                      <div
                        className={`h-full rounded-full flex items-center justify-end pr-3 transition-all duration-500 ${colors[i % colors.length]}`}
                        style={{ width: `${Math.max(pct, 8)}%` }}
                      >
                        <span className="text-white text-xs font-bold">{stage.count.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="w-20 text-xs text-gray-500 dark:text-slate-400 shrink-0 text-right">{fmt.currency(stage.value)}</div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-3">Stage Details</p>
            <div className="space-y-3">
              {stages.map(stage => (
                <div key={stage.stage} className="border-b border-gray-50 dark:border-slate-800 pb-3 last:border-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-700 dark:text-slate-200 truncate">{stage.stage}</p>
                    {stage.value > 0 && (
                      <p className="text-xs font-bold text-green-600 dark:text-green-400 shrink-0 ml-2">{fmt.currency(stage.value)}</p>
                    )}
                  </div>
                  <div className="flex justify-between mt-1 text-xs text-gray-500 dark:text-slate-400">
                    <span>Count: <strong className="text-gray-700 dark:text-slate-200">{stage.count.toLocaleString()}</strong></span>
                    <span>Avg: <strong className="text-gray-700 dark:text-slate-200">{stage.avgDays}d</strong></span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-700">
              <p className="text-xs text-gray-500 dark:text-slate-400">Total Pipeline</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {fmt.currency(stages.reduce((a, s) => a + s.value, 0))}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function PipelineSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-pulse">
      <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-3">
        <div className="h-4 bg-gray-100 dark:bg-slate-800 rounded w-40 mb-4" />
        {[100, 80, 60, 40, 25].map((w, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-32 h-3 bg-gray-100 dark:bg-slate-800 rounded" />
            <div className="flex-1 h-7 bg-gray-100 dark:bg-slate-800 rounded-full" style={{ maxWidth: `${w}%` }} />
            <div className="w-20 h-3 bg-gray-100 dark:bg-slate-800 rounded" />
          </div>
        ))}
      </div>
      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl p-4 shadow-sm space-y-3">
        <div className="h-4 bg-gray-100 dark:bg-slate-800 rounded w-24 mb-3" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="pb-3 border-b border-gray-50 dark:border-slate-800">
            <div className="h-3 bg-gray-100 dark:bg-slate-800 rounded w-28 mb-2" />
            <div className="h-3 bg-gray-100 dark:bg-slate-800 rounded w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}
