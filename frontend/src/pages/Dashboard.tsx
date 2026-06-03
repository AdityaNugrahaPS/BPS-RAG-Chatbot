import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend,
} from 'recharts'
import Card from '../components/ui/Card'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import { supabase } from '../lib/supabase'
import type { DashboardData, IngestedFile, ChatRow } from '../types'

const ONE_DAY_MS = 86_400_000

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchData(): Promise<DashboardData> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayISO = todayStart.toISOString()

  const [
    { count: totalPesan },
    { count: totalAI },
    { count: kbChunks },
    { count: filesDone },
    { count: pesanHariIni },
    { data: ingestedFiles },
  ] = await Promise.all([
    supabase.from('n8n_chat_histories').select('*', { count: 'exact', head: true })
      .filter('message->>type', 'eq', 'human'),
    supabase.from('n8n_chat_histories').select('*', { count: 'exact', head: true })
      .filter('message->>type', 'eq', 'ai'),
    supabase.from('documents').select('*', { count: 'exact', head: true }),
    supabase.from('ingested_files').select('*', { count: 'exact', head: true }),
    supabase.from('n8n_chat_histories').select('*', { count: 'exact', head: true })
      .filter('message->>type', 'eq', 'human')
      .gte('created_at', todayISO),
    supabase.from('ingested_files')
      .select('id, file_name, file_id, chunk_count, ingested_at')
      .order('ingested_at', { ascending: false })
      .limit(50),
  ])

  return {
    metrics: {
      totalPesan:     totalPesan   ?? 0,
      totalAI:        totalAI      ?? 0,
      kbChunks:       kbChunks     ?? 0,
      filesTerindeks: filesDone    ?? 0,
      pesanHariIni:   pesanHariIni ?? 0,
    },
    ingestedFiles: (ingestedFiles ?? []) as IngestedFile[],
  }
}

// ─── Chart helpers ────────────────────────────────────────────────────────────

interface ChartPoint { date: string; user: number; bot: number }

function formatChartDate(date: Date): string {
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
}

async function fetchChartData(days = 7): Promise<ChartPoint[]> {
  const from = new Date(Date.now() - days * ONE_DAY_MS).toISOString()
  const { data } = await supabase
    .from('n8n_chat_histories')
    .select('created_at, message')
    .gte('created_at', from)
    .order('created_at')

  if (!data) return []

  const byDay: Record<string, { user: number; bot: number }> = {}
  for (const row of data as any[]) {
    const key = formatChartDate(new Date(row.created_at))
    if (!byDay[key]) byDay[key] = { user: 0, bot: 0 }
    if (row.message?.type === 'human') byDay[key].user++
    else if (row.message?.type === 'ai') byDay[key].bot++
  }

  const result: ChartPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const key = formatChartDate(new Date(Date.now() - i * ONE_DAY_MS))
    result.push({ date: key, ...(byDay[key] ?? { user: 0, bot: 0 }) })
  }
  return result
}

interface SessionPoint { session: string; pesan: number }

async function fetchSessionData(): Promise<SessionPoint[]> {
  const { data } = await supabase
    .from('n8n_chat_histories')
    .select('session_id, message')
    .filter('message->>type', 'eq', 'human')

  if (!data) return []
  const map: Record<string, number> = {}
  for (const row of data as any[]) {
    const s = (row.session_id ?? 'Unknown').slice(0, 15)
    map[s] = (map[s] ?? 0) + 1
  }
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([session, pesan]) => ({ session, pesan }))
}

// ─── Chat history ─────────────────────────────────────────────────────────────

async function fetchChatHistory(sessionFilter = ''): Promise<ChatRow[]> {
  let q = supabase
    .from('n8n_chat_histories')
    .select('id, session_id, message')
    .order('id', { ascending: false })
    .limit(100)
  if (sessionFilter) q = q.eq('session_id', sessionFilter)
  const { data } = await q
  return ((data ?? []) as any[]).map(r => ({
    id: r.id,
    session: r.session_id,
    tipe: r.message?.type === 'human' ? '👤 User' : r.message?.type === 'ai' ? '🤖 Bot' : (r.message?.type ?? '—'),
    pesan: (r.message?.content ?? '').slice(0, 200),
  }))
}

