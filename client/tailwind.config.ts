import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#22C55E',
        accent:  '#F97316',
        gold:    '#EAB308',
        bg:      '#0A1A0F',
        tile:    '#FFFBF0',
        surface: '#0F2318',
        border:  'rgba(255,255,255,0.10)',
      },
      fontFamily: {
        header: ['"Bebas Neue"', 'cursive'],
        body: ['Nunito', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
