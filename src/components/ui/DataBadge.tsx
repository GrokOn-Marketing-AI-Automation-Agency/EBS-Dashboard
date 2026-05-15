interface Props {
  source:      'live' | 'mock'
  dataSource?: 'report' | 'jobs'
  lastSync?:   string
}

export function DataBadge({ source, dataSource, lastSync }: Props) {
  const label = source === 'live'
    ? dataSource === 'report' ? 'Live · Report CSV' : 'Live · AccuLynx'
    : 'Mock data'

  const title = [
    lastSync ? `Last synced: ${new Date(lastSync).toLocaleString()}` : null,
    dataSource === 'report' ? 'Data from scheduled report CSV (richest)' : null,
    dataSource === 'jobs'   ? 'Data from AccuLynx jobs API (live but limited lead-source data)' : null,
  ].filter(Boolean).join('\n') || undefined

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full cursor-help ${
        source === 'live'
          ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
          : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${source === 'live' ? 'bg-green-500' : 'bg-amber-400'}`} />
      {label}
    </span>
  )
}
