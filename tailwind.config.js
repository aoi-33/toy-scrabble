/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // docs/design.md §5.1 の 3 段階（モバイル 〜480px / タブレット 481〜768px /
      // PC 769px〜）を min-width に読み替えたもの。Tailwind の screens は min-width
      // なので、プレフィックス無し = モバイル、sm: = タブレット以上、md: = PC 以上。
      // 「PC のみ」を表すのは md: である（sm: ではない）。
      // extend の下に置いているため既定値とマージされ、xl(1280px) / 2xl(1536px) は
      // そのまま残る。design.md の 3 段階には対応しないので使わないこと。
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
