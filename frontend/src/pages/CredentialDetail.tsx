import { useState, useEffect, useRef } from 'react'
import Button from '../components/ui/Button'
import { CREDS } from './Credentials'
import type { CredField, ModelSuggestion, ToastState, SavedCreds, AIModel } from '../types'

const FIELDS: Record<string, CredField[]> = {
  supabase: [
    { key: 'url',         label: 'Project URL',  placeholder: 'http://127.0.0.1:54321', type: 'text',     hint: 'URL API Supabase local (default: http://127.0.0.1:54321)' },
    { key: 'service_key', label: 'Service Key',  placeholder: 'sb_secret_...',          type: 'password', hint: 'Secret key dari output supabase start' },
  ],
  waha: [
    { key: 'url',     label: 'WAHA URL',    placeholder: 'http://localhost:3001',  type: 'text',     hint: 'URL server WAHA (lokal atau cloud)' },
    { key: 'api_key', label: 'API Key',     placeholder: 'mysecretkey',            type: 'password', hint: 'API key WAHA (atur di .env WAHA)' },
    { key: 'session', label: 'Session',     placeholder: 'default',                type: 'text',     hint: 'Nama session WhatsApp (biasanya "default")' },
    { key: 'number',  label: 'Nomor WA',   placeholder: '628xxxxxxxxxx',          type: 'text',     hint: 'Nomor WhatsApp bot (format: 628xxx tanpa +)' },
  ],
  n8n: [
    { key: 'url',     label: 'n8n URL',    placeholder: 'http://localhost:5678',  type: 'text',     hint: 'URL dashboard n8n kamu' },
    { key: 'api_key', label: 'API Key',    placeholder: 'eyJhbG...',             type: 'password', hint: 'API key dari n8n Settings → API Keys' },
  ],
  tavily: [
    { key: 'api_key', label: 'API Key Tavily', placeholder: 'tvly-dev-...', type: 'password', hint: 'API key dari app.tavily.com' },
  ],
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

const MODEL_SUGGESTIONS: ModelSuggestion[] = [
  { id: 'gemini-2.0-flash',              provider: 'Google',    label: 'Gemini 2.0 Flash' },
  { id: 'gemini-2.0-flash-lite',         provider: 'Google',    label: 'Gemini 2.0 Flash Lite' },
  { id: 'gemini-1.5-flash',              provider: 'Google',    label: 'Gemini 1.5 Flash' },
  { id: 'gemini-1.5-pro',                provider: 'Google',    label: 'Gemini 1.5 Pro' },
  { id: 'gemini-embedding-001',          provider: 'Google',    label: 'Gemini Embedding 001' },
  { id: 'text-embedding-004',            provider: 'Google',    label: 'Text Embedding 004' },
  { id: 'gpt-4o',                        provider: 'OpenAI',    label: 'GPT-4o' },
  { id: 'gpt-4o-mini',                   provider: 'OpenAI',    label: 'GPT-4o Mini' },
  { id: 'gpt-4-turbo',                   provider: 'OpenAI',    label: 'GPT-4 Turbo' },
  { id: 'gpt-3.5-turbo',                 provider: 'OpenAI',    label: 'GPT-3.5 Turbo' },
  { id: 'text-embedding-3-small',        provider: 'OpenAI',    label: 'Text Embedding 3 Small' },
  { id: 'text-embedding-3-large',        provider: 'OpenAI',    label: 'Text Embedding 3 Large' },
  { id: 'claude-3-5-sonnet-20241022',    provider: 'Anthropic', label: 'Claude 3.5 Sonnet' },
  { id: 'claude-3-5-haiku-20241022',     provider: 'Anthropic', label: 'Claude 3.5 Haiku' },
  { id: 'claude-3-opus-20240229',        provider: 'Anthropic', label: 'Claude 3 Opus' },
  { id: 'llama-3.3-70b-versatile',       provider: 'Groq',      label: 'LLaMA 3.3 70B' },
  { id: 'llama-3.1-8b-instant',          provider: 'Groq',      label: 'LLaMA 3.1 8B Instant' },
  { id: 'mixtral-8x7b-32768',            provider: 'Groq',      label: 'Mixtral 8x7B' },
  { id: 'mistral-large-latest',          provider: 'Mistral',   label: 'Mistral Large' },
  { id: 'mistral-small-latest',          provider: 'Mistral',   label: 'Mistral Small' },
  { id: 'mistral-embed',                 provider: 'Mistral',   label: 'Mistral Embed' },
  { id: 'command-r-plus',                provider: 'Cohere',    label: 'Command R+' },
  { id: 'command-r',                     provider: 'Cohere',    label: 'Command R' },
  { id: 'embed-multilingual-v3.0',       provider: 'Cohere',    label: 'Embed Multilingual v3' },
]

function ModelIdInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open,    setOpen]    = useState(false)
  const [query,   setQuery]   = useState(value)
  const wrapRef = useRef<HTMLDivElement>(null)

  // sync jika value berubah dari luar (edit mode)
  useEffect(() => { setQuery(value) }, [value])

  // tutup dropdown kalau klik di luar
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = query.trim()
    ? MODEL_SUGGESTIONS.filter(m =>
        m.id.toLowerCase().includes(query.toLowerCase()) ||
        m.label.toLowerCase().includes(query.toLowerCase()) ||
        m.provider.toLowerCase().includes(query.toLowerCase())
      )
    : MODEL_SUGGESTIONS

  const groups = filtered.reduce<Record<string, ModelSuggestion[]>>((acc, m) => {
    if (!acc[m.provider]) acc[m.provider] = []
    acc[m.provider].push(m)
    return acc
  }, {})

  function select(id: string) {
    setQuery(id)
    onChange(id)
    setOpen(false)
  }

  const inputCls = 'w-full px-3 py-2.5 rounded-xl text-sm text-t1 placeholder-[#3F3F46] outline-none transition-all duration-150'
  const inputStyle = { background: 'var(--fill-3)', border: '1px solid var(--bdr-4)' }
  const focusStyle = { border: '1px solid rgba(10,132,255,0.5)', boxShadow: '0 0 0 3px rgba(10,132,255,0.08)' }

  return (
    <div ref={wrapRef} className="relative">
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true) }}
        onFocus={e => { Object.assign(e.target.style, focusStyle); setOpen(true) }}
        onBlur={e => Object.assign(e.target.style, inputStyle)}
        placeholder="Ketik untuk cari... gemini, gpt, claude, dst"
        autoComplete="off"
        className={inputCls}
        style={inputStyle}
      />
      {query && (
        <button type="button" onClick={() => { setQuery(''); onChange(''); setOpen(true) }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-t5 hover:text-t3 transition-colors">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      )}

      {open && Object.keys(groups).length > 0 && (
        <div className="absolute z-50 w-full mt-1.5 rounded-xl overflow-hidden shadow-2xl"
          style={{ background: 'var(--elevated)', border: '1px solid var(--bdr-5)', maxHeight: 260, overflowY: 'auto' }}>
          {Object.entries(groups).map(([provider, models]) => (
            <div key={provider}>
              <p className="px-3 pt-2.5 pb-1 text-2xs font-semibold text-t5 uppercase tracking-widest">
                {provider}
              </p>
              {models.map(m => (
                <button key={m.id} type="button"
                  onMouseDown={() => select(m.id)}
                  className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/[0.06] transition-colors group">
                  <div>
                    <span className="text-sm text-t1">{m.label}</span>
                    <span className="text-xs text-t4 ml-2">{m.id}</span>
                  </div>
                  {value === m.id && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0A84FF" strokeWidth="2.5" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </button>
              ))}
            </div>
          ))}
          {query && !MODEL_SUGGESTIONS.find(m => m.id === query) && (
            <div>
              <p className="px-3 pt-2.5 pb-1 text-2xs font-semibold text-t5 uppercase tracking-widest">Custom</p>
              <button type="button" onMouseDown={() => select(query)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.06] transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#52525B" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                <span className="text-sm text-t2">Gunakan "<span className="text-t1 font-medium">{query}</span>"</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const EMPTY_AI: AIModel = { id: '', name: '', api_key: '', model: '' }

interface AIModelFormProps {
  initial?: AIModel | null
  onSave: (entry: AIModel) => void
  onCancel: () => void
}
function AIModelForm({ initial, onSave, onCancel }: AIModelFormProps) {
  const [form, setForm] = useState<AIModel>(initial ?? EMPTY_AI)
  const [showKey, setShowKey] = useState(false)
  const set = (k: keyof AIModel) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  const inputCls = 'w-full px-3 py-2.5 rounded-xl text-sm text-t1 placeholder-[#3F3F46] outline-none transition-all duration-150'
  const inputStyle = { background: 'var(--fill-3)', border: '1px solid var(--bdr-4)' }
  const focusStyle = { border: '1px solid rgba(10,132,255,0.5)', boxShadow: '0 0 0 3px rgba(10,132,255,0.08)' }

  return (
    <div className="space-y-3 p-4 rounded-xl" style={{ background: 'rgba(10,132,255,0.04)', border: '1px solid rgba(10,132,255,0.15)' }}>
      <p className="text-xs font-semibold text-accent">{initial ? 'Edit Model' : 'Tambah Model Baru'}</p>

      <div>
        <label className="block text-xs text-t3 mb-1">Nama</label>
        <input value={form.name} onChange={set('name')} placeholder="Gemini, OpenAI, Claude, dst"
          autoComplete="off"
          className={inputCls} style={inputStyle}
          onFocus={e => Object.assign(e.target.style, focusStyle)}
          onBlur={e => Object.assign(e.target.style, inputStyle)} />
      </div>

      <div>
        <label className="block text-xs text-t3 mb-1">API Key</label>
        <div className="relative">
          <input value={form.api_key} onChange={set('api_key')}
            type={showKey ? 'text' : 'password'} placeholder="AIzaSy... / sk-... / dst"
            autoComplete="new-password"
            className={inputCls + ' pr-10'} style={inputStyle}
            onFocus={e => Object.assign(e.target.style, focusStyle)}
            onBlur={e => Object.assign(e.target.style, inputStyle)} />
          <button type="button" onClick={() => setShowKey(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-t4 hover:text-t2 transition-colors" tabIndex={-1}>
            <EyeIcon open={showKey} />
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs text-t3 mb-1">Model ID</label>
        <ModelIdInput
          value={form.model}
          onChange={val => setForm(f => ({ ...f, model: val }))}
        />
        <p className="text-2xs text-t5 mt-1">Ketik untuk cari atau isi manual model ID kustom</p>
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={() => form.name.trim() && form.api_key.trim() && onSave(form)}
          disabled={!form.name.trim() || !form.api_key.trim()}
          className="flex-1 py-2 rounded-xl text-sm font-semibold text-t1 transition-all hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ background: '#0A84FF' }}>
          {initial ? 'Simpan' : 'Tambah'}
        </button>
        <button onClick={onCancel}
          className="flex-1 py-2 rounded-xl text-sm font-medium text-t3 hover:text-t1 transition-colors"
          style={{ background: 'var(--fill-3)', border: '1px solid var(--bdr-3)' }}>
          Batal
        </button>
      </div>
    </div>
  )
}

interface AIModelsPanelProps {
  savedList?: AIModel[]
  onSaveAll: (list: AIModel[]) => void
  saving: boolean
}
function AIModelsPanel({ savedList = [], onSaveAll, saving }: AIModelsPanelProps) {
  const [list,    setList]    = useState<AIModel[]>(savedList)
  const [adding,  setAdding]  = useState(false)
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [showKey, setShowKey] = useState<Record<number, boolean>>({})

  useEffect(() => { setList(savedList) }, [savedList])

  function handleAdd(entry: AIModel) {
    const next = [...list, { ...entry, id: crypto.randomUUID() }]
    setList(next); setAdding(false)
  }

  function handleEdit(idx: number, entry: AIModel) {
    const next = list.map((m, i) => i === idx ? { ...m, ...entry } : m)
    setList(next); setEditIdx(null)
  }

  function handleDelete(idx: number) {
    setList(list.filter((_, i) => i !== idx))
  }

  function toggleKey(idx: number) {
    setShowKey(s => ({ ...s, [idx]: !s[idx] }))
  }

  return (
    <div className="space-y-4">
      {list.length === 0 && !adding && (
        <div className="text-center py-10">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
            style={{ background: 'var(--fill-3)', border: '1px solid var(--bdr-3)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3F3F46" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a4 4 0 0 1 4 4v1h1a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3h1V6a4 4 0 0 1 4-4z"/>
              <circle cx="12" cy="14" r="2"/>
            </svg>
          </div>
          <p className="text-sm text-t4">Belum ada model. Tambahkan model AI pertama.</p>
        </div>
      )}

      {list.map((m, idx) => (
        <div key={m.id ?? idx}>
          {editIdx === idx ? (
            <AIModelForm initial={m} onSave={e => handleEdit(idx, e)} onCancel={() => setEditIdx(null)} />
          ) : (
            <div className="flex items-center gap-3 p-4 rounded-xl group"
              style={{ background: 'var(--fill-2)', border: '1px solid var(--bdr-3)' }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(10,132,255,0.1)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0A84FF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a4 4 0 0 1 4 4v1h1a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3h1V6a4 4 0 0 1 4-4z"/>
                  <circle cx="12" cy="14" r="2"/>
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-t1">{m.name}</p>
                <p className="text-xs text-t4 mt-0.5 truncate">{m.model || '—'}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <code className="text-2xs text-t5 font-mono">
                    {showKey[idx] ? m.api_key : (m.api_key.slice(0, 6) + '••••••' + m.api_key.slice(-3))}
                  </code>
                  <button onClick={() => toggleKey(idx)}
                    className="text-t5 hover:text-t3 transition-colors">
                    <EyeIcon open={!!showKey[idx]} />
                  </button>
                </div>
              </div>

              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button onClick={() => { setEditIdx(idx); setAdding(false) }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-t3 hover:text-t1 hover:bg-white/10 transition-all">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button onClick={() => handleDelete(idx)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-t3 hover:text-[#FF453A] hover:bg-red-500/10 transition-all">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14H6L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                    <path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {adding && (
        <AIModelForm onSave={handleAdd} onCancel={() => setAdding(false)} />
      )}

      {!adding && editIdx === null && (
        <div className="flex items-center gap-3 pt-1">
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-accent hover:bg-accent/10 transition-all"
            style={{ border: '1px dashed rgba(10,132,255,0.35)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Tambah Model
          </button>
          <button onClick={() => onSaveAll(list)} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-t1 transition-all hover:opacity-90 disabled:opacity-40"
            style={{ background: '#0A84FF' }}>
            {saving ? 'Menyimpan…' : 'Simpan Semua'}
          </button>
        </div>
      )}
    </div>
  )
}

interface FieldRowProps {
  field: CredField
  value: string
  onChange: (key: string, val: string) => void
}
function FieldRow({ field, value, onChange }: FieldRowProps) {
  const [show, setShow] = useState(false)
  const isPassword = field.type === 'password'

  const inputCls = 'w-full px-3 py-2.5 rounded-xl text-sm text-t1 placeholder-[#3F3F46] outline-none transition-all duration-150'
  const inputStyle = {
    background: 'var(--fill-3)',
    border: '1px solid var(--bdr-4)',
  }

  return (
    <div>
      <label className="block text-xs font-medium text-t3 mb-1.5">{field.label}</label>
      <div className="relative">
        <input
          type={isPassword && !show ? 'password' : 'text'}
          value={value}
          onChange={e => onChange(field.key, e.target.value)}
          placeholder={field.placeholder}
          autoComplete="new-password"
          className={inputCls}
          style={inputStyle}
          onFocus={e => { e.target.style.border = '1px solid rgba(10,132,255,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(10,132,255,0.08)' }}
          onBlur={e => { e.target.style.border = '1px solid var(--bdr-4)'; e.target.style.boxShadow = 'none' }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-t4 hover:text-t2 transition-colors"
            tabIndex={-1}
          >
            <EyeIcon open={show} />
          </button>
        )}
      </div>
      {field.hint && (
        <p className="text-2xs text-t5 mt-1">{field.hint}</p>
      )}
    </div>
  )
}

function Toast({ toast }: { toast: ToastState }) {
  return (
    <div className="fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium shadow-xl z-50"
      style={{
        background: toast.ok ? 'rgba(50,215,75,0.12)' : 'rgba(255,69,58,0.12)',
        border: `1px solid ${toast.ok ? 'rgba(50,215,75,0.25)' : 'rgba(255,69,58,0.25)'}`,
        color: toast.ok ? '#32D74B' : '#FF453A',
      }}>
      {toast.ok
        ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      }
      {toast.text}
    </div>
  )
}

interface PanelProps {
  saved: any
  onSaved: any
  showToast: (ok: boolean, text: string) => void
  header: React.ReactNode
  toast: ToastState | null
}

function SupabasePanel({ saved, onSaved, showToast, header, toast }: PanelProps) {
  const existing = saved || {}
  const hasCreds = !!(existing.url && existing.service_key)

  const [editing,  setEditing]  = useState(!hasCreds)
  const [form,     setForm]     = useState({ url: existing.url || '', service_key: existing.service_key || '' })
  const [showKey,  setShowKey]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [testing,  setTesting]  = useState(false)

  const inputCls   = 'w-full px-3 py-2.5 rounded-xl text-sm text-t1 placeholder-[#3F3F46] outline-none transition-all duration-150'
  const inputStyle = { background: 'var(--fill-3)', border: '1px solid var(--bdr-4)' }
  const focusStyle = { border: '1px solid rgba(10,132,255,0.5)', boxShadow: '0 0 0 3px rgba(10,132,255,0.08)' }

  async function handleSave() {
    if (!form.url.trim() || !form.service_key.trim()) return
    setSaving(true)
    try {
      await fetch('/api/credentials/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'supabase', data: form }),
      })
      onSaved?.({ credId: 'supabase', data: form })
      showToast(true, 'Supabase berhasil disimpan')
      setEditing(false)
    } catch (e: any) {
      showToast(false, `Gagal menyimpan: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    try {
      const res  = await fetch('/api/credentials/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'supabase', data: form }),
      })
      const json = await res.json()
      showToast(!!json.ok, json.message || (json.ok ? 'Koneksi berhasil!' : 'Koneksi gagal'))
    } catch (e: any) {
      showToast(false, `Test gagal: ${e.message}`)
    } finally {
      setTesting(false)
    }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      await fetch('/api/credentials/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'supabase', data: {} }),
      })
      onSaved?.({ credId: 'supabase', data: {} })
      setForm({ url: '', service_key: '' })
      setEditing(true)
      showToast(true, 'Supabase credential dihapus')
    } catch (e: any) {
      showToast(false, `Gagal menghapus: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  function openStudio() {
    const base = (form.url || 'http://127.0.0.1:54321').replace(/\/+$/, '')
    const isLocal = base.includes('127.0.0.1') || base.includes('localhost')
    window.open(isLocal ? base.replace(/:\d+$/, ':54323') : 'https://app.supabase.com', '_blank')
  }

  const maskedKey = form.service_key
    ? form.service_key.slice(0, 10) + '••••••' + form.service_key.slice(-4)
    : ''

  return (
    <div className="p-8 min-h-screen">
      {header}
      <div className="rounded-2xl p-6 max-w-xl"
        style={{ background: 'var(--elevated)', border: '1px solid var(--bdr-3)' }}>
        <p className="text-xs font-semibold text-t5 uppercase tracking-widest mb-5">Konfigurasi</p>

        {!editing && hasCreds ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4 p-4 rounded-xl"
              style={{ background: 'rgba(62,207,142,0.05)', border: '1px solid rgba(62,207,142,0.15)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(62,207,142,0.1)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3ECF8E" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <ellipse cx="12" cy="5" rx="9" ry="3"/>
                  <path d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
                  <path d="M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono text-t1 truncate">{form.url}</p>
                <p className="text-xs text-t4 font-mono mt-0.5 truncate">
                  {showKey ? form.service_key : maskedKey}
                </p>
                <button onClick={() => setShowKey(s => !s)}
                  className="text-2xs text-t5 hover:text-t3 transition-colors mt-0.5">
                  {showKey ? 'Sembunyikan key' : 'Tampilkan key'}
                </button>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => setEditing(true)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-t3 hover:text-t1 hover:bg-white/10 transition-all"
                  title="Edit">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button onClick={handleDelete} disabled={saving}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-t3 hover:text-[#FF453A] hover:bg-red-500/10 transition-all"
                  title="Hapus">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14H6L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                    <path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={handleTest} disabled={testing}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-90 disabled:opacity-40"
                style={{ background: 'var(--fill-4)', border: '1px solid var(--bdr-4)', color: 'var(--txt-2)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
                {testing ? 'Testing…' : 'Test Koneksi'}
              </button>
              <button onClick={openStudio}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80"
                style={{ color: '#3ECF8E' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                Buka Studio
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-t3 mb-1.5">Project URL</label>
              <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                placeholder="http://127.0.0.1:54321" autoComplete="off"
                className={inputCls} style={inputStyle}
                onFocus={e => Object.assign(e.target.style, focusStyle)}
                onBlur={e => Object.assign(e.target.style, inputStyle)} />
              <p className="text-2xs text-t5 mt-1">URL API Supabase local (default: http://127.0.0.1:54321)</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-t3 mb-1.5">Service Key</label>
              <div className="relative">
                <input value={form.service_key} onChange={e => setForm(f => ({ ...f, service_key: e.target.value }))}
                  type={showKey ? 'text' : 'password'} placeholder="sb_secret_..."
                  autoComplete="new-password"
                  className={inputCls + ' pr-10'} style={inputStyle}
                  onFocus={e => Object.assign(e.target.style, focusStyle)}
                  onBlur={e => Object.assign(e.target.style, inputStyle)} />
                <button type="button" onClick={() => setShowKey(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-t4 hover:text-t2 transition-colors" tabIndex={-1}>
                  <EyeIcon open={showKey} />
                </button>
              </div>
              <p className="text-2xs text-t5 mt-1">Secret key dari output <code className="font-mono">supabase start</code></p>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={handleSave} disabled={!form.url.trim() || !form.service_key.trim() || saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-t1 transition-all hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: '#0A84FF' }}>
                {saving ? 'Menyimpan…' : 'Simpan'}
              </button>
              {hasCreds && (
                <button onClick={() => { setForm({ url: existing.url, service_key: existing.service_key }); setEditing(false) }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-t3 hover:text-t1 transition-colors"
                  style={{ background: 'var(--fill-3)', border: '1px solid var(--bdr-3)' }}>
                  Batal
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      {toast && <Toast toast={toast} />}
    </div>
  )
}

function TavilyPanel({ saved, onSaved, showToast, header, toast }: PanelProps) {
  const existing = saved || {}
  const hasCreds = !!(existing.api_key)

  const [editing, setEditing] = useState(!hasCreds)
  const [apiKey,  setApiKey]  = useState(existing.api_key || '')
  const [showKey, setShowKey] = useState(false)
  const [saving,  setSaving]  = useState(false)

  const inputCls   = 'w-full px-3 py-2.5 rounded-xl text-sm text-t1 placeholder-[#3F3F46] outline-none transition-all duration-150'
  const inputStyle = { background: 'var(--fill-3)', border: '1px solid var(--bdr-4)' }
  const focusStyle = { border: '1px solid rgba(10,132,255,0.5)', boxShadow: '0 0 0 3px rgba(10,132,255,0.08)' }

  const maskedKey = apiKey ? apiKey.slice(0, 8) + '••••••' + apiKey.slice(-4) : ''

  async function handleSave() {
    if (!apiKey.trim()) return
    setSaving(true)
    try {
      await fetch('/api/credentials/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'tavily', data: { api_key: apiKey.trim() } }),
      })
      onSaved?.({ credId: 'tavily', data: { api_key: apiKey.trim() } })
      showToast(true, 'Tavily API key berhasil disimpan & disync ke n8n')
      setEditing(false)
    } catch (e: any) {
      showToast(false, `Gagal menyimpan: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      await fetch('/api/credentials/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'tavily', data: {} }),
      })
      onSaved?.({ credId: 'tavily', data: {} })
      setApiKey('')
      setEditing(true)
      showToast(true, 'Tavily API key dihapus')
    } catch (e: any) {
      showToast(false, `Gagal menghapus: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8 min-h-screen">
      {header}
      <div className="rounded-2xl p-6 max-w-xl"
        style={{ background: 'var(--elevated)', border: '1px solid var(--bdr-3)' }}>
        <p className="text-xs font-semibold text-t5 uppercase tracking-widest mb-5">Konfigurasi</p>

        {!editing && hasCreds ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4 p-4 rounded-xl"
              style={{ background: 'rgba(191,90,242,0.05)', border: '1px solid rgba(191,90,242,0.15)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(191,90,242,0.1)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#BF5AF2" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-t4 mb-0.5">API Key</p>
                <p className="text-sm font-mono text-t1 truncate">
                  {showKey ? apiKey : maskedKey}
                </p>
                <button onClick={() => setShowKey(s => !s)}
                  className="text-2xs text-t5 hover:text-t3 transition-colors mt-0.5">
                  {showKey ? 'Sembunyikan key' : 'Tampilkan key'}
                </button>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => setEditing(true)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-t3 hover:text-t1 hover:bg-white/10 transition-all">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button onClick={handleDelete} disabled={saving}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-t3 hover:text-[#FF453A] hover:bg-red-500/10 transition-all">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                    <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              </div>
            </div>
            <p className="text-xs text-t5">
              Endpoint: <span className="font-mono">https://api.tavily.com/search</span>
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-t3 mb-1.5">API Key Tavily</label>
              <div className="relative">
                <input value={apiKey} onChange={e => setApiKey(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  type={showKey ? 'text' : 'password'} placeholder="tvly-dev-..."
                  autoComplete="new-password"
                  className={inputCls + ' pr-10'} style={inputStyle}
                  onFocus={e => Object.assign(e.target.style, focusStyle)}
                  onBlur={e => Object.assign(e.target.style, inputStyle)} />
                <button type="button" onClick={() => setShowKey(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-t4 hover:text-t2 transition-colors" tabIndex={-1}>
                  <EyeIcon open={showKey} />
                </button>
              </div>
              <p className="text-2xs text-t5 mt-1">Ambil API key dari <span className="text-t3">app.tavily.com</span></p>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={handleSave} disabled={!apiKey.trim() || saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-t1 transition-all hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: '#0A84FF' }}>
                {saving ? 'Menyimpan…' : 'Simpan'}
              </button>
              {hasCreds && (
                <button onClick={() => { setApiKey(existing.api_key); setEditing(false) }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-t3 hover:text-t1 transition-colors"
                  style={{ background: 'var(--fill-3)', border: '1px solid var(--bdr-3)' }}>
                  Batal
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      {toast && <Toast toast={toast} />}
    </div>
  )
}

function N8nPanel({ saved, onSaved, showToast, header, toast }: PanelProps) {
  const existing = saved || {}
  const hasCreds = !!(existing.url && existing.api_key)

  const [editing, setEditing] = useState(!hasCreds)
  const [form,    setForm]    = useState({ url: existing.url || '', api_key: existing.api_key || '' })
  const [showKey, setShowKey] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [testing, setTesting] = useState(false)

  const inputCls   = 'w-full px-3 py-2.5 rounded-xl text-sm text-t1 placeholder-[#3F3F46] outline-none transition-all duration-150'
  const inputStyle = { background: 'var(--fill-3)', border: '1px solid var(--bdr-4)' }
  const focusStyle = { border: '1px solid rgba(10,132,255,0.5)', boxShadow: '0 0 0 3px rgba(10,132,255,0.08)' }

  async function handleSave() {
    if (!form.url.trim() || !form.api_key.trim()) return
    setSaving(true)
    try {
      await fetch('/api/credentials/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'n8n', data: form }),
      })
      onSaved?.({ credId: 'n8n', data: form })
      showToast(true, 'n8n berhasil disimpan')
      setEditing(false)
    } catch (e: any) {
      showToast(false, `Gagal menyimpan: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    try {
      const res  = await fetch('/api/credentials/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'n8n', data: form }),
      })
      const json = await res.json()
      showToast(!!json.ok, json.message || (json.ok ? 'Koneksi berhasil!' : 'Koneksi gagal'))
    } catch (e: any) {
      showToast(false, `Test gagal: ${e.message}`)
    } finally {
      setTesting(false)
    }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      await fetch('/api/credentials/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'n8n', data: {} }),
      })
      onSaved?.({ credId: 'n8n', data: {} })
      setForm({ url: '', api_key: '' })
      setEditing(true)
      showToast(true, 'n8n credential dihapus')
    } catch (e: any) {
      showToast(false, `Gagal menghapus: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  const maskedKey = form.api_key
    ? form.api_key.slice(0, 8) + '••••••' + form.api_key.slice(-4)
    : ''

  return (
    <div className="p-8 min-h-screen">
      {header}
      <div className="rounded-2xl p-6 max-w-xl"
        style={{ background: 'var(--elevated)', border: '1px solid var(--bdr-3)' }}>
        <p className="text-xs font-semibold text-t5 uppercase tracking-widest mb-5">Konfigurasi</p>

        {!editing && hasCreds ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4 p-4 rounded-xl"
              style={{ background: 'rgba(255,109,90,0.05)', border: '1px solid rgba(255,109,90,0.15)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(255,109,90,0.1)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF6D5A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono text-t1 truncate">{form.url}</p>
                <p className="text-xs text-t4 font-mono mt-0.5 truncate">
                  {showKey ? form.api_key : maskedKey}
                </p>
                <button onClick={() => setShowKey(s => !s)}
                  className="text-2xs text-t5 hover:text-t3 transition-colors mt-0.5">
                  {showKey ? 'Sembunyikan key' : 'Tampilkan key'}
                </button>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => setEditing(true)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-t3 hover:text-t1 hover:bg-white/10 transition-all">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button onClick={handleDelete} disabled={saving}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-t3 hover:text-[#FF453A] hover:bg-red-500/10 transition-all">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                    <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={handleTest} disabled={testing}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-90 disabled:opacity-40"
                style={{ background: 'var(--fill-4)', border: '1px solid var(--bdr-4)', color: 'var(--txt-2)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
                {testing ? 'Testing…' : 'Test Koneksi'}
              </button>
              <button onClick={() => window.open(form.url, '_blank')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80"
                style={{ color: '#FF6D5A' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                Buka n8n
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-t3 mb-1.5">n8n URL</label>
              <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                placeholder="http://localhost:5678" autoComplete="off"
                className={inputCls} style={inputStyle}
                onFocus={e => Object.assign(e.target.style, focusStyle)}
                onBlur={e => Object.assign(e.target.style, inputStyle)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-t3 mb-1.5">API Key</label>
              <div className="relative">
                <input value={form.api_key} onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))}
                  type={showKey ? 'text' : 'password'} placeholder="eyJhbG..."
                  autoComplete="new-password"
                  className={inputCls + ' pr-10'} style={inputStyle}
                  onFocus={e => Object.assign(e.target.style, focusStyle)}
                  onBlur={e => Object.assign(e.target.style, inputStyle)} />
                <button type="button" onClick={() => setShowKey(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-t4 hover:text-t2 transition-colors" tabIndex={-1}>
                  <EyeIcon open={showKey} />
                </button>
              </div>
              <p className="text-2xs text-t5 mt-1">API key dari n8n Settings → API Keys</p>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={handleSave} disabled={!form.url.trim() || !form.api_key.trim() || saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-t1 transition-all hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: '#0A84FF' }}>
                {saving ? 'Menyimpan…' : 'Simpan'}
              </button>
              {hasCreds && (
                <button onClick={() => { setForm({ url: existing.url, api_key: existing.api_key }); setEditing(false) }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-t3 hover:text-t1 transition-colors"
                  style={{ background: 'var(--fill-3)', border: '1px solid var(--bdr-3)' }}>
                  Batal
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      {toast && <Toast toast={toast} />}
    </div>
  )
}

interface WAHAPanelProps {
  savedUrl: string
  onSaved: any
  showToast: (ok: boolean, text: string) => void
  header: React.ReactNode
  toast: ToastState | null
}
function WAHAPanel({ savedUrl, onSaved, showToast, header, toast }: WAHAPanelProps) {
  const [url,     setUrl]     = useState(savedUrl || '')
  const [editing, setEditing] = useState(!savedUrl)
  const [saving,  setSaving]  = useState(false)

  const inputCls   = 'w-full px-3 py-2.5 rounded-xl text-sm text-t1 placeholder-[#3F3F46] outline-none transition-all duration-150'
  const inputStyle = { background: 'var(--fill-3)', border: '1px solid var(--bdr-4)' }
  const focusStyle = { border: '1px solid rgba(10,132,255,0.5)', boxShadow: '0 0 0 3px rgba(10,132,255,0.08)' }

  const cleanUrl = url.trim().replace(/\/$/, '')

  async function handleSave() {
    if (!cleanUrl) return
    setSaving(true)
    try {
      await fetch('/api/credentials/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'waha', data: { url: cleanUrl } }),
      })
      onSaved?.({ credId: 'waha', data: { url: cleanUrl } })
      showToast(true, 'URL WAHA berhasil disimpan')
      setEditing(false)
    } catch (e: any) {
      showToast(false, `Gagal menyimpan: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      await fetch('/api/credentials/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'waha', data: {} }),
      })
      onSaved?.({ credId: 'waha', data: {} })
      setUrl('')
      setEditing(true)
      showToast(true, 'URL WAHA dihapus')
    } catch (e: any) {
      showToast(false, `Gagal menghapus: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8 min-h-screen">
      {header}
      <div className="rounded-2xl p-6 max-w-xl"
        style={{ background: 'var(--elevated)', border: '1px solid var(--bdr-3)' }}>
        <p className="text-xs font-semibold text-t5 uppercase tracking-widest mb-5">Admin Panel</p>

        {!editing && cleanUrl ? (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-4 p-4 rounded-xl"
              style={{ background: 'rgba(37,211,102,0.05)', border: '1px solid rgba(37,211,102,0.15)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(37,211,102,0.1)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6 6l.91-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-t4 mb-0.5">URL Admin Panel</p>
                <p className="text-sm font-mono text-t1 truncate">{cleanUrl}</p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => setEditing(true)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-t3 hover:text-t1 hover:bg-white/10 transition-all"
                  title="Edit URL">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button onClick={handleDelete} disabled={saving}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-t3 hover:text-[#FF453A] hover:bg-red-500/10 transition-all"
                  title="Hapus URL">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14H6L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                    <path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              </div>
            </div>

            <button
              onClick={() => window.open(cleanUrl, '_blank')}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-t1 transition-all hover:opacity-90"
              style={{ background: '#25D366' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              Buka Admin Panel
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-t3 mb-1.5">URL Admin Panel</label>
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                placeholder="http://localhost:3001"
                autoComplete="off"
                className={inputCls}
                style={inputStyle}
                onFocus={e => Object.assign(e.target.style, focusStyle)}
                onBlur={e => Object.assign(e.target.style, inputStyle)}
              />
              <p className="text-2xs text-t5 mt-1">Masukkan URL server WAHA, contoh: http://localhost:3001</p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={!cleanUrl || saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-t1 transition-all hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: '#0A84FF' }}>
                {saving ? 'Menyimpan…' : 'Simpan'}
              </button>
              {savedUrl && (
                <button onClick={() => { setUrl(savedUrl); setEditing(false) }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-t3 hover:text-t1 transition-colors"
                  style={{ background: 'var(--fill-3)', border: '1px solid var(--bdr-3)' }}>
                  Batal
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      {toast && <Toast toast={toast} />}
    </div>
  )
}

interface CredentialDetailProps {
  credId: string
  savedData?: SavedCreds
  onBack: () => void
  onSaved: (arg: { credId: string; data: unknown }) => void
}

export default function CredentialDetail({ credId, savedData = {}, onBack, onSaved }: CredentialDetailProps) {
  const cred   = CREDS.find(c => c.id === credId)
  const fields = FIELDS[credId] ?? []

  const [form,    setForm]    = useState<Record<string, string>>({})
  const [saving,  setSaving]  = useState(false)
  const [testing, setTesting] = useState(false)
  const [toast,   setToast]   = useState<ToastState | null>(null)

  useEffect(() => {
    if (credId === 'ai_models') return
    const existing = (savedData[credId] as Record<string, string>) ?? {}
    const initial: Record<string, string> = {}
    fields.forEach(f => { initial[f.key] = existing[f.key] ?? '' })
    setForm(initial)
  }, [credId, savedData])

  function handleChange(key: string, val: string) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  function showToast(ok: boolean, text: string) {
    setToast({ ok, text })
    setTimeout(() => setToast(null), 3500)
  }

  async function saveToBackend(id: string, data: unknown) {
    const res = await fetch('/api/credentials/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, data }),
    })
    if (!res.ok) throw new Error(await res.text())
  }

  async function handleSave() {
    setSaving(true)
    try {
      await saveToBackend(credId, form)
      showToast(true, 'Credential berhasil disimpan')
      onSaved?.({ credId, data: form })
    } catch (e: any) {
      showToast(false, `Gagal menyimpan: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveAIList(list: AIModel[]) {
    setSaving(true)
    try {
      await saveToBackend('ai_models', list)
      showToast(true, 'AI Models berhasil disimpan')
      onSaved?.({ credId: 'ai_models', data: list })
    } catch (e: any) {
      showToast(false, `Gagal menyimpan: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    try {
      const res = await fetch('/api/credentials/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: credId, data: form }),
      })
      const json = await res.json()
      showToast(!!json.ok, json.message || (json.ok ? 'Koneksi berhasil!' : 'Koneksi gagal'))
    } catch (e: any) {
      showToast(false, `Test gagal: ${e.message}`)
    } finally {
      setTesting(false)
    }
  }

  if (!cred) return (
    <div className="p-8">
      <p className="text-[#FF453A]">Credential tidak ditemukan: {credId}</p>
      <button onClick={onBack} className="text-accent text-sm mt-4 hover:underline">← Kembali</button>
    </div>
  )

  const header = (
    <>
      <button onClick={onBack}
        className="flex items-center gap-2 text-sm text-t3 hover:text-t1 transition-colors duration-150 mb-8 group">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          className="transition-transform duration-150 group-hover:-translate-x-0.5">
          <path d="M10 3L5 8l5 5"/>
        </svg>
        Kembali ke Credentials
      </button>
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: cred.color + '18', color: cred.color }}>
          {cred.icon}
        </div>
        <div>
          <h1 className="text-xl font-semibold text-t1">{cred.name}</h1>
          <p className="text-sm text-t4 mt-0.5">{cred.description}</p>
        </div>
      </div>
    </>
  )

  if (credId === 'supabase') {
    return <SupabasePanel saved={savedData['supabase']} onSaved={onSaved} showToast={showToast} header={header} toast={toast} />
  }

  if (credId === 'ai_models') {
    const savedList = Array.isArray(savedData['ai_models']) ? savedData['ai_models'] as AIModel[] : []
    return (
      <div className="p-8 min-h-screen">
        {header}
        <div className="rounded-2xl p-6 max-w-xl"
          style={{ background: 'var(--elevated)', border: '1px solid var(--bdr-3)' }}>
          <p className="text-xs font-semibold text-t5 uppercase tracking-widest mb-5">Daftar Model AI</p>
          <AIModelsPanel savedList={savedList} onSaveAll={handleSaveAIList} saving={saving} />
        </div>
        {toast && <Toast toast={toast} />}
      </div>
    )
  }

  if (credId === 'tavily') {
    return <TavilyPanel saved={savedData['tavily']} onSaved={onSaved} showToast={showToast} header={header} toast={toast} />
  }

  if (credId === 'n8n') {
    return <N8nPanel saved={savedData['n8n']} onSaved={onSaved} showToast={showToast} header={header} toast={toast} />
  }

  if (credId === 'waha') {
    return <WAHAPanel savedUrl={(savedData['waha'] as any)?.url || ''} onSaved={onSaved} showToast={showToast} header={header} toast={toast} />
  }

  return (
    <div className="p-8 min-h-screen">
      {header}

      <div className="rounded-2xl p-6 max-w-xl space-y-5"
        style={{ background: 'var(--elevated)', border: '1px solid var(--bdr-3)' }}>
        <p className="text-xs font-semibold text-t5 uppercase tracking-widest">Konfigurasi</p>

        {fields.length === 0 && (
          <p className="text-sm text-t4">Tidak ada field yang perlu dikonfigurasi.</p>
        )}

        {fields.map(field => (
          <FieldRow
            key={field.key}
            field={field}
            value={form[field.key] ?? ''}
            onChange={handleChange}
          />
        ))}

        <div className="flex items-center gap-3 pt-2">
          <Button
            variant="primary"
            size="md"
            loading={saving}
            onClick={handleSave}
            disabled={fields.length === 0}
          >
            Simpan
          </Button>
          {['supabase', 'n8n', 'bps_api'].includes(credId) && (
            <Button
              variant="secondary"
              size="md"
              loading={testing}
              onClick={handleTest}
              icon={
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
              }
            >
              Test Koneksi
            </Button>
          )}
        </div>

        {credId === 'supabase' && (
          <div className="pt-3 border-t mt-2" style={{ borderColor: 'var(--bdr-3)' }}>
            <button
              onClick={() => {
                const base = (form.url || 'http://127.0.0.1:54321').replace(/\/+$/, '')
                const studioPort = base.includes('127.0.0.1') || base.includes('localhost') ? '54323' : null
                const studioUrl = studioPort
                  ? base.replace(/:\d+$/, `:${studioPort}`)
                  : 'https://app.supabase.com'
                window.open(studioUrl, '_blank')
              }}
              className="flex items-center gap-2 text-sm text-[#3ECF8E] hover:opacity-80 transition-opacity"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              Buka Supabase Studio
            </button>
          </div>
        )}
      </div>

      {toast && <Toast toast={toast} />}
    </div>
  )
}
