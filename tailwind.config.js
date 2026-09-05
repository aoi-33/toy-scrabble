/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'board-bg': '#2a5934',
        'cell-bg': '#d9c9a3',
        'tile-wood': '#e8c07d',
        'premium-dl': '#7ec8e3',
        'premium-tl': '#3b82f6',
        'premium-dw': '#f9a8b8',
        'premium-tw': '#e63946',
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
      },
    },
  },
  plugins: [],
};
