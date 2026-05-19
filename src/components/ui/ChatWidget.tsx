import { useState, useRef, useEffect } from 'react'
import { useDashboard } from '../../context/DashboardContext'
import { cn } from '../../utils/format'
import gromaapLogo from '../../assets/gromaap-logo.png'
import { API_BASE } from '../../utils/apiBase'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTED = [
  'What\'s my best performing campaign?',
  'How much did I spend on ads this period?',
  'Which lead source has the highest close rate?',
  'How many opportunities are in the pipeline?',
  'What are my top organic search keywords?',
  'How is my organic search performance?',
  'What\'s my website bounce rate?',
  'Give me a full marketing summary',
]

export function ChatWidget() {
  const { dateRange } = useDashboard()
  const [open, setOpen]         = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  function buildContext() {
    try {
      const gads     = JSON.parse(sessionStorage.getItem('dash_gads')     ?? 'null')
      const acculynx = JSON.parse(sessionStorage.getItem('dash_acculynx') ?? 'null')
      const ghl      = JSON.parse(sessionStorage.getItem('dash_ghl')      ?? 'null')
      const ga4      = JSON.parse(sessionStorage.getItem('dash_ga4')      ?? 'null')
      const gsc      = JSON.parse(sessionStorage.getItem('dash_gsc')      ?? 'null')
      const lsa      = JSON.parse(sessionStorage.getItem('dash_lsa')      ?? 'null')
      const clarityRaw = JSON.parse(sessionStorage.getItem('dash_clarity') ?? 'null')
      const clarity = clarityRaw
        ? { projectId: 'ko3ifc8c96', connected: true, ...clarityRaw }
        : { projectId: 'ko3ifc8c96', connected: true }
      return { gads, acculynx, ghl, ga4, gsc, lsa, clarity, gadsRange: dateRange, ga4Range: dateRange }
    } catch {
      return {}
    }
  }

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || loading) return
    setInput('')

    const userMsg: Message = { role: 'user', content }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updated, context: buildContext() }),
      })
      const data = await res.json()
      setMessages(m => [...m, { role: 'assistant', content: data.reply ?? data.error ?? 'No response.' }])
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: '⚠ Could not reach the server. Make sure it\'s running.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* ── Floating launcher button ── */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Ask GROMAAP Assistant"
        className={cn(
          'fixed bottom-5 right-5 z-50 flex items-center gap-2 pl-2.5 pr-4 py-2 rounded-full shadow-xl transition-all duration-200',
          open
            ? 'bg-slate-800 scale-95'
            : 'bg-slate-900 hover:bg-slate-800 scale-100 hover:shadow-2xl'
        )}
      >
        <img src={gromaapLogo} alt="GROMAAP" className="h-6 w-auto" />
        <span className="text-xs font-semibold text-white tracking-wide">
          {open ? 'Close' : 'Ask GROMAAP'}
        </span>
      </button>

      {/* ── Chat panel ── */}
      {open && (
        <div className="fixed bottom-20 right-5 z-50 w-[370px] max-h-[580px] flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-slate-700">

          {/* Header */}
          <div className="bg-slate-900 px-4 py-3 flex items-center gap-3 shrink-0 border-b border-slate-700">
            <img src={gromaapLogo} alt="GROMAAP" className="h-7 w-auto" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white leading-tight">GROMAAP Assistant</p>
              <p className="text-[10px] text-slate-400">Powered by live dashboard data</p>
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors shrink-0"
              >
                Clear
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="text-slate-500 hover:text-white transition-colors text-sm shrink-0 ml-1"
            >
              ✕
            </button>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0 bg-slate-950">

            {/* Empty state with suggested questions */}
            {messages.length === 0 && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <img src={gromaapLogo} alt="GROMAAP" className="h-8 w-auto opacity-40" />
                </div>
                <p className="text-xs text-slate-500 text-center">
                  Ask me anything about your campaigns, leads, pipeline, or traffic.
                </p>
                <div className="space-y-1.5 mt-3">
                  {SUGGESTED.map(s => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="w-full text-left text-xs px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700 hover:border-slate-500"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message bubbles */}
            {messages.map((m, i) => (
              <div key={i} className={cn('flex items-end gap-2', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                {m.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 mb-0.5 overflow-hidden">
                    <img src={gromaapLogo} alt="G" className="w-5 h-auto" />
                  </div>
                )}
                <div className={cn(
                  'max-w-[80%] px-3 py-2 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap',
                  m.role === 'user'
                    ? 'bg-[#007BFF] text-white rounded-br-sm'
                    : 'bg-slate-800 text-slate-200 rounded-bl-sm border border-slate-700'
                )}>
                  {m.content}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex items-end gap-2 justify-start">
                <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 overflow-hidden">
                  <img src={gromaapLogo} alt="G" className="w-5 h-auto" />
                </div>
                <div className="bg-slate-800 border border-slate-700 px-3 py-2.5 rounded-2xl rounded-bl-sm">
                  <span className="flex gap-1 items-center">
                    {[0, 1, 2].map(i => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div className="px-3 py-2.5 border-t border-slate-700 bg-slate-900 shrink-0">
            <div className="flex gap-2 items-center">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                placeholder="Ask about your data…"
                className="flex-1 text-xs px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-500 transition-colors"
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || loading}
                className="w-8 h-8 rounded-xl bg-[#007BFF] hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors shrink-0"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
            <p className="text-[9px] text-slate-600 text-center mt-1.5">GROMAAP · Powered by EBS Dashboard</p>
          </div>
        </div>
      )}
    </>
  )
}
