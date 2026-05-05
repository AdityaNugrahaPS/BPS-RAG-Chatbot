import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import Card from '../components/ui/Card'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import { supabase } from '../lib/supabase'
import type { DashboardData, UserContact, ChatRow } from '../types'

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const ONE_DAY_MS = 86_400_000

// ─────────────────────────────────────────────
// Data fetching
// ─────────────────────────────────────────────

async function fetchData(): Promise<DashboardData> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  // Menjalankan 5 query paralel — humanToday sengaja dihapus karena hasilnya
  // identik dengan `human` (filter .gte('id',0) tidak efektif) dan tidak dipakai.
  const [
    { count: total },
    { count: human },
    { count: ai },
    { data: sessionRows },
    { data: contacts },
    { count: kbChunks },
  ] = await Promise.all([
    supabase.from('n8n_chat_histories').select('*', { count: 'exact', head: true }),
    supabase.from('n8n_chat_histories').select('*', { count: 'exact', head: true })
      .filter('message->>type', 'eq', 'human'),
    supabase.from('n8n_chat_histories').select('*', { count: 'exact', head: true })
      .filter('message->>type', 'eq', 'ai'),
    supabase.from('n8n_chat_histories').select('session_id, created_at'),
    supabase.from('user_contacts').select('*').order('last_seen', { ascending: false }).limit(100),
    supabase.from('documents').select('*', { count: 'exact', head: true }),
  ])

  const uniqueSessions = new Set((sessionRows ?? []).map((r: any) => r.session_id)).size
  const avgPerUser = uniqueSessions > 0 ? Math.round((human ?? 0) / uniqueSessions) : 0

  const todayISO = todayStart.toISOString()
  const todayRows = (sessionRows ?? []).filter((r: any) => r.created_at >= todayISO)
  const todayMessageCount = todayRows.length
  const todayUserCount = new Set(todayRows.map((r: any) => r.session_id)).size

  const sessionCountMap: Record<string, number> = {}
  ;(sessionRows ?? []).forEach((r: any) => {
    sessionCountMap[r.session_id] = (sessionCountMap[r.session_id] ?? 0) + 1
  })

  const users: UserContact[] = ((contacts ?? []) as any[]).map(c => ({
    ...c,
    pesan: sessionCountMap[c.session_id] ?? c.message_count ?? 0,
    terakhir: c.last_seen
      ? new Date(c.last_seen).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
      : '—',
    isNew: c.last_seen ? (Date.now() - new Date(c.last_seen).getTime()) < ONE_DAY_MS : false,
  }))

  return {
    metrics: {
      total: total ?? 0,
      human: human ?? 0,
      ai: ai ?? 0,
      uniqueSessions,
      avgPerUser,
      pesanHariIni: todayMessageCount,
      userHariIni: todayUserCount,
    },
    kbChunks: kbChunks ?? 0,
    users,
  }
}

// ─────────────────────────────────────────────
// Chart helpers
// ─────────────────────────────────────────────

interface ChartPoint {
  date: string   // "DD MMM" — label sumbu X
  pesan: number  // total pesan (user + bot)
  user: number   // pesan dari user (human)
  bot: number    // pesan dari bot (ai)
}

function formatChartDate(date: Date): string {
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
}

async function fetchChartData(days = 30): Promise<ChartPoint[]> {
  const from = new Date(Date.now() - days * ONE_DAY_MS).toISOString()

  const { data } = await supabase
    .from('n8n_chat_histories')
    .select('created_at, message')
    .gte('created_at', from)
    .order('created_at')

  if (!data) return []

  const byDay: Record<string, { pesan: number; user: number; bot: number }> = {}
  for (const row of data as any[]) {
    const key = formatChartDate(new Date(row.created_at))
    if (!byDay[key]) byDay[key] = { pesan: 0, user: 0, bot: 0 }
    byDay[key].pesan++
    const messageType = row.message?.type
    if (messageType === 'human') byDay[key].user++
    else if (messageType === 'ai') byDay[key].bot++
  }

  // Pastikan semua hari dalam rentang terisi agar grafik tidak loncat
  const result: ChartPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const dayDate = new Date(Date.now() - i * ONE_DAY_MS)
    const key = formatChartDate(dayDate)
    result.push({ date: key, ...(byDay[key] ?? { pesan: 0, user: 0, bot: 0 }) })
  }
  return result
}

