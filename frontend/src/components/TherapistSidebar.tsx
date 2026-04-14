'use client'

import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import HomeOn from '@/assets/HomeOn.png'
import HomeOff from '@/assets/HomeOff.png'
import SessionsOn from '@/assets/Sessions.png'
import SessionsOff from '@/assets/SessionsOff.png'
import PatientsOn from '@/assets/Patients.png'
import PatientsOff from '@/assets/PatientOff.png'
import LibraryOn from '@/assets/PracticeOn.png'
import LibraryOff from '@/assets/PracticeOff.png'
import ProfileOn from '@/assets/ProfileOn.png'
import ProfileOff from '@/assets/ProfileOff.png'

const NAV_ITEMS = [
  { label: 'Home',     href: '/therapist/dashboard', on: HomeOn,     off: HomeOff },
  { label: 'Patients', href: '/therapist/reports',   on: PatientsOn, off: PatientsOff },
  { label: 'Sessions', href: '/therapist/sessions',  on: SessionsOn, off: SessionsOff },
  { label: 'Library',  href: '/therapist/scenarios', on: LibraryOn,  off: LibraryOff },
  { label: 'Profile',  href: '/therapist/profile',   on: ProfileOn,  off: ProfileOff },
]

interface Props {
  therapistName: string
  onSignOut: () => void
}

/** No top header — navigation is bottom-only */
export function TherapistHeader({ therapistName, onSignOut }: Props) {
  return null
}

/** Bottom tab bar with blue pill active state */
export function TherapistBottomNav() {
  const pathname = usePathname()
  const router   = useRouter()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-100 flex items-center justify-around px-2 py-2">
      {NAV_ITEMS.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== '/therapist/dashboard' && pathname.startsWith(item.href))
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
export function TherapistSidebar({ therapistName, onSignOut }: Props) { return null }
export function TherapistMobileHeader({ title, onSignOut }: { title: string; onSignOut: () => void }) { return null }
