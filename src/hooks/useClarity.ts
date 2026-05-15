import { useState, useEffect } from 'react'
import { fetchClaritySummary, type ClaritySummary } from '../services/clarity'

const SESSION_KEY = 'dash_clarity'

export function useClarity() {
  const [data,    setData]    = useState<ClaritySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    // Serve cached data immediately while re-fetching
    try {
      const cached = sessionStorage.getItem(SESSION_KEY)
      if (cached) setData(JSON.parse(cached))
    } catch { /* ignore */ }

    fetchClaritySummary()
      .then(d => {
        setData(d)
        setError(null)
        try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(d)) } catch { /* ignore */ }
      })
      .catch(e => {
        setError(e.message)
        console.error('[useClarity]', e)
      })
      .finally(() => setLoading(false))
  }, [])

  return { data, loading, error }
}
