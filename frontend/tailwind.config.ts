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
        // SF Pro Rounded on Apple, DM Sans as web fallback
        rounded: ['SF Pro Rounded', 'DM Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        // New SABI design tokens
        brand: {
          green:  '#2FB05A',
          blue:   '#7DB2F6',
          yellow: '#FEDB5A',
          pink:   '#FF93A1',
        },
        // Legacy compat
        primary:   { DEFAULT: '#7DB2F6', dark: '#5a9de8', light: '#dbeafe' },
        accent:    { DEFAULT: '#2FB05A', dark: '#259e4f' },
        // AAC category colors (unchanged)
        'aac-core':        '#FFFFFF',
        'aac-social':      '#4CAF50',
        'aac-emotions':    '#E91E63',
        'aac-actions':     '#FF9800',
        'aac-people':      '#2196F3',
        'aac-descriptors': '#FFEB3B',
      },
      borderRadius: {
        pill:  '9999px',
        card:  '1.375rem', // 22px
        card2: '1rem',     // 16px
      },
      boxShadow: {
        card:    '0 1px 4px 0 rgba(0,0,0,0.06)',
        'card-md': '0 4px 16px 0 rgba(0,0,0,0.09)',
        'card-hover': '0 16px 40px rgba(0,0,0,.11)',
      },
    },
  },
  plugins: [],
}
export default config
