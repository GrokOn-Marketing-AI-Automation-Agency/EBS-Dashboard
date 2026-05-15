import { useState, useEffect, useCallback } from 'react'
import { gscService, type GSCSummary } from '../services/gsc'

type State = { data: GSCSummary | null; loading: boolean; error: string | null }

export function useGSCSummary(range?: string) {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null })

  const fetch = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const data = await gscService.summary(range)
      setState({ data, loading: false, error: data.error ?? null })
      // Persist for chat widget context
      try {
        sessionStorage.setItem('dash_gsc', JSON.stringify({
          clicks:      data.overview?.clicks,
          impressions: data.overview?.impressions,
          ctr:         data.overview?.ctr,
          position:    data.overview?.position,
          topQuery:    data.topQueries?.[0]?.query,
          topQueryClicks: data.topQueries?.[0]?.clicks,
          topQueryPosition: data.topQueries?.[0]?.position,
          topQueries:  data.topQueries?.slice(0, 5).map((q: any) => ({ query: q.query, clicks: q.clicks, impressions: q.impressions, ctr: q.ctr, position: q.position })),
          topPages:    data.topPages?.slice(0, 5).map((p: any) => ({ page: p.page, clicks: p.clicks, impressions: p.impressions })),
          lastSync:    new Date().toISOString(),
        }))
      } catch {}
    } catch (e: any) {
      setState({ data: null, loading: false, error: e.message })
    }
  }, [range])

  useEffect(() => { fetch() }, [fetch])

  return { ...state, refetch: fetch }
}
