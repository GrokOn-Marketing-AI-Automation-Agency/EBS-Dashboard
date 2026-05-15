import { useState, useEffect, useCallback } from 'react'
import { googleAdsService, type GAdsSummary } from '../services/googleads'

type State = { data: GAdsSummary | null; loading: boolean; error: string | null }

export function useGoogleAdsSummary(range?: string) {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null })

  const fetch = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const data = await googleAdsService.summary(range)
      setState({ data, loading: false, error: data.error ?? null })
      // Persist for chat widget context
      try {
        const top = data.campaigns?.slice().sort((a: any, b: any) => b.spend - a.spend)[0]
        sessionStorage.setItem('dash_gads', JSON.stringify({
          spend:             data.totals?.spend,
          clicks:            data.totals?.clicks,
          impressions:       data.totals?.impressions,
          conversions:       data.totals?.conversions,
          ctr:               data.totals?.ctr,
          costPerConversion: data.totals?.costPerConversion,
          campaignCount:     data.campaigns?.length,
          topCampaign:       top?.name,
        }))
      } catch {}
    } catch (e: any) {
      setState({ data: null, loading: false, error: e.message })
    }
  }, [range])

  useEffect(() => { fetch() }, [fetch])

  return { ...state, refetch: fetch }
}