// ─── CSV utility ──────────────────────────────────────────────────────────────

function downloadCsv(rows: string[][], filename: string) {
  const csv = rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconChat = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
)
const IconBot = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2"/>
    <circle cx="12" cy="5" r="2"/>
    <path d="M12 7v4M8 15h.01M16 15h.01"/>
  </svg>
)
const IconDatabase = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3"/>
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
  </svg>
)
const IconFile = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
)

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({ label, value, color, sub, icon, loading }: {
  label: string; value: number | undefined; color: string; sub?: string
  icon: React.ReactNode; loading: boolean
}) {
  return (
    <div className="p-5 rounded-2xl relative overflow-hidden"
      style={{ background: 'var(--elevated)', border: '1px solid var(--bdr-2)' }}>
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full -translate-y-8 translate-x-8 opacity-[0.06]"
        style={{ background: color }} />
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: color + '18', color }}>
          {icon}
        </div>
      </div>
      {loading
        ? <div className="h-8 w-20 rounded-md animate-pulse" style={{ background: 'var(--fill-4)' }} />
        : <p className="text-3xl font-bold text-t1 leading-tight">{value?.toLocaleString() ?? '—'}</p>
      }
      <p className="text-xs font-medium text-t3 mt-1">{label}</p>
      {sub && <p className="text-xs text-t5 mt-0.5">{sub}</p>}
    </div>
  )
}

function LiveBadge({ connected, lastUpdated }: { connected: boolean; lastUpdated: Date | null }) {
  const time = lastUpdated
    ? lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—'
  return (
    <div className="flex items-center gap-1.5 text-xs text-t3">
      <span className="relative flex h-2 w-2">
        {connected ? (
          <>
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#32D74B] opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#32D74B]" />
          </>
        ) : (
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF453A]" />
        )}
      </span>
      {connected ? 'Live' : 'Offline'} · Diperbarui pukul {time}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-t4 uppercase tracking-widest mb-3">{children}</p>
}

function ExportCsvButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-t3 hover:text-t1 transition-colors"
      style={{ background: 'var(--fill-3)', border: '1px solid var(--bdr-3)' }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Export CSV
    </button>
  )
}

