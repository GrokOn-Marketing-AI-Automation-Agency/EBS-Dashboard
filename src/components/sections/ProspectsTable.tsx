import { useDashboard } from '../../context/DashboardContext'
import { useAccuLynxSummary } from '../../hooks/useAccuLynx'
import { DataBadge } from '../ui/DataBadge'
import { fmt } from '../../utils/format'
import { Paginator, usePagination } from '../ui/Paginator'

const STAGE_COLORS: Record<string, string> = {
  'Prospect':       'bg-blue-50 text-blue-700',
  'Qualified':      'bg-indigo-50 text-indigo-700',
  'Proposal Sent':  'bg-amber-50 text-amber-700',
  'Negotiation':    'bg-orange-50 text-orange-700',
  'Closed Won':     'bg-green-50 text-green-700',
  'Closed Lost':    'bg-red-50 text-red-600',
}

function relativeTime(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}

export function ProspectsTable() {
  const { dateRange } = useDashboard()
  const { data, loading, error, refetch } = useAccuLynxSummary(dateRange)
  const prospects = data?.prospects ?? []
  const { page, setPage, paged, total, pageSize } = usePagination(prospects, 10)

  return (
    <section id="prospects" className="scroll-mt-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-gray-800 dark:text-slate-100 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600 text-white text-sm shrink-0">A</span>
            Recent Prospects
          </h2>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 ml-9">AccuLynx CRM · Latest leads &amp; job records</p>
        </div>
        <div className="flex items-center gap-2">
          {data && <DataBadge source={data.source} dataSource={data.dataSource} lastSync={data.lastSync} />}
          <button onClick={refetch} className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300 transition-colors">↻ Refresh</button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
        {loading && (
          <div className="animate-pulse divide-y divide-gray-50 dark:divide-slate-800">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-4 py-3 flex gap-4">
                <div className="h-3 bg-gray-100 dark:bg-slate-800 rounded w-32" />
                <div className="h-3 bg-gray-100 dark:bg-slate-800 rounded w-20" />
                <div className="h-3 bg-gray-100 dark:bg-slate-800 rounded w-24" />
                <div className="h-3 bg-gray-100 dark:bg-slate-800 rounded w-16 ml-auto" />
              </div>
            ))}
          </div>
        )}

        {error && !loading && (
          <div className="p-4 text-sm text-red-600">
            Failed to load prospects: {error}
            <button onClick={refetch} className="ml-2 underline">Retry</button>
          </div>
        )}

        {!loading && prospects.length > 0 && (
          <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[700px]">
            <thead className="bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-400 uppercase">
              <tr>
                <th className="text-left px-4 py-2.5">Name</th>
                <th className="text-left px-4 py-2.5">Location</th>
                <th className="text-left px-4 py-2.5">Source</th>
                <th className="text-left px-4 py-2.5">Stage</th>
                <th className="text-right px-4 py-2.5">Est. Value</th>
                <th className="text-left px-4 py-2.5">Assigned</th>
                <th className="text-right px-4 py-2.5">Last Activity</th>
                <th className="text-right px-4 py-2.5">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
              {paged.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                  <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-slate-100">{p.name}</td>
                  <td className="px-4 py-2.5 text-gray-500 dark:text-slate-400 text-xs">{p.address ?? '—'}</td>
                  <td className="px-4 py-2.5 text-gray-600 dark:text-slate-300">{p.source}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[p.stage] ?? 'bg-gray-100 text-gray-600'}`}>
                      {p.stage}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-800 dark:text-slate-100">
                    {p.value > 0 ? fmt.currency(p.value) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 dark:text-slate-300">{p.assignedTo}</td>
                  <td className="px-4 py-2.5 text-right text-gray-500 dark:text-slate-400">{relativeTime(p.lastActivity)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-500 dark:text-slate-400">{relativeTime(p.createdDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}

        {!loading && !error && prospects.length === 0 && (
          <div className="p-8 text-center text-gray-400 dark:text-slate-500 text-sm">No prospects found in AccuLynx.</div>
        )}
        <Paginator page={page} pageSize={pageSize} total={total} onChange={setPage} />
      </div>
    </section>
  )
}
