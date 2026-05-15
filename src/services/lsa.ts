const BASE = 'http://localhost:3001'

export interface LSALead {
  id:       string
  type:     'PHONE_CALL' | 'MESSAGE'
  status:   'NEW' | 'ACTIVE' | 'DECLINED' | 'BOOKED' | 'WIPED_OUT'
  category: string
  service:  string
  date:     string
  charged:  boolean
}

export interface LSACategoryBreakdown {
  category: string
  total:    number
  charged:  number
  calls:    number
  messages: number
}

export interface LSASummary {
  source:        'live' | 'mock' | 'error'
  period:        string
  spend:         number
  impressions:   number
  clicks:        number
  conversions:   number
  totalLeads:    number
  chargedLeads:  number
  newLeads:      number
  activeLeads:   number
  declinedLeads: number
  phoneCalls:    number
  messages:      number
  categories:    LSACategoryBreakdown[]
  recentLeads:   LSALead[]
  lastSync:      string
}

export async function fetchLSASummary(range: string): Promise<LSASummary> {
  const res = await fetch(`${BASE}/api/lsa/summary?range=${range}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
