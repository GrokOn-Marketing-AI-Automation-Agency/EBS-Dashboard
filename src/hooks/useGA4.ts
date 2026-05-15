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
          newUsers:    data.overview?.newUsers,
          pageViews:   data.overview?.pageViews,
          bounceRate:  data.overview?.bounceRate,
          avgDuration: data.overview?.avgSessionDuration,
          conversions: data.overview?.conversions,
          topChannel:  data.channels?.[0]?.channel,
          topPage:     data.topPages?.[0]?.page,
          channels:    data.channels?.slice(0, 5).map((c: any) => ({ channel: c.channel, sessions: c.sessions })),
          topPages:    data.topPages?.slice(0, 5).map((p: any) => ({ page: p.page, views: p.pageViews, bounceRate: p.bounceRate })),
        }))
      } catch {}
    } catch (e: any) {
      setState({ data: null, loading: false, error: e.message })
    }
  }, [range])

  useEffect(() => { fetch() }, [fetch])

  return { ...state, refetch: fetch }
}
