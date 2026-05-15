import { fmt, cn } from '../../utils/format'

interface Props {
  label:      string
  value:      string | number
  change?:    number
  prefix?:    string
  suffix?:    string
  highlight?: boolean
  sub?:       string
  source?:    'live' | 'mock'   // shows a small badge so user knows what's real
  loading?:   boolean
}

export function MetricCard({ label, value, change, prefix, suffix, highlight, sub, source, loading }: Props) {
  const up = (change ?? 0) >= 0
  return (
    <div className={cn(
      'bg-white dark:bg-slate-900 rounded-xl p-4 border shadow-sm flex flex-col gap-1',
      highlight ? 'border-blue-400 ring-1 ring-blue-100 dark:ring-blue-900/50' : 'border-gray-100 dark:border-slate-700'
    )}>
      <div className="flex items-center justify-between gap-1">
        <p className="text-xs text-gray-500 dark:text-slate-400 font-medium truncate">{label}</p>
        {source && (
          <span className={cn(
            'text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0',
            source === 'live' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-600'
          )}>
            {source === 'live' ? '● Live' : '○ Est.'}
          </span>
        )}
      </div>
      {loading ? (
        <div className="h-8 w-24 bg-gray-100 dark:bg-slate-800 rounded animate-pulse mt-1" />
      ) : (
        <p className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">
          {prefix}<span>{typeof value === 'number' ? value.toLocaleString() : value}</span>{suffix}
        </p>
      )}
      {sub && <p className="text-xs text-gray-400 dark:text-slate-500">{sub}</p>}
      {change !== undefined && !loading && (
        <span className={cn(
          'text-xs font-semibold rounded-full px-2 py-0.5 w-fit',
          up ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        )}>
          {up ? '↑' : '↓'} {fmt.change(Math.abs(change))} vs prev
        </span>
      )}
    </div>
  )
}
