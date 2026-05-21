import { useState } from 'react'
import { useDashboard } from '../../context/DashboardContext'
import { DATA_SOURCES } from '../../data/mockData'
import { CLIENTS } from '../../config/clients'
import { cn } from '../../utils/format'
import gromaapLogo from '../../assets/agencygro-logo.png'

const NAV_ITEMS = [
  { label: 'Overview',           id: 'kpi'              },
  { label: 'Discrepancy Alerts', id: 'alerts'           },
  { label: 'Attribution Gaps',   id: 'attribution-gaps' },
  { label: 'Source Comparison',  id: 'comparison'       },
  { label: 'Lead Sources',       id: 'leads'            },
  { label: 'Pipeline',           id: 'pipeline'         },
  { label: 'Traffic',            id: 'traffic'          },
  { label: 'Search Console',     id: 'search-console'   },
  { label: 'Clarity',            id: 'clarity'          },
  { label: 'Calls',              id: 'calls'            },
  { label: 'Local Service Ads',  id: 'lsa'              },
  { label: 'ROI',                id: 'roi'              },
  { label: 'GROMAAP',            id: 'ghl'              },
  { label: 'Data Quality',       id: 'quality'          },
]

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const { sources, toggleSource, theme, toggleTheme, activeClient, setActiveClientId } = useDashboard()
  const [clientMenuOpen, setClientMenuOpen] = useState(false)

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    onClose?.()
  }

  return (
    <div className="w-64 md:w-56 shrink-0 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700 flex flex-col h-full overflow-y-auto">
      <div className="px-4 py-4 border-b border-gray-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-900 z-10 flex items-center justify-between">
        <div className="flex-1">
          <img src={gromaapLogo} alt="GROMAAP" className="w-full max-w-[140px] block" />
          <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1.5 tracking-wide">{activeClient.shortName} Dashboard</p>
        </div>
        {/* Close button — mobile only */}
        {onClose && (
          <button
            onClick={onClose}
            className="ml-2 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors md:hidden"
          >
            ✕
          </button>
        )}
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
                  active
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'text-gray-400 dark:text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-600 dark:hover:text-slate-300'
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

      <div className="px-4 py-3 border-t border-gray-100 dark:border-slate-800 sticky bottom-0 bg-white dark:bg-slate-900 space-y-2">
        {/* Client switcher */}
        <div className="relative">
          <button
            onClick={() => setClientMenuOpen(v => !v)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            <span className={cn('w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0', activeClient.color, activeClient.textColor)}>
              {activeClient.shortName.charAt(0)}
            </span>
            <div className="flex-1 text-left min-w-0">
              <p className="text-xs font-semibold text-gray-700 dark:text-slate-200 truncate">{activeClient.shortName}</p>
              <p className="text-[10px] text-gray-400 dark:text-slate-500 truncate">{activeClient.industry}</p>
            </div>
            <span className="text-gray-400 text-[10px]">{clientMenuOpen ? '▲' : '▼'}</span>
          </button>

          {clientMenuOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden z-50">
              {CLIENTS.map(client => (
                <button
                  key={client.id}
                  onClick={() => { setActiveClientId(client.id); setClientMenuOpen(false) }}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors',
                    client.id === activeClient.id && 'bg-blue-50 dark:bg-blue-900/20'
                  )}
                >
                  <span className={cn('w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0', client.color, client.textColor)}>
                    {client.shortName.charAt(0)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700 dark:text-slate-200 truncate">{client.shortName}</p>
                    <p className="text-[10px] text-gray-400 dark:text-slate-500">{client.live ? '● Live' : '○ Mock data'}</p>
                  </div>
                  {client.id === activeClient.id && <span className="text-blue-500 text-xs">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <div className="flex justify-end">
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
    </div>
  )
}

export function Sidebar() {
  const { sidebarOpen, setSidebarOpen } = useDashboard()

  return (
    <>
      {/* Desktop sidebar — always visible */}
      <div className="hidden md:flex h-full">
        <SidebarContent />
      </div>

      {/* Mobile sidebar — slide-in drawer */}
      {sidebarOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Drawer */}
          <div className="fixed inset-y-0 left-0 z-50 flex md:hidden">
            <SidebarContent onClose={() => setSidebarOpen(false)} />
          </div>
        </>
      )}
    </>
  )
}
