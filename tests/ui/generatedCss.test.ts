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
