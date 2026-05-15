import { useState, useEffect, useCallback } from 'react'
import { acculynxService, type AcxSummary, type AcxStatus } from '../services/acculynx'

type State<T> = { data: T | null; loading: boolean; error: string | null }

export function useAccuLynxSummary(range?: string) {
  const [state, setState] = useState<State<AcxSummary>>({ data: null, loading: true, error: null })

  const fetch = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const data = await acculynxService.summary(range)
      setState({ data, loading: false, error: data.error ?? null })
      // Persist summary for chat widget context
      try {
        const top = data.leadSources?.[0]
        sessionStorage.setItem('dash_acculynx', JSON.stringify({
          totalJobs:     data.totalJobs,
          pipelineValue: data.pipeline?.reduce((a: number, s: any) => a + s.value, 0),
          topSource:     top?.source,
          leadSources:   data.leadSources?.slice(0, 8),
        }))
      } catch {}
    } catch (e: any) {
      setState({ data: null, loading: false, error: e.message })
    }
  }, [range])

  useEffect(() => { fetch() }, [fetch])

  return { ...state, refetch: fetch }
}

export function useAccuLynxStatus() {
  const [status, setStatus] = useState<AcxStatus | null>(null)

  useEffect(() => {
    acculynxService.status().then(setStatus).catch(() => setStatus({ connected: false, reason: 'Server unreachable' }))
  }, [])

  return status
}
