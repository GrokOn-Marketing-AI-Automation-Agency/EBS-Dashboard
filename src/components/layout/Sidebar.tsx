import { useDashboard } from '../../context/DashboardContext'
import { DATA_SOURCES } from '../../data/mockData'
import { cn } from '../../utils/format'
import gromaapLogo from '../../assets/gromaap-logo.png'

const NAV_ITEMS = [
  { label: 'Overview',           id: 'kpi'         },
  { label: 'Discrepancy Alerts', id: 'alerts'            },
  { label: 'Attribution Gaps',   id: 'attribution-gaps' },
  { label: 'Source Comparison',  id: 'comparison'   },
  { label: 'Lead Sources',       id: 'leads'        },
  { label: 'Pipeline',           id: 'pipeline'     },
  { label: 'Traffic',            id: 'traffic'      },
  { label: 'Search Console',     id: 'search-console' },
  { label: 'Clarity',            id: 'clarity'        },
  { label: 'Calls',              id: 'calls'          },
  { label: 'ROI',                id: 'roi'          },
  { label: 'GROMAAP',            id: 'ghl'          },
  { label: 'Data Quality',       id: 'quality'      },
]

export function Sidebar() {
  const { sources, toggleSource, theme, toggleTheme } = useDashboard()

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <aside className="w-56 shrink-0 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700 flex flex-col h-full overflow-y-auto">
      <div className="px-4 py-4 border-b border-gray-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-900 z-10">
        <img
          src={gromaapLogo}
          alt="GROMAAP"
          className="w-full max-w-[152px] mx-auto block"
        />
        <p className="text-center text-[10px] text-gray-400 dark:text-slate-500 mt-1.5 tracking-wide">EBS Dashboard</p>
      </div>

      <div className="px-3 py-4 flex-1">
        <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2 px-1">Data Sources</p>
        <div className="space-y-0.5 mb-5">
          {DATA_SOURCES.map(ds => {
            const active = sources[ds.key]
            return (
              <button
                key={ds.key}
                onClick={() => toggleSource(ds.key)}
                title={active ? 'Click to hide this source' : 'Click to show this source'}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-all text-sm group',
                  active ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'text-gray-400 dark:text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-600 dark:hover:text-slate-300'
                )}
              >
                <span className={cn('text-base transition-opacity', active ? 'opacity-100' : 'opacity-40')}>{ds.icon}</span>
                <span className="flex-1 truncate font-medium">{ds.label}</span>
                <span className={cn(
                  'w-2 h-2 rounded-full shrink-0 transition-opacity',
                  !active ? 'opacity-30 bg-gray-300 dark:bg-slate-600' :
                  ds.status === 'ok' ? 'bg-green-400' : ds.status === 'warning' ? 'bg-amber-400' : 'bg-red-400'
                )} />
              </button>
            )
          })}
        </div>

        <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2 px-1">Jump To</p>
        <div className="space-y-0.5">
          {NAV_ITEMS.map(nav => (
            <button
              key={nav.id}
              onClick={() => scrollTo(nav.id)}
              className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              {nav.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-3 border-t border-gray-100 dark:border-slate-800 sticky bottom-0 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400 dark:text-slate-500">
            Client: <span className="text-gray-600 dark:text-slate-300 font-medium">EBS Roofing</span>
          </span>
          <button
            onClick={toggleTheme}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
          >
            <span>{theme === 'light' ? '🌙' : '☀️'}</span>
            <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
          </button>
        </div>
      </div>
    </aside>
  )
}
