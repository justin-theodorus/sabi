import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        // SF Rounded on Apple, Nunito as web fallback
        rounded: ['ui-rounded', 'SF Pro Rounded', 'Nunito', 'system-ui', 'sans-serif'],
      },
      colors: {
        // SABI brand
        primary:   { DEFAULT: '#E8714A', dark: '#d4613c', light: '#FDE8DC' },
        accent:    { DEFAULT: '#29CCE5', dark: '#1ab8d0' },
        lime:      { DEFAULT: '#C8E000' },
        // AAC category colors
        'aac-core':        '#FFFFFF',
        'aac-social':      '#4CAF50',
        'aac-emotions':    '#E91E63',
        'aac-actions':     '#FF9800',
        'aac-people':      '#2196F3',
        'aac-descriptors': '#FFEB3B',
      },
      borderRadius: {
        pill: '9999px',
        card: '1.5rem',   // 24px
        card2: '1.25rem', // 20px
      },
      boxShadow: {
        card: '0 1px 4px 0 rgba(0,0,0,0.07)',
        'card-md': '0 4px 16px 0 rgba(0,0,0,0.09)',
      },
    },
  },
  plugins: [],
}
export default config
