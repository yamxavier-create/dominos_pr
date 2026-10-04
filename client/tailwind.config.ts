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
        // «Mesa de club»: the game screen. Menu, lobby and modals keep the tokens above.
        club: {
          bg:        '#0F2A1B', // screen behind the table
          felt:      '#1B4A30',
          wood:      '#7A4A2B',
          grain:     '#633A20', // wood grain and shadow
          'wood-edge': '#5A351E',
          brass:     '#C9A24A',
          'brass-edge': '#7A5A1E',
          cream:     '#F1E3C2', // score sign and buttons
          ink:       '#2B1B12', // text on cream, tile body
          text:      '#F3EAD3', // main text on green
          muted:     '#C9D8C4', // secondary text on green
          us:        '#1B5E3A', // our score, partner camera
          them:      '#B3261E', // their score
          'cam-them': '#8E2A22',
          face:      '#F4EBD3', // tile face
          pip:       '#1C1410',
          edge:      '#C6B287', // tile thickness
          strip:     '#07160E', // name strip inside a camera
        },
      },
      fontFamily: {
        header: ['"Bebas Neue"', 'cursive'],
        body: ['Nunito', 'sans-serif'],
        'club-display': ['"Alfa Slab One"', 'serif'],
        club: ['Barlow', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
