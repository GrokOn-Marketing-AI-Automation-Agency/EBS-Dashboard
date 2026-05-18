import { fmt, cn } from '../../utils/format'

const PLATFORM_COLORS: Record<string, string> = {
  'AccuLynx':    'bg-blue-50   text-blue-700   dark:bg-blue-900/20   dark:text-blue-400',
  'Google Ads':  'bg-amber-50  text-amber-700  dark:bg-amber-900/20  dark:text-amber-400',
  'GROMAAP':     'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
  'Google LSA':  'bg-green-50  text-green-700  dark:bg-green-900/20  dark:text-green-400',
  'GA4':         'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
  'GSC':         'bg-teal-50   text-teal-700   dark:bg-teal-900/20   dark:text-teal-400',
  'Clarity':     'bg-pink-50   text-pink-700   dark:bg-pink-900/20   dark:text-pink-400',
}

interface Props {
  label:      string
  value:      string | number
  change?:    number
  prefix?:    string
  suffix?:    string
  highlight?: boolean
  sub?:       string
  source?:    'live' | 'mock'
  platform?:  string   // e.g. 'AccuLynx', 'Google Ads', 'GROMAAP'
  loading?:   boolean
}

export function MetricCard({ label, value, change, prefix, suffix, highlight, sub, source, platform, loading }: Props) {
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
            source === 'live' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
          )}>
            {source === 'live' ? '● Live' : '○ Est.'}
          </span>
        )}
      </div>
      {platform && (
        <span className={cn(
          'text-[9px] font-semibold px-1.5 py-0.5 rounded-full w-fit uppercase tracking-wide',
          PLATFORM_COLORS[platform] ?? 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400'
        )}>
          {platform}
        </span>
      )}
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
