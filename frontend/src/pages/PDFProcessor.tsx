import { useState, useEffect, useRef } from 'react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Stepper from '../components/ui/Stepper'
import UploadArea from '../components/ui/UploadArea'
import Alert from '../components/ui/Alert'
import type { ActiveJob, ProcessConfig, RuntimeCreds, Step } from '../types'

const API = '/api'

function friendlyError(msg = '') {
  const m = msg.toLowerCase()

  if (m.includes('429') || m.includes('quota') || m.includes('rate limit') || m.includes('exceeded'))
    return '⚠️ Batas penggunaan API Gemini hari ini sudah habis. Tunggu beberapa saat atau ganti API key di halaman Credentials.'

  if (m.includes('401') || m.includes('403') || m.includes('api key') || m.includes('unauthorized') || m.includes('invalid') && m.includes('key'))
    return '🔑 API key tidak valid atau tidak punya akses. Cek kembali API key di halaman Credentials → AI Models.'

  if (m.includes('404') || m.includes('not found') || m.includes('not supported'))
    return '❌ Model AI tidak ditemukan. Hubungi admin untuk memperbarui model di Credentials → AI Models.'

  if (m.includes('timeout') || m.includes('timed out'))
    return '⏱️ Permintaan ke server AI terlalu lama. Coba lagi, atau periksa koneksi internet.'

  if (m.includes('econnrefused') || m.includes('connection refused') || m.includes('network'))
    return '🔌 Tidak bisa terhubung ke server. Pastikan koneksi internet aktif.'

  if (m.includes('supabase') || m.includes('database') || m.includes('insert'))
    return '🗄️ Gagal menyimpan ke database. Pastikan Supabase sedang berjalan dan credentials sudah benar.'

  if (m.includes('500') || m.includes('server error') || m.includes('internal'))
    return '🛠️ Server AI sedang bermasalah. Coba beberapa saat lagi.'

  if (m.includes('pdf') || m.includes('file') || m.includes('corrupt'))
    return '📄 File PDF tidak bisa dibaca. Pastikan file tidak rusak dan coba upload ulang.'

  // fallback — tetap tampilkan tapi lebih ringkas
  return `❌ Terjadi kesalahan: ${msg.slice(0, 120)}${msg.length > 120 ? '…' : ''}`
}

const STEPS: Step[] = [
  { id: 'upload',    title: 'Upload PDF'  },
  { id: 'configure', title: 'Konfigurasi' },
  { id: 'process',   title: 'Proses'      },
  { id: 'embed',     title: 'Embed'       },
]

const ArrowRight = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7h8M8 4l3 3-3 3"/>
  </svg>
)
const ArrowLeft = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 7H3M6 4L3 7l3 3"/>
  </svg>
)
const RefreshIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 7a6 6 0 1 0 1.1-3.4M1 2v2.6H3.6"/>
  </svg>
)

interface ToggleProps { on: boolean; onChange: () => void }
function Toggle({ on, onChange }: ToggleProps) {
  return (
    <button onClick={onChange} style={{
      width: 40, height: 24, borderRadius: 12,
      background: on ? '#0A84FF' : 'var(--fill-5)',
      border: on ? 'none' : '1px solid var(--bdr-5)',
      position: 'relative', flexShrink: 0, transition: 'background 0.2s',
    }}>
      <span style={{
        position: 'absolute', top: 3,
        left: on ? 19 : 3,
        width: 18, height: 18, borderRadius: 9,
        background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
        transition: 'left 0.2s',
      }} />
    </button>
  )
}

interface SliderRowProps {
  label: string; hint: string; min: number; max: number
  step: number; value: number; onChange: (v: number) => void; display?: string
}
function SliderRow({ label, hint, min, max, step, value, onChange, display }: SliderRowProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-t1">{label}</p>
          <p className="text-xs text-t4 mt-0.5">{hint}</p>
        </div>
        <div className="rounded-lg px-3 py-1.5" style={{ background: 'rgba(10,132,255,0.08)', border: '1px solid rgba(10,132,255,0.15)' }}>
          <span className="text-sm font-mono font-semibold text-accent">{display ?? value.toLocaleString()}</span>
        </div>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseInt(e.target.value))} className="w-full" />
      <div className="flex justify-between text-xs text-t5">
        <span>{min}</span><span>{max}</span>
      </div>
    </div>
  )
}

