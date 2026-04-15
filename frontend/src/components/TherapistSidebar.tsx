'use client'

import { usePathname, useRouter } from 'next/navigation'

interface NavItem {
  label: string
  href: string
  icon: (active: boolean) => React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Home',
    href: '/therapist/dashboard',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path
          d="M3 10.5L11 3l8 7.5V19a1 1 0 01-1 1H4a1 1 0 01-1-1v-8.5z"
          fill={active ? '#2D6BE4' : 'none'}
          stroke={active ? '#2D6BE4' : '#AAAAAA'}
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path d="M8 20v-7h6v7" stroke={active ? '#fff' : '#AAAAAA'} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: 'Patients',
    href: '/therapist/reports',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="9" cy="8" r="3.5" stroke={active ? '#2D6BE4' : '#AAAAAA'} strokeWidth="1.5" />
        <circle cx="15.5" cy="8" r="2.8" stroke={active ? '#2D6BE4' : '#AAAAAA'} strokeWidth="1.4" />
        <path d="M2 19c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke={active ? '#2D6BE4' : '#AAAAAA'} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M17 13c2 0 3.5 1.8 3.5 4" stroke={active ? '#2D6BE4' : '#AAAAAA'} strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'Sessions',
    href: '/therapist/sessions',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="4" y="4" width="14" height="14" rx="2.5" stroke={active ? '#2D6BE4' : '#AAAAAA'} strokeWidth="1.5" />
        <path d="M8 9h6M8 12h6M8 15h4" stroke={active ? '#2D6BE4' : '#AAAAAA'} strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'Library',
    href: '/therapist/scenarios',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="3" y="7" width="16" height="12" rx="2.5" stroke={active ? '#2D6BE4' : '#AAAAAA'} strokeWidth="1.5" />
        <path d="M8 7V6a3 3 0 016 0v1" stroke={active ? '#2D6BE4' : '#AAAAAA'} strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="11" cy="13" r="2" stroke={active ? '#2D6BE4' : '#AAAAAA'} strokeWidth="1.4" />
      </svg>
    ),
  },
  {
    label: 'Profile',
    href: '/therapist/profile',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="8" r="3.5" stroke={active ? '#2D6BE4' : '#AAAAAA'} strokeWidth="1.5" />
        <path d="M3.5 19.5c0-4.142 3.358-7.5 7.5-7.5s7.5 3.358 7.5 7.5" stroke={active ? '#2D6BE4' : '#AAAAAA'} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
]

/** Bottom tab bar — therapist app (5 tabs) */
export function TherapistBottomNav() {
  const pathname = usePathname()
  const router   = useRouter()

  return (
    <nav
      style={{
        height:     'var(--nav-h)',
        background: 'var(--surface)',
        borderTop:  '1px solid var(--border)',
      }}
      className="fixed bottom-0 left-0 right-0 z-20 flex items-center justify-center gap-1 px-4"
    >
      {NAV_ITEMS.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== '/therapist/dashboard' && pathname.startsWith(item.href))
        return (
          <button
            key={item.label}
            onClick={() => router.push(item.href)}
            style={{
              background:   active ? 'var(--nav-active-bg)' : 'transparent',
              color:        active ? 'var(--nav-active-text)' : 'var(--text-muted)',
              borderRadius: '14px',
              minWidth:     '64px',
              padding:      '8px 14px',
              border:       'none',
              cursor:       'pointer',
              fontFamily:   'var(--font)',
              transition:   'background 0.15s',
            }}
            className="flex flex-col items-center gap-1"
          >
            {item.icon(active)}
            <span style={{ fontSize: '12px', fontWeight: 600 }}>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

/** @deprecated */
export function TherapistHeader({ therapistName, onSignOut }: { therapistName: string; onSignOut: () => void }) {
  return null
}
/** @deprecated */
export function TherapistSidebar({ therapistName, onSignOut }: { therapistName: string; onSignOut: () => void }) {
  return null
}
/** @deprecated */
export function TherapistMobileHeader({ title, onSignOut }: { title: string; onSignOut: () => void }) {
  return null
}
