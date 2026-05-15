import { useDashboard } from '../../context/DashboardContext'
import type { DateRange } from '../../types'
import { cn } from '../../utils/format'

export function Header() {
  const { dateRange, syncState, setDateRange, triggerSync } = useDashboard()

  const handleExport = () => {
    const style = document.createElement('style')
    style.innerHTML = `
      @media print {
        aside, header button { display: none !important; }
        main { padding: 0 !important; }
        body { background: white !important; }
        .shadow-sm { box-shadow: none !important; }
      }
    `
    document.head.appendChild(style)
    window.print()
    setTimeout(() => document.head.removeChild(style), 1000)
  }

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-5 py-3 flex items-center gap-3 shrink-0 flex-wrap">
      <div className="flex-1 min-w-0">
        <h1 className="text-base font-semibold text-gray-900 dark:text-white leading-tight">Marketing Performance Dashboard</h1>
        <p className="text-xs text-gray-400 dark:text-slate-500">
          Exterior Building Solutions ·{' '}
          {syncState.status === 'syncing'
            ? <span className="text-blue-500 animate-pulse">Syncing all sources…</span>
            : syncState.status === 'done'
            ? <span className="text-green-600">✓ Synced · {syncState.lastSync}</span>
            : `Last updated ${syncState.lastSync}`}
        </p>
      </div>

      {/* Date Range */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-400 dark:text-slate-500 font-medium">Period:</span>
        {(['7d', '30d', '90d'] as DateRange[]).map(r => (
          <button
            key={r}
            onClick={() => setDateRange(r)}
            className={cn(
              'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
              dateRange === r ? 'bg-[#007BFF] text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
            )}
          >
            {r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : '90 Days'}
          </button>
        ))}
      </div>

      {/* Compare Mode — hidden until live comparison periods are implemented
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-400 dark:text-slate-500 font-medium">vs:</span>
        {([['none', 'None'], ['wow', 'Prev Week'], ['mom', 'Prev Month']] as [CompareMode, string][]).map(([m, label]) => (
          <button
            key={m}
            onClick={() => setCompareMode(m)}
            className={cn(
              'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
              compareMode === m ? 'bg-gray-700 dark:bg-slate-600 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
            )}
          >
            {label}
          </button>
        ))}
      </div>
      */}

      {/* Action buttons */}
      <button
        onClick={handleExport}
        className="flex items-center gap-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-lg transition-colors"
      >
        ↓ Export PDF
      </button>

      <button
        onClick={triggerSync}
        disabled={syncState.status === 'syncing'}
        className={cn(
          'flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
          syncState.status === 'syncing'
            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-400 cursor-not-allowed'
            : 'bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300'
        )}
      >
        <span className={cn(syncState.status === 'syncing' && 'animate-spin inline-block')}>⟳</span>
        {syncState.status === 'syncing' ? 'Syncing…' : 'Sync All'}
      </button>
    </header>
  )
}
