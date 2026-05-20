import { useState } from 'react'
import { useDashboard } from '../../context/DashboardContext'
import type { DateRange } from '../../types'
import { cn } from '../../utils/format'

export function Header() {
  const { dateRange, syncState, setDateRange, triggerSync, sidebarOpen, setSidebarOpen } = useDashboard()
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])

      const main = document.querySelector('main') as HTMLElement
      if (!main) return

      // ── 1. Force light mode for the capture ──────────────────────────────
      const html    = document.documentElement
      const wasDark = html.classList.contains('dark')
      if (wasDark) html.classList.remove('dark')

      // ── 2. Expand scroll container so all content is visible ─────────────
      const prevOverflow = main.style.overflow
      const prevMaxH     = main.style.maxHeight
      const prevH        = main.style.height
      main.style.overflow  = 'visible'
      main.style.maxHeight = 'none'
      main.style.height    = 'auto'

      // ── 3. Wait until all loading skeletons/spinners have disappeared ────
      // Polls every 300ms; gives up after 15s and captures whatever is ready
      await new Promise<void>(resolve => {
        const maxWait = Date.now() + 15_000
        const check = () => {
          const stillLoading =
            document.querySelectorAll('.animate-pulse, [data-loading="true"]').length > 0
          if (!stillLoading || Date.now() > maxWait) {
            // Extra 600ms for chart animations to finish painting
            setTimeout(resolve, 600)
          } else {
            setTimeout(check, 300)
          }
        }
        check()
      })

      // ── 4. Capture full expanded content ──────────────────────────────────
      const canvas = await html2canvas(main, {
        scale:           1.2,
        useCORS:         true,
        allowTaint:      true,
        backgroundColor: '#F5F6F7',
        logging:         false,
      })

      // ── 5. Restore styles & dark mode ─────────────────────────────────────
      main.style.overflow  = prevOverflow
      main.style.maxHeight = prevMaxH
      main.style.height    = prevH
      if (wasDark) html.classList.add('dark')

      // ── 6. Build PDF — full image offset per A4 page ──────────────────────
      const pdf    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW  = pdf.internal.pageSize.getWidth()   // 210mm
      const pageH  = pdf.internal.pageSize.getHeight()  // 297mm
      const margin = 8
      const contentH = pageH - margin * 2               // usable height per page

      const imgW    = pageW - margin * 2
      const imgH    = (canvas.height / canvas.width) * imgW   // total image height in mm
      const numPages = Math.ceil(imgH / contentH)

      // Convert once to JPEG (far smaller than PNG)
      const imgData = canvas.toDataURL('image/jpeg', 0.88)

      const dateLabel = dateRange === '7d' ? 'Last 7 Days' : dateRange === '30d' ? 'Last 30 Days' : 'Last 90 Days'

      for (let i = 0; i < numPages; i++) {
        if (i > 0) pdf.addPage()

        // Small page header
        pdf.setFontSize(7.5)
        pdf.setTextColor(150)
        pdf.text(
          `EBS Marketing Dashboard  ·  ${dateLabel}  ·  ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}  ·  Page ${i + 1} of ${numPages}`,
          margin, 5.5,
        )

        // Offset the full image so the correct slice lands in the visible area
        const yOffset = margin + 1 - i * contentH
        pdf.addImage(imgData, 'JPEG', margin, yOffset, imgW, imgH)
      }

      pdf.save(`EBS-Dashboard-${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (e) {
      console.error('PDF export failed:', e)
      alert('PDF export failed — try again.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-4 py-3 flex items-center gap-3 shrink-0 flex-wrap">
      {/* Hamburger — mobile only */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors shrink-0"
        aria-label="Open menu"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">Marketing Performance Dashboard</h1>
        <p className="text-xs text-gray-400 dark:text-slate-500 hidden sm:block">
          Exterior Building Solutions ·{' '}
          {syncState.status === 'syncing'
            ? <span className="text-blue-500 animate-pulse">Syncing all sources…</span>
            : syncState.status === 'done'
            ? <span className="text-green-600">✓ Synced · {syncState.lastSync}</span>
            : `Last updated ${syncState.lastSync}`}
        </p>
      </div>

      {/* Date Range */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-400 dark:text-slate-500 font-medium hidden sm:inline">Period:</span>
        {(['7d', '30d', '90d'] as DateRange[]).map(r => (
          <button
            key={r}
            onClick={() => setDateRange(r)}
            className={cn(
              'px-2 py-1.5 rounded-lg text-xs font-medium transition-colors',
              dateRange === r ? 'bg-[#007BFF] text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
            )}
          >
            {r === '7d' ? '7D' : r === '30d' ? '30D' : '90D'}
          </button>
        ))}
      </div>

      {/* Action buttons */}
      <button
        onClick={handleExport}
        disabled={exporting}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
      >
        {exporting
          ? <><span className="animate-spin inline-block">⟳</span> <span className="hidden sm:inline">Generating…</span></>
          : <><span>↓</span><span className="hidden sm:inline"> Export PDF</span></>
        }
      </button>

      <button
        onClick={triggerSync}
        disabled={syncState.status === 'syncing'}
        className={cn(
          'flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
          syncState.status === 'syncing'
            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-400 cursor-not-allowed'
            : 'bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300'
        )}
      >
        <span className={cn(syncState.status === 'syncing' && 'animate-spin inline-block')}>⟳</span>
        <span className="hidden sm:inline">{syncState.status === 'syncing' ? 'Syncing…' : 'Sync All'}</span>
      </button>
    </header>
  )
}
