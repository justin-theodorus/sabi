'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const SCENES = [
  {
    id: 'hawker-centre',
    emoji: '🍜',
    title: 'Hawker Centre',
    subtitle: 'Order your fav food',
    bg: 'bg-[#FFF8E7]',
    href: '/learner/mood',
  },
  {
    id: 'group-project',
    emoji: '📚',
    title: 'Group Project',
    subtitle: 'Work with teammates',
    bg: 'bg-[#E8F4F8]',
    isNew: true,
    href: '/learner/mood',
  },
  {
    id: 'library',
    emoji: '🏛️',
    title: 'Library',
    subtitle: 'Find your next book',
    bg: 'bg-[#EEF6EE]',
    href: '/learner/mood',
  },
  {
    id: 'playground',
    emoji: '🎪',
    title: 'Playground',
    subtitle: 'Play with friends',
    bg: 'bg-[#F5EEFF]',
    href: '/learner/mood',
  },
]

const NAV_ITEMS = [
  { label: 'Home', icon: '🏠', href: '/learner/home' },
  { label: 'Practice', icon: '🎭', href: '/learner/mood' },
  { label: 'Progress', icon: '📈', href: '/learner/home' },
  { label: 'Profile', icon: '👤', href: '/learner/home' },
]

export default function LearnerHomePage() {
  const router = useRouter()
  const pathname = usePathname()
  const [authChecked, setAuthChecked] = useState(false)
  const [userName, setUserName] = useState('Learner')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/')
      } else {
        const email = session.user.email ?? ''
        const name = email.split('@')[0]
        setUserName(name.charAt(0).toUpperCase() + name.slice(1))
        setAuthChecked(true)
      }
    })
  }, [router])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5EFE8]">
        <div className="text-[#E8714A] text-xl font-bold">Loading…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5EFE8] flex">
      {/* ── Sidebar nav (md+) ── */}
      <aside className="hidden md:flex flex-col w-20 lg:w-56 bg-white border-r border-gray-100 flex-shrink-0 sticky top-0 h-screen">
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 pt-6 pb-8">
          <div className="w-10 h-10 bg-[#E8714A] rounded-2xl flex items-center justify-center shadow-sm flex-shrink-0">
            <span className="text-white text-xl">💬</span>
          </div>
          <div className="hidden lg:block">
            <p className="text-gray-900 font-extrabold text-base leading-none">SABI</p>
            <p className="text-[#E8714A] text-[10px] font-bold tracking-widest">LEARNER</p>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 flex flex-col gap-1 px-2">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href
            return (
              <button
                key={item.label}
                onClick={() => router.push(item.href)}
                className={`flex items-center gap-3 px-3 py-3 rounded-2xl transition-colors w-full text-left
                  ${active
                    ? 'bg-[#FDE8DC] text-[#E8714A]'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }`}
              >
                <span className="text-2xl flex-shrink-0">{item.icon}</span>
                <span className="hidden lg:block text-sm font-semibold">{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Sign out */}
        <div className="px-2 pb-6">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-3 rounded-2xl text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors w-full text-left"
          >
            <span className="text-2xl flex-shrink-0">🚪</span>
            <span className="hidden lg:block text-sm font-semibold">Sign out</span>
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-5 pt-6 pb-3 bg-[#F5EFE8]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-[#E8714A] rounded-2xl flex items-center justify-center shadow-sm">
              <span className="text-white text-xl">💬</span>
            </div>
            <div>
              <p className="text-gray-900 font-extrabold text-lg leading-none">SABI</p>
              <p className="text-[#E8714A] text-xs font-bold tracking-widest">LEARNER</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full border-2 border-[#E8714A] text-[#E8714A] text-sm font-bold hover:bg-[#E8714A] hover:text-white transition-colors"
            >
              Switch ⇄
            </button>
            <button className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm relative">
              <span className="text-lg">🔔</span>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#E8714A] rounded-full" />
            </button>
          </div>
        </header>

        {/* Desktop top bar */}
        <header className="hidden md:flex items-center justify-between px-8 py-5 bg-[#F5EFE8]">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Home</h1>
            <p className="text-gray-500 text-sm">Welcome back, {userName}!</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm relative">
              <span className="text-lg">🔔</span>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#E8714A] rounded-full" />
            </button>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto pb-24 md:pb-8 px-5 md:px-8 space-y-5">
          {/* Top section: Hero + Continue side-by-side on desktop */}
          <div className="flex flex-col lg:flex-row gap-5">
            {/* Hero XP Card */}
            <div className="relative bg-[#FDE8DC] rounded-3xl p-5 overflow-hidden flex-1">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#F5C9B8] rounded-full -translate-y-1/3 translate-x-1/3 opacity-60" />
              <div className="absolute bottom-0 left-16 w-20 h-20 bg-[#F5C9B8] rounded-full translate-y-1/3 opacity-40" />

              <div className="relative flex items-start gap-4">
                <div className="flex-shrink-0 relative">
                  <span className="text-6xl block">🐟</span>
                  <div className="absolute -bottom-1 -left-1 bg-yellow-400 text-gray-900 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow">
                    🔥 5
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[#E8714A] text-xs font-bold tracking-widest uppercase mb-0.5">
                    Curious Clownfish
                  </p>
                  <h2 className="text-gray-900 text-2xl font-extrabold leading-tight">
                    Hey, {userName}!
                  </h2>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-500 font-medium mb-1">
                      <span>XP 340</span>
                      <span>500</span>
                    </div>
                    <div className="h-2.5 bg-white/60 rounded-full overflow-hidden">
                      <div className="h-full bg-[#E8714A] rounded-full" style={{ width: '68%' }} />
                    </div>
                  </div>
                  <div className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-yellow-700">
                    <span>⭐</span> Explorer
                  </div>
                </div>
              </div>
            </div>

            {/* Continue Card */}
            <div className="bg-white rounded-3xl p-4 shadow-sm flex items-center gap-4 lg:w-80 lg:flex-shrink-0">
              <div className="w-14 h-14 bg-[#FFF8E7] rounded-2xl flex items-center justify-center text-3xl flex-shrink-0">
                🍜
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 font-bold text-base leading-tight">Continue: Hawker Centre</p>
                <p className="text-gray-400 text-xs mt-0.5">Round 2 · 45% done · 2 days ago</p>
                <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-400 rounded-full" style={{ width: '45%' }} />
                </div>
              </div>
              <button
                onClick={() => router.push('/learner/mood')}
                className="flex-shrink-0 bg-[#E8714A] hover:bg-[#d4613c] text-white font-bold text-sm px-4 py-3 rounded-2xl transition-colors shadow-sm"
              >
                Resume
              </button>
            </div>
          </div>

          {/* Choose a Scene */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-gray-900 text-xl font-extrabold">Choose a Scene</h3>
              <button className="text-[#4DB6AC] text-sm font-semibold">See all →</button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {SCENES.map((scene) => (
                <button
                  key={scene.id}
                  onClick={() => router.push(scene.href)}
                  className={`${scene.bg} rounded-3xl p-4 text-left relative overflow-hidden transition-transform active:scale-95 shadow-sm hover:shadow-md`}
                >
                  {scene.isNew && (
                    <span className="absolute top-3 right-3 bg-[#E8714A] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      NEW
                    </span>
                  )}
                  <span className="text-4xl block mb-3">{scene.emoji}</span>
                  <p className="text-gray-900 font-bold text-base leading-tight">{scene.title}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{scene.subtitle}</p>
                </button>
              ))}
            </div>
          </div>
        </main>

        {/* Bottom nav (mobile only) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-2 py-2 flex items-center justify-around z-10">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href
            return (
              <button
                key={item.label}
                onClick={() => router.push(item.href)}
                className="flex flex-col items-center gap-0.5 px-4 py-1 relative"
              >
                <span className="text-2xl">{item.icon}</span>
                <span className={`text-xs font-semibold ${active ? 'text-[#E8714A]' : 'text-gray-400'}`}>
                  {item.label}
                </span>
                {active && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[#E8714A] rounded-full" />
                )}
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
