import './index.css'
import { DashboardProvider, useDashboard } from './context/DashboardContext'
import { useAccuLynxStatus } from './hooks/useAccuLynx'
import { Header } from './components/layout/Header'
import { Sidebar } from './components/layout/Sidebar'
import { UnifiedMetrics } from './components/sections/UnifiedMetrics'
import { SourceComparison } from './components/sections/SourceComparison'
import { LeadSourceBreakdown } from './components/sections/LeadSourceBreakdown'
import { PipelineFunnel } from './components/sections/PipelineFunnel'
import { ProspectsTable } from './components/sections/ProspectsTable'
import { TrafficEngagement } from './components/sections/TrafficEngagement'
import { CallTracking } from './components/sections/CallTracking'
import { DiscrepancyAlerts } from './components/sections/DiscrepancyAlerts'
import { AttributionGaps } from './components/sections/AttributionGaps'
import { ROIAttribution } from './components/sections/ROIAttribution'
import { GoHighLevel } from './components/sections/GoHighLevel'
import { DataQuality } from './components/sections/DataQuality'
import { ChatWidget } from './components/ui/ChatWidget'

function AccuLynxBanner() {
  const status = useAccuLynxStatus()
  if (!status) return null
  if (status.connected) return null
  return (
    <div className="mx-5 mt-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
      <span>⚠</span>
      <span>
        <strong>AccuLynx running in mock mode</strong> — {status.reason}.{' '}
        Add <code className="bg-amber-100 px-1 rounded">ACCULYNX_API_KEY</code> to <code className="bg-amber-100 px-1 rounded">.env</code> to connect live data.
      </span>
    </div>
  )
}

function Dashboard() {
  const { sources } = useDashboard()
  const anyCrmActive    = sources.acculynx || sources.highlevel
  const anyPaidActive   = sources.googleAds || sources.lsa
  const anyTrafficActive = sources.ga4 || sources.gsc || sources.clarity

  return (
    <div className="flex h-screen overflow-hidden bg-[#F5F6F7] dark:bg-slate-950">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <AccuLynxBanner />
        <main className="flex-1 overflow-y-auto p-5 space-y-7">

          <UnifiedMetrics />
          <DiscrepancyAlerts />

          {sources.acculynx
            ? <AttributionGaps />
            : <DisabledSection id="attribution-gaps" label="Google Ads Attribution Gaps" reason="Enable AccuLynx CRM in the sidebar" />}

          {anyCrmActive
            ? <SourceComparison />
            : <DisabledSection id="comparison" label="Cross-Platform Comparison" reason="Enable AccuLynx or GROMAAP in the sidebar" />}

          {sources.acculynx
            ? <LeadSourceBreakdown />
            : <DisabledSection id="leads" label="Lead Source Breakdown" reason="Enable AccuLynx CRM in the sidebar" />}

          {sources.acculynx
            ? <PipelineFunnel />
            : <DisabledSection id="pipeline" label="Pipeline & Sales Funnel" reason="Enable AccuLynx CRM in the sidebar" />}

          {sources.acculynx
            ? <ProspectsTable />
            : <DisabledSection id="prospects" label="Recent Prospects" reason="Enable AccuLynx CRM in the sidebar" />}

          {anyTrafficActive
            ? <TrafficEngagement />
            : <DisabledSection id="traffic" label="Traffic & Engagement" reason="Enable GA4, Search Console, or Clarity in the sidebar" />}

          <CallTracking />

          {anyPaidActive
            ? <ROIAttribution />
            : <DisabledSection id="roi" label="ROI & Attribution" reason="Enable Google Ads or Local Service Ads in the sidebar" />}

          {sources.highlevel
            ? <GoHighLevel />
            : <DisabledSection id="ghl" label="GROMAAP" reason="Enable GROMAAP in the sidebar" />}

          <DataQuality />

          <p className="text-center text-xs text-gray-400 dark:text-slate-500 pb-4">
            Grokon · EBS Dashboard · AccuLynx data is live when API key is set · Other sources connect via Supabase/n8n
          </p>
        </main>
      </div>
      <ChatWidget />
    </div>
  )
}

function DisabledSection({ id, label, reason }: { id: string; label: string; reason: string }) {
  return (
    <section id={id} className="scroll-mt-4">
      <div className="bg-white dark:bg-slate-900 border border-dashed border-gray-200 dark:border-slate-700 rounded-xl p-6 text-center text-gray-400 dark:text-slate-500">
        <p className="text-sm font-semibold text-gray-500 dark:text-slate-400 mb-1">{label}</p>
        <p className="text-xs">{reason}</p>
      </div>
    </section>
  )
}

export default function App() {
  return (
    <DashboardProvider>
      <Dashboard />
    </DashboardProvider>
  )
}
