import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // AAC category colors
        'aac-core': '#FFFFFF',
        'aac-social': '#4CAF50',
        'aac-emotions': '#E91E63',
        'aac-actions': '#FF9800',
        'aac-people': '#2196F3',
        'aac-descriptors': '#FFEB3B',
      },
    },
  },
  plugins: [],
}
export default config
