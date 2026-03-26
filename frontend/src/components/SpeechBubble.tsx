interface SpeechBubbleProps {
  text: string | null
  loading?: boolean
}

export default function SpeechBubble({ text, loading }: SpeechBubbleProps) {
  if (!text && !loading) return null

  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 w-[80%] max-w-lg"
      style={{ top: '8%' }}
      style={{ zIndex: 4 }}
    >
      <div className="bg-white text-gray-900 rounded-2xl px-5 py-4 shadow-xl relative text-base leading-snug">
        {loading ? (
          <div className="flex items-center gap-2 text-gray-400">
            <span className="animate-bounce">●</span>
            <span className="animate-bounce delay-100">●</span>
            <span className="animate-bounce delay-200">●</span>
          </div>
        ) : (
          text
        )}
        {/* Tail pointing down */}
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full"
          style={{
            width: 0,
            height: 0,
            borderLeft: '12px solid transparent',
            borderRight: '12px solid transparent',
            borderTop: '12px solid white',
          }}
        />
      </div>
    </div>
  )
}
