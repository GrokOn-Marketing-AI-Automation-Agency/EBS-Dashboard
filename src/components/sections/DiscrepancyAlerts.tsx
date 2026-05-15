import { useDashboard } from '../../context/DashboardContext'
import { useGoogleAdsSummary } from '../../hooks/useGoogleAds'
import { useGA4Summary } from '../../hooks/useGA4'
import { useGHLSummary } from '../../hooks/useGHL'
import { useAccuLynxSummary } from '../../hooks/useAccuLynx'
import { cn } from '../../utils/format'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Alert {
  id:          string
  severity:    'critical' | 'warning' | 'info'
  metric:      string
  platforms:   string[]
  values:      { platform: string; value: string }[]
  variance:    number
  suggestions: string[]
}

// ─── Config ──────────────────────────────────────────────────────────────────

const SEV = {
  critical: { bg: 'bg-red-50 dark:bg-red-950/30',    border: 'border-red-200 dark:border-red-800',    icon: '🚨', badge: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',    label: 'Critical' },
  warning:  { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', icon: '⚠️', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300', label: 'Warning'  },
  info:     { bg: 'bg-blue-50 dark:bg-blue-950/30',   border: 'border-blue-200 dark:border-blue-800',   icon: 'ℹ️', badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',   label: 'Info'     },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pct(a: number, b: number) {
  if (!b) return 0
  return Math.round(Math.abs((a - b) / b) * 100)
}

function fmtNum(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return n >= 10_000 ? `$${Math.round(n / 1000)}k` : n.toLocaleString()
  return n.toLocaleString()
}

function severity(variance: number): Alert['severity'] {
  if (variance >= 40) return 'critical'
  if (variance >= 20) return 'warning'
  return 'info'
}

// ─── Alert card ──────────────────────────────────────────────────────────────

function AlertCard({ alert }: { alert: Alert }) {
  const cfg = SEV[alert.severity]
  return (
    <div className={cn('rounded-xl border p-4', cfg.bg, cfg.border)}>
      <div className="flex items-start gap-3 mb-3">
        <span className="text-xl shrink-0">{cfg.icon}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', cfg.badge)}>{cfg.label}</span>
            <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">{alert.metric}</p>
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400">Platforms: {alert.platforms.join(' vs ')}</p>
        </div>
        <span className="text-sm font-bold text-gray-700 dark:text-slate-200 shrink-0">Δ {alert.variance}%</span>
      </div>

      {/* Platform values */}
      <div className="flex gap-3 mb-3">
        {alert.values.map(v => (
          <div key={v.platform} className="bg-white dark:bg-slate-800 rounded-lg px-3 py-2 text-center border border-white/60 dark:border-slate-700 shadow-sm flex-1">
            <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{v.platform}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{v.value}</p>
          </div>
        ))}
      </div>

      {/* Suggestions */}
      <div className="bg-white/70 dark:bg-slate-800/60 rounded-lg p-3">
        <p className="text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1.5">Possible Explanations</p>
        <ul className="space-y-1">
          {alert.suggestions.map((s, i) => (
            <li key={i} className="text-xs text-gray-600 dark:text-slate-400 flex gap-1.5">
              <span className="text-gray-400 shrink-0">•</span>{s}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DiscrepancyAlerts() {
  const { dateRange, sources } = useDashboard()

  const { data: gads }     = useGoogleAdsSummary(dateRange)
  const { data: ga4 }      = useGA4Summary(dateRange)
  const { data: ghl }      = useGHLSummary(dateRange)
  const { data: acculynx } = useAccuLynxSummary(dateRange)

  // ── Build live alerts ────────────────────────────────────────────────────

  const alerts: Alert[] = []

  // 1. Google Ads clicks vs GA4 sessions
  if (sources.googleAds && sources.ga4) {
    const clicks   = gads?.totals?.clicks   ?? 0
    const sessions = ga4?.overview?.sessions ?? 0
    if (clicks > 0 && sessions > 0) {
      const v = pct(clicks, sessions)
      if (v >= 10) {
        alerts.push({
          id: 'clicks-vs-sessions',
          severity: severity(v),
          metric: 'Paid Clicks vs GA4 Sessions',
          platforms: ['Google Ads', 'GA4'],
          values: [
            { platform: 'Google Ads Clicks', value: clicks.toLocaleString() },
            { platform: 'GA4 Sessions',      value: sessions.toLocaleString() },
          ],
          variance: v,
          suggestions: [
            'GA4 sessions include organic/direct traffic, not just paid clicks',
            'Ad clicks may not always result in a session (e.g., quick bounces before GA4 fires)',
            'Check GA4 tag is firing on all landing pages used in ads',
            'Some users may have ad blockers preventing GA4 tracking',
          ],
        })
      }
    }
  }

  // 2. Google Ads conversions vs AccuLynx new leads
  if (sources.googleAds && sources.acculynx) {
    const conversions = gads?.totals?.conversions ?? 0
    const newLeads    = acculynx?.totalJobs        ?? 0
    if (conversions > 0 && newLeads > 0) {
      const v = pct(conversions, newLeads)
      if (v >= 15) {
        alerts.push({
          id: 'conversions-vs-leads',
          severity: severity(v),
          metric: 'Google Ads Conversions vs AccuLynx Leads',
          platforms: ['Google Ads', 'AccuLynx'],
          values: [
            { platform: 'Ads Conversions', value: Math.round(conversions).toLocaleString() },
            { platform: 'AccuLynx Leads',  value: newLeads.toLocaleString() },
          ],
          variance: v,
          suggestions: [
            'Google Ads counts form fills & calls; AccuLynx only counts entered leads',
            'Not all ad conversions may have been manually added to AccuLynx',
            'Conversion tracking may count duplicate actions (e.g. multi-step form)',
            'Check if leads from other sources are inflating AccuLynx count',
          ],
        })
      }
    }
  }

  // 3. GHL opportunities vs AccuLynx jobs
  if (sources.highlevel && sources.acculynx) {
    const ghlOpps   = ghl?.totalOpps     ?? 0
    const acxJobs   = acculynx?.totalJobs ?? 0
    if (ghlOpps > 0 && acxJobs > 0) {
      const v = pct(ghlOpps, acxJobs)
      if (v >= 15) {
        alerts.push({
          id: 'ghl-vs-acculynx',
          severity: severity(v),
          metric: 'GHL Opportunities vs AccuLynx Jobs',
          platforms: ['GoHighLevel', 'AccuLynx'],
          values: [
            { platform: 'GHL Opps',      value: ghlOpps.toLocaleString() },
            { platform: 'AccuLynx Jobs', value: acxJobs.toLocaleString() },
          ],
          variance: v,
          suggestions: [
            'GHL tracks all pipeline opportunities including early-stage leads',
            'AccuLynx jobs may only be created after a signed contract or inspection',
            'Duplicate contacts in GHL can inflate opportunity count',
            'Ensure GHL–AccuLynx sync is up to date',
          ],
        })
      }
    }
  }

  // 4. Google Ads spend vs expected pipeline value (ROAS check)
  if (sources.googleAds && sources.acculynx) {
    const spend         = gads?.totals?.spend ?? 0
    const pipelineValue = acculynx?.pipeline?.reduce((a: number, s: any) => a + (s.value ?? 0), 0) ?? 0
    if (spend > 0 && pipelineValue > 0) {
      const roas = pipelineValue / spend
      if (roas < 3) {
        const v = Math.round((3 - roas) / 3 * 100)
        alerts.push({
          id: 'roas-check',
          severity: roas < 1.5 ? 'critical' : 'warning',
          metric: 'Ad Spend vs Pipeline Value (ROAS)',
          platforms: ['Google Ads', 'AccuLynx'],
          values: [
            { platform: 'Ad Spend',      value: `$${Math.round(spend).toLocaleString()}` },
            { platform: 'Pipeline Value', value: fmtNum(pipelineValue) },
          ],
          variance: v,
          suggestions: [
            `Current ROAS is ${roas.toFixed(1)}x — target is typically 3x or higher for roofing`,
            'Pipeline value may not yet reflect closed contracts',
            'Consider pausing underperforming campaigns to improve ROAS',
            'Ensure all ad-sourced leads are being entered into AccuLynx',
          ],
        })
      }
    }
  }

  // 5. GA4 bounce rate high
  if (sources.ga4) {
    const bounce = ga4?.overview?.bounceRate ?? 0
    if (bounce >= 60) {
      const v = Math.round(bounce - 40)
      alerts.push({
        id: 'bounce-rate',
        severity: bounce >= 75 ? 'critical' : 'warning',
        metric: 'High Bounce Rate on Website',
        platforms: ['GA4'],
        values: [
          { platform: 'Bounce Rate', value: `${bounce.toFixed(1)}%` },
          { platform: 'Target',      value: '< 60%' },
        ],
        variance: v,
        suggestions: [
          'Landing pages may not match ad messaging — check page relevance',
          'Page load speed may be too slow — test with Google PageSpeed Insights',
          'Mobile experience may need improvement',
          'CTA placement may need to be higher on the page',
        ],
      })
    }
  }

  // 6. CTR below benchmark
  if (sources.googleAds) {
    const ctr = gads?.totals?.ctr ?? 0
    if (ctr > 0 && ctr < 3) {
      const v = Math.round((3 - ctr) / 3 * 100)
      alerts.push({
        id: 'low-ctr',
        severity: ctr < 1.5 ? 'warning' : 'info',
        metric: 'Below-Average Click-Through Rate',
        platforms: ['Google Ads'],
        values: [
          { platform: 'Current CTR', value: `${ctr.toFixed(2)}%` },
          { platform: 'Benchmark',   value: '3–5%' },
        ],
        variance: v,
        suggestions: [
          'Ad copy may not be resonating — test new headlines',
          'Targeting may be too broad — refine keywords or audiences',
          'Ad extensions (sitelinks, callouts) can improve CTR significantly',
          'Review Quality Score in Google Ads for low-performing keywords',
        ],
      })
    }
  }

  const criticalCount = alerts.filter(a => a.severity === 'critical').length

  const rangeLabel = dateRange === '7d' ? 'Last 7 Days' : dateRange === '30d' ? 'Last 30 Days' : 'Last 90 Days'

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Discrepancy Alerts</h2>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{rangeLabel} · Live cross-platform analysis</p>
        </div>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {criticalCount} Critical
            </span>
          )}
          <span className="bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 text-xs font-medium px-2 py-0.5 rounded-full">
            {alerts.length} Alert{alerts.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl p-6 text-center">
          <p className="text-2xl mb-2">✅</p>
          <p className="text-sm font-semibold text-green-800 dark:text-green-300">No significant discrepancies detected</p>
          <p className="text-xs text-green-600 dark:text-green-500 mt-1">All platform metrics are within normal variance for {rangeLabel.toLowerCase()}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts
            .sort((a, b) => {
              const order = { critical: 0, warning: 1, info: 2 }
              return order[a.severity] - order[b.severity]
            })
            .map(alert => <AlertCard key={alert.id} alert={alert} />)}
        </div>
      )}
    </section>
  )
}
