import { useAccuLynxSummary } from '../../hooks/useAccuLynx'
import { useGoogleAdsSummary } from '../../hooks/useGoogleAds'
import { useGHLSummary } from '../../hooks/useGHL'
import { getLeadSources } from '../../data/mockData'
import { cn } from '../../utils/format'
import { useDashboard } from '../../context/DashboardContext'
import { DataBadge } from '../ui/DataBadge'

export function SourceComparison() {
  const { dateRange, sources } = useDashboard()
  const { data: acxData }  = useAccuLynxSummary(dateRange)
  const { data: gadsData } = useGoogleAdsSummary(dateRange)
  const { data: ghlData }  = useGHLSummary()

  const mockRows = getLeadSources(dateRange)

  // AccuLynx — live if available
  const acculynxTotal = acxData
    ? acxData.leadSources.reduce((a, r) => a + r.acculynx, 0)
    : mockRows.reduce((a, r) => a + r.acculynx, 0)

  // Google Ads — use live conversions if available
  const googleAdsTotal = gadsData
    ? (gadsData.totals?.conversions ?? 0)
    : (mockRows.find(r => r.source === 'Google Ads')?.googleAds ?? 0)

  // GROMAAP — use live new contacts in period if available
  const highlevelTotal = ghlData
    ? (ghlData.contacts?.newInPeriod ?? ghlData.contacts?.leads ?? 0)
    : mockRows.reduce((a, r) => a + r.highlevel, 0)

  const variance = acculynxTotal > 0 ? Math.round(((googleAdsTotal - acculynxTotal) / acculynxTotal) * 100) : 0

  // Row-level breakdown — AccuLynx live rows, others from mock as reference
  const rows = acxData
    ? acxData.leadSources.map(r => ({
        source:    r.source,
        acculynx:  r.acculynx,
        googleAds: mockRows.find(m => m.source === r.source)?.googleAds ?? 0,
        highlevel: mockRows.find(m => m.source === r.source)?.highlevel ?? 0,
      }))
    : mockRows.map(r => ({ source: r.source, acculynx: r.acculynx, googleAds: r.googleAds, highlevel: r.highlevel }))

  return (
    <section id="comparison" className="scroll-mt-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-gray-800 dark:text-slate-100 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-600 text-white text-sm shrink-0">↔</span>
            Cross-Platform Lead Comparison
          </h2>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 ml-9">Google Ads · AccuLynx · GROMAAP side by side</p>
        </div>
        {acxData && <DataBadge source={acxData.source} lastSync={acxData.lastSync} />}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { platform: 'Google Ads',   value: googleAdsTotal, icon: '🎯', show: sources.googleAds, badge: gadsData?.source ?? null },
          { platform: 'AccuLynx CRM', value: acculynxTotal,  icon: '🏠', show: sources.acculynx,  badge: acxData?.source ?? null },
          { platform: 'GROMAAP',      value: highlevelTotal, icon: '⚡', show: sources.highlevel,  badge: ghlData?.source ?? null },
        ].map(({ platform, value, icon, show, badge }) => (
          <div key={platform} className={cn(
            'bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl p-4 shadow-sm text-center transition-opacity',
            !show && 'opacity-30 pointer-events-none'
          )}>
            <div className="text-2xl mb-1">{icon}</div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">{platform}</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{show ? value.toLocaleString() : '—'}</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">leads this period</p>
            {badge && (
              <span className={cn(
                'mt-2 inline-block text-xs font-medium px-2 py-0.5 rounded-full',
                badge === 'live' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
              )}>
                {badge === 'live' ? '● Live' : '● Mock'}
              </span>
            )}
          </div>
        ))}
      </div>

      {sources.googleAds && sources.acculynx && variance !== 0 && (
        <div className={cn(
          'border rounded-xl p-4 mb-4 flex items-start gap-3',
          Math.abs(variance) > 20 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
        )}>
          <span className="text-xl">{Math.abs(variance) > 20 ? '🚨' : '⚠️'}</span>
          <div className="flex-1">
            <p className={cn('text-sm font-semibold', Math.abs(variance) > 20 ? 'text-red-800' : 'text-amber-800')}>
              Lead Count Discrepancy — {Math.abs(variance)}% Variance
            </p>
            <p className={cn('text-sm mt-0.5', Math.abs(variance) > 20 ? 'text-red-700' : 'text-amber-700')}>
              Google Ads reports <strong>{googleAdsTotal.toLocaleString()} leads</strong> but AccuLynx only shows <strong>{acculynxTotal.toLocaleString()}</strong>.
              The missing <strong>{Math.abs(googleAdsTotal - acculynxTotal).toLocaleString()}</strong> may be in queue, duplicated, or entered offline.
            </p>
          </div>
          <span className={cn('px-2 py-1 rounded-full text-xs font-bold shrink-0',
            Math.abs(variance) > 20 ? 'bg-red-200 text-red-800' : 'bg-amber-100 text-amber-800'
          )}>
            {variance > 0 ? '+' : ''}{variance}%
          </span>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">Lead Source Breakdown</p>
          <span className="text-xs text-gray-400 dark:text-slate-500">AccuLynx / Google Ads / GROMAAP</span>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead className="bg-gray-50 dark:bg-slate-800 text-xs text-gray-500 dark:text-slate-400 uppercase">
            <tr>
              <th className="text-left px-4 py-2">Source</th>
              <th className="text-right px-4 py-2">AccuLynx</th>
              <th className="text-right px-4 py-2">Google Ads</th>
              <th className="text-right px-4 py-2">GROMAAP</th>
              <th className="text-right px-4 py-2">Variance</th>
              <th className="text-right px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
            {rows.map(row => {
              const vals = [row.acculynx, row.googleAds || row.acculynx, row.highlevel].filter(v => v > 0)
              const vPct = vals.length > 1 ? Math.round(((Math.max(...vals) - Math.min(...vals)) / Math.min(...vals)) * 100) : 0
              const status = vPct > 20 ? 'critical' : vPct > 10 ? 'warning' : 'ok'
              return (
                <tr key={row.source} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                  <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-slate-100">{row.source}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-700 dark:text-slate-200">{sources.acculynx ? row.acculynx : <span className="text-gray-300 dark:text-slate-600">—</span>}</td>
                  <td className="px-4 py-2.5 text-right text-gray-700 dark:text-slate-200">{sources.googleAds && row.googleAds ? row.googleAds : <span className="text-gray-300 dark:text-slate-600">—</span>}</td>
                  <td className="px-4 py-2.5 text-right text-gray-700 dark:text-slate-200">{sources.highlevel ? row.highlevel : <span className="text-gray-300 dark:text-slate-600">—</span>}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600 dark:text-slate-300">{vPct > 0 ? `${vPct}%` : '—'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={cn('inline-block w-2 h-2 rounded-full',
                      status === 'ok' ? 'bg-green-400' : status === 'warning' ? 'bg-amber-400' : 'bg-red-500'
                    )} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>
    </section>
  )
}
