import { useState, useEffect, useCallback } from 'react'
import { ghlService, type GHLSummary } from '../services/ghl'
import { useDashboard } from '../context/DashboardContext'

export function useGHLSummary(range?: string) {
  const { activeClient } = useDashboard()
  const [data,    setData]    = useState<GHLSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await ghlService.summary(range, activeClient.id)
      setData(result)
      if (result.error) setError(result.error)
      // Persist summary for chat widget context
      try {
        const acxPipeline = result.pipelines?.find((p: any) => p.pipelineId === 'VSb1gZvTs03F7gFy31eX')
        sessionStorage.setItem('dash_ghl', JSON.stringify({
          totalContacts:    result.contacts?.total,
          newContacts:      result.contacts?.newInPeriod,
          leads:            result.contacts?.leads,
          customers:        result.contacts?.customers,
          totalOpps:        result.totalOpps,
          totalValue:       result.pipelines?.reduce((a: number, p: any) => a + p.totalValue, 0),
          conversations:    result.conversations?.total,
          unreadConversations: result.conversations?.unread,
          activeWorkflows:  result.workflows?.published,
          upcomingAppointments: result.appointments?.upcoming,
          acculynxOpps:     acxPipeline?.total,
          acculynxValue:    acxPipeline?.totalValue,
          acculynxStages:   acxPipeline?.stages?.map((s: any) => ({ stage: s.stageName, count: s.count, value: s.value })),
          pipelines:        result.pipelines?.map((p: any) => ({ name: p.pipelineName, opps: p.total, value: p.totalValue })),
          topContactSources: result.contacts?.bySource?.slice(0, 3).map((s: any) => ({ source: s.source, count: s.count })),
        }))
      } catch {}
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [range, activeClient.id])

  useEffect(() => { fetch() }, [fetch])

  return { data, loading, error, refetch: fetch }
}
