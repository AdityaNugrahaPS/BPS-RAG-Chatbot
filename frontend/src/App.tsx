import { useState, useEffect, useRef, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import PDFProcessor from './pages/PDFProcessor'
import Credentials from './pages/Credentials'
import CredentialDetail from './pages/CredentialDetail'
import type { ActiveJob, SavedCreds } from './types'

function FloatingJobBar({ job, onClickResume }: { job: ActiveJob; onClickResume: () => void }) {
  const isProcessing = job.phase === 'processing'
  const pct          = isProcessing ? (job.processProgress ?? 0) : (job.embedProgress ?? 0)
  const step         = isProcessing ? (job.processStep ?? 'Memproses…') : (job.embedStep ?? 'Embedding…')
  const isDone       = job.status === 'done'
  const isError      = job.status === 'error' || job.status === 'embed_error'

  const color = isDone ? '#32D74B' : isError ? '#FF453A' : '#0A84FF'
  const label = isDone ? '✓ Selesai' : isError ? '✗ Gagal' : step

  return (
    <div
      onClick={onClickResume}
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 cursor-pointer
                 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl
                 transition-all hover:scale-[1.02] active:scale-[0.98]"
      style={{ background: 'var(--elevated)', border: `1px solid ${color}40`, minWidth: 320, maxWidth: 480 }}
    >
      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: color + '18' }}>
        {isDone ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        ) : isError ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold text-white truncate">
            {isDone ? 'PDF berhasil diproses' : isError ? 'Proses gagal' : isProcessing ? 'Memproses PDF…' : 'Embedding ke Supabase…'}
          </p>
          <span className="text-xs ml-2 flex-shrink-0" style={{ color }}>{pct}%</span>
        </div>
        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: color }} />
        </div>
        <p className="text-2xs mt-1 truncate" style={{ color: 'var(--txt-4)' }}>
          {label} · {job.files?.length ?? 0} file · Klik untuk lihat detail
        </p>
      </div>
    </div>
  )
}

export default function App() {
  const [page,       setPage]       = useState<string>(() => localStorage.getItem('lastPage') || 'dashboard')
  const [detailId,   setDetailId]   = useState<string | null>(() => localStorage.getItem('lastDetailId') || null)
  const [savedCreds, setSavedCreds] = useState<SavedCreds>({})
  const [theme,      setTheme]      = useState<string>(() => localStorage.getItem('theme') || 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  const [activeJob,  setActiveJob]  = useState<ActiveJob | null>(null)
  const [pdfFiles,   setPdfFiles]   = useState<File[]>([])

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startPolling = useCallback((jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/status/${jobId}`)
        if (!r.ok) return
        const s = await r.json()
        setActiveJob(prev => ({
          ...prev!,
          status:          s.status,
          processProgress: s.process_progress ?? 0,
          processStep:     s.process_step ?? '',
          embedProgress:   s.embed_progress ?? 0,
          embedStep:       s.embed_step ?? '',
          files:           s.files ?? prev?.files ?? [],
        }))
        // Stop polling kalau sudah selesai/error
        if (['done', 'embed_error'].includes(s.status)) {
          clearInterval(pollRef.current!)
          pollRef.current = null
        }
      } catch {}
    }, 1500)
  }, [])

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }, [])

  useEffect(() => {
    fetch('/api/credentials/all')
      .then(r => r.ok ? r.json() : {})
      .then(data => setSavedCreds(data))
      .catch(() => {})
  }, [])

  function handleNavigate(target: string, param: string | null = null) {
    setPage(target)
    setDetailId(param)
    localStorage.setItem('lastPage', target)
    if (param) localStorage.setItem('lastDetailId', param)
    else localStorage.removeItem('lastDetailId')
  }

  function handleCredSaved({ credId, data }: { credId: string; data: unknown }) {
    setSavedCreds(prev => ({ ...prev, [credId]: data }))
  }

  useEffect(() => {
    (window as any).__navigateToCredentials = () => handleNavigate('credentials')
    return () => { delete (window as any).__navigateToCredentials }
  }, [])

  /* Tampilkan floating bar di semua halaman kecuali PDF Processor */
  const showFloating = activeJob && activeJob.jobId && page !== 'pdf-processor'

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      <Sidebar currentPage={page} onNavigate={handleNavigate} theme={theme} onToggleTheme={toggleTheme} />
      <main className="flex-1 overflow-y-auto">
        {page === 'dashboard'          && <Dashboard />}
        {page === 'pdf-processor'      && (
          <PDFProcessor
            activeJob={activeJob}
            setActiveJob={setActiveJob}
            startPolling={startPolling}
            stopPolling={stopPolling}
            pdfFiles={pdfFiles}
            setPdfFiles={setPdfFiles}
          />
        )}
        {page === 'credentials'        && (
          <Credentials
            savedData={savedCreds}
            onNavigate={handleNavigate}
          />
        )}
        {page === 'credential-detail'  && detailId && (
          <CredentialDetail
            credId={detailId}
            savedData={savedCreds}
            onBack={() => handleNavigate('credentials')}
            onSaved={handleCredSaved}
          />
        )}
      </main>

      {showFloating && (
        <FloatingJobBar
          job={activeJob}
          onClickResume={() => handleNavigate('pdf-processor')}
        />
      )}
    </div>
  )
}
