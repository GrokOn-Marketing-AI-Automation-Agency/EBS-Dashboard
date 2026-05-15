import { useState, useEffect, useCallback } from 'react'
import { ga4Service, type GA4Summary } from '../services/ga4'

type State = { data: GA4Summary | null; loading: boolean; error: string | null }

export function useGA4Summary(range?: string) {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null })

  const fetch = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const data = await ga4Service.summary(range)
      setState({ data, loading: false, error: data.error ?? null })
      // Persist for chat widget context
      try {
        sessionStorage.setItem('dash_ga4', JSON.stringify({
          sessions:    data.overview?.sessions,
          users:       data.overview?.users,
          pageViews:   data.overview?.pageViews,
          bounceRate:  data.overview?.bounceRate,
          avgDuration: data.overview?.avgSessionDuration,
        }))
      } catch {}
    } catch (e: any) {
      setState({ data: null, loading: false, error: e.message })
    }
  }, [range])

  useEffect(() => { fetch() }, [fetch])

  return { ...state, refetch: fetch }
}
