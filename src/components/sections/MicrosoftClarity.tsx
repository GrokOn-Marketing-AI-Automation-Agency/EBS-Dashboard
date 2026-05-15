import { useState } from 'react'
import { cn } from '../../utils/format'
import { useClarity } from '../../hooks/useClarity'

const PROJECT_ID   = 'ko3ifc8c96'
const CLARITY_BASE = `https://clarity.microsoft.com/projects/view/${PROJECT_ID}`

const EMBED_SNIPPET = `<!-- Microsoft Clarity -->
<script type="text/javascript">
  (function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
  })(window, document, "clarity", "script", "${PROJECT_ID}");
</script>`

const DEEP_LINKS = [
  { label: '🔥 Heatmaps',          url: `${CLARITY_BASE}/heatmaps`   },
  { label: '▶ Session Recordings', url: `${CLARITY_BASE}/recordings` },
  { label: '📊 Dashboard',         url: CLARITY_BASE                  },
  { label: '⚙ Settings',           url: `${CLARITY_BASE}/settings`   },
]

function StatCard({ label, value, sub, color = 'blue' }: {
  label: string; value: string | number; sub?: string; color?: string
}) {
  const ring = color === 'red'    ? 'border-red-200 dark:border-red-900/40'
             : color === 'green'  ? 'border-green-200 dark:border-green-900/40'
             : color === 'amber'  ? 'border-amber-200 dark:border-amber-900/40'
             : color === 'purple' ? 'border-purple-200 dark:border-purple-900/40'
             : 'border-blue-200 dark:border-blue-900/40'

  const dot  = color === 'red'    ? 'bg-red-500'
             : color === 'green'  ? 'bg-green-500'
             : color === 'amber'  ? 'bg-amber-500'
             : color === 'purple' ? 'bg-purple-500'
             : 'bg-blue-500'

  return (
    <div className={cn('bg-white dark:bg-slate-900 border rounded-xl p-3 shadow-sm', ring)}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={cn('w-1.5 h-1.5 rounded-full', dot)} />
        <p className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-xl font-bold text-gray-800 dark:text-white">{value}</p>
      {sub && <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function BehaviorBadge({ label, value, icon, good }: {
  label: string; value: number; icon: string; good: boolean
}) {
  return (
    <div className={cn(
      'flex items-center justify-between px-3 py-2 rounded-xl border text-xs',
      good
        ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-900/40'
        : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/40'
    )}>
      <span className="flex items-center gap-1.5 font-medium text-gray-700 dark:text-slate-300">
        <span>{icon}</span>{label}
      </span>
      <span className={cn('font-bold', good ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400')}>
        {value.toLocaleString()}
      </span>
    </div>
  )
}

export function MicrosoftClarity() {
  const [copied,    setCopied]    = useState(false)
  const [showEmbed, setShowEmbed] = useState(false)
  const { data, loading } = useClarity()

  function copySnippet() {
    navigator.clipboard.writeText(EMBED_SNIPPET).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  const isLive = data?.source === 'live'
  const ov     = data?.overview

  return (
    <section id="clarity" className="scroll-mt-4">

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
            🖱️ Microsoft Clarity
          </h2>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
            Project: <span className="font-mono">{PROJECT_ID}</span> · Session recordings &amp; behaviour analytics
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data && !isLive && (
            <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">
              Sample data
            </span>
          )}
          <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400 border border-green-200 dark:border-green-800 px-2.5 py-1 rounded-full">
            <span className={cn('w-1.5 h-1.5 rounded-full', loading ? 'bg-amber-400 animate-pulse' : 'bg-green-500')} />
            {loading ? 'Loading…' : isLive ? 'Live' : 'Connected'}
          </span>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-gray-100 dark:bg-slate-800 animate-pulse" />
          ))
        ) : ov ? (
          <>
            <StatCard label="Sessions"      value={ov.sessions.toLocaleString()}  sub="Last 7 days"       color="blue"   />
            <StatCard label="Users"         value={ov.users.toLocaleString()}     sub={`${ov.newUsersPercent}% new`} color="purple" />
            <StatCard label="Bounce Rate"   value={`${ov.bounceRate}%`}           sub="Lower is better"   color={ov.bounceRate < 45 ? 'green' : 'amber'} />
            <StatCard label="Avg Duration"  value={ov.avgSessionDuration}         sub="Per session"       color="green"  />
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Device breakdown */}
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl shadow-sm p-4">
          <p className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-3">Device Breakdown</p>
          {loading ? (
            <div className="space-y-2">
              {[70, 50, 30].map((w, i) => (
                <div key={i} className="h-8 rounded-lg bg-gray-100 dark:bg-slate-800 animate-pulse" style={{ width: `${w}%` }} />
              ))}
            </div>
          ) : data?.devices ? (
            <div className="space-y-2">
              {data.devices.map(d => {
                const color = d.device === 'Desktop' ? 'bg-blue-500'
                            : d.device === 'Mobile'  ? 'bg-purple-500'
                            : 'bg-slate-400'
                return (
                  <div key={d.device}>
                    <div className="flex justify-between text-xs text-gray-600 dark:text-slate-300 mb-1">
                      <span className="font-medium">{d.device}</span>
                      <span className="font-bold">{d.pct}% <span className="font-normal text-gray-400">({d.sessions.toLocaleString()})</span></span>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${d.pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}

          {/* Behavior signals */}
          {data?.behavior && !loading && (
            <div className="mt-4 space-y-1.5">
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">Behaviour Signals</p>
              <BehaviorBadge label="Rage Clicks"  value={data.behavior.rageClicks}  icon="😤" good={data.behavior.rageClicks  < 150} />
              <BehaviorBadge label="Dead Clicks"  value={data.behavior.deadClicks}  icon="🖱️" good={data.behavior.deadClicks  < 300} />
              <BehaviorBadge label="Quick Backs"  value={data.behavior.quickBacks}  icon="↩️" good={data.behavior.quickBacks  < 200} />
              <BehaviorBadge label="JS Errors"    value={data.behavior.jsErrors}    icon="⚠️" good={data.behavior.jsErrors    < 20}  />
            </div>
          )}
        </div>

        {/* Top pages */}
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl shadow-sm p-4">
          <p className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-3">Top Pages</p>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 rounded-lg bg-gray-100 dark:bg-slate-800 animate-pulse" />
              ))}
            </div>
          ) : data?.topPages ? (
            <div className="space-y-2">
              {data.topPages.map((p, i) => (
                <div key={p.url} className="flex items-center gap-2 text-xs">
                  <span className="w-4 text-right text-gray-400 dark:text-slate-500 font-mono shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-700 dark:text-slate-300 truncate">{p.url}</p>
                    <p className="text-gray-400 dark:text-slate-500">{p.views.toLocaleString()} views · {p.avgTime}</p>
                  </div>
                  <span className={cn(
                    'shrink-0 font-semibold px-1.5 py-0.5 rounded-lg text-[10px]',
                    p.bounceRate < 30 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : p.bounceRate < 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  )}>
                    {p.bounceRate}%
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {/* Scroll depth */}
          {data?.behavior && !loading && (
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-700">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500 dark:text-slate-400 font-medium">Avg Scroll Depth</span>
                <span className="font-bold text-gray-700 dark:text-slate-200">{data.behavior.scrollDepth}%</span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full', data.behavior.scrollDepth > 60 ? 'bg-green-500' : data.behavior.scrollDepth > 40 ? 'bg-amber-500' : 'bg-red-500')}
                  style={{ width: `${data.behavior.scrollDepth}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">
                {data.behavior.scrollDepth > 60 ? 'Great engagement — users read most of the page'
                 : data.behavior.scrollDepth > 40 ? 'Moderate — consider moving key CTAs higher'
                 : 'Low — users leaving before reaching key content'}
              </p>
            </div>
          )}
        </div>

        {/* Quick links + embed */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl shadow-sm p-4">
            <p className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-3">Open in Clarity</p>
            <div className="grid grid-cols-2 gap-2">
              {DEEP_LINKS.map(link => (
                <a
                  key={link.label}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-gray-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 text-xs text-gray-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-400 transition-all font-medium"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          {/* Embed snippet (collapsible) */}
          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl shadow-sm p-4">
            <button
              onClick={() => setShowEmbed(v => !v)}
              className="w-full flex items-center justify-between text-sm font-semibold text-gray-700 dark:text-slate-200"
            >
              <span>Tracking Snippet</span>
              <span className="text-gray-400 text-xs">{showEmbed ? '▲ hide' : '▼ show'}</span>
            </button>
            {showEmbed && (
              <>
                <div className="flex justify-end mt-2 mb-1">
                  <button
                    onClick={copySnippet}
                    className={cn(
                      'text-xs px-3 py-1 rounded-lg font-medium transition-colors',
                      copied
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                    )}
                  >
                    {copied ? '✓ Copied!' : '⎘ Copy'}
                  </button>
                </div>
                <pre className="text-[10px] leading-relaxed bg-gray-950 text-green-400 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap font-mono border border-gray-800">
                  {EMBED_SNIPPET}
                </pre>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">
                  Paste into the <code className="bg-gray-100 dark:bg-slate-800 px-1 rounded">&lt;head&gt;</code> of <strong>exteriorbuildingsolutions.com</strong>.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
