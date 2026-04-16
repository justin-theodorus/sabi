'use client'

import { useRouter, usePathname } from 'next/navigation'

interface NavItem {
  label: string
  href: string
  icon: (active: boolean) => React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Home',
    href: '/learner/home',
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
    label: 'Practice',
    href: '/learner/practice',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="11" r="8" stroke={active ? '#2D6BE4' : '#AAAAAA'} strokeWidth="1.5" />
        <path d="M9 8l5 3-5 3V8z" fill={active ? '#2D6BE4' : '#AAAAAA'} />
      </svg>
    ),
  },
  {
    label: 'Progress',
    href: '/learner/progress',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="3" y="13" width="4" height="6" rx="1.5" stroke={active ? '#2D6BE4' : '#AAAAAA'} strokeWidth="1.4" />
        <rect x="9" y="9" width="4" height="10" rx="1.5" stroke={active ? '#2D6BE4' : '#AAAAAA'} strokeWidth="1.4" />
        <rect x="15" y="5" width="4" height="14" rx="1.5" stroke={active ? '#2D6BE4' : '#AAAAAA'} strokeWidth="1.4" />
      </svg>
    ),
  },
  {
    label: 'Profile',
    href: '/learner/profile',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="8" r="3.5" stroke={active ? '#2D6BE4' : '#AAAAAA'} strokeWidth="1.5" />
        <path d="M3.5 19.5c0-4.142 3.358-7.5 7.5-7.5s7.5 3.358 7.5 7.5" stroke={active ? '#2D6BE4' : '#AAAAAA'} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
]

/** Bottom tab bar — learner app (4 tabs) */
export function LearnerBottomNav() {
  const router   = useRouter()
  const pathname = usePathname()

  return (
    <nav
      style={{
        height: 'var(--nav-h)',
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
      }}
      className="fixed bottom-0 left-0 right-0 z-20 flex items-center justify-center gap-1 px-4"
    >
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href
        return (
          <button
            key={item.label}
            onClick={() => router.push(item.href)}
            style={{
              background:   active ? 'var(--nav-active-bg)' : 'transparent',
              color:        active ? 'var(--nav-active-text)' : 'var(--text-muted)',
              borderRadius: '14px',
              minWidth:     '68px',
              padding:      '8px 18px',
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

/** @deprecated — top header removed, nav is bottom-only */
export function LearnerHeader({ onSignOut, userName }: { onSignOut: () => void; userName?: string }) {
  return null
}

/** @deprecated */
export function LearnerSidebar({ onSignOut, userName }: { onSignOut: () => void; userName?: string }) {
  return null
}
