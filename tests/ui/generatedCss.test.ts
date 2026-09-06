import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';

// tailwind.config.js は型定義を持たない JS モジュールで、tsconfig.app.json は
// tests を include しつつ allowJs を持たないため、静的 import すると TS7016 で
// npm run build が落ちる。変数経由の動的 import なら TypeScript がモジュール
// 解決を試みないので型エラーにならない。
const CONFIG_PATH = '../../tailwind.config.js';

async function loadTailwindConfig(): Promise<Record<string, unknown>> {
  const mod = await import(CONFIG_PATH);
  return mod.default;
}

// 実際の tailwind.config.js と src/index.css を通して CSS を生成する。
// content 走査は index.html と src/**/*.{ts,tsx} を対象にするので、
// 生成 CSS はコンポーネントが実際に使っているクラスを反映する。
// vitest の cwd はプロジェクトルート。import.meta.url からの new URL() は
// jsdom 環境では "The URL must be of scheme file" で落ちるので使わない。
async function buildCss(): Promise<string> {
  const src = readFileSync('src/index.css', 'utf8');
  const result = await postcss([tailwindcss('./tailwind.config.js')]).process(src, {
    from: undefined,
  });
  return result.css;
}

// ブレークポイント検証用の CSS。content を固定文字列にすることで、
// コンポーネントがたまたま sm: を使っているかどうかに依存せず、
// 設定に書いたブレークポイントそのものを検証できる。
async function buildProbeCss(): Promise<string> {
  const config = await loadTailwindConfig();
  const result = await postcss([
    tailwindcss({
      presets: [config],
      content: [{ raw: '<div class="sm:block md:block lg:block"></div>' }],
    }),
  ]).process('@tailwind utilities;', { from: undefined });
  return result.css;
}

let css = '';
let probeCss = '';
beforeAll(async () => {
  css = await buildCss();
  probeCss = await buildProbeCss();
}, 60_000);

describe('Tailwind ブレークポイント', () => {
  it('sm: が design.md の 481px になる', () => {
    expect(probeCss).toContain('@media (min-width: 481px)');
  });

  it('md: が design.md の 769px（PC の下限）になる', () => {
    expect(probeCss).toContain('@media (min-width: 769px)');
  });

  it('Tailwind デフォルトの 640px / 768px を使わない', () => {
    expect(probeCss).not.toContain('@media (min-width: 640px)');
    expect(probeCss).not.toContain('@media (min-width: 768px)');
  });

  it('生成 CSS にデフォルトの 640px ブレークポイントが残らない', () => {
    expect(css).not.toContain('@media (min-width: 640px)');
  });
});

describe('セルサイズの CSS 変数', () => {
  it('モバイルでは 92vw を 15 分割し、下限 20px を保証する', () => {
    expect(css).toMatch(/--cell-size:\s*max\(20px,\s*calc\(\(92vw - 22px\)\s*\/\s*15\)\)/);
  });

  it('手札タイルは 44px を下回らない', () => {
    expect(css).toMatch(/--rack-tile-size:\s*max\(44px,\s*var\(--cell-size\)\)/);
  });

  it('PC(769px〜) では --cell-size を固定値に切り替える', () => {
    expect(css).toContain('@media (min-width: 769px)');
    // 769px ブロック内で --cell-size が 36px に上書きされていること
    const pcBlock = css.slice(css.indexOf('@media (min-width: 769px)'));
    expect(pcBlock).toMatch(/--cell-size:\s*36px/);
  });
});

describe('タイルと盤面セルのサイズ', () => {
  it('--cell-size を width/height に使うユーティリティが生成される', () => {
    expect(css).toContain('width: var(--cell-size)');
    expect(css).toContain('height: var(--cell-size)');
  });

  it('文字サイズもセルサイズに追従する', () => {
    // Tailwind は calc 内の演算子まわりに空白を補って出力する
    expect(css).toContain('font-size: calc(var(--cell-size) * 0.5)');
  });
});

describe('viewport メタ', () => {
  // new URL(..., import.meta.url) は jsdom 環境で "The URL must be of scheme file"
  // になるため使わない。vitest の cwd はプロジェクトルートなので相対パスで読む。
  const html = readFileSync('index.html', 'utf8');

  it('セーフエリアを使うため viewport-fit=cover を指定する', () => {
    expect(html).toMatch(/viewport-fit=cover/);
  });

  it('ブラウザ UI の色をアプリの背景に合わせる', () => {
    expect(html).toMatch(/<meta name="theme-color" content="#1a3d24"/);
  });
});
