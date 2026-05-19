/**
 * GoHighLevel Service
 * Fetches from the local Bun proxy server (/api/ghl/*).
 */

export interface GHLPipelineStageSummary {
  stageId:   string
  stageName: string
  count:     number
  value:     number
}

export interface GHLPipelineSummary {
  pipelineId:   string
  pipelineName: string
  total:        number
  totalValue:   number
  stages:       GHLPipelineStageSummary[]
}

export interface GHLContactStats {
  total:       number
  newInPeriod: number
  leads:       number
  customers:   number
  bySource:    { source: string; count: number }[]
}

export interface GHLConversationStats {
  total:          number
  unread:         number
  bySmsCall:      number
  byEmail:        number
  recentContacts: { name: string; lastMessage: string; type: string; date: number }[]
}

export interface GHLWorkflowSummary {
  total:     number
  published: number
  draft:     number
  workflows: { id: string; name: string; status: string; updatedAt: string }[]
}

export interface GHLAppointmentSummary {
  upcoming:     number
  appointments: { title: string; startTime: string; status: string; calendarId: string }[]
}

export interface GHLSummary {
  source:        'live' | 'mock'
  lastSync:      string
  locationName:  string
  totalOpps:     number
  totalCalls:    number
  contacts:      GHLContactStats
  pipelines:     GHLPipelineSummary[]
  conversations: GHLConversationStats
  workflows:     GHLWorkflowSummary
  appointments:  GHLAppointmentSummary
  error?:        string
}

import { API_BASE } from '../utils/apiBase'
const BASE = `${API_BASE}/api/ghl`

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`GHL API ${path} → ${res.status}`)
  return res.json() as Promise<T>
}

export const ghlService = {
  summary: (range?: string) => get<GHLSummary>(`/summary${range ? `?range=${range}` : ''}`),
}
