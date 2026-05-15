import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { DataSourceState, DateRange, CompareMode } from '../types'

interface SyncState { status: 'idle' | 'syncing' | 'done'; lastSync: string }

interface DashboardContextValue {
  sources: DataSourceState
  dateRange: DateRange
  compareMode: CompareMode
  syncState: SyncState
  theme: 'light' | 'dark'
  toggleSource: (key: keyof DataSourceState) => void
  setDateRange: (r: DateRange) => void
  setCompareMode: (m: CompareMode) => void
  triggerSync: () => void
  toggleTheme: () => void
}

const DashboardContext = createContext<DashboardContextValue | null>(null)

export function useDashboard() {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error('useDashboard must be used inside DashboardProvider')
  return ctx
}

const DEFAULT_SOURCES: DataSourceState = {
  acculynx: true, ga4: true, googleAds: true, gsc: true,
  highlevel: true, growmap: true, clarity: true, lsa: true,
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [sources, setSources] = useState<DataSourceState>(DEFAULT_SOURCES)
  const [dateRange, setDateRange] = useState<DateRange>('7d')
  const [compareMode, setCompareMode] = useState<CompareMode>('wow')
  const [syncState, setSyncState] = useState<SyncState>({ status: 'idle', lastSync: 'May 11, 2026 9:00 AM' })
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme')
    return saved === 'dark' ? 'dark' : 'light'
  })

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleSource = useCallback((key: keyof DataSourceState) =>
    setSources(prev => ({ ...prev, [key]: !prev[key] })), [])

  const toggleTheme = useCallback(() => {
    setTheme(t => t === 'light' ? 'dark' : 'light')
  }, [])

  const triggerSync = useCallback(() => {
    setSyncState({ status: 'syncing', lastSync: syncState.lastSync })
    setTimeout(() => {
      const now = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
      setSyncState({ status: 'done', lastSync: now })
      setTimeout(() => setSyncState(s => ({ ...s, status: 'idle' })), 2000)
    }, 2200)
  }, [syncState.lastSync])

  return (
    <DashboardContext.Provider value={{ sources, dateRange, compareMode, syncState, theme, toggleSource, setDateRange, setCompareMode, triggerSync, toggleTheme }}>
      {children}
    </DashboardContext.Provider>
  )
}
