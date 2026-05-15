import { DISCREPANCY_ALERTS } from '../../data/mockData'
import { cn } from '../../utils/format'
import type { DiscrepancyAlert } from '../../types'

const severityConfig = {
  critical: { bg: 'bg-red-50', border: 'border-red-200', icon: '🚨', badge: 'bg-red-100 text-red-800', label: 'Critical' },
  warning: { bg: 'bg-amber-50', border: 'border-amber-200', icon: '⚠️', badge: 'bg-amber-100 text-amber-800', label: 'Warning' },
  info: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'ℹ️', badge: 'bg-blue-100 text-blue-800', label: 'Info' },
}

function AlertCard({ alert }: { alert: DiscrepancyAlert }) {
  const cfg = severityConfig[alert.severity]
  return (
    <div className={cn('rounded-xl border p-4', cfg.bg, cfg.border)}>
      <div className="flex items-start gap-3 mb-3">
        <span className="text-xl shrink-0">{cfg.icon}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', cfg.badge)}>{cfg.label}</span>
            <p className="text-sm font-semibold text-gray-800">{alert.metric}</p>
          </div>
          <p className="text-xs text-gray-500">Platforms: {alert.platforms.join(' vs ')}</p>
        </div>
        <span className="text-sm font-bold text-gray-700 shrink-0">Δ {alert.variance}%</span>
      </div>

      {/* Platform values */}
      <div className="flex gap-3 mb-3">
        {alert.values.map(v => (
          <div key={v.platform} className="bg-white rounded-lg px-3 py-2 text-center border border-white/60 shadow-sm flex-1">
            <p className="text-xs text-gray-500 truncate">{v.platform}</p>
            <p className="text-xl font-bold text-gray-900">{v.value}</p>
          </div>
        ))}
      </div>

      {/* Suggestions */}
      <div className="bg-white/70 rounded-lg p-3">
        <p className="text-xs font-semibold text-gray-600 mb-1.5">Possible Explanations</p>
        <ul className="space-y-1">
          {alert.suggestions.map((s, i) => (
            <li key={i} className="text-xs text-gray-600 flex gap-1.5">
              <span className="text-gray-400 shrink-0">•</span>{s}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function DiscrepancyAlerts() {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Discrepancy Alerts</h2>
        <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
          {DISCREPANCY_ALERTS.filter(a => a.severity === 'critical').length} Critical
        </span>
      </div>
      <div className="space-y-3">
        {DISCREPANCY_ALERTS.map(alert => <AlertCard key={alert.id} alert={alert} />)}
      </div>
    </section>
  )
}
