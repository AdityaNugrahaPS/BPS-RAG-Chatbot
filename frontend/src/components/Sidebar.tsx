import { ReactNode } from 'react'
import clsx from 'clsx'

interface NavItem {
  id: string
  label: string
  icon: ReactNode
}

interface SidebarProps {
  currentPage: string
  onNavigate: (page: string, param: string | null) => void
  theme: string
  onToggleTheme: () => void
}

const NAV: NavItem[] = [
  {
    id: 'dashboard', label: 'Dashboard',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="1" width="6" height="6" rx="1.5" strokeWidth="1.4"/>
        <rect x="9" y="1" width="6" height="6" rx="1.5" strokeWidth="1.4"/>
        <rect x="1" y="9" width="6" height="6" rx="1.5" strokeWidth="1.4"/>
        <rect x="9" y="9" width="6" height="6" rx="1.5" strokeWidth="1.4"/>
      </svg>
    ),
  },
  {
    id: 'pdf-processor', label: 'PDF Processor',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 2.5A1.5 1.5 0 0 1 4.5 1h5L13 4.5V13.5A1.5 1.5 0 0 1 11.5 15h-7A1.5 1.5 0 0 1 3 13.5v-11Z" strokeWidth="1.4"/>
        <path d="M9.5 1v3.5H13" strokeWidth="1.4"/>
        <path d="M5.5 9h5M5.5 11.5h3" strokeWidth="1.4"/>
      </svg>
    ),
  },
  {
    id: 'credentials', label: 'Credentials',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    ),
  },
]

/* Sidebar selalu dark — teks selalu putih regardless tema */
const S = {
  text:    { color: 'rgba(255,255,255,0.90)' },
  subtext: { color: 'rgba(255,255,255,0.45)' },
  muted:   { color: 'rgba(255,255,255,0.30)' },
  border:  { borderColor: 'rgba(255,255,255,0.08)' },
  card:    { background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.12)' },
  hover:   'rgba(255,255,255,0.08)',
}

export default function Sidebar({ currentPage, onNavigate, theme, onToggleTheme }: SidebarProps) {
  const activePage = currentPage === 'credential-detail' ? 'credentials' : currentPage

  return (
    <aside className="w-[220px] h-full flex flex-col flex-shrink-0 overflow-y-auto"
      style={{ background: 'var(--sidebar-bg)', borderRight: '1px solid rgba(255,255,255,0.08)' }}>

      <div className="px-5 pt-6 pb-5 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-3">
          <div className="w-20 h-20 flex items-center justify-center flex-shrink-0">
            <img src="/logo-bps.png" alt="BPS" className="w-full h-full object-contain" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight" style={S.text}>BPS Kota Pekanbaru</p>
            <p className="text-xs mt-0.5" style={S.subtext}>Admin Panel</p>
          </div>
        </div>
      </div>

      <nav className="px-3 py-4 space-y-0.5 flex-1">
        <p className="text-2xs font-semibold uppercase tracking-widest px-3 mb-3" style={S.muted}>Menu</p>
        {NAV.map(item => {
          const active = activePage === item.id
          return (
            <button key={item.id} onClick={() => onNavigate(item.id, null)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150"
              style={{ background: active ? 'rgba(96,165,250,0.25)' : 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.14)' }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.20)' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.12)' }}
            >
              <span style={{ color: active ? '#60A5FA' : 'rgba(255,255,255,0.55)' }}>
                {item.icon}
              </span>
              <span className="text-sm font-medium flex-1"
                style={{ color: active ? '#60A5FA' : 'rgba(255,255,255,0.85)' }}>
                {item.label}
              </span>
              {active && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ color: '#60A5FA', opacity: 0.6 }}>
                  <path d="M3 2l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          )
        })}
      </nav>

      <div className="px-3 pb-5 pt-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <button onClick={onToggleTheme}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl mb-2 transition-all duration-150"
          style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.14)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}>
          {theme === 'dark' ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"/>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
          <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.75)' }}>
            {theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
          </span>
        </button>

        <div className="px-3 py-2.5 rounded-xl flex items-center gap-2.5"
          style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.14)' }}>
          <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.10)' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>BPS RAG System</p>
            <p className="text-2xs mt-0.5" style={{ color: 'rgba(255,255,255,0.40)' }}>v1.0.0</p>
          </div>
        </div>
      </div>

    </aside>
  )
}