interface ProgressBarProps { pct: number; done: boolean; indeterminate?: boolean }
function ProgressBar({ pct, done, indeterminate }: ProgressBarProps) {
  if (indeterminate) {
    return (
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--fill-4)' }}>
        <div className="h-full rounded-full w-1/3" style={{
          background: '#0A84FF',
          animation: 'indeterminate 1.4s ease-in-out infinite',
        }} />
        <style>{`@keyframes indeterminate { 0%{transform:translateX(-100%)} 100%{transform:translateX(400%)} }`}</style>
      </div>
    )
  }
  return (
    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--fill-4)' }}>
      <div className="h-full rounded-full transition-all duration-300"
        style={{ width: `${pct}%`, background: done ? '#32D74B' : '#0A84FF' }} />
    </div>
  )
}

interface StepUploadProps {
  files: File[]; setFiles: (f: File[]) => void; onNext: () => void
  uploading: boolean; error: string; onUploadJson: (f: File) => void
  jsonUploading: boolean; jsonError: string
}
function StepUpload({ files, setFiles, onNext, uploading, error, onUploadJson, jsonUploading, jsonError }: StepUploadProps) {
  const jsonRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h2 className="text-xl font-bold text-t1 tracking-tight">Upload File PDF</h2>
        <p className="text-sm text-t2 mt-1.5">Upload publikasi BPS untuk diproses menjadi knowledge base chatbot</p>
      </div>

      <UploadArea files={files} onFilesChange={setFiles} />

      {files.length > 0 && (
        <Alert variant="success" title={`${files.length} file dipilih`}>
          File siap diupload. Lanjutkan ke konfigurasi.
        </Alert>
      )}

      {error && <Alert variant="error" title="Upload gagal">{error}</Alert>}

      <div className="flex justify-end pt-2">
        <Button variant="primary" size="lg" disabled={files.length === 0} loading={uploading} onClick={onNext}>
          Lanjut ke Konfigurasi <ArrowRight />
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px" style={{ background: 'var(--bdr-3)' }} />
        <span className="text-xs text-t5">atau</span>
        <div className="flex-1 h-px" style={{ background: 'var(--bdr-3)' }} />
      </div>

      <div className="rounded-2xl p-4 space-y-3" style={{ border: '1px dashed var(--bdr-4)' }}>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,159,10,0.1)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF9F0A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-t1">Upload JSON (lewati proses)</p>
            <p className="text-xs text-t3 mt-0.5">Punya file .json dari Download Chunks sebelumnya? Upload langsung ke tahap Embed.</p>
          </div>
        </div>
        {jsonError && <Alert variant="error">{jsonError}</Alert>}
        <input ref={jsonRef} type="file" accept=".json" className="hidden"
          onChange={e => { if (e.target.files?.[0]) onUploadJson(e.target.files[0]); e.target.value = '' }} />
        <Button variant="ghost" size="sm" loading={jsonUploading} onClick={() => jsonRef.current?.click()}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Pilih file .json
        </Button>
      </div>
    </div>
  )
}

