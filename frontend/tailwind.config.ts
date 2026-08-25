import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#07111f',
        navy: '#0b1a2b',
        panel: '#102235',
        raised: '#142b42',
        line: '#20394f',
        muted: '#8ca1b5',
        signal: '#54d6c5',
        'signal-dim': '#163f42',
        warning: '#e8b86a',
        danger: '#ed8f8f',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        panel: '0 18px 48px rgba(0, 0, 0, 0.18)',
        insetline: 'inset 0 1px 0 rgba(255, 255, 255, 0.025)',
      },
    },
  },
  plugins: [],
} satisfies Config
