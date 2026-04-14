'use client'

import Image from 'next/image'
import { useRouter, usePathname } from 'next/navigation'
import HomeOn from '@/assets/HomeOn.png'
import HomeOff from '@/assets/HomeOff.png'
import PracticeOn from '@/assets/PracticeOn.png'
import PracticeOff from '@/assets/PracticeOff.png'
import SessionsOn from '@/assets/Sessions.png'
import SessionsOff from '@/assets/SessionsOff.png'
import ProfileOn from '@/assets/ProfileOn.png'
import ProfileOff from '@/assets/ProfileOff.png'

const NAV_ITEMS = [
  { label: 'Home',     href: '/learner/home',     on: HomeOn,     off: HomeOff },
  { label: 'Practice', href: '/learner/practice', on: PracticeOn, off: PracticeOff },
  { label: 'Progress', href: '/learner/progress', on: SessionsOn, off: SessionsOff },
  { label: 'Profile',  href: '/learner/profile',  on: ProfileOn,  off: ProfileOff },
]

interface Props {
  onSignOut: () => void
  userName?: string
}

/** No top header — navigation is bottom-only */
export function LearnerHeader({ onSignOut, userName }: Props) {
  return null
}

/** Bottom tab bar with blue pill active state */
export function LearnerBottomNav() {
  const router   = useRouter()
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-100 flex items-center justify-around px-2 py-2">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href
        return (
          <button
            key={item.label}
            onClick={() => router.push(item.href)}
            className="flex items-center justify-center flex-1"
          >
            <span
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-2xl transition-all ${
                active ? 'bg-[#7DB2F6]' : ''
              }`}
            >
              <Image
                src={active ? item.on : item.off}
                alt={item.label}
                width={22}
                height={22}
                className="object-contain"
                style={active ? { filter: 'brightness(0) invert(1)' } : {}}
              />
              <span className={`text-[10px] font-semibold ${active ? 'text-white' : 'text-gray-400'}`}>
                {item.label}
              </span>
            </span>
          </button>
        )
      })}
    </nav>
  )
}

/** @deprecated */
export function LearnerSidebar({ onSignOut, userName }: Props) { return null }
