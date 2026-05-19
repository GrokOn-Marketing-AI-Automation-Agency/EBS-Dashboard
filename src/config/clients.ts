/**
 * Client registry — add a new client here to make it available in the switcher.
 * Each client has a unique id, display name, branding, and which data sources
 * are active by default.
 *
 * API keys for each client are stored on the backend as:
 *   <CLIENT_ID_UPPERCASE>_<ENV_VAR_NAME>
 *   e.g.  ZELLER_ACCULYNX_API_KEY, ZELLER_GA4_PROPERTY_ID
 *
 * If no prefixed var is found the backend falls back to the unprefixed var
 * (which holds the EBS keys for backwards compatibility).
 */

export interface ClientConfig {
  id:          string
  name:        string
  shortName:   string
  industry:    string
  color:       string          // Tailwind bg colour for avatar
  textColor:   string          // Tailwind text colour for avatar
  live:        boolean         // false = no API keys yet → shows mock data
  sources: {
    acculynx:  boolean
    googleAds: boolean
    ga4:       boolean
    gsc:       boolean
    highlevel: boolean
    lsa:       boolean
    clarity:   boolean
  }
}

export const CLIENTS: ClientConfig[] = [
  {
    id:        'ebs',
    name:      'Exterior Building Solutions',
    shortName: 'EBS Roofing',
    industry:  'Roofing & Siding',
    color:     'bg-blue-600',
    textColor: 'text-white',
    live:      true,
    sources: {
      acculynx:  true,
      googleAds: true,
      ga4:       true,
      gsc:       true,
      highlevel: true,
      lsa:       true,
      clarity:   true,
    },
  },
  {
    id:        'zeller',
    name:      'Zeller Technologies',
    shortName: 'Zeller Tech',
    industry:  'Technology',
    color:     'bg-violet-600',
    textColor: 'text-white',
    live:      false,           // flip to true once API keys are added in Azure
    sources: {
      acculynx:  false,
      googleAds: true,
      ga4:       true,
      gsc:       true,
      highlevel: true,
      lsa:       false,
      clarity:   true,
    },
  },
]

export const DEFAULT_CLIENT_ID = 'ebs'

export function getClient(id: string): ClientConfig {
  return CLIENTS.find(c => c.id === id) ?? CLIENTS[0]
}
