import { useState, useEffect } from 'react'
import { fetchLSASummary, type LSASummary } from '../services/lsa'
import { useDashboard } from '../context/DashboardContext'

const SESSION_KEY = 'dash_lsa'

export function useLSA() {
  const { dateRange } = useDashboard()
  const [data,    setData]    = useState<LSASummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    // Serve cached while re-fetching
    try {
      const cached = sessionStorage.getItem(SESSION_KEY)
      if (cached) setData(JSON.parse(cached))
    } catch { /* ignore */ }

    fetchLSASummary(dateRange)
      .then(d => {
        setData(d)
        setError(null)
        try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(d)) } catch { /* ignore */ }
      })
      .catch(e => {
        setError(e.message)
        console.error('[useLSA]', e)
      })
      .finally(() => setLoading(false))
  }, [dateRange])

  return { data, loading, error }
}
