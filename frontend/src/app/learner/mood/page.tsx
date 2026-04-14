'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import logo from '@/assets/Logo.png'

const QUESTIONS = [
  {
    id: 'mood',
    question: 'Hi there! How are you feeling today?',
    options: ['Happy', 'Okay', 'Tired', 'Nervous'],
  },
  {
    id: 'energy',
    question: 'How much fuel is in your tank right now?',
    options: [
      'I want to try everything, even if I fail!',
      "I'd prefer to get it right the first time; let's go slow.",
      'Mistakes are just obstacles to smash through!',
    ],
  },
  {
    id: 'volume',
    question: 'If this lesson were a conversation, how loud are we talking?',
    options: [
      "I'm ready to shout the answers!",
      "I'd rather just observe and type quietly.",
      "I'm here for a deep, serious discussion.",
    ],
  },
  {
    id: 'vibe',
    question: "What's your main vibe for this specific session?",
    options: [
      'Exploring and playing around.',
      'Deep focus and mastery.',
      'Just getting through it comfortably',
    ],
  },
]

export default function MoodCheckPage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/')
      else setAuthChecked(true)
    })
  }, [router])

  const current = QUESTIONS[step]
  const isLast = step === QUESTIONS.length - 1

  function advance(value: string) {
    if (fading) return
    setSelected(value)
    setFading(true)
    setTimeout(() => {
      const newAnswers = { ...answers, [current.id]: value }
      setAnswers(newAnswers)
      if (isLast) {
        sessionStorage.setItem('moodAnswers', JSON.stringify(newAnswers))
        router.push('/learner/session')
      } else {
        setStep((s) => s + 1)
        setSelected(null)
        setFading(false)
      }
    }, 280)
  }

  if (!authChecked) return <div className="sabi-page" />

  return (
    <div className="sabi-page items-center justify-between py-12 px-6">

      {/* Content area */}
      <div
        className={`flex flex-col items-center w-full max-w-xs mx-auto transition-opacity duration-200 ${fading ? 'opacity-0' : 'opacity-100'}`}
        style={{ flex: 1, justifyContent: 'center' }}
      >
        {/* Mascot */}
        <Image src={logo} alt="SABI" height={72} priority className="mb-8" />

        {/* Question */}
        <h2 className="text-xl font-extrabold text-center leading-snug mb-8"
            style={{ color: 'var(--color-text)' }}>
          {current.question}
        </h2>

        {/* Options */}
        <div className="w-full flex flex-col gap-3">
          {current.options.map((opt) => (
            <button
              key={opt}
              onClick={() => advance(opt)}
              className={`sabi-option${selected === opt ? ' selected' : ''}`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex items-center gap-2 mt-10">
        {QUESTIONS.map((_, i) => (
          <span
            key={i}
            className={`sabi-dot${i === step ? ' active' : i < step ? ' done' : ''}`}
          />
        ))}
      </div>

      {/* Back */}
      <button
        className="sabi-back mt-5"
        onClick={() => {
          if (step === 0) router.push('/learner/home')
          else { setStep((s) => s - 1); setSelected(null) }
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        {step === 0 ? 'Back to home' : 'Previous'}
      </button>
    </div>
  )
}
