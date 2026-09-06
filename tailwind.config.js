/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // docs/design.md §5.1: sm 〜480px / md 481〜768px / lg 769px〜（min-width で表現）
      screens: {
        sm: '481px',
        md: '769px',
        lg: '1025px',
      },
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