interface StepConfigureProps {
  config: ProcessConfig; setConfig: React.Dispatch<React.SetStateAction<ProcessConfig>>
  creds: RuntimeCreds; onNext: () => void; onBack: () => void; onGoCredentials: () => void
}
function StepConfigure({ config, setConfig, creds, onNext, onBack, onGoCredentials }: StepConfigureProps) {
  const set = (key: keyof ProcessConfig) => (val: any) => setConfig(c => ({ ...c, [key]: val }))

  const aiList      = creds.ai_list ?? []
  const hasGeminiKey = !!(creds.gemini_key)
  const canNext      = !config.useAI || hasGeminiKey

  function handleSelectAI(id: string) {
    const m = aiList.find(x => x.id === id)
    if (m) setConfig(c => ({ ...c, selectedAIId: id, _aiKey: m.api_key, _aiModel: m.model }))
  }

  return (
    <div className="space-y-5 animate-slide-up">
      <div>
        <h2 className="text-xl font-bold text-t1 tracking-tight">Konfigurasi Pemrosesan</h2>
        <p className="text-sm text-t2 mt-1.5">Atur cara PDF dipotong sebelum disimpan ke vector database</p>
      </div>

      <Card>
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(10,132,255,0.1)' }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#0A84FF"
              strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="14" height="8" rx="2"/>
              <path d="M6 5V3.5M12 5V3.5M6 13v1.5M12 13v1.5M2 9h16"/>
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-t1">Gunakan AI untuk Tabel</p>
            <p className="text-xs text-t3 mt-0.5">Konversi tabel PDF jadi narasi. Lebih akurat, lebih lambat.</p>
          </div>
          <Toggle on={config.useAI} onChange={() => set('useAI')(!config.useAI)} />
        </div>

        {config.useAI && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--bdr-3)' }}>
            {!hasGeminiKey ? (
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl"
                style={{ background: 'rgba(255,69,58,0.06)', border: '1px solid rgba(255,69,58,0.15)' }}>
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF453A" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <p className="text-xs text-[#FF453A]">Belum ada model AI di Credentials.</p>
                </div>
                <button onClick={onGoCredentials}
                  className="text-xs font-semibold text-accent hover:underline flex-shrink-0">
                  Atur →
                </button>
              </div>
            ) : aiList.length > 1 ? (
              <div className="space-y-2">
                <p className="text-xs text-t3">Pilih model AI:</p>
                <div className="relative">
                  <select
                    value={config.selectedAIId ?? aiList[0]?.id ?? ''}
                    onChange={e => handleSelectAI(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-sm text-t1 outline-none appearance-none pr-8"
                    style={{ background: 'var(--elevated)', border: '1px solid var(--bdr-4)' }}>
                    {aiList.map(m => (
                      <option key={m.id} value={m.id}>{m.name} {m.model ? `· ${m.model}` : ''}</option>
                    ))}
                  </select>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#52525B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-xl"
                style={{ background: 'rgba(50,215,75,0.06)', border: '1px solid rgba(50,215,75,0.15)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#32D74B" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <p className="text-xs text-[#32D74B]">
                  {aiList[0]?.name || 'AI'} · {aiList[0]?.model || 'model tidak diset'}
                </p>
              </div>
            )}
            {config.useAI && hasGeminiKey && (
              <div className="mt-3">
                <Alert variant="warning">Mode AI aktif — proses lebih lambat untuk PDF &gt;50 halaman.</Alert>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card>
        <SliderRow label="Ukuran Potongan Teks" hint="Karakter per chunk · Rekomendasi: 1000–2000"
          min={100} max={5000} step={50} value={config.chunkSize} onChange={set('chunkSize')}
          display={`${config.chunkSize.toLocaleString()} chars · ≈${Math.round(config.chunkSize / 5)} kata`} />
      </Card>

      <Card>
        <SliderRow label="Tumpang Tindih Antar Chunk" hint="Karakter yang diulang di awal chunk berikutnya · Rekomendasi: 100–250"
          min={0} max={1000} step={10} value={config.overlap} onChange={set('overlap')}
          display={`${config.overlap} chars · ≈${Math.round(config.overlap / 5)} kata`} />
      </Card>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack}><ArrowLeft /> Kembali</Button>
        <Button variant="primary" size="lg" onClick={onNext} disabled={!canNext}>
          Mulai Proses <ArrowRight />
        </Button>
      </div>
    </div>
  )
}

interface StepProcessProps {
  jobId: string | null; files: File[]; config: ProcessConfig; creds: RuntimeCreds
  onNext: () => void; onBack: () => void; onJobUpdate: (s: any) => void
  activeJob: ActiveJob | null; setActiveJob: (j: ActiveJob | null) => void
  startPolling: (id: string) => void; stopPolling: () => void; onCancel: () => void
}
function StepProcess({ jobId, files, config, creds, onNext, onBack, onJobUpdate, activeJob, setActiveJob, startPolling, stopPolling, onCancel }: StepProcessProps) {
  const [state,   setState]   = useState<'idle'|'running'|'done'|'error'>('idle')
  const [pct,     setPct]     = useState(0)
  const [step,    setStep]    = useState('')
  const [results, setResults] = useState<any[]>([])
  const [errMsg,  setErrMsg]  = useState('')
  const [confirm, setConfirm] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }

  const handleCancel = () => {
    stopPoll()
    stopPolling()
    setActiveJob(null)
    onCancel()
  }

  const doLocalPoll = (jid: string) => {
    pollRef.current = setInterval(async () => {
      const s = await fetch(`${API}/status/${jid}`).then(r => r.json())
      setPct(s.process_progress ?? 0)
      setStep(s.process_step ?? '')
      setResults(s.process_results ?? [])
      if (s.status === 'processed') {
        stopPoll(); setState('done'); setPct(100)
        onJobUpdate(s)
      } else if (s.status === 'error') {
        stopPoll(); setState('error'); setErrMsg('Terjadi error saat proses')
      }
    }, 800)
  }

  // Restore state kalau kembali ke halaman saat job masih berjalan
  useEffect(() => {
    if (!activeJob?.jobId) return
    if (activeJob.status === 'processed') {
      setState('done'); setPct(100)
    } else if (activeJob.phase === 'processing' &&
               !['processed','error','done','embed_error'].includes(activeJob.status)) {
      setState('running')
      setPct(activeJob.processProgress ?? 0)
      setStep(activeJob.processStep ?? '')
      doLocalPoll(activeJob.jobId)
    }
  }, []) // eslint-disable-line

  const startProcess = async () => {
    setState('running'); setPct(0); setStep('Memulai…'); setErrMsg('')
    try {
      const geminiKey = creds.gemini_key
      const modelId   = creds.chat_model_id ?? null

      const res = await fetch(`${API}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id:        jobId,
          gemini_key:    geminiKey,
          chunk_size:    config.chunkSize,
          chunk_overlap: config.overlap,
          use_ai_clean:  config.useAI,
          model_id:      modelId,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || 'Gagal memulai proses') }

      // Beritahu App.jsx agar FloatingJobBar muncul saat pindah halaman
      setActiveJob({ jobId: jobId!, phase: 'processing', status: 'processing', files: files.map(f => f.name) })
      startPolling(jobId!)

      doLocalPoll(jobId!)
    } catch (e: any) {
      setState('error'); setErrMsg(e.message)
    }
  }

  useEffect(() => () => stopPoll(), [])

  const totalChunks = results.reduce((s: number, r: any) => s + (r.chunks ?? 0), 0)

  return (
    <div className="space-y-5 animate-slide-up">
      <div>
        <h2 className="text-xl font-bold text-t1 tracking-tight">Proses PDF</h2>
        <p className="text-sm text-t2 mt-1.5">
          {files.length} file · Chunk {config.chunkSize} chars · Overlap {config.overlap} chars
        </p>
      </div>

      {state === 'idle' && (
        <Card>
          <div className="flex flex-col items-center py-8 gap-5">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(10,132,255,0.1)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0A84FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/>
              </svg>
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-t1">{files.length} file siap diproses</p>
              <p className="text-sm text-t3 mt-1">File sudah terupload ke server. Klik untuk mulai memproses.</p>
            </div>
            <Button variant="primary" size="lg" onClick={startProcess}>Mulai Proses Sekarang</Button>
          </div>
        </Card>
      )}

      {(state === 'running' || state === 'done') && (
        <Card>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-t3">{state === 'done' ? '✓ Selesai' : step}</span>
                <span className="text-xs font-mono font-semibold text-accent">
                  {state === 'running' && pct === 0 ? 'Memproses…' : `${pct}%`}
                </span>
              </div>
              <ProgressBar pct={pct} done={state === 'done'} indeterminate={state === 'running' && pct === 0} />
            </div>

            {results.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-xs font-medium text-t4 uppercase tracking-widest">Hasil</p>
                {results.map((r: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2.5 border-b last:border-0"
                    style={{ borderColor: 'var(--bdr-2)' }}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: r.status === 'success' ? '#32D74B' : r.status === 'error' ? '#FF453A' : '#FFD60A' }} />
                      <span className="text-sm text-t1 truncate max-w-[200px]">{r.filename}</span>
                    </div>
                    <div className="flex gap-4 text-xs text-t3">
                      <span>{r.chunks ?? 0} chunks</span>
                      <span>{r.pages ?? 0} hlm</span>
                      <span>{r.time ?? 0}s</span>
                    </div>
                  </div>
                ))}
                {state === 'done' && (
                  <p className="text-xs text-t4 pt-1">Total: <span className="text-t1 font-semibold">{totalChunks.toLocaleString()}</span> chunks siap di-embed</p>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {state === 'error' && <Alert variant="error" title="Proses gagal">{friendlyError(errMsg)}</Alert>}
      {state === 'done' && (
        <Alert variant="success" title="Pemrosesan selesai!">
          {totalChunks.toLocaleString()} chunks berhasil dibuat. Lanjut ke Embed untuk simpan ke Supabase.
        </Alert>
      )}

      {state === 'done' && (
        <button
          onClick={async () => {
            const res = await fetch(`${API}/download-chunks/${jobId}`)
            if (!res.ok) return
            const blob = await res.blob()
            const cd = res.headers.get('Content-Disposition') || ''
            const match = cd.match(/filename="(.+?)"/)
            const name = match ? match[1] : 'chunks.json'
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a'); a.href = url; a.download = name; a.click()
            URL.revokeObjectURL(url)
          }}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-colors"
          style={{ border: '1px solid var(--bdr-4)', color: 'var(--t2)', background: 'transparent' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--fill-3)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Download JSON (backup chunks)
        </button>
      )}

      {confirm && (
        <div className="rounded-2xl p-4 space-y-3"
          style={{ background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.25)' }}>
          <p className="text-sm font-semibold text-danger">Yakin ingin membatalkan proses?</p>
          <p className="text-xs text-t3">File yang sudah diproses akan hilang dan harus diulang dari awal.</p>
          <div className="flex gap-2 pt-1">
            <Button variant="danger" size="sm" onClick={handleCancel}>Ya, Batalkan</Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>Tidak</Button>
          </div>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack} disabled={state === 'running'}><ArrowLeft /> Kembali</Button>
        <div className="flex gap-2">
          {state === 'running' && !confirm && (
            <Button variant="danger" size="lg" onClick={() => setConfirm(true)}>✕ Batalkan Proses</Button>
          )}
          <Button variant="primary" size="lg" disabled={state !== 'done'} onClick={onNext}>
            Embed ke Supabase <ArrowRight />
          </Button>
        </div>
      </div>
    </div>
  )
}

interface StepEmbedProps {
  jobId: string | null; config: ProcessConfig; creds: RuntimeCreds
  onBack: () => void; onReset: () => void
  activeJob: ActiveJob | null; setActiveJob: (j: ActiveJob | null) => void
  startPolling: (id: string) => void; stopPolling: () => void; onCancel: () => void
}
function StepEmbed({ jobId, config, creds, onBack, onReset, activeJob, setActiveJob, startPolling, stopPolling, onCancel }: StepEmbedProps) {
  const [mode,        setMode]        = useState('append')
  const [state,       setState]       = useState<'idle'|'running'|'done'|'error'|'ratelimit'>('idle')
  const [pct,         setPct]         = useState(0)
  const [step,        setStep]        = useState('')
  const [results,     setResults]     = useState<any[]>([])
  const [errMsg,      setErrMsg]      = useState('')
  const [isRateLimit, setIsRateLimit] = useState(false)
  const [confirm,     setConfirm]     = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }

  const handleCancel = () => {
    stopPoll()
    stopPolling()
    setActiveJob(null)
    onCancel()
  }

  const isRateLimitErr = (msg: string) =>
    msg && (msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate limit'))

  const doLocalPoll = (jid: string) => {
    pollRef.current = setInterval(async () => {
      const s = await fetch(`${API}/status/${jid}`).then(r => r.json())
      setPct(s.embed_progress ?? 0)
      setStep(s.embed_step ?? '')
      setResults(s.process_results ?? [])
      if (s.status === 'done') {
        stopPoll(); setState('done'); setPct(100)
        setActiveJob(activeJob ? { ...activeJob, status: 'done' } : null)
      } else if (s.status === 'embed_error') {
        stopPoll()
        const errDetail = s.process_results?.find((r: any) => r.embed_error)?.embed_error ?? 'Terjadi error saat embedding'
        if (isRateLimitErr(errDetail)) {
          setState('ratelimit'); setErrMsg(errDetail)
        } else {
          setState('error'); setErrMsg(errDetail)
        }
      }
    }, 1000)
  }

  // Restore state kalau kembali ke halaman saat embed masih berjalan
  useEffect(() => {
    if (!activeJob?.jobId) return
    if (activeJob.status === 'done') {
      setState('done'); setPct(100)
    } else if (activeJob.status === 'embed_error') {
      setState('error'); setErrMsg('Terjadi error saat embedding')
    } else if (activeJob.phase === 'embedding') {
      setState('running')
      setPct(activeJob.embedProgress ?? 0)
      setStep(activeJob.embedStep ?? '')
      doLocalPoll(activeJob.jobId)
    }
  }, []) // eslint-disable-line

  const startEmbed = async () => {
    setState('running'); setPct(0); setStep('Memulai…'); setErrMsg(''); setIsRateLimit(false)
    try {
      const geminiKey    = creds.gemini_key
      const embedModelId = creds.embed_model_id ?? null

      const res = await fetch(`${API}/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id:          jobId,
          gemini_key:      geminiKey,
          supabase_url:    creds.supabase_url,
          supabase_key:    creds.supabase_key,
          mode,
          embed_model_id:  embedModelId,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || 'Gagal memulai embed') }

      // Update phase di App.tsx → FloatingJobBar tetap tampil
      setActiveJob(activeJob ? { ...activeJob, phase: 'embedding', status: 'embedding' } : null)

      doLocalPoll(jobId!)
    } catch (e: any) {
      if (isRateLimitErr(e.message)) {
        setState('ratelimit'); setErrMsg(e.message)
      } else {
        setState('error'); setErrMsg(e.message)
      }
    }
  }

  useEffect(() => () => stopPoll(), [])

  const totalEmbedded = results.reduce((s: number, r: any) => s + (r.embedded ?? 0), 0)

  return (
    <div className="space-y-5 animate-slide-up">
      <div>
        <h2 className="text-xl font-bold text-t1 tracking-tight">Embed ke Supabase</h2>
        <p className="text-sm text-t2 mt-1.5">Buat vector embedding dan simpan ke knowledge base chatbot</p>
      </div>

      {state === 'idle' && (
        <>
          <Card>
            <p className="text-xs font-semibold text-t4 uppercase tracking-widest mb-3">Mode Embedding</p>
            <div className="space-y-2">
              {[
                { v: 'append',  label: 'Append',  desc: 'Tambah baru, lewati file yang sudah ada' },
                { v: 'replace', label: 'Replace', desc: 'Hapus lama, embed ulang semua file' },
              ].map(opt => (
                <button key={opt.v} onClick={() => setMode(opt.v)}
                  className="w-full flex items-center gap-3 p-4 rounded-xl text-left transition-all duration-150"
                  style={{
                    border: `1px solid ${mode === opt.v ? 'rgba(10,132,255,0.35)' : 'var(--bdr-2)'}`,
                    background: mode === opt.v ? 'rgba(10,132,255,0.06)' : 'var(--fill-1)',
                  }}>
                  <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                    style={{ borderColor: mode === opt.v ? '#0A84FF' : 'var(--bdr-6)' }}>
                    {mode === opt.v && <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-t1">{opt.label}</p>
                    <p className="text-xs text-t3">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </Card>
          {mode === 'replace' && (
            <Alert variant="warning" title="Mode Replace">Data lama untuk file-file ini akan dihapus sebelum embedding ulang.</Alert>
          )}
        </>
      )}

      {(state === 'running' || state === 'done') && (
        <Card>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-t3">{state === 'done' ? '✓ Selesai' : step}</span>
                <span className="text-xs font-mono font-semibold text-accent">{pct}%</span>
              </div>
              <ProgressBar pct={pct} done={state === 'done'} />
            </div>

            {results.length > 0 && state === 'done' && (
              <div className="space-y-2 pt-1">
                {results.map((r: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b last:border-0"
                    style={{ borderColor: 'var(--bdr-2)' }}>
                    <span className="text-sm text-t1 truncate max-w-[220px]">{r.filename}</span>
                    <span className="text-xs text-[#32D74B]">
                      {r.embed_error ? friendlyError(r.embed_error) : `✓ ${r.embedded ?? 0} chunks tersimpan`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {state === 'error' && <Alert variant="error" title="Embed gagal">{friendlyError(errMsg)}</Alert>}

      {state === 'ratelimit' && (
        <div className="rounded-2xl p-4 space-y-3"
          style={{ background: 'rgba(255,159,10,0.08)', border: '1px solid rgba(255,159,10,0.25)' }}>
          <div className="flex items-start gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF9F0A"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: '#FF9F0A' }}>Batas kuota API tercapai (Rate Limit)</p>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: 'rgba(255,159,10,0.7)' }}>
                Gemini API menolak request karena terlalu banyak request dalam waktu singkat.
                Tunggu <strong style={{ color: '#FF9F0A' }}>1–2 menit</strong> lalu coba lagi — tidak perlu upload ulang.
              </p>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => { setState('idle'); setIsRateLimit(false) }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
              style={{ background: 'rgba(255,159,10,0.15)', color: '#FF9F0A', border: '1px solid rgba(255,159,10,0.2)' }}>
              <RefreshIcon /> Coba Lagi
            </button>
            <p className="text-xs text-t4 self-center">Progress yang sudah selesai tidak hilang</p>
          </div>
        </div>
      )}

      {state === 'done' && (() => {
        const failedFiles = results.filter((r: any) => r.embed_error)
        const hasPartial  = failedFiles.length > 0 && totalEmbedded > 0
        const allFailed   = totalEmbedded === 0 && failedFiles.length > 0

        if (allFailed) return (
          <Alert variant="error" title="Gagal menyimpan ke Supabase">
            Semua file gagal di-embed. Kemungkinan quota API habis atau koneksi bermasalah.
            Coba lagi nanti atau ganti API key di <strong>Credentials → AI Models</strong>.
          </Alert>
        )
        if (hasPartial) return (
          <Alert variant="warning" title="Sebagian file berhasil di-embed">
            {totalEmbedded.toLocaleString()} chunks tersimpan · {failedFiles.length} file gagal.
            File yang gagal bisa diproses ulang setelah quota API pulih.
          </Alert>
        )
        return (
          <Alert variant="success" title="Berhasil disimpan ke Supabase!">
            {totalEmbedded.toLocaleString()} chunks ter-embed. Chatbot RAG siap digunakan.
          </Alert>
        )
      })()}

      {confirm && (
        <div className="rounded-2xl p-4 space-y-3"
          style={{ background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.25)' }}>
          <p className="text-sm font-semibold text-danger">Yakin ingin membatalkan embedding?</p>
          <p className="text-xs text-t3">Chunk yang sudah tersimpan ke Supabase tidak akan terhapus, tapi proses harus diulang.</p>
          <div className="flex gap-2 pt-1">
            <Button variant="danger" size="sm" onClick={handleCancel}>Ya, Batalkan</Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>Tidak</Button>
          </div>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack} disabled={state === 'running'}><ArrowLeft /> Kembali</Button>
        <div className="flex gap-2">
          {state === 'running' && !confirm && (
            <Button variant="danger" size="lg" onClick={() => setConfirm(true)}>✕ Batalkan</Button>
          )}
          {state === 'done' ? (
            <Button variant="secondary" onClick={onReset}><RefreshIcon /> Proses Baru</Button>
          ) : (
            <Button variant="primary" size="lg"
              disabled={state === 'running'}
              loading={state === 'running'}
              onClick={startEmbed}>
              {state === 'running' ? 'Embedding…' : state === 'ratelimit' ? 'Coba Lagi' : 'Mulai Embed'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

interface PDFProcessorProps {
  activeJob: ActiveJob | null
  setActiveJob: (j: ActiveJob | null) => void
  startPolling: (id: string) => void
  stopPolling: () => void
  pdfFiles: File[]
  setPdfFiles: (f: File[]) => void
}

const LS_STEP   = 'pdf_processor_step'
const LS_CONFIG = 'pdf_processor_config'
const LS_JOBID  = 'pdf_processor_jobId'

const DEFAULT_CONFIG: ProcessConfig = { useAI: false, chunkSize: 1000, overlap: 200, modelId: null }

export default function PDFProcessor({ activeJob, setActiveJob, startPolling, stopPolling, pdfFiles, setPdfFiles }: PDFProcessorProps) {
  const [step, setStep] = useState(() => {
    const savedJobId = localStorage.getItem(LS_JOBID)
    const parsed = parseInt(localStorage.getItem(LS_STEP) ?? '0')
    // Hanya restore step > 0 kalau ada jobId tersimpan
    return (parsed > 0 && savedJobId) ? parsed : 0
  })
  const files    = pdfFiles
  const setFiles = setPdfFiles
  const [config, setConfig] = useState<ProcessConfig>(() => {
    try {
      const saved = localStorage.getItem(LS_CONFIG)
      return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : DEFAULT_CONFIG
    } catch { return DEFAULT_CONFIG }
  })
  const [jobId, setJobId] = useState<string | null>(() => localStorage.getItem(LS_JOBID))
  const [jobData,   setJobData]   = useState<any>(null)
  const [uploading,     setUploading]     = useState(false)
  const [uploadErr,     setUploadErr]     = useState('')
  const [jsonUploading, setJsonUploading] = useState(false)
  const [jsonErr,       setJsonErr]       = useState('')
  const [creds,     setCreds]     = useState<RuntimeCreds>({ gemini_key: '', supabase_url: '', supabase_key: '', chat_model_id: null, embed_model_id: null, ai_list: [] })
  const [apiOnline, setApiOnline] = useState<boolean | null>(null)

  // Persist step, config, jobId ke localStorage supaya state tidak hilang saat pindah halaman
  useEffect(() => { localStorage.setItem(LS_STEP, step.toString()) }, [step])
  useEffect(() => { localStorage.setItem(LS_CONFIG, JSON.stringify(config)) }, [config])
  useEffect(() => {
    if (jobId) localStorage.setItem(LS_JOBID, jobId)
    else localStorage.removeItem(LS_JOBID)
  }, [jobId])

  useEffect(() => {
    if (activeJob?.jobId) {
      setJobId(activeJob.jobId)
      if (activeJob.status === 'done' || activeJob.phase === 'embedding' || activeJob.status === 'embed_error') {
        setStep(3)
      } else if (activeJob.phase === 'processing' || activeJob.status === 'processed') {
        setStep(2)
      }
    }
  }, []) // eslint-disable-line

  useEffect(() => {
    fetch(`${API}/health`)
      .then(r => r.ok ? setApiOnline(true) : setApiOnline(false))
      .catch(() => setApiOnline(false))

    fetch(`${API}/credentials/all`)
      .then(r => r.json())
      .then(all => {
        const aiList = Array.isArray(all?.ai_models) ? all.ai_models : []
        const first  = aiList[0] ?? {}
        const embedModel = aiList.find((m: any) =>
          m.model?.toLowerCase().includes('embed') ||
          m.name?.toLowerCase().includes('embed')
        )
        setCreds({
          gemini_key:     first.api_key  || '',
          supabase_url:   all?.supabase?.url         || '',
          supabase_key:   all?.supabase?.service_key || '',
          chat_model_id:  first.model   || null,
          embed_model_id: embedModel?.model || 'models/gemini-embedding-001',
          ai_list:        aiList,
        })
      })
      .catch(() => {})
  }, [])

  const uploadAndNext = async () => {
    setUploading(true); setUploadErr('')
    try {
      const fd = new FormData()
      files.forEach(f => fd.append('files', f))
      const res  = await fetch(`${API}/upload`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Upload gagal')
      setJobId(data.job_id)
      setStep(1)
    } catch (e: any) {
      setUploadErr(e.message)
    } finally {
      setUploading(false)
    }
  }

  const uploadJsonAndSkip = async (file: File) => {
    setJsonUploading(true); setJsonErr('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res  = await fetch(`${API}/upload-json`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Upload JSON gagal')
      setJobId(data.job_id)
      setStep(3)
    } catch (e: any) {
      setJsonErr(e.message)
    } finally {
      setJsonUploading(false)
    }
  }

  const reset = () => {
    setStep(0); setPdfFiles([]); setJobId(null); setJobData(null)
    setConfig(DEFAULT_CONFIG)
    setUploadErr('')
    setActiveJob(null)
    stopPolling()
    localStorage.removeItem(LS_STEP)
    localStorage.removeItem(LS_CONFIG)
    localStorage.removeItem(LS_JOBID)
  }

  return (
    <div className="min-h-full px-6 py-8">
      <div className="max-w-2xl mx-auto space-y-8">

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-t1 tracking-tight">PDF Processor</h1>
            <p className="text-sm text-t3 mt-1">Konversi publikasi BPS menjadi dataset RAG untuk chatbot WhatsApp</p>
          </div>
          {apiOnline !== null && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium"
              style={{
                background: apiOnline ? 'rgba(50,215,75,0.10)' : 'rgba(255,69,58,0.10)',
                border: `1px solid ${apiOnline ? 'rgba(50,215,75,0.25)' : 'rgba(255,69,58,0.25)'}`,
                color: apiOnline ? '#32D74B' : '#FF453A',
              }}>
              <span className="relative flex h-2 w-2">
                {apiOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
                  style={{ background: '#32D74B' }} />}
                <span className="relative inline-flex rounded-full h-2 w-2"
                  style={{ background: apiOnline ? '#32D74B' : '#FF453A' }} />
              </span>
              {apiOnline ? 'API Online' : 'API Offline'}
            </div>
          )}
        </div>

        {apiOnline === false && (
          <Alert variant="error" title="Backend tidak berjalan">
            Jalankan: <code className="font-mono bg-black/30 px-1 rounded">python api.py</code> di folder program1_pdf_processor
          </Alert>
        )}

        <div className="px-5 py-4 rounded-2xl" style={{ background: 'var(--elevated)', border: '1px solid var(--bdr-2)' }}>
          <Stepper steps={STEPS} currentStep={step} />
        </div>

        {step === 0 && (
          <StepUpload files={files} setFiles={setFiles}
            onNext={uploadAndNext} uploading={uploading} error={uploadErr}
            onUploadJson={uploadJsonAndSkip} jsonUploading={jsonUploading} jsonError={jsonErr} />
        )}
        {step === 1 && (
          <StepConfigure config={config} setConfig={setConfig} creds={creds}
            onNext={() => setStep(2)} onBack={() => setStep(0)}
            onGoCredentials={() => (window as any).__navigateToCredentials?.()} />
        )}
        {step === 2 && (
          <StepProcess jobId={jobId} files={files} config={config} creds={creds}
            onNext={() => setStep(3)} onBack={() => setStep(1)}
            onJobUpdate={setJobData}
            activeJob={activeJob} setActiveJob={setActiveJob}
            startPolling={startPolling} stopPolling={stopPolling}
            onCancel={reset} />
        )}
        {step === 3 && (
          <StepEmbed jobId={jobId} config={config} creds={creds}
            onBack={() => setStep(2)} onReset={reset}
            activeJob={activeJob} setActiveJob={setActiveJob}
            startPolling={startPolling} stopPolling={stopPolling}
            onCancel={reset} />
        )}

      </div>
    </div>
  )
}
