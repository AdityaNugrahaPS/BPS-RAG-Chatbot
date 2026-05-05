import type { CredDef, SavedCreds } from '../types'

const CREDS: CredDef[] = [
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'Database vector & penyimpanan dokumen BPS',
    color: '#3ECF8E',
    keys: ['url', 'service_key'],
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3"/>
        <path d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
        <path d="M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6"/>
      </svg>
    ),
  },
  {
    id: 'ai_models',
    name: 'AI Models',
    description: 'Kelola API key dan model untuk berbagai provider AI (Gemini, OpenAI, dll)',
    color: '#4285F4',
    keys: [],
    isList: true,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a4 4 0 0 1 4 4v1h1a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3h1V6a4 4 0 0 1 4-4z"/>
        <circle cx="12" cy="14" r="2"/>
      </svg>
    ),
  },
  {
    id: 'waha',
    name: 'WAHA (WhatsApp)',
    description: 'WhatsApp API untuk terima & kirim pesan',
    color: '#25D366',
    keys: ['url', 'api_key'],
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6 6l.91-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
      </svg>
    ),
  },
  {
    id: 'n8n',
    name: 'n8n',
    description: 'Workflow automation engine untuk orkestrasi chatbot',
    color: '#FF6D5A',
    keys: ['url', 'api_key'],
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3"/>
        <circle cx="6" cy="12" r="3"/>
        <circle cx="18" cy="19" r="3"/>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
      </svg>
    ),
  },
]

export { CREDS }

interface CredentialsProps {
  savedData?: SavedCreds
  onNavigate: (page: string, id: string) => void
}

export default function Credentials({ savedData = {}, onNavigate }: CredentialsProps) {
  function isConfigured(cred: CredDef) {
    if (cred.isList) {
      const list = savedData[cred.id]
      return Array.isArray(list) && list.length > 0
    }
    const d = (savedData[cred.id] as Record<string, string>) ?? {}
    return cred.keys.some(k => d[k] && String(d[k]).trim() !== '')
  }

  function badgeLabel(cred: CredDef) {
    if (cred.isList) {
      const list = savedData[cred.id]
      const n = Array.isArray(list) ? list.length : 0
      return n > 0 ? `${n} model` : 'Belum'
    }
    return isConfigured(cred) ? 'Aktif' : 'Belum'
  }

  return (
    <div className="p-8 space-y-8 min-h-screen">

      <div>
        <h1 className="text-xl font-semibold text-t1">Credentials</h1>
        <p className="text-sm text-t3 mt-1">
          Kelola API key dan konfigurasi koneksi untuk setiap layanan
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {CREDS.map(cred => {
          const configured = isConfigured(cred)
          return (
            <button
              key={cred.id}
              onClick={() => onNavigate('credential-detail', cred.id)}
              className="text-left rounded-2xl p-5 transition-all duration-200 group focus:outline-none"
              style={{
                background: 'var(--elevated)',
                border: '1px solid var(--bdr-3)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.border = '1px solid var(--bdr-5)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.border = '1px solid var(--bdr-3)'
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{ background: cred.color + '18', color: cred.color }}
              >
                {cred.icon}
              </div>

              <div className="flex items-start justify-between gap-2 mb-1.5">
                <p className="text-sm font-semibold text-t1 leading-snug">{cred.name}</p>
                <span
                  className="text-2xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 mt-0.5"
                  style={configured
                    ? { background: 'rgba(50,215,75,0.12)', color: '#32D74B' }
                    : { background: 'var(--fill-3)', color: 'var(--txt-4)' }
                  }
                >
                  {badgeLabel(cred)}
                </span>
              </div>

              <p className="text-xs text-t4 leading-relaxed line-clamp-2">{cred.description}</p>

              <div className="flex items-center gap-1 mt-4 text-xs text-t5 group-hover:text-t3 transition-colors duration-150">
                <span>Konfigurasi</span>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2.5 6h7M6.5 3l3 3-3 3"/>
                </svg>
              </div>
            </button>
          )
        })}
      </div>

      <p className="text-center text-xs text-t5 pb-4">
        BPS Kota Pekanbaru · Chatbot Admin · Credentials Manager
      </p>
    </div>
  )
}