const TOOLTIP_STYLE = {
  contentStyle: {
    background: 'var(--elevated)', border: '1px solid var(--bdr-5)',
    borderRadius: 10, fontSize: 12, color: 'var(--txt-1)', padding: '8px 12px',
  },
  labelStyle: { color: 'var(--txt-3)', marginBottom: 4 },
  itemStyle: { color: 'var(--txt-2)' },
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [data,          setData]          = useState<DashboardData | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState<string | null>(null)
  const [realtimeOk,    setRealtimeOk]    = useState(false)
  const [lastUpdated,   setLastUpdated]   = useState<Date | null>(null)
  const [activeTab,     setActiveTab]     = useState<'files' | 'chat'>('files')
  const [chatHistory,   setChatHistory]   = useState<ChatRow[]>([])
  const [filterSession, setFilterSession] = useState('')
  const [filterKeyword, setFilterKeyword] = useState('')
  const [chartData,     setChartData]     = useState<ChartPoint[]>([])
  const [chartDays,     setChartDays]     = useState(7)
  const [chartLoading,  setChartLoading]  = useState(true)
  const [sessionData,   setSessionData]   = useState<SessionPoint[]>([])

  const activeTabRef      = useRef(activeTab)
  const filterSessionRef  = useRef(filterSession)
  const chartDaysRef      = useRef(chartDays)
  useEffect(() => { activeTabRef.current = activeTab },         [activeTab])
  useEffect(() => { filterSessionRef.current = filterSession }, [filterSession])
  useEffect(() => { chartDaysRef.current = chartDays },         [chartDays])

  const refresh = useCallback(async () => {
    try {
      const result = await fetchData()
      setData(result)
      setLastUpdated(new Date())
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    setChartLoading(true)
    Promise.all([
      fetchChartData(chartDays),
      fetchSessionData(),
    ]).then(([chart, session]) => {
      setChartData(chart)
      setSessionData(session)
    }).finally(() => setChartLoading(false))
  }, [chartDays])

  useEffect(() => {
    if (activeTab === 'chat') fetchChatHistory(filterSession).then(setChatHistory)
  }, [activeTab, filterSession])

  useEffect(() => {
    const ch = supabase
      .channel('dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'n8n_chat_histories' }, () => {
        refresh()
        fetchChartData(chartDaysRef.current).then(setChartData)
        fetchSessionData().then(setSessionData)
        if (activeTabRef.current === 'chat') fetchChatHistory(filterSessionRef.current).then(setChatHistory)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ingested_files' }, () => { refresh() })
      .subscribe((status: string) => setRealtimeOk(status === 'SUBSCRIBED'))
    return () => { supabase.removeChannel(ch) }
  }, [refresh])

  function handleTabChange(tabId: 'files' | 'chat') {
    setActiveTab(tabId); setFilterSession(''); setFilterKeyword('')
  }

  function handleExportFiles() {
    const rows: string[][] = [['Filename', 'Chunk Count', 'Tanggal']]
    ;(data?.ingestedFiles ?? []).forEach(f => rows.push([
      f.file_name, String(f.chunk_count ?? 0),
      new Date(f.ingested_at).toLocaleDateString('id-ID'),
    ]))
    downloadCsv(rows, `ingested-files-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  function handleExportChat() {
    const rows: string[][] = [['ID', 'Session', 'Tipe', 'Pesan']]
    chatHistory.forEach(r => rows.push([String(r.id), r.session, r.tipe.replace(/[^\w\s]/g, ''), r.pesan]))
    downloadCsv(rows, `chat-history-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  const metrics = data?.metrics
  const isChartEmpty  = useMemo(() => chartData.every(p => p.user === 0 && p.bot === 0), [chartData])
  const filteredChat  = useMemo(
    () => filterKeyword.trim()
      ? chatHistory.filter(r => r.pesan.toLowerCase().includes(filterKeyword.toLowerCase()))
      : chatHistory,
    [chatHistory, filterKeyword]
  )

  // Pie chart data
  const pieData = useMemo(() => {
    const u = metrics?.totalPesan ?? 0
    const b = metrics?.totalAI ?? 0
    if (u === 0 && b === 0) return []
    return [
      { name: 'User', value: u, color: '#0A84FF' },
      { name: 'Bot',  value: b, color: '#32D74B' },
    ]
  }, [metrics])

  return (
    <div className="p-8 space-y-8 min-h-screen">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-t1">Dashboard Admin</h1>
          <div className="mt-1"><LiveBadge connected={realtimeOk} lastUpdated={lastUpdated} /></div>
        </div>
        <Button variant="secondary" size="sm" onClick={refresh}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>}>
          Refresh
        </Button>
      </div>

      {error && <Alert variant="error">Gagal memuat data: {error}</Alert>}

      {/* Ringkasan */}
      <div>
        <SectionTitle>Ringkasan</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard label="Total Pesan Masuk"  value={metrics?.totalPesan}     color="#0A84FF" sub="dari pengguna WhatsApp"   icon={<IconChat />}     loading={loading} />
          <MetricCard label="Total Respon AI"    value={metrics?.totalAI}         color="#32D74B" sub="jawaban dikirim chatbot"   icon={<IconBot />}      loading={loading} />
          <MetricCard label="Chunks di RAG"      value={metrics?.kbChunks}        color="#BF5AF2" sub="tersimpan di Supabase"     icon={<IconDatabase />} loading={loading} />
          <MetricCard label="File Terindeks"     value={metrics?.filesTerindeks}  color="#FF9F0A" sub="dokumen PDF siap pakai"    icon={<IconFile />}     loading={loading} />
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Aktivitas Pesan - 2/3 width */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <SectionTitle>Aktivitas Pesan</SectionTitle>
            <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: 'var(--fill-4)' }}>
              {[7, 14, 30].map(days => (
                <button key={days} onClick={() => setChartDays(days)}
                  className="px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150"
                  style={chartDays === days
                    ? { background: 'var(--elevated)', color: 'var(--txt-1)', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }
                    : { color: 'var(--txt-4)' }}>
                  {days}H
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl p-5" style={{ background: 'var(--elevated)', border: '1px solid var(--bdr-2)', height: 260 }}>
            {chartLoading ? (
              <div className="h-full rounded-xl animate-pulse" style={{ background: 'var(--fill-3)' }} />
            ) : isChartEmpty ? (
              <div className="h-full flex items-center justify-center text-t4 text-sm">
                Belum ada data dalam {chartDays} hari terakhir
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradUser" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#0A84FF" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0A84FF" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradBot" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#32D74B" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#32D74B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: 'var(--txt-5)', fontSize: 10 }} tickLine={false} axisLine={false}
                    interval={chartDays <= 7 ? 0 : chartDays <= 14 ? 1 : 4} />
                  <YAxis tick={{ fill: 'var(--txt-5)', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v: number, n: string) => [v, n === 'user' ? 'User' : 'Bot']} />
                  <Legend formatter={(v: string) => v === 'user' ? 'User' : 'Bot'} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Area type="monotone" dataKey="user" stroke="#0A84FF" strokeWidth={2} fill="url(#gradUser)" dot={false} activeDot={{ r: 4, fill: '#0A84FF' }} />
                  <Area type="monotone" dataKey="bot"  stroke="#32D74B" strokeWidth={2} fill="url(#gradBot)"  dot={false} activeDot={{ r: 4, fill: '#32D74B' }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Komposisi Pesan - 1/3 width */}
        <div>
          <SectionTitle>Komposisi Pesan</SectionTitle>
          <div className="rounded-2xl p-5 flex flex-col items-center justify-center"
            style={{ background: 'var(--elevated)', border: '1px solid var(--bdr-2)', height: 260 }}>
            {loading ? (
              <div className="w-32 h-32 rounded-full animate-pulse" style={{ background: 'var(--fill-3)' }} />
            ) : pieData.length === 0 ? (
              <p className="text-t4 text-sm text-center">Belum ada data percakapan</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75}
                      paddingAngle={3} dataKey="value">
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip {...TOOLTIP_STYLE} formatter={(v: number, n: string) => [v + ' pesan', n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-1">
                  {pieData.map(d => (
                    <div key={d.name} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                      <span className="text-xs text-t3">{d.name} <span className="font-semibold text-t1">{d.value}</span></span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Sesi Aktif Bar Chart */}
      <div>
        <SectionTitle>Sesi Aktif</SectionTitle>
        <div className="rounded-2xl p-5" style={{ background: 'var(--elevated)', border: '1px solid var(--bdr-2)', height: 220 }}>
          {chartLoading ? (
            <div className="h-full rounded-xl animate-pulse" style={{ background: 'var(--fill-3)' }} />
          ) : sessionData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-t4 text-sm">
              Belum ada data sesi percakapan
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sessionData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" vertical={false} />
                <XAxis dataKey="session" tick={{ fill: 'var(--txt-5)', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: 'var(--txt-5)', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [v + ' pesan', 'Jumlah Pesan']} />
                <Bar dataKey="pesan" fill="#0A84FF" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Manajemen Data */}
      <div>
        <SectionTitle>Manajemen Data</SectionTitle>
        <Card>
          <div className="flex items-center justify-between mb-5">
            <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--fill-3)' }}>
              {([['files', 'File Terindeks'], ['chat', 'Riwayat Chat']] as const).map(([tabId, label]) => (
                <button key={tabId} onClick={() => handleTabChange(tabId)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${activeTab === tabId ? 'text-t1 shadow-sm' : 'text-t3 hover:text-t1'}`}
                  style={activeTab === tabId ? { background: 'var(--elevated)' } : {}}>
                  {label}
                </button>
              ))}
            </div>
            {activeTab === 'files' && (data?.ingestedFiles.length ?? 0) > 0 && <ExportCsvButton onClick={handleExportFiles} />}
            {activeTab === 'chat' && chatHistory.length > 0 && <ExportCsvButton onClick={handleExportChat} />}
          </div>

          {activeTab === 'files' && (
            <div>
              {loading
                ? <div className="h-32 rounded-xl animate-pulse" style={{ background: 'var(--fill-3)' }} />
                : (data?.ingestedFiles.length ?? 0) === 0
                  ? <p className="text-t4 text-sm py-12 text-center">Belum ada file yang diindeks. Upload PDF melalui PDF Processor.</p>
                  : <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b" style={{ borderColor: 'var(--bdr-3)' }}>
                            {['#', 'Nama File', 'Chunks', 'Tanggal Upload'].map((h, i) => (
                              <th key={i} className="pb-3 text-left text-xs font-semibold text-t4 pr-4">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(data?.ingestedFiles ?? []).map((f, i) => (
                            <tr key={f.id} className="border-b hover:bg-white/[0.02] transition-colors group" style={{ borderColor: 'var(--bdr-1)' }}>
                              <td className="py-3 pr-4 text-xs text-t5 font-bold">{i + 1}</td>
                              <td className="py-3 pr-4 font-medium text-t1 max-w-[240px] truncate" title={f.file_name}>{f.file_name}</td>
                              <td className="py-3 pr-4 text-t2 font-mono">{(f.chunk_count ?? 0).toLocaleString()}</td>
                              <td className="py-3 pr-4 text-t3 text-xs">
                                {new Date(f.ingested_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </td>
                              <td className="py-3">
                                <button
                                  onClick={async () => {
                                    if (!window.confirm(`Hapus "${f.file_name}" dan ${f.chunk_count ?? 0} chunks dari knowledge base?`)) return
                                    try {
                                      const res = await fetch('/api/knowledge-base/file', {
                                        method: 'DELETE',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ file_id: f.id, file_name: f.file_name }),
                                      })
                                      const d = await res.json()
                                      if (d.ok) refresh()
                                    } catch {}
                                  }}
                                  className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-red-500/10"
                                  style={{ color: '#FF453A' }}
                                  title="Hapus dari knowledge base">
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6"/>
                                    <path d="M19 6l-1 14H6L5 6"/>
                                    <path d="M10 11v6M14 11v6"/>
                                    <path d="M9 6V4h6v2"/>
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
              }
            </div>
          )}

          {activeTab === 'chat' && (
            <div>
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-t4" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input value={filterSession} onChange={e => setFilterSession(e.target.value)}
                    placeholder="Cari Session ID…"
                    className="w-full pl-8 pr-3 py-2 rounded-lg text-sm text-t1 placeholder-t4 outline-none focus:ring-1 focus:ring-accent"
                    style={{ background: 'var(--fill-3)', border: '1px solid var(--bdr-4)' }} />
                </div>
                <div className="relative flex-1">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-t4" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  <input value={filterKeyword} onChange={e => setFilterKeyword(e.target.value)}
                    placeholder="Cari isi pesan…"
                    className="w-full pl-8 pr-3 py-2 rounded-lg text-sm text-t1 placeholder-t4 outline-none focus:ring-1 focus:ring-accent"
                    style={{ background: 'var(--fill-3)', border: '1px solid var(--bdr-4)' }} />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'var(--bdr-3)' }}>
                      {['ID', 'Session', 'Tipe', 'Pesan'].map(h => (
                        <th key={h} className="pb-2 text-left text-xs font-medium text-t4">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredChat.length === 0
                      ? <tr><td colSpan={4} className="py-8 text-center text-t4">
                          {chatHistory.length === 0 ? 'Belum ada riwayat chat' : 'Tidak ada hasil yang cocok'}
                        </td></tr>
                      : filteredChat.map((row, i) => (
                          <tr key={i} className="border-b align-top" style={{ borderColor: 'var(--bdr-1)' }}>
                            <td className="py-2.5 pr-4 text-t4 font-mono text-xs">{row.id}</td>
                            <td className="py-2.5 pr-4 text-t3 text-xs max-w-[120px] truncate">{row.session}</td>
                            <td className="py-2.5 pr-4 whitespace-nowrap">{row.tipe}</td>
                            <td className="py-2.5 text-t2 max-w-xs" style={{
                              overflow: 'hidden', display: '-webkit-box',
                              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                            }}>{row.pesan}</td>
                          </tr>
                        ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      </div>

      <p className="text-center text-xs text-t5 pb-4">
        BPS Kota Pekanbaru · Chatbot Admin · Database PostgreSQL
      </p>
    </div>
  )
}
