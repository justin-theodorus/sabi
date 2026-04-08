'use client'

import { SCENARIO_LIST, type ScenarioConfig } from '@/lib/scenarios'

interface ModeSelectorProps {
  onStart: (scenario: ScenarioConfig, mode: 'learning' | 'survival') => void
}

export default function ModeSelector({ onStart }: ModeSelectorProps) {
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-6 py-10 gap-8">
      <div className="text-center">
        <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-white font-bold text-2xl">S</span>
        </div>
        <h1 className="text-white text-2xl font-bold">Choose Your Session</h1>
        <p className="text-gray-400 text-sm mt-1">Select a scenario and mode to begin</p>
      </div>

      <div className="w-full max-w-xl flex flex-col gap-6">
        {SCENARIO_LIST.map((scenario) => (
          <div
            key={scenario.id}
            className="bg-gray-800 border border-gray-700 rounded-xl p-5"
          >
            <h2 className="text-white font-semibold text-lg mb-1">{scenario.title}</h2>
            <p className="text-gray-400 text-sm mb-4">{scenario.description}</p>
            <div className="flex gap-3">
              <button
                onClick={() => onStart(scenario, 'learning')}
                className="flex-1 py-2.5 px-4 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                <span className="w-2.5 h-2.5 bg-green-300 rounded-full" />
                Learning Mode
              </button>
              <button
                onClick={() => onStart(scenario, 'survival')}
                className="flex-1 py-2.5 px-4 bg-rose-700 hover:bg-rose-600 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                ❤️ Survival Mode
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
