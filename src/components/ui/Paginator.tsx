import { cn } from '../../utils/format'

interface PaginatorProps {
  page:       number          // 0-indexed current page
  pageSize:   number
  total:      number
  onChange:   (page: number) => void
  className?: string
}

export function Paginator({ page, pageSize, total, onChange, className }: PaginatorProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from       = total === 0 ? 0 : page * pageSize + 1
  const to         = Math.min((page + 1) * pageSize, total)

  if (total <= pageSize) return null   // no pagination needed

  // Build page number list with ellipsis
  const pages: (number | '…')[] = []
  if (totalPages <= 7) {
    for (let i = 0; i < totalPages; i++) pages.push(i)
  } else {
    pages.push(0)
    if (page > 2)           pages.push('…')
    for (let i = Math.max(1, page - 1); i <= Math.min(totalPages - 2, page + 1); i++) pages.push(i)
    if (page < totalPages - 3) pages.push('…')
    pages.push(totalPages - 1)
  }

  return (
    <div className={cn('flex items-center justify-between px-4 py-2.5 border-t border-gray-100 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-800/50', className)}>
      <span className="text-xs text-gray-400 dark:text-slate-500">
        {total === 0 ? 'No results' : `${from}–${to} of ${total.toLocaleString()}`}
      </span>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 0}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-xs text-gray-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          ‹
        </button>

        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} className="w-7 h-7 flex items-center justify-center text-xs text-gray-300 dark:text-slate-600">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p as number)}
              className={cn(
                'w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium transition-all',
                p === page
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm'
              )}
            >
              {(p as number) + 1}
            </button>
          )
        )}

        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages - 1}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-xs text-gray-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          ›
        </button>
      </div>
    </div>
  )
}

// ── Hook for easy local pagination state ─────────────────────────────────────
import { useState, useMemo } from 'react'

export function usePagination<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(0)

  // Reset to page 0 when items change (e.g. filter applied)
  const totalPages = Math.ceil(items.length / pageSize)
  const safePage   = Math.min(page, Math.max(0, totalPages - 1))

  const paged = useMemo(
    () => items.slice(safePage * pageSize, (safePage + 1) * pageSize),
    [items, safePage, pageSize]
  )

  return {
    page:     safePage,
    setPage,
    paged,
    total:    items.length,
    pageSize,
  }
}