// ─────────────────────────────────────────────
// Chat history
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// CSV utility
// ─────────────────────────────────────────────

function downloadCsv(rows: string[][], filename: string) {
  const csv = rows
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function MetricCard({ label, value, color, loading }: {
  label: string; value: number | undefined; color: string; loading: boolean
}) {
  return (
    <div className="flex items-center gap-4 p-5 rounded-2xl"
      style={{ background: 'var(--elevated)', border: '1px solid var(--bdr-2)' }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: color + '18' }}>
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
      </div>
      <div>
        <p className="text-xs text-t4 font-medium">{label}</p>
        {loading
          ? <div className="h-7 w-16 rounded-md mt-1 animate-pulse" style={{ background: 'var(--fill-4)' }} />
          : <p className="text-2xl font-bold text-t1 leading-tight mt-0.5">{value?.toLocaleString() ?? '—'}</p>
        }
      </div>
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

function ExportCsvButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
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

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

export default function Dashboard() {
  const [data,          setData]          = useState<DashboardData | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState<string | null>(null)
  const [realtimeOk,    setRealtimeOk]    = useState(false)
  const [lastUpdated,   setLastUpdated]   = useState<Date | null>(null)
  const [activeTab,     setActiveTab]     = useState('users')
  const [chatHistory,   setChatHistory]   = useState<ChatRow[]>([])
  const [filterSession, setFilterSession] = useState('')
  const [filterKeyword, setFilterKeyword] = useState('')
  const [chartData,     setChartData]     = useState<ChartPoint[]>([])
  const [chartDays,     setChartDays]     = useState(30)
  const [chartLoading,  setChartLoading]  = useState(true)

  // Refs untuk membaca nilai terbaru di dalam realtime callback
  // tanpa harus meng-unsubscribe/resubscribe channel setiap state berubah.
  const activeTabRef     = useRef(activeTab)
  const filterSessionRef = useRef(filterSession)
  const chartDaysRef     = useRef(chartDays)
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
    fetchChartData(chartDays)
      .then(setChartData)
      .finally(() => setChartLoading(false))
  }, [chartDays])

  useEffect(() => {
    if (activeTab === 'chat') {
      fetchChatHistory(filterSession).then(setChatHistory)
    }
  }, [activeTab, filterSession])

  // Channel dibuat satu kali saja. Nilai terbaru activeTab/filterSession/chartDays
  // dibaca lewat ref di atas sehingga tidak perlu re-subscribe setiap state berubah.
  useEffect(() => {
    const realtimeChannel = supabase
      .channel('dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'n8n_chat_histories' }, () => {
        refresh()
        fetchChartData(chartDaysRef.current).then(setChartData)
        if (activeTabRef.current === 'chat') {
          fetchChatHistory(filterSessionRef.current).then(setChatHistory)
        }
      })
      .subscribe((status: string) => setRealtimeOk(status === 'SUBSCRIBED'))

    return () => { supabase.removeChannel(realtimeChannel) }
  }, [refresh])

  // Reset filter saat ganti tab agar hasil tab sebelumnya tidak terbawa
  function handleTabChange(tabId: string) {
    setActiveTab(tabId)
    setFilterSession('')
    setFilterKeyword('')
  }

  function handleExportUsers() {
    const rows: string[][] = [['Nama', 'No. HP', 'Pesan', 'Terakhir', 'Session ID']]
    sortedUsers.forEach(u => rows.push([
      u.display_name || '—',
      u.phone_number || '—',
      String(u.pesan),
      u.terakhir,
      u.session_id || '—',
    ]))
    downloadCsv(rows, `user-contacts-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  function handleExportChat() {
    const rows: string[][] = [['ID', 'Session', 'Tipe', 'Pesan']]
    chatHistory.forEach(r => rows.push([String(r.id), r.session, r.tipe.replace(/[^\w\s]/g, ''), r.pesan]))
    downloadCsv(rows, `chat-history-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  const metrics = data?.metrics

  // Memoize agar sort dan pengecekan empty tidak jalan di setiap re-render
  const sortedUsers = useMemo(
    () => [...(data?.users ?? [])].sort((a, b) => b.pesan - a.pesan),
    [data?.users]
  )
  const isChartEmpty = useMemo(
    () => chartData.every(point => point.pesan === 0),
    [chartData]
  )
  const filteredChat = useMemo(
    () => filterKeyword.trim()
      ? chatHistory.filter(r => r.pesan.toLowerCase().includes(filterKeyword.toLowerCase()))
      : chatHistory,
    [chatHistory, filterKeyword]
  )

  return (
    <div className="p-8 space-y-8 min-h-screen">

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

      {error && (
        <Alert variant="error">Gagal memuat data: {error}</Alert>
      )}

      <div>
        <p className="text-xs font-semibold text-t4 uppercase tracking-widest mb-3">Ringkasan</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard label="Total Pesan"         value={metrics?.total}          color="#0A84FF" loading={loading} />
          <MetricCard label="User Unik"           value={metrics?.uniqueSessions} color="#32D74B" loading={loading} />
          <MetricCard label="Pesan Hari Ini"      value={metrics?.pesanHariIni}   color="#FFD60A" loading={loading} />
          <MetricCard label="User Aktif Hari Ini" value={metrics?.userHariIni}    color="#FF9F0A" loading={loading} />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-t4 uppercase tracking-widest mb-3">Knowledge Base</p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="flex items-center gap-4 p-5 rounded-2xl lg:col-span-1"
            style={{ background: 'var(--elevated)', border: '1px solid var(--bdr-2)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: '#BF5AF218' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#BF5AF2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
            </div>
            <div>
              <p className="text-xs text-t4 font-medium">Total Chunks di RAG</p>
              {loading
                ? <div className="h-7 w-16 rounded-md mt-1 animate-pulse" style={{ background: 'var(--fill-4)' }} />
                : <p className="text-2xl font-bold text-t1 leading-tight mt-0.5">{(data?.kbChunks ?? 0).toLocaleString()}</p>
              }
              <p className="text-xs text-t5 mt-0.5">chunks tersimpan di Supabase</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-5 rounded-2xl"
            style={{ background: 'var(--elevated)', border: '1px solid var(--bdr-2)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: '#0A84FF18' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0A84FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
              </svg>
            </div>
            <div>
              <p className="text-xs text-t4 font-medium">Rata-rata Pesan/User</p>
              {loading
                ? <div className="h-7 w-16 rounded-md mt-1 animate-pulse" style={{ background: 'var(--fill-4)' }} />
                : <p className="text-2xl font-bold text-t1 leading-tight mt-0.5">{metrics?.avgPerUser ?? '—'}</p>
              }
              <p className="text-xs text-t5 mt-0.5">pesan per sesi</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-5 rounded-2xl"
            style={{ background: 'var(--elevated)', border: '1px solid var(--bdr-2)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: '#32D74B18' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#32D74B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div>
              <p className="text-xs text-t4 font-medium">Total Respon AI</p>
              {loading
                ? <div className="h-7 w-16 rounded-md mt-1 animate-pulse" style={{ background: 'var(--fill-4)' }} />
                : <p className="text-2xl font-bold text-t1 leading-tight mt-0.5">{(metrics?.ai ?? 0).toLocaleString()}</p>
              }
              <p className="text-xs text-t5 mt-0.5">jawaban dikirim bot</p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-t4 uppercase tracking-widest">Aktivitas Pesan</p>
          <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: 'var(--fill-4)' }}>
            {[7, 14, 30].map(days => (
              <button key={days} onClick={() => setChartDays(days)}
                className="px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150"
                style={chartDays === days
                  ? { background: 'var(--elevated)', color: 'var(--txt-1)', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }
                  : { color: 'var(--txt-4)' }
                }>
                {days}H
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl p-5" style={{ background: 'var(--elevated)', border: '1px solid var(--bdr-2)' }}>
          {chartLoading ? (
            <div className="h-48 rounded-xl animate-pulse" style={{ background: 'var(--fill-3)' }} />
          ) : isChartEmpty ? (
            <div className="h-48 flex items-center justify-center text-t4 text-sm">
              Belum ada data aktivitas pesan dalam {chartDays} hari terakhir
            </div>
          ) : (
            <div>
              <div className="flex gap-4 mb-4 ml-1">
                {[
                  { label: 'User', color: '#0A84FF' },
                  { label: 'Bot',  color: '#32D74B' },
                ].map(({ label, color }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: color }} />
                    <span className="text-xs text-t4">{label}</span>
                  </div>
                ))}
              </div>

              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradUser" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#0A84FF" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#0A84FF" stopOpacity={0}    />
                    </linearGradient>
                    <linearGradient id="gradBot" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#32D74B" stopOpacity={0.20} />
                      <stop offset="95%" stopColor="#32D74B" stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: 'var(--txt-5)', fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    interval={chartDays <= 7 ? 0 : chartDays <= 14 ? 1 : 4}
                  />
                  <YAxis
                    tick={{ fill: 'var(--txt-5)', fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--elevated)',
                      border: '1px solid var(--bdr-5)',
                      borderRadius: 10,
                      fontSize: 12,
                      color: 'var(--txt-1)',
                      padding: '8px 12px',
                    }}
                    labelStyle={{ color: 'var(--txt-3)', marginBottom: 4 }}
                    itemStyle={{ color: 'var(--txt-2)' }}
                    formatter={(value: number, name: string) => [value, name === 'user' ? 'User' : 'Bot']}
                  />
                  <Area type="monotone" dataKey="user" stroke="#0A84FF" strokeWidth={1.5}
                    fill="url(#gradUser)" dot={false} activeDot={{ r: 4, fill: '#0A84FF' }} />
                  <Area type="monotone" dataKey="bot"  stroke="#32D74B" strokeWidth={1.5}
                    fill="url(#gradBot)"  dot={false} activeDot={{ r: 4, fill: '#32D74B' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-t4 uppercase tracking-widest mb-3">Manajemen Data</p>
        <Card>
          <div className="flex items-center justify-between mb-5">
            <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--fill-3)' }}>
              {([['users', 'Manajemen User'], ['chat', 'Riwayat Chat']] as const).map(([tabId, label]) => (
                <button key={tabId} onClick={() => handleTabChange(tabId)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150
                    ${activeTab === tabId ? 'text-t1 shadow-sm' : 'text-t3 hover:text-t1'}`}
                  style={activeTab === tabId ? { background: 'var(--elevated)' } : {}}>
                  {label}
                </button>
              ))}
            </div>
            {activeTab === 'users' && sortedUsers.length > 0 && (
              <ExportCsvButton onClick={handleExportUsers} />
            )}
            {activeTab === 'chat' && chatHistory.length > 0 && (
              <ExportCsvButton onClick={handleExportChat} />
            )}
          </div>

          {activeTab === 'users' && (
            <div>
              {loading
                ? <div className="h-32 rounded-xl animate-pulse" style={{ background: 'var(--fill-3)' }} />
                : sortedUsers.length === 0
                  ? <p className="text-t4 text-sm py-12 text-center">Belum ada user terdaftar</p>
                  : <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b" style={{ borderColor: 'var(--bdr-3)' }}>
                            {['#', 'Nama', 'No. HP', 'Total Pesan', 'Terakhir Aktif', ''].map((h, i) => (
                              <th key={i} className="pb-3 text-left text-xs font-semibold text-t4 pr-4">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sortedUsers.map((user, rank) => (
                            <tr key={rank} className="border-b group hover:bg-white/[0.02] transition-colors" style={{ borderColor: 'var(--bdr-1)' }}>
                              <td className="py-3 pr-4 text-xs font-bold w-8"
                                style={{ color: rank < 3 ? ['#FFD60A', '#A1A1AA', '#CD7F32'][rank] : 'var(--txt-5)' }}>
                                {rank + 1}
                              </td>
                              <td className="py-3 pr-4 font-medium text-t1">
                                <div className="flex items-center gap-2">
                                  <span>{user.display_name || user.phone_number || user.session_id?.replace('@s.whatsapp.net', '') || '—'}</span>
                                  {user.isNew && (
                                    <span className="px-1.5 py-0.5 rounded-full text-2xs font-semibold flex-shrink-0"
                                      style={{ background: 'rgba(50,215,75,0.15)', color: '#32D74B' }}>Baru</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 pr-4 text-t3">{user.phone_number || '—'}</td>
                              <td className="py-3 pr-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-t1 font-medium">{user.pesan}</span>
                                  <div className="flex-1 h-1 rounded-full overflow-hidden max-w-[60px]" style={{ background: 'var(--fill-4)' }}>
                                    <div className="h-full rounded-full" style={{
                                      width: `${Math.round((user.pesan / (sortedUsers[0]?.pesan || 1)) * 100)}%`,
                                      background: '#0A84FF',
                                    }} />
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 pr-4 text-t3">{user.terakhir}</td>
                              <td className="py-3">
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button title="Copy Session ID"
                                    onClick={() => navigator.clipboard.writeText(user.session_id || '')}
                                    className="w-6 h-6 rounded flex items-center justify-center text-t4 hover:text-t1 transition-colors">
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                    </svg>
                                  </button>
                                  <button title="Hapus user"
                                    onClick={async () => {
                                      if (!window.confirm(`Hapus user "${user.display_name || user.session_id}"?`)) return
                                      await supabase.from('user_contacts').delete().eq('session_id', user.session_id)
                                      refresh()
                                    }}
                                    className="w-6 h-6 rounded flex items-center justify-center transition-colors"
                                    style={{ color: '#FF453A' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,69,58,0.12)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="3 6 5 6 21 6"/>
                                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                      <path d="M10 11v6M14 11v6"/>
                                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                                    </svg>
                                  </button>
                                </div>
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
                  <input
                    value={filterSession}
                    onChange={e => setFilterSession(e.target.value)}
                    placeholder="Cari Session ID…"
                    className="w-full pl-8 pr-3 py-2 rounded-lg text-sm text-t1 placeholder-t4 outline-none focus:ring-1 focus:ring-accent"
                    style={{ background: 'var(--fill-3)', border: '1px solid var(--bdr-4)' }}
                  />
                </div>
                <div className="relative flex-1">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-t4" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  <input
                    value={filterKeyword}
                    onChange={e => setFilterKeyword(e.target.value)}
                    placeholder="Cari isi pesan…"
                    className="w-full pl-8 pr-3 py-2 rounded-lg text-sm text-t1 placeholder-t4 outline-none focus:ring-1 focus:ring-accent"
                    style={{ background: 'var(--fill-3)', border: '1px solid var(--bdr-4)' }}
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'var(--bdr-3)' }}>
                      {['ID', 'User/Session', 'Tipe', 'Pesan'].map(h => (
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
        BPS Pekanbaru · Chatbot Admin · Database PostgreSQL
      </p>
    </div>
  )
}
