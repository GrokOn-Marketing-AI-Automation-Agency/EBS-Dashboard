import { DATA_SOURCES } from '../../data/mockData'
import { useDashboard } from '../../context/DashboardContext'
import { cn } from '../../utils/format'

export function DataQuality() {
  const { syncState, sources } = useDashboard()
  const avgScore = Math.round(DATA_SOURCES.reduce((a, d) => a + d.freshnessScore, 0) / DATA_SOURCES.length)

  return (
    <section id="quality" className="scroll-mt-4">
      <h2 className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-3">Data Quality &amp; Freshness</h2>
      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">Overall Data Quality Score</p>
            <p className="text-xs text-gray-400 dark:text-slate-500">
              {syncState.status === 'syncing'
                ? <span className="text-blue-500">Refreshing all sources…</span>
                : `Based on sync recency, completeness & consistency`}
            </p>
          </div>
          <div className="text-right">
            <p className={cn('text-3xl font-bold',
              avgScore >= 90 ? 'text-green-600' : avgScore >= 75 ? 'text-amber-500' : 'text-red-600'
            )}>{avgScore}</p>
            <p className="text-xs text-gray-400 dark:text-slate-500">/ 100</p>
          </div>
        </div>

        <div className="divide-y divide-gray-50 dark:divide-slate-800">
          {DATA_SOURCES.map(ds => {
            const isActive = sources[ds.key]
            return (
              <div key={ds.key} className={cn('px-5 py-3 flex items-center gap-4 transition-opacity', !isActive && 'opacity-40')}>
                <span className="text-xl w-7 shrink-0">{ds.icon}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800 dark:text-slate-200">{ds.label}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">
                    {syncState.status === 'syncing' && isActive
                      ? <span className="text-blue-400 animate-pulse">Syncing…</span>
                      : syncState.status === 'done' && isActive
                      ? <span className="text-green-600">✓ Synced just now</span>
                      : `Last sync: ${ds.lastSync}`}
                  </p>
                </div>
                <div className="w-32">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500 dark:text-slate-400">Freshness</span>
                    <span className={cn('font-semibold',
                      ds.freshnessScore >= 90 ? 'text-green-600' : ds.freshnessScore >= 75 ? 'text-amber-500' : 'text-red-600'
                    )}>{ds.freshnessScore}%</span>
                  </div>
                  <div className="bg-gray-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all',
                        ds.freshnessScore >= 90 ? 'bg-green-500' : ds.freshnessScore >= 75 ? 'bg-amber-400' : 'bg-red-500'
                      )}
                      style={{ width: `${ds.freshnessScore}%` }}
                    />
                  </div>
                </div>
                <span className={cn('text-xs font-semibold px-2 py-1 rounded-full w-16 text-center',
                  !isActive ? 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500' :
                  ds.status === 'ok' ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                  ds.status === 'warning' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                  'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                )}>
                  {!isActive ? 'Off' : ds.status === 'ok' ? 'Synced' : ds.status === 'warning' ? 'Stale' : 'Error'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
